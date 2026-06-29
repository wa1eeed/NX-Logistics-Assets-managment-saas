import { Injectable } from '@nestjs/common';
import { AssetStatus, ContractStatus, EquipmentRequestStatus, WorkOrderStatus, type AlertItem, type AlertsView } from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PreventiveService } from '../preventive/preventive.service';

const DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.25 * DAY;
const decNum = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));

/** Hybrid book value: manual override else straight-line. Mirrors AssetsService.financial. */
function effectiveBookValue(a: { purchasePrice: Prisma.Decimal | null; depreciationRate: Prisma.Decimal | null; bookValue: Prisma.Decimal | null; purchaseDate: Date | null }): number | null {
  const manual = decNum(a.bookValue);
  if (manual != null) return manual;
  const price = decNum(a.purchasePrice);
  if (price == null) return null;
  const rate = decNum(a.depreciationRate);
  if (rate == null || !a.purchaseDate) return price;
  const ageYears = (Date.now() - a.purchaseDate.getTime()) / MS_PER_YEAR;
  return Math.max(price - price * rate * ageYears, 0);
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preventive: PreventiveService,
  ) {}

  private async threshold(key: string, fallback: number): Promise<number> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    return Number(s?.value ?? fallback) || fallback;
  }

  private days(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / DAY);
  }

  /** Live alerts across documents, vehicles, contracts, leases and drivers. */
  async compute(): Promise<AlertsView> {
    const docDays = await this.threshold('alerts.documentExpiryDays', 30);
    const contractDays = await this.threshold('alerts.contractExpiryDays', 14);
    const now = Date.now();
    const docHorizon = new Date(now + docDays * DAY);
    const contractHorizon = new Date(now + contractDays * DAY);

    const items: AlertItem[] = [];
    const push = (a: AlertItem) => items.push(a);
    const sev = (d: number): 'warning' | 'danger' => (d < 0 ? 'danger' : 'warning');

    // Documents with expiry (registration/customs/license docs)
    const docs = await this.prisma.document.findMany({
      where: { deletedAt: null, expiryDate: { not: null, lte: docHorizon } },
      include: { asset: { select: { code: true } } },
    });
    for (const d of docs) {
      const dr = this.days(d.expiryDate!);
      push({ kind: 'DOC_EXPIRY', severity: sev(dr), title: d.docType, reference: d.asset?.code ?? d.fileName ?? '—', date: d.expiryDate!.toISOString(), daysRemaining: dr, entityType: 'Document', entityId: d.id });
    }

    // Vehicle registration + periodic inspection + insurance (safety/compliance)
    const vehicles = await this.prisma.vehicleDetail.findMany({
      where: { OR: [
        { registrationExpiry: { not: null, lte: docHorizon } },
        { periodicInspection: { not: null, lte: docHorizon } },
        { insuranceExpiry: { not: null, lte: docHorizon } },
      ] },
      include: { asset: { select: { code: true } } },
    });
    for (const v of vehicles) {
      if (v.registrationExpiry && v.registrationExpiry <= docHorizon) {
        const dr = this.days(v.registrationExpiry);
        push({ kind: 'REGISTRATION_EXPIRY', severity: sev(dr), title: 'Registration', reference: v.asset.code, date: v.registrationExpiry.toISOString(), daysRemaining: dr, entityType: 'Asset', entityId: v.assetId });
      }
      if (v.periodicInspection && v.periodicInspection <= docHorizon) {
        const dr = this.days(v.periodicInspection);
        push({ kind: 'INSPECTION_EXPIRY', severity: sev(dr), title: 'Periodic inspection', reference: v.asset.code, date: v.periodicInspection.toISOString(), daysRemaining: dr, entityType: 'Asset', entityId: v.assetId });
      }
      if (v.insuranceExpiry && v.insuranceExpiry <= docHorizon) {
        const dr = this.days(v.insuranceExpiry);
        push({ kind: 'INSURANCE_EXPIRY', severity: sev(dr), title: 'Insurance', reference: v.asset.code, date: v.insuranceExpiry.toISOString(), daysRemaining: dr, entityType: 'Asset', entityId: v.assetId });
      }
    }

    // Preventive maintenance due (meter/time based) — reuse the compliance engine.
    const compliance = await this.preventive.compliance();
    for (const c of compliance.items.filter((i) => i.kind === 'PREVENTIVE_DUE')) {
      const rem = c.remaining ?? 0;
      push({
        kind: 'PREVENTIVE_DUE',
        severity: c.status === 'OVERDUE' ? 'danger' : 'warning',
        title: `${c.label} (${rem < 0 ? 'overdue ' : ''}${Math.abs(rem)} ${c.unit.toLowerCase()})`,
        reference: c.assetCode,
        date: c.date,
        daysRemaining: c.unit === 'DAYS' ? rem : null,
        entityType: 'Asset',
        entityId: c.assetId,
      });
    }

    // Rental contracts nearing end
    const contracts = await this.prisma.rentalContract.findMany({
      where: { status: { in: [ContractStatus.ACTIVE, ContractStatus.EXTENDED] }, endDate: { lte: contractHorizon } },
      include: { asset: { select: { code: true } } },
    });
    for (const c of contracts) {
      const dr = this.days(c.endDate);
      push({ kind: 'CONTRACT_EXPIRY', severity: sev(dr), title: c.authorizationNo, reference: c.asset.code, date: c.endDate.toISOString(), daysRemaining: dr, entityType: 'RentalContract', entityId: c.id });
    }

    // External leases nearing end
    const leases = await this.prisma.externalLeaseContract.findMany({
      where: { endDate: { lte: contractHorizon } },
      include: { asset: { select: { code: true } }, supplier: { select: { name: true } } },
    });
    for (const l of leases) {
      const dr = this.days(l.endDate);
      push({ kind: 'LEASE_EXPIRY', severity: sev(dr), title: l.refNo ?? l.supplier.name, reference: l.asset.code, date: l.endDate.toISOString(), daysRemaining: dr, entityType: 'ExternalLeaseContract', entityId: l.id });
    }

    // Driver license / iqama expiry
    const drivers = await this.prisma.driver.findMany({
      where: { deletedAt: null, OR: [{ licenseExpiry: { not: null, lte: docHorizon } }, { iqamaExpiry: { not: null, lte: docHorizon } }] },
    });
    for (const dv of drivers) {
      if (dv.licenseExpiry && dv.licenseExpiry <= docHorizon) {
        const dr = this.days(dv.licenseExpiry);
        push({ kind: 'DRIVER_DOC_EXPIRY', severity: sev(dr), title: 'Driver license', reference: dv.fullName, date: dv.licenseExpiry.toISOString(), daysRemaining: dr, entityType: 'Driver', entityId: dv.id });
      }
      if (dv.iqamaExpiry && dv.iqamaExpiry <= docHorizon) {
        const dr = this.days(dv.iqamaExpiry);
        push({ kind: 'DRIVER_DOC_EXPIRY', severity: sev(dr), title: 'Driver iqama', reference: dv.fullName, date: dv.iqamaExpiry.toISOString(), daysRemaining: dr, entityType: 'Driver', entityId: dv.id });
      }
    }

    // Decision signal: accumulated maintenance cost crosses a ratio of book value → renew or sell.
    const costRatio = await this.threshold('alerts.maintenanceCostRatio', 0.5);
    const assets = await this.prisma.asset.findMany({
      where: { deletedAt: null, status: { notIn: [AssetStatus.DISPOSED, AssetStatus.COMMISSIONING] } },
      select: { id: true, code: true, purchasePrice: true, depreciationRate: true, bookValue: true, purchaseDate: true },
    });
    const woSums = await this.prisma.maintenanceWorkOrder.groupBy({
      by: ['assetId'],
      where: { status: WorkOrderStatus.CLOSED },
      _sum: { totalCost: true },
    });
    const costMap = new Map(woSums.map((w) => [w.assetId, Number(w._sum.totalCost ?? 0)]));
    for (const a of assets) {
      const cost = costMap.get(a.id) ?? 0;
      const bv = effectiveBookValue(a);
      if (bv && bv > 0 && cost > costRatio * bv) {
        const overPct = Math.round((cost / bv) * 100);
        push({
          kind: 'MAINTENANCE_COST',
          severity: cost > bv ? 'danger' : 'warning',
          title: `Maintenance ${overPct}% of book value — review renew/sell`,
          reference: a.code,
          date: null,
          daysRemaining: null,
          entityType: 'Asset',
          entityId: a.id,
        });
      }
    }

    // Acquisition signal: requests still pending past the SLA window → unmet supply.
    const pendingDays = await this.threshold('alerts.requestPendingDays', 7);
    const pendingCutoff = new Date(now - pendingDays * DAY);
    const stalePending = await this.prisma.equipmentRequest.findMany({
      where: { status: EquipmentRequestStatus.PENDING, createdAt: { lte: pendingCutoff } },
      include: { orgUnit: { select: { name: true } } },
    });
    if (stalePending.length) {
      const typeIds = [...new Set(stalePending.map((r) => r.assetTypeId))];
      const types = await this.prisma.assetType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } });
      const typeName = new Map(types.map((t) => [t.id, t.name]));
      for (const r of stalePending) {
        const overdue = -Math.ceil((now - r.createdAt.getTime()) / DAY);
        push({
          kind: 'SUPPLY_SHORTAGE',
          severity: overdue < -pendingDays * 2 ? 'danger' : 'warning',
          title: `Unmet request: ${typeName.get(r.assetTypeId) ?? 'Equipment'}`,
          reference: r.refNo ?? r.orgUnit.name,
          date: r.createdAt.toISOString(),
          daysRemaining: overdue,
          entityType: 'EquipmentRequest',
          entityId: r.id,
        });
      }
    }

    items.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
    return {
      generatedAt: new Date().toISOString(),
      counts: { total: items.length, danger: items.filter((i) => i.severity === 'danger').length, warning: items.filter((i) => i.severity === 'warning').length },
      items,
    };
  }
}
