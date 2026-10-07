interface BarRowProps {
  label: string;
  count: number;
  percent: number;
}

/** One horizontal percentage bar: label, filled track, and "count (percent%)". */
export function BarRow({ label, count, percent }: BarRowProps) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
        <span className="min-w-0 break-words">{label || "(empty choice)"}</span>
        <span className="shrink-0 text-ink-muted">
          {count} <span className="text-ink-faint">({percent}%)</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 overflow-hidden rounded-full bg-surface-strong"
      >
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}
