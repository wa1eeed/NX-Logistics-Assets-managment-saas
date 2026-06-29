import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { BuyTrackingCard, Flash, StatusBand, WaslRequestCard, useTrackingStatus } from './cards';

export function TrackingSubscriptionPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canBuy = hasPermission('billing.manage');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const statusQ = useTrackingStatus();
  const st = statusQ.data;

  return (
    <div>
      <PageHeader title={t('tracking.subscriptionPageTitle')} subtitle={t('tracking.subscriptionPageSubtitle')} />
      <Flash msg={msg} />

      {st && <StatusBand st={st} />}

      <div className="space-y-5">
        {canBuy
          ? <BuyTrackingCard onErr={(e) => setMsg({ ok: false, text: extractApiError(e) })} />
          : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('tracking.buyNoPermission')}</CardContent></Card>}
        <WaslRequestCard canManage={canBuy} onErr={(e) => setMsg({ ok: false, text: extractApiError(e) })} />
      </div>
    </div>
  );
}
