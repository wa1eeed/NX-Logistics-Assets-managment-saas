import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  DEFAULT_ENABLED_MODULES, DEFAULT_MAX_STORAGE_BYTES, DEFAULT_MAX_USER_COUNT, DEFAULT_PLAN_NAME,
  DEFAULT_SEAT_PRICE, MODULE_ADDON_PRICES, PLATFORM_MODULES, normalizeModules,
  type BillingOverviewDto, type PaymentPurpose, type PlatformModule, type WalletTransactionDto,
} from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { EntitlementsService } from '../entitlements/entitlements.service';

/**
 * Self-service subscription billing for the company admin: a prepaid wallet that
 * funds add-on purchases. The wallet is topped up with REAL money via the Tap
 * payment gateway (see PaymentsModule); buying seats raises maxUserCount and
 * activating a module flips its feature flag, both debited from the wallet.
 *
 * Wallet mutations live here. The internal `_*` mutators take an explicit
 * tenantId so they also work outside a request (e.g. the public Tap webhook,
 * which has no JWT/tenant context). `applyPaidIntent` is the single entry point
 * the PaymentsModule calls once a charge is confirmed.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private requireTenant(): string {
    const id = currentTenantId();
    if (!id) throw new ForbiddenException('No tenant context');
    return id;
  }

  /** Get the subscription row, creating a default one if the tenant has none. */
  private async ensureSubscription(tenantId: string) {
    const existing = await this.prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planName: DEFAULT_PLAN_NAME,
        maxUserCount: DEFAULT_MAX_USER_COUNT,
        maxStorageBytes: BigInt(DEFAULT_MAX_STORAGE_BYTES),
        enabledModules: DEFAULT_ENABLED_MODULES,
        seatPriceMonthly: DEFAULT_SEAT_PRICE,
      },
    });
  }

  private seatPrice(sub: { seatPriceMonthly: Prisma.Decimal | null }): number {
    return sub.seatPriceMonthly != null ? Number(sub.seatPriceMonthly) : DEFAULT_SEAT_PRICE;
  }

  /** Price of a seat for a tenant (used by the checkout to compute the charge). */
  async seatPriceFor(tenantId: string): Promise<number> {
    return this.seatPrice(await this.ensureSubscription(tenantId));
  }

  /** Price of activating a module add-on. */
  modulePrice(moduleName: PlatformModule): number {
    return MODULE_ADDON_PRICES[moduleName] ?? 0;
  }

  /** Validate a module is a buyable (non-core, not already active) add-on. */
  async assertModulePurchasable(tenantId: string, moduleName: PlatformModule): Promise<void> {
    if (!PLATFORM_MODULES.includes(moduleName)) throw new BadRequestException('Unknown module');
    if (this.modulePrice(moduleName) === 0) {
      throw new BadRequestException('This module is part of the core plan and is always available');
    }
    const sub = await this.ensureSubscription(tenantId);
    const modules = normalizeModules(sub.enabledModules as Record<string, boolean>);
    if (modules[moduleName]) throw new BadRequestException('Module is already active');
  }

  async overview(): Promise<BillingOverviewDto> {
    const tenantId = this.requireTenant();
    const sub = await this.ensureSubscription(tenantId);
    const modules = normalizeModules(sub.enabledModules as Record<string, boolean>);
    const [userCount, txns] = await Promise.all([
      this.entitlements.activeUserCount(tenantId),
      this.prisma.walletTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return {
      walletBalance: Number(sub.walletBalance),
      seatPrice: this.seatPrice(sub),
      maxUserCount: sub.maxUserCount,
      userCount,
      addons: PLATFORM_MODULES.map((m) => ({
        module: m,
        enabled: modules[m] !== false,
        price: MODULE_ADDON_PRICES[m],
        core: MODULE_ADDON_PRICES[m] === 0,
      })),
      transactions: txns.map(this.toTxn),
    };
  }

  // ---- public (wallet-funded) purchases — debit the existing balance ----

  async purchaseSeats(quantity: number, actorId: string): Promise<BillingOverviewDto> {
    const tenantId = this.requireTenant();
    await this._seats(tenantId, quantity, actorId);
    return this.overview();
  }

  async activateModule(moduleName: PlatformModule, actorId: string): Promise<BillingOverviewDto> {
    const tenantId = this.requireTenant();
    await this._module(tenantId, moduleName, actorId);
    return this.overview();
  }

  // ---- card-paid effect (called once a Tap charge is confirmed) ----

  /**
   * Apply a confirmed card payment. The paid amount is credited to the wallet
   * (a TOPUP entry) and, for SEATS/MODULE, immediately spent — net wallet stays
   * flat but the ledger shows both the card payment and the purchase.
   * Idempotency (apply-once) is enforced by the caller before invoking this.
   */
  async applyPaidIntent(p: {
    tenantId: string; purpose: PaymentPurpose; amount: number;
    quantity: number | null; moduleKey: string | null; actorId: string | null;
  }): Promise<void> {
    const actorId = p.actorId ?? null;
    if (p.purpose === 'WALLET_TOPUP') {
      await this._credit(p.tenantId, p.amount, actorId, 'Wallet top-up (card / Tap)', { provider: 'TAP' });
    } else if (p.purpose === 'SEATS') {
      const qty = p.quantity ?? 0;
      await this._credit(p.tenantId, p.amount, actorId, `Card payment — ${qty} seat(s)`, { provider: 'TAP', purpose: p.purpose });
      await this._seats(p.tenantId, qty, actorId);
    } else if (p.purpose === 'MODULE') {
      await this._credit(p.tenantId, p.amount, actorId, `Card payment — module ${p.moduleKey}`, { provider: 'TAP', purpose: p.purpose });
      await this._module(p.tenantId, p.moduleKey as PlatformModule, actorId);
    }
  }

  // ---- internal mutators (explicit tenantId; safe outside a request) ----

  private async _credit(
    tenantId: string, amount: number, actorId: string | null,
    description: string, meta?: Record<string, unknown>,
  ): Promise<number> {
    if (!(amount > 0)) throw new BadRequestException('Amount must be positive');
    const sub = await this.ensureSubscription(tenantId);
    const balanceAfter = Number(sub.walletBalance) + amount;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({ where: { tenantId }, data: { walletBalance: balanceAfter } }),
      this.prisma.walletTransaction.create({
        data: { tenantId, type: 'TOPUP', amount, balanceAfter, description, meta: (meta as Prisma.InputJsonValue) ?? Prisma.DbNull, actorId },
      }),
    ]);
    return balanceAfter;
  }

  private async _seats(tenantId: string, quantity: number, actorId: string | null): Promise<void> {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new BadRequestException('Quantity must be a positive integer');
    const sub = await this.ensureSubscription(tenantId);
    const unit = this.seatPrice(sub);
    const cost = quantity * unit;
    const balance = Number(sub.walletBalance);
    if (balance < cost) throw new BadRequestException(`Insufficient wallet balance (need ${cost}, have ${balance}). Top up first.`);
    const balanceAfter = balance - cost;
    const newMax = sub.maxUserCount + quantity;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({ where: { tenantId }, data: { walletBalance: balanceAfter, maxUserCount: newMax } }),
      this.prisma.walletTransaction.create({
        data: {
          tenantId, type: 'PURCHASE_SEATS', amount: -cost, balanceAfter,
          description: `Purchased ${quantity} user seat(s)`,
          meta: { quantity, unitPrice: unit, newMaxUserCount: newMax }, actorId,
        },
      }),
    ]);
  }

  private async _module(tenantId: string, moduleName: PlatformModule, actorId: string | null): Promise<void> {
    await this.assertModulePurchasable(tenantId, moduleName);
    const price = this.modulePrice(moduleName);
    const sub = await this.ensureSubscription(tenantId);
    const balance = Number(sub.walletBalance);
    if (balance < price) throw new BadRequestException(`Insufficient wallet balance (need ${price}, have ${balance}). Top up first.`);
    const balanceAfter = balance - price;
    const modules = normalizeModules(sub.enabledModules as Record<string, boolean>);
    modules[moduleName] = true;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({ where: { tenantId }, data: { walletBalance: balanceAfter, enabledModules: modules } }),
      this.prisma.walletTransaction.create({
        data: {
          tenantId, type: 'PURCHASE_MODULE', amount: -price, balanceAfter,
          description: `Activated module: ${moduleName}`, meta: { module: moduleName, price }, actorId,
        },
      }),
    ]);
  }

  private toTxn(t: {
    id: string; type: string; amount: Prisma.Decimal; balanceAfter: Prisma.Decimal;
    description: string; meta: Prisma.JsonValue; createdAt: Date;
  }): WalletTransactionDto {
    return {
      id: t.id,
      type: t.type as WalletTransactionDto['type'],
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      meta: (t.meta as Record<string, unknown> | null) ?? null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
