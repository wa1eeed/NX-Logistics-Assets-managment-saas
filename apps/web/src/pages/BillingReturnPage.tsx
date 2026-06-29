import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2, Clock, CreditCard, ArrowLeft } from 'lucide-react';
import type { VerifyResult } from '@nx-lam/shared';
import { api, extractApiError } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function BillingReturnPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [params] = useSearchParams();
  const intent = params.get('intent');
  const sandbox = params.get('sandbox') === '1';
  const [confirmed, setConfirmed] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState('');

  const q = useQuery({
    queryKey: ['payment-verify', intent],
    queryFn: async () => (await api.get<VerifyResult>(`/payments/verify/${intent}`)).data,
    enabled: !!intent && !sandbox && !confirmed,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && s !== 'PENDING' ? false : 2500;
    },
  });

  const confirm = useMutation({
    mutationFn: async () => (await api.post<VerifyResult>(`/payments/sandbox/${intent}/confirm`)).data,
    onSuccess: (d) => setConfirmed(d),
    onError: (e) => setErr(extractApiError(e)),
  });

  const result = confirmed ?? q.data;
  const status = result?.status;
  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

  const back = (
    <Button asChild variant="outline" className="mt-2">
      <Link to="/billing"><ArrowLeft className="h-4 w-4" />{t('billing.return.backToBilling')}</Link>
    </Button>
  );

  let body: JSX.Element;
  if (!intent) {
    body = <State icon={<XCircle className="h-10 w-10 text-destructive" />} title={t('billing.return.failed')} hint={t('billing.return.failedHint')} extra={back} />;
  } else if (sandbox && !confirmed) {
    body = (
      <State
        icon={<CreditCard className="h-10 w-10 text-primary" />}
        title={t('billing.return.sandboxTitle')}
        hint={t('billing.return.sandboxHint')}
        extra={
          <div className="mt-2 flex flex-col items-center gap-2">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button disabled={confirm.isPending} onClick={() => confirm.mutate()}>
              {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t('billing.return.confirmSandbox')}
            </Button>
            {back}
          </div>
        }
      />
    );
  } else if (status === 'PAID') {
    const amt = result?.intent ? fmt(result.intent.amount, result.intent.currency) : '';
    body = <State icon={<CheckCircle2 className="h-10 w-10 text-success" />} title={t('billing.return.success')} hint={`${t('billing.return.successHint')} ${amt ? `(${amt})` : ''}`} extra={back} />;
  } else if (status === 'FAILED' || status === 'CANCELED') {
    body = <State icon={<XCircle className="h-10 w-10 text-destructive" />} title={t('billing.return.failed')} hint={t('billing.return.failedHint')} extra={back} />;
  } else if (status === 'PENDING') {
    body = (
      <State
        icon={<Clock className="h-10 w-10 text-amber-500" />}
        title={t('billing.return.pending')}
        hint={t('billing.return.pendingHint')}
        extra={
          <div className="mt-2 flex flex-col items-center gap-2">
            <Button variant="outline" onClick={() => q.refetch()}>{t('billing.return.refresh')}</Button>
            {back}
          </div>
        }
      />
    );
  } else {
    body = <State icon={<Loader2 className="h-10 w-10 animate-spin text-primary" />} title={t('billing.return.verifying')} hint="" extra={null} />;
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardContent className="py-10">{body}</CardContent>
      </Card>
    </div>
  );
}

function State({ icon, title, hint, extra }: { icon: JSX.Element; title: string; hint: string; extra: JSX.Element | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {extra}
    </div>
  );
}
