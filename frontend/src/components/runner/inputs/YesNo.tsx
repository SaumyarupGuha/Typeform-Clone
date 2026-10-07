import { ChoiceKey } from "./ChoiceKey";
import type { QuestionInputProps } from "./types";

export function YesNo({ question, value, onChange }: QuestionInputProps) {
  return (
    <div role="radiogroup" aria-label={question.title || "Yes or no"} className="flex flex-col gap-2">
      <ChoiceKey letter="Y" label="Yes" role="radio" selected={value === true} onSelect={() => onChange(true)} />
      <ChoiceKey letter="N" label="No" role="radio" selected={value === false} onSelect={() => onChange(false)} />
    </div>
  );
}
