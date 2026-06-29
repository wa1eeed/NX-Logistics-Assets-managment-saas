import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetStatus, ContractStatus, EquipmentRequestStatus, InspectionKind, OwnershipType,
  type CustodyView, type EquipmentRequestSummary, type RentalContractSummary,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetStatusService } from '../assets/asset-status.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  ApproveRequestDto, AssignDispatchDto, ContractQueryDto, CreateRequestDto, ExtendContractDto, IssueContractDto, RequestQueryDto,
} from './dto/rentals.dto';

const DAY = 24 * 60 * 60 * 1000;
const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private canSeeFinance(u: AuthenticatedUser) {
    return u.permissions.includes('finance.read');
  }

  /** True if the caller may act on the given org unit. */
  private inScope(user: AuthenticatedUser, orgUnitId: string): boolean {
    return user.scopeOrgUnitIds === null || user.scopeOrgUnitIds.includes(orgUnitId);
  }

  private orgScopeWhere(user: AuthenticatedUser): { orgUnitId?: { in: string[] } } {
    return user.scopeOrgUnitIds === null ? {} : { orgUnitId: { in: user.scopeOrgUnitIds } };
  }

  /** Org units the caller may file a request for (their scope; all if global). */
  async requestableOrgUnits(user: AuthenticatedUser) {
    const where: Prisma.OrgUnitWhereInput =
      user.scopeOrgUnitIds === null
        ? { deletedAt: null, isActive: true }
        : { deletedAt: null, isActive: true, id: { in: user.scopeOrgUnitIds } };
    return this.prisma.orgUnit.findMany({ where, orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true } });
  }

  // ---------------- Equipment requests ----------------

  async createRequest(dto: CreateRequestDto, user: AuthenticatedUser): Promise<EquipmentRequestSummary> {
    if (!this.inScope(user, dto.orgUnitId)) {
      throw new ForbiddenException('Org unit out of your scope');
    }
    const [org, type] = await Promise.all([
      this.prisma.orgUnit.findFirst({ where: { id: dto.orgUnitId, deletedAt: null } }),
      this.prisma.assetType.findUnique({ where: { id: dto.assetTypeId } }),
    ]);
    if (!org) throw new BadRequestException('Org unit not found');
    if (!type) throw new BadRequestException('Asset type not found');

    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (!(from < to)) throw new BadRequestException('fromDate must be before toDate');

    const req = await this.prisma.equipmentRequest.create({
      data: {
        orgUnitId: dto.orgUnitId,
        assetTypeId: dto.assetTypeId,
        fromDate: from,
        toDate: to,
        notes: dto.notes?.trim() || null,
        requestedBy: user.id,
      },
    });
    return this.requestSummary(req.id);
  }

  async listRequests(query: RequestQueryDto, user: AuthenticatedUser): Promise<EquipmentRequestSummary[]> {
    const where: Prisma.EquipmentRequestWhereInput = {
      ...this.orgScopeWhere(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
    };
    const rows = await this.prisma.equipmentRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { orgUnit: true, contract: { select: { id: true } } },
    });
    const typeIds = [...new Set(rows.map((r) => r.assetTypeId))];
    const reservedIds = rows.map((r) => r.reservedAssetId).filter((x): x is string => !!x);
    const [types, reserved] = await Promise.all([
      this.prisma.assetType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } }),
      reservedIds.length ? this.prisma.asset.findMany({ where: { id: { in: reservedIds } }, select: { id: true, code: true } }) : Promise.resolve([]),
    ]);
    const typeName = new Map(types.map((t) => [t.id, t.name]));
    const code = new Map(reserved.map((a) => [a.id, a.code]));

    return rows.map((r) => ({
      id: r.id,
      orgUnitId: r.orgUnitId,
      orgUnitName: r.orgUnit.name,
      assetTypeId: r.assetTypeId,
      assetTypeName: typeName.get(r.assetTypeId) ?? '—',
      fromDate: r.fromDate.toISOString(),
      toDate: r.toDate.toISOString(),
      status: r.status as EquipmentRequestStatus,
      requestedBy: r.requestedBy,
      decidedBy: r.decidedBy,
      reservedAssetId: r.reservedAssetId,
      reservedAssetCode: r.reservedAssetId ? code.get(r.reservedAssetId) ?? null : null,
      notes: r.notes,
      contractId: r.contract?.id ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async approve(requestId: string, dto: ApproveRequestDto, user: AuthenticatedUser): Promise<EquipmentRequestSummary> {
    const req = await this.getRequestOrThrow(requestId);
    if (req.status !== EquipmentRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new BadRequestException('Asset not found');
    if (asset.assetTypeId !== req.assetTypeId) throw new BadRequestException('Asset type mismatch');
    if (asset.status !== AssetStatus.AVAILABLE) throw new BadRequestException('Asset is not available');

    await this.assetStatus.changeStatus(dto.assetId, AssetStatus.RESERVED, user.id, { reason: `Reserved for request ${requestId}` });
    await this.prisma.equipmentRequest.update({
      where: { id: requestId },
      data: { status: EquipmentRequestStatus.APPROVED, decidedBy: user.id, reservedAssetId: dto.assetId },
    });
    return this.requestSummary(requestId);
  }

  async reject(requestId: string, user: AuthenticatedUser): Promise<EquipmentRequestSummary> {
    const req = await this.getRequestOrThrow(requestId);
    if (!([EquipmentRequestStatus.PENDING, EquipmentRequestStatus.APPROVED] as EquipmentRequestStatus[]).includes(req.status as EquipmentRequestStatus)) {
      throw new BadRequestException('Request cannot be rejected in its current state');
    }
    await this.releaseReserved(req.reservedAssetId, user.id);
    await this.prisma.equipmentRequest.update({
      where: { id: requestId },
      data: { status: EquipmentRequestStatus.REJECTED, decidedBy: user.id, reservedAssetId: null },
    });
    return this.requestSummary(requestId);
  }

  async cancel(requestId: string, user: AuthenticatedUser): Promise<EquipmentRequestSummary> {
    const req = await this.getRequestOrThrow(requestId);
    if (!([EquipmentRequestStatus.PENDING, EquipmentRequestStatus.APPROVED] as EquipmentRequestStatus[]).includes(req.status as EquipmentRequestStatus)) {
      throw new BadRequestException('Request cannot be cancelled in its current state');
    }
    await this.releaseReserved(req.reservedAssetId, user.id);
    await this.prisma.equipmentRequest.update({
      where: { id: requestId },
      data: { status: EquipmentRequestStatus.CANCELLED, reservedAssetId: null },
    });
    return this.requestSummary(requestId);
  }

  async issueContract(requestId: string, dto: IssueContractDto, user: AuthenticatedUser): Promise<RentalContractSummary> {
    const req = await this.getRequestOrThrow(requestId);
    if (req.status !== EquipmentRequestStatus.APPROVED || !req.reservedAssetId) {
      throw new BadRequestException('Request must be approved with a reserved asset');
    }
    const authorizationNo = dto.authorizationNo?.trim() || (await this.nextAuthorizationNo());

    const contract = await this.prisma.rentalContract.create({
      data: {
        authorizationNo,
        assetId: req.reservedAssetId,
        orgUnitId: req.orgUnitId,
        requestId: req.id,
        startDate: req.fromDate,
        endDate: req.toDate,
        status: ContractStatus.ACTIVE,
        internalRate: dto.internalRate ?? null,
        approvedBy: user.id,
      },
    });

    await this.assetStatus.changeStatus(req.reservedAssetId, AssetStatus.IN_DUTY, user.id, {
      reason: `Authorization ${authorizationNo}`,
    });
    await this.prisma.asset.update({ where: { id: req.reservedAssetId }, data: { currentOrgUnitId: req.orgUnitId } });
    await this.prisma.equipmentRequest.update({ where: { id: requestId }, data: { status: EquipmentRequestStatus.FULFILLED } });

    return this.contractSummaryById(contract.id, user);
  }

  /**
   * One-step transport action: the dispatch team picks the asset for an open
   * request and puts it straight into operation for the project. Reserves +
   * authorizes + dispatches atomically: asset → IN_DUTY, contract created,
   * asset.currentOrgUnitId = the project, request → FULFILLED.
   */
  async assignAndDispatch(requestId: string, dto: AssignDispatchDto, user: AuthenticatedUser): Promise<RentalContractSummary> {
    const req = await this.getRequestOrThrow(requestId);
    if (!([EquipmentRequestStatus.PENDING, EquipmentRequestStatus.APPROVED] as EquipmentRequestStatus[]).includes(req.status as EquipmentRequestStatus)) {
      throw new BadRequestException('Only open (pending/approved) requests can be dispatched');
    }
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new BadRequestException('Asset not found');
    if (asset.assetTypeId !== req.assetTypeId) throw new BadRequestException('Asset type mismatch');
    if (!([AssetStatus.AVAILABLE, AssetStatus.RESERVED] as AssetStatus[]).includes(asset.status as AssetStatus)) {
      throw new BadRequestException('Asset is not available for dispatch');
    }
    // If this asset was reserved for a different request, block it.
    if (asset.status === AssetStatus.RESERVED && req.reservedAssetId && req.reservedAssetId !== asset.id) {
      throw new BadRequestException('Asset is reserved for another request');
    }

    const authorizationNo = dto.authorizationNo?.trim() || (await this.nextAuthorizationNo());

    const contract = await this.prisma.rentalContract.create({
      data: {
        authorizationNo,
        assetId: asset.id,
        orgUnitId: req.orgUnitId,
        requestId: req.id,
        startDate: req.fromDate,
        endDate: req.toDate,
        status: ContractStatus.ACTIVE,
        internalRate: dto.internalRate ?? null,
        approvedBy: user.id,
      },
    });

    await this.assetStatus.changeStatus(asset.id, AssetStatus.IN_DUTY, user.id, {
      reason: `Dispatched to project via authorization ${authorizationNo}`,
    });
    await this.prisma.asset.update({ where: { id: asset.id }, data: { currentOrgUnitId: req.orgUnitId } });
    await this.prisma.equipmentRequest.update({
      where: { id: requestId },
      data: { status: EquipmentRequestStatus.FULFILLED, reservedAssetId: asset.id, decidedBy: user.id },
    });

    return this.contractSummaryById(contract.id, user);
  }

  // ---------------- Contracts ----------------

  async listContracts(query: ContractQueryDto, user: AuthenticatedUser): Promise<RentalContractSummary[]> {
    const where: Prisma.RentalContractWhereInput = {
      ...this.orgScopeWhere(user),
      ...(query.status ? { status: query.status } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
    };
    const rows = await this.prisma.rentalContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { orgUnit: true, asset: { include: { assetType: true } } },
    });
    return rows.map((c) => this.toContractSummary(c, user));
  }

  /** Project-portal view: active custody in scope + expiry alerts. */
  async custody(user: AuthenticatedUser): Promise<CustodyView> {
    const where: Prisma.RentalContractWhereInput = {
      ...this.orgScopeWhere(user),
      status: { in: [ContractStatus.ACTIVE, ContractStatus.EXTENDED] },
    };
    const rows = await this.prisma.rentalContract.findMany({
      where,
      orderBy: { endDate: 'asc' },
      include: { orgUnit: true, asset: { include: { assetType: true } } },
    });
    const contracts = rows.map((c) => this.toContractSummary(c, user));

    const setting = await this.prisma.setting.findUnique({ where: { key: 'alerts.contractExpiryDays' } });
    const expiryThresholdDays = Number(setting?.value ?? 14) || 14;

    const summary = {
      active: contracts.length,
      expiringSoon: contracts.filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= expiryThresholdDays).length,
      overdue: contracts.filter((c) => c.daysRemaining < 0).length,
    };
    return { expiryThresholdDays, summary, contracts };
  }

  async extend(contractId: string, dto: ExtendContractDto, user: AuthenticatedUser): Promise<RentalContractSummary> {
    const c = await this.getContractOrThrow(contractId);
    if (!([ContractStatus.ACTIVE, ContractStatus.EXTENDED] as ContractStatus[]).includes(c.status as ContractStatus)) {
      throw new BadRequestException('Only active contracts can be extended');
    }
    const newEnd = new Date(dto.endDate);
    if (!(newEnd > c.endDate)) throw new BadRequestException('New end date must be after the current end date');
    await this.prisma.rentalContract.update({
      where: { id: contractId },
      data: { endDate: newEnd, status: ContractStatus.EXTENDED },
    });
    return this.contractSummaryById(contractId, user);
  }

  async returnContract(contractId: string, user: AuthenticatedUser): Promise<RentalContractSummary> {
    const c = await this.getContractOrThrow(contractId);
    if (!([ContractStatus.ACTIVE, ContractStatus.EXTENDED] as ContractStatus[]).includes(c.status as ContractStatus)) {
      throw new BadRequestException('Only active contracts can be returned');
    }
    // Governance gate: no return without a return condition inspection (docs §7 "لا تسليم بلا فحص").
    const returnInspection = await this.prisma.handoverInspection.findFirst({ where: { contractId, kind: InspectionKind.RETURN } });
    if (!returnInspection) {
      throw new BadRequestException('A return inspection is required before handing the asset back');
    }
    const asset = await this.prisma.asset.findUnique({ where: { id: c.assetId } });
    // Flagged "not to be re-rented" owned assets go straight to FOR_SALE.
    const target =
      asset?.forSaleFlag && asset.ownershipType === OwnershipType.OWNED ? AssetStatus.FOR_SALE : AssetStatus.AVAILABLE;

    await this.assetStatus.changeStatus(c.assetId, target, user.id, { reason: `Returned from contract ${c.authorizationNo}` });
    await this.prisma.asset.update({ where: { id: c.assetId }, data: { currentOrgUnitId: null } });
    await this.prisma.rentalContract.update({ where: { id: contractId }, data: { status: ContractStatus.RETURNED } });

    return this.contractSummaryById(contractId, user);
  }

  // ---------------- helpers ----------------

  private async releaseReserved(assetId: string | null, actorId: string) {
    if (!assetId) return;
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (asset?.status === AssetStatus.RESERVED) {
      await this.assetStatus.changeStatus(assetId, AssetStatus.AVAILABLE, actorId, { reason: 'Reservation released' });
    }
  }

  private async nextAuthorizationNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.rentalContract.count();
    return `AUTH-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async getRequestOrThrow(id: string) {
    const req = await this.prisma.equipmentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  private async getContractOrThrow(id: string) {
    const c = await this.prisma.rentalContract.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contract not found');
    return c;
  }

  private async requestSummary(id: string): Promise<EquipmentRequestSummary> {
    const r = await this.prisma.equipmentRequest.findUniqueOrThrow({
      where: { id },
      include: { orgUnit: true, contract: { select: { id: true } } },
    });
    const type = await this.prisma.assetType.findUnique({ where: { id: r.assetTypeId }, select: { name: true } });
    const reserved = r.reservedAssetId
      ? await this.prisma.asset.findUnique({ where: { id: r.reservedAssetId }, select: { code: true } })
      : null;
    return {
      id: r.id,
      orgUnitId: r.orgUnitId,
      orgUnitName: r.orgUnit.name,
      assetTypeId: r.assetTypeId,
      assetTypeName: type?.name ?? '—',
      fromDate: r.fromDate.toISOString(),
      toDate: r.toDate.toISOString(),
      status: r.status as EquipmentRequestStatus,
      requestedBy: r.requestedBy,
      decidedBy: r.decidedBy,
      reservedAssetId: r.reservedAssetId,
      reservedAssetCode: reserved?.code ?? null,
      notes: r.notes,
      contractId: r.contract?.id ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async contractSummaryById(id: string, user: AuthenticatedUser): Promise<RentalContractSummary> {
    const c = await this.prisma.rentalContract.findUniqueOrThrow({
      where: { id },
      include: { orgUnit: true, asset: { include: { assetType: true } } },
    });
    return this.toContractSummary(c, user);
  }

  private toContractSummary(
    c: Prisma.RentalContractGetPayload<{ include: { orgUnit: true; asset: { include: { assetType: true } } } }>,
    user: AuthenticatedUser,
  ): RentalContractSummary {
    const daysRemaining = Math.ceil((c.endDate.getTime() - Date.now()) / DAY);
    return {
      id: c.id,
      authorizationNo: c.authorizationNo,
      assetId: c.assetId,
      assetCode: c.asset.code,
      assetTypeName: c.asset.assetType.name,
      orgUnitId: c.orgUnitId,
      orgUnitName: c.orgUnit.name,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      status: c.status as ContractStatus,
      daysRemaining,
      ...(this.canSeeFinance(user) ? { internalRate: dec(c.internalRate) } : {}),
      createdAt: c.createdAt.toISOString(),
    };
  }
}
