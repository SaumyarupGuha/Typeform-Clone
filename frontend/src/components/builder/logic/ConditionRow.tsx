"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { defaultConditionValue, logicKindOf, newCondition, OPERATORS, OPERATOR_LABELS, VALUELESS_OPERATORS } from "@/lib/logic";
import type { JsonValue, LogicCondition, LogicOperator, Question } from "@/lib/types";
import { FIELD_CLASS } from "../TypeSettings/fields";

interface ConditionRowProps {
  condition: LogicCondition;
  /** Questions a condition may look at: this one and the ones above it. */
  sources: Question[];
  onChange: (condition: LogicCondition) => void;
  onRemove?: () => void;
}

const SELECT_CLASS = `${FIELD_CLASS} min-w-0 flex-1 basis-40`;

/** One "[question] [operator] [value]" line of a rule. */
export function ConditionRow({ condition, sources, onChange, onRemove }: ConditionRowProps) {
  const source = sources.find((q) => q.id === condition.question_id);
  const kind = source ? logicKindOf(source) : null;

  function changeQuestion(id: number) {
    const next = sources.find((q) => q.id === id);
    if (next) onChange(newCondition(next)); // a different question needs its own operators and value
  }

  function changeOperator(operator: LogicOperator) {
    if (!source) return;
    // Keep the value when it still makes sense; operators without a value clear it.
    const value = VALUELESS_OPERATORS.includes(operator) ? null : (condition.value ?? defaultConditionValue(source, operator));
    onChange({ ...condition, operator, value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Question"
        value={source ? condition.question_id : ""}
        onChange={(event) => changeQuestion(Number(event.target.value))}
        className={SELECT_CLASS}
      >
        {!source && <option value="">Question unavailable</option>}
        {sources.map((q, index) => (
          <option key={q.id} value={q.id}>
            {index + 1}. {q.title || "Your question here"}
          </option>
        ))}
      </select>

      {source && kind && (
        <>
          <select
            aria-label="Condition"
            value={condition.operator}
            onChange={(event) => changeOperator(event.target.value as LogicOperator)}
            className={SELECT_CLASS}
          >
            {OPERATORS[kind].map((operator) => (
              <option key={operator} value={operator}>
                {OPERATOR_LABELS[operator]}
              </option>
            ))}
          </select>
          {!VALUELESS_OPERATORS.includes(condition.operator) && (
            <ValueInput question={source} value={condition.value} onChange={(value) => onChange({ ...condition, value })} />
          )}
        </>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="rounded-control p-2 text-ink-muted hover:bg-surface-strong"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function ValueInput({ question, value, onChange }: { question: Question; value: JsonValue; onChange: (value: JsonValue) => void }) {
  const kind = logicKindOf(question);

  if (kind === "choice") {
    return (
      <select aria-label="Answer" value={typeof value === "number" ? value : ""} onChange={(event) => onChange(Number(event.target.value))} className={SELECT_CLASS}>
        {question.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label || "Choice"}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "boolean") {
    return (
      <select aria-label="Answer" value={value === false ? "no" : "yes"} onChange={(event) => onChange(event.target.value === "yes")} className={SELECT_CLASS}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (kind === "number") return <NumberValue value={value} onChange={onChange} />;
  return (
    <input
      aria-label="Answer"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Text"
      className={SELECT_CLASS}
    />
  );
}

/** Keeps what was typed ("-", "1.") until it is a real number, then passes the number on. */
function NumberValue({ value, onChange }: { value: JsonValue; onChange: (value: JsonValue) => void }) {
  const [text, setText] = useState(typeof value === "number" ? String(value) : "");
  return (
    <input
      aria-label="Answer"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = Number(event.target.value);
        if (event.target.value.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
      }}
      placeholder="Number"
      className={SELECT_CLASS}
    />
  );
}
