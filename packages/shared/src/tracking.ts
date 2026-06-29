// ============================================================
// Vehicle tracking — operational GPS tracking (NOT a WASL replacement).
// Enabled per tenant via plan entitlement or a standalone per-vehicle add-on.
// Location source is abstracted (hardware device / driver app / WASL).
// ============================================================

export type TrackingProvider = 'HARDWARE' | 'DRIVER_APP' | 'WASL';
export const TRACKING_PROVIDERS: TrackingProvider[] = ['HARDWARE', 'DRIVER_APP', 'WASL'];

/** Tenant tracking status: whether enabled, quota and current usage. */
export interface TrackingStatusDto {
  enabled: boolean;
  source: string | null;       // PLAN | ADDON | BOTH
  vehicleQuota: number;
  trackedCount: number;        // assets with trackingEnabled = true
  perVehiclePrice: number | null;
  deviceCount: number;
}

export interface TrackedAssetDto {
  assetId: string;
  code: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  speed: number | null;
  lastSeenAt: string | null;
}

export interface TrackingDeviceDto {
  id: string;
  assetId: string;
  assetCode: string | null;
  provider: TrackingProvider;
  externalId: string;
  status: string;
  lastSeenAt: string | null;
}

export interface GeofenceDto {
  id: string;
  name: string;
  type: 'CIRCLE' | 'POLYGON';
  geo: Record<string, unknown>;
  isActive: boolean;
}

/** Activate/extend the per-vehicle tracking add-on (paid by card). */
export interface ActivateTrackingDto {
  vehicleQuota: number;
}

/** Register a hardware device on an asset; the signingKey is returned ONCE. */
export interface RegisterDeviceDto {
  assetId: string;
  provider?: TrackingProvider;
  externalId: string;
}

// ---- Live operations console (Tookan-style: tasks ↔ drivers ↔ map) ----

export type VehicleStatus = 'ACTIVE' | 'AVAILABLE' | 'OFFLINE';

/** A tracked vehicle/truck (the GPS unit is on the asset, so the vehicle is the tracked entity). */
export interface ConsoleVehicle {
  id: string;                   // asset id
  code: string;                 // vehicle code
  name: string;                 // manufacturer + model (display)
  region: string | null;        // operating region/city (for the map filter)
  driverName: string | null;    // currently assigned driver
  projectName: string | null;   // current project (from the active contract on this vehicle)
  taskRef: string | null;       // current authorization no
  since: string | null;         // when the current task started (contract.startDate)
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  // ACTIVE = connected + on a mission; AVAILABLE = connected + idle/free; OFFLINE = no recent ping (out of service / maintenance).
  status: VehicleStatus;
}

export interface ConsoleTask {
  id: string;
  kind: 'PENDING' | 'ACTIVE';
  ref: string;
  title: string;
  subtitle: string | null;
  region: string | null;        // operating region/city (for the map filter)
  projectName: string | null;   // requesting / assigned project
  assetCode: string | null;     // equipment code (ACTIVE) or reserved (PENDING)
  driverName: string | null;    // assigned driver (ACTIVE)
  itemLabel: string | null;     // requested asset-type name (PENDING)
  lat: number | null;
  lng: number | null;
  date: string | null;          // "since" reference: createdAt (PENDING) / startDate (ACTIVE)
}

export interface TrackingConsole {
  vehicles: ConsoleVehicle[];
  tasks: ConsoleTask[];
}
