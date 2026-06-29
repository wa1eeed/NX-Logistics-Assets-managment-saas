import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, ClipboardList, Wrench, Satellite, Gauge, ShieldCheck, Check, ChevronDown,
  ArrowRight, Sparkles, MapPin, Boxes, ClipboardCheck, IdCard, Banknote, Languages,
  TrendingUp, Plus,
} from 'lucide-react';
import type { PlanDto } from '@nx-lam/shared';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';

const FEATURES = [
  { icon: Truck, key: 'assets' },
  { icon: ClipboardList, key: 'rentals' },
  { icon: Wrench, key: 'maintenance' },
  { icon: Satellite, key: 'tracking' },
  { icon: Gauge, key: 'kpis' },
  { icon: ClipboardCheck, key: 'handover' },
  { icon: IdCard, key: 'drivers' },
  { icon: Banknote, key: 'disposal' },
  { icon: ShieldCheck, key: 'governance' },
] as const;

const STATS = [
  { icon: Boxes, key: 'assets' },
  { icon: MapPin, key: 'regions' },
  { icon: Satellite, key: 'live' },
  { icon: Languages, key: 'bilingual' },
] as const;

/** Premium modules shown as a checklist on each plan (keys match Plan.features). */
const PLAN_MODULES = ['finance', 'disposal', 'acquisition', 'suppliers', 'drivers', 'kpis'] as const;

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.5, ease: 'easeOut', delay }}
  >
    {children}
  </motion.div>
);

export function LandingPage() {
  const { t } = useTranslation();
  const plansQ = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => (await api.get<PlanDto[]>('/public/plans')).data,
    staleTime: 300_000,
  });
  const plans = (plansQ.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const popularName = plans.find((p) => /BUSINESS/i.test(p.name))?.name ?? plans[Math.min(2, plans.length - 1)]?.name;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-glow">NX</span>
            <span className="text-sm font-bold">{t('app.name')}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{t('landing.nav.features')}</a>
            <a href="#pricing" className="hover:text-foreground">{t('landing.nav.pricing')}</a>
            <a href="#faq" className="hover:text-foreground">{t('landing.nav.faq')}</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">{t('landing.nav.login')}</Link></Button>
            <Button asChild size="sm"><Link to="/register">{t('landing.nav.start')}</Link></Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 start-2/3 h-[560px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-400/25 via-teal-400/15 to-transparent blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:32px_32px] opacity-40" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            {/* text */}
            <div className="text-center lg:text-start">
              <Reveal>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />{t('landing.hero.badge')}
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{t('landing.hero.title')}</h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0 mx-auto">{t('landing.hero.subtitle')}</p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <Button asChild size="lg" className="gap-2"><Link to="/register">{t('landing.hero.ctaPrimary')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
                  <Button asChild size="lg" variant="outline"><a href="#features">{t('landing.hero.ctaSecondary')}</a></Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t('landing.hero.note')}</p>
              </Reveal>
            </div>

            {/* interactive product showcase */}
            <Reveal delay={0.15}>
              <HeroShowcase />
            </Reveal>
          </div>

          {/* stats strip */}
          <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.key} className="rounded-2xl border bg-card/70 p-4 text-start shadow-sm backdrop-blur">
                    <s.icon className="h-5 w-5 text-primary" />
                    <div className="mt-2 text-2xl font-extrabold tabular-nums">{t(`landing.stats.${s.key}_value`)}</div>
                    <div className="text-xs text-muted-foreground">{t(`landing.stats.${s.key}_label`)}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ===== Features ===== */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight">{t('landing.features.title')}</h2>
              <p className="mt-3 text-muted-foreground">{t('landing.features.subtitle')}</p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.key} delay={i * 0.05}>
                <div className="group h-full rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-card">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{t(`landing.feat.${f.key}_title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`landing.feat.${f.key}_desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ===== Pricing (live from catalog) ===== */}
        <section id="pricing" className="scroll-mt-20 border-y border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-extrabold tracking-tight">{t('landing.pricing.title')}</h2>
                <p className="mt-3 text-muted-foreground">{t('landing.pricing.subtitle')}</p>
              </div>
            </Reveal>

            {plans.length === 0 ? (
              <p className="mt-12 text-center text-sm text-muted-foreground">{t('landing.pricing.empty')}</p>
            ) : (
              <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
                {plans.map((p, i) => {
                  const popular = p.name === popularName;
                  return (
                    <Reveal key={p.id} delay={i * 0.05}>
                      <div className={cn('relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm', popular && 'border-primary ring-2 ring-primary/30 shadow-card')}>
                        {popular && <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow">{t('landing.pricing.popular')}</span>}
                        <div className="text-sm font-bold uppercase tracking-wide text-primary">{t(`landing.plan.${p.name}`, p.name)}</div>
                        <div className="mt-3 flex items-end gap-1">
                          <span className="text-4xl font-extrabold tabular-nums">{p.priceMonthly.toLocaleString()}</span>
                          <span className="pb-1 text-sm text-muted-foreground">{t('landing.pricing.currency')}/{t('landing.pricing.month')}</span>
                        </div>
                        <ul className="mt-5 space-y-2.5 text-sm">
                          <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{t('landing.pricing.seats', { seats: p.seats })}</li>
                          <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{t('landing.pricing.storage', { gb: p.storageGb })}</li>
                          <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{t('landing.pricing.base')}</li>
                          {p.perVehiclePrice != null && (
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{t('landing.pricing.tracking', { price: p.perVehiclePrice })}</li>
                          )}
                          {PLAN_MODULES.filter((m) => p.features?.[m]).map((m) => (
                            <li key={m} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{t(`landing.module.${m}`)}</li>
                          ))}
                        </ul>
                        <div className="mt-6 flex-1" />
                        <Button asChild variant={popular ? 'default' : 'outline'} className="mt-2 w-full"><Link to="/register">{t('landing.pricing.cta')}</Link></Button>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-muted-foreground">{t('landing.pricing.note')}</p>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold tracking-tight">{t('landing.faq.title')}</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => <Faq key={n} q={t(`landing.faq.q${n}`)} a={t(`landing.faq.a${n}`)} />)}
          </div>
        </section>

        {/* ===== Final CTA ===== */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-14 text-center text-white shadow-glow">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.15)_1px,transparent_0)] [background-size:24px_24px] opacity-30" />
              <h2 className="relative text-3xl font-extrabold">{t('landing.cta.title')}</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-white/85">{t('landing.cta.subtitle')}</p>
              <div className="relative mt-7">
                <Button asChild size="lg" variant="secondary" className="gap-2"><Link to="/register">{t('landing.cta.button')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-extrabold text-white">NX</span>
            <span>{t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-foreground">{t('landing.nav.login')}</Link>
            <Link to="/register" className="hover:text-foreground">{t('landing.nav.start')}</Link>
            <span>© {t('landing.footer.rights')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ===== Interactive product showcase (auto-cycling app window) =====
const SHOW_VIEWS = ['assets', 'tracking', 'kpis'] as const;

function HeroShowcase() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((v) => (v + 1) % SHOW_VIEWS.length), 3400);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="relative mx-auto w-full max-w-lg" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-400/20 to-teal-500/10 blur-2xl" />

      <div className="mb-3 flex justify-center gap-1.5">
        {SHOW_VIEWS.map((v, idx) => (
          <button key={v} onClick={() => setI(idx)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', i === idx ? 'bg-primary text-primary-foreground shadow' : 'border bg-card text-muted-foreground hover:text-foreground')}>
            {t(`landing.showcase.tab_${v}`)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground" dir="ltr">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />app.nx-lam.com
          </span>
        </div>
        <div className="relative h-[320px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={SHOW_VIEWS[i]}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: 'easeOut' }} className="absolute inset-0 p-4">
              {i === 0 && <AssetsMock />}
              {i === 1 && <TrackingMock />}
              {i === 2 && <KpisMock />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="absolute -bottom-4 end-4 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-lg">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
        {t('landing.showcase.live')}
      </motion.div>
    </div>
  );
}

const ASSET_STATUS: Record<string, string> = { active: 'bg-emerald-500/10 text-emerald-600', maint: 'bg-amber-500/10 text-amber-600', idle: 'bg-sky-500/10 text-sky-600' };
const MOCK_ASSETS = [
  { code: 'AM-25-V-7', type: 'truck', status: 'active' },
  { code: 'BD-21-K155', type: 'dozer', status: 'maint' },
  { code: 'CR-19-L80', type: 'crane', status: 'active' },
] as const;

function AssetsMock() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div><div className="text-xs text-muted-foreground">{t('landing.showcase.assets_total')}</div><div className="text-2xl font-extrabold tabular-nums">1,947</div></div>
        <span className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"><Plus className="h-3 w-3" />{t('landing.showcase.add')}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[['vehicles', '682'], ['equipment', '905'], ['attachments', '360']].map(([k, n]) => (
          <div key={k} className="rounded-lg border bg-background/60 p-2"><div className="text-base font-extrabold tabular-nums">{n}</div><div className="text-[10px] text-muted-foreground">{t(`landing.showcase.kind_${k}`)}</div></div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {MOCK_ASSETS.map((a, idx) => (
          <motion.div key={a.code} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + idx * 0.08 }}
            className="flex items-center gap-2.5 rounded-lg border bg-background/60 px-2.5 py-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary"><Truck className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold">{a.code}</div><div className="truncate text-[10px] text-muted-foreground">{t(`landing.showcase.type_${a.type}`)}</div></div>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', ASSET_STATUS[a.status])}>{t(`landing.showcase.status_${a.status}`)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const DOT_COLOR: Record<string, string> = { active: 'bg-sky-400', idle: 'bg-emerald-400', offline: 'bg-slate-400' };
const MAP_DOTS = [
  { x: 26, y: 34, s: 'active' }, { x: 60, y: 26, s: 'idle' }, { x: 44, y: 56, s: 'active' }, { x: 74, y: 64, s: 'offline' }, { x: 34, y: 72, s: 'idle' },
];

function TrackingMock() {
  const { t } = useTranslation();
  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:26px_26px]" />
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M8,82 C30,58 52,70 92,18" fill="none" stroke="rgba(16,185,129,.45)" strokeWidth="0.7" strokeDasharray="2.5 2.5" />
        <path d="M4,28 C40,42 62,28 96,78" fill="none" stroke="rgba(56,189,248,.4)" strokeWidth="0.7" strokeDasharray="2.5 2.5" />
      </svg>
      {MAP_DOTS.map((d, idx) => (
        <motion.span key={idx} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.6, repeat: Infinity, delay: idx * 0.25 }}>
          <span className={cn('block h-2.5 w-2.5 rounded-full ring-2 ring-white/70', DOT_COLOR[d.s])} />
        </motion.span>
      ))}
      <div className="absolute bottom-3 start-3 flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-2 shadow-lg">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-500 text-white"><Truck className="h-4 w-4" /></span>
        <div dir="ltr" className="text-start"><div className="font-mono text-[11px] font-bold text-slate-900">AM-25-V-7</div><div className="text-[10px] text-slate-500">{t('landing.showcase.veh_active')} · {t('landing.showcase.sample_city')}</div></div>
      </div>
      <div className="absolute end-3 top-3 flex flex-col gap-1 rounded-lg bg-black/40 p-2 text-[10px] text-white backdrop-blur">
        {(['active', 'idle', 'offline'] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', DOT_COLOR[s])} />{t(`landing.showcase.veh_${s}`)}</span>)}
      </div>
    </div>
  );
}

function KpisMock() {
  const { t } = useTranslation();
  const bars = [62, 78, 54, 88, 70, 95];
  const tiles: Array<[string, string, string]> = [['readiness', '94%', 'text-emerald-600'], ['utilization', '71%', 'text-sky-600'], ['active', '312', 'text-violet-600'], ['alerts', '8', 'text-amber-600']];
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([k, v, c]) => (
          <div key={k} className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-[10px] text-muted-foreground">{t(`landing.showcase.kpi_${k}`)}</div>
            <div className={cn('text-xl font-extrabold tabular-nums', c)}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex-1 rounded-lg border bg-background/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold"><TrendingUp className="h-3.5 w-3.5 text-primary" />{t('landing.showcase.chart_title')}</div>
        <div className="flex h-[110px] items-end gap-2">
          {bars.map((h, idx) => (
            <motion.div key={idx} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6, delay: idx * 0.08, ease: 'easeOut' }}
              className="flex-1 rounded-t bg-gradient-to-t from-emerald-500 to-teal-400" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start font-semibold">
        {q}
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="px-5 pb-4 text-sm text-muted-foreground">{a}</p>}
    </div>
  );
}
