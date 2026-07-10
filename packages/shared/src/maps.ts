// Map provider layer — a single platform-level config chooses which mapping
// provider the whole app renders with, without touching application code. The
// Google Maps JS key is public by design (embedded in the browser, restricted by
// HTTP referrer), so the runtime endpoint returns it; the OpenRouteService key is
// server-side only. Adding a new provider is a web-side registry entry.

export const MAPS_SETTING_KEY = 'integrations.maps';

/**
 * Which base-map provider to render with:
 * - `auto`  → best available (Google when a key exists & healthy, else OSM/Leaflet).
 * - `google`→ prefer Google, fall back to OSM if the key is missing/failed.
 * - `osm`   → always the free OpenStreetMap/Leaflet layer (e.g. to cap cost).
 */
export type MapProviderId = 'auto' | 'google' | 'osm';

/** Admin-facing view — keys are never returned, only whether each one is set. */
export interface MapsGatewaySettings {
  enabled: boolean;
  apiKeySet: boolean;
  /** OpenRouteService key for routing/directions (server-side proxy). */
  routingKeySet: boolean;
  provider: MapProviderId;
}

/** Platform-admin upsert. An empty/omitted key keeps the stored one. */
export interface UpdateMapsGatewayDto {
  enabled?: boolean;
  apiKey?: string;
  routingApiKey?: string;
  provider?: MapProviderId;
}

/** What the web needs at runtime — the Google key (null when unavailable) + the chosen provider. */
export interface MapsRuntime {
  apiKey: string | null;
  provider: MapProviderId;
}
