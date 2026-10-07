"use client";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useSummary } from "@/lib/queries";
import { QuestionSummaryCard } from "./QuestionSummaryCard";
import { StatsHeader } from "./StatsHeader";

export function SummaryTab({ formId }: { formId: number }) {
  const summary = useSummary(formId);

  if (summary.isPending) {
    return (
      <div className="flex justify-center py-20 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (summary.isError) {
    return (
      <div className="rounded-panel bg-white p-8 text-center">
        <p className="mb-4 text-ink-muted">{summary.error.message}</p>
        <Button variant="secondary" onClick={() => void summary.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsHeader summary={summary.data} />
      {summary.data.questions.map((questionSummary, index) => (
        <QuestionSummaryCard key={questionSummary.question_id} summary={questionSummary} number={index + 1} />
      ))}
    </div>
  );
}
