import type { PrismaClient } from '@prisma/client';
import { PERMISSION_KEYS, PLATFORM_RESERVED_PERMISSIONS, ROLES, RoleName } from '@nx-lam/shared';

/**
 * Provision a tenant's default role set from the shared ROLES catalog.
 *
 * Roles are PER-TENANT (each company shapes its own roles/permissions privately),
 * so every new tenant gets its own copy of the standard roles + permission grants.
 * The PLATFORM_ADMIN role is skipped — it is a Control-Plane role, not a tenant role.
 *
 * Runs outside a request (seed) or in a non-tenant context (public signup, platform
 * admin), so tenantId is always passed EXPLICITLY rather than via the ALS middleware.
 *
 * Idempotent (upsert on [tenantId, name]). Returns a map of roleName → roleId.
 */
export async function provisionTenantRoles(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Map<string, string>> {
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(perms.map((p) => [p.key, p.id]));
  const roleIdByName = new Map<string, string>();

  for (const r of ROLES) {
    if (r.name === RoleName.PLATFORM_ADMIN) continue; // platform-level role, not a tenant role

    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: r.name } },
      create: { tenantId, name: r.name, description: r.descriptionEn },
      update: { description: r.descriptionEn },
    });

    const keys = r.permissions === '*'
      ? PERMISSION_KEYS.filter((k) => !PLATFORM_RESERVED_PERMISSIONS.includes(k))
      : r.permissions;
    const ids = keys.map((k) => idByKey.get(k)).filter((x): x is string => !!x);

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ tenantId, roleId: role.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
    roleIdByName.set(r.name, role.id);
  }

  return roleIdByName;
}
