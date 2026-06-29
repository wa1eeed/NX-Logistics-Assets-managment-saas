import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AssetTypeSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { LookupSelect } from './LookupSelect';

/** Create/edit an equipment (asset) type — reused by the Asset Types page and Reference Lists settings. */
export function AssetTypeModal({ item, onClose, onSaved }: { item: AssetTypeSummary | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<string | null>(item?.category ?? null);
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = { name, category: category ?? null, unit: unit || undefined };
      return item ? api.patch(`/asset-types/${item.id}`, payload) : api.post('/asset-types', payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('assetTypes.edit') : t('assetTypes.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('assetTypes.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>{t('assetTypes.category')}</Label>
            <LookupSelect type="ASSET_CATEGORY" value={category} onChange={setCategory} /></div>
          <div className="space-y-1.5"><Label>{t('assetTypes.unit')} ({t('common.optional')})</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km / hours" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
