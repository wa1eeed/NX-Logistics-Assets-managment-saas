import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TenantMe } from '@nx-lam/shared';
import { api } from './api';

/** Convert a hex colour to the "H S% L%" triplet our CSS vars use (e.g. --primary). */
export function hexToHslTriplet(hex: string): string | null {
  const m = hex.trim().replace(/^#/, '');
  const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, sat = 0;
  const d = max - min;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Fetches the signed-in user's tenant and applies its brand colour to the
 * document (overriding the --primary CSS var). Returns the tenant for logo/name.
 * Disabled for the platform operator (who has no tenant).
 */
export function useTenantBranding(enabled: boolean): TenantMe | null {
  const q = useQuery({
    queryKey: ['tenant-me'],
    queryFn: async () => (await api.get<TenantMe>('/tenant/me')).data,
    enabled,
    staleTime: 60_000,
  });

  const color = q.data?.branding.primaryColor ?? null;
  useEffect(() => {
    const root = document.documentElement;
    if (color) {
      const hsl = hexToHslTriplet(color);
      if (hsl) root.style.setProperty('--primary', hsl);
    } else {
      root.style.removeProperty('--primary');
    }
    return () => { root.style.removeProperty('--primary'); };
  }, [color]);

  return q.data ?? null;
}
