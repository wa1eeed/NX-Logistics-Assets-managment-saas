import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Eye, FileText, Wrench, DollarSign, Timer, ShieldCheck } from 'lucide-react';
import {
  WorkOrderStatus, WorkOrderSource, MaintenanceType,
  type AssetSummary, type MaintenanceKpis, type WorkOrderSummary,
} from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { Pagination, usePagination } from '../components/Pagination';
import { BarList } from '../components/charts/BarList';
import { CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { fmtMoney } from '../lib/asset-ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

export const woStatusVariant: Record<WorkOrderStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  OPEN: 'warning', IN_PROGRESS: 'default', CLOSED: 'success', CANCELLED: 'destructive',
};

export function MaintenanceListPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ['work-orders', status, type],
    queryFn: async () => (await api.get<WorkOrderSummary[]>('/maintenance', { params: { status: status || undefined, type: type || undefined } })).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const canCreate = hasPermission('maintenance.create');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');
  const pg = usePagination(q.data ?? []);

  return (
    <div>
      <PageHeader
        title={t('maintenance.title')}
        subtitle={t('maintenance.subtitle')}
        action={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('maintenance.new')}</Button>}
      />

      <MaintenanceKpiBand />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status || '__all__'} onValueChange={(v) => setStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('maintenance.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('maintenance.status')} — {t('common.all')}</SelectItem>
            {Object.values(WorkOrderStatus).map((s) => <SelectItem key={s} value={s}>{t(`workOrderStatus.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type || '__all__'} onValueChange={(v) => setType(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('maintenance.type')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('maintenance.type')} — {t('common.all')}</SelectItem>
            {Object.values(MaintenanceType).map((s) => <SelectItem key={s} value={s}>{t(`maintenanceType.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('maintenance.asset')}</TableHead>
              <TableHead>{t('maintenance.type')}</TableHead>
              <TableHead>{t('maintenance.source')}</TableHead>
              <TableHead>{t('maintenance.status')}</TableHead>
              <TableHead>{t('maintenance.priority')}</TableHead>
              <TableHead>{t('maintenance.openedAt')}</TableHead>
              <TableHead>{t('maintenance.cost')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={8}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={8}>{t('maintenance.none')}</TableEmpty>}
            {pg.pageItems.map((w) => (
              <TableRow key={w.id} className="cursor-pointer" onClick={() => navigate(`/maintenance/${w.id}`)}>
                <TableCell className="font-mono font-semibold">{w.assetCode}<span className="text-muted-foreground"> · {w.assetTypeName}</span></TableCell>
                <TableCell><Badge variant={w.type === 'PREVENTIVE' ? 'secondary' : 'outline'}>{t(`maintenanceType.${w.type}`)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{t(`workOrderSource.${w.source}`)}</TableCell>
                <TableCell><Badge variant={woStatusVariant[w.status]}>{t(`workOrderStatus.${w.status}`)}</Badge></TableCell>
                <TableCell>{w.priority ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(w.openedAt)}</TableCell>
                <TableCell className="tabular-nums">{fmtMoney(w.totalCost, i18n.language)}{w.documentCount > 0 && <span className="ms-2 inline-flex items-center gap-0.5 text-xs text-muted-foreground"><FileText className="h-3 w-3" />{w.documentCount}</span>}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/maintenance/${w.id}`)}><Eye className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>

      {creating && <CreateWorkOrderModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/maintenance/${id}`)} />}
    </div>
  );
}

/** Maintenance department KPIs — cost, MTTR, preventive ratio, top-cost assets. */
function MaintenanceKpiBand() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ['kpis-maintenance'],
    queryFn: async () => (await api.get<MaintenanceKpis>('/kpis/maintenance')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  if (!data) return null;
  const pv = data.preventiveVsCorrective;
  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t('maintKpis.open')} value={data.totals.open} icon={Wrench} tint="text-amber-500 bg-amber-500/10" />
        <StatTile label={t('maintKpis.inProgress')} value={data.totals.inProgress} icon={Timer} tint="text-blue-500 bg-blue-500/10" />
        <StatTile label={t('maintKpis.closed')} value={data.totals.closed} icon={ShieldCheck} tint="text-emerald-500 bg-emerald-500/10" />
        <StatTile label={t('maintKpis.totalCost')} value={Math.round(data.cost.total)} icon={DollarSign} tint="text-violet-500 bg-violet-500/10" />
        <StatTile label={t('maintKpis.mttr')} value={data.mttrDays ?? 0} suffix={i18n.language === 'ar' ? ' ي' : 'd'} icon={Timer} tint="text-slate-500 bg-slate-500/10" />
        <StatTile label={t('maintKpis.preventivePct')} value={pv.preventivePct} suffix="%" icon={ShieldCheck} tint="text-teal-500 bg-teal-500/10" />
      </div>
      {data.topCostAssets.length > 0 && (
        <div className="rounded-lg border bg-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('maintKpis.topCostAssets')}</CardTitle></CardHeader>
          <CardContent>
            <BarList
              color="hsl(var(--primary))"
              items={data.topCostAssets.map((a) => ({ label: `${a.assetCode} · ${a.orders}×`, count: Math.round(a.cost), pct: Math.round((a.cost / Math.max(1, data.topCostAssets[0].cost)) * 100) }))}
            />
          </CardContent>
        </div>
      )}
    </div>
  );
}

function CreateWorkOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const assetsQ = useQuery({ queryKey: ['assets', '', '', '', ''], queryFn: async () => (await api.get<AssetSummary[]>('/assets')).data });
  const qc = useQueryClient();
  const [form, setForm] = useState({ assetId: '', source: WorkOrderSource.BREAKDOWN as string, type: MaintenanceType.CORRECTIVE as string, priority: '', description: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: async () => (await api.post('/maintenance', { ...form, priority: form.priority || undefined, description: form.description || undefined })).data,
    onSuccess: (d) => { void qc.invalidateQueries({ queryKey: ['work-orders'] }); onCreated(d.id); },
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('maintenance.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('maintenance.selectAsset')}</Label>
            <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{assetsQ.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.assetTypeName}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('maintenance.source')}</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(WorkOrderSource).map((s) => <SelectItem key={s} value={s}>{t(`workOrderSource.${s}`)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t('maintenance.type')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(MaintenanceType).map((s) => <SelectItem key={s} value={s}>{t(`maintenanceType.${s}`)}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1.5"><Label>{t('maintenance.priority')}</Label><Input value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} placeholder="High / Medium / Low" /></div>
          <div className="space-y-1.5"><Label>{t('maintenance.description')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !form.assetId}>{mut.isPending ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
