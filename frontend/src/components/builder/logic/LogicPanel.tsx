"use client";

import { GitBranch, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { describeRule, hasLogic } from "@/lib/logic";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { LogicEditorModal } from "./LogicEditorModal";

/** The "Logic +" row at the bottom of the settings panel, with a short summary of the rules. */
export function LogicPanel({ question }: { question: Question }) {
  const [open, setOpen] = useState(false);
  const questions = useBuilderStore((state) => state.questions);
  const isLast = questions[questions.length - 1]?.id === question.id;
  const summary = question.logic.rules.map((rule) => describeRule(rule, questions));

  return (
    <section aria-label="Logic" className="mt-6 rounded-control bg-card p-3 shadow-[0_0_0_1px_var(--color-line)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="size-4 text-ink-muted" aria-hidden />
          Logic
        </h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={isLast}
          aria-label={hasLogic(question) ? "Edit logic" : "Add logic"}
          title={isLast ? "The last question has nowhere to jump to" : undefined}
          className="flex size-8 items-center justify-center rounded-control border border-line hover:bg-surface-strong disabled:opacity-40"
        >
          {hasLogic(question) ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        </button>
      </div>

      {summary.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
          {summary.map((line, index) => (
            <li key={index} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">
          {isLast ? "Add a question below to branch from this one." : "Send respondents to different questions based on their answers."}
        </p>
      )}

      <LogicEditorModal open={open} onClose={() => setOpen(false)} question={question} />
    </section>
  );
}
