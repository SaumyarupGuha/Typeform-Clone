import type { QuestionInputProps } from "./types";

export function ShortText({ question, value, onChange, errorId, invalid }: QuestionInputProps) {
  const maxLength = typeof question.properties.max_length === "number" ? question.properties.max_length : 255;
  const placeholder =
    typeof question.properties.placeholder === "string" && question.properties.placeholder
      ? question.properties.placeholder
      : "Type your answer here...";

  return (
    <input
      type="text"
      data-autofocus
      autoComplete="off"
      className="runner-line-input"
      value={typeof value === "string" ? value : ""}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={question.title || "Answer"}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
