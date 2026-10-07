import type { QuestionInputProps } from "./types";

export function Email({ question, value, onChange, errorId, invalid }: QuestionInputProps) {
  const placeholder =
    typeof question.properties.placeholder === "string" && question.properties.placeholder
      ? question.properties.placeholder
      : "name@example.com";

  return (
    <input
      type="email"
      data-autofocus
      autoComplete="email"
      className="runner-line-input"
      value={typeof value === "string" ? value : ""}
      placeholder={placeholder}
      aria-label={question.title || "Email"}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
