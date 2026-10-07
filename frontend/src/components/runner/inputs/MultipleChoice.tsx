import { cn } from "@/lib/cn";
import { choiceLetter, orderedOptions } from "@/lib/options";
import { ChoiceKey } from "./ChoiceKey";
import { EditableChoices } from "./EditableChoices";
import type { QuestionInputProps } from "./types";

/** The ids the respondent has picked; always an array for this type. */
export function selectedIds(value: QuestionInputProps["value"]): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

export function MultipleChoice({ question, value, onChange, editing }: QuestionInputProps) {
  const allowMultiple = question.properties.allow_multiple === true;
  const selected = selectedIds(value);

  function toggle(optionId: number) {
    if (!allowMultiple) return onChange([optionId]);
    const next = selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
    onChange(next.length > 0 ? next : undefined);
  }

  if (editing) return <EditableChoices question={question} editing={editing} />;

  return (
    <div
      role={allowMultiple ? "group" : "radiogroup"}
      aria-label={question.title || "Choices"}
      className={cn("flex gap-2", question.properties.vertical === false ? "flex-row flex-wrap" : "flex-col")}
    >
      {orderedOptions(question).map((option, index) => (
        <ChoiceKey
          key={option.id}
          letter={choiceLetter(index)}
          label={option.label}
          role={allowMultiple ? "checkbox" : "radio"}
          selected={selected.includes(option.id)}
          onSelect={() => toggle(option.id)}
        />
      ))}
    </div>
  );
}
