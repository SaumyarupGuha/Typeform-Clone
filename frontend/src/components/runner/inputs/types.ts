import type { JsonValue, Question } from "@/lib/types";

/** Handlers the builder passes so choice labels can be edited where they are drawn. */
export interface ChoiceEditing {
  onLabelChange: (optionId: number, label: string) => void;
  onAdd: () => void;
  onRemove: (optionId: number) => void;
}

/**
 * Props shared by every question input. The respondent flow and the builder canvas
 * render the very same components, so the builder preview is the real thing.
 */
export interface QuestionInputProps {
  question: Question;
  /** `undefined` means "not answered yet". */
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
  /** Id of the error message element, for aria-describedby. */
  errorId?: string;
  invalid?: boolean;
  /** Builder only: when set, choice questions render editable labels instead of answer buttons. */
  editing?: ChoiceEditing;
}
