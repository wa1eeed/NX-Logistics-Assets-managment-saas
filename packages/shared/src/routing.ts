// Routing via OpenRouteService (the free routing provider). The ORS key is a
// SERVER-SIDE secret (not referrer-restricted like the Google Maps JS key), so all
// routing calls are proxied through the API — the browser never sees the key.
// All coordinates in these DTOs are [lat, lng] for consistency with the rest of the
// app; the server converts to ORS's [lng, lat] order.

export interface DirectionsRequest {
  /** Ordered waypoints [lat, lng]; at least a start and an end. */
  coordinates: [number, number][];
  profile?: 'driving-car' | 'driving-hgv';
}

export interface RouteResult {
  /** Polyline as [lat, lng] points, ready to draw on Google/Leaflet. */
  geometry: [number, number][];
  distanceM: number;
  durationS: number;
}

export interface OptimizeRequest {
  start: [number, number];
  end?: [number, number];
  stops: [number, number][];
  profile?: 'driving-car' | 'driving-hgv';
}

export interface OptimizeResult extends RouteResult {
  /** The order to visit `stops` (indices into the request's stops array). */
  order: number[];
}

export interface TrailPoint {
  lat: number;
  lng: number;
  at: string;
}

export interface AssetTrail {
  assetId: string;
  points: TrailPoint[];
}
