import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface TabDef {
  key: string;
  label: ReactNode;
  count?: number;
}

/** Underline-style tab bar matching the app's inline tab pattern (Assets, etc.). */
export function TabBar({ tabs, active, onChange, className }: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap gap-1 border-b', className)}>
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          className={cn(
            'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
            active === tb.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tb.label}
          {tb.count != null && <span className="text-xs text-muted-foreground">{tb.count}</span>}
          {active === tb.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </div>
  );
}
