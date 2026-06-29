import { Body, Controller, Get, Post } from '@nestjs/common';
import type { BillingOverviewDto } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BillingService } from './billing.service';
import { PurchaseModuleDto, PurchaseSeatsDto } from './dto/billing.dto';

@Controller('billing')
@AuditEntity('TenantSubscription')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions('billing.read')
  overview(): Promise<BillingOverviewDto> {
    return this.billing.overview();
  }

  // Wallet is topped up with real money via the Tap gateway — see PaymentsController.
  // Seats/modules below are paid from the funded wallet balance.

  @Post('purchase/seats')
  @RequirePermissions('billing.manage')
  buySeats(@Body() dto: PurchaseSeatsDto, @CurrentUser() user: AuthenticatedUser): Promise<BillingOverviewDto> {
    return this.billing.purchaseSeats(dto.quantity, user.id);
  }

  @Post('purchase/module')
  @RequirePermissions('billing.manage')
  buyModule(@Body() dto: PurchaseModuleDto, @CurrentUser() user: AuthenticatedUser): Promise<BillingOverviewDto> {
    return this.billing.activateModule(dto.module, user.id);
  }
}
