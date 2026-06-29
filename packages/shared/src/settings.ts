// ============================================================
// Default application settings & alert thresholds catalog.
// Managed by the Super Admin (reference data). The seed inserts
// these defaults; the Settings module reads/updates them.
// ============================================================

export interface SettingDef {
  key: string;
  group: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  defaultValue: unknown;
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: 'alerts.documentExpiryDays',
    group: 'alerts',
    labelEn: 'Document expiry warning (days)',
    labelAr: 'تنبيه قرب انتهاء المستند (أيام)',
    descriptionEn: 'Warn this many days before a document/registration/inspection expires.',
    descriptionAr: 'التنبيه قبل هذا العدد من الأيام من انتهاء مستند/استمارة/فحص.',
    defaultValue: 30,
  },
  {
    key: 'alerts.contractExpiryDays',
    group: 'alerts',
    labelEn: 'Contract expiry warning (days)',
    labelAr: 'تنبيه قرب انتهاء العقد (أيام)',
    descriptionEn: 'Warn this many days before a rental/lease contract ends.',
    descriptionAr: 'التنبيه قبل هذا العدد من الأيام من انتهاء عقد التأجير/الاستئجار.',
    defaultValue: 14,
  },
  {
    key: 'alerts.maintenanceCostRatio',
    group: 'alerts',
    labelEn: 'Maintenance cost / book value ratio',
    labelAr: 'نسبة تكلفة الصيانة إلى القيمة الدفترية',
    descriptionEn: 'Flag an asset for renew/sell when yearly maintenance cost exceeds this ratio of its book value.',
    descriptionAr: 'ترشيح الأصل للتجديد/البيع عند تجاوز تكلفة الصيانة السنوية هذه النسبة من قيمته الدفترية.',
    defaultValue: 0.4,
  },
  {
    key: 'alerts.unmetRequestsThreshold',
    group: 'alerts',
    labelEn: 'Unmet requests threshold',
    labelAr: 'عتبة الطلبات غير الملبّاة',
    descriptionEn: 'Number of unmet equipment requests that triggers an acquisition signal.',
    descriptionAr: 'عدد طلبات المعدات غير الملبّاة الذي يطلق إشارة الاستحواذ.',
    defaultValue: 5,
  },
  {
    key: 'general.defaultLocale',
    group: 'general',
    labelEn: 'Default locale',
    labelAr: 'اللغة الافتراضية',
    descriptionEn: 'Default UI language for new sessions (en / ar).',
    descriptionAr: 'لغة الواجهة الافتراضية للجلسات الجديدة (en / ar).',
    defaultValue: 'en',
  },
];
