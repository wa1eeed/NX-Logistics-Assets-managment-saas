import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Check, DollarSign, Ban } from 'lucide-react';
import { SaleOrderStatus, type AssetSummary, type SaleOrderSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { fmtMoney } from '../lib/asset-ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Pagination, usePagination } from '../components/Pagination';

const saleVariant: Record<SaleOrderStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  PROPOSED: 'warning', APPROVED: 'default', LISTED: 'default', SOLD: 'success', CANCELLED: 'destructive',
};

export function DisposalPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const showFinance = hasPermission('finance.read');

  const q = useQuery({ queryKey: ['sale-orders'], queryFn: async () => (await api.get<SaleOrderSummary[]>('/sale-orders')).data });
  const pg = usePagination(q.data ?? []);
  const [proposing, setProposing] = useState(false);
  const [completing, setCompleting] = useState<SaleOrderSummary | null>(null);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['sale-orders'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); };

  const approve = useMutation({ mutationFn: (id: string) => api.post(`/sale-orders/${id}/approve`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });
  const withdraw = useMutation({ mutationFn: (id: string) => api.post(`/sale-orders/${id}/withdraw`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  const canPropose = hasPermission('sale.create');
  const canApprove = hasPermission('sale.approve');
  const canComplete = hasPermission('sale.complete');

  return (
    <div>
      <PageHeader title={t('disposal.title')} subtitle={t('disposal.subtitle')}
        action={canPropose && <Button onClick={() => setProposing(true)}><Plus className="h-4 w-4" />{t('disposal.propose')}</Button>} />
      <p className="mb-4 rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">{t('disposal.sodNote')}</p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('disposal.asset')}</TableHead>
              <TableHead>{t('disposal.status')}</TableHead>
              {showFinance && <TableHead>{t('disposal.askingPrice')}</TableHead>}
              {showFinance && <TableHead>{t('disposal.salePrice')}</TableHead>}
              {showFinance && <TableHead>{t('disposal.profitLoss')}</TableHead>}
              <TableHead>{t('disposal.buyer')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={showFinance ? 8 : 5}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={showFinance ? 8 : 5}>{t('disposal.none')}</TableEmpty>}
            {pg.pageItems.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono font-semibold">{s.refNo}</TableCell>
                <TableCell className="font-mono text-xs">{s.assetCode} · {s.assetTypeName}</TableCell>
                <TableCell><Badge variant={saleVariant[s.status]}>{t(`saleStatus.${s.status}`)}</Badge></TableCell>
                {showFinance && <TableCell className="tabular-nums">{fmtMoney(s.askingPrice, i18n.language)}</TableCell>}
                {showFinance && <TableCell className="tabular-nums">{fmtMoney(s.salePrice, i18n.language)}</TableCell>}
                {showFinance && <TableCell className={`tabular-nums ${(s.profitLoss ?? 0) < 0 ? 'text-destructive' : (s.profitLoss ?? 0) > 0 ? 'text-success' : ''}`}>{fmtMoney(s.profitLoss, i18n.language)}</TableCell>}
                <TableCell>{s.buyerName ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {s.status === 'PROPOSED' && canApprove && <Button variant="outline" size="sm" onClick={() => approve.mutate(s.id)}><Check className="h-3.5 w-3.5" />{t('disposal.approve')}</Button>}
                    {s.status === 'LISTED' && canComplete && <Button variant="outline" size="sm" onClick={() => setCompleting(s)}><DollarSign className="h-3.5 w-3.5" />{t('disposal.complete')}</Button>}
                    {(s.status === 'PROPOSED' || s.status === 'LISTED') && canApprove && (
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => { if (await confirm({ title: t('disposal.withdraw'), description: t('disposal.confirmWithdraw'), destructive: true, confirmText: t('disposal.withdraw') })) withdraw.mutate(s.id); }}>
                        <Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>
      {proposing && <ProposeModal showFinance={showFinance} onClose={() => setProposing(false)} onSaved={() => { setProposing(false); invalidate(); }} />}
      {completing && <CompleteModal order={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); invalidate(); }} />}
    </div>
  );
}

function ProposeModal({ showFinance, onClose, onSaved }: { showFinance: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const assetsQ = useQuery({ queryKey: ['assets', 'owned-pool'], queryFn: async () => (await api.get<AssetSummary[]>('/assets', { params: { ownershipType: 'OWNED' } })).data });
  const [assetId, setAssetId] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/sale-orders', { assetId, askingPrice: askingPrice ? Number(askingPrice) : undefined }),
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  const eligible = (assetsQ.data ?? []).filter((a) => a.status !== 'DISPOSED' && a.status !== 'FOR_SALE');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('disposal.proposeTitle')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('disposal.asset')}</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{eligible.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.assetTypeName}</SelectItem>)}</SelectContent>
            </Select></div>
          {showFinance && <div className="space-y-1.5"><Label>{t('disposal.askingPrice')}</Label><Input type="number" dir="ltr" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} /></div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !assetId}>{mut.isPending ? t('common.saving') : t('disposal.propose')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteModal({ order, onClose, onSaved }: { order: SaleOrderSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [salePrice, setSalePrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/sale-orders/${order.id}/complete`, { salePrice: Number(salePrice), buyerName }),
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('disposal.completeTitle')} · {order.assetCode}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('disposal.salePrice')}</Label><Input type="number" dir="ltr" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>{t('disposal.buyer')}</Label><Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !salePrice || !buyerName}>{mut.isPending ? t('common.saving') : t('disposal.complete')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
