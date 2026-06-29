import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AuditLogEntry, Paginated } from '@nx-lam/shared';
import { api } from '../lib/api';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const ENTITY_TYPES = ['User', 'Role', 'OrgUnit', 'AssetType', 'Setting'];

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [entityType, setEntityType] = useState('');
  const q = useQuery({
    queryKey: ['audit', page, entityType],
    queryFn: async () =>
      (await api.get<Paginated<AuditLogEntry>>('/audit', {
        params: { page, pageSize, entityType: entityType || undefined },
      })).data,
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / pageSize)) : 1;
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  return (
    <div>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={entityType || '__all__'} onValueChange={(v) => { setEntityType(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('audit.filterEntity')} — {t('common.all')}</SelectItem>
            {ENTITY_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('audit.when')}</TableHead>
              <TableHead>{t('audit.actor')}</TableHead>
              <TableHead>{t('audit.action')}</TableHead>
              <TableHead>{t('audit.entity')}</TableHead>
              <TableHead>{t('audit.entityId')}</TableHead>
              <TableHead>{t('audit.ip')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={6}>{t('common.loading')}</TableEmpty>}
            {q.data?.items.length === 0 && <TableEmpty colSpan={6}>{t('common.noResults')}</TableEmpty>}
            {q.data?.items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{fmt(e.createdAt)}</TableCell>
                <TableCell>{e.actorName ?? <span className="text-muted-foreground">{t('audit.system')}</span>}</TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell><Badge variant="outline">{e.entityType}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{e.entityId}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{e.ip ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {q.data && (
          <Pagination
            page={page}
            pageCount={totalPages}
            pageSize={pageSize}
            total={q.data.total}
            start={(page - 1) * pageSize}
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        )}
      </Card>
    </div>
  );
}
