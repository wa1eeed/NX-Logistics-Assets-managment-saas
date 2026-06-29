import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ASSET_STATUS_TRANSITIONS, AssetStatus, ContractStatus, OwnershipType, READINESS_REQUIRED_KEYS, WorkOrderStatus,
  type AssetFinancial, type AssetIdleGap, type AssetOperationContract, type AssetOperationsLog,
  type AssetProfile, type AssetSummary, type AssetTco, type AssetTimeline, type AssetTimelineEvent,
  type CommissioningInfo, type ReadinessEntry,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetStatusService } from './asset-status.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CommissionDto, CreateAssetDto, UpdateAssetDto, UpdateVehicleDto, AssetQueryDto } from './dto/asset.dto';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<string, number> = {
  DAILY: DAY_MS,
  WEEKLY: 7 * DAY_MS,
  MONTHLY: 30.44 * DAY_MS,
  YEARLY: MS_PER_YEAR,
};
const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private canSeeFinance(user: AuthenticatedUser): boolean {
    return user.permissions.includes('finance.read');
  }

  /** Restrict a where-clause to the caller's org scope (null scope = global). */
  private scopeFilter(user: AuthenticatedUser): Prisma.AssetWhereInput {
    if (user.scopeOrgUnitIds === null) return {};
    return { currentOrgUnitId: { in: user.scopeOrgUnitIds } };
  }

  async list(query: AssetQueryDto, user: AuthenticatedUser): Promise<AssetSummary[]> {
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...this.scopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownershipType ? { ownershipType: query.ownershipType } : {}),
      ...(query.assetTypeId ? { assetTypeId: query.assetTypeId } : {}),
      ...(query.assetClass ? { assetType: { assetClass: { code: query.assetClass } } } : {}),
      ...(query.search
        ? { OR: [{ code: { contains: query.search, mode: 'insensitive' } }, { model: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { assetType: { include: { assetClass: { select: { code: true } } } }, vehicle: true },
    });

    // Resolve the current project/unit names for assets that are deployed.
    const orgIds = [...new Set(assets.map((a) => a.currentOrgUnitId).filter((x): x is string => !!x))];
    const orgUnits = orgIds.length
      ? await this.prisma.orgUnit.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : [];
    const orgName = new Map(orgUnits.map((o) => [o.id, o.name]));

    const showFinance = this.canSeeFinance(user);
    return assets.map((a) => ({
      id: a.id,
      code: a.code,
      assetTypeId: a.assetTypeId,
      assetTypeName: a.assetType.name,
      assetClassCode: a.assetType.assetClass?.code ?? null,
      category: a.category,
      ownershipType: a.ownershipType as OwnershipType,
      status: a.status as AssetStatus,
      forSaleFlag: a.forSaleFlag,
      modelName: a.model,
      manufacturer: a.manufacturer,
      year: a.year,
      region: a.region,
      location: a.location,
      plateNumber: a.vehicle?.plateNumber ?? null,
      serialNo: a.serialNo,
      color: a.color,
      currentOrgUnitId: a.currentOrgUnitId,
      currentOrgUnitName: a.currentOrgUnitId ? orgName.get(a.currentOrgUnitId) ?? null : null,
      ...(showFinance ? { effectiveBookValue: this.financial(a).effectiveBookValue } : {}),
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async getProfile(id: string, user: AuthenticatedUser): Promise<AssetProfile> {
    const a = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null, ...this.scopeFilter(user) },
      include: {
        assetType: { include: { assetClass: true } },
        vehicle: true,
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!a) throw new NotFoundException('Asset not found');

    const allowed = this.allowedTransitions(a.status as AssetStatus, a.ownershipType as OwnershipType);
    const finance = this.canSeeFinance(user);
    const tco = finance ? await this.computeTco(a) : undefined;

    return {
      id: a.id,
      code: a.code,
      assetTypeId: a.assetTypeId,
      assetTypeName: a.assetType.name,
      assetClassCode: a.assetType.assetClass?.code ?? null,
      assetClassLabelEn: a.assetType.assetClass?.labelEn ?? null,
      assetClassLabelAr: a.assetType.assetClass?.labelAr ?? null,
      fieldProfile: a.assetType.assetClass?.fieldProfile ?? 'GENERIC',
      ownershipType: a.ownershipType as OwnershipType,
      status: a.status as AssetStatus,
      forSaleFlag: a.forSaleFlag,
      modelId: a.modelId,
      modelName: a.model,
      category: a.category,
      serialNo: a.serialNo,
      capacity: a.capacity,
      color: a.color,
      manufacturer: a.manufacturer,
      year: a.year,
      region: a.region,
      siteName: a.siteName,
      purchaseDate: a.purchaseDate?.toISOString() ?? null,
      location: a.location,
      currentOrgUnitId: a.currentOrgUnitId,
      customFields: (a.assetType.customFields as never) ?? [],
      customValues: (a.customValues as Record<string, unknown>) ?? {},
      vehicle: a.vehicle
        ? {
            plateNumber: a.vehicle.plateNumber,
            vin: a.vehicle.vin,
            registrationExpiry: a.vehicle.registrationExpiry?.toISOString() ?? null,
            periodicInspection: a.vehicle.periodicInspection?.toISOString() ?? null,
            insuranceExpiry: a.vehicle.insuranceExpiry?.toISOString() ?? null,
            operatingCardNo: a.vehicle.operatingCardNo,
            customsCardNo: a.vehicle.customsCardNo,
            currentDriverId: a.vehicle.currentDriverId,
          }
        : null,
      documents: a.documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
        expiryDate: d.expiryDate?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        uploadedBy: d.uploadedBy,
      })),
      ...(finance ? { financial: this.financial(a), tco } : {}),
      commissioning: this.commissioningInfo(a),
      allowedTransitions: allowed,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private commissioningInfo(a: { status: string; commissionedAt: Date | null; commissionedBy: string | null; commissioning: unknown }): CommissioningInfo {
    return {
      commissioned: a.status !== AssetStatus.COMMISSIONING,
      commissionedAt: a.commissionedAt?.toISOString() ?? null,
      commissionedBy: a.commissionedBy,
      checklist: Array.isArray(a.commissioning) ? (a.commissioning as ReadinessEntry[]) : [],
    };
  }

  /** Total cost of ownership/use: accumulated depreciation + lifetime maintenance + accrued lease. */
  private async computeTco(a: Parameters<AssetsService['financial']>[0] & { id: string }): Promise<AssetTco> {
    const fin = this.financial(a);
    const accumulatedDepreciation =
      fin.purchasePrice != null && fin.effectiveBookValue != null
        ? round2(fin.purchasePrice - fin.effectiveBookValue)
        : null;

    const wo = await this.prisma.maintenanceWorkOrder.aggregate({
      where: { assetId: a.id, status: WorkOrderStatus.CLOSED },
      _sum: { totalCost: true },
      _count: true,
    });
    const maintenanceCost = round2(Number(wo._sum.totalCost ?? 0));
    const maintenanceOrders = wo._count;

    let leaseCost = 0;
    const lease = await this.prisma.externalLeaseContract.findUnique({ where: { assetId: a.id } });
    if (lease) {
      const periodMs = PERIOD_MS[lease.ratePeriod] ?? PERIOD_MS.MONTHLY;
      const end = Math.min(Date.now(), lease.endDate.getTime());
      const periods = Math.max(0, (end - lease.startDate.getTime()) / periodMs);
      leaseCost = round2(Number(lease.periodicRate) * periods);
    }

    return {
      purchasePrice: fin.purchasePrice,
      effectiveBookValue: fin.effectiveBookValue,
      accumulatedDepreciation,
      maintenanceCost,
      maintenanceOrders,
      leaseCost,
      total: round2((accumulatedDepreciation ?? 0) + maintenanceCost + leaseCost),
      costToBookRatio: fin.effectiveBookValue ? Math.round((maintenanceCost / fin.effectiveBookValue) * 1000) / 1000 : null,
    };
  }

  /** Confirm readiness (safety + devices + compliance) → asset becomes AVAILABLE. */
  async commission(id: string, dto: CommissionDto, user: AuthenticatedUser): Promise<AssetProfile> {
    const asset = await this.ensureExists(id);
    if (asset.status !== AssetStatus.COMMISSIONING) {
      throw new BadRequestException('Asset is not in commissioning');
    }
    const okKeys = new Set(dto.checklist.filter((e) => e.ok).map((e) => e.key));
    const missing = READINESS_REQUIRED_KEYS.filter((k) => !okKeys.has(k));
    if (missing.length) {
      throw new BadRequestException(`Required readiness items not confirmed: ${missing.join(', ')}`);
    }
    await this.prisma.asset.update({
      where: { id },
      data: {
        commissioning: dto.checklist as unknown as Prisma.InputJsonValue,
        commissionedAt: new Date(),
        commissionedBy: user.id,
      },
    });
    await this.assetStatus.changeStatus(id, AssetStatus.AVAILABLE, user.id, { reason: 'Readiness confirmed (commissioned)' });
    return this.getProfile(id, user);
  }

  /** Operations log: rental contracts (issue → end) + idle gaps while available, with utilization. */
  async operations(id: string, user: AuthenticatedUser): Promise<AssetOperationsLog> {
    const asset = await this.prisma.asset.findFirst({ where: { id, deletedAt: null, ...this.scopeFilter(user) } });
    if (!asset) throw new NotFoundException('Asset not found');

    const rows = await this.prisma.rentalContract.findMany({
      where: { assetId: id, status: { not: ContractStatus.CANCELLED } },
      include: { orgUnit: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });

    const now = Date.now();
    const isActive = (s: string) => s === ContractStatus.ACTIVE || s === ContractStatus.EXTENDED;
    const opEnd = (c: { status: string; endDate: Date }) => (isActive(c.status) ? now : c.endDate.getTime());

    const contracts: AssetOperationContract[] = rows.map((c) => ({
      id: c.id,
      authorizationNo: c.authorizationNo,
      orgUnitName: c.orgUnit.name,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      status: c.status as ContractStatus,
      operatingDays: Math.max(0, Math.round((opEnd(c) - c.startDate.getTime()) / DAY_MS)),
    }));

    // Idle = available-but-not-operating stretches: from commissioning to 1st op, between ops, and after the last op while still available.
    const idleGaps: AssetIdleGap[] = [];
    let prevEnd = (asset.commissionedAt ?? asset.createdAt).getTime();
    for (const c of rows) {
      const start = c.startDate.getTime();
      const days = Math.round((start - prevEnd) / DAY_MS);
      if (days >= 1) idleGaps.push({ fromDate: new Date(prevEnd).toISOString(), toDate: c.startDate.toISOString(), days });
      prevEnd = Math.max(prevEnd, opEnd(c));
    }
    if (asset.status === AssetStatus.AVAILABLE) {
      const days = Math.round((now - prevEnd) / DAY_MS);
      if (days >= 1) idleGaps.push({ fromDate: new Date(prevEnd).toISOString(), toDate: new Date(now).toISOString(), days });
    }

    const operatingDays = contracts.reduce((s, c) => s + c.operatingDays, 0);
    const idleDays = idleGaps.reduce((s, g) => s + g.days, 0);
    const span = operatingDays + idleDays;

    return {
      generatedAt: new Date().toISOString(),
      contracts,
      idleGaps,
      totals: {
        contracts: contracts.length,
        operatingDays,
        idleDays,
        utilizationPct: span ? Math.round((operatingDays / span) * 1000) / 10 : 0,
      },
    };
  }

  /** Full chronological history of everything that happened to the asset. */
  async timeline(id: string, user: AuthenticatedUser): Promise<AssetTimeline> {
    const asset = await this.prisma.asset.findFirst({ where: { id, deletedAt: null, ...this.scopeFilter(user) } });
    if (!asset) throw new NotFoundException('Asset not found');

    const [audits, contracts, requests, workOrders, sales, leases, documents, inspections] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { entityType: 'Asset', entityId: id } }),
      this.prisma.rentalContract.findMany({ where: { assetId: id }, include: { orgUnit: { select: { name: true } } } }),
      this.prisma.equipmentRequest.findMany({ where: { reservedAssetId: id }, include: { orgUnit: { select: { name: true } } } }),
      this.prisma.maintenanceWorkOrder.findMany({ where: { assetId: id } }),
      this.prisma.saleOrder.findMany({ where: { assetId: id } }),
      this.prisma.externalLeaseContract.findMany({ where: { assetId: id }, include: { supplier: { select: { name: true } } } }),
      this.prisma.document.findMany({ where: { assetId: id, deletedAt: null } }),
      this.prisma.handoverInspection.findMany({ where: { contract: { assetId: id } } }),
    ]);

    // Resolve actor names once.
    const ids = new Set<string>();
    audits.forEach((a) => a.actorId && ids.add(a.actorId));
    contracts.forEach((c) => c.approvedBy && ids.add(c.approvedBy));
    requests.forEach((r) => { if (r.requestedBy) ids.add(r.requestedBy); if (r.decidedBy) ids.add(r.decidedBy); });
    workOrders.forEach((w) => { if (w.openedBy) ids.add(w.openedBy); if (w.closedBy) ids.add(w.closedBy); });
    sales.forEach((s) => { if (s.proposedBy) ids.add(s.proposedBy); if (s.approvedBy) ids.add(s.approvedBy); });
    documents.forEach((d) => d.uploadedBy && ids.add(d.uploadedBy));
    inspections.forEach((i) => i.signedById && ids.add(i.signedById));
    if (asset.commissionedBy) ids.add(asset.commissionedBy);
    const users = ids.size ? await this.prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, fullName: true } }) : [];
    const name = (uid?: string | null) => (uid ? users.find((u) => u.id === uid)?.fullName ?? null : null);

    const ev: AssetTimelineEvent[] = [];

    ev.push({ kind: 'CREATED', at: asset.createdAt.toISOString(), reference: asset.code, context: null, actor: null });
    if (asset.commissionedAt) ev.push({ kind: 'COMMISSIONED', at: asset.commissionedAt.toISOString(), reference: null, context: null, actor: name(asset.commissionedBy) });

    for (const a of audits) {
      if (a.action === 'STATUS_CHANGE') {
        const before = (a.before as { status?: string } | null)?.status ?? '?';
        const after = (a.after as { status?: string; reason?: string } | null)?.status ?? '?';
        const reason = (a.after as { reason?: string } | null)?.reason ?? null;
        ev.push({ kind: 'STATUS_CHANGE', at: a.createdAt.toISOString(), reference: `${before} → ${after}`, context: reason, actor: name(a.actorId) });
      } else if (a.action === 'UPDATE') {
        ev.push({ kind: 'UPDATED', at: a.createdAt.toISOString(), reference: null, context: null, actor: name(a.actorId) });
      }
    }

    for (const c of contracts) {
      ev.push({ kind: 'CONTRACT_ISSUED', at: c.createdAt.toISOString(), reference: c.authorizationNo, context: c.orgUnit.name, actor: name(c.approvedBy) });
      if (c.status === 'RETURNED') ev.push({ kind: 'CONTRACT_RETURNED', at: c.updatedAt.toISOString(), reference: c.authorizationNo, context: c.orgUnit.name, actor: null });
    }
    for (const r of requests) {
      ev.push({ kind: 'REQUEST_RESERVED', at: (r.decidedBy ? r.updatedAt : r.createdAt).toISOString(), reference: r.refNo, context: r.orgUnit.name, actor: name(r.decidedBy) });
    }
    for (const w of workOrders) {
      ev.push({ kind: 'WORK_ORDER_OPENED', at: w.openedAt.toISOString(), reference: w.refNo, context: w.description, actor: name(w.openedBy) });
      if (w.closedAt) ev.push({ kind: 'WORK_ORDER_CLOSED', at: w.closedAt.toISOString(), reference: w.refNo, context: null, actor: name(w.closedBy) });
    }
    for (const s of sales) {
      ev.push({ kind: 'SALE_PROPOSED', at: s.createdAt.toISOString(), reference: s.refNo, context: null, actor: name(s.proposedBy) });
      if (s.listedAt) ev.push({ kind: 'SALE_LISTED', at: s.listedAt.toISOString(), reference: s.refNo, context: null, actor: name(s.approvedBy) });
      if (s.soldAt) ev.push({ kind: 'SALE_SOLD', at: s.soldAt.toISOString(), reference: s.refNo, context: s.buyerName, actor: null });
    }
    for (const l of leases) {
      ev.push({ kind: 'LEASE_STARTED', at: l.createdAt.toISOString(), reference: l.refNo, context: l.supplier.name, actor: null });
    }
    for (const i of inspections) {
      ev.push({
        kind: i.kind === 'RECEIPT' ? 'INSPECTION_RECEIPT' : 'INSPECTION_RETURN',
        at: i.createdAt.toISOString(),
        reference: null,
        context: i.signedBy ?? null,
        actor: name(i.signedById),
      });
    }
    for (const d of documents) {
      ev.push({ kind: 'DOCUMENT', at: d.createdAt.toISOString(), reference: d.docType, context: d.fileName, actor: name(d.uploadedBy) });
    }

    ev.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return { generatedAt: new Date().toISOString(), events: ev };
  }

  async create(dto: CreateAssetDto, user: AuthenticatedUser): Promise<AssetProfile> {
    const code = dto.code.trim();
    const existing = await this.prisma.asset.findFirst({ where: { code } });
    if (existing) throw new ConflictException('Asset code already exists');

    // Catalog-driven: a model determines the asset type, brand and category.
    let assetTypeId = dto.assetTypeId;
    let category: string | null = null;
    let manufacturer = dto.manufacturer?.trim() || null;
    let modelName = dto.model?.trim() || null;
    if (dto.modelId) {
      const m = await this.prisma.model.findUnique({ where: { id: dto.modelId } });
      if (!m) throw new BadRequestException('Model not found');
      assetTypeId = m.assetTypeId;
      category = m.category;
      manufacturer = m.manufacturer;
      modelName = m.name;
    }
    if (!assetTypeId) throw new BadRequestException('A model or asset type is required');

    const type = await this.prisma.assetType.findUnique({ where: { id: assetTypeId } });
    if (!type) throw new BadRequestException('Asset type not found');

    const finance = this.canSeeFinance(user);
    const created = await this.prisma.asset.create({
      data: {
        code,
        assetTypeId,
        modelId: dto.modelId ?? null,
        category,
        ownershipType: dto.ownershipType,
        model: modelName,
        manufacturer,
        serialNo: dto.serialNo?.trim() || null,
        capacity: dto.capacity?.trim() || null,
        color: dto.color?.trim() || null,
        customValues: (dto.customValues as never) ?? undefined,
        year: dto.year ?? null,
        region: dto.region?.trim() || null,
        siteName: dto.siteName?.trim() || null,
        location: dto.location?.trim() || null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        ...(finance
          ? {
              purchasePrice: dto.purchasePrice ?? null,
              depreciationRate: dto.depreciationRate ?? null,
              bookValue: dto.bookValue ?? null,
            }
          : {}),
      },
    });
    // Vehicle-class assets capture plate/VIN at registration.
    if (dto.plateNumber?.trim() || dto.vin?.trim()) {
      await this.prisma.vehicleDetail.create({
        data: { assetId: created.id, plateNumber: dto.plateNumber?.trim() || null, vin: dto.vin?.trim() || null },
      });
    }
    return this.getProfile(created.id, user);
  }

  async update(id: string, dto: UpdateAssetDto, user: AuthenticatedUser): Promise<AssetProfile> {
    await this.ensureExists(id);
    const finance = this.canSeeFinance(user);

    const data: Prisma.AssetUpdateInput = {
      ...(dto.model !== undefined ? { model: dto.model?.trim() || null } : {}),
      ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer?.trim() || null } : {}),
      ...(dto.year !== undefined ? { year: dto.year } : {}),
      ...(dto.color !== undefined ? { color: dto.color?.trim() || null } : {}),
      ...(dto.customValues !== undefined ? { customValues: (dto.customValues as never) } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity?.trim() || null } : {}),
      ...(dto.serialNo !== undefined ? { serialNo: dto.serialNo?.trim() || null } : {}),
      ...(dto.region !== undefined ? { region: dto.region?.trim() || null } : {}),
      ...(dto.siteName !== undefined ? { siteName: dto.siteName?.trim() || null } : {}),
      ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
      ...(dto.purchaseDate !== undefined ? { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null } : {}),
      ...(dto.currentOrgUnitId !== undefined
        ? { currentOrgUnit: dto.currentOrgUnitId ? { connect: { id: dto.currentOrgUnitId } } : { disconnect: true } }
        : {}),
      ...(finance && dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice } : {}),
      ...(finance && dto.depreciationRate !== undefined ? { depreciationRate: dto.depreciationRate } : {}),
      ...(finance && dto.bookValue !== undefined ? { bookValue: dto.bookValue } : {}),
    };

    await this.prisma.asset.update({ where: { id }, data });
    return this.getProfile(id, user);
  }

  async upsertVehicle(id: string, dto: UpdateVehicleDto, user: AuthenticatedUser): Promise<AssetProfile> {
    await this.ensureExists(id);
    const data = {
      plateNumber: dto.plateNumber ?? null,
      vin: dto.vin ?? null,
      registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : null,
      periodicInspection: dto.periodicInspection ? new Date(dto.periodicInspection) : null,
      insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : null,
      operatingCardNo: dto.operatingCardNo ?? null,
      customsCardNo: dto.customsCardNo ?? null,
      currentDriverId: dto.currentDriverId ?? null,
    };
    await this.prisma.vehicleDetail.upsert({
      where: { assetId: id },
      create: { assetId: id, ...data },
      update: data,
    });
    return this.getProfile(id, user);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  private async ensureExists(id: string) {
    const a = await this.prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw new NotFoundException('Asset not found');
    return a;
  }

  /** Hybrid depreciation: straight-line auto-compute + manual override. */
  private financial(a: { purchasePrice: Prisma.Decimal | null; depreciationRate: Prisma.Decimal | null; bookValue: Prisma.Decimal | null; purchaseDate: Date | null; ownershipType: string }): AssetFinancial {
    const purchasePrice = dec(a.purchasePrice);
    const rate = dec(a.depreciationRate);
    const manual = dec(a.bookValue);
    const ageYears = a.purchaseDate ? (Date.now() - a.purchaseDate.getTime()) / MS_PER_YEAR : null;

    let computed: number | null = null;
    if (purchasePrice != null) {
      if (rate != null && ageYears != null) {
        computed = Math.max(purchasePrice - purchasePrice * rate * ageYears, 0);
        computed = Math.round(computed * 100) / 100;
      } else {
        computed = purchasePrice;
      }
    }

    return {
      ownershipType: a.ownershipType as OwnershipType,
      purchasePrice,
      depreciationRate: rate,
      manualBookValue: manual,
      computedBookValue: computed,
      effectiveBookValue: manual ?? computed,
      ageYears: ageYears == null ? null : Math.round(ageYears * 100) / 100,
    };
  }

  private allowedTransitions(status: AssetStatus, ownership: OwnershipType): AssetStatus[] {
    let next = ASSET_STATUS_TRANSITIONS[status] ?? [];
    if (ownership !== OwnershipType.OWNED) {
      next = next.filter((s) => s !== AssetStatus.FOR_SALE);
    }
    if (ownership === OwnershipType.OWNED) {
      // owned assets are disposed via FOR_SALE, not directly from AVAILABLE
      if (status === AssetStatus.AVAILABLE) next = next.filter((s) => s !== AssetStatus.DISPOSED);
    }
    return next;
  }
}
