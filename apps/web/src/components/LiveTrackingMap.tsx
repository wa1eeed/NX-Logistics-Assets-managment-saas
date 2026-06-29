import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackedAssetDto } from '@nx-lam/shared';

export type TrackStatus = 'MOVING' | 'IDLE' | 'OFFLINE';

const STATUS_COLOR: Record<TrackStatus, string> = { MOVING: '#10b981', IDLE: '#f59e0b', OFFLINE: '#94a3b8' };

/** Live status from the last ping: moving (recent + speed), idle (recent), offline (stale/never). */
export function statusOf(a: TrackedAssetDto): TrackStatus {
  if (!a.lastSeenAt) return 'OFFLINE';
  const ageMin = (Date.now() - new Date(a.lastSeenAt).getTime()) / 60000;
  if (ageMin > 15) return 'OFFLINE';
  if ((a.speed ?? 0) > 0 && ageMin <= 5) return 'MOVING';
  return 'IDLE';
}

function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'nx-pin',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

/** Pans/zooms to the focused asset when it changes. */
function FocusController({ focus }: { focus: TrackedAssetDto | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.lastLat != null && focus.lastLng != null) {
      map.flyTo([focus.lastLat, focus.lastLng], Math.max(map.getZoom(), 13), { duration: 0.6 });
    }
  }, [focus, map]);
  return null;
}

export function LiveTrackingMap({ assets, focus }: { assets: TrackedAssetDto[]; focus: TrackedAssetDto | null }) {
  const located = assets.filter((a) => a.lastLat != null && a.lastLng != null);
  // Default center: first located asset, else Riyadh.
  const center: [number, number] = located[0]?.lastLat != null
    ? [located[0].lastLat as number, located[0].lastLng as number]
    : [24.7136, 46.6753];

  return (
    <MapContainer center={center} zoom={located.length ? 11 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusController focus={focus} />
      {located.map((a) => {
        const st = statusOf(a);
        return (
          <Marker key={a.assetId} position={[a.lastLat as number, a.lastLng as number]} icon={pinIcon(STATUS_COLOR[st])}>
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong>{a.code}</strong><br />
                <span style={{ color: '#666' }}>{a.name}</span><br />
                {a.speed != null && <>Speed: {Math.round(a.speed)} km/h<br /></>}
                {a.lastSeenAt && <span style={{ color: '#666', fontSize: 12 }}>{new Date(a.lastSeenAt).toLocaleString()}</span>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
