import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Wallet, Plus, Users, CheckCircle2, Lock, Sparkles, CreditCard, FileText, Printer } from 'lucide-react';
import {
  MODULE_LABELS, TOPUP_PRESETS, type BillingOverviewDto, type CheckoutDto, type CheckoutResult,
  type InvoiceDto, type ModuleAddonStatus, type PlatformModule,
} from '@nx-lam/shared';
import { api, extractApiError, LIVE_REFETCH_MS } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export function BillingPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('billing.manage');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const q = useQuery({
    queryKey: ['billing'],
    queryFn: async () => (await api.get<BillingOverviewDto>('/billing')).data,
    refetchInterval: LIVE_REFETCH_MS,
  });
  const data = q.data;

  const onOk = (text: string) => {
    setMsg({ ok: true, text });
    void qc.invalidateQueries({ queryKey: ['billing'] });
    void qc.invalidateQueries({ queryKey: ['entitlements'] });
  };
  const onErr = (e: unknown) => setMsg({ ok: false, text: extractApiError(e) });

  const fmt = (n: number) => new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')} />

      {msg && (
        <div className={cn('mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : null}{msg.text}
        </div>
      )}

      {q.isLoading && <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>}

      {data && (
        <div className="space-y-5">
          {/* Wallet + usage stat band */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label={t('billing.walletBalance')} value={fmt(data.walletBalance)} icon={Wallet} tint="text-emerald-500 bg-emerald-500/10" />
            <StatTile label={t('billing.seats')} value={`${data.userCount} / ${data.maxUserCount}`} icon={Users} tint="text-blue-500 bg-blue-500/10" />
            <StatTile label={t('billing.seatPrice')} value={`${fmt(data.seatPrice)}`} icon={Sparkles} tint="text-violet-500 bg-violet-500/10" />
          </div>

          {/* Top-up */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" />{t('billing.topUp')}</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{t('billing.topUpHint')}</p>
              {canManage ? <TopUpForm presets={TOPUP_PRESETS} fmt={fmt} onErr={onErr} /> : <ReadOnlyNote />}
            </CardContent>
          </Card>

          {/* Buy seats */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />{t('billing.buySeats')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('billing.buySeatsHint', { price: fmt(data.seatPrice) })}</p>
              {canManage ? <BuySeatsForm seatPrice={data.seatPrice} balance={data.walletBalance} fmt={fmt} onOk={onOk} onErr={onErr} /> : <ReadOnlyNote />}
            </CardContent>
          </Card>

          {/* Module add-ons */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />{t('billing.addons')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.addons.map((a) => (
                  <AddonCard key={a.module} addon={a} isAr={isAr} fmt={fmt} canManage={canManage} balance={data.walletBalance} onOk={onOk} onErr={onErr} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transactions */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('billing.transactions')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('billing.txnType')}</TableHead>
                    <TableHead>{t('billing.txnDesc')}</TableHead>
                    <TableHead className="text-end">{t('billing.txnAmount')}</TableHead>
                    <TableHead className="text-end">{t('billing.txnBalance')}</TableHead>
                    <TableHead className="text-end">{t('common.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('billing.noTxns')}</TableCell></TableRow>
                  )}
                  {data.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell><Badge variant={tx.type === 'TOPUP' ? 'success' : 'secondary'}>{t(`billing.types.${tx.type}`)}</Badge></TableCell>
                      <TableCell className="text-sm">{tx.description}</TableCell>
                      <TableCell className={cn('text-end font-medium tabular-nums', tx.amount >= 0 ? 'text-success' : 'text-destructive')} dir="ltr">{tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}</TableCell>
                      <TableCell className="text-end tabular-nums" dir="ltr">{fmt(tx.balanceAfter)}</TableCell>
                      <TableCell className="text-end text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <InvoicesCard fmt={fmt} isAr={isAr} />
        </div>
      )}
    </div>
  );
}

function InvoicesCard({ fmt, isAr }: { fmt: (n: number) => string; isAr: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<InvoiceDto | null>(null);
  const q = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get<InvoiceDto[]>('/invoices')).data, refetchInterval: LIVE_REFETCH_MS });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />{t('invoices.title')}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <p className="px-6 pb-2 text-sm text-muted-foreground">{t('invoices.hint')}</p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('invoices.number')}</TableHead>
            <TableHead>{t('invoices.date')}</TableHead>
            <TableHead className="text-end">{t('invoices.total')}</TableHead>
            <TableHead>{t('invoices.status')}</TableHead>
            <TableHead className="text-end">{t('common.actions')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('invoices.none')}</TableCell></TableRow>}
            {q.data?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-semibold">{inv.number}</TableCell>
                <TableCell className="text-sm">{new Date(inv.issuedAt).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{fmt(inv.total)}</TableCell>
                <TableCell><Badge variant={inv.status === 'PAID' ? 'success' : 'secondary'}>{inv.status}</Badge></TableCell>
                <TableCell className="text-end"><Button size="sm" variant="outline" onClick={() => setOpen(inv)}>{t('invoices.view')}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {open && <InvoiceModal invoice={open} fmt={fmt} isAr={isAr} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function InvoiceModal({ invoice, fmt, isAr, onClose }: { invoice: InvoiceDto; fmt: (n: number) => string; isAr: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const inv = invoice;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center justify-between">
          <span>{t('invoices.taxInvoice')} · {inv.number}</span>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />{t('invoices.print')}</Button>
        </DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm" id="invoice-print">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground">{t('invoices.seller')}</div>
              <div className="font-medium">{inv.seller.name}</div>
              {inv.seller.vat && <div className="text-xs">{t('invoices.vatNo')}: {inv.seller.vat}</div>}
              {inv.seller.cr && <div className="text-xs">{t('invoices.crNo')}: {inv.seller.cr}</div>}
              {inv.seller.address && <div className="text-xs text-muted-foreground">{inv.seller.address}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">{t('invoices.buyer')}</div>
              <div className="font-medium">{inv.buyer.name}</div>
              {inv.buyer.vat && <div className="text-xs">{t('invoices.vatNo')}: {inv.buyer.vat}</div>}
              {inv.buyer.cr && <div className="text-xs">{t('invoices.crNo')}: {inv.buyer.cr}</div>}
              {inv.buyer.address && <div className="text-xs text-muted-foreground">{inv.buyer.address}</div>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{t('invoices.date')}: {new Date(inv.issuedAt).toLocaleString(isAr ? 'ar' : 'en-GB')}</div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('invoices.description')}</TableHead>
              <TableHead className="text-end">{t('invoices.qty')}</TableHead>
              <TableHead className="text-end">{t('invoices.unitPrice')}</TableHead>
              <TableHead className="text-end">{t('invoices.lineTotal')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {inv.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-end tabular-nums">{l.quantity}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{fmt(l.unitPrice)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{fmt(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="ms-auto max-w-[260px] space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('invoices.subtotal')}</span><span dir="ltr">{fmt(inv.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('invoices.vat', { rate: inv.vatRate })}</span><span dir="ltr">{fmt(inv.vatAmount)}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold"><span>{t('invoices.grandTotal')}</span><span dir="ltr">{fmt(inv.total)}</span></div>
          </div>
          {inv.paymentMethod && <div className="text-xs text-muted-foreground">{t('invoices.paidVia')}: {inv.paymentMethod} · {t('invoices.ref')}: {inv.paymentRef}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyNote() {
  const { t } = useTranslation();
  return <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t('billing.readOnly')}</p>;
}

/** Starts a Tap checkout and redirects the browser to the hosted payment page. */
function useCheckout(onErr: (e: unknown) => void) {
  return useMutation({
    mutationFn: async (payload: CheckoutDto) => (await api.post<CheckoutResult>('/payments/checkout', payload)).data,
    onSuccess: (res) => { window.location.assign(res.redirectUrl); },
    onError: onErr,
  });
}

function TopUpForm({ presets, fmt, onErr }: { presets: number[]; fmt: (n: number) => string; onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const checkout = useCheckout(onErr);
  const pay = (amt: number) => checkout.mutate({ purpose: 'WALLET_TOPUP', amount: amt });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p} variant="outline" size="sm" disabled={checkout.isPending} onClick={() => pay(p)}>{fmt(p)}</Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label>{t('billing.customAmount')}</Label>
          <Input type="number" min="1" dir="ltr" className="max-w-[180px]" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button disabled={checkout.isPending || !amount || Number(amount) <= 0} onClick={() => pay(Number(amount))}>
          <CreditCard className="h-4 w-4" />{t('billing.payByCard')}
        </Button>
      </div>
      {checkout.isPending && <p className="text-xs text-muted-foreground">{t('billing.redirecting')}</p>}
    </div>
  );
}

function BuySeatsForm({ seatPrice, balance, fmt, onOk, onErr }: { seatPrice: number; balance: number; fmt: (n: number) => string; onOk: (t: string) => void; onErr: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState('1');
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  const cost = n * seatPrice;
  const insufficient = cost > balance;
  const checkout = useCheckout(onErr);
  const fromWallet = useMutation({
    mutationFn: () => api.post('/billing/purchase/seats', { quantity: n }),
    onSuccess: () => { setQty('1'); onOk(t('billing.seatsBought', { n })); },
    onError: onErr,
  });
  const busy = checkout.isPending || fromWallet.isPending;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>{t('billing.quantity')}</Label>
        <Input type="number" min="1" dir="ltr" className="max-w-[120px]" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="text-sm text-muted-foreground">{t('billing.totalCost')}: <span className="font-semibold text-foreground" dir="ltr">{fmt(cost)}</span></div>
      <Button variant="outline" disabled={busy || insufficient} onClick={() => fromWallet.mutate()}>
        <Wallet className="h-4 w-4" />{t('billing.payFromWallet')}
      </Button>
      <Button disabled={busy} onClick={() => checkout.mutate({ purpose: 'SEATS', quantity: n })}>
        <CreditCard className="h-4 w-4" />{t('billing.payByCard')}
      </Button>
      {checkout.isPending && <span className="text-xs text-muted-foreground">{t('billing.redirecting')}</span>}
    </div>
  );
}

function AddonCard({ addon, isAr, fmt, canManage, balance, onOk, onErr }: {
  addon: ModuleAddonStatus; isAr: boolean; fmt: (n: number) => string; canManage: boolean; balance: number;
  onOk: (t: string) => void; onErr: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const label = isAr ? MODULE_LABELS[addon.module as PlatformModule].ar : MODULE_LABELS[addon.module as PlatformModule].en;
  const fromWallet = useMutation({
    mutationFn: () => api.post('/billing/purchase/module', { module: addon.module }),
    onSuccess: () => onOk(t('billing.moduleActivated', { module: label })),
    onError: onErr,
  });
  const checkout = useCheckout(onErr);
  const insufficient = addon.price > balance;
  const busy = fromWallet.isPending || checkout.isPending;
  return (
    <div className={cn('flex flex-col justify-between rounded-xl border p-4', addon.enabled ? 'border-success/30 bg-success/5' : 'border-border')}>
      <div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{label}</span>
          {addon.enabled ? <Badge variant="success">{t('billing.active')}</Badge> : addon.core ? <Badge variant="secondary">{t('billing.core')}</Badge> : <Badge variant="outline">{fmt(addon.price)}<span className="text-[10px]">/{t('billing.month')}</span></Badge>}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {addon.enabled ? (
          <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" />{t('billing.included')}</span>
        ) : addon.core ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />{t('billing.alwaysOn')}</span>
        ) : canManage ? (
          <>
            <Button size="sm" variant="outline" className="w-full" disabled={busy || insufficient} onClick={() => fromWallet.mutate()}>
              <Wallet className="h-3.5 w-3.5" />{insufficient ? t('billing.insufficient') : t('billing.payFromWallet')}
            </Button>
            <Button size="sm" className="w-full" disabled={busy} onClick={() => checkout.mutate({ purpose: 'MODULE', module: addon.module })}>
              <CreditCard className="h-3.5 w-3.5" />{t('billing.payByCard')}
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t('billing.readOnly')}</span>
        )}
      </div>
    </div>
  );
}
