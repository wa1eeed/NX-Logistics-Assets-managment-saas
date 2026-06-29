import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  SupplierDealType, type AssetSummary, type ExternalLeaseSummary, type SupplierSummary,
} from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { fmtMoney } from '../lib/asset-ui';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Pagination, usePagination } from '../components/Pagination';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export function AcquisitionPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'suppliers' | 'leases'>('suppliers');
  return (
    <div>
      <PageHeader title={t('acquisition.title')} subtitle={t('acquisition.subtitle')} />
      <div className="mb-4 flex gap-1 border-b">
        {(['suppliers', 'leases'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('relative px-4 py-2.5 text-sm font-medium transition-colors', tab === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t(`acquisition.tabs.${k}`)}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      {tab === 'suppliers' ? <SuppliersTab /> : <LeasesTab />}
    </div>
  );
}

function SuppliersTab() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const canManage = hasPermission('suppliers.manage');
  const q = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get<SupplierSummary[]>('/suppliers')).data });
  const pg = usePagination(q.data ?? []);
  const [edit, setEdit] = useState<SupplierSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['suppliers'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/suppliers/${id}`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  return (
    <div>
      {canManage && <div className="mb-4 flex justify-end"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('acquisition.newSupplier')}</Button></div>}
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('acquisition.supplierName')}</TableHead>
            <TableHead>{t('acquisition.dealType')}</TableHead>
            <TableHead>{t('acquisition.leaseCount')}</TableHead>
            {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={4}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={4}>{t('acquisition.noSuppliers')}</TableEmpty>}
            {pg.pageItems.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="secondary">{t(`acquisition.dealTypes.${s.dealType}`)}</Badge></TableCell>
                <TableCell><Badge variant="outline">{s.leaseCount}</Badge></TableCell>
                {canManage && <TableCell><div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                    onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('acquisition.confirmDeleteSupplier'), destructive: true, confirmText: t('common.delete') })) del.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5" /></Button>
                </div></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>
      {(creating || edit) && <SupplierModal item={edit} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); invalidate(); }} />}
    </div>
  );
}

function SupplierModal({ item, onClose, onSaved }: { item: SupplierSummary | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name ?? '');
  const [dealType, setDealType] = useState<string>(item?.dealType ?? SupplierDealType.BOTH);
  const [phone, setPhone] = useState<string>((item?.contact?.phone as string) ?? '');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = { name, dealType, contact: phone ? { phone } : undefined };
      return item ? api.patch(`/suppliers/${item.id}`, payload) : api.post('/suppliers', payload);
    },
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('common.edit') : t('acquisition.newSupplier')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('acquisition.supplierName')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>{t('acquisition.dealType')}</Label>
            <Select value={dealType} onValueChange={setDealType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.values(SupplierDealType).map((d) => <SelectItem key={d} value={d}>{t(`acquisition.dealTypes.${d}`)}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>{t('acquisition.contact')}</Label><Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966…" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeasesTab() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const showFinance = hasPermission('finance.read');
  const canManage = hasPermission('acquisition.manage');
  const q = useQuery({ queryKey: ['external-leases'], queryFn: async () => (await api.get<ExternalLeaseSummary[]>('/external-leases')).data });
  const pg = usePagination(q.data ?? []);
  const [creating, setCreating] = useState(false);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  return (
    <div>
      {canManage && <div className="mb-4 flex justify-end"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('acquisition.newLease')}</Button></div>}
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('acquisition.asset')}</TableHead>
            <TableHead>{t('acquisition.supplier')}</TableHead>
            {showFinance && <TableHead>{t('acquisition.rate')}</TableHead>}
            <TableHead>{t('acquisition.maintenanceBearer')}</TableHead>
            <TableHead>{t('acquisition.insuranceBearer')}</TableHead>
            <TableHead>{t('acquisition.daysRemaining')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={showFinance ? 7 : 6}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={showFinance ? 7 : 6}>{t('acquisition.noLeases')}</TableEmpty>}
            {pg.pageItems.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono font-semibold">{l.refNo}</TableCell>
                <TableCell className="font-mono text-xs">{l.assetCode}</TableCell>
                <TableCell>{l.supplierName}</TableCell>
                {showFinance && <TableCell className="tabular-nums">{fmtMoney(l.periodicRate, i18n.language)}<span className="text-xs text-muted-foreground"> / {l.ratePeriod}</span></TableCell>}
                <TableCell><Badge variant={l.maintenanceBearer === 'COMPANY' ? 'warning' : 'secondary'}>{l.maintenanceBearer ? t(`acquisition.bearer.${l.maintenanceBearer}`) : '—'}</Badge></TableCell>
                <TableCell><Badge variant={l.insuranceBearer === 'COMPANY' ? 'warning' : 'secondary'}>{l.insuranceBearer ? t(`acquisition.bearer.${l.insuranceBearer}`) : '—'}</Badge></TableCell>
                <TableCell className="tabular-nums">{l.daysRemaining}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>
      {creating && <LeaseModal showFinance={showFinance} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void qc.invalidateQueries({ queryKey: ['external-leases'] }); }} />}
    </div>
  );
}

function LeaseModal({ showFinance, onClose, onSaved }: { showFinance: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const assetsQ = useQuery({ queryKey: ['assets', 'rented-pool'], queryFn: async () => (await api.get<AssetSummary[]>('/assets', { params: { ownershipType: 'EXTERNALLY_RENTED' } })).data });
  const suppliersQ = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get<SupplierSummary[]>('/suppliers')).data });
  const [form, setForm] = useState({ assetId: '', supplierId: '', periodicRate: '', ratePeriod: 'MONTHLY', startDate: '', endDate: '', maintenanceBearer: 'SUPPLIER', insuranceBearer: 'SUPPLIER' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/external-leases', { ...form, periodicRate: Number(form.periodicRate) }),
    onSuccess: onSaved, onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('acquisition.newLease')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('acquisition.asset')}</Label>
            <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{assetsQ.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.assetTypeName}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>{t('acquisition.supplier')}</Label>
            <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{suppliersQ.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select></div>
          {showFinance && <div className="space-y-1.5"><Label>{t('acquisition.rate')}</Label><Input type="number" dir="ltr" value={form.periodicRate} onChange={(e) => setForm({ ...form, periodicRate: e.target.value })} required /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('acquisition.from')}</Label><Input type="date" dir="ltr" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>{t('acquisition.to')}</Label><Input type="date" dir="ltr" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('acquisition.maintenanceBearer')}</Label>
              <Select value={form.maintenanceBearer} onValueChange={(v) => setForm({ ...form, maintenanceBearer: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COMPANY">{t('acquisition.bearer.COMPANY')}</SelectItem><SelectItem value="SUPPLIER">{t('acquisition.bearer.SUPPLIER')}</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t('acquisition.insuranceBearer')}</Label>
              <Select value={form.insuranceBearer} onValueChange={(v) => setForm({ ...form, insuranceBearer: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COMPANY">{t('acquisition.bearer.COMPANY')}</SelectItem><SelectItem value="SUPPLIER">{t('acquisition.bearer.SUPPLIER')}</SelectItem></SelectContent>
              </Select></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !form.assetId || !form.supplierId}>{mut.isPending ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
