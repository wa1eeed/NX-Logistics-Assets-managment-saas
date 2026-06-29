import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Clock, Wrench } from 'lucide-react';
import type { ComplianceView, ComplianceItem, DueStatus } from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../lib/api';
import { PageHeader, TableEmpty } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const statusVariant: Record<DueStatus, 'destructive' | 'warning' | 'success'> = { OVERDUE: 'destructive', DUE_SOON: 'warning', OK: 'success' };
const kindIcon: Record<ComplianceItem['kind'], typeof Wrench> = {
  PREVENTIVE_DUE: Wrench, REGISTRATION_EXPIRY: ShieldCheck, INSPECTION_EXPIRY: ShieldCheck, INSURANCE_EXPIRY: ShieldCheck,
};

export function CompliancePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const q = useQuery({ queryKey: ['compliance'], queryFn: async () => (await api.get<ComplianceView>('/compliance/overview')).data, refetchInterval: LIVE_REFETCH_MS });
  const data = q.data;

  const remainingText = (it: ComplianceItem) => {
    if (it.remaining == null) return '—';
    if (it.unit === 'DAYS') return it.remaining < 0 ? t('compliance.overdueByDays', { n: Math.abs(it.remaining) }) : t('compliance.inDays', { n: it.remaining });
    const unit = it.unit === 'KM' ? t('compliance.km') : t('compliance.hours');
    return it.remaining < 0 ? t('compliance.overdueByUnit', { n: Math.abs(it.remaining), unit }) : t('compliance.inUnit', { n: it.remaining, unit });
  };

  return (
    <div>
      <PageHeader title={t('compliance.title')} subtitle={t('compliance.subtitle')} />

      {data && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatTile label={t('compliance.total')} value={data.counts.total} icon={ShieldCheck} tint="text-teal-500 bg-teal-500/10" />
          <StatTile label={t('compliance.overdue')} value={data.counts.overdue} icon={AlertTriangle} tint="text-rose-500 bg-rose-500/10" valueClass={data.counts.overdue ? 'text-rose-500' : undefined} />
          <StatTile label={t('compliance.dueSoon')} value={data.counts.dueSoon} icon={Clock} tint="text-amber-500 bg-amber-500/10" />
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('compliance.asset')}</TableHead>
              <TableHead>{t('compliance.obligation')}</TableHead>
              <TableHead>{t('compliance.type')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('compliance.remaining')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableEmpty colSpan={6}>{t('common.loading')}</TableEmpty>}
            {data?.items.length === 0 && <TableEmpty colSpan={6}>{t('compliance.allClear')}</TableEmpty>}
            {data?.items.map((it, i) => {
              const Icon = kindIcon[it.kind];
              return (
                <TableRow key={`${it.assetId}-${it.kind}-${i}`}>
                  <TableCell className="font-mono font-semibold">
                    <Link to={`/assets/${it.assetId}`} className="hover:text-primary hover:underline">{it.assetCode}</Link>
                    <span className="block font-sans text-xs text-muted-foreground">{it.assetTypeName}</span>
                  </TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{it.label}</span></TableCell>
                  <TableCell><Badge variant="outline">{t(`alerts.kinds.${it.kind}`)}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant[it.status]}>{t(`compliance.status.${it.status}`)}</Badge></TableCell>
                  <TableCell className="tabular-nums text-sm">{remainingText(it)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{it.date ? new Date(it.date).toLocaleDateString(isAr ? 'ar' : 'en-GB') : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
