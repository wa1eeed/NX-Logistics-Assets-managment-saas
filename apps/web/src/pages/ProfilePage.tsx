import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { User, KeyRound, Save, CheckCircle2 } from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState(user?.fullName ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveName = useMutation({
    mutationFn: () => api.patch('/auth/profile', { fullName: name }),
    onSuccess: () => { setMsg({ ok: true, text: t('profile.nameSaved') }); setTimeout(() => window.location.reload(), 700); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });
  const changePw = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => { setMsg({ ok: true, text: t('profile.pwChanged') }); setPw({ current: '', next: '', confirm: '' }); },
    onError: (e) => setMsg({ ok: false, text: extractApiError(e) }),
  });

  const pwMismatch = pw.next.length > 0 && pw.next !== pw.confirm;

  return (
    <div className="max-w-2xl">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {msg && (
        <div className={cn('mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm', msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : null}{msg.text}
        </div>
      )}

      <Card className="mb-5">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" />{t('profile.account')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{t('profile.email')}</Label><Input dir="ltr" value={user?.email ?? ''} disabled /></div>
            <div className="space-y-1.5"><Label>{t('profile.fullName')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('profile.roles')}:</span>
            {user?.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
          </div>
          <Button onClick={() => { setMsg(null); saveName.mutate(); }} disabled={saveName.isPending || !name.trim() || name === user?.fullName}>
            <Save className="h-4 w-4" />{saveName.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />{t('profile.changePassword')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>{t('profile.currentPassword')}</Label><Input dir="ltr" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('profile.newPassword')}</Label><Input dir="ltr" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('profile.confirmPassword')}</Label><Input dir="ltr" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          {pwMismatch && <p className="text-xs text-destructive">{t('profile.mismatch')}</p>}
          <Button onClick={() => { setMsg(null); changePw.mutate(); }} disabled={changePw.isPending || !pw.current || pw.next.length < 8 || pwMismatch}>
            <KeyRound className="h-4 w-4" />{changePw.isPending ? t('common.saving') : t('profile.changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
