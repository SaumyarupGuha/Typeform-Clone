"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { newCondition, ruleProblems, targetProblem } from "@/lib/logic";
import type { JumpTarget, LogicCondition, LogicConfig, LogicRule, Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { FIELD_CLASS } from "../TypeSettings/fields";
import { ConditionRow } from "./ConditionRow";

interface LogicEditorModalProps {
  open: boolean;
  onClose: () => void;
  question: Question;
}

/**
 * The rule editor ("If ... then jump to ..."). Edits go straight into the builder store,
 * which autosaves them like every other change.
 */
export function LogicEditorModal({ open, onClose, question }: LogicEditorModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Logic" className="max-w-3xl">
      <LogicEditor question={question} onDone={onClose} />
    </Modal>
  );
}

function LogicEditor({ question, onDone }: { question: Question; onDone: () => void }) {
  const questions = useBuilderStore((state) => state.questions);
  const editQuestion = useBuilderStore((state) => state.editQuestion);

  const hereIndex = questions.findIndex((q) => q.id === question.id);
  const sources = questions.slice(0, hereIndex + 1); // conditions may use this question and earlier ones
  const later = questions.slice(hereIndex + 1); // jumps may only go forward
  const { rules, otherwise } = question.logic;

  const save = (next: LogicConfig) => editQuestion(question.id, { logic: next });
  const updateRule = (index: number, rule: LogicRule) => save({ rules: rules.map((r, i) => (i === index ? rule : r)), otherwise });

  function addRule() {
    const firstLater = later[0];
    save({
      rules: [...rules, { match: "all", conditions: [newCondition(question)], jump_to: firstLater ? firstLater.id : "end" }],
      otherwise,
    });
  }

  return (
    <div>
      <p className="mb-5 text-sm text-ink-muted">
        Decide where respondents go after this question. Rules are checked from the top and the first one that matches wins.
      </p>

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <RuleCard
            key={index}
            number={index + 1}
            rule={rule}
            sources={sources}
            later={later}
            problems={ruleProblems(rule, questions, hereIndex)}
            onChange={(next) => updateRule(index, next)}
            onRemove={() => save({ rules: rules.filter((_, i) => i !== index), otherwise })}
          />
        ))}
      </div>

      <Button variant="secondary" className="mt-4" onClick={addRule}>
        <Plus className="size-4" />
        Add a rule
      </Button>

      <div className="mt-6 rounded-control bg-surface p-4">
        <p className="mb-2 text-sm font-medium">All other cases</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Go to</span>
          <TargetSelect
            value={otherwise}
            later={later}
            allowDefault
            onChange={(target) => save({ rules, otherwise: target })}
          />
        </div>
        {targetProblem(otherwise, questions, hereIndex) && (
          <p className="mt-2 text-xs text-danger">{targetProblem(otherwise, questions, hereIndex)}</p>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

interface RuleCardProps {
  number: number;
  rule: LogicRule;
  sources: Question[];
  later: Question[];
  problems: string[];
  onChange: (rule: LogicRule) => void;
  onRemove: () => void;
}

function RuleCard({ number, rule, sources, later, problems, onChange, onRemove }: RuleCardProps) {
  const setCondition = (index: number, condition: LogicCondition) =>
    onChange({ ...rule, conditions: rule.conditions.map((c, i) => (i === index ? condition : c)) });

  return (
    <section aria-label={`Rule ${number}`} className="rounded-control border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>Rule {number}: if</span>
          {rule.conditions.length > 1 ? (
            <select
              aria-label="Match"
              value={rule.match}
              onChange={(event) => onChange({ ...rule, match: event.target.value as "all" | "any" })}
              className={`${FIELD_CLASS} h-8 w-auto`}
            >
              <option value="all">all of these</option>
              <option value="any">any of these</option>
            </select>
          ) : (
            <span className="font-normal text-ink-muted">this is true</span>
          )}
        </div>
        <button type="button" onClick={onRemove} aria-label={`Delete rule ${number}`} className="rounded-control p-2 text-ink-muted hover:bg-surface-strong">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        {rule.conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            sources={sources}
            onChange={(next) => setCondition(index, next)}
            onRemove={rule.conditions.length > 1 ? () => onChange({ ...rule, conditions: rule.conditions.filter((_, i) => i !== index) }) : undefined}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...rule, conditions: [...rule.conditions, newCondition(sources[sources.length - 1])] })}
        className="mt-3 text-sm underline underline-offset-4 hover:opacity-70"
      >
        Add condition
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <ArrowRight className="size-4 text-ink-muted" aria-hidden />
        <span className="text-sm font-medium">Jump to</span>
        <TargetSelect value={rule.jump_to} later={later} onChange={(target) => onChange({ ...rule, jump_to: target ?? "end" })} />
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-danger">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface TargetSelectProps {
  value: JumpTarget | null;
  later: Question[];
  onChange: (target: JumpTarget | null) => void;
  /** Offer "Next question" (no jump) as the first choice; used for "all other cases". */
  allowDefault?: boolean;
}

/** Where a jump lands: any later question, or the end of the form. */
function TargetSelect({ value, later, onChange, allowDefault = false }: TargetSelectProps) {
  const offset = (id: number) => later.findIndex((q) => q.id === id);
  return (
    <select
      aria-label="Jump target"
      value={value === null ? "default" : String(value)}
      onChange={(event) => {
        const next = event.target.value;
        onChange(next === "default" ? null : next === "end" ? "end" : Number(next));
      }}
      className={`${FIELD_CLASS} min-w-0 flex-1 basis-56`}
    >
      {allowDefault && <option value="default">Next question (default)</option>}
      {later.map((q) => (
        <option key={q.id} value={q.id}>
          {q.position + 1}. {q.title || "Your question here"}
        </option>
      ))}
      <option value="end">Thank-you screen (end of form)</option>
      {/* A target that is no longer valid (for example after a reorder) stays visible so it can be fixed. */}
      {typeof value === "number" && offset(value) === -1 && <option value={value}>Question no longer below this one</option>}
    </select>
  );
}
