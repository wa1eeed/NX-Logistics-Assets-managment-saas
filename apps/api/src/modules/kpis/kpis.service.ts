import { Injectable } from '@nestjs/common';
import { AssetStatus, ContractStatus, EquipmentRequestStatus, MaintenanceType, WorkOrderStatus } from '@nx-lam/shared';
import type { DispatchKpis, FleetKpis, KpiBucket, MaintenanceKpis, RegionReadiness } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const OPERATING: AssetStatus[] = [AssetStatus.AVAILABLE, AssetStatus.IN_DUTY, AssetStatus.RESERVED];
const STOPPED: AssetStatus[] = [AssetStatus.OUT_OF_SERVICE, AssetStatus.FOR_SALE];
const UNDER_REPAIR: AssetStatus[] = [AssetStatus.UNDER_MAINTENANCE];

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function bucketize(
  rows: { key: string; count: number }[],
  total: number,
  limit?: number,
): KpiBucket[] {
  const sorted = rows.sort((a, b) => b.count - a.count).map((r) => ({ ...r, pct: pct(r.count, total) }));
  return limit ? sorted.slice(0, limit) : sorted;
}

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  /** Live executive fleet KPIs — mirrors the inventory executive report. */
  async fleet(): Promise<FleetKpis> {
    // Fleet excludes disposed assets (left the fleet).
    const assets = await this.prisma.asset.findMany({
      where: { deletedAt: null, status: { not: AssetStatus.DISPOSED } },
      include: { assetType: true, vehicle: { select: { plateNumber: true } } },
    });

    const total = assets.length;
    const is = (a: { status: string }, set: AssetStatus[]) => set.includes(a.status as AssetStatus);

    const operating = assets.filter((a) => is(a, OPERATING)).length;
    const stopped = assets.filter((a) => is(a, STOPPED)).length;
    const underRepair = assets.filter((a) => is(a, UNDER_REPAIR)).length;
    const commissioning = assets.filter((a) => a.status === AssetStatus.COMMISSIONING).length;
    const forSale = assets.filter((a) => a.status === AssetStatus.FOR_SALE).length;
    const requiresDecision = stopped + underRepair;

    const statusDistribution: KpiBucket[] = [
      { key: 'operating', count: operating, pct: pct(operating, total) },
      { key: 'stopped', count: stopped, pct: pct(stopped, total) },
      { key: 'underRepair', count: underRepair, pct: pct(underRepair, total) },
      ...(commissioning > 0 ? [{ key: 'commissioning', count: commissioning, pct: pct(commissioning, total) }] : []),
    ];

    // --- regions ---
    const regionMap = new Map<string, { total: number; operating: number }>();
    for (const a of assets) {
      const r = a.region?.trim() || 'Unspecified';
      const e = regionMap.get(r) ?? { total: 0, operating: 0 };
      e.total += 1;
      if (is(a, OPERATING)) e.operating += 1;
      regionMap.set(r, e);
    }
    const regions: RegionReadiness[] = [...regionMap.entries()]
      .map(([region, v]) => ({
        region,
        total: v.total,
        operating: v.operating,
        nonOperating: v.total - v.operating,
        readinessPct: pct(v.operating, v.total),
      }))
      .sort((a, b) => b.total - a.total);

    // --- category ---
    const catMap = new Map<string, number>();
    for (const a of assets) {
      const c = a.assetType.category?.trim() || 'Uncategorized';
      catMap.set(c, (catMap.get(c) ?? 0) + 1);
    }
    const byCategory = bucketize([...catMap].map(([key, count]) => ({ key, count })), total);

    // --- type ---
    const typeMap = new Map<string, number>();
    for (const a of assets) typeMap.set(a.assetType.name, (typeMap.get(a.assetType.name) ?? 0) + 1);
    const byType = bucketize([...typeMap].map(([key, count]) => ({ key, count })), total, 12);

    // --- age structure (fixed report boundaries) ---
    const age = { new: 0, recent: 0, mid: 0, old: 0, undefinedYear: 0 };
    for (const a of assets) {
      const y = a.year;
      if (y == null) age.undefinedYear += 1;
      else if (y >= 2023) age.new += 1;
      else if (y >= 2019) age.recent += 1;
      else if (y >= 2014) age.mid += 1;
      else age.old += 1;
    }
    const ageStructure: KpiBucket[] = [
      { key: 'new', count: age.new, pct: pct(age.new, total) },
      { key: 'recent', count: age.recent, pct: pct(age.recent, total) },
      { key: 'mid', count: age.mid, pct: pct(age.mid, total) },
      { key: 'old', count: age.old, pct: pct(age.old, total) },
      { key: 'undefined', count: age.undefinedYear, pct: pct(age.undefinedYear, total) },
    ];

    // --- manufacturers ---
    const mfgMap = new Map<string, number>();
    for (const a of assets) {
      const m = a.manufacturer?.trim();
      if (m) mfgMap.set(m, (mfgMap.get(m) ?? 0) + 1);
    }
    const topManufacturers = bucketize([...mfgMap].map(([key, count]) => ({ key, count })), total, 10);

    // --- non-operating concentration by region ---
    const nonOpMap = new Map<string, number>();
    for (const a of assets) {
      if (is(a, OPERATING)) continue;
      const r = a.region?.trim() || 'Unspecified';
      nonOpMap.set(r, (nonOpMap.get(r) ?? 0) + 1);
    }
    const nonOperatingConcentration = bucketize(
      [...nonOpMap].map(([key, count]) => ({ key, count })),
      requiresDecision,
      5,
    );

    // --- data quality ---
    const withoutPlate = assets.filter((a) => !a.vehicle?.plateNumber).length;
    const undefinedYear = assets.filter((a) => a.year == null).length;

    // --- coverage ---
    const sites = new Set(assets.map((a) => a.siteName?.trim()).filter(Boolean));
    const manufacturers = new Set(assets.map((a) => a.manufacturer?.trim()).filter(Boolean));
    const assetTypes = new Set(assets.map((a) => a.assetTypeId));

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        total, operating, stopped, underRepair, forSale, requiresDecision,
        readinessPct: pct(operating, total),
      },
      coverage: {
        regions: regionMap.size,
        sites: sites.size,
        assetTypes: assetTypes.size,
        manufacturers: manufacturers.size,
      },
      statusDistribution,
      regions,
      byCategory,
      byType,
      ageStructure,
      topManufacturers,
      nonOperatingConcentration,
      dataQuality: { total, withoutPlate, undefinedYear },
    };
  }

  /** Maintenance department dashboard — cost, MTTR, preventive vs corrective. */
  async maintenance(): Promise<MaintenanceKpis> {
    const orders = await this.prisma.maintenanceWorkOrder.findMany({
      include: { asset: { select: { code: true } } },
    });
    const by = (s: WorkOrderStatus) => orders.filter((o) => o.status === s).length;
    const closed = orders.filter((o) => o.status === WorkOrderStatus.CLOSED);

    const costTotal = closed.reduce((s, o) => s + Number(o.totalCost ?? 0), 0);
    const avgPerClosedOrder = closed.length ? Math.round((costTotal / closed.length) * 100) / 100 : null;

    // preventive vs corrective over non-cancelled work
    const active = orders.filter((o) => o.status !== WorkOrderStatus.CANCELLED);
    const preventive = active.filter((o) => o.type === MaintenanceType.PREVENTIVE).length;
    const corrective = active.filter((o) => o.type === MaintenanceType.CORRECTIVE).length;

    const durations = closed.filter((o) => o.closedAt).map((o) => (o.closedAt!.getTime() - o.openedAt.getTime()) / DAY_MS);
    const mttrDays = durations.length ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10 : null;

    const costByAsset = new Map<string, { assetCode: string; cost: number; orders: number }>();
    for (const o of closed) {
      const e = costByAsset.get(o.assetId) ?? { assetCode: o.asset.code, cost: 0, orders: 0 };
      e.cost += Number(o.totalCost ?? 0);
      e.orders += 1;
      costByAsset.set(o.assetId, e);
    }
    const topCostAssets = [...costByAsset.entries()]
      .map(([assetId, v]) => ({ assetId, assetCode: v.assetCode, cost: Math.round(v.cost * 100) / 100, orders: v.orders }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        open: by(WorkOrderStatus.OPEN),
        inProgress: by(WorkOrderStatus.IN_PROGRESS),
        closed: closed.length,
        cancelled: by(WorkOrderStatus.CANCELLED),
        total: orders.length,
      },
      cost: { total: Math.round(costTotal * 100) / 100, closedOrders: closed.length, avgPerClosedOrder },
      preventiveVsCorrective: { preventive, corrective, preventivePct: pct(preventive, preventive + corrective) },
      mttrDays,
      topCostAssets,
    };
  }

  /** Dispatch / operations dashboard — utilization and request pipeline. */
  async dispatch(): Promise<DispatchKpis> {
    const assets = await this.prisma.asset.findMany({
      where: { deletedAt: null, status: { not: AssetStatus.DISPOSED } },
      select: { status: true },
    });
    const count = (s: AssetStatus) => assets.filter((a) => a.status === s).length;
    const inDuty = count(AssetStatus.IN_DUTY);
    const available = count(AssetStatus.AVAILABLE);
    const reserved = count(AssetStatus.RESERVED);
    const denom = inDuty + available + reserved;

    const reqRows = await this.prisma.equipmentRequest.groupBy({ by: ['status'], _count: true });
    const reqCount = (s: EquipmentRequestStatus) => reqRows.find((r) => r.status === s)?._count ?? 0;

    const activeContracts = await this.prisma.rentalContract.findMany({
      where: { status: { in: [ContractStatus.ACTIVE, ContractStatus.EXTENDED] } },
      include: { orgUnit: { select: { id: true, name: true } } },
    });
    const projMap = new Map<string, { orgUnitName: string; activeContracts: number }>();
    for (const c of activeContracts) {
      const e = projMap.get(c.orgUnitId) ?? { orgUnitName: c.orgUnit.name, activeContracts: 0 };
      e.activeContracts += 1;
      projMap.set(c.orgUnitId, e);
    }
    const topProjects = [...projMap.entries()]
      .map(([orgUnitId, v]) => ({ orgUnitId, orgUnitName: v.orgUnitName, activeContracts: v.activeContracts }))
      .sort((a, b) => b.activeContracts - a.activeContracts)
      .slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      fleet: { total: assets.length, inDuty, available, reserved },
      utilizationPct: pct(inDuty, denom),
      requests: {
        pending: reqCount(EquipmentRequestStatus.PENDING),
        approved: reqCount(EquipmentRequestStatus.APPROVED),
        fulfilled: reqCount(EquipmentRequestStatus.FULFILLED),
        rejected: reqCount(EquipmentRequestStatus.REJECTED),
        total: reqRows.reduce((s, r) => s + r._count, 0),
      },
      activeContracts: activeContracts.length,
      topProjects,
    };
  }
}
