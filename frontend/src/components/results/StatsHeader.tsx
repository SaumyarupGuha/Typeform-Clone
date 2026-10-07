import { formatDuration } from "@/lib/format";
import type { Summary } from "@/lib/types";

/** The four headline numbers at the top of the Summary tab. */
export function StatsHeader({ summary }: { summary: Summary }) {
  const stats = [
    { label: "Views", value: String(summary.started), hint: "People who started" },
    { label: "Submissions", value: String(summary.completed), hint: "Completed responses" },
    { label: "Completion rate", value: `${summary.completion_rate}%`, hint: "Submissions / views" },
    { label: "Average time", value: formatDuration(summary.avg_seconds), hint: "To complete" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, hint }) => (
        <div key={label} className="rounded-panel bg-white p-5">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="mt-1 text-3xl font-semibold">{value}</dd>
          <p className="mt-1 text-xs text-ink-faint">{hint}</p>
        </div>
      ))}
    </dl>
  );
}
