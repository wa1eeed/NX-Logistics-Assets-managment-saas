import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  DEFAULT_ENABLED_MODULES, DEFAULT_MAX_STORAGE_BYTES, DEFAULT_MAX_USER_COUNT, DEFAULT_PLAN_NAME,
  DEFAULT_SEAT_PRICE, RoleName,
  type CreateTenantDto, type LoginResponse, type PlatformAuditItem, type PlatformOverview, type PlatformTenantSummary,
  type TenantStatus, type UpdateTenantSubscriptionDto, type UpsertPlanDto,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { assertEmailNotPlatformOperator } from '../../common/email-uniqueness';
import { AuthService } from '../auth/auth.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { provisionTenantRoles } from '../rbac/provision-roles';

/**
 * Platform/SaaS operator service — runs ABOVE tenant isolation. The platform
 * admin user has `tenantId = null`, so the Prisma middleware applies no scoping;
 * every query here passes an explicit `tenantId` filter to stay precise.
 */
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async overview(): Promise<PlatformOverview> {
    const [tenants, subs] = await Promise.all([
      this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.tenantSubscription.findMany(),
    ]);
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));

    const rows: PlatformTenantSummary[] = await Promise.all(
      tenants.map(async (t) => {
        const sub = subByTenant.get(t.id);
        const [userCount, assetCount, storageAgg] = await Promise.all([
          this.prisma.user.count({ where: { tenantId: t.id, deletedAt: null, isActive: true } }),
          this.prisma.asset.count({ where: { tenantId: t.id, deletedAt: null } }),
          this.prisma.storageObject.aggregate({ _sum: { sizeBytes: true }, where: { tenantId: t.id } }),
        ]);
        const seatPrice = sub?.seatPriceMonthly != null ? Number(sub.seatPriceMonthly) : DEFAULT_SEAT_PRICE;
        return {
          id: t.id,
          code: t.code,
          slug: t.slug,
          name: t.name,
          status: t.status as TenantStatus,
          planName: sub?.planName ?? DEFAULT_PLAN_NAME,
          userCount,
          maxUserCount: sub?.maxUserCount ?? DEFAULT_MAX_USER_COUNT,
          assetCount,
          storageBytes: Number(storageAgg._sum.sizeBytes ?? BigInt(0)),
          maxStorageBytes: sub ? Number(sub.maxStorageBytes) : DEFAULT_MAX_STORAGE_BYTES,
          walletBalance: sub ? Number(sub.walletBalance) : 0,
          seatPriceMonthly: seatPrice,
          // MRR billed only on ACTIVE tenants.
          mrr: t.status === 'ACTIVE' ? userCount * seatPrice : 0,
          createdAt: t.createdAt.toISOString(),
        };
      }),
    );

    return {
      tenants: rows,
      totals: {
        tenants: rows.length,
        activeTenants: rows.filter((r) => r.status === 'ACTIVE').length,
        suspendedTenants: rows.filter((r) => r.status === 'SUSPENDED').length,
        users: rows.reduce((a, r) => a + r.userCount, 0),
        assets: rows.reduce((a, r) => a + r.assetCount, 0),
        storageBytes: rows.reduce((a, r) => a + r.storageBytes, 0),
        estimatedMrr: rows.reduce((a, r) => a + r.mrr, 0),
      },
    };
  }

  /** Recent activity across ALL tenants (platform admin is unscoped). */
  async recentActivity(): Promise<PlatformAuditItem[]> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    const tenantIds = [...new Set(logs.map((l) => l.tenantId).filter((x): x is string => !!x))];
    const actorIds = [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))];
    const [tenants, actors] = await Promise.all([
      tenantIds.length ? this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, code: true } }) : Promise.resolve([]),
      actorIds.length ? this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    ]);
    const codeById = new Map(tenants.map((t) => [t.id, t.code]));
    const nameById = new Map(actors.map((a) => [a.id, a.fullName]));
    return logs.map((l) => ({
      id: l.id,
      tenantCode: l.tenantId ? codeById.get(l.tenantId) ?? null : null,
      actor: l.actorId ? nameById.get(l.actorId) ?? null : null,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  private async row(tenantId: string): Promise<PlatformTenantSummary> {
    const o = await this.overview();
    const r = o.tenants.find((t) => t.id === tenantId);
    if (!r) throw new NotFoundException('Tenant not found');
    return r;
  }

  /** Onboard a new company: tenant + default subscription + its first SUPER_ADMIN. */
  async createTenant(dto: CreateTenantDto): Promise<PlatformTenantSummary> {
    const slug = dto.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestException('Slug must be lowercase letters, numbers and hyphens only');
    }
    const email = dto.adminEmail.trim().toLowerCase();
    const [slugTaken, emailTaken] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { email } }),
    ]);
    if (slugTaken) throw new ConflictException('Slug already in use');
    if (emailTaken) throw new ConflictException('Admin email already in use');
    // Reject an email that already belongs to a platform operator (would lock them out at login).
    await assertEmailNotPlatformOperator(this.prisma, email);

    const count = await this.prisma.tenant.count();
    const code = `TNT-${String(count + 1).padStart(4, '0')}`;

    const tenant = await this.prisma.tenant.create({
      data: { slug, name: dto.name.trim(), code, status: 'ACTIVE' },
    });
    await this.prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planName: DEFAULT_PLAN_NAME,
        maxUserCount: DEFAULT_MAX_USER_COUNT,
        maxStorageBytes: BigInt(DEFAULT_MAX_STORAGE_BYTES),
        enabledModules: DEFAULT_ENABLED_MODULES,
        seatPriceMonthly: DEFAULT_SEAT_PRICE,
        walletBalance: 0,
      },
    });

    // Provision the new company's own private role set, then assign its admin.
    const roleIds = await provisionTenantRoles(this.prisma, tenant.id);
    const superAdminId = roleIds.get(RoleName.SUPER_ADMIN);
    if (!superAdminId) throw new BadRequestException('Failed to provision tenant roles');
    const passwordHash = await argon2.hash(dto.adminPassword);
    await this.prisma.user.create({
      data: {
        email,
        fullName: dto.adminName.trim(),
        passwordHash,
        tenantId: tenant.id,
        code: 'USR-0001',
        roles: { create: [{ roleId: superAdminId, tenantId: tenant.id }] },
      },
    });

    return this.row(tenant.id);
  }

  async setStatus(tenantId: string, status: TenantStatus): Promise<PlatformTenantSummary> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant not found');
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { status } });
    return this.row(tenantId);
  }

  async setSubscription(tenantId: string, dto: UpdateTenantSubscriptionDto): Promise<PlatformTenantSummary> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant not found');
    await this.entitlements.updateSubscription(tenantId, dto);
    return this.row(tenantId);
  }

  // ---- plan catalog (delegated to EntitlementsService) ----
  listPlans() { return this.entitlements.listPlans(); }
  createPlan(dto: UpsertPlanDto) { return this.entitlements.createPlan(dto); }
  updatePlan(id: string, dto: Partial<UpsertPlanDto>) { return this.entitlements.updatePlan(id, dto); }

  async applyPlan(tenantId: string, planId: string): Promise<PlatformTenantSummary> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant not found');
    await this.entitlements.applyPlan(tenantId, planId);
    return this.row(tenantId);
  }

  /** Support impersonation: issue a session as the tenant's first active SUPER_ADMIN. */
  async impersonate(tenantId: string): Promise<LoginResponse> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status === 'SUSPENDED') throw new BadRequestException('Cannot impersonate a suspended tenant');
    // Roles are per-tenant — find THIS tenant's SUPER_ADMIN (platform admin has no ALS scope).
    const role = await this.prisma.role.findFirst({ where: { name: RoleName.SUPER_ADMIN, tenantId } });
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, deletedAt: null, isActive: true, ...(role ? { roles: { some: { roleId: role.id } } } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new BadRequestException('This tenant has no active admin to impersonate');
    return this.auth.sessionFor(admin.id);
  }
}
