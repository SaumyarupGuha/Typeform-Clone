"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ChoiceEditing } from "@/components/runner/inputs/types";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import { themeStyle } from "@/lib/theme";
import type { FormTheme, JsonValue, Question } from "@/lib/types";
import { newTempOptionId, useBuilderStore } from "@/store/builderStore";
import { InlineEditable } from "./InlineEditable";

interface QuestionCanvasProps {
  theme: FormTheme;
  onAddQuestion: () => void;
}

/** The centre of the builder: the selected question, drawn with the same components respondents see. */
export function QuestionCanvas({ theme, onAddQuestion }: QuestionCanvasProps) {
  const questions = useBuilderStore((state) => state.questions);
  const selectedId = useBuilderStore((state) => state.selectedId);
  const index = questions.findIndex((q) => q.id === selectedId);
  const question = questions[index];

  return (
    <section
      aria-label="Question editor"
      style={themeStyle(theme)}
      className="min-h-0 overflow-y-auto rounded-panel bg-[var(--r-bg)] text-[var(--r-fg)] shadow-[0_0_0_1px_var(--color-line)]"
    >
      {question ? (
        // Keyed by id so selecting another question starts with fresh local preview state.
        <CanvasQuestion key={question.id} question={question} number={index + 1} />
      ) : (
        <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-xl">Your form has no questions yet</p>
          <Button onClick={onAddQuestion}>
            <Plus className="size-4" />
            Add your first question
          </Button>
        </div>
      )}
    </section>
  );
}

function CanvasQuestion({ question, number }: { question: Question; number: number }) {
  const editQuestion = useBuilderStore((state) => state.editQuestion);
  const focusRequestId = useBuilderStore((state) => state.focusRequestId);
  const clearFocusRequest = useBuilderStore((state) => state.clearFocusRequest);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // What the creator types or clicks into the preview. It is never saved.
  const [previewValue, setPreviewValue] = useState<JsonValue | undefined>(undefined);
  const { Input, hasOptions } = QUESTION_TYPES[question.type];

  // A just-added question arrives with its title focused, ready to type.
  useEffect(() => {
    if (focusRequestId === question.id) {
      titleRef.current?.focus();
      clearFocusRequest();
    }
  }, [focusRequestId, question.id, clearFocusRequest]);

  const editing: ChoiceEditing | undefined = hasOptions
    ? {
        onLabelChange: (optionId, label) =>
          editQuestion(question.id, { options: question.options.map((o) => (o.id === optionId ? { ...o, label } : o)) }),
        onAdd: () =>
          editQuestion(question.id, {
            options: [...question.options, { id: newTempOptionId(), label: `Choice ${question.options.length + 1}` }],
          }),
        onRemove: (optionId) => editQuestion(question.id, { options: question.options.filter((o) => o.id !== optionId) }),
      }
    : undefined;

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:px-10">
      <div className="flex gap-2">
        <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded bg-[var(--r-fg)] text-xs font-semibold text-[var(--r-bg)]">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <InlineEditable
            ref={titleRef}
            value={question.title}
            onChange={(title) => editQuestion(question.id, { title })}
            placeholder="Your question here"
            ariaLabel="Question title"
            className="text-2xl leading-snug sm:text-3xl"
            maxLength={1000}
          />
          {question.required && <span className="sr-only">Required</span>}
          {question.description !== null && (
            <InlineEditable
              value={question.description}
              onChange={(description) => editQuestion(question.id, { description })}
              placeholder="Description (optional)"
              ariaLabel="Question description"
              className="mt-2 text-lg opacity-70"
              maxLength={2000}
            />
          )}
        </div>
      </div>

      <div className="mt-8 pl-8">
        <Input question={question} value={previewValue} onChange={setPreviewValue} editing={editing} />
      </div>
    </div>
  );
}
