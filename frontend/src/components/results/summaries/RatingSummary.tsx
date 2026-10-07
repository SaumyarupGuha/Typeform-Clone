import { Star } from "lucide-react";
import { ratingStats } from "@/lib/stats";
import { BarRow } from "./BarRow";
import type { QuestionSummaryProps } from "./types";

export function RatingSummary({ summary }: QuestionSummaryProps) {
  const { steps, average, distribution } = ratingStats(summary);
  const total = distribution.reduce((sum, step) => sum + step.count, 0);

  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 text-3xl font-semibold">
        <Star className="size-7 fill-type-number text-type-number-ink" aria-hidden />
        {average ?? "-"}
        <span className="text-base font-normal text-ink-muted">average out of {steps}</span>
      </p>
      <ul className="space-y-3">
        {/* Highest rating first, as it reads best next to an average. */}
        {[...distribution].reverse().map((step) => (
          <BarRow
            key={step.value}
            label={`${step.value} star${step.value === 1 ? "" : "s"}`}
            count={step.count}
            percent={total ? Math.round((step.count * 1000) / total) / 10 : 0}
          />
        ))}
      </ul>
    </div>
  );
}
