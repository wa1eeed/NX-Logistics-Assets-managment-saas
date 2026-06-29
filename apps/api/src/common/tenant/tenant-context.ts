import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  tenantId: string | null;
}

/** Per-request tenant context, used by the Prisma middleware to scope every query. */
export const tenantContext = new AsyncLocalStorage<TenantStore>();

export function currentTenantId(): string | null {
  return tenantContext.getStore()?.tenantId ?? null;
}

/** Models that carry a tenantId and must be isolated per tenant. */
export const TENANT_MODELS = new Set<string>([
  'User', 'UserRole', 'Role', 'RolePermission', 'OrgUnit', 'AssetType', 'AssetClass', 'Model', 'Asset', 'VehicleDetail',
  'Driver', 'Document', 'EquipmentRequest', 'RentalContract', 'HandoverInspection',
  'MaintenanceWorkOrder', 'MaintenanceCard', 'MeterReading', 'MaintenancePlan', 'SaleOrder', 'Supplier', 'ExternalLeaseContract',
  'Lookup', 'AuditLog',
  // SaaS guardrails — each tenant only sees its own subscription + storage ledger + wallet + storage config + payments + tracking.
  'TenantSubscription', 'StorageObject', 'WalletTransaction', 'TenantStorageConfig', 'PaymentIntent',
  'TrackingAddon', 'TrackingDevice', 'LocationPing', 'Geofence', 'IntegrationRequest',
  // Note: Setting stays platform-level (global) for now; per-tenant settings is a later step.
]);
