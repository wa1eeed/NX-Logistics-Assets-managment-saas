import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GeofenceDto, MapProviderId, MapsRuntime } from '@nx-lam/shared';
import { api } from './api';

// ---- Google Maps runtime health: fall back to Leaflet if the key is rejected ----
// Google calls window.gm_authFailure on an invalid key / disabled billing / exhausted
// quota. Once that (or a script load error) happens, we flip a flag so every map
// switches to the free OpenStreetMap/Leaflet layer for the rest of the session.
let googleFailed = false;
const failListeners = new Set<() => void>();

export function markGoogleMapsFailed(): void {
  if (googleFailed) return;
  googleFailed = true;
  failListeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = markGoogleMapsFailed;
}

export type LatLng = { lat: number; lng: number };

/** Default map view — Riyadh, Saudi Arabia. */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 24.7136, lng: 46.6753 };

/** Loaded once for the whole app; `drawing` powers the geofence editor, `geometry` the containment test. */
export const GOOGLE_MAPS_LIBRARIES: ('drawing' | 'geometry')[] = ['drawing', 'geometry'];

/**
 * The platform-configured Google Maps key. `apiKey === null` means maps aren't set
 * up (or disabled) → callers fall back to Leaflet/OSM. Cached for 5 minutes.
 */
export function useMapsKey(): { apiKey: string | null; provider: MapProviderId; loading: boolean } {
  const q = useQuery({
    queryKey: ['maps-runtime'],
    queryFn: async () => (await api.get<MapsRuntime>('/maps/runtime')).data,
    staleTime: 5 * 60_000,
  });
  // Re-render into Leaflet fallback if Google Maps auth/quota fails mid-session.
  const [failed, setFailed] = useState(googleFailed);
  useEffect(() => {
    if (googleFailed) { setFailed(true); return; }
    const fn = () => setFailed(true);
    failListeners.add(fn);
    return () => { failListeners.delete(fn); };
  }, []);
  return {
    apiKey: failed ? null : q.data?.apiKey ?? null,
    provider: q.data?.provider ?? 'auto',
    loading: q.isLoading,
  };
}

// ---- geofence geo (our stored JSON) <-> lat/lng helpers ----

export function circleOf(g: GeofenceDto): { center: LatLng; radiusM: number } | null {
  if (g.type !== 'CIRCLE') return null;
  const geo = g.geo as { center?: { lat: number; lng: number }; radiusM?: number };
  if (!geo?.center) return null;
  return {
    center: { lat: Number(geo.center.lat), lng: Number(geo.center.lng) },
    radiusM: Number(geo.radiusM) || 0,
  };
}

export function polygonOf(g: GeofenceDto): LatLng[] | null {
  if (g.type !== 'POLYGON') return null;
  const geo = g.geo as { polygon?: [number, number][] };
  if (!Array.isArray(geo?.polygon)) return null;
  return geo.polygon.map((p) => ({ lat: Number(p[0]), lng: Number(p[1]) }));
}
