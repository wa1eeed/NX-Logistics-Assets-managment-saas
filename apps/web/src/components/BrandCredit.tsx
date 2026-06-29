import { useTranslation } from 'react-i18next';

const NX_URL = 'https://www.nx.sa';

/**
 * Development credit shown across all portals (sidebar footer) and on the login
 * screen. Small, muted, professional — never competes with page content.
 */
export function BrandCredit({ variant = 'sidebar' }: { variant?: 'sidebar' | 'auth' }) {
  const { t } = useTranslation();
  const muted = variant === 'auth' ? 'text-white/55' : 'text-muted-foreground';
  return (
    <div className="text-center leading-tight" dir="ltr">
      <span className={`text-[11px] ${muted}`}>{t('brand.developedBy')} </span>
      <a
        href={NX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[11px] font-semibold transition-colors ${variant === 'auth' ? 'text-white/85 hover:text-white' : 'text-foreground hover:text-primary'}`}
      >
        NX Solutions
      </a>
      <span className={`mx-1 text-[11px] ${muted}`}>|</span>
      <a
        href={NX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-medium text-primary hover:underline"
      >
        www.nx.sa
      </a>
    </div>
  );
}
