import { useState } from "react";
import type { QuestionInputProps } from "./types";

export function NumberInput({ question, value, onChange, errorId, invalid }: QuestionInputProps) {
  // The text the user typed is kept locally: "1." and "-" are not numbers yet, but must not be erased.
  const [raw, setRaw] = useState(() => (value === undefined || value === null ? "" : String(value)));

  function handleChange(text: string) {
    setRaw(text);
    if (text.trim() === "") return onChange(undefined);
    const parsed = Number(text);
    // Unparseable text is passed on as a string so validation can say "Please enter a number".
    onChange(Number.isFinite(parsed) ? parsed : text);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      data-autofocus
      autoComplete="off"
      className="runner-line-input"
      value={raw}
      placeholder="Type your answer here..."
      aria-label={question.title || "Number"}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}
