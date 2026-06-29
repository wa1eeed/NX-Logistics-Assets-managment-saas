import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ar } from './ar';

export type AppLocale = 'en' | 'ar';

const STORAGE_KEY = 'nx-lam.locale';

export function getInitialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'ar' ? 'ar' : 'en';
}

export function applyDirection(locale: AppLocale): void {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', locale);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: getInitialLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  const locale: AppLocale = lng === 'ar' ? 'ar' : 'en';
  localStorage.setItem(STORAGE_KEY, locale);
  applyDirection(locale);
});

applyDirection(getInitialLocale());

export default i18n;
