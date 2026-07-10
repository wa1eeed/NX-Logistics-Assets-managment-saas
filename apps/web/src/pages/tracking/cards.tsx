import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Satellite, Plus, Trash2, CreditCard, KeyRound, Plug, Cpu, SatelliteDish } from 'lucide-react';
import type {
  AssetSummary, CheckoutResult, GeofenceDto, IntegrationRequestDto, TrackingStatusDto,
} from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { StatTile } from '../../components/StatTile';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';

/** Shared live status query — used by every tracking page to gate on activation. */
export function useTrackingStatus() {
  return useQuery({
    queryKey: ['tracking-status'],
    queryFn: async () => (await api.get<TrackingStatusDto>('/tracking/status')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function timeAgo(iso: string, isAr: boolean): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return isAr ? 'الآن' : 'now';
  if (min < 60) return isAr ? `قبل ${min} د` : `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return isAr ? `قبل ${h} س` : `${h}h ago`;
  return isAr ? `قبل ${Math.floor(h / 24)} ي` : `${Math.floor(h / 24)}d ago`;
}

/** Inline success/error banner. */
export function Flash({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={cn('mb-4 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
      {msg.text}
    </div>
  );
}

/** The 4-tile status band (status / quota / devices / per-vehicle price). */
export function StatusBand({ st }: { st: TrackingStatusDto }) {
  const { t } = useTranslation();
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label={t('tracking.statusLabel')} value={st.enabled ? t('tracking.active') : t('tracking.inactive')} icon={Satellite} tint={st.enabled ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground bg-muted'} />
      <StatTile label={t('tracking.quota')} value={`${st.trackedCount} / ${st.vehicleQuota}`} icon={MapPin} tint="text-blue-500 bg-blue-500/10" />
      <StatTile label={t('tracking.devices')} value={st.deviceCount} icon={Cpu} tint="text-violet-500 bg-violet-500/10" />
      <StatTile label={t('tracking.perVehicle')} value={st.perVehiclePrice != null ? `${st.perVehiclePrice} ﷼` : '—'} icon={CreditCard} tint="text-amber-500 bg-amber-500/10" />
    </div>
  );
}

/** Shown on map/devices/geofences pages when the tracking add-on isn't active yet. */
export function TrackingDisabledNotice() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  // Subscribing to the tracking add-on is billing — company admins only. Others
  // are told to contact their admin, without the subscription link.
  const canManage = hasPermission('billing.manage');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><SatelliteDish className="h-7 w-7" /></span>
        <div>
          <p className="font-semibold">{t('tracking.notActive')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{canManage ? t('tracking.notActiveHint') : t('tracking.notActiveHintPm')}</p>
        </div>
        {canManage && <Button asChild><Link to="/tracking/subscription"><Satellite className="h-4 w-4" />{t('tracking.goSubscription')}</Link></Button>}
      </CardContent>
    </Card>
  );
}

export function BuyTrackingCard({ onErr }: { onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState('5');
  const checkout = useMutation({
    mutationFn: async () => (await api.post<CheckoutResult>('/payments/checkout', { purpose: 'TRACKING', vehicleQuota: Math.max(1, Number(qty) || 1) })).data,
    onSuccess: (res) => { window.location.assign(res.redirectUrl); },
    onError: onErr,
  });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Satellite className="h-4 w-4 text-primary" />{t('tracking.buyTitle')}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <p className="w-full text-sm text-muted-foreground">{t('tracking.buyHint')}</p>
        <div className="space-y-1.5"><Label>{t('tracking.vehicles')}</Label><Input type="number" min="1" dir="ltr" className="max-w-[120px]" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <Button disabled={checkout.isPending} onClick={() => checkout.mutate()}><CreditCard className="h-4 w-4" />{t('tracking.buy')}</Button>
      </CardContent>
    </Card>
  );
}

export function RegisterDeviceModal({ onClose, onSaved, onErr }: { onClose: () => void; onSaved: () => void; onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [assetId, setAssetId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [search, setSearch] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const assetsQ = useQuery({ queryKey: ['assets-for-tracking'], queryFn: async () => (await api.get<AssetSummary[]>('/assets')).data });
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (assetsQ.data ?? []).filter((a) => !s || a.code.toLowerCase().includes(s) || (a.manufacturer ?? '').toLowerCase().includes(s)).slice(0, 30);
  }, [assetsQ.data, search]);

  const reg = useMutation({
    mutationFn: async () => (await api.post<{ signingKey: string }>('/tracking/devices', { assetId, externalId })).data,
    onSuccess: (d) => setKey(d.signingKey),
    onError: onErr,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('tracking.registerDevice')}</DialogTitle></DialogHeader>
        {key ? (
          <div className="space-y-3">
            <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t('tracking.deviceCreated')}</div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" />{t('tracking.signingKey')}</Label>
              <Input dir="ltr" readOnly value={key} onFocus={(e) => e.currentTarget.select()} className="font-mono" />
              <p className="text-xs text-amber-600">{t('tracking.signingKeyHint')}</p>
            </div>
            <DialogFooter><Button onClick={onSaved}>{t('common.done')}</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('tracking.asset')}</Label>
              <Input placeholder={t('tracking.searchAsset')} value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filtered.map((a) => (
                  <button key={a.id} type="button" onClick={() => setAssetId(a.id)}
                    className={cn('flex w-full items-center justify-between px-3 py-1.5 text-start text-sm hover:bg-muted/50', assetId === a.id && 'bg-primary/10 text-primary')}>
                    <span className="font-mono">{a.code}</span><span className="text-xs text-muted-foreground">{a.manufacturer}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5"><Label>{t('tracking.externalId')}</Label><Input dir="ltr" value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="GPS-UNIT-001" /></div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
              <Button disabled={reg.isPending || !assetId || !externalId} onClick={() => reg.mutate()}>{reg.isPending ? t('common.saving') : t('tracking.register')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GeofenceCard({ fences, canManage, onChange, onErr }: { fences: GeofenceDto[]; canManage: boolean; onChange: () => void; onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', lat: '', lng: '', radius: '500' });
  const add = useMutation({
    mutationFn: () => api.post('/tracking/geofences', { name: form.name, type: 'CIRCLE', geo: { center: { lat: Number(form.lat), lng: Number(form.lng) }, radiusM: Number(form.radius) } }),
    onSuccess: () => { setForm({ name: '', lat: '', lng: '', radius: '500' }); onChange(); }, onError: onErr,
  });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/tracking/geofences/${id}`), onSuccess: onChange, onError: onErr });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" />{t('tracking.geofences')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {fences.length === 0 && <p className="text-sm text-muted-foreground">{t('tracking.noFences')}</p>}
        {fences.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{g.name} <Badge variant="secondary" className="ms-2">{g.type}</Badge></span>
            {canManage && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        ))}
        {canManage && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="space-y-1"><Label className="text-xs">{t('tracking.fenceName')}</Label><Input className="max-w-[160px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Lat</Label><Input dir="ltr" className="max-w-[110px]" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Lng</Label><Input dir="ltr" className="max-w-[110px]" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('tracking.radiusM')}</Label><Input dir="ltr" className="max-w-[100px]" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} /></div>
            <Button size="sm" disabled={add.isPending || !form.name || !form.lat || !form.lng} onClick={() => add.mutate()}><Plus className="h-3.5 w-3.5" />{t('common.add')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WaslRequestCard({ canManage, onErr }: { canManage: boolean; onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const q = useQuery({ queryKey: ['integrations'], queryFn: async () => (await api.get<IntegrationRequestDto[]>('/integrations')).data });
  const wasl = (q.data ?? []).find((r) => r.type === 'WASL' && !['CANCELLED', 'REJECTED'].includes(r.status));
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['integrations'] });
  const create = useMutation({ mutationFn: () => api.post('/integrations', { type: 'WASL', notes }), onSuccess: () => { setNotes(''); invalidate(); }, onError: onErr });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/integrations/${id}/cancel`), onSuccess: invalidate, onError: onErr });
  const statusVariant: Record<string, 'success' | 'warning' | 'secondary'> = { ACTIVE: 'success', REQUESTED: 'warning', UNDER_REVIEW: 'warning', IN_SETUP: 'warning', CANCELLED: 'secondary', REJECTED: 'secondary' };
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4 text-primary" />{t('wasl.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('wasl.hint')}</p>
        {wasl ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>WASL · <Badge variant={statusVariant[wasl.status]}>{t(`wasl.statuses.${wasl.status}`)}</Badge></span>
            {canManage && !['ACTIVE'].includes(wasl.status) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancel.mutate(wasl.id)}>{t('wasl.cancel')}</Button>}
          </div>
        ) : canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1.5"><Label>{t('wasl.notes')}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button disabled={create.isPending} onClick={() => create.mutate()}><Plug className="h-4 w-4" />{t('wasl.request')}</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">{t('wasl.noRequest')}</p>}
      </CardContent>
    </Card>
  );
}
