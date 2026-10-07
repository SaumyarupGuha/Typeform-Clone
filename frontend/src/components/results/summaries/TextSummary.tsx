import { latestAnswers } from "@/lib/stats";
import type { QuestionSummaryProps } from "./types";

/** Short text, long text and email: the most recent answers. */
export function TextSummary({ summary }: QuestionSummaryProps) {
  const latest = latestAnswers(summary);
  if (latest.length === 0) return <p className="text-sm text-ink-muted">No answers yet.</p>;
  return (
    <div>
      <p className="mb-2 text-sm text-ink-muted">Latest answers</p>
      <ul className="space-y-2">
        {latest.map((answer, index) => (
          <li key={index} className="whitespace-pre-wrap break-words rounded-control bg-surface px-4 py-2.5">
            {answer}
          </li>
        ))}
      </ul>
    </div>
  );
}
