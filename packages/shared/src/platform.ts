// ============================================================
// Platform / SaaS operator types — the admin layer above all tenants.
// ============================================================

import type { PlatformModule } from './entitlements';

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELED';

/** Preset subscription tiers the platform admin can apply to a tenant in one click. */
export interface SubscriptionPlan {
  name: string;
  maxUserCount: number;
  maxStorageGb: number;
  seatPriceMonthly: number;
  modules: Partial<Record<PlatformModule, boolean>>;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { name: 'STARTER', maxUserCount: 10, maxStorageGb: 5, seatPriceMonthly: 39, modules: { finance: false, disposal: false, acquisition: false } },
  { name: 'STANDARD', maxUserCount: 25, maxStorageGb: 10, seatPriceMonthly: 49, modules: { finance: false } },
  { name: 'ENTERPRISE', maxUserCount: 200, maxStorageGb: 100, seatPriceMonthly: 79, modules: { finance: true, disposal: true, acquisition: true, suppliers: true, drivers: true, kpis: true } },
];

// ---- DB-backed plan catalog (managed by the platform admin) ----

/** A subscription plan stored in the DB and editable from the Control Plane. */
export interface PlanDto {
  id: string;
  name: string;
  seats: number;
  storageGb: number;
  features: Record<string, boolean>;
  priceMonthly: number;
  /** Per-vehicle tracking price (SAR/vehicle/month) — used by the tracking add-on. */
  perVehiclePrice: number | null;
  /** Optional cap on total assets (null = unlimited; not enforced yet). */
  assetCap: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertPlanDto {
  name: string;
  seats: number;
  storageGb: number;
  features?: Record<string, boolean>;
  priceMonthly: number;
  perVehiclePrice?: number | null;
  assetCap?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

/** Canonical seed catalog (mirrors SUBSCRIPTION_PLANS + plan price + per-vehicle). */
export const PLAN_SEED: Array<UpsertPlanDto> = [
  { name: 'STARTER', seats: 10, storageGb: 5, priceMonthly: 199, perVehiclePrice: null, assetCap: 100, sortOrder: 1, features: { finance: false, disposal: false, acquisition: false } },
  { name: 'STANDARD', seats: 25, storageGb: 10, priceMonthly: 499, perVehiclePrice: 18, assetCap: null, sortOrder: 2, features: { finance: false } },
  { name: 'BUSINESS', seats: 50, storageGb: 500, priceMonthly: 1299, perVehiclePrice: 15, assetCap: null, sortOrder: 3, features: { finance: true } },
  { name: 'ENTERPRISE', seats: 200, storageGb: 1024, priceMonthly: 2999, perVehiclePrice: 12, assetCap: null, sortOrder: 4, features: { finance: true, disposal: true, acquisition: true, suppliers: true, drivers: true, kpis: true } },
];

export interface PlatformAuditItem {
  id: string;
  tenantCode: string | null;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

/** One row in the platform admin's cross-tenant tenants table. */
export interface PlatformTenantSummary {
  id: string;
  code: string;
  slug: string;
  name: string;
  status: TenantStatus;
  planName: string;
  userCount: number;
  maxUserCount: number;
  assetCount: number;
  storageBytes: number;
  maxStorageBytes: number;
  walletBalance: number;
  seatPriceMonthly: number;
  /** Estimated monthly recurring revenue from this tenant (active users × seat price). */
  mrr: number;
  createdAt: string;
}

export interface PlatformOverview {
  tenants: PlatformTenantSummary[];
  totals: {
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    users: number;
    assets: number;
    storageBytes: number;
    /** Total estimated MRR across all active tenants. */
    estimatedMrr: number;
  };
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}
