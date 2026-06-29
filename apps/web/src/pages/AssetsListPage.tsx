import { useState, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Eye, Trash2, Search, Boxes, Truck, Wrench, Package, CheckCircle2, PauseCircle } from 'lucide-react';
import { AssetStatus, OwnershipType } from '@nx-lam/shared';
import type { AssetSummary, AssetTypeSummary, AssetClassSummary, ModelSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { statusVariant, fmtMoney } from '../lib/asset-ui';
import { StatTile } from '../components/StatTile';
import { Pagination, usePagination } from '../components/Pagination';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LookupSelect } from '../components/LookupSelect';

const CLASS_ICON: Record<string, typeof Boxes> = { VEHICLE: Truck, EQUIPMENT: Wrench, ATTACHMENT: Package };
const CLASS_TINT: Record<string, string> = {
  VEHICLE: 'text-blue-500 bg-blue-500/10', EQUIPMENT: 'text-amber-500 bg-amber-500/10', ATTACHMENT: 'text-violet-500 bg-violet-500/10',
};

export function AssetsListPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState('__all__'); // class code or '__all__'
  const [status, setStatus] = useState('');
  const [ownership, setOwnership] = useState('');
  const [typeId, setTypeId] = useState('');
  const [search, setSearch] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [creating, setCreating] = useState(false);

  const showFinance = hasPermission('finance.read');
  const canCreate = hasPermission('assets.create');
  const canDelete = hasPermission('assets.delete');

  const classesQ = useQuery({ queryKey: ['asset-classes'], queryFn: async () => (await api.get<AssetClassSummary[]>('/asset-classes')).data });
  const typesQ = useQuery({ queryKey: ['asset-types'], queryFn: async () => (await api.get<AssetTypeSummary[]>('/asset-types')).data });
  const q = useQuery({
    queryKey: ['assets', status, ownership, typeId, search],
    queryFn: async () =>
      (await api.get<AssetSummary[]>('/assets', {
        params: { status: status || undefined, ownershipType: ownership || undefined, assetTypeId: typeId || undefined, search: search || undefined },
      })).data,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['assets'] }),
    onError: (e) => alert(extractApiError(e)),
  });

  const classLabel = (c: AssetClassSummary) => (isAr && c.labelAr ? c.labelAr : c.labelEn);

  // Year period filter (client-side).
  const yearFiltered = useMemo(() => (q.data ?? []).filter((a) => {
    if (yearFrom && (a.year == null || a.year < Number(yearFrom))) return false;
    if (yearTo && (a.year == null || a.year > Number(yearTo))) return false;
    return true;
  }), [q.data, yearFrom, yearTo]);

  // Inventory counters from the whole (period-filtered) set — stable across tabs.
  const classCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of yearFiltered) { const k = a.assetClassCode ?? '—'; m[k] = (m[k] ?? 0) + 1; }
    return m;
  }, [yearFiltered]);
  const operatingCount = yearFiltered.filter((a) => ['AVAILABLE', 'IN_DUTY', 'RESERVED'].includes(a.status)).length;
  const stoppedCount = yearFiltered.filter((a) => a.status === 'OUT_OF_SERVICE').length;
  const maintCount = yearFiltered.filter((a) => a.status === 'UNDER_MAINTENANCE').length;
  const ownsAssets = hasPermission('assets.update') || hasPermission('sale.read');

  // Rows for the current tab.
  const rows = tab === '__all__' ? yearFiltered : yearFiltered.filter((a) => a.assetClassCode === tab);
  const byType = Object.entries(rows.reduce<Record<string, number>>((m, a) => { m[a.assetTypeName] = (m[a.assetTypeName] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const pg = usePagination(rows);

  return (
    <div>
      <PageHeader
        title={ownsAssets ? t('assets.title') : t('nav.vehiclesEquipment')}
        subtitle={t('assets.subtitle')}
        action={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('assets.new')}</Button>}
      />

      {/* Inventory counters: total + per-class + operational status breakdown */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
        <StatTile label={t('assets.total')} value={yearFiltered.length} icon={Boxes} tint="text-primary bg-primary/10" />
        {(classesQ.data ?? []).filter((c) => c.isActive).map((c) => (
          <StatTile key={c.id} label={classLabel(c)} value={classCounts[c.code] ?? 0} icon={CLASS_ICON[c.code] ?? Boxes} tint={CLASS_TINT[c.code] ?? 'text-slate-500 bg-slate-500/10'} />
        ))}
        <StatTile label={t('kpis.operating')} value={operatingCount} icon={CheckCircle2} tint="text-emerald-500 bg-emerald-500/10" valueClass="text-emerald-600" />
        <StatTile label={t('assets.stopped')} value={stoppedCount} icon={PauseCircle} tint="text-rose-500 bg-rose-500/10" valueClass={stoppedCount ? 'text-rose-600' : undefined} />
        <StatTile label={t('assets.underMaint')} value={maintCount} icon={Wrench} tint="text-amber-500 bg-amber-500/10" />
      </div>

      {/* Class tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {[{ code: '__all__', label: t('common.all') }, ...(classesQ.data ?? []).filter((c) => c.isActive).map((c) => ({ code: c.code, label: classLabel(c) }))].map((tb) => (
          <button key={tb.code} onClick={() => { setTab(tb.code); pg.setPage(1); }}
            className={cn('relative px-4 py-2.5 text-sm font-medium transition-colors', tab === tb.code ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {tb.label}
            <span className="ms-1.5 text-xs text-muted-foreground">{tb.code === '__all__' ? yearFiltered.length : (classCounts[tb.code] ?? 0)}</span>
            {tab === tb.code && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-64 ps-9" placeholder={t('assets.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status || '__all__'} onValueChange={(v) => setStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t('assets.filterStatus')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('assets.filterStatus')} — {t('common.all')}</SelectItem>
            {Object.values(AssetStatus).map((s) => <SelectItem key={s} value={s}>{t(`assetStatus.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownership || '__all__'} onValueChange={(v) => setOwnership(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t('assets.filterOwnership')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('assets.filterOwnership')} — {t('common.all')}</SelectItem>
            {Object.values(OwnershipType).map((o) => <SelectItem key={o} value={o}>{t(`ownership.${o}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeId || '__all__'} onValueChange={(v) => setTypeId(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t('assets.filterType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('assets.filterType')} — {t('common.all')}</SelectItem>
            {typesQ.data?.map((tp) => <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="number" dir="ltr" className="w-[88px]" placeholder={t('assets.yearFrom')} value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
          <span className="text-muted-foreground">—</span>
          <Input type="number" dir="ltr" className="w-[88px]" placeholder={t('assets.yearTo')} value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
        </div>
      </div>

      {!q.isLoading && rows.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {byType.map(([name, count]) => (
            <span key={name} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">{name}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('assets.code')}</TableHead>
              <TableHead>{t('assets.type')}</TableHead>
              <TableHead>{t('assets.model')}</TableHead>
              <TableHead>{t('assets.idNo')}</TableHead>
              <TableHead>{t('assets.ownership')}</TableHead>
              <TableHead>{t('assets.status')}</TableHead>
              {showFinance && <TableHead>{t('assets.bookValue')}</TableHead>}
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={showFinance ? 8 : 7}>{t('common.loading')}</TableEmpty>}
            {!q.isLoading && rows.length === 0 && <TableEmpty colSpan={showFinance ? 8 : 7}>{t('assets.none')}</TableEmpty>}
            {pg.pageItems.map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                <TableCell className="font-mono font-semibold">{a.code}</TableCell>
                <TableCell>{a.assetTypeName}<span className="block text-xs text-muted-foreground">{a.category ?? ''}</span></TableCell>
                <TableCell className="text-muted-foreground">{a.modelName ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{a.plateNumber ?? a.serialNo ?? '—'}</TableCell>
                <TableCell><Badge variant={a.ownershipType === 'OWNED' ? 'secondary' : 'outline'}>{t(`ownership.${a.ownershipType}`)}</Badge></TableCell>
                <TableCell>
                  <Badge variant={statusVariant[a.status]}>{t(`assetStatus.${a.status}`)}</Badge>
                  {a.status === 'IN_DUTY' && a.currentOrgUnitName && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('assets.atProject')}: {a.currentOrgUnitName}</span>
                  )}
                </TableCell>
                {showFinance && <TableCell className="tabular-nums">{fmtMoney(a.effectiveBookValue, i18n.language)}</TableCell>}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/assets/${a.id}`)}><Eye className="h-3.5 w-3.5" /></Button>
                    {canDelete && (
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('assets.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(a.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>

      {creating && (
        <RegisterAssetModal classes={classesQ.data ?? []} showFinance={showFinance}
          onClose={() => setCreating(false)}
          onSaved={(id) => { setCreating(false); void qc.invalidateQueries({ queryKey: ['assets'] }); navigate(`/assets/${id}`); }} />
      )}
    </div>
  );
}

function RegisterAssetModal({
  classes, showFinance, onClose, onSaved,
}: {
  classes: AssetClassSummary[]; showFinance: boolean; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [manufacturer, setManufacturer] = useState<string | null>(null);
  const [modelId, setModelId] = useState('');
  const [form, setForm] = useState({
    code: '', ownershipType: OwnershipType.OWNED as string,
    year: '', region: '', siteName: '', location: '', purchaseDate: '',
    plateNumber: '', vin: '', serialNo: '', capacity: '',
    purchasePrice: '', depreciationRate: '',
  });
  const [error, setError] = useState('');

  const modelsQ = useQuery({
    queryKey: ['models', manufacturer],
    enabled: !!manufacturer,
    queryFn: async () => (await api.get<ModelSummary[]>('/models', { params: { manufacturer } })).data,
  });
  const selectedModel = modelsQ.data?.find((m) => m.id === modelId) ?? null;
  const fieldProfile = classes.find((c) => c.code === selectedModel?.assetClassCode)?.fieldProfile ?? 'GENERIC';
  const isVehicle = fieldProfile === 'VEHICLE';

  const mut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        code: form.code, modelId, ownershipType: form.ownershipType,
        year: form.year ? Number(form.year) : undefined,
        region: form.region || undefined, siteName: form.siteName || undefined, location: form.location || undefined,
        purchaseDate: form.purchaseDate || undefined,
        ...(isVehicle ? { plateNumber: form.plateNumber || undefined, vin: form.vin || undefined } : { serialNo: form.serialNo || undefined, capacity: form.capacity || undefined }),
      };
      if (showFinance) {
        if (form.purchasePrice) payload.purchasePrice = Number(form.purchasePrice);
        if (form.depreciationRate) payload.depreciationRate = Number(form.depreciationRate);
      }
      return (await api.post('/assets', payload)).data;
    },
    onSuccess: (d) => onSaved(d.id),
    onError: (e) => setError(extractApiError(e)),
  });

  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{t('assets.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('assets.code')}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>{t('assets.ownership')}</Label>
              <Select value={form.ownershipType} onValueChange={(v) => setForm({ ...form, ownershipType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(OwnershipType).map((o) => <SelectItem key={o} value={o}>{t(`ownership.${o}`)}</SelectItem>)}</SelectContent>
              </Select></div>
            {/* Catalog cascade: brand → model */}
            <div className="space-y-1.5"><Label>{t('assets.brand')}</Label>
              <LookupSelect type="MANUFACTURER" value={manufacturer} onChange={(v) => { setManufacturer(v); setModelId(''); }} /></div>
            <div className="space-y-1.5"><Label>{t('assets.selectModel')}</Label>
              <Select value={modelId} onValueChange={setModelId} disabled={!manufacturer}>
                <SelectTrigger><SelectValue placeholder={manufacturer ? '…' : t('assets.brandFirst')} /></SelectTrigger>
                <SelectContent>
                  {modelsQ.data?.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">{t('assets.noModels')}</div>}
                  {modelsQ.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.category ? ` · ${m.category}` : ''}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>

          {selectedModel && (
            <div className="rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
              {t('assets.type')}: <b className="text-foreground">{selectedModel.assetTypeName}</b>
              {selectedModel.category && <> · {t('assets.category')}: <b className="text-foreground">{selectedModel.category}</b></>}
              {selectedModel.assetClassCode && (() => { const cc = classes.find((c) => c.code === selectedModel.assetClassCode); const lbl = cc ? (i18n.language === 'ar' && cc.labelAr ? cc.labelAr : cc.labelEn) : selectedModel.assetClassCode; return <> · {t('assets.assetClass')}: <b className="text-foreground">{lbl}</b></>; })()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {isVehicle ? (
              <>
                <div className="space-y-1.5"><Label>{t('assets.plate')}</Label><Input dir="ltr" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t('assets.vin')}</Label><Input dir="ltr" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div className="space-y-1.5"><Label>{t('assets.serialNo')}</Label><Input dir="ltr" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t('assets.capacity')}</Label><Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              </>
            )}
            <div className="space-y-1.5"><Label>{t('assets.year')}</Label><Input type="number" dir="ltr" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('assets.purchaseDate')}</Label><Input type="date" dir="ltr" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('assets.region')}</Label><LookupSelect type="REGION" value={form.region || null} onChange={(v) => setForm({ ...form, region: v ?? '' })} /></div>
            <div className="space-y-1.5"><Label>{t('assets.siteName')}</Label><Input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
          </div>

          {showFinance && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1.5"><Label>{t('assets.financial.purchasePrice')}</Label><Input type="number" step="any" dir="ltr" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t('assets.financial.depreciationRate')}</Label><Input type="number" step="any" dir="ltr" value={form.depreciationRate} onChange={(e) => setForm({ ...form, depreciationRate: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !modelId || !form.code}>{mut.isPending ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
