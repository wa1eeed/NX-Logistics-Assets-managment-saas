import { Injectable, Logger } from '@nestjs/common';
import type { PaymentGatewaySettings, UpdatePaymentGatewayDto } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';

const TAP_SETTING_KEY = 'integrations.tap';
const TAP_API_BASE = 'https://api.tap.company/v2';

interface StoredTap {
  enabled?: boolean | null;
  publicKey?: string | null;
  secretKey?: string | null;
  currency?: string | null;
}

export interface TapCharge {
  id: string;
  status: string; // INITIATED | CAPTURED | FAILED | DECLINED | ...
  amount: number;
  currency: string;
  transactionUrl: string | null;
  metadata: Record<string, string> | null;
}

export interface CreateChargeInput {
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  redirectUrl: string;
  postUrl: string;
  reference: string;
  metadata: Record<string, string>;
}

/**
 * Thin client + config store for the Tap payment gateway
 * (https://developers.tap.company/reference/api-endpoint).
 *
 * Credentials live platform-side in PlatformSetting (key `integrations.tap`) and
 * are edited only by the platform admin. The secret key is never returned to a
 * client — callers see `secretSet` instead. When no secret is configured the
 * gateway is "not configured" and the app falls back to a dev sandbox.
 */
@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async raw(): Promise<StoredTap> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: TAP_SETTING_KEY } });
    return (row?.value as StoredTap | null) ?? {};
  }

  private modeOf(secretKey: string | null | undefined): 'test' | 'live' | null {
    if (!secretKey) return null;
    if (secretKey.startsWith('sk_live') || secretKey.startsWith('pk_live')) return 'live';
    return 'test';
  }

  /** Settings for the admin UI — secret value is masked (only `secretSet`). */
  async getSettings(): Promise<PaymentGatewaySettings> {
    const c = await this.raw();
    return {
      provider: 'TAP',
      enabled: !!c.enabled,
      publicKey: c.publicKey ?? null,
      currency: c.currency || 'SAR',
      mode: this.modeOf(c.secretKey),
      secretSet: !!c.secretKey,
    };
  }

  /** Upsert the gateway config. An empty/omitted secretKey keeps the stored one. */
  async updateSettings(dto: UpdatePaymentGatewayDto): Promise<PaymentGatewaySettings> {
    const current = await this.raw();
    const next: StoredTap = {
      enabled: dto.enabled ?? current.enabled ?? false,
      publicKey: dto.publicKey ?? current.publicKey ?? null,
      secretKey: dto.secretKey?.trim() ? dto.secretKey.trim() : current.secretKey ?? null,
      currency: dto.currency ?? current.currency ?? 'SAR',
    };
    await this.prisma.platformSetting.upsert({
      where: { key: TAP_SETTING_KEY },
      create: { key: TAP_SETTING_KEY, value: next as object },
      update: { value: next as object },
    });
    this.logger.log(`Tap gateway settings updated (enabled=${next.enabled}, mode=${this.modeOf(next.secretKey)})`);
    return this.getSettings();
  }

  /** True when the gateway is enabled AND has a usable secret key. */
  async isLive(): Promise<boolean> {
    const c = await this.raw();
    return !!c.enabled && !!c.secretKey;
  }

  async currency(): Promise<string> {
    const c = await this.raw();
    return c.currency || 'SAR';
  }

  private async secret(): Promise<string | null> {
    return (await this.raw()).secretKey ?? null;
  }

  /** Validate the stored key against Tap without creating a charge. */
  async test(): Promise<{ ok: boolean; message: string }> {
    const secret = await this.secret();
    if (!secret) return { ok: false, message: 'No secret key configured.' };
    try {
      // A lightweight authenticated call: retrieving a bogus id returns 4xx but
      // a BAD KEY returns 401 — that is how we tell the key is valid.
      const res = await fetch(`${TAP_API_BASE}/charges/chg_validate_key_check`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.status === 401) return { ok: false, message: 'Tap rejected the secret key (401 Unauthorized).' };
      return { ok: true, message: `Tap key accepted (${this.modeOf(secret)} mode).` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  /** Create a hosted charge; returns the charge incl. the redirect transaction URL. */
  async createCharge(input: CreateChargeInput): Promise<TapCharge> {
    const secret = await this.secret();
    if (!secret) throw new Error('Tap gateway is not configured');
    const body = {
      amount: input.amount,
      currency: input.currency,
      threeDSecure: true,
      save_card: false,
      description: input.description,
      reference: { transaction: input.reference, order: input.reference },
      customer: {
        first_name: input.customerName || 'Customer',
        email: input.customerEmail || undefined,
      },
      source: { id: 'src_all' },
      redirect: { url: input.redirectUrl },
      post: { url: input.postUrl },
      metadata: input.metadata,
    };
    const res = await fetch(`${TAP_API_BASE}/charges`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = this.tapError(json) ?? `Tap charge failed (HTTP ${res.status})`;
      throw new Error(msg);
    }
    return this.toCharge(json);
  }

  /** Authoritative status lookup — always trust this over the webhook body. */
  async retrieveCharge(chargeId: string): Promise<TapCharge> {
    const secret = await this.secret();
    if (!secret) throw new Error('Tap gateway is not configured');
    const res = await fetch(`${TAP_API_BASE}/charges/${encodeURIComponent(chargeId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(this.tapError(json) ?? `Tap retrieve failed (HTTP ${res.status})`);
    return this.toCharge(json);
  }

  private toCharge(json: Record<string, unknown>): TapCharge {
    const transaction = json.transaction as { url?: string } | undefined;
    return {
      id: String(json.id ?? ''),
      status: String(json.status ?? 'UNKNOWN'),
      amount: Number(json.amount ?? 0),
      currency: String(json.currency ?? 'SAR'),
      transactionUrl: transaction?.url ?? null,
      metadata: (json.metadata as Record<string, string> | undefined) ?? null,
    };
  }

  private tapError(json: Record<string, unknown>): string | null {
    const errors = json.errors as Array<{ description?: string; code?: string }> | undefined;
    if (Array.isArray(errors) && errors.length) {
      return errors.map((e) => e.description || e.code).filter(Boolean).join('; ');
    }
    return null;
  }
}
