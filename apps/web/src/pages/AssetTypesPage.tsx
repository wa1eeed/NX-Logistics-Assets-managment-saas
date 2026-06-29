import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, SlidersHorizontal, X } from 'lucide-react';
import type { AssetTypeSummary, CustomFieldDef } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Pagination, usePagination } from '../components/Pagination';
import { AssetTypeModal } from '../components/AssetTypeModal';

export function AssetTypesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['asset-types'], queryFn: async () => (await api.get<AssetTypeSummary[]>('/asset-types')).data });
  const pg = usePagination(q.data ?? []);
  const [edit, setEdit] = useState<AssetTypeSummary | null>(null);
  const [fields, setFields] = useState<AssetTypeSummary | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('asset_types.manage');
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['asset-types'] });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/asset-types/${id}`),
    onSuccess: invalidate,
    onError: (e) => alert(extractApiError(e)),
  });

  return (
    <div>
      <PageHeader
        title={t('assetTypes.title')}
        subtitle={t('assetTypes.subtitle')}
        action={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('assetTypes.new')}</Button>}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('assetTypes.name')}</TableHead>
              <TableHead>{t('assetTypes.category')}</TableHead>
              <TableHead>{t('assetTypes.unit')}</TableHead>
              <TableHead>{t('assetTypes.assetCount')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={5}>{t('common.loading')}</TableEmpty>}
            {q.data?.length === 0 && <TableEmpty colSpan={5}>{t('common.noResults')}</TableEmpty>}
            {pg.pageItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-semibold">{item.name}</TableCell>
                <TableCell>{item.category ? <Badge variant="secondary">{item.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-muted-foreground">{item.unit ?? '—'}</TableCell>
                <TableCell><Badge variant="outline">{item.assetCount}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setFields(item)}>
                          <SlidersHorizontal className="h-3.5 w-3.5" />{t('assetTypes.customFields')}
                          {item.customFields.length > 0 && <Badge variant="secondary" className="ms-1">{item.customFields.length}</Badge>}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />{t('common.edit')}
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                          onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('assetTypes.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(item.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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

      {(creating || edit) && (
        <AssetTypeModal item={edit}
          onClose={() => { setCreating(false); setEdit(null); }}
          onSaved={() => { setCreating(false); setEdit(null); invalidate(); }} />
      )}
      {fields && <CustomFieldsModal type={fields} onClose={() => setFields(null)} onSaved={() => { setFields(null); invalidate(); }} />}
    </div>
  );
}

const FIELD_TYPES: CustomFieldDef['type'][] = ['TEXT', 'NUMBER', 'DATE', 'SELECT'];
const slugifyKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${Date.now()}`;

/** Admin editor: define the custom fields shown on this asset type's assets. */
function CustomFieldsModal({ type, onClose, onSaved }: { type: AssetTypeSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [defs, setDefs] = useState<CustomFieldDef[]>(type.customFields ?? []);
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.patch(`/asset-types/${type.id}`, { customFields: defs }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  const add = () => setDefs([...defs, { key: '', labelAr: '', labelEn: '', type: 'TEXT' }]);
  const upd = (i: number, patch: Partial<CustomFieldDef>) => setDefs(defs.map((d, x) => (x === i ? { ...d, ...patch } : d)));
  const rm = (i: number) => setDefs(defs.filter((_, x) => x !== i));
  const save = () => {
    // auto-derive keys from English label where missing
    setError('');
    mut.mutate(defs.map((d) => ({ ...d, key: d.key || slugifyKey(d.labelEn || d.labelAr) })) as never);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('assetTypes.customFields')} — {type.name}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <p className="mb-3 text-xs text-muted-foreground">{t('assetTypes.customFieldsHint')}</p>
        <div className="space-y-2">
          {defs.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('assetTypes.noCustomFields')}</p>}
          {defs.map((d, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-2">
              <div className="col-span-3 space-y-1"><Label className="text-xs">{t('assetTypes.fieldLabelAr')}</Label><Input value={d.labelAr} onChange={(e) => upd(i, { labelAr: e.target.value })} /></div>
              <div className="col-span-3 space-y-1"><Label className="text-xs">{t('assetTypes.fieldLabelEn')}</Label><Input dir="ltr" value={d.labelEn} onChange={(e) => upd(i, { labelEn: e.target.value })} /></div>
              <div className="col-span-3 space-y-1"><Label className="text-xs">{t('assetTypes.fieldType')}</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={d.type} onChange={(e) => upd(i, { type: e.target.value as CustomFieldDef['type'] })}>
                  {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{t(`assetTypes.ftype.${ft}`)}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                {d.type === 'SELECT' && <><Label className="text-xs">{t('assetTypes.fieldOptions')}</Label><Input dir="ltr" placeholder="a, b, c" value={(d.options ?? []).join(', ')} onChange={(e) => upd(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></>}
              </div>
              <div className="col-span-1"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => rm(i)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={add}><Plus className="h-3.5 w-3.5" />{t('assetTypes.addField')}</Button>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </div>
      </div>
    </div>
  );
}

