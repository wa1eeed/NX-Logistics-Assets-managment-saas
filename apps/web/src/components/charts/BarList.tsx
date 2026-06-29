import { motion } from 'framer-motion';

export interface BarItem {
  label: string;
  count: number;
  pct: number;
}

/** Horizontal bar list (label · bar · count + pct) — RTL-aware via logical props. */
export function BarList({ items, color = 'hsl(var(--primary))' }: { items: BarItem[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.pct));
  return (
    <div className="space-y-2.5">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-sm text-muted-foreground">{it.label}</div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
            <motion.div
              className="absolute inset-y-0 start-0 rounded"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(it.pct / max) * 100}%` }}
              transition={{ duration: 0.6, delay: idx * 0.03, ease: 'easeOut' }}
            />
          </div>
          <div className="w-20 shrink-0 text-end text-sm">
            <span className="font-semibold tabular-nums">{it.count}</span>
            <span className="ms-1 text-xs text-muted-foreground tabular-nums">{it.pct}%</span>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">—</p>}
    </div>
  );
}
