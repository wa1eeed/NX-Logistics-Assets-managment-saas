import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import type {
  CheckoutResult, PaymentGatewaySettings, PaymentIntentDto, VerifyResult,
} from '@nx-lam/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PaymentsService } from './payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateGatewayDto } from './dto/gateway.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // ---- platform gateway config (Tap account) ----

  @Get('config')
  @RequirePermissions('payments.manage')
  getConfig(): Promise<PaymentGatewaySettings> {
    return this.payments.getGatewaySettings();
  }

  @Put('config')
  @RequirePermissions('payments.manage')
  @AuditEntity('PaymentGateway')
  updateConfig(@Body() dto: UpdateGatewayDto): Promise<PaymentGatewaySettings> {
    return this.payments.updateGatewaySettings(dto);
  }

  @Post('config/test')
  @RequirePermissions('payments.manage')
  @HttpCode(200)
  testConfig(): Promise<{ ok: boolean; message: string }> {
    return this.payments.testGateway();
  }

  // ---- tenant checkout / history ----

  @Get()
  @RequirePermissions('billing.read')
  list(): Promise<PaymentIntentDto[]> {
    return this.payments.listMine();
  }

  @Post('checkout')
  @RequirePermissions('billing.manage')
  @AuditEntity('PaymentIntent')
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthenticatedUser): Promise<CheckoutResult> {
    return this.payments.checkout(dto, user);
  }

  @Get('verify/:id')
  @RequirePermissions('billing.read')
  verify(@Param('id') id: string): Promise<VerifyResult> {
    return this.payments.verify(id);
  }

  /** Dev sandbox confirmation — refused when a live gateway is configured. */
  @Post('sandbox/:id/confirm')
  @RequirePermissions('billing.manage')
  @AuditEntity('PaymentIntent')
  @HttpCode(200)
  sandboxConfirm(@Param('id') id: string): Promise<VerifyResult> {
    return this.payments.sandboxConfirm(id);
  }

  // ---- Tap server-to-server webhook (public; verified against Tap API) ----

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() body: Record<string, unknown>): Promise<{ ok: true }> {
    return this.payments.handleWebhook(body);
  }
}
