import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';

type Section = { h: string; b: string };

/** Public legal/info pages: Terms of Service, Privacy Policy, Contact. */
export function LegalPage({ doc }: { doc: 'terms' | 'privacy' | 'contact' }) {
  const { t } = useTranslation();
  const sections = (t(`legal.${doc}.sections`, { returnObjects: true }) as Section[]) || [];
  const email = t('legal.contact.email');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-glow">NX</span>
            <span className="text-sm font-bold">{t('app.name')}</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/">{t('legal.back')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{t(`legal.${doc}.title`)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('legal.updated')}: {t('legal.updatedDate')}</p>

        {doc === 'contact' && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">{t('legal.contact.emailLabel')}</div>
              <a href={`mailto:${email}`} dir="ltr" className="text-base font-bold text-primary hover:underline">{email}</a>
            </div>
            <Button asChild><a href={`mailto:${email}`}>{t('legal.contact.cta')}</a></Button>
          </div>
        )}

        <article className="mt-8 space-y-7">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{s.b}</p>
            </section>
          ))}
        </article>

        <div className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">{t('legal.terms.title')}</Link>
          <Link to="/privacy" className="hover:text-foreground">{t('legal.privacy.title')}</Link>
          <Link to="/contact" className="hover:text-foreground">{t('legal.contact.title')}</Link>
          <span className="ms-auto">© {t('landing.footer.rights')}</span>
        </div>
      </main>
    </div>
  );
}
