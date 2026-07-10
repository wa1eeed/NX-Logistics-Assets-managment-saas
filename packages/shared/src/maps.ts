// Google Maps provider — a single platform-level API key managed by the platform
// operator and consumed by every tenant's map/geofence UI. Maps JS keys are public
// by design (embedded in the browser, restricted by HTTP referrer in Google Cloud),
// so the runtime endpoint returns the key to authenticated clients.

export const MAPS_SETTING_KEY = 'integrations.maps';

/** Admin-facing view — keys are never returned, only whether each one is set. */
export interface MapsGatewaySettings {
  enabled: boolean;
  apiKeySet: boolean;
  /** OpenRouteService key for routing/directions (server-side proxy). */
  routingKeySet: boolean;
}

/** Platform-admin upsert. An empty/omitted key keeps the stored one. */
export interface UpdateMapsGatewayDto {
  enabled?: boolean;
  apiKey?: string;
  routingApiKey?: string;
}

/** What the web needs to boot Google Maps — null when maps aren't configured/enabled. */
export interface MapsRuntime {
  apiKey: string | null;
}
