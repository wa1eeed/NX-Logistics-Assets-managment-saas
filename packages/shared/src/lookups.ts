// ============================================================
// Lookup (reference list) catalog — the dropdown lists the
// Super Admin can configure (add/edit/disable entries) from
// platform settings. New list types are added here in code;
// entries within each type are managed at runtime.
// ============================================================

export interface LookupTypeDef {
  key: string;
  en: string;
  ar: string;
  /** Human hint about where the list is used. */
  usageEn: string;
  usageAr: string;
}

export const LOOKUP_TYPES: LookupTypeDef[] = [
  {
    key: 'REGION',
    en: 'Regions / Cities',
    ar: 'المناطق / المدن',
    usageEn: 'Operating regions where assets are distributed (asset region field).',
    usageAr: 'مناطق التشغيل التي تتوزّع بها الأصول (حقل المنطقة في الأصل).',
  },
  {
    key: 'MANUFACTURER',
    en: 'Manufacturers',
    ar: 'الماركات المصنّعة',
    usageEn: 'Asset manufacturer / brand dropdown.',
    usageAr: 'قائمة الماركة المصنّعة للأصل.',
  },
  {
    key: 'ASSET_CATEGORY',
    en: 'Asset categories',
    ar: 'فئات الأصول',
    usageEn: 'General category grouping for asset types.',
    usageAr: 'الفئة العامة التي تُجمَّع تحتها أنواع الأصول.',
  },
];

export const LOOKUP_TYPE_KEYS = LOOKUP_TYPES.map((l) => l.key);

export interface LookupItem {
  id: string;
  type: string;
  value: string;
  labelEn: string;
  labelAr: string | null;
  sortOrder: number;
  isActive: boolean;
}
