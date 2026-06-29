// ============================================================
// Asset commissioning / readiness confirmation (ops plan §5.1:
// "تجهيز الأصل للتشغيل واستيفاء متطلبات الأمن والسلامة وربط أجهزة التتبع").
// A newly registered asset starts COMMISSIONING and only becomes
// AVAILABLE after these safety + device check points are confirmed.
// ============================================================

export interface ReadinessItemDef {
  key: string;
  en: string;
  ar: string;
  group: 'safety' | 'devices' | 'compliance';
  /** Required items must be checked before the asset can go AVAILABLE. */
  required: boolean;
}

export const READINESS_CHECKLIST: ReadinessItemDef[] = [
  // Safety check points
  { key: 'brakes', en: 'Brakes tested', ar: 'فحص الفرامل', group: 'safety', required: true },
  { key: 'tires', en: 'Tires condition', ar: 'حالة الإطارات', group: 'safety', required: true },
  { key: 'lights', en: 'Lights & indicators', ar: 'الأنوار والإشارات', group: 'safety', required: true },
  { key: 'fireExtinguisher', en: 'Fire extinguisher', ar: 'طفاية حريق', group: 'safety', required: true },
  { key: 'firstAid', en: 'First-aid kit', ar: 'حقيبة إسعافات أولية', group: 'safety', required: false },
  { key: 'warningTriangle', en: 'Warning triangle', ar: 'مثلث تحذيري', group: 'safety', required: false },
  // Device installation
  { key: 'gpsTracker', en: 'GPS tracker installed', ar: 'تركيب جهاز التتبع', group: 'devices', required: true },
  { key: 'operatingCard', en: 'Operating card issued', ar: 'إصدار كرت التشغيل', group: 'devices', required: true },
  { key: 'fuelCard', en: 'Fuel card linked', ar: 'ربط بطاقة الوقود', group: 'devices', required: false },
  // Compliance / government linkage
  { key: 'govLinkage', en: 'Government platform linkage', ar: 'الربط مع المنصات الحكومية', group: 'compliance', required: true },
  { key: 'insuranceValid', en: 'Insurance valid', ar: 'سريان التأمين', group: 'compliance', required: false },
];

export const READINESS_REQUIRED_KEYS = READINESS_CHECKLIST.filter((c) => c.required).map((c) => c.key);

export interface ReadinessEntry {
  key: string;
  ok: boolean;
  note?: string | null;
}

export interface CommissioningInfo {
  commissioned: boolean;
  commissionedAt: string | null;
  commissionedBy: string | null;
  checklist: ReadinessEntry[];
}
