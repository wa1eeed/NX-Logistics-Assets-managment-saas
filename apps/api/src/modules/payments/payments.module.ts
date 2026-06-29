import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TapService } from '../../integrations/payments/tap.service';
import { BillingModule } from '../billing/billing.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { TrackingModule } from '../tracking/tracking.module';

// EntitlementsModule is global; BillingModule exports BillingService; InvoicesModule
// exports InvoicesService (auto-issue a tax invoice); TrackingModule exports
// TrackingService (activate the per-vehicle add-on once a TRACKING payment clears).
@Module({
  imports: [BillingModule, InvoicesModule, TrackingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TapService],
})
export class PaymentsModule {}
