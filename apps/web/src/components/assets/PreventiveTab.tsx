import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Gauge, Plus, CheckCircle2, Trash2, Wrench } from 'lucide-react';
import {
  PLAN_INTERVAL_TYPES, type AssetPreventive, type DueStatus, type PlanIntervalType,
} from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../ConfirmProvider';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const statusVariant: Record<DueStatus, 'destructive' | 'warning' | 'success'> = { OVERDUE: 'destructive', DUE_SOON: 'warning', OK: 'success' };

export function PreventiveTab({ assetId }: { assetId: string }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const canManage = hasPermission('maintenance.create');

  const q = useQuery({ queryKey: ['preventive', assetId], queryFn: async () => (await api.get<AssetPreventive>(`/assets/${assetId}/preventive`)).data });
  const data = q.data;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['preventive', assetId] }); void qc.invalidateQueries({ queryKey: ['compliance'] }); };

  const [reading, setReading] = useState('');
  const [meterType, setMeterType] = useState('');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [plan, setPlan] = useState({ name: '', intervalType: 'KM' as PlanIntervalType, intervalValue: '' });

  const recordMeter = useMutation({
    mutationFn: () => api.post(`/assets/${assetId}/meter`, { value: Number(reading) }),
    onSuccess: () => { setReading(''); setErr(''); invalidate(); }, onError: (e) => setErr(extractApiError(e)),
  });
  const setType = useMutation({
    mutationFn: (mt: string) => api.patch(`/assets/${assetId}/meter-type`, { meterType: mt }),
    onSuccess: invalidate, onError: (e) => setErr(extractApiError(e)),
  });
  const addPlan = useMutation({
    mutationFn: () => api.post(`/assets/${assetId}/maintenance-plans`, { name: plan.name, intervalType: plan.intervalType, intervalValue: Number(plan.intervalValue) }),
    onSuccess: () => { setAdding(false); setPlan({ name: '', intervalType: 'KM', intervalValue: '' }); invalidate(); }, onError: (e) => setErr(extractApiError(e)),
  });
  const logService = useMutation({ mutationFn: (planId: string) => api.post(`/maintenance-plans/${planId}/service`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });
  const removePlan = useMutation({ mutationFn: (planId: string) => api.delete(`/maintenance-plans/${planId}`), onSuccess: invalidate, onError: (e) => alert(extractApiError(e)) });

  if (q.isLoading || !data) return <div className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;

  const unitLabel = data.meterType === 'KM' ? t('compliance.km') : data.meterType === 'HOURS' ? t('compliance.hours') : '';
  const remainingText = (p: { intervalType: PlanIntervalType; remaining: number }) => {
    if (p.intervalType === 'DAYS') return p.remaining < 0 ? t('compliance.overdueByDays', { n: Math.abs(p.remaining) }) : t('compliance.inDays', { n: p.remaining });
    const u = p.intervalType === 'KM' ? t('compliance.km') : t('compliance.hours');
    return p.remaining < 0 ? t('compliance.overdueByUnit', { n: Math.abs(p.remaining), unit: u }) : t('compliance.inUnit', { n: p.remaining, unit: u });
  };

  return (
    <div className="space-y-5">
      {err && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      {/* Meter */}
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-primary" />{t('preventive.meter')}</div>
        {data.meterType === 'NONE' ? (
          <div className="flex items-end gap-2">
            <p className="text-sm text-muted-foreground">{t('preventive.noMeter')}</p>
            {canManage && (
              <Select value={meterType} onValueChange={(v) => { setMeterType(v); setType.mutate(v); }}>
                <SelectTrigger className="max-w-[160px]"><SelectValue placeholder={t('preventive.setMeter')} /></SelectTrigger>
                <SelectContent><SelectItem value="KM">{t('compliance.km')}</SelectItem><SelectItem value="HOURS">{t('compliance.hours')}</SelectItem></SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-2xl font-bold tabular-nums" dir="ltr">{data.currentMeter.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{unitLabel}</span></div>
              <div className="text-xs text-muted-foreground">{data.meterUpdatedAt ? new Date(data.meterUpdatedAt).toLocaleDateString(isAr ? 'ar' : 'en-GB') : '—'}</div>
            </div>
            {canManage && (
              <div className="flex items-end gap-2">
                <div className="space-y-1.5"><Label>{t('preventive.newReading')}</Label><Input type="number" dir="ltr" className="max-w-[160px]" value={reading} onChange={(e) => setReading(e.target.value)} /></div>
                <Button disabled={recordMeter.isPending || !reading} onClick={() => { setErr(''); recordMeter.mutate(); }}>{t('preventive.record')}</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-primary" />{t('preventive.plans')}</div>
          {canManage && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />{t('preventive.addPlan')}</Button>}
        </div>

        {adding && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-3">
            <div className="space-y-1.5"><Label>{t('preventive.planName')}</Label><Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('preventive.intervalType')}</Label>
              <Select value={plan.intervalType} onValueChange={(v) => setPlan({ ...plan, intervalType: v as PlanIntervalType })}>
                <SelectTrigger className="max-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_INTERVAL_TYPES.map((it) => <SelectItem key={it} value={it}>{t(`preventive.interval.${it}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('preventive.intervalValue')}</Label><Input type="number" dir="ltr" className="max-w-[120px]" value={plan.intervalValue} onChange={(e) => setPlan({ ...plan, intervalValue: e.target.value })} /></div>
            <Button size="sm" disabled={addPlan.isPending || !plan.name || !plan.intervalValue} onClick={() => { setErr(''); addPlan.mutate(); }}>{t('common.save')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
          </div>
        )}

        {data.plans.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('preventive.noPlans')}</p>
        ) : (
          <div className="space-y-2">
            {data.plans.map((p) => (
              <div key={p.id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5', p.status === 'OVERDUE' && 'border-destructive/30 bg-destructive/5')}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">{p.name} <Badge variant={statusVariant[p.status]}>{t(`compliance.status.${p.status}`)}</Badge></div>
                  <div className="text-xs text-muted-foreground">{t('preventive.every', { n: p.intervalValue.toLocaleString(), unit: t(`preventive.interval.${p.intervalType}`) })} · {remainingText(p)}</div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => logService.mutate(p.id)}><CheckCircle2 className="h-3.5 w-3.5" />{t('preventive.logService')}</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (await confirm({ title: t('preventive.deletePlan'), description: t('preventive.confirmDelete'), destructive: true, confirmText: t('common.delete') })) removePlan.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
