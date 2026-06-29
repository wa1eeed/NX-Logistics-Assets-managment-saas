import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { AssetClassSummary, AssetTypeSummary, ModelSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { TableEmpty } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LookupSelect } from '../components/LookupSelect';

const PROFILES = ['VEHICLE', 'EQUIPMENT', 'GENERIC'];

/** Asset classification (VEHICLE / EQUIPMENT / GENERIC field profiles). This is "the catalog". */
export function ClassesSection() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('asset_types.manage');
  const q = useQuery({ queryKey: ['asset-classes'], queryFn: async () => (await api.get<AssetClassSummary[]>('/asset-classes')).data });
  const [edit, setEdit] = useState<AssetClassSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['asset-classes'] });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('catalog.classes')}</CardTitle>
        {canManage && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('catalog.newClass')}</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('catalog.code')}</TableHead>
            <TableHead>{t('catalog.label')}</TableHead>
            <TableHead>{t('catalog.fieldProfile')}</TableHead>
            <TableHead>{t('catalog.types')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableEmpty colSpan={6}>{t('common.noResults')}</TableEmpty>}
            {q.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                <TableCell>{i18n.language === 'ar' && c.labelAr ? c.labelAr : c.labelEn}</TableCell>
                <TableCell><Badge variant="outline">{c.fieldProfile}</Badge></TableCell>
                <TableCell className="tabular-nums">{c.typeCount}</TableCell>
                <TableCell><Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? t('common.active') : t('common.inactive')}</Badge></TableCell>
                {canManage && <TableCell><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></div></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {(creating || edit) && <ClassModal item={edit} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); invalidate(); }} />}
    </Card>
  );
}

function ClassModal({ item, onClose, onSaved }: { item: AssetClassSummary | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    code: item?.code ?? '', labelEn: item?.labelEn ?? '', labelAr: item?.labelAr ?? '',
    fieldProfile: item?.fieldProfile ?? 'GENERIC', isActive: item?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = { labelEn: form.labelEn, labelAr: form.labelAr || undefined, fieldProfile: form.fieldProfile, isActive: form.isActive };
      return item ? api.patch(`/asset-classes/${item.id}`, payload) : api.post('/asset-classes', { ...payload, code: form.code });
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('catalog.editClass') : t('catalog.newClass')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {!item && <div className="space-y-1.5"><Label>{t('catalog.code')}</Label><Input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VEHICLE" required /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('catalog.labelEn')}</Label><Input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>{t('catalog.labelAr')}</Label><Input dir="rtl" value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('catalog.fieldProfile')}</Label>
            <Select value={form.fieldProfile} onValueChange={(v) => setForm({ ...form, fieldProfile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROFILES.map((p) => <SelectItem key={p} value={p}>{t(`catalog.profiles.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('catalog.fieldProfileHint')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Vehicle models — linked to a brand (manufacturer). Managed under the brands tab. */
export function ModelsSection() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const canManage = hasPermission('asset_types.manage');
  const [brand, setBrand] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['models', brand ?? 'all'], queryFn: async () => (await api.get<ModelSummary[]>('/models', { params: { manufacturer: brand || undefined } })).data });
  const typesQ = useQuery({ queryKey: ['asset-types'], queryFn: async () => (await api.get<AssetTypeSummary[]>('/asset-types')).data });
  const [edit, setEdit] = useState<ModelSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['models'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/models/${id}`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">{t('catalog.vehicleModels')}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('catalog.vehicleModelsHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-48"><LookupSelect type="MANUFACTURER" value={brand} onChange={setBrand} /></div>
          {canManage && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('catalog.newModel')}</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('catalog.brand')}</TableHead>
            <TableHead>{t('catalog.modelName')}</TableHead>
            <TableHead>{t('catalog.category')}</TableHead>
            <TableHead>{t('catalog.type')}</TableHead>
            <TableHead>{t('catalog.assets')}</TableHead>
            {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableEmpty colSpan={6}>{t('common.noResults')}</TableEmpty>}
            {q.data?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.manufacturer}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.category ?? '—'}</TableCell>
                <TableCell>{m.assetTypeName}{m.assetClassCode && <span className="ms-1.5 text-xs text-muted-foreground">({m.assetClassCode})</span>}</TableCell>
                <TableCell className="tabular-nums">{m.assetCount}</TableCell>
                {canManage && <TableCell><div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('catalog.confirmDeleteModel'), destructive: true, confirmText: t('common.delete') })) del.mutate(m.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {(creating || edit) && <ModelModal item={edit} types={typesQ.data ?? []} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); invalidate(); }} />}
    </Card>
  );
}

function ModelModal({ item, types, onClose, onSaved }: { item: ModelSummary | null; types: AssetTypeSummary[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    manufacturer: item?.manufacturer ?? '', name: item?.name ?? '', category: item?.category ?? '', assetTypeId: item?.assetTypeId ?? '',
  });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = { manufacturer: form.manufacturer, name: form.name, category: form.category || undefined, assetTypeId: form.assetTypeId };
      return item ? api.patch(`/models/${item.id}`, payload) : api.post('/models', payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('catalog.editModel') : t('catalog.newModel')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('catalog.brand')}</Label>
            <LookupSelect type="MANUFACTURER" value={form.manufacturer || null} onChange={(v) => setForm({ ...form, manufacturer: v ?? '' })} /></div>
          <div className="space-y-1.5"><Label>{t('catalog.modelName')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('catalog.type')}</Label>
              <Select value={form.assetTypeId} onValueChange={(v) => setForm({ ...form, assetTypeId: v })}>
                <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                <SelectContent>{types.map((tp) => <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t('catalog.category')}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !form.manufacturer || !form.name || !form.assetTypeId}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
