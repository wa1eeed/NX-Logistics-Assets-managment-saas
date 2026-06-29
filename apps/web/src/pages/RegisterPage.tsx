import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Loader2, Rocket } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { BrandCredit } from '../components/BrandCredit';
import { Aurora } from '../components/effects/Aurora';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { extractApiError } from '../lib/api';

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', slug: '', adminName: '', adminEmail: '', adminPassword: '',
    email: '', contactPhone: '', city: '', crNumber: '', vatNumber: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const valid = form.companyName.length >= 2 && form.slug.length >= 2 && form.adminName.length >= 2 && form.adminEmail.includes('@') && form.adminPassword.length >= 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Send only the filled optional company fields (empty strings would fail CR/VAT validation).
      const opt = (v: string) => (v.trim() ? v.trim() : undefined);
      await register({
        companyName: form.companyName, slug: form.slug, adminName: form.adminName,
        adminEmail: form.adminEmail, adminPassword: form.adminPassword,
        email: opt(form.email), contactPhone: opt(form.contactPhone), city: opt(form.city),
        crNumber: opt(form.crNumber), vatNumber: opt(form.vatNumber),
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
      <Aurora />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-card/95 p-8 shadow-card backdrop-blur-xl"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-extrabold text-white shadow-glow">
            NX
          </div>
          <h1 className="text-xl font-bold">{t('register.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('register.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </motion.div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="companyName">{t('register.companyName')}</Label>
            <Input id="companyName" value={form.companyName}
              onChange={(e) => set({ companyName: e.target.value, ...(slugEdited ? {} : { slug: slugify(e.target.value) }) })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">{t('register.workspace')}</Label>
            <Input id="slug" dir="ltr" value={form.slug} placeholder="acme"
              onChange={(e) => { setSlugEdited(true); set({ slug: slugify(e.target.value) }); }} required />
            <p className="text-xs text-muted-foreground">{t('register.workspaceHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminName">{t('register.adminName')}</Label>
            <Input id="adminName" value={form.adminName} onChange={(e) => set({ adminName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">{t('register.adminEmail')}</Label>
            <Input id="adminEmail" type="email" dir="ltr" autoComplete="username" value={form.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminPassword">{t('register.adminPassword')}</Label>
            <Input id="adminPassword" type="password" dir="ltr" autoComplete="new-password" value={form.adminPassword} onChange={(e) => set({ adminPassword: e.target.value })} required />
            <p className="text-xs text-muted-foreground">{t('register.passwordHint')}</p>
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('company.optional')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input dir="ltr" type="email" placeholder={t('company.email')} value={form.email} onChange={(e) => set({ email: e.target.value })} />
              <Input dir="ltr" placeholder={t('company.phone')} value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
              <Input placeholder={t('company.city')} value={form.city} onChange={(e) => set({ city: e.target.value })} />
              <Input dir="ltr" placeholder={`${t('company.cr')} (${t('company.crHint')})`} value={form.crNumber} onChange={(e) => set({ crNumber: e.target.value })} />
              <Input dir="ltr" placeholder={`${t('company.vat')} (${t('company.vatHint')})`} value={form.vatNumber} onChange={(e) => set({ vatNumber: e.target.value })} />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={busy || !valid}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {busy ? t('common.loading') : t('register.submit')}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">{t('register.signIn')}</Link>
        </p>

        <div className="mt-4 flex justify-center">
          <LanguageSwitcher />
        </div>
      </motion.div>

      <div className="relative mt-6">
        <BrandCredit variant="auth" />
      </div>
    </div>
  );
}
