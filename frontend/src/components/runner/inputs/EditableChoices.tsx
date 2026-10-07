import { X } from "lucide-react";
import { choiceLetter, orderedOptions } from "@/lib/options";
import type { Question } from "@/lib/types";
import type { ChoiceEditing } from "./types";

interface EditableChoicesProps {
  question: Question;
  editing: ChoiceEditing;
}

/**
 * The choice boxes of the runner, but with editable labels. Used by the builder canvas so
 * creators edit options exactly where respondents will see them.
 */
export function EditableChoices({ question, editing }: EditableChoicesProps) {
  const options = orderedOptions(question, false); // never shuffle while editing
  const canRemove = options.length > 1;

  return (
    <div className="flex flex-col gap-2">
      {options.map((option, index) => (
        <div key={option.id} className="runner-choice group cursor-text">
          <span className="runner-choice-key">{choiceLetter(index)}</span>
          <input
            value={option.label}
            onChange={(event) => editing.onLabelChange(option.id, event.target.value)}
            aria-label={`Choice ${index + 1}`}
            placeholder={`Choice ${index + 1}`}
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
          />
          {canRemove && (
            <button
              type="button"
              onClick={() => editing.onRemove(option.id)}
              aria-label={`Remove choice ${index + 1}`}
              className="rounded p-1 opacity-0 hover:bg-black/10 focus:opacity-100 group-hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={editing.onAdd} className="w-fit text-base underline underline-offset-4 opacity-80 hover:opacity-100">
        Add choice
      </button>
    </div>
  );
}
