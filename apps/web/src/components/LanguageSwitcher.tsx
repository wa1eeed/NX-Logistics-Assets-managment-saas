import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <div
      className={cn('inline-flex items-center rounded-md border bg-card p-0.5 text-xs font-semibold', className)}
      role="group"
      aria-label="Language"
    >
      {(['en', 'ar'] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => i18n.changeLanguage(lng)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 transition-colors',
            current === lng ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {lng === 'en' ? 'EN' : 'ع'}
        </button>
      ))}
    </div>
  );
}
