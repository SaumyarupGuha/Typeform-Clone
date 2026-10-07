import { formatBytes } from "@/lib/format";
import { latestAnswers } from "@/lib/stats";
import type { QuestionSummaryProps } from "./types";

export function FileSummary({ summary }: QuestionSummaryProps) {
  const latest = latestAnswers(summary);
  const totalBytes = typeof summary.stats.total_bytes === "number" ? summary.stats.total_bytes : 0;
  if (summary.answered === 0) return <p className="text-sm text-ink-muted">No files uploaded yet.</p>;

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">
        {summary.answered} {summary.answered === 1 ? "file" : "files"} uploaded · {formatBytes(totalBytes)} in total. Download
        them from the Responses tab.
      </p>
      <p className="mb-2 text-sm text-ink-muted">Latest uploads</p>
      <ul className="space-y-2">
        {latest.map((name, index) => (
          <li key={index} className="truncate rounded-control bg-surface px-4 py-2.5">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
