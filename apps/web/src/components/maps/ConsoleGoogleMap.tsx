import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle, Polygon } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import type { ConsoleVehicle, ConsoleTask, GeofenceDto } from '@nx-lam/shared';
import { DEFAULT_MAP_CENTER, GOOGLE_MAPS_LIBRARIES, circleOf, polygonOf } from '../../lib/maps';

const FENCE_STYLE = { fillColor: '#0ea5e9', fillOpacity: 0.08, strokeColor: '#0ea5e9', strokeWeight: 1.5, clickable: false } as const;

/** Live tracking map on Google Maps — vehicles + tasks as markers, geofences as overlays. */
export function ConsoleGoogleMap({ apiKey, vehicles, tasks, fences, focus }: {
  apiKey: string;
  vehicles: ConsoleVehicle[];
  tasks: ConsoleTask[];
  fences?: GeofenceDto[];
  focus: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const { isLoaded } = useJsApiLoader({ id: 'nxlam-gmaps', googleMapsApiKey: apiKey, libraries: GOOGLE_MAPS_LIBRARIES });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [open, setOpen] = useState<{ kind: 'v' | 't'; id: string } | null>(null);

  const vLoc = useMemo(() => vehicles.filter((v) => v.lat != null && v.lng != null), [vehicles]);
  const tLoc = useMemo(() => tasks.filter((t) => t.lat != null && t.lng != null), [tasks]);
  const first = vLoc[0] ?? tLoc[0];

  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.panTo(focus);
      if ((mapRef.current.getZoom() ?? 0) < 13) mapRef.current.setZoom(13);
    }
  }, [focus]);

  if (!isLoaded) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">{t('common.loading')}…</div>;
  }

  const vehicleIcon = (status: ConsoleVehicle['status']): google.maps.Symbol => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: status === 'ACTIVE' ? '#0ea5e9' : status === 'AVAILABLE' ? '#10b981' : '#94a3b8',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  });
  const taskIcon: google.maps.Symbol = {
    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 4.5, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1,
  };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={first ? { lat: first.lat as number, lng: first.lng as number } : DEFAULT_MAP_CENTER}
      zoom={vLoc.length || tLoc.length ? 11 : 6}
      onLoad={(m) => { mapRef.current = m; }}
      onUnmount={() => { mapRef.current = null; }}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {(fences ?? []).map((f) => {
        const c = circleOf(f);
        if (c) return <Circle key={f.id} center={c.center} radius={c.radiusM} options={FENCE_STYLE} />;
        const p = polygonOf(f);
        if (p) return <Polygon key={f.id} paths={p} options={FENCE_STYLE} />;
        return null;
      })}

      {vLoc.map((v) => (
        <Marker key={`v-${v.id}`} position={{ lat: v.lat as number, lng: v.lng as number }} icon={vehicleIcon(v.status)} title={`${v.code} — ${v.name}`} onClick={() => setOpen({ kind: 'v', id: v.id })}>
          {open?.kind === 'v' && open.id === v.id && (
            <InfoWindow onCloseClick={() => setOpen(null)}>
              <div style={{ minWidth: 140 }}>
                <strong>{v.code}</strong><br />{v.name}<br />{v.driverName ?? ''}
                <div style={{ color: '#666', fontSize: 12 }}>{v.lastSeenAt ? new Date(v.lastSeenAt).toLocaleString() : ''}</div>
              </div>
            </InfoWindow>
          )}
        </Marker>
      ))}

      {tLoc.map((t2) => (
        <Marker key={`t-${t2.id}`} position={{ lat: t2.lat as number, lng: t2.lng as number }} icon={taskIcon} title={t2.title} onClick={() => setOpen({ kind: 't', id: t2.id })}>
          {open?.kind === 't' && open.id === t2.id && (
            <InfoWindow onCloseClick={() => setOpen(null)}>
              <div style={{ minWidth: 140 }}>
                <strong>{t2.title}</strong><br />{t2.subtitle ?? ''}
                <div style={{ color: '#666', fontSize: 12 }}>{t2.ref}</div>
              </div>
            </InfoWindow>
          )}
        </Marker>
      ))}
    </GoogleMap>
  );
}
