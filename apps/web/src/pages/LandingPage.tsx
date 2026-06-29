import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Truck, ClipboardList, Wrench, Satellite, Gauge, Wallet, ShieldCheck, Check, ChevronDown,
  ArrowRight, Sparkles, Building2, MapPin, Boxes,
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
  { icon: Wallet, key: 'billing' },
] as const;

const STATS = [
  { icon: Boxes, key: 'assets' },
  { icon: MapPin, key: 'regions' },
  { icon: Building2, key: 'tenants' },
  { icon: ShieldCheck, key: 'uptime' },
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
            <div className="absolute -top-32 start-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-400/25 via-teal-400/15 to-transparent blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:32px_32px] opacity-40" />
          </div>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />{t('landing.hero.badge')}
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
                {t('landing.hero.title')}
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{t('landing.hero.subtitle')}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="gap-2"><Link to="/register">{t('landing.hero.ctaPrimary')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
                <Button asChild size="lg" variant="outline"><a href="#features">{t('landing.hero.ctaSecondary')}</a></Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t('landing.hero.note')}</p>
            </Reveal>

            {/* floating preview cards */}
            <Reveal delay={0.2}>
              <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
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
