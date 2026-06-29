import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, CalendarPlus, Undo2, Boxes, Clock, AlertTriangle, Truck, Search } from 'lucide-react';
import type { CustodyView, RentalContractSummary } from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { PageHeader } from '../components/PageHeader';
import { GlowCard } from '../components/effects/GlowCard';
import { AnimatedNumber } from '../components/effects/AnimatedNumber';
import { CreateRequestModal, ExtendModal } from '../components/rentals/modals';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';

export function CustodyPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['custody'], queryFn: async () => (await api.get<CustodyView>('/rentals/contracts/custody')).data, refetchInterval: LIVE_REFETCH_MS });
  const [requesting, setRequesting] = useState(false);
  const [extending, setExtending] = useState<RentalContractSummary | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['custody'] });
    void qc.invalidateQueries({ queryKey: ['contracts'] });
    void qc.invalidateQueries({ queryKey: ['requests'] });
  };

  const ret = useMutation({
    mutationFn: (id: string) => api.post(`/rentals/contracts/${id}/return`),
    onSuccess: invalidate,
    onError: (e) => alert(extractApiError(e)),
  });

  const canRequest = hasPermission('rentals.request');
  const canExtend = hasPermission('rentals.extend');
  const canReturn = hasPermission('rentals.return');
  const threshold = q.data?.expiryThresholdDays ?? 14;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB');

  const stats = [
    { key: 'inCustody', label: t('custody.inCustody'), value: q.data?.summary.active ?? 0, icon: Boxes, tint: 'text-blue-500 bg-blue-500/10' },
    { key: 'expiringSoon', label: t('custody.expiringSoon'), value: q.data?.summary.expiringSoon ?? 0, icon: Clock, tint: 'text-amber-500 bg-amber-500/10' },
    { key: 'overdue', label: t('custody.overdue'), value: q.data?.summary.overdue ?? 0, icon: AlertTriangle, tint: 'text-rose-500 bg-rose-500/10' },
  ];

  function dayLabel(days: number) {
    if (days < 0) return <Badge variant="destructive">{t('custody.overdueBy')} {Math.abs(days)} {t('custody.days')}</Badge>;
    if (days <= threshold) return <Badge variant="warning">{t('custody.expiresIn')} {days} {t('custody.days')}</Badge>;
    return <Badge variant="outline">{days} {t('custody.daysLeft')}</Badge>;
  }

  // Client-side search + period (contract window overlap) filter.
  const contracts = (q.data?.contracts ?? []).filter((c) => {
    const s = search.trim().toLowerCase();
    if (s && !`${c.assetCode} ${c.assetTypeName} ${c.orgUnitName} ${c.authorizationNo}`.toLowerCase().includes(s)) return false;
    if (from && new Date(c.endDate) < new Date(from)) return false;
    if (to && new Date(c.startDate) > new Date(to)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title={t('custody.title')}
        subtitle={t('custody.subtitle')}
        action={canRequest && <Button onClick={() => setRequesting(true)}><Plus className="h-4 w-4" />{t('custody.requestEquipment')}</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <GlowCard key={s.key} delay={i * 0.06} className="p-5">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${s.tint}`}><s.icon className="h-5 w-5" /></div>
            <div className="text-sm font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums"><AnimatedNumber value={s.value} /></div>
          </GlowCard>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-64 ps-9" placeholder={t('custody.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="date" dir="ltr" className="w-[150px]" aria-label={t('custody.dateFrom')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted-foreground">—</span>
          <Input type="date" dir="ltr" className="w-[150px]" aria-label={t('custody.dateTo')} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {q.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : contracts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contracts.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground"><Truck className="h-5 w-5" /></div>
                    <div>
                      <div className="font-mono text-base font-bold">{c.assetCode}</div>
                      <div className="text-xs text-muted-foreground">{c.assetTypeName} · {c.orgUnitName}</div>
                    </div>
                  </div>
                  {dayLabel(c.daysRemaining)}
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">{t('custody.period')}</span>
                  <span className="font-medium">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('rentals.authNo')}</span>
                  <span className="font-mono">{c.authorizationNo}</span>
                </div>

                {(canExtend || canReturn) && (
                  <div className="mt-4 flex justify-end gap-2">
                    {canExtend && <Button variant="outline" size="sm" onClick={() => setExtending(c)}><CalendarPlus className="h-3.5 w-3.5" />{t('rentals.extend')}</Button>}
                    {canReturn && (
                      <Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: t('rentals.return'), description: t('rentals.confirmReturn'), confirmText: t('rentals.return') })) ret.mutate(c.id); }}>
                        <Undo2 className="h-3.5 w-3.5" />{t('rentals.return')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{t('custody.none')}</CardContent></Card>
      )}

      {requesting && <CreateRequestModal onClose={() => setRequesting(false)} onSaved={() => { setRequesting(false); invalidate(); }} />}
      {extending && <ExtendModal contract={extending} onClose={() => setExtending(null)} onSaved={() => { setExtending(null); invalidate(); }} />}
    </div>
  );
}
