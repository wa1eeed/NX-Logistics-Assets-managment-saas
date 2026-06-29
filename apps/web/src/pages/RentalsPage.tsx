import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Check, X, FileSignature, CalendarPlus, Undo2, Ban, ClipboardCheck, Gauge, Truck, Hourglass } from 'lucide-react';
import {
  EquipmentRequestStatus, ContractStatus,
  type AssetSummary, type AssetTypeSummary, type DispatchKpis, type EquipmentRequestSummary, type RentalContractSummary,
} from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { Pagination, usePagination } from '../components/Pagination';
import { fmtMoney } from '../lib/asset-ui';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CreateRequestModal, ExtendModal, FormError } from '../components/rentals/modals';
import { HandoverDialog } from '../components/rentals/HandoverDialog';

const reqVariant: Record<EquipmentRequestStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  PENDING: 'warning', APPROVED: 'default', REJECTED: 'destructive', CANCELLED: 'secondary', FULFILLED: 'success',
};
const conVariant: Record<ContractStatus, 'default' | 'secondary' | 'success' | 'destructive'> = {
  ACTIVE: 'success', EXTENDED: 'default', RETURNED: 'secondary', CANCELLED: 'destructive',
};

export function RentalsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'requests' | 'contracts'>('requests');

  // Live count of requests that need action (awaiting approval or contract issuance).
  // Shares the ['requests'] cache with RequestsTab (react-query dedupes).
  const reqQ = useQuery({
    queryKey: ['requests'],
    queryFn: async () => (await api.get<EquipmentRequestSummary[]>('/rentals/requests')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const actionable = (reqQ.data ?? []).filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length;

  return (
    <div>
      <PageHeader title={t('rentals.title')} subtitle={t('rentals.subtitle')} />
      <DispatchKpiBand />
      <div className="mb-4 flex gap-1 border-b">
        {(['requests', 'contracts'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('relative inline-flex items-center px-4 py-2.5 text-sm font-medium transition-colors', tab === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t(`rentals.tabs.${k}`)}
            {k === 'requests' && actionable > 0 && (
              <span className="relative ms-2 inline-flex" title={t('rentals.needsAction')}>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold tabular-nums text-white">{actionable}</span>
              </span>
            )}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      {tab === 'requests' ? <RequestsTab /> : <ContractsTab />}
    </div>
  );
}

/** Dispatch / operations KPIs — fleet utilization and request pipeline. */
function DispatchKpiBand() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['kpis-dispatch'],
    queryFn: async () => (await api.get<DispatchKpis>('/kpis/dispatch')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  if (!data) return null;
  const utilColor = data.utilizationPct >= 70 ? 'text-emerald-500' : data.utilizationPct >= 40 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatTile label={t('dispatchKpis.utilization')} value={data.utilizationPct} suffix="%" icon={Gauge} tint="text-blue-500 bg-blue-500/10" valueClass={utilColor} />
      <StatTile label={t('dispatchKpis.inDuty')} value={data.fleet.inDuty} icon={Truck} tint="text-emerald-500 bg-emerald-500/10" />
      <StatTile label={t('dispatchKpis.available')} value={data.fleet.available} icon={Truck} tint="text-slate-500 bg-slate-500/10" />
      <StatTile label={t('dispatchKpis.pending')} value={data.requests.pending} icon={Hourglass} tint="text-amber-500 bg-amber-500/10" />
      <StatTile label={t('dispatchKpis.approved')} value={data.requests.approved} icon={Check} tint="text-violet-500 bg-violet-500/10" />
      <StatTile label={t('dispatchKpis.activeContracts')} value={data.activeContracts} icon={FileSignature} tint="text-teal-500 bg-teal-500/10" />
    </div>
  );
}

function RequestsTab() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState<EquipmentRequestSummary | null>(null);
  const [issuing, setIssuing] = useState<EquipmentRequestSummary | null>(null);
  const [dispatching, setDispatching] = useState<EquipmentRequestSummary | null>(null);

  const q = useQuery({ queryKey: ['requests'], queryFn: async () => (await api.get<EquipmentRequestSummary[]>('/rentals/requests')).data, refetchInterval: LIVE_REFETCH_MS });
  const pg = usePagination(q.data ?? []);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['requests'] }); void qc.invalidateQueries({ queryKey: ['contracts'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); };

  const reject = useMutation({ mutationFn: (id: string) => api.post(`/rentals/requests/${id}/reject`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/rentals/requests/${id}/cancel`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  const canRequest = hasPermission('rentals.request');
  const canApprove = hasPermission('rentals.approve');
  const canContract = hasPermission('rentals.contract');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  return (
    <div>
      {canRequest && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('rentals.newRequest')}</Button>
        </div>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rentals.orgUnit')}</TableHead>
              <TableHead>{t('rentals.assetType')}</TableHead>
              <TableHead>{t('rentals.period')}</TableHead>
              <TableHead>{t('rentals.reserved')}</TableHead>
              <TableHead>{t('assets.status')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={6}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={6}>{t('rentals.noRequests')}</TableEmpty>}
            {pg.pageItems.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.orgUnitName}</TableCell>
                <TableCell>{r.assetTypeName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(r.fromDate)} → {fmtDate(r.toDate)}</TableCell>
                <TableCell className="font-mono text-xs">{r.reservedAssetCode ?? '—'}</TableCell>
                <TableCell><Badge variant={reqVariant[r.status]}>{t(`requestStatus.${r.status}`)}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {r.status === 'PENDING' && canContract && (
                      <Button size="sm" onClick={() => setDispatching(r)}><Truck className="h-3.5 w-3.5" />{t('rentals.assignDispatch')}</Button>
                    )}
                    {r.status === 'PENDING' && canApprove && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setApproving(r)}><Check className="h-3.5 w-3.5" />{t('rentals.approve')}</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                          onClick={async () => { if (await confirm({ title: t('rentals.reject'), description: t('rentals.confirmReject'), destructive: true, confirmText: t('rentals.reject') })) reject.mutate(r.id); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && canContract && (
                      <Button variant="outline" size="sm" onClick={() => setIssuing(r)}><FileSignature className="h-3.5 w-3.5" />{t('rentals.issueContract')}</Button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'APPROVED') && canRequest && (
                      <Button variant="outline" size="sm" className="text-muted-foreground"
                        onClick={async () => { if (await confirm({ title: t('rentals.cancel'), description: t('rentals.confirmCancel'), confirmText: t('rentals.cancel') })) cancel.mutate(r.id); }}>
                        <Ban className="h-3.5 w-3.5" />
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

      {creating && <CreateRequestModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); invalidate(); }} />}
      {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} onSaved={() => { setApproving(null); invalidate(); }} />}
      {issuing && <IssueModal request={issuing} onClose={() => setIssuing(null)} onSaved={() => { setIssuing(null); invalidate(); }} />}
      {dispatching && <AssignDispatchModal request={dispatching} onClose={() => setDispatching(null)} onSaved={() => { setDispatching(null); invalidate(); }} />}
    </div>
  );
}

function ApproveModal({ request, onClose, onSaved }: { request: EquipmentRequestSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const assetsQ = useQuery({
    queryKey: ['available-assets', request.assetTypeId],
    queryFn: async () => (await api.get<AssetSummary[]>('/assets', { params: { status: 'AVAILABLE', assetTypeId: request.assetTypeId } })).data,
  });
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/rentals/requests/${request.id}/approve`, { assetId }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('rentals.approveTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5">
            <Label>{t('rentals.pickAsset')} — {request.assetTypeName}</Label>
            {assetsQ.data && assetsQ.data.length === 0 ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t('rentals.noAvailable')}</p>
            ) : (
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                <SelectContent>{assetsQ.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.modelName ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !assetId}>{mut.isPending ? t('common.saving') : t('rentals.approve')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Transport one-step: pick an available asset and dispatch it to the project. */
function AssignDispatchModal({ request, onClose, onSaved }: { request: EquipmentRequestSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const assetsQ = useQuery({
    queryKey: ['available-assets', request.assetTypeId],
    queryFn: async () => (await api.get<AssetSummary[]>('/assets', { params: { status: 'AVAILABLE', assetTypeId: request.assetTypeId } })).data,
  });
  const [assetId, setAssetId] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/rentals/requests/${request.id}/assign`, { assetId, internalRate: rate ? Number(rate) : undefined }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  const none = assetsQ.data && assetsQ.data.length === 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('rentals.assignDispatchTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <FormError message={error} />
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('rentals.orgUnit')}: </span><span className="font-semibold">{request.orgUnitName}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{request.assetTypeName}</span>
          </div>
          <div className="space-y-1.5">
            <Label>{t('rentals.pickAsset')}</Label>
            {none ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t('rentals.noAvailable')}</p>
            ) : (
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                <SelectContent>{assetsQ.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.modelName ?? a.assetTypeName}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          {hasPermission('finance.read') && (
            <div className="space-y-1.5"><Label>{t('rentals.internalRate')}</Label><Input type="number" step="any" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          )}
          <p className="text-xs text-muted-foreground">{t('rentals.assignDispatchHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !assetId}><Truck className="h-4 w-4" />{mut.isPending ? t('common.saving') : t('rentals.assignDispatch')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueModal({ request, onClose, onSaved }: { request: EquipmentRequestSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [authNo, setAuthNo] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/rentals/requests/${request.id}/contract`, {
      authorizationNo: authNo || undefined,
      internalRate: rate ? Number(rate) : undefined,
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('rentals.issueTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <FormError message={error} />
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('rentals.reserved')}: </span><span className="font-mono font-semibold">{request.reservedAssetCode}</span>
          </div>
          <div className="space-y-1.5"><Label>{t('rentals.authorizationNo')}</Label><Input dir="ltr" value={authNo} onChange={(e) => setAuthNo(e.target.value)} placeholder="AUTH-2026-…" /></div>
          {hasPermission('finance.read') && (
            <div className="space-y-1.5"><Label>{t('rentals.internalRate')}</Label><Input type="number" step="any" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('rentals.issueContract')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContractsTab() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const showFinance = hasPermission('finance.read');
  const [extending, setExtending] = useState<RentalContractSummary | null>(null);
  const [inspecting, setInspecting] = useState<RentalContractSummary | null>(null);

  const q = useQuery({ queryKey: ['contracts'], queryFn: async () => (await api.get<RentalContractSummary[]>('/rentals/contracts')).data, refetchInterval: LIVE_REFETCH_MS });
  const pg = usePagination(q.data ?? []);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['contracts'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); };
  const ret = useMutation({ mutationFn: (id: string) => api.post(`/rentals/contracts/${id}/return`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  const canExtend = hasPermission('rentals.extend');
  const canReturn = hasPermission('rentals.return');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  function daysBadge(days: number, status: ContractStatus) {
    if (status === 'RETURNED' || status === 'CANCELLED') return <span className="text-muted-foreground">—</span>;
    if (days < 0) return <Badge variant="destructive">{t('rentals.overdue')} ({days})</Badge>;
    if (days <= 14) return <Badge variant="warning">{days}</Badge>;
    return <Badge variant="outline">{days}</Badge>;
  }

  return (
    <div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rentals.authNo')}</TableHead>
              <TableHead>{t('rentals.asset')}</TableHead>
              <TableHead>{t('rentals.orgUnit')}</TableHead>
              <TableHead>{t('rentals.period')}</TableHead>
              <TableHead>{t('rentals.daysRemaining')}</TableHead>
              <TableHead>{t('assets.status')}</TableHead>
              {showFinance && <TableHead>{t('rentals.internalRate')}</TableHead>}
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={showFinance ? 8 : 7}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={showFinance ? 8 : 7}>{t('rentals.noContracts')}</TableEmpty>}
            {pg.pageItems.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-semibold">{c.authorizationNo}</TableCell>
                <TableCell className="font-mono text-xs">{c.assetCode}<span className="text-muted-foreground"> · {c.assetTypeName}</span></TableCell>
                <TableCell>{c.orgUnitName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</TableCell>
                <TableCell>{daysBadge(c.daysRemaining, c.status)}</TableCell>
                <TableCell><Badge variant={conVariant[c.status]}>{t(`contractStatus.${c.status}`)}</Badge></TableCell>
                {showFinance && <TableCell className="tabular-nums">{fmtMoney(c.internalRate, i18n.language)}</TableCell>}
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setInspecting(c)}><ClipboardCheck className="h-3.5 w-3.5" />{t('handover.inspect')}</Button>
                    {(c.status === 'ACTIVE' || c.status === 'EXTENDED') && (
                      <>
                        {canExtend && <Button variant="outline" size="sm" onClick={() => setExtending(c)}><CalendarPlus className="h-3.5 w-3.5" />{t('rentals.extend')}</Button>}
                        {canReturn && (
                          <Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: t('rentals.return'), description: t('rentals.confirmReturn'), confirmText: t('rentals.return') })) ret.mutate(c.id); }}>
                            <Undo2 className="h-3.5 w-3.5" />{t('rentals.return')}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>

      {extending && <ExtendModal contract={extending} onClose={() => setExtending(null)} onSaved={() => { setExtending(null); invalidate(); }} />}
      {inspecting && <HandoverDialog contract={inspecting} onClose={() => setInspecting(null)} />}
    </div>
  );
}
