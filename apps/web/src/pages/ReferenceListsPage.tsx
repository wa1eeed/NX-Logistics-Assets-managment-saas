import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { LOOKUP_TYPES, type LookupItem, type AssetTypeSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { AssetTypeModal } from '../components/AssetTypeModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

/** Manages a single lookup type (cities, manufacturers, categories…) — one tab per type. */
export function LookupTypeManager({ typeKey }: { typeKey: string }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isAr = i18n.language === 'ar';
  const canManage = hasPermission('settings.manage');
  const lt = LOOKUP_TYPES.find((l) => l.key === typeKey);

  // One shared query (cached) — each tab filters to its own type.
  const q = useQuery({ queryKey: ['lookups-manage'], queryFn: async () => (await api.get<LookupItem[]>('/lookups/manage')).data });
  const items = (q.data ?? []).filter((l) => l.type === typeKey);
  const [editing, setEditing] = useState<{ item?: LookupItem } | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['lookups-manage'] });
    void qc.invalidateQueries({ queryKey: ['lookups'] });
  };
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/lookups/${id}`, { isActive }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/lookups/${id}`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{lt ? (isAr ? lt.ar : lt.en) : typeKey}</CardTitle>
          {lt && <p className="mt-1 text-xs text-muted-foreground">{isAr ? lt.usageAr : lt.usageEn} · {items.length} {t('refLists.entries')}</p>}
        </div>
        {canManage && <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" />{t('refLists.add')}</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('refLists.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('refLists.labelEn')}</TableHead>
                <TableHead>{t('refLists.labelAr')}</TableHead>
                <TableHead>{t('refLists.value')}</TableHead>
                <TableHead>{t('refLists.status')}</TableHead>
                {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.labelEn}</TableCell>
                  <TableCell>{l.labelAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.value}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Switch checked={l.isActive} onCheckedChange={(v) => toggle.mutate({ id: l.id, isActive: v })} />
                    ) : (
                      <Badge variant={l.isActive ? 'success' : 'secondary'}>{l.isActive ? t('common.active') : t('common.inactive')}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing({ item: l })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                          onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('refLists.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(l.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editing && (
        <LookupModal type={typeKey} item={editing.item}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />
      )}
    </Card>
  );
}

/** Manages equipment types (richer reference data: name + classification + unit). */
export function AssetTypesManager() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const canManage = hasPermission('asset_types.manage');
  const typesQ = useQuery({ queryKey: ['asset-types'], queryFn: async () => (await api.get<AssetTypeSummary[]>('/asset-types')).data });
  const [editType, setEditType] = useState<{ item: AssetTypeSummary | null } | null>(null);
  const delType = useMutation({
    mutationFn: (id: string) => api.delete(`/asset-types/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asset-types'] }),
    onError: (e) => alert(extractApiError(e)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{t('assetTypes.title')}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('assetTypes.subtitle')} · {typesQ.data?.length ?? 0} {t('refLists.entries')}</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setEditType({ item: null })}><Plus className="h-4 w-4" />{t('assetTypes.new')}</Button>}
      </CardHeader>
      <CardContent>
        {(typesQ.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('refLists.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('assetTypes.name')}</TableHead>
                <TableHead>{t('assetTypes.category')}</TableHead>
                <TableHead>{t('assetTypes.unit')}</TableHead>
                <TableHead>{t('assetTypes.assetCount')}</TableHead>
                {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {typesQ.data?.map((tp) => (
                <TableRow key={tp.id}>
                  <TableCell className="font-medium">{tp.name}</TableCell>
                  <TableCell>{tp.category ? <Badge variant="secondary">{tp.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{tp.unit ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{tp.assetCount}</Badge></TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditType({ item: tp })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                          onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('assetTypes.confirmDelete'), destructive: true, confirmText: t('common.delete') })) delType.mutate(tp.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editType && (
        <AssetTypeModal item={editType.item}
          onClose={() => setEditType(null)}
          onSaved={() => { setEditType(null); void qc.invalidateQueries({ queryKey: ['asset-types'] }); }} />
      )}
    </Card>
  );
}

function LookupModal({ type, item, onClose, onSaved }: { type: string; item?: LookupItem; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [labelEn, setLabelEn] = useState(item?.labelEn ?? '');
  const [labelAr, setLabelAr] = useState(item?.labelAr ?? '');
  const [value, setValue] = useState(item?.value ?? '');
  const [sortOrder, setSortOrder] = useState(item?.sortOrder?.toString() ?? '0');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      if (item) {
        return api.patch(`/lookups/${item.id}`, { labelEn, labelAr: labelAr || null, sortOrder: Number(sortOrder) || 0 });
      }
      return api.post('/lookups', { type, labelEn, labelAr: labelAr || undefined, value: value || undefined, sortOrder: Number(sortOrder) || 0 });
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t('refLists.edit') : t('refLists.add')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('refLists.labelEn')}</Label><Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>{t('refLists.labelAr')}</Label><Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} /></div>
          {!item && (
            <div className="space-y-1.5"><Label>{t('refLists.value')}</Label>
              <Input className="font-mono" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} placeholder={labelEn} />
              <p className="text-xs text-muted-foreground">{t('refLists.valueHint')}</p></div>
          )}
          <div className="space-y-1.5"><Label>{t('refLists.order')}</Label><Input type="number" dir="ltr" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending || !labelEn}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
