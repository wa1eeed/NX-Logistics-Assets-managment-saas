import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Route, Navigation, Sparkles, X, Loader2 } from 'lucide-react';
import type { AssetTrail, ConsoleVehicle, OptimizeResult, RouteResult } from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { Button } from '../../components/ui/button';

type Mode = 'directions' | 'optimize' | 'trail';

/** Floating routing panel over the tracking map — directions, trip trail, optimization (via ORS). */
export function RoutingControl({ vehicles, waypoints, setWaypoints, setRoute, setPicking }: {
  vehicles: ConsoleVehicle[];
  waypoints: [number, number][];
  setWaypoints: Dispatch<SetStateAction<[number, number][]>>;
  setRoute: (r: [number, number][] | null) => void;
  setPicking: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');

  const reset = () => { setWaypoints([]); setRoute(null); setInfo(null); setErr(null); setPicking(false); };
  const pick = (m: Mode) => { reset(); setMode(m); if (m !== 'trail') setPicking(true); };
  const fmt = (r: RouteResult) => `${(r.distanceM / 1000).toFixed(1)} ${t('routing.km')} · ${Math.round(r.durationS / 60)} ${t('routing.min')}`;

  const directions = useMutation({
    mutationFn: async () => (await api.post<RouteResult>('/routing/directions', { coordinates: waypoints })).data,
    onSuccess: (r) => { setRoute(r.geometry); setInfo(fmt(r)); setPicking(false); },
    onError: (e) => setErr(extractApiError(e)),
  });
  const optimize = useMutation({
    mutationFn: async () => (await api.post<OptimizeResult>('/routing/optimize', { start: waypoints[0], stops: waypoints.slice(1) })).data,
    onSuccess: (r) => { setRoute(r.geometry); setInfo(`${fmt(r)} · ${t('routing.order')}: ${r.order.map((i) => i + 2).join('→')}`); setPicking(false); },
    onError: (e) => setErr(extractApiError(e)),
  });
  const trail = useMutation({
    mutationFn: async () => (await api.get<AssetTrail>(`/tracking/assets/${vehicleId}/trail`, { params: { hours: 24 } })).data,
    onSuccess: (r) => {
      const g = r.points.map((p) => [p.lat, p.lng] as [number, number]);
      setRoute(g.length > 1 ? g : null);
      setInfo(g.length > 1 ? `${g.length} ${t('routing.points')}` : t('routing.noTrail'));
    },
    onError: (e) => setErr(extractApiError(e)),
  });

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[600] w-[min(92vw,440px)] -translate-x-1/2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant={mode === 'directions' ? 'default' : 'outline'} onClick={() => pick('directions')}><Navigation className="h-3.5 w-3.5" />{t('routing.directions')}</Button>
        <Button size="sm" variant={mode === 'optimize' ? 'default' : 'outline'} onClick={() => pick('optimize')}><Sparkles className="h-3.5 w-3.5" />{t('routing.optimize')}</Button>
        <Button size="sm" variant={mode === 'trail' ? 'default' : 'outline'} onClick={() => pick('trail')}><Route className="h-3.5 w-3.5" />{t('routing.trail')}</Button>
        {mode && <Button size="sm" variant="ghost" className="ms-auto" onClick={() => { reset(); setMode(null); }}><X className="h-3.5 w-3.5" /></Button>}
      </div>

      {mode === 'directions' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('routing.clickPoints')} · {waypoints.length}</span>
          <Button size="sm" disabled={waypoints.length < 2 || directions.isPending} onClick={() => directions.mutate()}>{directions.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('routing.draw')}</Button>
          <Button size="sm" variant="ghost" onClick={reset}>{t('routing.clear')}</Button>
        </div>
      )}
      {mode === 'optimize' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('routing.clickStops')} · {waypoints.length}</span>
          <Button size="sm" disabled={waypoints.length < 2 || optimize.isPending} onClick={() => optimize.mutate()}>{optimize.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('routing.optimizeBtn')}</Button>
          <Button size="sm" variant="ghost" onClick={reset}>{t('routing.clear')}</Button>
        </div>
      )}
      {mode === 'trail' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className="rounded-md border bg-background px-2 py-1 text-sm" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">{t('routing.selectVehicle')}</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
          </select>
          <Button size="sm" disabled={!vehicleId || trail.isPending} onClick={() => trail.mutate()}>{trail.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('routing.show')}</Button>
          <Button size="sm" variant="ghost" onClick={reset}>{t('routing.clear')}</Button>
        </div>
      )}

      {info && <p className="mt-2 text-sm font-medium text-primary">{info}</p>}
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
