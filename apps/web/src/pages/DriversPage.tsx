import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import type { DriverSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Pagination, usePagination } from '../components/Pagination';

interface AssignableVehicle {
  assetId: string;
  code: string;
  plateNumber: string | null;
  currentDriverId: string | null;
  currentDriverName: string | null;
}

export function DriversPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const canManage = hasPermission('drivers.manage');

  const q = useQuery({ queryKey: ['drivers'], queryFn: async () => (await api.get<DriverSummary[]>('/drivers')).data });
  const pg = usePagination(q.data ?? []);
  const [edit, setEdit] = useState<DriverSummary | null>(null);
  const [assigning, setAssigning] = useState<DriverSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['drivers'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/drivers/${id}`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');

  return (
    <div>
      <PageHeader title={t('drivers.title')} subtitle={t('drivers.subtitle')}
        action={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('drivers.new')}</Button>} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('drivers.fullName')}</TableHead>
              <TableHead>{t('drivers.iqama')}</TableHead>
              <TableHead>{t('drivers.licenseExpiry')}</TableHead>
              <TableHead>{t('drivers.iqamaExpiry')}</TableHead>
              <TableHead>{t('drivers.assignedVehicle')}</TableHead>
              <TableHead>{t('drivers.status')}</TableHead>
              {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={7}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={7}>{t('drivers.none')}</TableEmpty>}
            {pg.pageItems.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.fullName}</TableCell>
                <TableCell className="font-mono text-xs">{d.iqamaNumber ?? '—'}</TableCell>
                <TableCell className="text-xs">{fmt(d.licenseExpiry)}</TableCell>
                <TableCell className="text-xs">{fmt(d.iqamaExpiry)}</TableCell>
                <TableCell className="font-mono text-xs">{d.assignedVehicleCode ?? '—'}</TableCell>
                <TableCell><Badge variant={d.isActive ? 'success' : 'destructive'}>{d.isActive ? t('common.active') : t('common.inactive')}</Badge></TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {d.isActive && <Button variant="outline" size="sm" onClick={() => setAssigning(d)} title={t('drivers.assign')}><Truck className="h-3.5 w-3.5" /></Button>}
                      <Button variant="outline" size="sm" onClick={() => setEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {d.isActive && <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('drivers.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(d.id); }}>
                        <Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>
      {(creating || edit) && <DriverModal item={edit} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); invalidate(); }} />}
      {assigning && <AssignVehicleModal driver={assigning} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); invalidate(); }} />}
    </div>
  );
}

function AssignVehicleModal({ driver, onClose, onSaved }: { driver: DriverSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const vq = useQuery({ queryKey: ['assignable-vehicles'], queryFn: async () => (await api.get<AssignableVehicle[]>('/drivers/assignable-vehicles')).data });
  const [assetId, setAssetId] = useState<string>('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.patch(`/drivers/${driver.id}/assign`, { assetId: assetId || null }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('drivers.assignTitle', { name: driver.fullName })}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <p className="text-sm text-muted-foreground">{t('drivers.currentVehicle')}: <span className="font-mono">{driver.assignedVehicleCode ?? '—'}</span></p>
          <div className="space-y-1.5">
            <Label>{t('drivers.selectVehicle')}</Label>
            <Select value={assetId || '__none__'} onValueChange={(v) => setAssetId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('drivers.unassign')}</SelectItem>
                {vq.data?.map((v) => (
                  <SelectItem key={v.assetId} value={v.assetId}>
                    {v.code}{v.plateNumber ? ` · ${v.plateNumber}` : ''}{v.currentDriverId && v.currentDriverId !== driver.id ? ` — ${v.currentDriverName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DriverModal({ item, onClose, onSaved }: { item: DriverSummary | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: item?.fullName ?? '', iqamaNumber: item?.iqamaNumber ?? '',
    licenseExpiry: item?.licenseExpiry ? item.licenseExpiry.slice(0, 10) : '',
    iqamaExpiry: item?.iqamaExpiry ? item.iqamaExpiry.slice(0, 10) : '',
    isActive: item?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: form.fullName, iqamaNumber: form.iqamaNumber || undefined,
        licenseExpiry: form.licenseExpiry || null, iqamaExpiry: form.iqamaExpiry || null,
        ...(item ? { isActive: form.isActive } : {}),
      };
      return item ? api.patch(`/drivers/${item.id}`, payload) : api.post('/drivers', payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('drivers.edit') : t('drivers.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('drivers.fullName')}</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>{t('drivers.iqama')}</Label><Input dir="ltr" value={form.iqamaNumber} onChange={(e) => setForm({ ...form, iqamaNumber: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('drivers.licenseExpiry')}</Label><Input type="date" dir="ltr" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('drivers.iqamaExpiry')}</Label><Input type="date" dir="ltr" value={form.iqamaExpiry} onChange={(e) => setForm({ ...form, iqamaExpiry: e.target.value })} /></div>
          </div>
          {item && <div className="flex items-center gap-2"><Checkbox id="dactive" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: !!v })} /><Label htmlFor="dactive">{t('common.active')}</Label></div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
