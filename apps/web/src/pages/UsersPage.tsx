import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, KeyRound, Trash2, UserPlus } from 'lucide-react';
import type { OrgUnitNode, RoleSummary, UserRoleAssignment, UserSummary } from '@nx-lam/shared';
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
import { Pagination, usePagination } from '../components/Pagination';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';

interface FlatUnit { id: string; name: string; depth: number; }
function flattenTree(nodes: OrgUnitNode[], depth = 0): FlatUnit[] {
  return nodes.flatMap((n) => [{ id: n.id, name: n.name, depth }, ...flattenTree(n.children, depth + 1)]);
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}

export function UsersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const usersQ = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get<UserSummary[]>('/users')).data });
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleSummary[]>('/roles')).data });
  const unitsQ = useQuery({ queryKey: ['org-units'], queryFn: async () => (await api.get<OrgUnitNode[]>('/org-units')).data });
  const pg = usePagination(usersQ.data ?? []);
  const flatUnits = useMemo(() => flattenTree(unitsQ.data ?? []), [unitsQ.data]);

  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [rolesFor, setRolesFor] = useState<UserSummary | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['users'] });
    void qc.invalidateQueries({ queryKey: ['roles'] });
  };

  const canCreate = hasPermission('users.create');
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        action={canCreate && (
          <Button onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" />{t('users.new')}</Button>
        )}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.code')}</TableHead>
              <TableHead>{t('users.fullName')}</TableHead>
              <TableHead>{t('users.email')}</TableHead>
              <TableHead>{t('users.roles')}</TableHead>
              <TableHead>{t('users.status')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQ.isLoading && <TableEmpty colSpan={6}>{t('common.loading')}</TableEmpty>}
            {usersQ.data?.length === 0 && <TableEmpty colSpan={6}>{t('common.noResults')}</TableEmpty>}
            {pg.pageItems.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.code ?? '—'}</TableCell>
                <TableCell className="font-semibold">{u.fullName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && <span className="text-muted-foreground">{t('common.none')}</span>}
                    {u.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.roleName}{r.orgUnitName ? ` · ${r.orgUnitName}` : ''}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'success' : 'destructive'}>
                    {u.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canUpdate && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                          <Pencil className="h-3.5 w-3.5" />{t('common.edit')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setRolesFor(u)}>
                          <KeyRound className="h-3.5 w-3.5" />{t('users.manageRoles')}
                        </Button>
                      </>
                    )}
                    {canDelete && u.isActive && (
                      <Button
                        variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (await confirm({ title: t('users.deactivate'), description: t('users.confirmDeactivate'), destructive: true, confirmText: t('users.deactivate') }))
                            deactivate.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

      {creating && <CreateUserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); invalidate(); }} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
      {rolesFor && (
        <ManageRolesModal user={rolesFor} roles={rolesQ.data ?? []} units={flatUnits}
          onClose={() => setRolesFor(null)} onSaved={() => { setRolesFor(null); invalidate(); }} />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('users.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5"><Label>{t('users.fullName')}</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>{t('users.email')}</Label>
            <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>{t('users.password')}</Label>
            <Input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            <p className="text-xs text-muted-foreground">{t('users.passwordHint')}</p></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserSummary; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fullName: user.fullName, isActive: user.isActive, password: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { fullName: form.fullName, isActive: form.isActive };
      if (form.password) payload.password = form.password;
      return api.patch(`/users/${user.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('users.edit')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5"><Label>{t('users.email')}</Label><Input value={user.email} disabled dir="ltr" /></div>
          <div className="space-y-1.5"><Label>{t('users.fullName')}</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>{t('users.password')}</Label>
            <Input type="password" dir="ltr" value={form.password} placeholder="••••••••" onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t('users.passwordHint')}</p></div>
          <div className="flex items-center gap-2">
            <Checkbox id="active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: !!v })} />
            <Label htmlFor="active">{t('common.active')}</Label>
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

function ManageRolesModal({
  user, roles, units, onClose, onSaved,
}: {
  user: UserSummary; roles: RoleSummary[]; units: FlatUnit[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>(user.roles);
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.put(`/users/${user.id}/roles`, {
      roles: assignments.map((a) => ({ roleId: a.roleId, orgUnitId: a.orgUnitId })),
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });

  function addRow() {
    const firstRole = roles[0];
    if (!firstRole) return;
    setAssignments([...assignments, { id: `tmp-${assignments.length}-${firstRole.id}`, roleId: firstRole.id, roleName: firstRole.name, orgUnitId: null, orgUnitName: null }]);
  }
  const updateRow = (idx: number, patch: Partial<UserRoleAssignment>) =>
    setAssignments(assignments.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const removeRow = (idx: number) => setAssignments(assignments.filter((_, i) => i !== idx));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t('users.rolesFor')} {user.fullName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <FormError message={error} />
          <div className="space-y-2">
            {assignments.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('common.none')}</p>}
            {assignments.map((a, idx) => (
              <div key={a.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Select value={a.roleId} onValueChange={(v) => updateRow(idx, { roleId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={a.orgUnitId ?? '__global__'} onValueChange={(v) => updateRow(idx, { orgUnitId: v === '__global__' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">{t('users.globalScope')}</SelectItem>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{' '.repeat(u.depth * 2)}{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeRow(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="soft" size="sm" onClick={addRow}><Plus className="h-4 w-4" />{t('users.addRole')}</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
