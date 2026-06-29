import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Play, CheckCircle2, Ban, Save, Plus, Trash2, Upload, Download, FileText,
} from 'lucide-react';
import type { MaintenancePart, WorkOrderDetail } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { woStatusVariant } from './MaintenanceListPage';
import { fmtMoney } from '../lib/asset-ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-end">{children ?? '—'}</span>
    </div>
  );
}

export function WorkOrderDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [closing, setClosing] = useState(false);

  const q = useQuery({ queryKey: ['work-order', id], queryFn: async () => (await api.get<WorkOrderDetail>(`/maintenance/${id}`)).data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['work-order', id] }); void qc.invalidateQueries({ queryKey: ['work-orders'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); };

  const start = useMutation({ mutationFn: () => api.post(`/maintenance/${id}/start`), onSuccess: refresh, onError: (e) => alert(extractApiError(e)) });
  const cancel = useMutation({ mutationFn: () => api.post(`/maintenance/${id}/cancel`), onSuccess: refresh, onError: (e) => alert(extractApiError(e)) });

  if (q.isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  if (q.isError || !q.data) return <div className="py-12 text-center text-sm text-destructive">{t('errors.generic')}</div>;
  const w = q.data;

  const editable = w.status === 'OPEN' || w.status === 'IN_PROGRESS';
  const canCreate = hasPermission('maintenance.create');
  const canClose = hasPermission('maintenance.close');
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/maintenance')}>
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('maintenance.backToList')}
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold">{w.assetCode}</h1>
            <Badge variant={woStatusVariant[w.status]}>{t(`workOrderStatus.${w.status}`)}</Badge>
            <Badge variant={w.type === 'PREVENTIVE' ? 'secondary' : 'outline'}>{t(`maintenanceType.${w.type}`)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{w.assetTypeName} · {t(`workOrderSource.${w.source}`)}</p>
        </div>
        <div className="flex gap-2">
          {w.status === 'OPEN' && canCreate && <Button onClick={() => start.mutate()}><Play className="h-4 w-4" />{t('maintenance.start')}</Button>}
          {w.status === 'IN_PROGRESS' && canClose && <Button onClick={() => setClosing(true)}><CheckCircle2 className="h-4 w-4" />{t('maintenance.close')}</Button>}
          {editable && canCreate && (
            <Button variant="outline" className="text-destructive hover:bg-destructive/10"
              onClick={async () => { if (await confirm({ title: t('maintenance.cancel'), description: t('maintenance.confirmCancel'), destructive: true, confirmText: t('maintenance.cancel') })) cancel.mutate(); }}>
              <Ban className="h-4 w-4" />{t('maintenance.cancel')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <Row label={t('maintenance.source')}>{t(`workOrderSource.${w.source}`)}</Row>
            <Row label={t('maintenance.priority')}>{w.priority}</Row>
            <Row label={t('maintenance.description')}>{w.description}</Row>
            <Row label={t('maintenance.openedAt')}>{fmtDate(w.openedAt)}</Row>
            <Row label={t('maintenance.closedAt')}>{fmtDate(w.closedAt)}</Row>
            <Row label={t('maintenance.cost')}>{fmtMoney(w.totalCost, i18n.language)}</Row>
          </CardContent>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <MaintenanceCardEditor workOrder={w} editable={editable && hasPermission('maintenance.card')} onSaved={refresh} />
          <InvoicesSection workOrder={w} onChanged={refresh} />
        </div>
      </div>

      {closing && <CloseModal id={id} onClose={() => setClosing(false)} onSaved={() => { setClosing(false); refresh(); }} />}
    </div>
  );
}

function MaintenanceCardEditor({ workOrder, editable, onSaved }: { workOrder: WorkOrderDetail; editable: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const [worksDone, setWorksDone] = useState('');
  const [parts, setParts] = useState<MaintenancePart[]>([]);
  const [technician, setTechnician] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const c = workOrder.card;
    setWorksDone(c?.worksDone ?? '');
    setParts(c?.parts ?? []);
    setTechnician(c?.technician ?? '');
    setLaborHours(c?.laborHours != null ? String(c.laborHours) : '');
  }, [workOrder.card]);

  const mut = useMutation({
    mutationFn: () => api.put(`/maintenance/${workOrder.id}/card`, {
      worksDone: worksDone || undefined,
      parts: parts.filter((p) => p.name).map((p) => ({ name: p.name, quantity: p.quantity ?? undefined, cost: p.cost ?? undefined })),
      technician: technician || undefined,
      laborHours: laborHours ? Number(laborHours) : undefined,
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });

  function setPart(i: number, patch: Partial<MaintenancePart>) {
    setParts(parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{t('maintenance.card.title')}</h3>
          {editable && <Button size="sm" onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending}><Save className="h-3.5 w-3.5" />{mut.isPending ? t('common.saving') : t('maintenance.card.save')}</Button>}
        </div>
        {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="space-y-4">
          <div className="space-y-1.5"><Label>{t('maintenance.card.worksDone')}</Label>
            <Textarea value={worksDone} onChange={(e) => setWorksDone(e.target.value)} disabled={!editable} /></div>

          <div>
            <Label>{t('maintenance.card.parts')}</Label>
            <div className="mt-1.5 space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] items-center gap-2">
                  <Input placeholder={t('maintenance.card.partName')} value={p.name} disabled={!editable} onChange={(e) => setPart(i, { name: e.target.value })} />
                  <Input type="number" dir="ltr" placeholder={t('maintenance.card.qty')} value={p.quantity ?? ''} disabled={!editable} onChange={(e) => setPart(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })} />
                  <Input type="number" dir="ltr" placeholder={t('maintenance.card.partCost')} value={p.cost ?? ''} disabled={!editable} onChange={(e) => setPart(i, { cost: e.target.value === '' ? null : Number(e.target.value) })} />
                  {editable && <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setParts(parts.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              {parts.length === 0 && !editable && <p className="text-sm text-muted-foreground">{t('common.none')}</p>}
            </div>
            {editable && <Button variant="soft" size="sm" className="mt-2" onClick={() => setParts([...parts, { name: '', quantity: null, cost: null }])}><Plus className="h-4 w-4" />{t('maintenance.card.addPart')}</Button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('maintenance.card.technician')}</Label><Input value={technician} disabled={!editable} onChange={(e) => setTechnician(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('maintenance.card.laborHours')}</Label><Input type="number" step="any" dir="ltr" value={laborHours} disabled={!editable} onChange={(e) => setLaborHours(e.target.value)} /></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoicesSection({ workOrder, onChanged }: { workOrder: WorkOrderDetail; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const canUpload = hasPermission('documents.upload');
  const [docType, setDocType] = useState('Invoice');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('docType', docType);
      return api.post(`/maintenance/${workOrder.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { setFile(null); setError(''); onChanged(); },
    onError: (e) => setError(extractApiError(e)),
  });
  const del = useMutation({ mutationFn: (docId: string) => api.delete(`/documents/${docId}`), onSuccess: onChanged });

  async function download(docId: string) {
    const { data } = await api.get<{ url: string }>(`/documents/${docId}/url`);
    window.open(data.url, '_blank');
  }
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 font-semibold">{t('maintenance.invoices.title')}</h3>
        {canUpload && (
          <form onSubmit={(e) => { e.preventDefault(); if (file) upload.mutate(); }} className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <div className="space-y-1.5"><Label>{t('maintenance.invoices.docType')}</Label><Input value={docType} onChange={(e) => setDocType(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('maintenance.invoices.file')}</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <Button type="submit" disabled={upload.isPending || !file}><Upload className="h-4 w-4" />{upload.isPending ? t('common.saving') : t('maintenance.invoices.upload')}</Button>
          </form>
        )}
        {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        {workOrder.documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('maintenance.invoices.none')}</p>
        ) : (
          <div className="divide-y">
            {workOrder.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground"><FileText className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.docType}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.fileName} · {fmtDate(d.createdAt)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => download(d.id)}><Download className="h-3.5 w-3.5" />{t('maintenance.invoices.download')}</Button>
                {canUpload && (
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                    onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('maintenance.invoices.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(d.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CloseModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [totalCost, setTotalCost] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/maintenance/${id}/close`, { totalCost: totalCost ? Number(totalCost) : undefined }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('maintenance.closeTitle')}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('maintenance.totalCost')}</Label><Input type="number" step="any" dir="ltr" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('maintenance.close')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
