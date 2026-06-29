import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AssetPreventive, ComplianceItem, ComplianceView, DueStatus,
  MaintenancePlanItem, MeterType, PlanIntervalType,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, RecordMeterDto, UpdatePlanDto } from './dto/preventive.dto';

const DAY = 24 * 60 * 60 * 1000;
/** Date obligations within this many days are "due soon". */
const DATE_WARN_DAYS = 30;
/** Meter plans within this fraction of their interval are "due soon". */
const METER_WARN_FRACTION = 0.1;

@Injectable()
export class PreventiveService {
  constructor(private readonly prisma: PrismaService) {}

  private daysUntil(d: Date): number {
    return Math.ceil((d.getTime() - Date.now()) / DAY);
  }

  /** Compute a plan's remaining + status from the asset meter / dates. */
  private computePlan(
    plan: { id: string; assetId: string; name: string; intervalType: string; intervalValue: number; lastServiceMeter: number | null; lastServiceAt: Date | null; isActive: boolean; createdAt: Date },
    currentMeter: number,
  ): MaintenancePlanItem {
    const intervalType = plan.intervalType as PlanIntervalType;
    let remaining: number;
    let status: DueStatus;
    let dueDate: string | null = null;

    if (intervalType === 'DAYS') {
      const base = plan.lastServiceAt ?? plan.createdAt;
      const due = new Date(base.getTime() + plan.intervalValue * DAY);
      remaining = this.daysUntil(due);
      dueDate = due.toISOString();
      status = remaining < 0 ? 'OVERDUE' : remaining <= DATE_WARN_DAYS ? 'DUE_SOON' : 'OK';
    } else {
      const base = plan.lastServiceMeter ?? 0;
      const used = currentMeter - base;
      remaining = plan.intervalValue - used;
      const warn = Math.max(1, Math.round(plan.intervalValue * METER_WARN_FRACTION));
      status = remaining < 0 ? 'OVERDUE' : remaining <= warn ? 'DUE_SOON' : 'OK';
    }

    return {
      id: plan.id,
      assetId: plan.assetId,
      name: plan.name,
      intervalType,
      intervalValue: plan.intervalValue,
      lastServiceMeter: plan.lastServiceMeter,
      lastServiceAt: plan.lastServiceAt?.toISOString() ?? null,
      isActive: plan.isActive,
      remaining,
      status,
      dueDate,
    };
  }

  private async assetOrThrow(assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async getAssetPreventive(assetId: string): Promise<AssetPreventive> {
    const asset = await this.assetOrThrow(assetId);
    const [plans, readings] = await Promise.all([
      this.prisma.maintenancePlan.findMany({ where: { assetId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.meterReading.findMany({ where: { assetId }, orderBy: { recordedAt: 'desc' }, take: 10 }),
    ]);
    return {
      meterType: asset.meterType as MeterType,
      currentMeter: asset.currentMeter,
      meterUpdatedAt: asset.meterUpdatedAt?.toISOString() ?? null,
      plans: plans.map((p) => this.computePlan(p, asset.currentMeter)),
      readings: readings.map((r) => ({
        id: r.id, value: r.value, note: r.note, recordedBy: r.recordedBy, recordedAt: r.recordedAt.toISOString(),
      })),
    };
  }

  async recordMeter(assetId: string, dto: RecordMeterDto, userId: string): Promise<AssetPreventive> {
    const asset = await this.assetOrThrow(assetId);
    if (asset.meterType === 'NONE') throw new BadRequestException('This asset has no meter configured');
    if (dto.value < asset.currentMeter) {
      throw new BadRequestException(`Reading (${dto.value}) cannot be below the current meter (${asset.currentMeter})`);
    }
    await this.prisma.$transaction([
      this.prisma.meterReading.create({ data: { assetId, value: dto.value, note: dto.note?.trim() || null, recordedBy: userId } }),
      this.prisma.asset.update({ where: { id: assetId }, data: { currentMeter: dto.value, meterUpdatedAt: new Date() } }),
    ]);
    return this.getAssetPreventive(assetId);
  }

  /** Set/clear the asset meter type (HOURS/KM/NONE). */
  async setMeterType(assetId: string, meterType: MeterType): Promise<AssetPreventive> {
    await this.assetOrThrow(assetId);
    await this.prisma.asset.update({ where: { id: assetId }, data: { meterType } });
    return this.getAssetPreventive(assetId);
  }

  async createPlan(assetId: string, dto: CreatePlanDto): Promise<AssetPreventive> {
    const asset = await this.assetOrThrow(assetId);
    await this.prisma.maintenancePlan.create({
      data: {
        assetId,
        name: dto.name.trim(),
        intervalType: dto.intervalType,
        intervalValue: dto.intervalValue,
        // baseline at creation so the clock starts now
        lastServiceMeter: dto.intervalType === 'DAYS' ? null : asset.currentMeter,
        lastServiceAt: new Date(),
      },
    });
    return this.getAssetPreventive(assetId);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<AssetPreventive> {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    await this.prisma.maintenancePlan.update({
      where: { id: planId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.intervalType !== undefined ? { intervalType: dto.intervalType } : {}),
        ...(dto.intervalValue !== undefined ? { intervalValue: dto.intervalValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.getAssetPreventive(plan.assetId);
  }

  async removePlan(planId: string): Promise<AssetPreventive> {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    await this.prisma.maintenancePlan.delete({ where: { id: planId } });
    return this.getAssetPreventive(plan.assetId);
  }

  /** Record that the plan's service was just performed → reset its due clock. */
  async logService(planId: string): Promise<AssetPreventive> {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const asset = await this.assetOrThrow(plan.assetId);
    await this.prisma.maintenancePlan.update({
      where: { id: planId },
      data: { lastServiceMeter: asset.currentMeter, lastServiceAt: new Date() },
    });
    return this.getAssetPreventive(plan.assetId);
  }

  // ---- fleet-wide compliance (preventive due + registration/inspection/insurance) ----

  async compliance(): Promise<ComplianceView> {
    const horizon = new Date(Date.now() + DATE_WARN_DAYS * DAY);
    const items: ComplianceItem[] = [];

    // Preventive plans that are due-soon / overdue.
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { isActive: true },
      include: { asset: { include: { assetType: { select: { name: true } } } } },
    });
    for (const p of plans) {
      if (p.asset.deletedAt) continue;
      const c = this.computePlan(p, p.asset.currentMeter);
      if (c.status === 'OK') continue;
      items.push({
        assetId: p.assetId,
        assetCode: p.asset.code,
        assetTypeName: p.asset.assetType.name,
        kind: 'PREVENTIVE_DUE',
        label: p.name,
        status: c.status,
        remaining: c.remaining,
        unit: c.intervalType === 'DAYS' ? 'DAYS' : (c.intervalType as 'KM' | 'HOURS'),
        date: c.dueDate,
      });
    }

    // Safety/compliance date obligations from the vehicle record.
    const vehicles = await this.prisma.vehicleDetail.findMany({
      where: {
        OR: [
          { registrationExpiry: { not: null, lte: horizon } },
          { periodicInspection: { not: null, lte: horizon } },
          { insuranceExpiry: { not: null, lte: horizon } },
        ],
      },
      include: { asset: { include: { assetType: { select: { name: true } } } } },
    });
    const dateItem = (v: { assetId: string; asset: { code: string; deletedAt: Date | null; assetType: { name: string } } }, kind: ComplianceItem['kind'], label: string, d: Date) => {
      if (v.asset.deletedAt) return;
      const remaining = this.daysUntil(d);
      const status: DueStatus = remaining < 0 ? 'OVERDUE' : 'DUE_SOON';
      items.push({ assetId: v.assetId, assetCode: v.asset.code, assetTypeName: v.asset.assetType.name, kind, label, status, remaining, unit: 'DAYS', date: d.toISOString() });
    };
    for (const v of vehicles) {
      if (v.registrationExpiry && v.registrationExpiry <= horizon) dateItem(v, 'REGISTRATION_EXPIRY', 'Registration', v.registrationExpiry);
      if (v.periodicInspection && v.periodicInspection <= horizon) dateItem(v, 'INSPECTION_EXPIRY', 'Periodic inspection', v.periodicInspection);
      if (v.insuranceExpiry && v.insuranceExpiry <= horizon) dateItem(v, 'INSURANCE_EXPIRY', 'Insurance', v.insuranceExpiry);
    }

    items.sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0));
    return {
      generatedAt: new Date().toISOString(),
      counts: {
        total: items.length,
        overdue: items.filter((i) => i.status === 'OVERDUE').length,
        dueSoon: items.filter((i) => i.status === 'DUE_SOON').length,
      },
      items,
    };
  }
}
