import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { TenantSubscriptionDto, TenantUsageDto } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { EntitlementsService } from './entitlements.service';
import { UpdateSubscriptionDto } from './dto/entitlements.dto';

@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /** The signed-in tenant's own plan + live usage (read-only for company admins). */
  @Get('me')
  @RequirePermissions('entitlements.read')
  async me(): Promise<{ subscription: TenantSubscriptionDto; usage: TenantUsageDto }> {
    const [subscription, usage] = await Promise.all([
      this.entitlements.getEffective(),
      this.entitlements.getUsage(),
    ]);
    return { subscription, usage };
  }

  // ---- platform-admin only (entitlements.manage is reserved; no tenant role holds it) ----

  @Get(':tenantId')
  @RequirePermissions('entitlements.manage')
  getOne(@Param('tenantId') tenantId: string): Promise<TenantSubscriptionDto> {
    return this.entitlements.getEffective(tenantId);
  }

  @Put(':tenantId')
  @RequirePermissions('entitlements.manage')
  update(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<TenantSubscriptionDto> {
    return this.entitlements.updateSubscription(tenantId, dto);
  }
}
