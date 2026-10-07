import { yesNoStats } from "@/lib/stats";
import { BarRow } from "./BarRow";
import type { QuestionSummaryProps } from "./types";

export function YesNoSummary({ summary }: QuestionSummaryProps) {
  const { yes, no } = yesNoStats(summary);
  const total = yes + no;
  const percent = (count: number) => (total ? Math.round((count * 1000) / total) / 10 : 0);
  return (
    <ul className="space-y-4">
      <BarRow label="Yes" count={yes} percent={percent(yes)} />
      <BarRow label="No" count={no} percent={percent(no)} />
    </ul>
  );
}
