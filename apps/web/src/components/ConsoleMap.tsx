import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ConsoleVehicle, ConsoleTask } from '@nx-lam/shared';

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

export function ConsoleMap({ vehicles, tasks, focus }: { vehicles: ConsoleVehicle[]; tasks: ConsoleTask[]; focus: { lat: number; lng: number } | null }) {
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
