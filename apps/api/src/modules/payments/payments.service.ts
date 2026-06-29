import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CheckoutResult, type PaymentGatewaySettings, type PaymentIntentDto, type PaymentPurpose,
  type PaymentStatus, type PlatformModule, type UpdatePaymentGatewayDto, type VerifyResult,
} from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BillingService } from '../billing/billing.service';
import { InvoicesService } from '../invoices/invoices.service';
import { TrackingService } from '../tracking/tracking.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TapService } from '../../integrations/payments/tap.service';
import { CheckoutDto } from './dto/checkout.dto';

const DEFAULT_PER_VEHICLE = 15;

/** Tap charge statuses that mean money was actually captured. */
const PAID_STATUSES = new Set(['CAPTURED', 'PAID']);
const FAILED_STATUSES = new Set(['FAILED', 'DECLINED', 'CANCELLED', 'VOID', 'TIMEDOUT', 'UNKNOWN']);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tap: TapService,
    private readonly billing: BillingService,
    private readonly invoices: InvoicesService,
    private readonly tracking: TrackingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ---- platform gateway config (payments.manage) ----
  getGatewaySettings(): Promise<PaymentGatewaySettings> {
    return this.tap.getSettings();
  }
  updateGatewaySettings(dto: UpdatePaymentGatewayDto): Promise<PaymentGatewaySettings> {
    return this.tap.updateSettings(dto);
  }
  testGateway(): Promise<{ ok: boolean; message: string }> {
    return this.tap.test();
  }

  // ---- tenant checkout ----

  async checkout(dto: CheckoutDto, user: AuthenticatedUser): Promise<CheckoutResult> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException('No tenant context');

    const { amount, quantity, moduleKey } = await this.priceFor(tenantId, dto);
    const currency = await this.tap.currency();

    const intent = await this.prisma.paymentIntent.create({
      data: {
        purpose: dto.purpose,
        amount: new Prisma.Decimal(amount),
        currency,
        quantity: quantity ?? null,
        moduleKey: moduleKey ?? null,
        status: 'PENDING',
        provider: 'TAP',
        actorId: user.id,
      },
    });

    const webBase = this.webBase();
    const returnUrl = `${webBase}/billing/return?intent=${intent.id}`;

    // No live gateway configured → dev sandbox: the return page confirms manually.
    if (!(await this.tap.isLive())) {
      const redirectUrl = `${returnUrl}&sandbox=1`;
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { redirectUrl } });
      this.logger.warn(`Checkout ${intent.id} created in SANDBOX (Tap not configured)`);
      return { intentId: intent.id, redirectUrl, amount, currency, sandbox: true };
    }

    // Live: create a Tap hosted charge and redirect the browser to it.
    const charge = await this.tap.createCharge({
      amount, currency,
      description: this.describe(dto.purpose, quantity, moduleKey),
      customerName: user.fullName,
      customerEmail: user.email,
      redirectUrl: returnUrl,
      postUrl: `${this.apiBase()}/api/payments/webhook`,
      reference: intent.id,
      metadata: { intentId: intent.id, tenantId, purpose: dto.purpose },
    });
    if (!charge.transactionUrl) throw new BadRequestException('Tap did not return a payment URL');

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { providerChargeId: charge.id, redirectUrl: charge.transactionUrl },
    });
    return { intentId: intent.id, redirectUrl: charge.transactionUrl, amount, currency, sandbox: false };
  }

  /** Compute and validate the charge amount for a checkout. */
  private async priceFor(tenantId: string, dto: CheckoutDto): Promise<{ amount: number; quantity: number | null; moduleKey: PlatformModule | null }> {
    if (dto.purpose === 'WALLET_TOPUP') {
      const amount = Number(dto.amount);
      if (!(amount > 0)) throw new BadRequestException('Top-up amount must be positive');
      if (amount > 1_000_000) throw new BadRequestException('Top-up amount too large');
      return { amount, quantity: null, moduleKey: null };
    }
    if (dto.purpose === 'SEATS') {
      const quantity = Number(dto.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new BadRequestException('Quantity must be a positive integer');
      const amount = quantity * (await this.billing.seatPriceFor(tenantId));
      return { amount, quantity, moduleKey: null };
    }
    if (dto.purpose === 'MODULE') {
      if (!dto.module) throw new BadRequestException('module is required');
      await this.billing.assertModulePurchasable(tenantId, dto.module);
      const amount = this.billing.modulePrice(dto.module);
      return { amount, quantity: null, moduleKey: dto.module };
    }
    if (dto.purpose === 'TRACKING') {
      const quota = Number(dto.vehicleQuota);
      if (!Number.isInteger(quota) || quota <= 0) throw new BadRequestException('vehicleQuota must be a positive integer');
      const eff = await this.entitlements.getEffective(tenantId);
      const per = eff.perVehiclePrice ?? DEFAULT_PER_VEHICLE;
      return { amount: quota * per, quantity: quota, moduleKey: null };
    }
    throw new BadRequestException('Unknown purpose');
  }

  // ---- verification & application ----

  /** Poll endpoint hit by the return page: re-checks Tap and applies if paid. */
  async verify(intentId: string): Promise<VerifyResult> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new NotFoundException('Payment not found');
    if (intent.status === 'PAID') return this.result(intent.id, 'Payment confirmed.');

    if (!intent.providerChargeId) {
      // Sandbox intent — confirmed only through sandboxConfirm.
      return this.result(intent.id, 'Awaiting confirmation.');
    }
    const charge = await this.tap.retrieveCharge(intent.providerChargeId);
    if (PAID_STATUSES.has(charge.status)) {
      await this.applyOnce(intent.id);
      return this.result(intent.id, 'Payment confirmed.');
    }
    if (FAILED_STATUSES.has(charge.status)) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return this.result(intent.id, `Payment ${charge.status.toLowerCase()}.`);
    }
    return this.result(intent.id, 'Payment is still pending.');
  }

  /** Tap server-to-server webhook (public). Trust Tap's API, not the body. */
  async handleWebhook(body: Record<string, unknown>): Promise<{ ok: true }> {
    const chargeId = String(body?.id ?? '');
    if (!chargeId.startsWith('chg_')) return { ok: true }; // ignore non-charge events
    try {
      const charge = await this.tap.retrieveCharge(chargeId);
      const intent = await this.prisma.paymentIntent.findFirst({ where: { providerChargeId: chargeId } });
      if (!intent) {
        this.logger.warn(`Webhook for unknown charge ${chargeId}`);
        return { ok: true };
      }
      if (PAID_STATUSES.has(charge.status)) {
        await this.applyOnce(intent.id);
      } else if (FAILED_STATUSES.has(charge.status)) {
        await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      }
    } catch (err) {
      this.logger.error(`Webhook handling failed for ${chargeId}: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  /**
   * Dev-only: confirm a sandbox intent (no real gateway). Refused once a live
   * gateway is configured, so it can never grant free credit in production.
   */
  async sandboxConfirm(intentId: string): Promise<VerifyResult> {
    if (await this.tap.isLive()) throw new ForbiddenException('Sandbox confirmation is disabled — a live gateway is configured.');
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new NotFoundException('Payment not found');
    if (intent.providerChargeId) throw new BadRequestException('Not a sandbox payment');
    await this.applyOnce(intent.id);
    return this.result(intent.id, 'Sandbox payment confirmed.');
  }

  /**
   * Flip PENDING→PAID atomically (so webhook + verify can't double-apply), then
   * apply the purchase. Runs in both tenant context (verify) and none (webhook).
   */
  private async applyOnce(intentId: string): Promise<void> {
    const flipped = await this.prisma.paymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: { status: 'PAID', appliedAt: new Date() },
    });
    if (flipped.count !== 1) return; // already applied by the other path

    const intent = await this.prisma.paymentIntent.findFirst({ where: { id: intentId } });
    if (!intent?.tenantId) return;
    try {
      if (intent.purpose === 'TRACKING') {
        const eff = await this.entitlements.getEffective(intent.tenantId);
        await this.tracking.activateAddon(intent.tenantId, intent.quantity ?? 0, eff.perVehiclePrice ?? DEFAULT_PER_VEHICLE, 'ADDON');
      } else {
        await this.billing.applyPaidIntent({
          tenantId: intent.tenantId,
          purpose: intent.purpose as PaymentPurpose,
          amount: Number(intent.amount),
          quantity: intent.quantity ?? null,
          moduleKey: intent.moduleKey ?? null,
          actorId: intent.actorId ?? null,
        });
      }
      this.logger.log(`Applied payment ${intent.id} (${intent.purpose}, ${intent.amount} ${intent.currency}) for tenant ${intent.tenantId}`);
      // Issue a tax invoice for the confirmed payment (best-effort — never roll back the payment).
      try {
        await this.invoices.issueForPayment({
          id: intent.id, tenantId: intent.tenantId, purpose: intent.purpose as PaymentPurpose,
          amount: Number(intent.amount), quantity: intent.quantity ?? null, moduleKey: intent.moduleKey ?? null,
          providerChargeId: intent.providerChargeId ?? null, currency: intent.currency,
        });
      } catch (err) {
        this.logger.error(`Invoice issue failed for ${intent.id}: ${(err as Error).message}`);
      }
    } catch (err) {
      // Roll the status back so a later retry can re-apply.
      await this.prisma.paymentIntent.updateMany({ where: { id: intentId, status: 'PAID' }, data: { status: 'PENDING', appliedAt: null } });
      this.logger.error(`Apply failed for ${intent.id}, reverted to PENDING: ${(err as Error).message}`);
      throw err;
    }
  }

  // ---- history ----

  async listMine(): Promise<PaymentIntentDto[]> {
    if (!currentTenantId()) throw new ForbiddenException('No tenant context');
    const rows = await this.prisma.paymentIntent.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    return rows.map((r) => this.toDto(r));
  }

  private async result(intentId: string, message: string): Promise<VerifyResult> {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id: intentId } });
    if (!intent) throw new NotFoundException('Payment not found');
    const dto = this.toDto(intent);
    return { status: dto.status, intent: dto, message };
  }

  private toDto(r: {
    id: string; purpose: string; amount: Prisma.Decimal; currency: string; quantity: number | null;
    moduleKey: string | null; status: string; provider: string; providerChargeId: string | null;
    createdAt: Date; appliedAt: Date | null;
  }): PaymentIntentDto {
    return {
      id: r.id,
      purpose: r.purpose as PaymentPurpose,
      amount: Number(r.amount),
      currency: r.currency,
      quantity: r.quantity,
      moduleKey: r.moduleKey,
      status: r.status as PaymentStatus,
      provider: 'TAP',
      providerChargeId: r.providerChargeId,
      createdAt: r.createdAt.toISOString(),
      appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
    };
  }

  private describe(purpose: PaymentPurpose, quantity: number | null, moduleKey: string | null): string {
    if (purpose === 'WALLET_TOPUP') return 'NX-LAM wallet top-up';
    if (purpose === 'SEATS') return `NX-LAM ${quantity} user seat(s)`;
    return `NX-LAM module add-on: ${moduleKey}`;
  }

  private webBase(): string {
    return (this.config.get<string>('WEB_PUBLIC_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  }
  private apiBase(): string {
    return (this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001').replace(/\/+$/, '');
  }
}
