import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Circle, Polygon } from '@react-google-maps/api';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Trash2, Circle as CircleIcon, Hexagon, X, Check } from 'lucide-react';
import type { GeofenceDto } from '@nx-lam/shared';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { DEFAULT_MAP_CENTER, GOOGLE_MAPS_LIBRARIES, circleOf, polygonOf, markGoogleMapsFailed } from '../../lib/maps';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

type Pending =
  | { type: 'CIRCLE'; geo: { center: { lat: number; lng: number }; radiusM: number } }
  | { type: 'POLYGON'; geo: { polygon: [number, number][] } };

const FENCE_STYLE = { fillColor: '#0ea5e9', fillOpacity: 0.12, strokeColor: '#0ea5e9', strokeWeight: 2, clickable: true } as const;
const SELECTED_STYLE = { ...FENCE_STYLE, fillOpacity: 0.25, strokeWeight: 3 } as const;
const PENDING_STYLE = { fillColor: '#8b5cf6', fillOpacity: 0.2, strokeColor: '#8b5cf6', strokeWeight: 2, clickable: false } as const;

/**
 * Interactive geofence editor on Google Maps — draw a circle (click centre, drag
 * radius) or a polygon (click vertices, double-click to close), name it, save.
 * Existing fences render as overlays; click one to select, then delete.
 */
export function GeofenceEditor({ apiKey, fences, canManage, onChange, onErr }: {
  apiKey: string;
  fences: GeofenceDto[];
  canManage: boolean;
  onChange: () => void;
  onErr: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const { isLoaded, loadError } = useJsApiLoader({ id: 'nxlam-gmaps', googleMapsApiKey: apiKey, libraries: GOOGLE_MAPS_LIBRARIES });
  useEffect(() => { if (loadError) markGoogleMapsFailed(); }, [loadError]);
  const [mode, setMode] = useState<'idle' | 'CIRCLE' | 'POLYGON'>('idle');
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (p: Pending & { name: string }) => api.post('/tracking/geofences', { name: p.name, type: p.type, geo: p.geo }),
    onSuccess: () => { setPending(null); setName(''); onChange(); },
    onError: onErr,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tracking/geofences/${id}`),
    onSuccess: () => { setSelected(null); onChange(); },
    onError: onErr,
  });

  const center = useMemo(() => {
    const c = fences.map(circleOf).find(Boolean);
    if (c) return c.center;
    const p = fences.map(polygonOf).find(Boolean);
    if (p && p[0]) return p[0];
    return DEFAULT_MAP_CENTER;
  }, [fences]);

  const onCircle = useCallback((circle: google.maps.Circle) => {
    const c = circle.getCenter();
    if (c) setPending({ type: 'CIRCLE', geo: { center: { lat: c.lat(), lng: c.lng() }, radiusM: Math.round(circle.getRadius()) } });
    circle.setMap(null);
    setMode('idle');
  }, []);
  const onPolygon = useCallback((poly: google.maps.Polygon) => {
    const path = poly.getPath().getArray().map((pt) => [pt.lat(), pt.lng()] as [number, number]);
    poly.setMap(null);
    if (path.length >= 3) setPending({ type: 'POLYGON', geo: { polygon: path } });
    setMode('idle');
  }, []);

  if (!isLoaded) {
    return <div className="flex h-[460px] items-center justify-center rounded-lg border text-sm text-muted-foreground">{t('common.loading')}…</div>;
  }

  const drawingMode =
    mode === 'CIRCLE' ? google.maps.drawing.OverlayType.CIRCLE
    : mode === 'POLYGON' ? google.maps.drawing.OverlayType.POLYGON
    : null;

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {!pending ? (
            <>
              <span className="text-sm text-muted-foreground">{t('tracking.drawHint')}</span>
              <Button size="sm" variant={mode === 'CIRCLE' ? 'default' : 'outline'} onClick={() => setMode(mode === 'CIRCLE' ? 'idle' : 'CIRCLE')}>
                <CircleIcon className="h-3.5 w-3.5" />{t('tracking.drawCircle')}
              </Button>
              <Button size="sm" variant={mode === 'POLYGON' ? 'default' : 'outline'} onClick={() => setMode(mode === 'POLYGON' ? 'idle' : 'POLYGON')}>
                <Hexagon className="h-3.5 w-3.5" />{t('tracking.drawPolygon')}
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{pending.type === 'CIRCLE' ? t('tracking.typeCircle') : t('tracking.typePolygon')}</Badge>
              <Input autoFocus className="max-w-[200px]" placeholder={t('tracking.fenceName')} value={name} onChange={(e) => setName(e.target.value)} />
              <Button size="sm" disabled={!name.trim() || add.isPending} onClick={() => add.mutate({ ...pending, name: name.trim() })}>
                <Check className="h-3.5 w-3.5" />{t('common.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPending(null); setName(''); }}>
                <X className="h-3.5 w-3.5" />{t('common.cancel')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="h-[460px] w-full overflow-hidden rounded-lg border">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={fences.length ? 11 : 6}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {canManage && (
            <DrawingManager
              drawingMode={drawingMode}
              options={{ drawingControl: false, circleOptions: PENDING_STYLE, polygonOptions: PENDING_STYLE }}
              onCircleComplete={onCircle}
              onPolygonComplete={onPolygon}
            />
          )}
          {fences.map((f) => {
            const c = circleOf(f);
            if (c) return <Circle key={f.id} center={c.center} radius={c.radiusM} options={selected === f.id ? SELECTED_STYLE : FENCE_STYLE} onClick={() => setSelected(f.id)} />;
            const p = polygonOf(f);
            if (p) return <Polygon key={f.id} paths={p} options={selected === f.id ? SELECTED_STYLE : FENCE_STYLE} onClick={() => setSelected(f.id)} />;
            return null;
          })}
          {pending?.type === 'CIRCLE' && <Circle center={pending.geo.center} radius={pending.geo.radiusM} options={PENDING_STYLE} />}
          {pending?.type === 'POLYGON' && <Polygon paths={pending.geo.polygon.map(([lat, lng]) => ({ lat, lng }))} options={PENDING_STYLE} />}
        </GoogleMap>
      </div>

      <div className="space-y-2">
        {fences.length === 0 && <p className="text-sm text-muted-foreground">{t('tracking.noFences')}</p>}
        {fences.map((g) => (
          <div
            key={g.id}
            className={cn('flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm', selected === g.id && 'ring-2 ring-primary')}
            onClick={() => setSelected(g.id)}
          >
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{g.name} <Badge variant="secondary">{g.type}</Badge></span>
            {canManage && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); del.mutate(g.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
