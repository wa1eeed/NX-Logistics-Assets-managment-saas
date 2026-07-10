import { useCallback, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Building2, Clock, Truck, User, Package, MapPin } from 'lucide-react';
import type { ConsoleVehicle, ConsoleTask, TrackingConsole, LookupItem, VehicleStatus, GeofenceDto } from '@nx-lam/shared';
import { ConsoleMap } from '../../components/ConsoleMap';
import { ConsoleGoogleMap } from '../../components/maps/ConsoleGoogleMap';
import { useMapsKey } from '../../lib/maps';
import { api, LIVE_REFETCH_MS } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { timeAgo, useTrackingStatus, TrackingDisabledNotice } from './cards';
import { RoutingControl } from './RoutingControl';

type Focus = { lat: number; lng: number } | null;

export function TrackingMapPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [mapFocus, setMapFocus] = useState<Focus>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [taskTab, setTaskTab] = useState<'PENDING' | 'ACTIVE'>('PENDING');
  const [vehicleTab, setVehicleTab] = useState<VehicleStatus>('ACTIVE');
  const [region, setRegion] = useState<string | null>(null); // null = all cities

  const statusQ = useTrackingStatus();
  const consoleQ = useQuery({ queryKey: ['tracking-console'], queryFn: async () => (await api.get<TrackingConsole>('/tracking/console')).data, refetchInterval: LIVE_REFETCH_MS, enabled: !!statusQ.data?.enabled });
  const regionsQ = useQuery({ queryKey: ['lookups', 'REGION'], queryFn: async () => (await api.get<LookupItem[]>('/lookups', { params: { type: 'REGION' } })).data, staleTime: 60_000 });
  const { apiKey } = useMapsKey();
  const fencesQ = useQuery({ queryKey: ['geofences'], queryFn: async () => (await api.get<GeofenceDto[]>('/tracking/geofences')).data, enabled: !!statusQ.data?.enabled });

  // Routing overlay (directions / trail / optimize).
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);
  const [routeGeo, setRouteGeo] = useState<[number, number][] | null>(null);
  const [routePicking, setRoutePicking] = useState(false);
  const onMapClick = useCallback((lat: number, lng: number) => {
    if (routePicking) setRouteWaypoints((w) => [...w, [lat, lng]]);
  }, [routePicking]);

  const st = statusQ.data;
  const cons = consoleQ.data ?? { vehicles: [], tasks: [] };
  // City filter narrows both the map and the side panels.
  const cityVehicles = region ? cons.vehicles.filter((v) => v.region === region) : cons.vehicles;
  const cityTasks = region ? cons.tasks.filter((tk) => tk.region === region) : cons.tasks;
  const tasks = cityTasks.filter((tk) => tk.kind === taskTab);
  const vehicles = cityVehicles.filter((v) => v.status === vehicleTab);
  const taskCounts = { PENDING: cityTasks.filter((tk) => tk.kind === 'PENDING').length, ACTIVE: cityTasks.filter((tk) => tk.kind === 'ACTIVE').length };
  const vehicleCounts = {
    ACTIVE: cityVehicles.filter((v) => v.status === 'ACTIVE').length,
    AVAILABLE: cityVehicles.filter((v) => v.status === 'AVAILABLE').length,
    OFFLINE: cityVehicles.filter((v) => v.status === 'OFFLINE').length,
  };
  const focus = (lat: number | null, lng: number | null) => { if (lat != null && lng != null) setMapFocus({ lat, lng }); };
  const onRegionChange = (r: string | null) => {
    setRegion(r);
    // Recenter the map onto the newly-filtered fleet.
    const list = r ? cons.vehicles.filter((v) => v.region === r) : cons.vehicles;
    const located = list.find((v) => v.lat != null) ?? cityTasks.find((tk) => tk.lat != null);
    if (located?.lat != null) setMapFocus({ lat: located.lat, lng: located.lng as number });
  };

  return (
    // Full-bleed: cancel <main> padding and fill the viewport below the 64px header.
    <div className="relative -m-4 h-[calc(100vh-4rem)] overflow-hidden sm:-m-6">
      <div className="absolute inset-0">
        {apiKey
          ? <ConsoleGoogleMap apiKey={apiKey} vehicles={cityVehicles} tasks={cityTasks} fences={fencesQ.data ?? []} focus={mapFocus} route={routeGeo ?? undefined} waypoints={routePicking ? routeWaypoints : undefined} onMapClick={onMapClick} />
          : <ConsoleMap vehicles={cityVehicles} tasks={cityTasks} fences={fencesQ.data ?? []} focus={mapFocus} route={routeGeo ?? undefined} waypoints={routePicking ? routeWaypoints : undefined} onMapClick={onMapClick} />}
      </div>

      {st?.enabled && (
        <RoutingControl vehicles={cityVehicles} waypoints={routeWaypoints} setWaypoints={setRouteWaypoints} setRoute={setRouteGeo} setPicking={setRoutePicking} />
      )}

      {st && !st.enabled && (
        <div className="absolute inset-0 z-[1200] grid place-items-center bg-background/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md"><TrackingDisabledNotice /></div>
        </div>
      )}

      {st?.enabled && (
        <>
          {/* Top toolbar — city filter + counter chips, floating inside the map (no bar) */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex flex-wrap items-center justify-center gap-2 px-16">
            <CityFilter regions={regionsQ.data ?? []} value={region} onChange={onRegionChange} isAr={isAr} />
            <Chip color="bg-sky-500" label={t('console.vehicle_ACTIVE')} value={vehicleCounts.ACTIVE} />
            <Chip color="bg-emerald-500" label={t('console.vehicle_AVAILABLE')} value={vehicleCounts.AVAILABLE} />
            <Chip color="bg-slate-400" label={t('console.vehicle_OFFLINE')} value={vehicleCounts.OFFLINE} />
            <Chip color="bg-amber-500" label={t('console.task_PENDING')} value={taskCounts.PENDING} />
            <Chip color="bg-violet-500" label={t('console.task_ACTIVE')} value={taskCounts.ACTIVE} />
          </div>

          {/* LEFT — Tasks */}
          <div className={cn('absolute inset-y-0 left-0 z-[1100] flex w-80 max-w-[85vw] flex-col bg-card/95 shadow-xl backdrop-blur transition-transform duration-300', leftOpen ? 'translate-x-0' : '-translate-x-full')}>
            <div className="bg-sky-500 px-4 py-3 font-bold text-white">{t('console.tasks')}</div>
            <div className="flex border-b text-sm">
              {(['PENDING', 'ACTIVE'] as const).map((tab) => (
                <button key={tab} onClick={() => setTaskTab(tab)} className={cn('flex-1 px-2 py-2', taskTab === tab ? 'border-b-2 border-sky-500 font-semibold text-sky-600' : 'text-muted-foreground')}>{t(`console.task_${tab}`)} ({taskCounts[tab]})</button>
              ))}
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {tasks.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t('console.noTasks')}</p>}
              {tasks.map((tk) => <TaskCard key={tk.id} task={tk} isAr={isAr} onClick={() => focus(tk.lat, tk.lng)} />)}
            </div>
          </div>
          <button onClick={() => setLeftOpen((o) => !o)} aria-label="toggle tasks"
            className={cn('absolute top-1/2 z-[1101] grid h-10 w-7 -translate-y-1/2 place-items-center rounded-e-lg border bg-card shadow-md transition-all duration-300', leftOpen ? 'left-80' : 'left-0')}>
            {leftOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* RIGHT — Vehicles (the GPS unit is on the vehicle, so vehicles are tracked) */}
          <div className={cn('absolute inset-y-0 right-0 z-[1100] flex w-80 max-w-[85vw] flex-col bg-card/95 shadow-xl backdrop-blur transition-transform duration-300', rightOpen ? 'translate-x-0' : 'translate-x-full')}>
            <div className="bg-primary px-4 py-3 font-bold text-primary-foreground">{t('console.vehicles')}</div>
            <div className="flex border-b text-xs">
              {(['ACTIVE', 'AVAILABLE', 'OFFLINE'] as const).map((tab) => (
                <button key={tab} onClick={() => setVehicleTab(tab)} className={cn('flex-1 px-1.5 py-2', vehicleTab === tab ? 'border-b-2 border-primary font-semibold text-primary' : 'text-muted-foreground')}>{t(`console.vehicle_${tab}`)} ({vehicleCounts[tab]})</button>
              ))}
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {vehicles.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t('console.noVehicles')}</p>}
              {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} isAr={isAr} onClick={() => focus(v.lat, v.lng)} />)}
            </div>
          </div>
          <button onClick={() => setRightOpen((o) => !o)} aria-label="toggle vehicles"
            className={cn('absolute top-1/2 z-[1101] grid h-10 w-7 -translate-y-1/2 place-items-center rounded-s-lg border bg-card shadow-md transition-all duration-300', rightOpen ? 'right-80' : 'right-0')}>
            {rightOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </>
      )}
    </div>
  );
}

function Chip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

function DetailRow({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

const VEHICLE_AVATAR: Record<VehicleStatus, string> = { ACTIVE: 'bg-sky-500', AVAILABLE: 'bg-emerald-500', OFFLINE: 'bg-slate-400' };
const VEHICLE_BADGE: Record<VehicleStatus, string> = { ACTIVE: 'bg-sky-500/10 text-sky-600', AVAILABLE: 'bg-emerald-500/10 text-emerald-600', OFFLINE: 'bg-muted text-muted-foreground' };

function VehicleCard({ vehicle, isAr, onClick }: { vehicle: ConsoleVehicle; isAr: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} disabled={vehicle.lat == null}
      className={cn('block w-full rounded-xl border bg-card p-3 text-start shadow-sm transition-shadow', vehicle.lat != null ? 'hover:shadow-md' : 'cursor-default opacity-90')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white', VEHICLE_AVATAR[vehicle.status])}><Truck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono font-semibold">{vehicle.code}</div>
          <div className="truncate text-xs text-muted-foreground">{vehicle.name}</div>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', VEHICLE_BADGE[vehicle.status])}>{t(`console.vehicle_${vehicle.status}`)}</span>
      </div>
      <div className="mt-2.5 space-y-1.5 border-t pt-2.5">
        <DetailRow icon={Building2}><span className="text-muted-foreground">{t('console.project')}:</span> <span className="font-medium">{vehicle.projectName ?? t('console.noTask')}</span></DetailRow>
        <DetailRow icon={User}><span className="text-muted-foreground">{t('console.assignedDriver')}:</span> <span className="font-medium">{vehicle.driverName ?? t('console.unassigned')}</span></DetailRow>
        <DetailRow icon={MapPin}><span className="text-muted-foreground">{t('assets.region')}:</span> <span className="font-medium">{vehicle.region ?? '—'}</span></DetailRow>
        <DetailRow icon={Clock}><span className="text-muted-foreground">{t('tracking.lastSeen')}:</span> <span className="font-medium">{vehicle.lastSeenAt ? timeAgo(vehicle.lastSeenAt, isAr) : t('tracking.never')}</span></DetailRow>
      </div>
    </button>
  );
}

function CityFilter({ regions, value, onChange, isAr }: { regions: LookupItem[]; value: string | null; onChange: (r: string | null) => void; isAr: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto">
      <Select value={value ?? '__all__'} onValueChange={(v) => onChange(v === '__all__' ? null : v)}>
        <SelectTrigger className="h-8 gap-1.5 rounded-full border bg-card/90 px-3 text-xs font-medium shadow-sm backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('console.allCities')}</SelectItem>
          {regions.map((r) => <SelectItem key={r.id} value={r.value}>{isAr ? (r.labelAr || r.labelEn) : r.labelEn}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TaskCard({ task, isAr, onClick }: { task: ConsoleTask; isAr: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const pending = task.kind === 'PENDING';
  return (
    <button onClick={onClick} disabled={task.lat == null}
      className={cn('block w-full rounded-xl border bg-card p-3 text-start shadow-sm transition-shadow', task.lat != null ? 'hover:shadow-md' : 'cursor-default')}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-muted-foreground">{task.ref}</span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', pending ? 'bg-sky-500/10 text-sky-600' : 'bg-violet-500/10 text-violet-600')}>{t(`console.task_${task.kind}`)}</span>
      </div>
      <div className="mt-1 truncate font-semibold">{pending ? (task.itemLabel ?? task.title) : (task.assetCode ?? task.title)}</div>
      <div className="mt-2 space-y-1.5 border-t pt-2">
        <DetailRow icon={Building2}><span className="text-muted-foreground">{t('console.project')}:</span> <span className="font-medium">{task.projectName ?? '—'}</span></DetailRow>
        {pending ? (
          <DetailRow icon={Package}><span className="text-muted-foreground">{t('console.requestedType')}:</span> <span className="font-medium">{task.itemLabel ?? '—'}</span></DetailRow>
        ) : (
          <>
            <DetailRow icon={Truck}><span className="text-muted-foreground">{t('console.equipment')}:</span> <span className="font-medium">{task.assetCode ?? '—'}</span></DetailRow>
            <DetailRow icon={User}><span className="text-muted-foreground">{t('console.assignedDriver')}:</span> <span className="font-medium">{task.driverName ?? t('console.unassigned')}</span></DetailRow>
          </>
        )}
        <DetailRow icon={Clock}><span className="text-muted-foreground">{pending ? t('console.sinceRequest') : t('console.sinceStart')}:</span> <span className="font-medium">{task.date ? timeAgo(task.date, isAr) : '—'}</span></DetailRow>
      </div>
    </button>
  );
}
