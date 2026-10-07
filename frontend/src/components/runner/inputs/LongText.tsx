import { CornerDownLeft, ArrowBigUp } from "lucide-react";
import type { QuestionInputProps } from "./types";

export function LongText({ question, value, onChange, errorId, invalid }: QuestionInputProps) {
  const maxLength = typeof question.properties.max_length === "number" ? question.properties.max_length : 5000;
  const placeholder =
    typeof question.properties.placeholder === "string" && question.properties.placeholder
      ? question.properties.placeholder
      : "Type your answer here...";

  return (
    <div>
      <textarea
        data-autofocus
        rows={2}
        className="runner-line-input resize-none"
        value={typeof value === "string" ? value : ""}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={question.title || "Answer"}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        // Grow with the content instead of showing a scrollbar.
        onInput={(event) => {
          event.currentTarget.style.height = "auto";
          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="mt-2 hidden items-center gap-1 text-xs sm:flex">
        <strong className="inline-flex items-center">
          Shift <ArrowBigUp className="size-3.5" />
        </strong>
        +
        <strong className="inline-flex items-center">
          Enter <CornerDownLeft className="size-3" />
        </strong>
        to make a line break
      </p>
    </div>
  );
}
