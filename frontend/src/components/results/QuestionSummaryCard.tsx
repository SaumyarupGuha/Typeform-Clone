import { TypeChip } from "@/components/builder/TypeChip";
import { pluralize } from "@/lib/format";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import type { QuestionSummary } from "@/lib/types";

interface QuestionSummaryCardProps {
  summary: QuestionSummary;
  number: number;
}

export function QuestionSummaryCard({ summary, number }: QuestionSummaryCardProps) {
  const { Summary } = QUESTION_TYPES[summary.type];

  return (
    <article className="rounded-panel bg-white p-6">
      <header className="mb-5 flex items-start gap-3">
        <TypeChip type={summary.type} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-medium">
            <span className="mr-2 text-ink-muted">{number}.</span>
            {summary.title || "Untitled question"}
          </h3>
          <p className="text-sm text-ink-muted">{pluralize(summary.answered, "response")}</p>
        </div>
      </header>
      <Summary summary={summary} />
    </article>
  );
}
