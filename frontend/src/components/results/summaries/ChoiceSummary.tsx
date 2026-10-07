import { choiceStats } from "@/lib/stats";
import { BarRow } from "./BarRow";
import type { QuestionSummaryProps } from "./types";

/** Multiple choice and dropdown: one bar per option. */
export function ChoiceSummary({ summary }: QuestionSummaryProps) {
  const options = choiceStats(summary);
  return (
    <ul className="space-y-4">
      {options.map((option) => (
        <BarRow key={option.optionId} label={option.label} count={option.count} percent={option.percent} />
      ))}
    </ul>
  );
}
