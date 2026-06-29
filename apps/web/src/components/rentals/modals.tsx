import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AssetTypeSummary, RentalContractSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}

/** Create an equipment request. Org units come from the caller-scoped lookup. */
export function CreateRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const orgsQ = useQuery({ queryKey: ['rental-orgs'], queryFn: async () => (await api.get<{ id: string; name: string }[]>('/rentals/requests/lookups/org-units')).data });
  const typesQ = useQuery({ queryKey: ['asset-types'], queryFn: async () => (await api.get<AssetTypeSummary[]>('/asset-types')).data });
  const [form, setForm] = useState({ orgUnitId: '', assetTypeId: '', fromDate: '', toDate: '', notes: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/rentals/requests', { ...form, notes: form.notes || undefined }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('rentals.newRequest')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5"><Label>{t('rentals.orgUnit')}</Label>
            <Select value={form.orgUnitId} onValueChange={(v) => setForm({ ...form, orgUnitId: v })}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{orgsQ.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>{t('rentals.assetType')}</Label>
            <Select value={form.assetTypeId} onValueChange={(v) => setForm({ ...form, assetTypeId: v })}>
              <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{typesQ.data?.map((tp) => <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('rentals.from')}</Label><Input type="date" dir="ltr" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>{t('rentals.to')}</Label><Input type="date" dir="ltr" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} required /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('rentals.notes')}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !form.orgUnitId || !form.assetTypeId}>{mut.isPending ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Extend a contract's end date. */
export function ExtendModal({ contract, onClose, onSaved }: { contract: RentalContractSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [endDate, setEndDate] = useState(contract.endDate.slice(0, 10));
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/rentals/contracts/${contract.id}/extend`, { endDate }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('rentals.extendTitle')} · {contract.authorizationNo}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); mut.mutate(); }} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5"><Label>{t('rentals.newEndDate')}</Label><Input type="date" dir="ltr" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('rentals.extend')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
