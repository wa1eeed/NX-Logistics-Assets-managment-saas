import type { ComponentType } from 'react';
import type { ConsoleVehicle, ConsoleTask, GeofenceDto } from '@nx-lam/shared';
import { useMapsKey } from '../../lib/maps';
import { ConsoleGoogleMap } from './ConsoleGoogleMap';
import { ConsoleMap } from '../ConsoleMap';

/**
 * Provider-agnostic map surface. Every page renders <MapView/> and never a specific
 * provider component — switching Google ⇄ OpenStreetMap (or adding a new provider)
 * happens entirely behind this boundary, driven by the platform's provider setting
 * plus availability. No application/page code changes to add a provider.
 */
export interface MapViewProps {
  vehicles: ConsoleVehicle[];
  tasks: ConsoleTask[];
  fences?: GeofenceDto[];
  focus: { lat: number; lng: number } | null;
  route?: [number, number][];
  waypoints?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
}

/** Runtime signals a provider may need to decide whether it can render. */
interface MapRuntimeState {
  apiKey: string | null;
}

interface MapProviderDef {
  id: 'google' | 'osm';
  labelKey: string;
  /** Can this provider render given the current runtime? (pure — no hooks) */
  available: (rt: MapRuntimeState) => boolean;
  Component: ComponentType<MapViewProps>;
}

// ── Google Maps ── (reads its own key; only selected when a key is available)
function GoogleMapView(props: MapViewProps) {
  const { apiKey } = useMapsKey();
  if (!apiKey) return null;
  return <ConsoleGoogleMap apiKey={apiKey} {...props} />;
}

/**
 * Provider registry — ordered by default preference. To add a provider (e.g. Mapbox):
 * implement a component with MapViewProps and push an entry here. Nothing else changes.
 */
export const MAP_PROVIDERS: MapProviderDef[] = [
  { id: 'google', labelKey: 'maps.providerGoogle', available: (rt) => rt.apiKey != null, Component: GoogleMapView },
  { id: 'osm', labelKey: 'maps.providerOsm', available: () => true, Component: ConsoleMap },
];

/** Resolve the active provider from the admin preference, falling back by availability. */
export function useActiveMapProvider(): MapProviderDef {
  const { apiKey, provider } = useMapsKey();
  const rt: MapRuntimeState = { apiKey };
  const preferred = MAP_PROVIDERS.find((p) => p.id === provider && p.available(rt));
  if (preferred) return preferred;
  return MAP_PROVIDERS.find((p) => p.available(rt)) ?? MAP_PROVIDERS[MAP_PROVIDERS.length - 1];
}

/** The single map component the app renders — provider chosen behind this boundary. */
export function MapView(props: MapViewProps) {
  const Provider = useActiveMapProvider().Component;
  return <Provider {...props} />;
}
