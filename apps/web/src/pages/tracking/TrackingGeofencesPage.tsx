import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Bell, LogIn, LogOut } from 'lucide-react';
import type { GeofenceDto, GeofenceEventDto } from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useMapsKey } from '../../lib/maps';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { GeofenceEditor } from '../../components/maps/GeofenceEditor';
import { Flash, GeofenceCard, TrackingDisabledNotice, useTrackingStatus } from './cards';

function GeofenceEventsCard() {
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ['geofence-events'],
    queryFn: async () => (await api.get<GeofenceEventDto[]>('/tracking/geofence-events')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const events = q.data ?? [];
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" />{t('tracking.recentEvents')}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 && <p className="text-sm text-muted-foreground">{t('tracking.noEvents')}</p>}
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
            <span className="flex items-center gap-2">
              {e.type === 'ENTER'
                ? <Badge variant="success" className="gap-1"><LogIn className="h-3 w-3" />{t('tracking.entered')}</Badge>
                : <Badge variant="secondary" className="gap-1"><LogOut className="h-3 w-3" />{t('tracking.left')}</Badge>}
              <span className="font-medium">{e.assetCode ?? e.assetId}</span>
              <span className="text-muted-foreground">— {e.geofenceName ?? '—'}</span>
            </span>
            <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TrackingGeofencesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('assets.update');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const statusQ = useTrackingStatus();
  const enabled = !!statusQ.data?.enabled;
  const fencesQ = useQuery({ queryKey: ['geofences'], queryFn: async () => (await api.get<GeofenceDto[]>('/tracking/geofences')).data, enabled });
  const { apiKey } = useMapsKey();

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['geofences'] });
  const onErr = (e: unknown) => setMsg({ ok: false, text: extractApiError(e) });

  return (
    <div>
      <PageHeader title={t('tracking.geofencesPageTitle')} subtitle={t('tracking.geofencesPageSubtitle')} />
      <Flash msg={msg} />

      {statusQ.data && !enabled && <TrackingDisabledNotice />}

      {enabled && (
        <>
          {apiKey ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" />{t('tracking.geofences')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GeofenceEditor apiKey={apiKey} fences={fencesQ.data ?? []} canManage={canManage} onChange={invalidate} onErr={onErr} />
              </CardContent>
            </Card>
          ) : (
            <GeofenceCard fences={fencesQ.data ?? []} canManage={canManage} onChange={invalidate} onErr={onErr} />
          )}

          <GeofenceEventsCard />
        </>
      )}
    </div>
  );
}
