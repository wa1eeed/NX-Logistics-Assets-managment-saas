// ============================================================
// Handover / condition-capture catalog (docs/01 §7).
// Receipt + return inspections share this checklist; the system
// diffs return vs receipt to attribute damage to the contract.
// ============================================================

export interface ChecklistItemDef {
  key: string;
  en: string;
  ar: string;
}

export const HANDOVER_CHECKLIST: ChecklistItemDef[] = [
  { key: 'tires', en: 'Tires', ar: 'الإطارات' },
  { key: 'body', en: 'Body / chassis', ar: 'الهيكل' },
  { key: 'engine', en: 'Engine', ar: 'المحرّك' },
  { key: 'lights', en: 'Lights', ar: 'الأنوار' },
  { key: 'hydraulics', en: 'Hydraulics', ar: 'الهيدروليك' },
  { key: 'cabin', en: 'Cabin', ar: 'المقصورة' },
  { key: 'accessories', en: 'Accessories', ar: 'الملحقات' },
  { key: 'cleanliness', en: 'Cleanliness', ar: 'النظافة' },
];

export const CONDITION_RATINGS = ['GOOD', 'FAIR', 'POOR', 'DAMAGED', 'NA'] as const;
export type ConditionRating = (typeof CONDITION_RATINGS)[number];

/** Numeric weight for detecting deterioration (higher = worse). NA ignored. */
export const CONDITION_RANK: Record<ConditionRating, number> = {
  GOOD: 0, FAIR: 1, POOR: 2, DAMAGED: 3, NA: -1,
};

export interface ChecklistEntry {
  key: string;
  condition: ConditionRating;
  note?: string | null;
}

export interface HandoverInspectionItem {
  id: string;
  kind: 'RECEIPT' | 'RETURN';
  checklist: ChecklistEntry[];
  odometer: number | null;
  photos: string[];
  notes: string | null;
  signedBy: string | null;
  signedByRole: string | null;
  ip: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface ConditionDiffEntry {
  key: string;
  receipt: ConditionRating | null;
  return: ConditionRating | null;
  deteriorated: boolean;
}

export interface HandoverView {
  contractId: string;
  receipt: HandoverInspectionItem | null;
  return: HandoverInspectionItem | null;
  diff: ConditionDiffEntry[];
  odometerDelta: number | null;
}
