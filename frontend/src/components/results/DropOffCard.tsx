import type { Summary } from "@/lib/types";

/**
 * "Where respondents drop off": for each question, how many of the people who started
 * answered it, and how many stopped right after it. Built from partial and completed responses.
 */
export function DropOffCard({ summary }: { summary: Summary }) {
  const { started, funnel, left_before_first: leftBeforeFirst, partial } = summary;
  if (started === 0 || funnel.length === 0) return null;

  return (
    <article className="rounded-panel bg-card p-6" aria-label="Drop-off">
      <h3 className="font-medium">Where respondents drop off</h3>
      <p className="mb-5 text-sm text-ink-muted">
        Share of the {started} {started === 1 ? "person" : "people"} who started that answered each question.
        {partial > 0 && ` ${partial} left without submitting.`}
      </p>

      <ol className="space-y-4">
        {funnel.map((step, index) => {
          const percent = Math.round((step.answered * 1000) / started) / 10;
          return (
            <li key={step.question_id}>
              <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                <span className="min-w-0 break-words">
                  <span className="mr-2 text-ink-muted">{index + 1}.</span>
                  {step.title || "Untitled question"}
                </span>
                <span className="shrink-0 text-ink-muted">
                  {step.answered} <span className="text-ink-faint">({percent}%)</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-strong" role="meter" aria-label={`Answered by ${percent}%`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${percent}%` }} />
              </div>
              {step.left_here > 0 && (
                <p className="mt-1 text-xs text-danger">
                  {step.left_here} left after this question
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {leftBeforeFirst > 0 && (
        <p className="mt-5 text-sm text-ink-muted">
          {leftBeforeFirst} {leftBeforeFirst === 1 ? "person opened" : "people opened"} the form and left before answering anything.
        </p>
      )}
    </article>
  );
}
