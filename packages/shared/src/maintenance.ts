// ============================================================
// Preventive maintenance + meter + compliance types.
// ============================================================

export type MeterType = 'NONE' | 'HOURS' | 'KM';
export const METER_TYPES: MeterType[] = ['NONE', 'HOURS', 'KM'];

export type PlanIntervalType = 'KM' | 'HOURS' | 'DAYS';
export const PLAN_INTERVAL_TYPES: PlanIntervalType[] = ['KM', 'HOURS', 'DAYS'];

/** OK = far off; DUE_SOON = within the warning window; OVERDUE = past due. */
export type DueStatus = 'OK' | 'DUE_SOON' | 'OVERDUE';

export interface MeterReadingItem {
  id: string;
  value: number;
  note: string | null;
  recordedBy: string | null;
  recordedAt: string;
}

export interface MaintenancePlanItem {
  id: string;
  assetId: string;
  name: string;
  intervalType: PlanIntervalType;
  intervalValue: number;
  lastServiceMeter: number | null;
  lastServiceAt: string | null;
  isActive: boolean;
  /** Computed: how much is left before due (km/hours, or days). Negative = overdue by. */
  remaining: number;
  status: DueStatus;
  /** For DAYS plans, the computed next due date. */
  dueDate: string | null;
}

export interface AssetPreventive {
  meterType: MeterType;
  currentMeter: number;
  meterUpdatedAt: string | null;
  plans: MaintenancePlanItem[];
  readings: MeterReadingItem[];
}

/** One asset's row in the compliance dashboard. */
export interface ComplianceItem {
  assetId: string;
  assetCode: string;
  assetTypeName: string;
  kind: 'PREVENTIVE_DUE' | 'REGISTRATION_EXPIRY' | 'INSPECTION_EXPIRY' | 'INSURANCE_EXPIRY';
  label: string;
  status: DueStatus;
  /** Days remaining (for date obligations) or remaining km/hours (for preventive). */
  remaining: number | null;
  unit: 'DAYS' | 'KM' | 'HOURS';
  date: string | null;
}

export interface ComplianceView {
  generatedAt: string;
  counts: { total: number; overdue: number; dueSoon: number };
  items: ComplianceItem[];
}
