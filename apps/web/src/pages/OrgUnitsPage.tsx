import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ListTree, Network, UserRound } from 'lucide-react';
import type { OrgUnitNode, UserSummary } from '@nx-lam/shared';
import { OrgUnitKind } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader } from '../components/PageHeader';
import { TabBar } from '../components/TabBar';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface FlatUnit { id: string; name: string; depth: number; }
function flatten(nodes: OrgUnitNode[], depth = 0): FlatUnit[] {
  return nodes.flatMap((n) => [{ id: n.id, name: n.name, depth }, ...flatten(n.children, depth + 1)]);
}

interface EditState { id?: string; name: string; kind: OrgUnitKind; parentId: string | null; managerId: string | null; }

const kindVariant: Record<OrgUnitKind, 'default' | 'secondary' | 'success'> = {
  DIVISION: 'default', DEPARTMENT: 'secondary', PROJECT: 'success',
};

export function OrgUnitsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const treeQ = useQuery({ queryKey: ['org-units'], queryFn: async () => (await api.get<OrgUnitNode[]>('/org-units')).data });
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserSummary[]>('/users')).data,
    enabled: hasPermission('users.read'),
  });
  const flat = useMemo(() => flatten(treeQ.data ?? []), [treeQ.data]);
  const managerName = useMemo(() => new Map((usersQ.data ?? []).map((u) => [u.id, u.fullName])), [usersQ.data]);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [view, setView] = useState<'tree' | 'chart'>('tree');
  const canManage = hasPermission('org_units.manage');
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['org-units'] });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/org-units/${id}`),
    onSuccess: invalidate,
    onError: (e) => alert(extractApiError(e)),
  });

  function renderNodes(nodes: OrgUnitNode[], depth = 0) {
    return (
      <div className={depth > 0 ? 'ms-4 border-s border-dashed ps-4' : ''}>
        {nodes.map((n) => (
          <div key={n.id}>
            <div className="my-1.5 flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40">
              <Badge variant={kindVariant[n.kind]}>{t(`orgUnits.kinds.${n.kind}`)}</Badge>
              <span className="font-semibold">{n.name}</span>
              {!n.isActive && <Badge variant="destructive">{t('common.inactive')}</Badge>}
              {canManage && (
                <div className="ms-auto flex gap-1">
                  <Button variant="ghost" size="icon" title={t('orgUnits.new')}
                    onClick={() => setEdit({ name: '', kind: OrgUnitKind.PROJECT, parentId: n.id, managerId: null })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon"
                    onClick={() => setEdit({ id: n.id, name: n.name, kind: n.kind, parentId: n.parentId, managerId: n.managerId })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                    onClick={async () => { if (await confirm({ title: t('common.delete'), description: t('orgUnits.confirmDelete'), destructive: true, confirmText: t('common.delete') })) del.mutate(n.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {n.children.length > 0 && renderNodes(n.children, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('orgUnits.title')}
        subtitle={t('orgUnits.subtitle')}
        action={canManage && (
          <Button onClick={() => setEdit({ name: '', kind: OrgUnitKind.DIVISION, parentId: null, managerId: null })}>
            <Plus className="h-4 w-4" />{t('orgUnits.new')}
          </Button>
        )}
      />
      <TabBar
        active={view}
        onChange={(v) => setView(v as 'tree' | 'chart')}
        tabs={[
          { key: 'tree', label: <><ListTree className="h-4 w-4" />{t('orgUnits.viewTree')}</> },
          { key: 'chart', label: <><Network className="h-4 w-4" />{t('orgUnits.viewChart')}</> },
        ]}
      />

      <Card className={cn(view === 'chart' ? 'p-4 sm:p-6' : 'p-4')}>
        {treeQ.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : treeQ.data && treeQ.data.length > 0 ? (
          view === 'tree' ? renderNodes(treeQ.data) : (
            <OrgChart nodes={treeQ.data} managerName={managerName} onPick={canManage ? (n) => setEdit({ id: n.id, name: n.name, kind: n.kind, parentId: n.parentId, managerId: n.managerId }) : undefined} />
          )
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('common.noResults')}</div>
        )}
      </Card>

      {edit && (
        <OrgUnitModal state={edit} units={flat} users={usersQ.data ?? []}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); invalidate(); }} />
      )}
    </div>
  );
}

// Pure-CSS top-down org chart. Wrapped in dir="ltr" so the connector geometry
// stays consistent; Arabic labels inside the boxes still render RTL.
const TREE_CSS = `
.nx-tree ul { padding-top: 22px; position: relative; display: flex; justify-content: center; margin: 0; list-style: none; }
.nx-tree > ul { padding-top: 0; }
.nx-tree li { position: relative; padding: 22px 8px 0; display: flex; flex-direction: column; align-items: center; }
.nx-tree li::before, .nx-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid hsl(var(--border)); width: 50%; height: 22px; }
.nx-tree li::after { right: auto; left: 50%; border-left: 2px solid hsl(var(--border)); }
.nx-tree li:only-child::before, .nx-tree li:only-child::after { display: none; }
.nx-tree li:only-child { padding-top: 22px; }
.nx-tree li:first-child::before, .nx-tree li:last-child::after { border: 0 none; }
.nx-tree li:last-child::before { border-right: 2px solid hsl(var(--border)); border-radius: 0 6px 0 0; }
.nx-tree li:first-child::after { border-radius: 6px 0 0 0; }
.nx-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid hsl(var(--border)); width: 0; height: 22px; }
.nx-tree > ul > li::before, .nx-tree > ul > li::after { display: none; }
`;

const kindDot: Record<OrgUnitKind, string> = {
  DIVISION: 'bg-primary', DEPARTMENT: 'bg-blue-500', PROJECT: 'bg-emerald-500',
};

function OrgChart({ nodes, managerName, onPick }: {
  nodes: OrgUnitNode[];
  managerName: Map<string, string>;
  onPick?: (n: OrgUnitNode) => void;
}) {
  return (
    <div dir="ltr" className="nx-tree w-full overflow-x-auto pb-2">
      <style>{TREE_CSS}</style>
      <ul>{nodes.map((n) => <ChartNode key={n.id} node={n} managerName={managerName} onPick={onPick} />)}</ul>
    </div>
  );
}

function ChartNode({ node, managerName, onPick }: {
  node: OrgUnitNode;
  managerName: Map<string, string>;
  onPick?: (n: OrgUnitNode) => void;
}) {
  const { t } = useTranslation();
  const mgr = node.managerId ? managerName.get(node.managerId) : null;
  const Box = onPick ? 'button' : 'div';
  return (
    <li>
      <Box
        {...(onPick ? { type: 'button' as const, onClick: () => onPick(node) } : {})}
        className={cn(
          'relative min-w-[150px] max-w-[220px] rounded-xl border bg-card px-3.5 py-2.5 text-center shadow-sm transition-shadow',
          onPick && 'cursor-pointer hover:shadow-md',
          !node.isActive && 'opacity-60',
        )}
      >
        <span className="mx-auto mb-1 flex items-center justify-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', kindDot[node.kind])} />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(`orgUnits.kinds.${node.kind}`)}</span>
        </span>
        <span className="block truncate font-semibold leading-tight">{node.name}</span>
        {mgr && <span className="mt-1 flex items-center justify-center gap-1 truncate text-xs text-muted-foreground"><UserRound className="h-3 w-3 shrink-0" />{mgr}</span>}
      </Box>
      {node.children.length > 0 && (
        <ul>{node.children.map((c) => <ChartNode key={c.id} node={c} managerName={managerName} onPick={onPick} />)}</ul>
      )}
    </li>
  );
}

function OrgUnitModal({
  state, units, users, onClose, onSaved,
}: {
  state: EditState; units: FlatUnit[]; users: UserSummary[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<EditState>(state);
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => {
      const payload = { name: form.name, kind: form.kind, parentId: form.parentId, managerId: form.managerId };
      return form.id ? api.patch(`/org-units/${form.id}`, payload) : api.post('/org-units', payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  function submit(e: FormEvent) { e.preventDefault(); setError(''); mut.mutate(); }
  const selectableParents = units.filter((u) => u.id !== form.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? t('orgUnits.edit') : t('orgUnits.new')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label>{t('orgUnits.name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>{t('orgUnits.kind')}</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as OrgUnitKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.values(OrgUnitKind).map((k) => <SelectItem key={k} value={k}>{t(`orgUnits.kinds.${k}`)}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>{t('orgUnits.parent')}</Label>
            <Select value={form.parentId ?? '__root__'} onValueChange={(v) => setForm({ ...form, parentId: v === '__root__' ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">{t('orgUnits.noParent')}</SelectItem>
                {selectableParents.map((u) => <SelectItem key={u.id} value={u.id}>{' '.repeat(u.depth * 2)}{u.name}</SelectItem>)}
              </SelectContent>
            </Select></div>
          {users.length > 0 && (
            <div className="space-y-1.5"><Label>{t('users.fullName')} ({t('common.optional')})</Label>
              <Select value={form.managerId ?? '__none__'} onValueChange={(v) => setForm({ ...form, managerId: v === '__none__' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('common.none')}</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                </SelectContent>
              </Select></div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
