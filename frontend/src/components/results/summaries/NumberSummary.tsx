import { numberStats } from "@/lib/stats";
import type { QuestionSummaryProps } from "./types";

export function NumberSummary({ summary }: QuestionSummaryProps) {
  const { min, average, max } = numberStats(summary);
  return (
    <dl className="grid grid-cols-3 gap-3">
      {[
        { label: "Minimum", value: min },
        { label: "Average", value: average },
        { label: "Maximum", value: max },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-control bg-surface px-4 py-3">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="text-2xl font-semibold">{value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
