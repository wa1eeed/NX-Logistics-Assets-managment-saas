import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLES, RoleName, SCOPED_ROLES } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

const SCOPED_ROLE_SET = new Set<string>(SCOPED_ROLES);
/** Platform operator permissions — single source of truth from the role catalog. */
const PLATFORM_ADMIN_PERMS = (ROLES.find((r) => r.name === RoleName.PLATFORM_ADMIN)?.permissions ?? []) as string[];

/**
 * Builds the request principal (roles, permissions, row-level scope) from
 * the database. Called on login and on every authenticated request (via the
 * JWT strategy) so permission/scope changes take effect without re-login.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPrincipal(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const roleNames = new Set<string>();
    const permissions = new Set<string>();
    const scopedUnitIds = new Set<string>();

    for (const ur of user.roles) {
      roleNames.add(ur.role.name);
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key);
      }
      // Collect org units only from genuinely row-level-scoped roles (project
      // consumers). Central/functional roles operate company-wide.
      if (ur.orgUnitId !== null && SCOPED_ROLE_SET.has(ur.role.name)) {
        scopedUnitIds.add(ur.orgUnitId);
      }
    }

    // A user is global unless EVERY one of their roles is a scoped role.
    // Holding any central/functional role → company-wide data access.
    const hasGlobalRole = [...roleNames].some((n) => !SCOPED_ROLE_SET.has(n));
    const scopeOrgUnitIds: string[] | null = hasGlobalRole
      ? null
      : await this.expandWithDescendants([...scopedUnitIds]);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      kind: 'tenant',
      tenantId: user.tenantId ?? null,
      roles: [...roleNames],
      permissions: [...permissions],
      scopeOrgUnitIds,
    };
  }

  /** Principal for a Control-Plane operator (separate PlatformAdmin table; no tenant). */
  async buildPlatformPrincipal(adminId: string): Promise<AuthenticatedUser> {
    const admin = await this.prisma.platformAdmin.findFirst({ where: { id: adminId, isActive: true } });
    if (!admin) throw new UnauthorizedException('Platform admin not found or inactive');
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      kind: 'platform',
      tenantId: null,
      roles: [RoleName.PLATFORM_ADMIN],
      permissions: [...PLATFORM_ADMIN_PERMS],
      scopeOrgUnitIds: null,
    };
  }

  /** Returns the given org-unit ids plus all of their descendants. */
  async expandWithDescendants(rootIds: string[]): Promise<string[]> {
    if (rootIds.length === 0) return [];

    const all = await this.prisma.orgUnit.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const u of all) {
      if (!u.parentId) continue;
      const list = childrenByParent.get(u.parentId) ?? [];
      list.push(u.id);
      childrenByParent.set(u.parentId, list);
    }

    const result = new Set<string>();
    const stack = [...rootIds];
    while (stack.length) {
      const id = stack.pop()!;
      if (result.has(id)) continue;
      result.add(id);
      for (const child of childrenByParent.get(id) ?? []) {
        stack.push(child);
      }
    }
    return [...result];
  }
}
