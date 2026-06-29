import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  HANDOVER_CHECKLIST, CONDITION_RATINGS, InspectionKind,
  type ChecklistEntry, type HandoverView, type RentalContractSummary,
} from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function HandoverDialog({ contract, onClose }: { contract: RentalContractSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canPerform = hasPermission('rentals.return');

  const q = useQuery({
    queryKey: ['handover', contract.id],
    queryFn: async () => (await api.get<HandoverView>(`/rentals/contracts/${contract.id}/handover`)).data,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['handover', contract.id] });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{t('handover.title')} · {contract.authorizationNo}</DialogTitle></DialogHeader>
        {q.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="space-y-5">
            <InspectionPanel kind={InspectionKind.RECEIPT} view={q.data!} contractId={contract.id} canPerform={canPerform} onSaved={refresh} />
            <InspectionPanel kind={InspectionKind.RETURN} view={q.data!} contractId={contract.id} canPerform={canPerform} onSaved={refresh} />
            {q.data?.diff && q.data.diff.length > 0 && <DiffPanel view={q.data} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InspectionPanel({
  kind, view, contractId, canPerform, onSaved,
}: {
  kind: 'RECEIPT' | 'RETURN'; view: HandoverView; contractId: string; canPerform: boolean; onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const existing = kind === 'RECEIPT' ? view.receipt : view.return;
  const title = kind === 'RECEIPT' ? t('handover.receipt') : t('handover.return');
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-GB') : '—');

  const [entries, setEntries] = useState<ChecklistEntry[]>(HANDOVER_CHECKLIST.map((c) => ({ key: c.key, condition: 'GOOD', note: '' })));
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const [signedByRole, setSignedByRole] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post(`/rentals/contracts/${contractId}/inspections`, {
      kind, checklist: entries, odometer: odometer ? Number(odometer) : undefined,
      notes: notes || undefined, signedBy, signedByRole: signedByRole || undefined,
    }),
    onSuccess: onSaved,
    onError: (e) => setError(extractApiError(e)),
  });
  const photo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('file', file);
      return api.post(`/inspections/${existing!.id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: onSaved,
  });
  async function openPhoto(key: string) {
    const { data } = await api.get<{ url: string }>('/inspections/photo-url', { params: { key } });
    window.open(data.url, '_blank');
  }

  const label = (key: string) => {
    const it = HANDOVER_CHECKLIST.find((c) => c.key === key);
    return it ? (i18n.language === 'ar' ? it.ar : it.en) : key;
  };

  const blockedReturn = kind === 'RETURN' && !view.receipt;

  if (existing) {
    return (
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-success" />{title}</h4>
          <span className="text-xs text-muted-foreground">{t('handover.signedAt')}: {fmt(existing.signedAt)}</span>
        </div>
        <div className="mb-2 text-sm">
          <span className="text-muted-foreground">{t('handover.signedBy')}: </span>
          <span className="font-medium">{existing.signedBy}</span>
          {existing.signedByRole && <Badge variant="outline" className="ms-2">{existing.signedByRole}</Badge>}
          {existing.odometer != null && <span className="ms-3 text-muted-foreground">{t('handover.odometer')}: <b className="text-foreground">{existing.odometer}</b></span>}
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {existing.checklist.map((e) => (
            <div key={e.key} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
              <span className="text-muted-foreground">{label(e.key)}</span>
              <Badge variant={e.condition === 'DAMAGED' ? 'destructive' : e.condition === 'POOR' ? 'warning' : 'secondary'}>
                {t(`handover.conditions.${e.condition}`)}
              </Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {existing.photos.map((k) => (
            <Button key={k} variant="outline" size="sm" onClick={() => openPhoto(k)}><Download className="h-3.5 w-3.5" />{t('handover.photos')}</Button>
          ))}
          {canPerform && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              <Upload className="h-3.5 w-3.5" />{t('handover.addPhoto')}
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && photo.mutate(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h4 className="mb-3 font-semibold">{kind === 'RECEIPT' ? t('handover.performReceipt') : t('handover.performReturn')}</h4>
      {blockedReturn ? (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t('handover.noReceipt')}</p>
      ) : !canPerform ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-3">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {entries.map((e, i) => (
              <div key={e.key} className="space-y-1">
                <Label className="text-xs">{label(e.key)}</Label>
                <Select value={e.condition} onValueChange={(v) => setEntries(entries.map((x, idx) => idx === i ? { ...x, condition: v as ChecklistEntry['condition'] } : x))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITION_RATINGS.map((c) => <SelectItem key={c} value={c}>{t(`handover.conditions.${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>{t('handover.odometer')}</Label><Input type="number" dir="ltr" value={odometer} onChange={(e) => setOdometer(e.target.value)} /></div>
            <div className="space-y-1"><Label>{t('handover.signedBy')}</Label><Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} /></div>
            <div className="space-y-1"><Label>{t('handover.signedByRole')}</Label><Input value={signedByRole} onChange={(e) => setSignedByRole(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>{t('handover.notes')}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !signedBy}>
            <CheckCircle2 className="h-4 w-4" />{mut.isPending ? t('common.saving') : t('handover.sign')}
          </Button>
        </div>
      )}
    </div>
  );
}

function DiffPanel({ view }: { view: HandoverView }) {
  const { t, i18n } = useTranslation();
  const label = (key: string) => {
    const it = HANDOVER_CHECKLIST.find((c) => c.key === key);
    return it ? (i18n.language === 'ar' ? it.ar : it.en) : key;
  };
  return (
    <div className="rounded-lg border p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />{t('handover.diff')}</h4>
      {view.odometerDelta != null && (
        <p className="mb-2 text-sm text-muted-foreground">{t('handover.odometerDelta')}: <b className="text-foreground">{view.odometerDelta}</b></p>
      )}
      <div className="space-y-1.5">
        {view.diff.map((d) => (
          <div key={d.key} className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm ${d.deteriorated ? 'border-destructive/40 bg-destructive/5' : ''}`}>
            <span>{label(d.key)}</span>
            <span className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">{d.receipt ? t(`handover.conditions.${d.receipt}`) : '—'}</Badge>
              <span className="text-muted-foreground rtl:rotate-180">→</span>
              <Badge variant={d.deteriorated ? 'destructive' : 'secondary'}>{d.return ? t(`handover.conditions.${d.return}`) : '—'}</Badge>
              {d.deteriorated && <Badge variant="destructive">{t('handover.deteriorated')}</Badge>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
