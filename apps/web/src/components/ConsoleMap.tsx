import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ConsoleVehicle, ConsoleTask, GeofenceDto } from '@nx-lam/shared';
import { circleOf, polygonOf } from '../lib/maps';

function vehicleIcon(status: ConsoleVehicle['status']): L.DivIcon {
  const c = status === 'ACTIVE' ? '#0ea5e9' : status === 'AVAILABLE' ? '#10b981' : '#94a3b8';
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10],
  });
}
function taskIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#8b5cf6;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 20], popupAnchor: [0, -18],
  });
}

function FocusController({ focus }: { focus: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [focus, map]);
  // Leaflet needs a size recalc when its container mounts inside flex/overlay layouts.
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 200); return () => clearTimeout(t); }, [map]);
  return null;
}

function ClickCapture({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

const wpIcon = (n: number): L.DivIcon => L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#f59e0b;color:#fff;font:600 11px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">${n}</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

export function ConsoleMap({ vehicles, tasks, focus, fences, route, waypoints, onMapClick }: {
  vehicles: ConsoleVehicle[];
  tasks: ConsoleTask[];
  focus: { lat: number; lng: number } | null;
  fences?: GeofenceDto[];
  route?: [number, number][];
  waypoints?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const vLoc = vehicles.filter((v) => v.lat != null && v.lng != null);
  const tLoc = tasks.filter((t) => t.lat != null && t.lng != null);
  const first = vLoc[0] ?? tLoc[0];
  const center: [number, number] = first?.lat != null ? [first.lat as number, first.lng as number] : [24.7136, 46.6753];

  return (
    <MapContainer center={center} zoom={vLoc.length || tLoc.length ? 11 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl={false}>
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FocusController focus={focus} />
      <ClickCapture onMapClick={onMapClick} />
      {(fences ?? []).map((f) => {
        const c = circleOf(f);
        if (c) return <Circle key={f.id} center={[c.center.lat, c.center.lng]} radius={c.radiusM} pathOptions={{ color: '#0ea5e9', weight: 1.5, fillOpacity: 0.08 }} />;
        const p = polygonOf(f);
        if (p) return <Polygon key={f.id} positions={p.map((pt) => [pt.lat, pt.lng])} pathOptions={{ color: '#0ea5e9', weight: 1.5, fillOpacity: 0.08 }} />;
        return null;
      })}
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#f59e0b', weight: 5, opacity: 0.9 }} />}
      {(waypoints ?? []).map(([lat, lng], i) => <Marker key={`wp-${i}`} position={[lat, lng]} icon={wpIcon(i + 1)} />)}
      {vLoc.map((v) => (
        <Marker key={`v-${v.id}`} position={[v.lat as number, v.lng as number]} icon={vehicleIcon(v.status)}>
          <Popup><strong>{v.code}</strong><br />{v.name}<br />{v.driverName ?? ''}<br /><span style={{ color: '#666', fontSize: 12 }}>{v.lastSeenAt ? new Date(v.lastSeenAt).toLocaleString() : ''}</span></Popup>
        </Marker>
      ))}
      {tLoc.map((t) => (
        <Marker key={`t-${t.id}`} position={[t.lat as number, t.lng as number]} icon={taskIcon()}>
          <Popup><strong>{t.title}</strong><br />{t.subtitle ?? ''}<br /><span style={{ color: '#666', fontSize: 12 }}>{t.ref}</span></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
