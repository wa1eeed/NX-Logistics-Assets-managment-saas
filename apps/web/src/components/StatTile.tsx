import type { ComponentType } from 'react';
import { Card, CardContent } from './ui/card';
import { AnimatedNumber } from './effects/AnimatedNumber';

/** Compact KPI tile — icon + animated value + label. Used by department dashboards. */
export function StatTile({
  label,
  value,
  suffix,
  icon: Icon,
  tint = 'text-slate-500 bg-slate-500/10',
  valueClass,
}: {
  label: string;
  /** Numbers animate; pre-formatted strings (e.g. currency) render as-is. */
  value: number | string;
  suffix?: string;
  icon?: ComponentType<{ className?: string }>;
  tint?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className={`text-xl font-bold tabular-nums ${valueClass ?? ''}`}>
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
            {suffix}
          </div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
