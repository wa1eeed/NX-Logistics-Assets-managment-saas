import type { AssetStatus } from '@nx-lam/shared';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline';

export const statusVariant: Record<AssetStatus, BadgeVariant> = {
  COMMISSIONING: 'warning',
  AVAILABLE: 'success',
  RESERVED: 'warning',
  IN_DUTY: 'default',
  UNDER_MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'secondary',
  FOR_SALE: 'default',
  DISPOSED: 'destructive',
};

export function fmtMoney(value: number | null | undefined, locale: string): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
}
