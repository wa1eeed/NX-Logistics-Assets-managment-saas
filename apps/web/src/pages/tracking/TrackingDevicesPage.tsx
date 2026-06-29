import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Cpu, MapPin, Plus } from 'lucide-react';
import type { TrackedAssetDto, TrackingDeviceDto } from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader, TableEmpty } from '../../components/PageHeader';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Flash, RegisterDeviceModal, TrackingDisabledNotice, useTrackingStatus } from './cards';

export function TrackingDevicesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('assets.update');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [registering, setRegistering] = useState(false);

  const statusQ = useTrackingStatus();
  const enabled = !!statusQ.data?.enabled;
  const assetsQ = useQuery({ queryKey: ['tracking-assets'], queryFn: async () => (await api.get<TrackedAssetDto[]>('/tracking/assets')).data, refetchInterval: LIVE_REFETCH_MS, enabled });
  const devicesQ = useQuery({ queryKey: ['tracking-devices'], queryFn: async () => (await api.get<TrackingDeviceDto[]>('/tracking/devices')).data, enabled });
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['tracking-status'] }); void qc.invalidateQueries({ queryKey: ['tracking-assets'] }); void qc.invalidateQueries({ queryKey: ['tracking-devices'] }); };
  const disable = useMutation({ mutationFn: (assetId: string) => api.post(`/tracking/assets/${assetId}/disable`), onSuccess: invalidate, onError: (e) => setMsg({ ok: false, text: extractApiError(e) }) });

  const assets = assetsQ.data ?? [];

  return (
    <div>
      <PageHeader title={t('tracking.devicesPageTitle')} subtitle={t('tracking.devicesPageSubtitle')} />
      <Flash msg={msg} />

      {statusQ.data && !enabled && <TrackingDisabledNotice />}

      {enabled && (
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />{t('tracking.devicesTitle')}</span>
              {canManage && <Button size="sm" variant="outline" onClick={() => setRegistering(true)}><Plus className="h-3.5 w-3.5" />{t('tracking.registerDevice')}</Button>}
            </CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('tracking.externalId')}</TableHead>
                  <TableHead>{t('tracking.asset')}</TableHead>
                  <TableHead>{t('tracking.provider')}</TableHead>
                  <TableHead>{t('tracking.lastSeen')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {devicesQ.data?.length === 0 && <TableEmpty colSpan={4}>{t('tracking.noDevices')}</TableEmpty>}
                  {devicesQ.data?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.externalId}</TableCell>
                      <TableCell className="font-mono text-sm">{d.assetCode ?? '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{d.provider}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString(isAr ? 'ar' : 'en-GB') : t('tracking.never')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" />{t('tracking.tracked')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('tracking.asset')}</TableHead>
                  <TableHead>{t('tracking.location')}</TableHead>
                  <TableHead>{t('tracking.lastSeen')}</TableHead>
                  {canManage && <TableHead className="text-end">{t('common.actions')}</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {assets.length === 0 && <TableEmpty colSpan={canManage ? 4 : 3}>{t('tracking.noneTracked')}</TableEmpty>}
                  {assets.map((a) => (
                    <TableRow key={a.assetId}>
                      <TableCell><span className="font-mono font-semibold">{a.code}</span><span className="block text-xs text-muted-foreground">{a.name}</span></TableCell>
                      <TableCell className="text-sm" dir="ltr">{a.lastLat != null ? `${a.lastLat.toFixed(5)}, ${a.lastLng?.toFixed(5)}` : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString(isAr ? 'ar' : 'en-GB') : t('tracking.never')}</TableCell>
                      {canManage && <TableCell className="text-end"><Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => disable.mutate(a.assetId)}>{t('tracking.disable')}</Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {registering && <RegisterDeviceModal onClose={() => setRegistering(false)} onSaved={() => { setRegistering(false); invalidate(); }} onErr={(e) => setMsg({ ok: false, text: extractApiError(e) })} />}
    </div>
  );
}
