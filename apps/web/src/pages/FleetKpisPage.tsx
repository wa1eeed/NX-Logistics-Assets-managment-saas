import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Boxes, CheckCircle2, Gauge, OctagonPause, Wrench, AlertTriangle } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FleetKpis, KpiBucket } from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { GlowCard } from '../components/effects/GlowCard';
import { AnimatedNumber } from '../components/effects/AnimatedNumber';
import { Donut } from '../components/charts/Donut';
import { BarList, type BarItem } from '../components/charts/BarList';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export function FleetKpisPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['fleet-kpis'],
    queryFn: async () => (await api.get<FleetKpis>('/kpis/fleet')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title={t('kpis.title')} subtitle={t('kpis.subtitle')} />
        <div className="py-16 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const tot = data.totals;
  const readinessColor = tot.readinessPct >= 85 ? 'text-emerald-500' : tot.readinessPct >= 60 ? 'text-amber-500' : 'text-rose-500';

  const stats: { label: string; value: number; suffix?: string; icon: ComponentType<{ className?: string }>; tint: string; valClass?: string }[] = [
    { label: t('kpis.totalAssets'), value: tot.total, icon: Boxes, tint: 'text-slate-500 bg-slate-500/10' },
    { label: t('kpis.operating'), value: tot.operating, icon: CheckCircle2, tint: 'text-emerald-500 bg-emerald-500/10' },
    { label: t('kpis.readiness'), value: tot.readinessPct, suffix: '%', icon: Gauge, tint: 'text-blue-500 bg-blue-500/10', valClass: readinessColor },
    { label: t('kpis.stopped'), value: tot.stopped, icon: OctagonPause, tint: 'text-rose-500 bg-rose-500/10' },
    { label: t('kpis.underRepair'), value: tot.underRepair, icon: Wrench, tint: 'text-amber-500 bg-amber-500/10' },
    { label: t('kpis.requiresDecision'), value: tot.requiresDecision, icon: AlertTriangle, tint: 'text-orange-500 bg-orange-500/10' },
  ];

  const fmtLabelCategory = (k: string) => (k === 'Uncategorized' ? t('kpis.uncategorized') : k);
  const fmtRegion = (k: string) => (k === 'Unspecified' ? t('kpis.unspecified') : k);

  const catItems: BarItem[] = data.byCategory.map((b) => ({ label: fmtLabelCategory(b.key), count: b.count, pct: b.pct }));
  const typeItems: BarItem[] = data.byType.map((b) => ({ label: b.key, count: b.count, pct: b.pct }));
  const mfgItems: BarItem[] = data.topManufacturers.map((b) => ({ label: b.key, count: b.count, pct: b.pct }));
  const ageItems: BarItem[] = data.ageStructure.map((b: KpiBucket) => ({ label: t(`kpis.age.${b.key}`), count: b.count, pct: b.pct }));
  const nonOpItems: BarItem[] = data.nonOperatingConcentration.map((b) => ({ label: fmtRegion(b.key), count: b.count, pct: b.pct }));

  const statusColors: Record<string, string> = {
    operating: '#16a34a', stopped: '#dc2626', underRepair: '#d97706',
  };
  const donutSegments = data.statusDistribution.map((s) => ({
    label: t(`kpis.status.${s.key}`), value: s.count, color: statusColors[s.key] ?? '#64748b',
  }));

  const readinessBar = (pct: number) => {
    const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded bg-muted">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-12 text-end text-xs font-semibold tabular-nums">{pct}%</span>
      </div>
    );
  };

  const dq = data.dataQuality;

  return (
    <div>
      <PageHeader
        title={t('kpis.title')}
        subtitle={`${t('kpis.subtitle')} · ${t('kpis.generatedAt')} ${new Date(data.generatedAt).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-GB')}`}
      />

      {/* Coverage line */}
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>{t('kpis.coverage')}:</span>
        <span><b className="text-foreground">{data.coverage.regions}</b> {t('kpis.regionsCount')}</span>
        <span><b className="text-foreground">{data.coverage.sites}</b> {t('kpis.sitesCount')}</span>
        <span><b className="text-foreground">{data.coverage.assetTypes}</b> {t('kpis.typesCount')}</span>
        <span><b className="text-foreground">{data.coverage.manufacturers}</b> {t('kpis.manufacturersCount')}</span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s, i) => (
          <GlowCard key={s.label} delay={i * 0.05} className="p-4">
            <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg ${s.tint}`}><s.icon className="h-4 w-4" /></div>
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className={`mt-0.5 text-2xl font-bold tabular-nums ${s.valClass ?? ''}`}>
              <AnimatedNumber value={s.value} />{s.suffix}
            </div>
          </GlowCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Status donut */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.statusDistribution')}</CardTitle></CardHeader>
          <CardContent>
            <Donut segments={donutSegments} centerValue={`${tot.readinessPct}%`} centerLabel={t('kpis.operating')} />
          </CardContent>
        </Card>

        {/* Age structure */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.ageStructure')}</CardTitle></CardHeader>
          <CardContent><BarList items={ageItems} color="hsl(221 83% 53%)" /></CardContent>
        </Card>

        {/* Region readiness — full width */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t('kpis.regionReadiness')}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('kpis.col.region')}</TableHead>
                  <TableHead>{t('kpis.col.total')}</TableHead>
                  <TableHead>{t('kpis.col.operating')}</TableHead>
                  <TableHead>{t('kpis.col.nonOperating')}</TableHead>
                  <TableHead>{t('kpis.col.readiness')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.regions.map((r) => (
                  <TableRow key={r.region}>
                    <TableCell className="font-medium">{fmtRegion(r.region)}</TableCell>
                    <TableCell className="tabular-nums">{r.total}</TableCell>
                    <TableCell className="tabular-nums text-emerald-600">{r.operating}</TableCell>
                    <TableCell className="tabular-nums text-rose-600">{r.nonOperating}</TableCell>
                    <TableCell>{readinessBar(r.readinessPct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By category */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.byCategory')}</CardTitle></CardHeader>
          <CardContent><BarList items={catItems} color="hsl(199 89% 48%)" /></CardContent>
        </Card>

        {/* Top manufacturers */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.topManufacturers')}</CardTitle></CardHeader>
          <CardContent><BarList items={mfgItems} color="hsl(222 47% 30%)" /></CardContent>
        </Card>

        {/* Top types */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.byType')}</CardTitle></CardHeader>
          <CardContent><BarList items={typeItems} color="hsl(142 71% 38%)" /></CardContent>
        </Card>

        {/* Non-operating concentration */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('kpis.nonOpConcentration')}</CardTitle></CardHeader>
          <CardContent><BarList items={nonOpItems} color="hsl(0 72% 51%)" /></CardContent>
        </Card>

        {/* Data quality */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t('kpis.dataQuality')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-rose-500/5 p-4">
              <div className="text-2xl font-bold tabular-nums text-rose-600">{dq.withoutPlate}</div>
              <div className="text-sm text-muted-foreground">{t('kpis.withoutPlate')}</div>
            </div>
            <div className="rounded-lg border bg-amber-500/5 p-4">
              <div className="text-2xl font-bold tabular-nums text-amber-600">{dq.undefinedYear}</div>
              <div className="text-sm text-muted-foreground">{t('kpis.undefinedYear')}</div>
            </div>
            <div className="rounded-lg border bg-emerald-500/5 p-4">
              <div className="text-2xl font-bold tabular-nums text-emerald-600">{dq.total}</div>
              <div className="text-sm text-muted-foreground">{t('kpis.totalAssets')}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
