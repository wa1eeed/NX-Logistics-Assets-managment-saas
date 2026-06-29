import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileSignature, Gauge, Timer, PauseCircle } from 'lucide-react';
import type { AssetOperationsLog, ContractStatus } from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../../lib/api';
import { StatTile } from '../StatTile';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const conVariant: Record<ContractStatus, 'default' | 'secondary' | 'success' | 'destructive'> = {
  ACTIVE: 'success', EXTENDED: 'default', RETURNED: 'secondary', CANCELLED: 'destructive',
};

type Event =
  | { kind: 'contract'; date: string; c: AssetOperationsLog['contracts'][number] }
  | { kind: 'idle'; date: string; g: AssetOperationsLog['idleGaps'][number] };

/** Operations log for one asset — rental contracts (issue → end) + idle-while-available gaps. */
export function AssetOperationsTab({ assetId }: { assetId: string }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['asset-operations', assetId],
    queryFn: async () => (await api.get<AssetOperationsLog>(`/assets/${assetId}/operations`)).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const events: Event[] = [
    ...data.contracts.map((c) => ({ kind: 'contract' as const, date: c.startDate, c })),
    ...data.idleGaps.map((g) => ({ kind: 'idle' as const, date: g.fromDate, g })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('assets.ops.contracts')} value={data.totals.contracts} icon={FileSignature} tint="text-blue-500 bg-blue-500/10" />
        <StatTile label={t('assets.ops.operatingDays')} value={data.totals.operatingDays} icon={Timer} tint="text-emerald-500 bg-emerald-500/10" />
        <StatTile label={t('assets.ops.idleDays')} value={data.totals.idleDays} icon={PauseCircle} tint="text-amber-500 bg-amber-500/10" />
        <StatTile label={t('assets.ops.utilization')} value={data.totals.utilizationPct} suffix="%" icon={Gauge} tint="text-violet-500 bg-violet-500/10" />
      </div>

      {events.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t('assets.ops.none')}</CardContent></Card>
      ) : (
        <div className="space-y-2.5">
          {events.map((e, i) =>
            e.kind === 'contract' ? (
              <div key={`c${i}`} className="flex items-start gap-3 rounded-lg border border-s-4 border-s-primary bg-card p-3.5">
                <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{e.c.authorizationNo}</span>
                    <Badge variant={conVariant[e.c.status]}>{t(`contractStatus.${e.c.status}`)}</Badge>
                    <span className="text-xs text-muted-foreground">· {e.c.orgUnitName}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('assets.ops.issued')} <span className="font-medium text-foreground">{fmt(e.c.startDate)}</span>
                    {' → '}{t('assets.ops.ended')} <span className="font-medium text-foreground">{fmt(e.c.endDate)}</span>
                    {' · '}<span className="font-medium text-foreground">{e.c.operatingDays}</span> {t('assets.ops.days')}
                  </div>
                </div>
              </div>
            ) : (
              <div key={`g${i}`} className="flex items-start gap-3 rounded-lg border border-s-4 border-s-amber-400 bg-amber-500/5 p-3.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t('assets.ops.idleTitle')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {fmt(e.g.fromDate)} {' → '} {fmt(e.g.toDate)}
                    {' · '}<span className="font-medium text-foreground">{e.g.days}</span> {t('assets.ops.days')}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
