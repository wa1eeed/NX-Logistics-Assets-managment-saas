import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  DEFAULT_ENABLED_MODULES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_USER_COUNT,
  DEFAULT_PLAN_NAME,
  STORAGE_WARN_PERCENT,
  normalizeModules,
  type PlanDto,
  type SubscriptionStatus,
  type TenantSubscriptionDto,
  type TenantUsageDto,
  type UpdateTenantSubscriptionDto,
  type UpsertPlanDto,
} from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { formatBytes, percentOf } from '../../utils/bytes';

/**
 * SaaS guardrails: resolves a tenant's effective limits (subscription row or
 * defaults), measures live usage, and enforces the hard caps.
 *
 * IMPORTANT ordering note: NestJS runs Guards BEFORE Interceptors, so inside a
 * guard the AsyncLocalStorage tenant context is NOT yet set. All public methods
 * therefore accept an explicit `tenantId` (used by ModuleAccessGuard from
 * `req.user.tenantId`); when omitted they fall back to the request context
 * (used by services that run inside the handler, where the context IS set).
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the tenant id from the explicit arg or the request context. */
  private requireTenant(explicit?: string): string {
    const id = explicit ?? currentTenantId();
    if (!id) throw new ForbiddenException('No tenant context for entitlement check');
    return id;
  }

  /** Effective subscription: the stored row, or platform defaults if unprovisioned. */
  async getEffective(tenantId?: string): Promise<TenantSubscriptionDto> {
    const id = this.requireTenant(tenantId);
    const sub = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: id } });
    if (!sub) {
      return {
        tenantId: id,
        planId: null,
        planName: DEFAULT_PLAN_NAME,
        status: 'ACTIVE',
        maxUserCount: DEFAULT_MAX_USER_COUNT,
        maxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
        enabledModules: { ...DEFAULT_ENABLED_MODULES },
        seatPriceMonthly: null,
        perVehiclePrice: null,
        assetCap: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        renewsAt: null,
      };
    }
    return {
      tenantId: id,
      planId: sub.planId ?? null,
      planName: sub.planName,
      status: sub.status as SubscriptionStatus,
      maxUserCount: sub.maxUserCount,
      maxStorageBytes: Number(sub.maxStorageBytes),
      enabledModules: normalizeModules(sub.enabledModules as Record<string, boolean>),
      seatPriceMonthly: sub.seatPriceMonthly != null ? Number(sub.seatPriceMonthly) : null,
      perVehiclePrice: sub.perVehiclePrice != null ? Number(sub.perVehiclePrice) : null,
      assetCap: sub.assetCap ?? null,
      currentPeriodStart: sub.currentPeriodStart ? sub.currentPeriodStart.toISOString() : null,
      currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      renewsAt: sub.renewsAt ? sub.renewsAt.toISOString() : null,
    };
  }

  // ---- usage measurement (tenant-scoped) ----

  /** Total bytes the tenant currently occupies (SUM of its storage ledger). */
  async currentStorageBytes(tenantId?: string): Promise<number> {
    const id = this.requireTenant(tenantId);
    // In-context: middleware scopes automatically. Out-of-context: scope explicitly.
    const where = currentTenantId() ? {} : { tenantId: id };
    const agg = await this.prisma.storageObject.aggregate({ _sum: { sizeBytes: true }, where });
    return Number(agg._sum.sizeBytes ?? BigInt(0));
  }

  /** Count of active (non-deleted) employee accounts for the tenant. */
  async activeUserCount(tenantId?: string): Promise<number> {
    const id = this.requireTenant(tenantId);
    const where = currentTenantId() ? { deletedAt: null, isActive: true } : { deletedAt: null, isActive: true, tenantId: id };
    return this.prisma.user.count({ where });
  }

  async getUsage(tenantId?: string): Promise<TenantUsageDto> {
    const id = this.requireTenant(tenantId);
    const eff = await this.getEffective(id);
    const [userCount, storageBytes] = await Promise.all([
      this.activeUserCount(id),
      this.currentStorageBytes(id),
    ]);
    const storagePercent = percentOf(storageBytes, eff.maxStorageBytes);
    return {
      userCount,
      maxUserCount: eff.maxUserCount,
      userPercent: percentOf(userCount, eff.maxUserCount),
      storageBytes,
      maxStorageBytes: eff.maxStorageBytes,
      storagePercent,
      storageWarning: storagePercent >= STORAGE_WARN_PERCENT,
      enabledModules: eff.enabledModules,
    };
  }

  // ---- guardrails (throw 403 when a hard cap is hit) ----

  /** Reject if the tenant has reached its active-user cap. */
  async assertCanAddUser(tenantId?: string): Promise<void> {
    const id = this.requireTenant(tenantId);
    const { maxUserCount } = await this.getEffective(id);
    const count = await this.activeUserCount(id);
    if (count >= maxUserCount) {
      throw new ForbiddenException(
        `User limit reached (${maxUserCount}). Buy more seats from Subscriptions & Billing to add employees.`,
      );
    }
  }

  /** Reject an upload that would push the tenant over its storage cap. */
  async assertStorageAvailable(incomingBytes: number, tenantId?: string): Promise<void> {
    const id = this.requireTenant(tenantId);
    const { maxStorageBytes } = await this.getEffective(id);
    const used = await this.currentStorageBytes(id);
    if (used + Math.max(0, incomingBytes) > maxStorageBytes) {
      throw new ForbiddenException(
        `Storage quota exceeded (limit ${formatBytes(maxStorageBytes)}, used ${formatBytes(used)}). Free space or upgrade the plan.`,
      );
    }
  }

  async isModuleEnabled(moduleName: string, tenantId?: string): Promise<boolean> {
    const { enabledModules } = await this.getEffective(tenantId);
    // Unknown (non-gated) modules are allowed; only explicitly-disabled ones are blocked.
    return enabledModules[moduleName] !== false;
  }

  async assertModuleEnabled(moduleName: string, tenantId?: string): Promise<void> {
    if (!(await this.isModuleEnabled(moduleName, tenantId))) {
      throw new ForbiddenException(`The "${moduleName}" module is not enabled for your subscription.`);
    }
  }

  // ---- materialized usage snapshot (TenantUsage) ----

  /**
   * Recompute the tenant's usage snapshot from the live source of truth
   * (active users + storage ledger) and persist it to TenantUsage. Cheap
   * (one count + one aggregate). Safe to call from any mutation point;
   * silently no-ops without a resolvable tenant.
   */
  async syncUsage(tenantId?: string): Promise<void> {
    const id = tenantId ?? currentTenantId();
    if (!id) return;
    const [seatsUsed, storageBytes] = await Promise.all([
      this.activeUserCount(id),
      this.currentStorageBytes(id),
    ]);
    await this.prisma.tenantUsage.upsert({
      where: { tenantId: id },
      create: { tenantId: id, seatsUsed, storageBytes: BigInt(storageBytes) },
      update: { seatsUsed, storageBytes: BigInt(storageBytes) },
    });
  }

  /** Read the persisted usage snapshot (falls back to a live recompute). */
  async getUsageSnapshot(tenantId: string): Promise<{ seatsUsed: number; storageBytes: number }> {
    const row = await this.prisma.tenantUsage.findUnique({ where: { tenantId } });
    if (row) return { seatsUsed: row.seatsUsed, storageBytes: Number(row.storageBytes) };
    const [seatsUsed, storageBytes] = await Promise.all([
      this.activeUserCount(tenantId),
      this.currentStorageBytes(tenantId),
    ]);
    return { seatsUsed, storageBytes };
  }

  // ---- storage ledger (single source of truth for usage) ----

  /** Record (or update) a stored object's size. Tenant stamped by middleware in-context. */
  async recordUpload(key: string, sizeBytes: number, moduleName?: string): Promise<void> {
    const size = BigInt(Math.max(0, Math.round(sizeBytes)));
    await this.prisma.storageObject.upsert({
      where: { key },
      create: { key, sizeBytes: size, module: moduleName ?? null },
      update: { sizeBytes: size, module: moduleName ?? null },
    });
    await this.syncUsage();
  }

  /** Remove a stored object from the ledger (scoped to the tenant in-context). */
  async recordDelete(key: string): Promise<void> {
    await this.prisma.storageObject.deleteMany({ where: { key } });
    await this.syncUsage();
  }

  // ---- platform admin management ----

  async updateSubscription(tenantId: string, dto: UpdateTenantSubscriptionDto): Promise<TenantSubscriptionDto> {
    const existing = await this.prisma.tenantSubscription.findUnique({ where: { tenantId } });
    const baseModules = (existing?.enabledModules as Record<string, boolean> | undefined) ?? DEFAULT_ENABLED_MODULES;
    const mergedModules = normalizeModules({ ...baseModules, ...(dto.enabledModules ?? {}) });

    const toDate = (s?: string | null) => (s === undefined ? undefined : s ? new Date(s) : null);
    await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: dto.planId ?? null,
        planName: dto.planName ?? DEFAULT_PLAN_NAME,
        status: dto.status ?? 'ACTIVE',
        maxUserCount: dto.maxUserCount ?? DEFAULT_MAX_USER_COUNT,
        maxStorageBytes: BigInt(dto.maxStorageBytes ?? DEFAULT_MAX_STORAGE_BYTES),
        enabledModules: mergedModules,
        seatPriceMonthly: dto.seatPriceMonthly ?? null,
        perVehiclePrice: dto.perVehiclePrice ?? null,
        assetCap: dto.assetCap ?? null,
        currentPeriodStart: toDate(dto.currentPeriodStart) ?? null,
        currentPeriodEnd: toDate(dto.currentPeriodEnd) ?? null,
        renewsAt: toDate(dto.renewsAt) ?? null,
      },
      update: {
        ...(dto.planId !== undefined ? { planId: dto.planId } : {}),
        ...(dto.planName !== undefined ? { planName: dto.planName } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.maxUserCount !== undefined ? { maxUserCount: dto.maxUserCount } : {}),
        ...(dto.maxStorageBytes !== undefined ? { maxStorageBytes: BigInt(dto.maxStorageBytes) } : {}),
        ...(dto.enabledModules !== undefined ? { enabledModules: mergedModules } : {}),
        ...(dto.seatPriceMonthly !== undefined ? { seatPriceMonthly: dto.seatPriceMonthly } : {}),
        ...(dto.perVehiclePrice !== undefined ? { perVehiclePrice: dto.perVehiclePrice } : {}),
        ...(dto.assetCap !== undefined ? { assetCap: dto.assetCap } : {}),
        ...(dto.currentPeriodStart !== undefined ? { currentPeriodStart: toDate(dto.currentPeriodStart) } : {}),
        ...(dto.currentPeriodEnd !== undefined ? { currentPeriodEnd: toDate(dto.currentPeriodEnd) } : {}),
        ...(dto.renewsAt !== undefined ? { renewsAt: toDate(dto.renewsAt) } : {}),
      },
    });
    return this.getEffective(tenantId);
  }

  // ---- plan catalog (platform admin) ----

  private toPlanDto(p: {
    id: string; name: string; seats: number; storageGb: number; features: Prisma.JsonValue;
    priceMonthly: Prisma.Decimal; perVehiclePrice: Prisma.Decimal | null; assetCap: number | null;
    isActive: boolean; sortOrder: number;
  }): PlanDto {
    return {
      id: p.id, name: p.name, seats: p.seats, storageGb: p.storageGb,
      features: normalizeModules(p.features as Record<string, boolean>),
      priceMonthly: Number(p.priceMonthly),
      perVehiclePrice: p.perVehiclePrice != null ? Number(p.perVehiclePrice) : null,
      assetCap: p.assetCap ?? null, isActive: p.isActive, sortOrder: p.sortOrder,
    };
  }

  async listPlans(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return plans.map((p) => this.toPlanDto(p));
  }

  async createPlan(dto: UpsertPlanDto): Promise<PlanDto> {
    const p = await this.prisma.plan.create({
      data: {
        name: dto.name.trim().toUpperCase(),
        seats: dto.seats, storageGb: dto.storageGb,
        features: (dto.features ?? {}) as Prisma.InputJsonValue,
        priceMonthly: new Prisma.Decimal(dto.priceMonthly),
        perVehiclePrice: dto.perVehiclePrice != null ? new Prisma.Decimal(dto.perVehiclePrice) : null,
        assetCap: dto.assetCap ?? null,
        isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.toPlanDto(p);
  }

  async updatePlan(id: string, dto: Partial<UpsertPlanDto>): Promise<PlanDto> {
    const p = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim().toUpperCase() } : {}),
        ...(dto.seats !== undefined ? { seats: dto.seats } : {}),
        ...(dto.storageGb !== undefined ? { storageGb: dto.storageGb } : {}),
        ...(dto.features !== undefined ? { features: dto.features as Prisma.InputJsonValue } : {}),
        ...(dto.priceMonthly !== undefined ? { priceMonthly: new Prisma.Decimal(dto.priceMonthly) } : {}),
        ...(dto.perVehiclePrice !== undefined ? { perVehiclePrice: dto.perVehiclePrice != null ? new Prisma.Decimal(dto.perVehiclePrice) : null } : {}),
        ...(dto.assetCap !== undefined ? { assetCap: dto.assetCap } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.toPlanDto(p);
  }

  /** Apply a plan's caps/features to a tenant's subscription (snapshots price + cap). */
  async applyPlan(tenantId: string, planId: string): Promise<TenantSubscriptionDto> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new ForbiddenException('Plan not found');
    return this.updateSubscription(tenantId, {
      planId: plan.id,
      planName: plan.name,
      maxUserCount: plan.seats,
      maxStorageBytes: plan.storageGb * 1024 * 1024 * 1024,
      enabledModules: normalizeModules(plan.features as Record<string, boolean>),
      perVehiclePrice: plan.perVehiclePrice != null ? Number(plan.perVehiclePrice) : null,
      assetCap: plan.assetCap ?? null,
    });
  }
}
