import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { READINESS_CHECKLIST, READINESS_REQUIRED_KEYS, type ReadinessEntry } from '@nx-lam/shared';
import { api, extractApiError } from '../../lib/api';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const GROUPS: ('safety' | 'devices' | 'compliance')[] = ['safety', 'devices', 'compliance'];

/** Shown on a COMMISSIONING asset — confirm safety + device check points to make it AVAILABLE. */
export function ReadinessPanel({ assetId, onCommissioned }: { assetId: string; onCommissioned: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [state, setState] = useState<Record<string, boolean>>(() => Object.fromEntries(READINESS_CHECKLIST.map((c) => [c.key, false])));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const checklist: ReadinessEntry[] = READINESS_CHECKLIST.map((c) => ({ key: c.key, ok: !!state[c.key] }));
      return api.post(`/assets/${assetId}/commission`, { checklist, notes: notes || undefined });
    },
    onSuccess: onCommissioned,
    onError: (e) => setError(extractApiError(e)),
  });

  const requiredMet = READINESS_REQUIRED_KEYS.every((k) => state[k]);
  const label = (key: string) => t(`commissioning.items.${key}`);

  return (
    <Card className="mb-5 border-warning/40 bg-warning/5">
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-warning" />
          <h3 className="font-semibold">{t('commissioning.title')}</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t('commissioning.banner')}</p>
        {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`commissioning.groups.${g}`)}</div>
              <div className="space-y-2">
                {READINESS_CHECKLIST.filter((c) => c.group === g).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-accent">
                    <Checkbox checked={!!state[c.key]} onCheckedChange={(v) => setState({ ...state, [c.key]: !!v })} className="mt-0.5" />
                    <span className="text-sm leading-tight">
                      {label(c.key)}
                      {c.required && <Badge variant="outline" className="ms-1.5 text-[10px]">{t('commissioning.required')}</Badge>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5">
          <Label>{t('commissioning.notes')}</Label>
          <input className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} dir={isAr ? 'rtl' : 'ltr'} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !requiredMet}>
            <CheckCircle2 className="h-4 w-4" />{mut.isPending ? t('common.saving') : t('commissioning.confirm')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
