import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { GeofenceDto } from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
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

  return (
    <div>
      <PageHeader title={t('tracking.geofencesPageTitle')} subtitle={t('tracking.geofencesPageSubtitle')} />
      <Flash msg={msg} />

      {statusQ.data && !enabled && <TrackingDisabledNotice />}

      {enabled && (
        <GeofenceCard
          fences={fencesQ.data ?? []}
          canManage={canManage}
          onChange={() => void qc.invalidateQueries({ queryKey: ['geofences'] })}
          onErr={(e) => setMsg({ ok: false, text: extractApiError(e) })}
        />
      )}
    </div>
  );
}
