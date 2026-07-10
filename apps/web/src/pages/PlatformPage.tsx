import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Pause, Play, SlidersHorizontal, LogIn, Users, HardDrive, Boxes, DollarSign, Activity, CreditCard, CheckCircle2, XCircle, Ban, Layers, Pencil, MapPinned } from 'lucide-react';
import {
  MODULE_LABELS, PLATFORM_MODULES, INTEGRATION_STATUSES, type PlatformModule,
  type LoginResponse, type PaymentGatewaySettings, type PlanDto, type InvoiceSeller, type IntegrationRequestDto, type IntegrationStatus,
  type PlatformAuditItem, type PlatformOverview, type PlatformTenantSummary, type MapsGatewaySettings,
} from '@nx-lam/shared';
import { api, extractApiError, tokenStore, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PlatformStorageCard } from './SettingsPage';

const GiB = 1024 * 1024 * 1024;
function fmtBytes(b: number): string {
  if (!b) return '0';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const v = b / Math.pow(1024, i); return `${v % 1 === 0 ? v : v.toFixed(1)} ${u[i]}`;
}
const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { ACTIVE: 'success', TRIAL: 'warning', SUSPENDED: 'destructive', CANCELED: 'secondary' };

export function PlatformPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const canManage = hasPermission('platform.tenants.manage');
  const canImpersonate = hasPermission('platform.impersonate');
  const canBilling = hasPermission('entitlements.manage');
  const canPayments = hasPermission('payments.manage');
  const canMaps = hasPermission('maps.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlatformTenantSummary | null>(null);

  const q = useQuery({ queryKey: ['platform-overview'], queryFn: async () => (await api.get<PlatformOverview>('/platform/overview')).data, refetchInterval: LIVE_REFETCH_MS });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['platform-overview'] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED' }) => api.patch(`/platform/tenants/${id}/status`, { status }),
    onSuccess: invalidate, onError: (e) => alert(extractApiError(e)),
  });
  const impersonate = useMutation({
    mutationFn: async (id: string) => (await api.post<LoginResponse>(`/platform/tenants/${id}/impersonate`)).data,
    onSuccess: (data) => { tokenStore.set(data.accessToken, data.refreshToken); window.location.assign('/'); },
    onError: (e) => alert(extractApiError(e)),
  });

  const totals = q.data?.totals;

  return (
    <div>
      <PageHeader title={t('platform.title')} subtitle={t('platform.subtitle')}
        action={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('platform.newTenant')}</Button>} />

      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatTile label={t('platform.mrr')} value={`${new Intl.NumberFormat('en-US').format(totals.estimatedMrr)} ﷼`} icon={DollarSign} tint="text-emerald-500 bg-emerald-500/10" valueClass="text-emerald-600" />
          <StatTile label={t('platform.tenants')} value={totals.tenants} icon={Building2} tint="text-teal-500 bg-teal-500/10" />
          <StatTile label={t('platform.active')} value={totals.activeTenants} icon={Play} tint="text-emerald-500 bg-emerald-500/10" />
          <StatTile label={t('platform.totalUsers')} value={totals.users} icon={Users} tint="text-blue-500 bg-blue-500/10" />
          <StatTile label={t('platform.totalAssets')} value={totals.assets} icon={Boxes} tint="text-violet-500 bg-violet-500/10" />
          <StatTile label={t('platform.totalStorage')} value={fmtBytes(totals.storageBytes)} icon={HardDrive} tint="text-amber-500 bg-amber-500/10" />
        </div>
      )}

      <Card className="mb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('platform.code')}</TableHead>
              <TableHead>{t('platform.company')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('platform.plan')}</TableHead>
              <TableHead>{t('platform.usersCol')}</TableHead>
              <TableHead>{t('platform.assetsCol')}</TableHead>
              <TableHead>{t('platform.storageCol')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={8}>{t('common.loading')}</TableEmpty>}
            {q.data?.tenants.length === 0 && <TableEmpty colSpan={8}>{t('platform.noTenants')}</TableEmpty>}
            {q.data?.tenants.map((tn) => (
              <TableRow key={tn.id}>
                <TableCell className="font-mono font-semibold">{tn.code}</TableCell>
                <TableCell>{tn.name}<span className="block text-xs text-muted-foreground" dir="ltr">{tn.slug}</span></TableCell>
                <TableCell><Badge variant={statusVariant[tn.status]}>{t(`saas.status.${tn.status}`)}</Badge></TableCell>
                <TableCell>{tn.planName}</TableCell>
                <TableCell className="tabular-nums" dir="ltr">{tn.userCount}/{tn.maxUserCount}</TableCell>
                <TableCell className="tabular-nums">{tn.assetCount}</TableCell>
                <TableCell className="tabular-nums text-xs" dir="ltr">{fmtBytes(tn.storageBytes)} / {fmtBytes(tn.maxStorageBytes)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canBilling && <Button variant="outline" size="sm" onClick={() => setEditing(tn)}><SlidersHorizontal className="h-3.5 w-3.5" />{t('platform.editPlan')}</Button>}
                    {canManage && (tn.status === 'SUSPENDED' || tn.status === 'CANCELED') && (
                      <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ id: tn.id, status: 'ACTIVE' })}><Play className="h-3.5 w-3.5" />{t('platform.activate')}</Button>
                    )}
                    {canManage && (tn.status === 'ACTIVE' || tn.status === 'TRIAL') && (
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => { if (await confirm({ title: t('platform.suspend'), description: t('platform.confirmSuspend', { name: tn.name }), destructive: true, confirmText: t('platform.suspend') })) setStatus.mutate({ id: tn.id, status: 'SUSPENDED' }); }}>
                        <Pause className="h-3.5 w-3.5" />{t('platform.suspend')}</Button>
                    )}
                    {canManage && tn.status !== 'CANCELED' && (
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => { if (await confirm({ title: t('platform.cancel'), description: t('platform.confirmCancel', { name: tn.name }), destructive: true, confirmText: t('platform.cancel') })) setStatus.mutate({ id: tn.id, status: 'CANCELED' }); }}>
                        <Ban className="h-3.5 w-3.5" />{t('platform.cancel')}</Button>
                    )}
                    {canImpersonate && (tn.status === 'ACTIVE' || tn.status === 'TRIAL') && (
                      <Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: t('platform.impersonate'), description: t('platform.confirmImpersonate', { name: tn.name }), confirmText: t('platform.impersonate') })) impersonate.mutate(tn.id); }}>
                        <LogIn className="h-3.5 w-3.5" />{t('platform.impersonate')}</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mb-5"><PlatformActivityCard /></div>

      <div className="mb-5"><PlatformIntegrationsCard /></div>

      {canBilling && <div className="mb-5"><PlatformPlansCard /></div>}

      {canPayments && <div className="mb-5"><PlatformPaymentsCard /></div>}

      {canMaps && <div className="mb-5"><PlatformMapsCard /></div>}

      {canPayments && <div className="mb-5"><PlatformSellerCard /></div>}

      {canBilling && <PlatformStorageCard />}

      {creating && <CreateTenantModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); invalidate(); }} />}
      {editing && <EditPlanModal tenant={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
    </div>
  );
}

function CreateTenantModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/platform/tenants', form),
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); setError(''); mut.mutate(); };
  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('platform.newTenant')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>{t('platform.company')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>{t('platform.slug')}</Label><Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>{t('platform.adminName')}</Label><Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('platform.adminEmail')}</Label><Input dir="ltr" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>{t('platform.adminPassword')}</Label><Input dir="ltr" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">{t('platform.createHint')}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !form.name || !form.slug || !form.adminEmail || form.adminPassword.length < 8}>{mut.isPending ? t('common.saving') : t('platform.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlatformPlansCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-plans'], queryFn: async () => (await api.get<PlanDto[]>('/platform/plans')).data });
  const [editing, setEditing] = useState<PlanDto | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['platform-plans'] });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />{t('platform.plans.title')}</span>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />{t('platform.plans.newPlan')}</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <p className="px-6 pb-3 text-sm text-muted-foreground">{t('platform.plans.hint')}</p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('platform.plans.name')}</TableHead>
            <TableHead className="text-end">{t('platform.plans.seats')}</TableHead>
            <TableHead className="text-end">{t('platform.plans.storageGb')}</TableHead>
            <TableHead className="text-end">{t('platform.plans.price')}</TableHead>
            <TableHead className="text-end">{t('platform.plans.perVehicle')}</TableHead>
            <TableHead className="text-end">{t('platform.plans.assetCap')}</TableHead>
            <TableHead className="text-end">{t('common.actions')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableEmpty colSpan={7}>—</TableEmpty>}
            {q.data?.map((p) => (
              <TableRow key={p.id} className={cn(!p.isActive && 'opacity-50')}>
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell className="text-end tabular-nums">{p.seats}</TableCell>
                <TableCell className="text-end tabular-nums">{p.storageGb}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{p.priceMonthly} ﷼</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{p.perVehiclePrice != null ? `${p.perVehiclePrice} ﷼` : '—'}</TableCell>
                <TableCell className="text-end tabular-nums">{p.assetCap ?? t('platform.plans.unlimited')}</TableCell>
                <TableCell className="text-end">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" />{t('common.edit')}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {creating && <PlanModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); invalidate(); }} />}
      {editing && <PlanModal plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
    </Card>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan?: PlanDto; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [form, setForm] = useState({
    name: plan?.name ?? '', seats: String(plan?.seats ?? 5), storageGb: String(plan?.storageGb ?? 10),
    priceMonthly: String(plan?.priceMonthly ?? 0), perVehiclePrice: plan?.perVehiclePrice != null ? String(plan.perVehiclePrice) : '',
    assetCap: plan?.assetCap != null ? String(plan.assetCap) : '',
  });
  const [modules, setModules] = useState<Record<string, boolean>>(plan?.features ?? {});
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, seats: Number(form.seats), storageGb: Number(form.storageGb),
        priceMonthly: Number(form.priceMonthly), features: modules,
        ...(form.perVehiclePrice ? { perVehiclePrice: Number(form.perVehiclePrice) } : { perVehiclePrice: null }),
        ...(form.assetCap ? { assetCap: Number(form.assetCap) } : {}),
      };
      return plan ? api.put(`/platform/plans/${plan.id}`, body) : api.post('/platform/plans', body);
    },
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? t('platform.plans.editPlan') : t('platform.plans.newPlan')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>{t('platform.plans.name')}</Label><Input dir="ltr" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.plans.price')}</Label><Input type="number" dir="ltr" value={form.priceMonthly} onChange={(e) => set('priceMonthly', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.plans.seats')}</Label><Input type="number" dir="ltr" value={form.seats} onChange={(e) => set('seats', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.plans.storageGb')}</Label><Input type="number" dir="ltr" value={form.storageGb} onChange={(e) => set('storageGb', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.plans.perVehicle')}</Label><Input type="number" dir="ltr" value={form.perVehiclePrice} onChange={(e) => set('perVehiclePrice', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.plans.assetCap')} ({t('platform.plans.unlimited')}=∅)</Label><Input type="number" dir="ltr" value={form.assetCap} onChange={(e) => set('assetCap', e.target.value)} /></div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('platform.plans.modules')}</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_MODULES.map((m: PlatformModule) => {
                const on = modules[m] !== false;
                return (
                  <button key={m} type="button" onClick={() => setModules({ ...modules, [m]: !on })}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                    {isAr ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !form.name}>{mut.isPending ? t('common.saving') : t('platform.plans.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformSellerCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invoice-seller'], queryFn: async () => (await api.get<InvoiceSeller>('/invoices/seller')).data });
  const [form, setForm] = useState({ name: '', vatNumber: '', crNumber: '', address: '' });
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (q.data && !loaded) {
    setForm({ name: q.data.name ?? '', vatNumber: q.data.vatNumber ?? '', crNumber: q.data.crNumber ?? '', address: q.data.address ?? '' });
    setLoaded(true);
  }
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => api.put('/invoices/seller', { name: form.name, vatNumber: form.vatNumber || null, crNumber: form.crNumber || null, address: form.address || null }),
    onSuccess: () => { setMsg({ ok: true, text: t('invoices.sellerSaved') }); void qc.invalidateQueries({ queryKey: ['invoice-seller'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-primary" />{t('invoices.sellerCard')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('invoices.sellerHint')}</p>
        {msg && <div className={cn('rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>{msg.text}</div>}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label>{t('invoices.sellerName')}</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('invoices.vatNo')}</Label><Input dir="ltr" value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('invoices.crNo')}</Label><Input dir="ltr" value={form.crNumber} onChange={(e) => set('crNumber', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('invoices.address')}</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
        </div>
        <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}>{save.isPending ? t('common.saving') : t('invoices.saveSeller')}</Button>
      </CardContent>
    </Card>
  );
}

function PlatformPaymentsCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payments-config'], queryFn: async () => (await api.get<PaymentGatewaySettings>('/payments/config')).data });
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // hydrate the form once from the server (secret never returned — left blank)
  if (q.data && !loaded) {
    setEnabled(q.data.enabled);
    setPublicKey(q.data.publicKey ?? '');
    setCurrency(q.data.currency || 'SAR');
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () => api.put<PaymentGatewaySettings>('/payments/config', {
      enabled, publicKey: publicKey || null, currency, ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
    }),
    onSuccess: () => { setSecretKey(''); setMsg({ ok: true, text: t('payments.saved') }); void qc.invalidateQueries({ queryKey: ['payments-config'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const test = useMutation({
    mutationFn: async () => (await api.post<{ ok: boolean; message: string }>('/payments/config/test')).data,
    onSuccess: (d) => setMsg({ ok: d.ok, text: d.message }),
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const mode = q.data?.mode;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-primary" />{t('payments.gateway')}
          {mode && <Badge variant={mode === 'live' ? 'success' : 'warning'}>{mode === 'live' ? t('payments.modeLive') : t('payments.modeTest')}</Badge>}
          {q.data && (q.data.secretSet
            ? <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-success" />{t('payments.secretSet')}</Badge>
            : <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3 text-muted-foreground" />{t('payments.secretMissing')}</Badge>)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('payments.gatewayHint')}</p>
        {msg && (
          <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
            {msg.text}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{t('payments.enabled')}</span>
          <span className="text-xs text-muted-foreground">— {t('payments.enabledHint')}</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('payments.publicKey')}</Label>
            <Input dir="ltr" placeholder="pk_test_…" value={publicKey} onChange={(e) => setPublicKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payments.secretKey')}</Label>
            <Input dir="ltr" type="password" placeholder={q.data?.secretSet ? '••••••••  ' + t('payments.secretKeep') : 'sk_test_…'} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payments.currency')}</Label>
            <Input dir="ltr" className="max-w-[120px]" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('payments.docsHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}>{save.isPending ? t('common.saving') : t('payments.save')}</Button>
          <Button variant="outline" onClick={() => { setMsg(null); test.mutate(); }} disabled={test.isPending || !q.data?.secretSet}>{t('payments.testBtn')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformMapsCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['maps-config'], queryFn: async () => (await api.get<MapsGatewaySettings>('/maps/config')).data });
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // hydrate once (the key is never returned — left blank)
  if (q.data && !loaded) { setEnabled(q.data.enabled); setLoaded(true); }

  const save = useMutation({
    mutationFn: () => api.put<MapsGatewaySettings>('/maps/config', { enabled, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }),
    onSuccess: () => {
      setApiKey('');
      setMsg({ ok: true, text: t('maps.saved') });
      void qc.invalidateQueries({ queryKey: ['maps-config'] });
      void qc.invalidateQueries({ queryKey: ['maps-runtime'] });
    },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="h-4 w-4 text-primary" />{t('maps.gateway')}
          {q.data && (q.data.apiKeySet
            ? <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-success" />{t('maps.keySet')}</Badge>
            : <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3 text-muted-foreground" />{t('maps.keyMissing')}</Badge>)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('maps.gatewayHint')}</p>
        {msg && (
          <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
            {msg.text}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{t('maps.enabled')}</span>
          <span className="text-xs text-muted-foreground">— {t('maps.enabledHint')}</span>
        </label>
        <div className="space-y-1.5">
          <Label>{t('maps.apiKey')}</Label>
          <Input dir="ltr" type="password" placeholder={q.data?.apiKeySet ? '••••••••  ' + t('maps.keyKeep') : 'AIza…'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{t('maps.docsHint')}</p>
        <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}>{save.isPending ? t('common.saving') : t('common.save')}</Button>
      </CardContent>
    </Card>
  );
}

function PlatformIntegrationsCard() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('platform.tenants.manage');
  const q = useQuery({ queryKey: ['platform-integrations'], queryFn: async () => (await api.get<IntegrationRequestDto[]>('/integrations/all')).data, refetchInterval: LIVE_REFETCH_MS });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IntegrationStatus }) => api.patch(`/integrations/${id}/status`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-integrations'] }), onError: (e) => alert(extractApiError(e)),
  });
  const variant: Record<string, 'success' | 'warning' | 'secondary'> = { ACTIVE: 'success', REQUESTED: 'warning', UNDER_REVIEW: 'warning', IN_SETUP: 'warning', CANCELLED: 'secondary', REJECTED: 'secondary' };
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />{t('wasl.platformTitle')}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('wasl.company')}</TableHead>
            <TableHead>{t('wasl.type')}</TableHead>
            <TableHead>{t('wasl.status')}</TableHead>
            <TableHead>{t('wasl.date')}</TableHead>
            {canManage && <TableHead className="text-end">{t('wasl.setStatus')}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableEmpty colSpan={canManage ? 5 : 4}>—</TableEmpty>}
            {q.data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.tenantCode ?? '—'}</TableCell>
                <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                <TableCell><Badge variant={variant[r.status]}>{t(`wasl.statuses.${r.status}`)}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</TableCell>
                {canManage && (
                  <TableCell className="text-end">
                    <Select value={r.status} onValueChange={(v) => setStatus.mutate({ id: r.id, status: v as IntegrationStatus })}>
                      <SelectTrigger className="ms-auto max-w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{INTEGRATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`wasl.statuses.${s}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlatformActivityCard() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const q = useQuery({ queryKey: ['platform-audit'], queryFn: async () => (await api.get<PlatformAuditItem[]>('/platform/audit')).data, refetchInterval: LIVE_REFETCH_MS });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />{t('platform.activity')}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('platform.code')}</TableHead>
              <TableHead>{t('platform.actor')}</TableHead>
              <TableHead>{t('platform.action')}</TableHead>
              <TableHead>{t('platform.entity')}</TableHead>
              <TableHead className="text-end">{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableEmpty colSpan={5}>{t('platform.noActivity')}</TableEmpty>}
            {q.data?.slice(0, 12).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.tenantCode ?? '—'}</TableCell>
                <TableCell className="text-sm">{a.actor ?? '—'}</TableCell>
                <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.entityType}</TableCell>
                <TableCell className="text-end text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString(isAr ? 'ar' : 'en-GB')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EditPlanModal({ tenant, onClose, onSaved }: { tenant: PlatformTenantSummary; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [maxUsers, setMaxUsers] = useState(String(tenant.maxUserCount));
  const [maxGb, setMaxGb] = useState(String(Math.round(tenant.maxStorageBytes / GiB)));
  const [plan, setPlan] = useState(tenant.planName);
  const [planId, setPlanId] = useState<string | null>(null);
  const [perVehiclePrice, setPerVehiclePrice] = useState<number | null>(null);
  const [assetCap, setAssetCap] = useState<number | null>(null);
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  // saved plan catalog (from Control Plane)
  const plansQ = useQuery({ queryKey: ['platform-plans'], queryFn: async () => (await api.get<PlanDto[]>('/platform/plans')).data });

  const applyPreset = (id: string) => {
    const p = plansQ.data?.find((x) => x.id === id);
    if (!p) return;
    setPlanId(p.id);
    setPlan(p.name);
    setMaxUsers(String(p.seats));
    setMaxGb(String(p.storageGb));
    setModules((m) => ({ ...m, ...p.features }));
    setPerVehiclePrice(p.perVehiclePrice);
    setAssetCap(p.assetCap);
  };

  // load current module flags
  useQuery({
    queryKey: ['platform-sub', tenant.id],
    queryFn: async () => {
      const d = (await api.get(`/entitlements/${tenant.id}`)).data as { enabledModules: Record<string, boolean> };
      setModules(d.enabledModules); return d;
    },
  });

  const mut = useMutation({
    mutationFn: () => api.put(`/platform/tenants/${tenant.id}/subscription`, {
      planId, planName: plan, maxUserCount: Number(maxUsers), maxStorageBytes: Number(maxGb) * GiB,
      enabledModules: modules, perVehiclePrice, ...(assetCap != null ? { assetCap } : {}),
    }),
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('platform.editPlan')} — {tenant.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5">
            <Label>{t('platform.applyPreset')}</Label>
            <Select value="" onValueChange={applyPreset}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder={t('platform.choosePlan')} /></SelectTrigger>
              <SelectContent>
                {(plansQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.seats} {t('platform.seats')} · {p.storageGb}GB · {p.priceMonthly}﷼</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>{t('platform.plan')}</Label><Input value={plan} onChange={(e) => setPlan(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.maxUsers')}</Label><Input type="number" dir="ltr" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('platform.maxStorageGb')}</Label><Input type="number" dir="ltr" value={maxGb} onChange={(e) => setMaxGb(e.target.value)} /></div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('saas.modules')}</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_MODULES.map((m: PlatformModule) => {
                const on = modules[m] !== false;
                return (
                  <button key={m} type="button" onClick={() => setModules({ ...modules, [m]: !on })}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                    {isAr ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
