import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, AlertTriangle, Clock } from 'lucide-react';
import type { AlertsView } from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../lib/api';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { GlowCard } from '../components/effects/GlowCard';
import { AnimatedNumber } from '../components/effects/AnimatedNumber';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Pagination, usePagination } from '../components/Pagination';

export function AlertsPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await api.get<AlertsView>('/alerts')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');
  const pg = usePagination(data?.items ?? []);

  const stats = [
    { key: 'total', label: t('alerts.total'), value: data?.counts.total ?? 0, icon: Bell, tint: 'text-blue-500 bg-blue-500/10' },
    { key: 'danger', label: t('alerts.danger'), value: data?.counts.danger ?? 0, icon: AlertTriangle, tint: 'text-rose-500 bg-rose-500/10' },
    { key: 'warning', label: t('alerts.warning'), value: data?.counts.warning ?? 0, icon: Clock, tint: 'text-amber-500 bg-amber-500/10' },
  ];

  return (
    <div>
      <PageHeader title={t('alerts.title')} subtitle={t('alerts.subtitle')} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <GlowCard key={s.key} delay={i * 0.06} className="p-5">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${s.tint}`}><s.icon className="h-5 w-5" /></div>
            <div className="text-sm font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums"><AnimatedNumber value={s.value} /></div>
          </GlowCard>
        ))}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('alerts.kind')}</TableHead>
              <TableHead>{t('alerts.item')}</TableHead>
              <TableHead>{t('alerts.reference')}</TableHead>
              <TableHead>{t('alerts.date')}</TableHead>
              <TableHead>{t('alerts.daysLeft')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableEmpty colSpan={5}>{t('common.loading')}</TableEmpty>}
            {data?.items.length === 0 && <TableEmpty colSpan={5}>{t('alerts.none')}</TableEmpty>}
            {pg.pageItems.map((a, idx) => (
              <TableRow key={idx}>
                <TableCell><Badge variant={a.severity === 'danger' ? 'destructive' : 'warning'}>{t(`alerts.kinds.${a.kind}`)}</Badge></TableCell>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell className="font-mono text-xs">{a.reference}</TableCell>
                <TableCell className="text-xs">{fmt(a.date)}</TableCell>
                <TableCell className="tabular-nums">
                  {a.daysRemaining == null ? '—' : a.daysRemaining < 0
                    ? <span className="text-destructive">{a.daysRemaining}</span>
                    : <span>{a.daysRemaining}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </Card>
    </div>
  );
}
