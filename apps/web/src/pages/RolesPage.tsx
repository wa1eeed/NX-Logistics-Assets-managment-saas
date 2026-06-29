import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, KeyRound } from 'lucide-react';
import type { PermissionDef, RoleSummary } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Pagination, usePagination } from '../components/Pagination';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface PermissionsResponse {
  permissions: PermissionDef[];
  groups: Record<string, { en: string; ar: string }>;
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}

export function RolesPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const isAr = i18n.language === 'ar';

  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleSummary[]>('/roles')).data });
  const pg = usePagination(rolesQ.data ?? []);
  const permsQ = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await api.get<PermissionsResponse>('/permissions')).data,
    enabled: hasPermission('permissions.read'),
  });

  const [editingPerms, setEditingPerms] = useState<RoleSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingMeta, setEditingMeta] = useState<RoleSummary | null>(null);

  const canManage = hasPermission('roles.manage');
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['roles'] });

  return (
    <div>
      <PageHeader
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        action={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t('roles.new')}</Button>}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('roles.name')}</TableHead>
              <TableHead>{t('roles.description')}</TableHead>
              <TableHead>{t('roles.permissions')}</TableHead>
              <TableHead>{t('roles.users')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolesQ.isLoading && <TableEmpty colSpan={5}>{t('common.loading')}</TableEmpty>}
            {pg.pageItems.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="default" className="font-mono">{r.name}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.description}</TableCell>
                <TableCell><Badge variant="outline">{r.permissionKeys.length}</Badge></TableCell>
                <TableCell>{r.userCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditingMeta(r)}>
                          <Pencil className="h-3.5 w-3.5" />{t('common.edit')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingPerms(r)}>
                          <KeyRound className="h-3.5 w-3.5" />{t('roles.editPermissions')}
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

      {creating && <RoleMetaModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); invalidate(); }} />}
      {editingMeta && <RoleMetaModal role={editingMeta} onClose={() => setEditingMeta(null)} onSaved={() => { setEditingMeta(null); invalidate(); }} />}
      {editingPerms && permsQ.data && (
        <PermissionMatrixModal role={editingPerms} catalog={permsQ.data} isAr={isAr}
          onClose={() => setEditingPerms(null)} onSaved={() => { setEditingPerms(null); invalidate(); }} />
      )}
    </div>
  );
}

function RoleMetaModal({ role, onClose, onSaved }: { role?: RoleSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => (role ? api.patch(`/roles/${role.id}`, { description }) : api.post('/roles', { name, description })),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{role ? t('common.edit') : t('roles.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5"><Label>{t('roles.name')}</Label>
            <Input className="font-mono" value={name} onChange={(e) => setName(e.target.value)} disabled={!!role} required /></div>
          <div className="space-y-1.5"><Label>{t('roles.description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrixModal({
  role, catalog, isAr, onClose, onSaved,
}: {
  role: RoleSummary; catalog: PermissionsResponse; isAr: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissionKeys));
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of catalog.permissions) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  function toggle(key: string) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  }
  function setGroup(keys: string[], on: boolean) {
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    setSelected(next);
  }

  const mut = useMutation({
    mutationFn: () => api.put(`/roles/${role.id}/permissions`, { permissionKeys: [...selected] }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{t('roles.permissionsFor')} {role.name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <FormError message={error} />
          {grouped.map(([group, perms]) => {
            const keys = perms.map((p) => p.key);
            const allOn = keys.every((k) => selected.has(k));
            const groupLabel = catalog.groups[group] ? (isAr ? catalog.groups[group].ar : catalog.groups[group].en) : group;
            return (
              <div key={group}>
                <div className="mb-2 flex items-center justify-between border-b pb-1.5">
                  <span className="text-sm font-semibold">{groupLabel}</span>
                  <Button variant="ghost" size="sm" onClick={() => setGroup(keys, !allOn)}>
                    {allOn ? t('roles.clearAll') : t('roles.selectAll')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {perms.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-start gap-2.5 rounded-md p-2 hover:bg-accent">
                      <Checkbox checked={selected.has(p.key)} onCheckedChange={() => toggle(p.key)} className="mt-0.5" />
                      <div className="leading-tight">
                        <div className="text-sm font-medium">{isAr ? p.labelAr : p.labelEn}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{isAr ? p.descAr : p.descEn}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{p.key}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="items-center">
          <span className="me-auto text-sm text-muted-foreground">{selected.size} {t('roles.selected')}</span>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
