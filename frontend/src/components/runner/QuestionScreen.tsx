"use client";

import { useAnimationControls, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useId } from "react";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import type { UploadHandler } from "./inputs/types";
import type { JsonValue, Question } from "@/lib/types";
import { ErrorMessage } from "./ErrorMessage";
import { OkButton } from "./OkButton";

interface QuestionScreenProps {
  question: Question;
  /** 1-based number shown before the title. */
  number: number;
  value: JsonValue | undefined;
  error: string | undefined;
  /** Changes on every failed attempt, so the input shakes again even for an identical message. */
  errorTick: number;
  isLast: boolean;
  submitting: boolean;
  onChange: (value: JsonValue | undefined) => void;
  onNext: () => void;
  /** Used by file questions to upload what the respondent chose. */
  upload?: UploadHandler;
}

export function QuestionScreen({
  question,
  number,
  value,
  error,
  errorTick,
  isLast,
  submitting,
  onChange,
  onNext,
  upload,
}: QuestionScreenProps) {
  const errorId = useId();
  const shake = useAnimationControls();
  const { Input } = QUESTION_TYPES[question.type];

  // Shake the input each time validation fails (the screen does not move).
  useEffect(() => {
    if (error && errorTick > 0) void shake.start({ x: [0, -10, 10, -8, 8, 0], transition: { duration: 0.4 } });
  }, [error, errorTick, shake]);

  return (
    <div>
      <h2 className="flex gap-2 text-2xl leading-snug sm:text-3xl">
        <span className="mt-1.5 flex shrink-0 items-center gap-1 text-lg text-[var(--r-accent)] sm:mt-2">
          {number}
          <ArrowRight className="size-4" aria-hidden />
        </span>
        <span className="break-words">
          {question.title || "Your question here"}
          {question.required && (
            <span className="ml-1 text-danger" aria-label="required">
              *
            </span>
          )}
        </span>
      </h2>
      {question.description && <p className="mt-2 text-lg opacity-70 sm:pl-8">{question.description}</p>}

      <motion.div animate={shake} className="mt-8 sm:pl-8">
        <Input question={question} value={value} onChange={onChange} invalid={Boolean(error)} errorId={errorId} upload={upload} />
        {error && <ErrorMessage id={errorId} message={error} />}
        <OkButton label={isLast ? "Submit" : "OK"} showCheck={!isLast} loading={submitting} onClick={onNext} />
      </motion.div>
    </div>
  );
}
