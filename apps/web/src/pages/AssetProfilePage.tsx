import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Pencil, RefreshCw, Upload, Download, Trash2, FileText, Tag,
} from 'lucide-react';
import type { AssetProfile, AssetTimeline, WorkOrderSummary } from '@nx-lam/shared';
import { woStatusVariant } from './MaintenanceListPage';
import { ReadinessPanel } from '../components/assets/ReadinessPanel';
import { AssetOperationsTab } from '../components/assets/OperationsTab';
import { PreventiveTab } from '../components/assets/PreventiveTab';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { statusVariant, fmtMoney } from '../lib/asset-ui';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LookupSelect } from '../components/LookupSelect';

type TabKey = 'general' | 'vehicle' | 'documents' | 'operations' | 'financial' | 'timeline' | 'maintenance' | 'preventive';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-end">{children ?? '—'}</span>
    </div>
  );
}

export function AssetProfilePage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>('general');
  const [editGeneral, setEditGeneral] = useState(false);
  const [editVehicle, setEditVehicle] = useState(false);
  const [editFinancial, setEditFinancial] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const q = useQuery({
    queryKey: ['asset', id],
    queryFn: async () => (await api.get<AssetProfile>(`/assets/${id}`)).data,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['asset', id] });

  if (q.isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  if (q.isError || !q.data) return <div className="py-12 text-center text-sm text-destructive">{t('errors.generic')}</div>;
  const a = q.data;

  const canUpdate = hasPermission('assets.update');
  const canStatus = hasPermission('assets.status');
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'general', label: t('assets.tabs.general') },
    { key: 'vehicle', label: t('assets.tabs.vehicle') },
    { key: 'documents', label: t('assets.tabs.documents') },
    ...(hasPermission('rentals.read') ? [{ key: 'operations' as TabKey, label: t('assets.tabs.operations') }] : []),
    ...(hasPermission('maintenance.read') ? [{ key: 'maintenance' as TabKey, label: t('assets.tabs.maintenance') }] : []),
    ...(hasPermission('maintenance.read') ? [{ key: 'preventive' as TabKey, label: t('assets.tabs.preventive') }] : []),
    { key: 'financial', label: t('assets.tabs.financial') },
    { key: 'timeline', label: t('assets.tabs.timeline') },
  ];

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/assets')}>
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('assets.backToList')}
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{a.code}</h1>
            <Badge variant={statusVariant[a.status]}>{t(`assetStatus.${a.status}`)}</Badge>
            {a.forSaleFlag && <Badge variant="warning">{t('assets.forSaleFlag')}</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />{a.assetTypeName} · {t(`ownership.${a.ownershipType}`)}
          </p>
        </div>
        {canStatus && a.allowedTransitions.length > 0 && (
          <Button onClick={() => setChangingStatus(true)}><RefreshCw className="h-4 w-4" />{t('assets.changeStatus')}</Button>
        )}
      </div>

      {a.status === 'COMMISSIONING' && canUpdate && (
        <ReadinessPanel assetId={a.id} onCommissioned={refresh} />
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium transition-colors',
              tab === tb.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tb.label}
            {tab === tb.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-2 flex justify-end">
              {canUpdate && <Button variant="outline" size="sm" onClick={() => setEditGeneral(true)}><Pencil className="h-3.5 w-3.5" />{t('common.edit')}</Button>}
            </div>
            <Row label={t('assets.assetClass')}>{(a.assetClassLabelAr && i18n.language === 'ar' ? a.assetClassLabelAr : a.assetClassLabelEn) ?? '—'}</Row>
            <Row label={t('assets.manufacturer')}>{a.manufacturer ?? '—'}</Row>
            <Row label={t('assets.model')}>{a.modelName ?? '—'}</Row>
            <Row label={t('assets.category')}>{a.category ?? '—'}</Row>
            {a.serialNo && <Row label={a.fieldProfile === 'VEHICLE' ? t('assets.vin') : t('assets.serialNo')}>{a.serialNo}</Row>}
            {a.capacity && <Row label={t('assets.capacity')}>{a.capacity}</Row>}
            {a.color && <Row label={t('assets.color')}>{a.color}</Row>}
            <Row label={t('assets.year')}>{a.year}</Row>
            <Row label={t('assets.region')}>{a.region}</Row>
            <Row label={t('assets.siteName')}>{a.siteName}</Row>
            <Row label={t('assets.location')}>{a.location}</Row>
            <Row label={t('assets.purchaseDate')}>{fmtDate(a.purchaseDate)}</Row>
            <Row label={t('assets.ownership')}>{t(`ownership.${a.ownershipType}`)}</Row>

            {/* Admin-defined custom fields for this asset type */}
            {a.customFields.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assets.customFields')}</div>
                {a.customFields.map((f) => {
                  const v = a.customValues?.[f.key];
                  return <Row key={f.key} label={i18n.language === 'ar' ? f.labelAr : f.labelEn}>{v != null && v !== '' ? String(v) : '—'}</Row>;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'vehicle' && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{t('assets.vehicle.title')}</h3>
              {canUpdate && <Button variant="outline" size="sm" onClick={() => setEditVehicle(true)}><Pencil className="h-3.5 w-3.5" />{t('common.edit')}</Button>}
            </div>
            {a.vehicle ? (
              <>
                <Row label={t('assets.vehicle.plateNumber')}>{a.vehicle.plateNumber}</Row>
                <Row label={t('assets.vehicle.registrationExpiry')}>{fmtDate(a.vehicle.registrationExpiry)}</Row>
                <Row label={t('assets.vehicle.periodicInspection')}>{fmtDate(a.vehicle.periodicInspection)}</Row>
                <Row label={t('assets.vehicle.operatingCardNo')}>{a.vehicle.operatingCardNo}</Row>
                <Row label={t('assets.vehicle.customsCardNo')}>{a.vehicle.customsCardNo}</Row>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('assets.vehicle.none')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'documents' && <DocumentsTab asset={a} onChanged={refresh} />}

      {tab === 'operations' && <AssetOperationsTab assetId={a.id} />}

      {tab === 'maintenance' && <AssetMaintenanceTab assetId={a.id} />}

      {tab === 'preventive' && <PreventiveTab assetId={a.id} />}

      {tab === 'financial' && (
        <Card>
          <CardContent className="pt-6">
            {a.financial ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{t('assets.financial.title')}</h3>
                  {canUpdate && a.ownershipType === 'OWNED' && (
                    <Button variant="outline" size="sm" onClick={() => setEditFinancial(true)}><Pencil className="h-3.5 w-3.5" />{t('common.edit')}</Button>
                  )}
                </div>
                {a.ownershipType !== 'OWNED' ? (
                  <p className="mb-4 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t('assets.financial.notOwned')}</p>
                ) : (
                  <p className="mb-4 rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">{t('assets.financial.hybridNote')}</p>
                )}
                <Row label={t('assets.financial.purchasePrice')}>{fmtMoney(a.financial.purchasePrice, i18n.language)}</Row>
                <Row label={t('assets.financial.depreciationRate')}>{a.financial.depreciationRate != null ? `${(a.financial.depreciationRate * 100).toFixed(1)}%` : '—'}</Row>
                <Row label={t('assets.financial.ageYears')}>{a.financial.ageYears ?? '—'}</Row>
                <Row label={t('assets.financial.computedBookValue')}>{fmtMoney(a.financial.computedBookValue, i18n.language)}</Row>
                <Row label={t('assets.financial.manualBookValue')}>{fmtMoney(a.financial.manualBookValue, i18n.language)}</Row>
                <div className="mt-3 flex items-center justify-between rounded-md bg-primary/5 px-3 py-3">
                  <span className="text-sm font-semibold">{t('assets.financial.effectiveBookValue')}</span>
                  <span className="text-lg font-bold tabular-nums text-primary">{fmtMoney(a.financial.effectiveBookValue, i18n.language)}</span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('assets.financial.noAccess')}</p>
            )}
            {a.tco && (
              <div className="mt-6 border-t pt-5">
                <h3 className="mb-1 font-semibold">{t('assets.tco.title')}</h3>
                <p className="mb-4 text-xs text-muted-foreground">{t('assets.tco.note')}</p>
                <Row label={t('assets.tco.accumulatedDepreciation')}>{fmtMoney(a.tco.accumulatedDepreciation, i18n.language)}</Row>
                <Row label={t('assets.tco.maintenanceCost')}>{fmtMoney(a.tco.maintenanceCost, i18n.language)} <span className="text-xs text-muted-foreground">({a.tco.maintenanceOrders})</span></Row>
                {a.tco.leaseCost > 0 && <Row label={t('assets.tco.leaseCost')}>{fmtMoney(a.tco.leaseCost, i18n.language)}</Row>}
                {a.tco.costToBookRatio != null && (
                  <Row label={t('assets.tco.costToBookRatio')}>
                    <span className={a.tco.costToBookRatio > 0.5 ? 'font-semibold text-rose-500' : ''}>{Math.round(a.tco.costToBookRatio * 100)}%</span>
                  </Row>
                )}
                <div className="mt-3 flex items-center justify-between rounded-md bg-amber-500/10 px-3 py-3">
                  <span className="text-sm font-semibold">{t('assets.tco.total')}</span>
                  <span className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtMoney(a.tco.total, i18n.language)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'timeline' && <TimelineTab assetId={a.id} />}

      {editGeneral && <EditGeneralModal asset={a} onClose={() => setEditGeneral(false)} onSaved={() => { setEditGeneral(false); refresh(); }} />}
      {editVehicle && <EditVehicleModal asset={a} onClose={() => setEditVehicle(false)} onSaved={() => { setEditVehicle(false); refresh(); }} />}
      {editFinancial && a.financial && <EditFinancialModal asset={a} onClose={() => setEditFinancial(false)} onSaved={() => { setEditFinancial(false); refresh(); }} />}
      {changingStatus && <ChangeStatusModal asset={a} onClose={() => setChangingStatus(false)} onSaved={() => { setChangingStatus(false); refresh(); }} />}
    </div>
  );
}

function DocumentsTab({ asset, onChanged }: { asset: AssetProfile; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const canUpload = hasPermission('documents.upload');

  const [docType, setDocType] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('docType', docType);
      if (expiry) fd.append('expiryDate', expiry);
      return api.post(`/assets/${asset.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { setDocType(''); setExpiry(''); setFile(null); setError(''); onChanged(); },
    onError: (e) => setError(extractApiError(e)),
  });

  const del = useMutation({
    mutationFn: (docId: string) => api.delete(`/documents/${docId}`),
    onSuccess: onChanged,
  });

  async function download(docId: string) {
    const { data } = await api.get<{ url: string }>(`/documents/${docId}/url`);
    window.open(data.url, '_blank');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!file || !docType) return;
    upload.mutate();
  }

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
              <div className="space-y-1.5"><Label>{t('assets.documents.docType')}</Label>
                <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder={t('assets.documents.docTypePlaceholder')} required /></div>
              <div className="space-y-1.5"><Label>{t('assets.documents.expiry')}</Label>
                <Input type="date" dir="ltr" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{t('assets.documents.file')}</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
              <Button type="submit" disabled={upload.isPending || !file || !docType}>
                <Upload className="h-4 w-4" />{upload.isPending ? t('common.saving') : t('assets.documents.upload')}
              </Button>
            </form>
            {error && <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {asset.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('assets.documents.none')}</p>
          ) : (
            <div className="divide-y">
              {asset.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground"><FileText className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.docType}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.fileName} · {t('assets.documents.uploadedAt')} {fmtDate(d.createdAt)}{d.expiryDate ? ` · ${t('assets.documents.expiry')}: ${fmtDate(d.expiryDate)}` : ''}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => download(d.id)}><Download className="h-3.5 w-3.5" />{t('assets.documents.download')}</Button>
                  {canUpload && (
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                      onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('assets.documents.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(d.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TIMELINE_DOT: Record<string, string> = {
  CREATED: 'bg-slate-400', COMMISSIONED: 'bg-emerald-500', STATUS_CHANGE: 'bg-blue-500', UPDATED: 'bg-slate-400',
  REQUEST_RESERVED: 'bg-violet-500', CONTRACT_ISSUED: 'bg-primary', CONTRACT_RETURNED: 'bg-teal-500',
  INSPECTION_RECEIPT: 'bg-cyan-500', INSPECTION_RETURN: 'bg-cyan-500',
  WORK_ORDER_OPENED: 'bg-amber-500', WORK_ORDER_CLOSED: 'bg-emerald-500',
  SALE_PROPOSED: 'bg-amber-500', SALE_LISTED: 'bg-amber-500', SALE_SOLD: 'bg-rose-500',
  LEASE_STARTED: 'bg-indigo-500', DOCUMENT: 'bg-slate-400',
};

function TimelineTab({ assetId }: { assetId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ['asset-timeline', assetId],
    queryFn: async () => (await api.get<AssetTimeline>(`/assets/${assetId}/timeline`)).data,
    refetchInterval: 30_000,
  });
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  const refLabel = (kind: string, reference?: string | null) => {
    if (!reference) return null;
    if (kind === 'STATUS_CHANGE' && reference.includes('→')) {
      return reference.split('→').map((s) => t(`assetStatus.${s.trim()}`)).join(' → ');
    }
    return reference;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {q.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
        {q.data?.events.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
        <div className="space-y-0">
          {q.data?.events.map((e, idx) => {
            const ref = refLabel(e.kind, e.reference);
            return (
              <div key={idx} className="flex gap-3 border-s-2 ps-4 pb-4 last:pb-0">
                <div className="relative">
                  <span className={cn('absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-background', TIMELINE_DOT[e.kind] ?? 'bg-primary')} />
                </div>
                <div className="-mt-0.5 min-w-0">
                  <div className="text-sm font-medium">
                    {t(`assets.timelineKinds.${e.kind}`)}
                    {ref && <span className="ms-2 font-mono text-xs text-muted-foreground">{ref}</span>}
                  </div>
                  {e.context && <div className="truncate text-xs text-muted-foreground">{e.context}</div>}
                  <div className="text-xs text-muted-foreground">{e.actor ?? t('audit.system')} · {fmtDateTime(e.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AssetMaintenanceTab({ assetId }: { assetId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['asset-work-orders', assetId],
    queryFn: async () => (await api.get<WorkOrderSummary[]>('/maintenance', { params: { assetId } })).data,
  });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  return (
    <Card>
      <CardContent className="pt-6">
        {q.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
        {q.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('maintenance.none')}</p>}
        <div className="divide-y">
          {q.data?.map((w) => (
            <div key={w.id} className="flex cursor-pointer items-center gap-3 py-3 hover:bg-accent/40" onClick={() => navigate(`/maintenance/${w.id}`)}>
              <Badge variant={woStatusVariant[w.status]}>{t(`workOrderStatus.${w.status}`)}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t(`maintenanceType.${w.type}`)} · {t(`workOrderSource.${w.source}`)}</div>
                <div className="truncate text-xs text-muted-foreground">{w.description ?? '—'} · {fmtDate(w.openedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function EditGeneralModal({ asset, onClose, onSaved }: { asset: AssetProfile; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    model: asset.modelName ?? '', manufacturer: asset.manufacturer ?? '', year: asset.year?.toString() ?? '',
    region: asset.region ?? '', siteName: asset.siteName ?? '', color: asset.color ?? '',
    serialNo: asset.serialNo ?? '', capacity: asset.capacity ?? '',
    location: asset.location ?? '', purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
  });
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of asset.customFields) o[f.key] = asset.customValues?.[f.key] != null ? String(asset.customValues[f.key]) : '';
    return o;
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.patch(`/assets/${asset.id}`, {
      model: form.model || null,
      manufacturer: form.manufacturer || null,
      year: form.year ? Number(form.year) : undefined,
      region: form.region || null,
      siteName: form.siteName || null,
      color: form.color || null,
      serialNo: form.serialNo || null,
      capacity: form.capacity || null,
      location: form.location || null,
      purchaseDate: form.purchaseDate || null,
      ...(asset.customFields.length ? { customValues: custom } : {}),
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <ModalShell title={t('assets.edit')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('assets.manufacturer')}</Label>
            <LookupSelect type="MANUFACTURER" value={form.manufacturer || null} onChange={(v) => setForm({ ...form, manufacturer: v ?? '' })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.model')}</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{asset.fieldProfile === 'VEHICLE' ? t('assets.vin') : t('assets.serialNo')}</Label><Input dir="ltr" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.capacity')}</Label><Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.color')}</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.year')}</Label><Input type="number" dir="ltr" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.region')}</Label>
            <LookupSelect type="REGION" value={form.region || null} onChange={(v) => setForm({ ...form, region: v ?? '' })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.siteName')}</Label><Input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.purchaseDate')}</Label><Input type="date" dir="ltr" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>{t('assets.location')}</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        {asset.customFields.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assets.customFields')}</div>
            <div className="grid grid-cols-2 gap-3">
              {asset.customFields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{i18n.language === 'ar' ? f.labelAr : f.labelEn}</Label>
                  {f.type === 'SELECT' && f.options ? (
                    <Select value={custom[f.key] || ''} onValueChange={(v) => setCustom({ ...custom, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                      <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'} dir={f.type === 'TEXT' ? undefined : 'ltr'} value={custom[f.key] || ''} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </form>
    </ModalShell>
  );
}

function EditVehicleModal({ asset, onClose, onSaved }: { asset: AssetProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const v = asset.vehicle;
  const [form, setForm] = useState({
    plateNumber: v?.plateNumber ?? '',
    registrationExpiry: v?.registrationExpiry ? v.registrationExpiry.slice(0, 10) : '',
    periodicInspection: v?.periodicInspection ? v.periodicInspection.slice(0, 10) : '',
    operatingCardNo: v?.operatingCardNo ?? '',
    customsCardNo: v?.customsCardNo ?? '',
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.put(`/assets/${asset.id}/vehicle`, {
      plateNumber: form.plateNumber || null,
      registrationExpiry: form.registrationExpiry || null,
      periodicInspection: form.periodicInspection || null,
      operatingCardNo: form.operatingCardNo || null,
      customsCardNo: form.customsCardNo || null,
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <ModalShell title={t('assets.vehicle.title')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-1.5"><Label>{t('assets.vehicle.plateNumber')}</Label><Input dir="ltr" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('assets.vehicle.registrationExpiry')}</Label><Input type="date" dir="ltr" value={form.registrationExpiry} onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.vehicle.periodicInspection')}</Label><Input type="date" dir="ltr" value={form.periodicInspection} onChange={(e) => setForm({ ...form, periodicInspection: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('assets.vehicle.operatingCardNo')}</Label><Input value={form.operatingCardNo} onChange={(e) => setForm({ ...form, operatingCardNo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('assets.vehicle.customsCardNo')}</Label><Input value={form.customsCardNo} onChange={(e) => setForm({ ...form, customsCardNo: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </form>
    </ModalShell>
  );
}

function EditFinancialModal({ asset, onClose, onSaved }: { asset: AssetProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const f = asset.financial!;
  const [form, setForm] = useState({
    purchasePrice: f.purchasePrice?.toString() ?? '',
    depreciationRate: f.depreciationRate?.toString() ?? '',
    bookValue: f.manualBookValue?.toString() ?? '',
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.patch(`/assets/${asset.id}`, {
      purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
      depreciationRate: form.depreciationRate === '' ? null : Number(form.depreciationRate),
      bookValue: form.bookValue === '' ? null : Number(form.bookValue),
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <ModalShell title={t('assets.financial.title')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <p className="rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">{t('assets.financial.hybridNote')}</p>
        <div className="space-y-1.5"><Label>{t('assets.financial.purchasePrice')}</Label><Input type="number" step="any" dir="ltr" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>{t('assets.financial.depreciationRate')}</Label><Input type="number" step="any" dir="ltr" value={form.depreciationRate} onChange={(e) => setForm({ ...form, depreciationRate: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>{t('assets.financial.manualBookValue')}</Label><Input type="number" step="any" dir="ltr" value={form.bookValue} onChange={(e) => setForm({ ...form, bookValue: e.target.value })} /></div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </form>
    </ModalShell>
  );
}

function ChangeStatusModal({ asset, onClose, onSaved }: { asset: AssetProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(asset.allowedTransitions[0] ?? '');
  const [reason, setReason] = useState('');
  const [forSaleFlag, setForSaleFlag] = useState(false);
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/assets/${asset.id}/status`, {
      status, reason: reason || undefined,
      ...(status === 'FOR_SALE' ? { forSaleFlag } : {}),
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <ModalShell title={t('assets.changeStatusTitle')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-1.5">
          <Label>{t('assets.newStatus')}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {asset.allowedTransitions.map((s) => <SelectItem key={s} value={s}>{t(`assetStatus.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {status === 'FOR_SALE' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={forSaleFlag} onChange={(e) => setForSaleFlag(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t('assets.forSaleFlag')}
          </label>
        )}
        <div className="space-y-1.5"><Label>{t('assets.reason')}</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={mut.isPending || !status}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </form>
    </ModalShell>
  );
}
