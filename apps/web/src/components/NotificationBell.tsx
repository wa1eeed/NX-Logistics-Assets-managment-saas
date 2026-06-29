import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, ClipboardList, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { AlertsView, EquipmentRequestSummary } from '@nx-lam/shared';
import { api, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';

interface Item {
  id: string;
  kind: 'request' | 'alert';
  title: string;
  subtitle: string;
  severity: 'danger' | 'warning' | 'info';
  to: string;
}

const SEV_DOT: Record<string, string> = { danger: 'bg-rose-500', warning: 'bg-amber-500', info: 'bg-blue-500' };

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canAlerts = hasPermission('kpis.read');
  const canRentals = hasPermission('rentals.read');

  const alertsQ = useQuery({
    queryKey: ['alerts'], enabled: canAlerts, refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => (await api.get<AlertsView>('/alerts')).data,
  });
  const reqQ = useQuery({
    queryKey: ['requests'], enabled: canRentals, refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => (await api.get<EquipmentRequestSummary[]>('/rentals/requests')).data,
  });

  if (!canAlerts && !canRentals) return null;

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '');

  const requestItems: Item[] = (reqQ.data ?? [])
    .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
    .map((r) => ({
      id: `req-${r.id}`,
      kind: 'request',
      title: r.assetTypeName,
      subtitle: `${r.orgUnitName} · ${r.status === 'PENDING' ? t('notifications.awaitingApproval') : t('notifications.awaitingContract')}`,
      severity: 'info',
      to: '/rentals',
    }));

  const alertItems: Item[] = (alertsQ.data?.items ?? []).map((a) => ({
    id: `alert-${a.entityType}-${a.entityId}-${a.kind}`,
    kind: 'alert',
    title: t(`alerts.kinds.${a.kind}`),
    subtitle: `${a.title} · ${a.reference}${a.date ? ` · ${fmt(a.date)}` : ''}`,
    severity: a.severity,
    to: a.entityType === 'Asset' ? `/assets/${a.entityId}` : '/alerts',
  }));

  const total = requestItems.length + alertItems.length;

  const Row = ({ it }: { it: Item }) => (
    <button onClick={() => navigate(it.to)}
      className="flex w-full items-start gap-3 px-3 py-2.5 text-start transition-colors hover:bg-accent">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEV_DOT[it.severity])} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{it.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>
      </span>
      {it.kind === 'request'
        ? <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        : it.severity === 'danger'
          ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
          : <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={t('notifications.title')}>
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -end-0.5 -top-0.5 inline-flex">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold tabular-nums text-white">{total > 99 ? '99+' : total}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          <span className="text-xs text-muted-foreground">{total} {t('notifications.items')}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {total === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-7 w-7 text-emerald-500/70" />
              {t('notifications.empty')}
            </div>
          )}
          {requestItems.length > 0 && (
            <>
              <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('notifications.needsAction')} · {requestItems.length}</div>
              {requestItems.map((it) => <Row key={it.id} it={it} />)}
            </>
          )}
          {alertItems.length > 0 && (
            <>
              <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('notifications.alerts')} · {alertItems.length}</div>
              {alertItems.map((it) => <Row key={it.id} it={it} />)}
            </>
          )}
        </div>
        {canAlerts && (
          <button onClick={() => navigate('/alerts')} className="block w-full border-t px-3 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-accent">
            {t('notifications.viewAll')}
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
