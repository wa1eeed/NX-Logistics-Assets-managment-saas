// ============================================================
// Asset State Machine — single source of truth (docs/01 §4).
// Used by the API (AssetStatusService) to validate transitions
// and by the web to render the allowed next-state controls.
// ============================================================

import { AssetStatus } from './enums';

export const ASSET_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  COMMISSIONING: ['AVAILABLE', 'OUT_OF_SERVICE'], // بعد تأكيد الجاهزية → متاح
  AVAILABLE: ['RESERVED', 'IN_DUTY', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'FOR_SALE', 'DISPOSED'],
  RESERVED: ['IN_DUTY', 'AVAILABLE'],
  IN_DUTY: ['AVAILABLE', 'UNDER_MAINTENANCE', 'FOR_SALE'],
  UNDER_MAINTENANCE: ['AVAILABLE', 'OUT_OF_SERVICE'],
  OUT_OF_SERVICE: ['AVAILABLE'],
  FOR_SALE: ['AVAILABLE', 'DISPOSED'],
  DISPOSED: [],
};

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return ASSET_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
