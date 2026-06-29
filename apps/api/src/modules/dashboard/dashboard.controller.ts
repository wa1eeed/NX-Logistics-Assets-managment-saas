import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthenticatedUser) {
    // Scope the asset count to what the caller can actually see (matches /assets).
    const assetWhere = {
      deletedAt: null,
      ...(user.scopeOrgUnitIds ? { currentOrgUnitId: { in: user.scopeOrgUnitIds } } : {}),
    };
    const [users, roles, orgUnits, assetTypes, assets, auditEntries] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.role.count(),
      this.prisma.orgUnit.count({ where: { deletedAt: null } }),
      this.prisma.assetType.count(),
      this.prisma.asset.count({ where: assetWhere }),
      this.prisma.auditLog.count(),
    ]);

    return {
      counts: { users, roles, orgUnits, assetTypes, assets, auditEntries },
      principal: { fullName: user.fullName, roles: user.roles },
    };
  }
}
