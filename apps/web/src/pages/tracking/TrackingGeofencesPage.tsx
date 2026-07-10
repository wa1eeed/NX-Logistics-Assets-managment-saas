import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import type { GeofenceDto } from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useMapsKey } from '../../lib/maps';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { GeofenceEditor } from '../../components/maps/GeofenceEditor';
import { Flash, GeofenceCard, TrackingDisabledNotice, useTrackingStatus } from './cards';

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
        apiKey ? (
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
        )
      )}
    </div>
  );
}
