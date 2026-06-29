// ============================================================
// SaaS entitlements — tenant tiering & feature flags.
// Single source of truth for the toggleable feature modules and the
// default resource caps applied to a tenant that has no explicit
// subscription row yet. Used by the API guardrails and the web UI.
// ============================================================

/** Feature modules that can be enabled/disabled per tenant via their subscription. */
export const PLATFORM_MODULES = [
  'rentals',
  'maintenance',
  'disposal',
  'acquisition',
  'suppliers',
  'drivers',
  'kpis',
  'finance',
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export const MODULE_LABELS: Record<PlatformModule, { en: string; ar: string }> = {
  rentals: { en: 'Rentals & Dispatch', ar: 'النقليات والتأجير' },
  maintenance: { en: 'Maintenance', ar: 'الصيانة' },
  disposal: { en: 'Disposal / Sale', ar: 'البيع والتخلص' },
  acquisition: { en: 'External Acquisition', ar: 'الاستحواذ الخارجي' },
  suppliers: { en: 'Suppliers', ar: 'الموردون' },
  drivers: { en: 'Drivers', ar: 'السائقون' },
  kpis: { en: 'KPIs & Dashboards', ar: 'المؤشرات واللوحات' },
  finance: { en: 'Finance & Invoicing', ar: 'المالية والفوترة' },
};

/** Default feature set: everything currently shipped is on; finance is off until built. */
export const DEFAULT_ENABLED_MODULES: Record<PlatformModule, boolean> = {
  rentals: true,
  maintenance: true,
  disposal: true,
  acquisition: true,
  suppliers: true,
  drivers: true,
  kpis: true,
  finance: false,
};

/** Caps applied when a tenant has no explicit subscription row. */
export const DEFAULT_MAX_USER_COUNT = 25;
export const DEFAULT_MAX_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
export const DEFAULT_PLAN_NAME = 'STANDARD';

/** Soft-limit threshold (%) at which a storage-usage warning is raised (block stays at 100%). */
export const STORAGE_WARN_PERCENT = 90;

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';

/** A tenant's subscription as exposed to clients (BigInt serialized to number). */
export interface TenantSubscriptionDto {
  tenantId: string;
  planId: string | null;
  planName: string;
  status: SubscriptionStatus;
  maxUserCount: number;
  maxStorageBytes: number;
  enabledModules: Record<string, boolean>;
  seatPriceMonthly: number | null;
  /** Per-vehicle tracking price snapshot (used by the tracking add-on, Phase 6). */
  perVehiclePrice: number | null;
  /** Optional cap on total assets (nullable = unlimited; not enforced yet). */
  assetCap: number | null;
  /** Billing period window + renewal (ISO strings). */
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewsAt: string | null;
}

/** Live usage of a tenant against its caps, for dashboards/quota bars. */
export interface TenantUsageDto {
  userCount: number;
  maxUserCount: number;
  userPercent: number;
  storageBytes: number;
  maxStorageBytes: number;
  storagePercent: number;
  /** Soft-limit signal: storage at/above STORAGE_WARN_PERCENT (alert before the hard block). */
  storageWarning: boolean;
  enabledModules: Record<string, boolean>;
}

/** Payload the platform admin sends to update a tenant's subscription. */
export interface UpdateTenantSubscriptionDto {
  planId?: string | null;
  planName?: string;
  status?: SubscriptionStatus;
  maxUserCount?: number;
  maxStorageBytes?: number;
  enabledModules?: Record<string, boolean>;
  seatPriceMonthly?: number | null;
  perVehiclePrice?: number | null;
  assetCap?: number | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  renewsAt?: string | null;
}

/** Normalize a (possibly partial) module map onto the full known module set. */
export function normalizeModules(
  partial: Record<string, boolean> | null | undefined,
): Record<PlatformModule, boolean> {
  const out = { ...DEFAULT_ENABLED_MODULES };
  if (partial) {
    for (const m of PLATFORM_MODULES) {
      if (typeof partial[m] === 'boolean') out[m] = partial[m];
    }
  }
  return out;
}
