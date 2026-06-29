import { Injectable } from '@nestjs/common';
import { PERMISSIONS, PERMISSION_GROUPS, type PermissionDef } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the provisioned permission keys (DB) enriched with the static
   * catalog metadata (group + bilingual labels) for the role matrix UI.
   */
  async list(): Promise<{ permissions: PermissionDef[]; groups: typeof PERMISSION_GROUPS }> {
    const dbPerms = await this.prisma.permission.findMany({ select: { key: true } });
    const catalogByKey = new Map(PERMISSIONS.map((p) => [p.key, p]));

    const permissions: PermissionDef[] = dbPerms
      .map((p) =>
        catalogByKey.get(p.key) ?? {
          key: p.key,
          group: 'other',
          labelEn: p.key,
          labelAr: p.key,
          descEn: '',
          descAr: '',
        },
      )
      .sort((a, b) => (a.group + a.key).localeCompare(b.group + b.key));

    return { permissions, groups: PERMISSION_GROUPS };
  }
}
