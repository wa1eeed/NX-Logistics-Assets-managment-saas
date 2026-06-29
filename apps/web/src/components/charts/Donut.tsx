interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Lightweight SVG donut chart with a centered headline. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 160,
}: {
  segments: Segment[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 15.9155; // circumference = 100
  let offset = 25; // start at top (12 o'clock)

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 36 36" width={size} height={size} className="shrink-0 -rotate-0">
        <circle cx="18" cy="18" r={R} fill="none" className="stroke-muted" strokeWidth="3.6" />
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          const dash = `${pct} ${100 - pct}`;
          const el = (
            <circle
              key={i}
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="3.6"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform="rotate(-90 18 18)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          );
          offset -= pct;
          return el;
        })}
        <text x="18" y="17.5" textAnchor="middle" className="fill-foreground" style={{ fontSize: 6, fontWeight: 800 }}>
          {centerValue}
        </text>
        {centerLabel && (
          <text x="18" y="22.5" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 2.6 }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-semibold tabular-nums">{seg.value}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({Math.round((seg.value / total) * 1000) / 10}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
