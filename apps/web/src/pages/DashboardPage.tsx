import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, ShieldCheck, Network, Boxes, Truck, ScrollText } from 'lucide-react';
import type { ComponentType } from 'react';
import { api, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { GlowCard } from '../components/effects/GlowCard';
import { AnimatedNumber } from '../components/effects/AnimatedNumber';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface Summary {
  counts: {
    users: number; roles: number; orgUnits: number;
    assetTypes: number; assets: number; auditEntries: number;
  };
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });

  const allCards: { key: keyof Summary['counts']; label: string; icon: ComponentType<{ className?: string }>; tint: string; perm: string }[] = [
    { key: 'users', label: t('dashboard.users'), icon: Users, tint: 'text-blue-500 bg-blue-500/10', perm: 'users.read' },
    { key: 'roles', label: t('dashboard.roles'), icon: ShieldCheck, tint: 'text-violet-500 bg-violet-500/10', perm: 'roles.read' },
    { key: 'orgUnits', label: t('dashboard.orgUnits'), icon: Network, tint: 'text-emerald-500 bg-emerald-500/10', perm: 'org_units.read' },
    { key: 'assetTypes', label: t('dashboard.assetTypes'), icon: Boxes, tint: 'text-amber-500 bg-amber-500/10', perm: 'asset_types.read' },
    { key: 'assets', label: t('dashboard.assets'), icon: Truck, tint: 'text-sky-500 bg-sky-500/10', perm: 'assets.read' },
    { key: 'auditEntries', label: t('dashboard.auditEntries'), icon: ScrollText, tint: 'text-rose-500 bg-rose-500/10', perm: 'audit.read' },
  ];
  // Only show the counts a portal actually has access to.
  const cards = allCards.filter((c) => hasPermission(c.perm));

  return (
    <div>
      <PageHeader title={`${t('dashboard.welcome')}, ${user?.fullName ?? ''}`} subtitle={t('dashboard.overview')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <GlowCard key={c.key} delay={i * 0.06} className="p-5">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${c.tint}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {isLoading ? '—' : <AnimatedNumber value={data?.counts[c.key] ?? 0} />}
            </div>
          </GlowCard>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.yourRoles')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {user?.roles.map((r) => (
            <Badge key={r} variant="default">{r}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
