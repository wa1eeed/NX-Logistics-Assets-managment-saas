// ============================================================
// Payments — real card payments via a payment gateway (Tap).
//
// The PLATFORM operator owns one Tap merchant account (configured by the
// platform admin) and collects money FROM tenants for:
//   • wallet top-ups        (WALLET_TOPUP)
//   • extra user seats       (SEATS)
//   • feature module add-ons (MODULE)
//
// Flow (hosted checkout): the tenant admin starts a checkout → the API creates
// a Tap Charge and returns the hosted payment URL → the browser redirects there
// → Tap redirects back to the return page AND calls our webhook → the API
// verifies the charge with Tap (authoritative) and applies the purchase once.
// ============================================================

import type { PlatformModule } from './entitlements';

/** What a payment is for. Drives how the paid amount is applied. */
export type PaymentPurpose = 'WALLET_TOPUP' | 'SEATS' | 'MODULE' | 'TRACKING';

export const PAYMENT_PURPOSES: PaymentPurpose[] = ['WALLET_TOPUP', 'SEATS', 'MODULE', 'TRACKING'];

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';

/** Supported gateways (only Tap today; kept open for future providers). */
export type PaymentProvider = 'TAP';

export const PAYMENT_PROVIDERS: PaymentProvider[] = ['TAP'];

/**
 * Platform payment-gateway settings as returned to the admin UI.
 * The secret key is NEVER sent to the client — only whether one is set.
 */
export interface PaymentGatewaySettings {
  provider: PaymentProvider;
  enabled: boolean;
  /** Tap publishable key (pk_test_… / pk_live_…) — safe to expose. */
  publicKey: string | null;
  currency: string;
  /** Derived from the secret-key prefix: 'test' | 'live' | null (unset). */
  mode: 'test' | 'live' | null;
  /** True when a secret key is stored (value itself is never returned). */
  secretSet: boolean;
}

/** Update payload — an empty/omitted secretKey keeps the stored one. */
export interface UpdatePaymentGatewayDto {
  provider?: PaymentProvider;
  enabled?: boolean;
  publicKey?: string | null;
  secretKey?: string;
  currency?: string;
}

export interface CheckoutDto {
  purpose: PaymentPurpose;
  /** WALLET_TOPUP: the top-up amount (SAR). */
  amount?: number;
  /** SEATS: number of seats to buy. */
  quantity?: number;
  /** MODULE: which module add-on to activate. */
  module?: PlatformModule;
  /** TRACKING: number of vehicles to license for GPS tracking. */
  vehicleQuota?: number;
}

export interface CheckoutResult {
  intentId: string;
  /** Where the browser must go to complete payment (Tap hosted page, or the
   *  local return page in sandbox mode when no live gateway is configured). */
  redirectUrl: string;
  amount: number;
  currency: string;
  /** True when no real gateway is configured and a dev sandbox is used. */
  sandbox: boolean;
}

export interface PaymentIntentDto {
  id: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  quantity: number | null;
  moduleKey: string | null;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerChargeId: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface VerifyResult {
  status: PaymentStatus;
  intent: PaymentIntentDto;
  message: string;
}
