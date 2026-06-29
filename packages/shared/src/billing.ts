// ============================================================
// SaaS billing — subscription wallet + self-service add-ons.
// The company admin tops up a wallet, then buys extra user seats or
// activates feature modules; purchases debit the wallet and raise the
// tenant's own caps (within the controlled purchase flow, not arbitrary).
// ============================================================

import type { PlatformModule } from './entitlements';

export type WalletTxnType = 'TOPUP' | 'PURCHASE_SEATS' | 'PURCHASE_MODULE';

/** Default monthly price of activating a feature module as an add-on (SAR). */
export const MODULE_ADDON_PRICES: Record<PlatformModule, number> = {
  rentals: 0, // core — always on, not a paid add-on
  maintenance: 0,
  disposal: 99,
  acquisition: 99,
  suppliers: 49,
  drivers: 49,
  kpis: 149,
  finance: 199,
};

/** Default price of one additional user seat (SAR / seat / month). */
export const DEFAULT_SEAT_PRICE = 49;

/** Suggested wallet top-up amounts (SAR). */
export const TOPUP_PRESETS = [500, 1000, 2500, 5000];

export interface WalletTransactionDto {
  id: string;
  type: WalletTxnType;
  amount: number;       // signed: + top-up, − purchase
  balanceAfter: number;
  description: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ModuleAddonStatus {
  module: PlatformModule;
  enabled: boolean;
  /** Monthly price; 0 means it is a core module included in the plan. */
  price: number;
  /** Core modules can't be toggled off / bought — they're always available. */
  core: boolean;
}

export interface BillingOverviewDto {
  walletBalance: number;
  seatPrice: number;
  // current caps / usage echoed for the billing UI
  maxUserCount: number;
  userCount: number;
  addons: ModuleAddonStatus[];
  transactions: WalletTransactionDto[];
}

export interface TopUpDto {
  amount: number;
}

export interface PurchaseSeatsDto {
  /** Number of additional seats to buy (×1 month). */
  quantity: number;
}

export interface PurchaseModuleDto {
  module: PlatformModule;
}
