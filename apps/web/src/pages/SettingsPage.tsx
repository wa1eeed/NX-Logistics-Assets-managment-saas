import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Save, Cloud, Plug, Gauge, Building2, FolderTree, Palette, Upload } from 'lucide-react';
import type {
  SettingItem, StorageStatus, TenantSubscriptionDto, TenantUsageDto,
  PlatformStorageSettings, TenantStorageSettings, StorageMode, StorageProvider, TenantMe,
} from '@nx-lam/shared';
import { MODULE_LABELS, PLATFORM_MODULES, type PlatformModule, STORAGE_PROVIDERS, STORAGE_PROVIDER_LABELS } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const isAr = i18n.language === 'ar';
  const canManage = hasPermission('settings.manage');

  const q = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get<SettingItem[]>('/settings')).data });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (q.data) {
      const map: Record<string, unknown> = {};
      for (const s of q.data) map[s.key] = s.value;
      setValues(map);
    }
  }, [q.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, SettingItem[]>();
    for (const s of q.data ?? []) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return [...map.entries()];
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => api.put('/settings', { values }),
    onSuccess: () => {
      setOk(true); setError('');
      void qc.invalidateQueries({ queryKey: ['settings'] });
      setTimeout(() => setOk(false), 2500);
    },
    onError: (e) => { setError(extractApiError(e)); setOk(false); },
  });

  function renderInput(s: SettingItem) {
    const val = values[s.key];
    if (s.key === 'general.defaultLocale') {
      return (
        <Select value={String(val ?? 'en')} disabled={!canManage} onValueChange={(v) => setValues({ ...values, [s.key]: v })}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (typeof s.value === 'number') {
      return (
        <Input type="number" step="any" dir="ltr" className="max-w-xs" disabled={!canManage}
          value={val === undefined || val === null ? '' : String(val)}
          onChange={(e) => setValues({ ...values, [s.key]: e.target.value === '' ? null : Number(e.target.value) })} />
      );
    }
    return (
      <Input className="max-w-xs" disabled={!canManage} value={String(val ?? '')}
        onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />
    );
  }

  return (
    <div>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        action={canManage && (
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            <Save className="h-4 w-4" />{mut.isPending ? t('common.saving') : t('settings.save')}
          </Button>
        )}
      />

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {ok && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />{t('settings.saved')}
        </div>
      )}

      {hasPermission('entitlements.read') && <div className="mb-5"><SubscriptionCard /></div>}
      <div className="mb-5"><CompanyProfileCard canManage={canManage} /></div>
      <div className="mb-5"><BrandingCard canManage={canManage} /></div>
      <div className="mb-5"><CompanyStorageCard /></div>

      {q.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([group, items]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="text-base">
                  {group === 'alerts' ? t('settings.group.alerts') : group === 'general' ? t('settings.group.general') : group}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {items.map((s) => (
                  <div key={s.key} className="space-y-1.5">
                    <Label>{isAr ? s.labelAr : s.labelEn}</Label>
                    {renderInput(s)}
                    <p className="text-xs text-muted-foreground">{isAr ? s.descriptionAr : s.descriptionEn}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v % 1 === 0 ? v : v.toFixed(1)} ${u[i]}`;
}

function UsageBar({ label, used, max, pct, danger }: { label: string; used: string; max: string; pct: number; danger: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums" dir="ltr">{used} / {max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', danger ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function SubscriptionCard() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const q = useQuery({
    queryKey: ['entitlements', 'me'],
    queryFn: async () => (await api.get<{ subscription: TenantSubscriptionDto; usage: TenantUsageDto }>('/entitlements/me')).data,
  });
  const sub = q.data?.subscription;
  const usage = q.data?.usage;
  const statusVariant = sub?.status === 'ACTIVE' ? 'success' : sub?.status === 'TRIAL' ? 'warning' : 'destructive';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" />{t('saas.title')}</CardTitle>
        {sub && <Badge variant={statusVariant}>{sub.planName} · {t(`saas.status.${sub.status}`)}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('saas.hint')}</p>
        {q.isLoading && <div className="py-4 text-center text-sm text-muted-foreground">{t('common.loading')}</div>}
        {usage && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <UsageBar label={t('saas.users')} used={String(usage.userCount)} max={String(usage.maxUserCount)} pct={usage.userPercent} danger={usage.userCount >= usage.maxUserCount} />
              <UsageBar label={t('saas.storage')} used={fmtBytes(usage.storageBytes)} max={fmtBytes(usage.maxStorageBytes)} pct={usage.storagePercent} danger={usage.storageBytes >= usage.maxStorageBytes} />
            </div>
            {usage.storageWarning && usage.storageBytes < usage.maxStorageBytes && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {t('saas.storageWarn')}
              </div>
            )}
            {sub?.seatPriceMonthly != null && (
              <p className="text-xs text-muted-foreground">{t('saas.seatPrice', { price: sub.seatPriceMonthly })}</p>
            )}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">{t('saas.modules')}</div>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_MODULES.map((m: PlatformModule) => {
                  const on = usage.enabledModules[m] !== false;
                  return (
                    <Badge key={m} variant={on ? 'secondary' : 'outline'} className={cn(!on && 'opacity-50 line-through')}>
                      {isAr ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('saas.managedByPlatform')}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type CredForm = { provider: string; endpoint: string; accessKeyId: string; secretAccessKey: string; bucket: string; region: string; publicBaseUrl: string; ttl: string };

/** Reusable S3-compatible credential fields (provider + endpoint + keys + region…). */
function CredentialFields({ form, setForm, disabled, secretSet }: {
  form: CredForm; setForm: (f: CredForm) => void; disabled: boolean; secretSet: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t('cloud.provider')}</Label>
        <Select value={form.provider || 'R2'} disabled={disabled} onValueChange={(v) => setForm({ ...form, provider: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STORAGE_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{STORAGE_PROVIDER_LABELS[p as StorageProvider]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>{t('cloud.bucket')}</Label><Input dir="ltr" disabled={disabled} value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} /></div>
      <div className="space-y-1.5 md:col-span-2"><Label>{t('cloud.endpoint')}</Label><Input dir="ltr" placeholder="https://<account>.r2.cloudflarestorage.com" disabled={disabled} value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>{t('cloud.accessKeyId')}</Label><Input dir="ltr" disabled={disabled} value={form.accessKeyId} onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>{t('cloud.secret')}</Label><Input dir="ltr" type="password" placeholder={secretSet ? (isAr ? '•••••••• (محفوظ)' : '•••••••• (saved)') : ''} disabled={disabled} value={form.secretAccessKey} onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>{t('cloud.region')}</Label><Input dir="ltr" placeholder="auto" disabled={disabled} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>{t('cloud.ttl')}</Label><Input type="number" dir="ltr" disabled={disabled} value={form.ttl} onChange={(e) => setForm({ ...form, ttl: e.target.value })} /></div>
      <div className="space-y-1.5 md:col-span-2"><Label>{t('cloud.publicBaseUrl')}</Label><Input dir="ltr" disabled={disabled} value={form.publicBaseUrl} onChange={(e) => setForm({ ...form, publicBaseUrl: e.target.value })} /></div>
    </div>
  );
}

/** This company's storage option: shared folder (default) or its own dedicated bucket. */
function CompanyStorageCard() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('settings.manage');
  const q = useQuery({ queryKey: ['storage-tenant'], queryFn: async () => (await api.get<{ status: StorageStatus; settings: TenantStorageSettings }>('/storage/tenant')).data });
  const [mode, setMode] = useState<StorageMode>('SHARED');
  const [form, setForm] = useState({ provider: 'R2', endpoint: '', accessKeyId: '', secretAccessKey: '', bucket: '', region: '', publicBaseUrl: '', ttl: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (q.data) {
      const s = q.data.settings;
      setMode(s.mode);
      setForm({ provider: s.provider ?? 'R2', endpoint: s.endpoint ?? '', accessKeyId: s.accessKeyId ?? '', secretAccessKey: '', bucket: s.bucket ?? '', region: s.region ?? '', publicBaseUrl: s.publicBaseUrl ?? '', ttl: s.ttl ? String(s.ttl) : '' });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api.put('/storage/tenant', {
      mode,
      ...(mode === 'DEDICATED' ? {
        provider: form.provider, endpoint: form.endpoint || null, accessKeyId: form.accessKeyId || null,
        secretAccessKey: form.secretAccessKey || undefined, bucket: form.bucket || null,
        region: form.region || null, publicBaseUrl: form.publicBaseUrl || null, ttl: form.ttl ? Number(form.ttl) : null,
      } : {}),
    }),
    onSuccess: () => { setMsg({ ok: true, text: t('cloud.saved') }); setForm((f) => ({ ...f, secretAccessKey: '' })); void qc.invalidateQueries({ queryKey: ['storage-tenant'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const test = useMutation({
    mutationFn: async () => (await api.post<{ ok: boolean; message: string }>('/storage/tenant/test')).data,
    onSuccess: (d) => setMsg({ ok: d.ok, text: d.message }),
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const st = q.data?.status;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><FolderTree className="h-4 w-4 text-primary" />{t('cloud.companyTitle')}</CardTitle>
        {st && <Badge variant={st.scope === 'DEDICATED' ? 'default' : st.scope === 'SHARED' ? 'success' : 'warning'}>{t(`cloud.scope.${st.scope}`)} · {st.provider}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('cloud.companyHint')}</p>
        {/* Folder path — every company gets an isolated folder inside the bucket */}
        {st?.folderPrefix && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('cloud.folderPath')}: </span>
            <span className="font-mono font-semibold" dir="ltr">{st.bucket}/{st.folderPrefix}</span>
          </div>
        )}
        {msg && <div className={cn('rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>{msg.text}</div>}

        {/* Mode selector */}
        <div className="space-y-1.5">
          <Label>{t('cloud.mode')}</Label>
          <Select value={mode} disabled={!canManage} onValueChange={(v) => setMode(v as StorageMode)}>
            <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SHARED">{t('cloud.modeShared')}</SelectItem>
              <SelectItem value="DEDICATED">{t('cloud.modeDedicated')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{mode === 'SHARED' ? t('cloud.sharedNote') : t('cloud.dedicatedNote')}</p>
        </div>

        {mode === 'DEDICATED' && <CredentialFields form={form} setForm={setForm} disabled={!canManage} secretSet={!!q.data?.settings.secretSet} />}

        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? t('common.saving') : t('settings.save')}</Button>
            {mode === 'DEDICATED' && <Button variant="outline" onClick={() => { setMsg(null); test.mutate(); }} disabled={test.isPending}><Plug className="h-4 w-4" />{test.isPending ? t('common.loading') : t('cloud.test')}</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Company account / tax-invoice profile (legal name, email, phone, city, CR, VAT). */
function CompanyProfileCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tenant-me'], queryFn: async () => (await api.get<TenantMe>('/tenant/me')).data });
  const [form, setForm] = useState({ legalName: '', email: '', contactPhone: '', city: '', crNumber: '', vatNumber: '' });
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (q.data && !loaded) {
    const p = q.data.profile;
    setForm({
      legalName: p.legalName ?? '', email: p.email ?? '', contactPhone: p.contactPhone ?? '',
      city: p.city ?? '', crNumber: p.crNumber ?? '', vatNumber: p.vatNumber ?? '',
    });
    setLoaded(true);
  }
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.put('/tenant/profile', {
      legalName: form.legalName || null, email: form.email || null, contactPhone: form.contactPhone || null,
      city: form.city || null, crNumber: form.crNumber || null, vatNumber: form.vatNumber || null,
    }),
    onSuccess: () => { setMsg({ ok: true, text: t('company.saved') }); void qc.invalidateQueries({ queryKey: ['tenant-me'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const field = (k: keyof typeof form, label: string, opts?: { hint?: string; dir?: 'ltr' | 'rtl'; type?: string }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input dir={opts?.dir} type={opts?.type} disabled={!canManage} value={form[k]} onChange={(e) => set(k, e.target.value)} />
      {opts?.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" />{t('company.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('company.hint')}</p>
        {msg && (
          <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>{msg.text}</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {field('legalName', t('company.legalName'))}
          {field('email', t('company.email'), { dir: 'ltr', type: 'email' })}
          {field('contactPhone', t('company.phone'), { dir: 'ltr' })}
          {field('city', t('company.city'))}
          {field('crNumber', t('company.cr'), { dir: 'ltr', hint: t('company.crHint') })}
          {field('vatNumber', t('company.vat'), { dir: 'ltr', hint: t('company.vatHint') })}
        </div>
        {canManage && (
          <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? t('common.saving') : t('company.save')}</Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Per-tenant branding: display name, accent colour and logo (themes the app shell). */
function BrandingCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tenant-me'], queryFn: async () => (await api.get<TenantMe>('/tenant/me')).data });
  const [brandName, setBrandName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (q.data && !loaded) {
    setBrandName(q.data.branding.brandName ?? '');
    setColor(q.data.branding.primaryColor ?? '#10b981');
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () => api.put('/tenant/branding', { brandName: brandName || null, primaryColor: color }),
    onSuccess: () => { setMsg({ ok: true, text: t('branding.saved') }); void qc.invalidateQueries({ queryKey: ['tenant-me'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const upload = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/tenant/logo', fd); },
    onSuccess: () => { setMsg({ ok: true, text: t('branding.logoUpdated') }); void qc.invalidateQueries({ queryKey: ['tenant-me'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const logoUrl = q.data?.branding.logoUrl;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" />{t('branding.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('branding.hint')}</p>
        {msg && (
          <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>{msg.text}</div>
        )}
        <div className="flex items-center gap-4">
          {logoUrl ? <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-xl border object-contain" />
            : <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold">NX</div>}
          {canManage && (
            <label className="cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMsg(null); upload.mutate(f); } }} />
              <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"><Upload className="h-4 w-4" />{upload.isPending ? t('common.saving') : t('branding.uploadLogo')}</span>
            </label>
          )}
          <span className="text-xs text-muted-foreground">{t('branding.logoHint')}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('branding.brandName')}</Label>
            <Input value={brandName} disabled={!canManage} placeholder={q.data?.name} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('branding.color')}</Label>
            <div className="flex items-center gap-2">
              <input type="color" disabled={!canManage} value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5" />
              <Input dir="ltr" className="max-w-[140px]" disabled={!canManage} value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? t('common.saving') : t('branding.save')}</Button>
        )}
      </CardContent>
    </Card>
  );
}

/** The platform's shared master account — one account, every company's folder lives under it.
 *  Rendered in the Platform Admin panel (operator-only). */
export function PlatformStorageCard() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  // Platform-operator card: the API gates these on entitlements.manage (the platform admin),
  // not the tenant-level settings.manage — match that so the operator sees save/test/reconcile.
  const canManage = hasPermission('entitlements.manage');
  const q = useQuery({ queryKey: ['storage-platform'], queryFn: async () => (await api.get<{ status: StorageStatus; settings: PlatformStorageSettings }>('/storage/platform')).data });
  const [form, setForm] = useState({ provider: 'R2', endpoint: '', accessKeyId: '', secretAccessKey: '', bucket: '', region: '', publicBaseUrl: '', ttl: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (q.data) {
      const s = q.data.settings;
      setForm({ provider: s.provider ?? 'R2', endpoint: s.endpoint ?? '', accessKeyId: s.accessKeyId ?? '', secretAccessKey: '', bucket: s.bucket ?? '', region: s.region ?? '', publicBaseUrl: s.publicBaseUrl ?? '', ttl: s.ttl ? String(s.ttl) : '' });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api.put('/storage/platform', {
      provider: form.provider, endpoint: form.endpoint || null, accessKeyId: form.accessKeyId || null,
      secretAccessKey: form.secretAccessKey || undefined, bucket: form.bucket || null,
      region: form.region || null, publicBaseUrl: form.publicBaseUrl || null, ttl: form.ttl ? Number(form.ttl) : null,
    }),
    onSuccess: () => { setMsg({ ok: true, text: t('cloud.saved') }); setForm((f) => ({ ...f, secretAccessKey: '' })); void qc.invalidateQueries({ queryKey: ['storage-platform'] }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const test = useMutation({
    mutationFn: async () => (await api.post<{ ok: boolean; message: string }>('/storage/platform/test')).data,
    onSuccess: (d) => setMsg({ ok: d.ok, text: d.message }),
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const reconcile = useMutation({
    mutationFn: async () => (await api.post<{ tenants: number; fromBucket: number; fromLedger: number }>('/storage/reconcile')).data,
    onSuccess: (d) => setMsg({ ok: true, text: t('cloud.reconciled', { tenants: d.tenants, bucket: d.fromBucket, ledger: d.fromLedger }) }),
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const st = q.data?.status;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" />{t('cloud.platformTitle')}</CardTitle>
        {st && <Badge variant={st.provider !== 'LOCAL' ? 'success' : 'warning'}>{st.provider !== 'LOCAL' ? t('cloud.connected') : t('cloud.local')} · {st.source}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{t('cloud.platformHint')}</span>
        </div>
        {msg && <div className={cn('rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>{msg.text}</div>}
        <CredentialFields form={form} setForm={setForm} disabled={!canManage} secretSet={!!q.data?.settings.secretSet} />
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? t('common.saving') : t('settings.save')}</Button>
            <Button variant="outline" onClick={() => { setMsg(null); test.mutate(); }} disabled={test.isPending}><Plug className="h-4 w-4" />{test.isPending ? t('common.loading') : t('cloud.test')}</Button>
            <Button variant="outline" onClick={() => { setMsg(null); reconcile.mutate(); }} disabled={reconcile.isPending}><Gauge className="h-4 w-4" />{reconcile.isPending ? t('common.loading') : t('cloud.reconcile')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
