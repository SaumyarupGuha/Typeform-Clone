import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { orderedOptions } from "@/lib/options";
import { EditableChoices } from "./EditableChoices";
import type { QuestionInputProps } from "./types";

/** A type-to-filter combobox. The value is the chosen option's id. */
export function Dropdown({ question, value, onChange, errorId, invalid, editing }: QuestionInputProps) {
  const listId = useId();
  const options = orderedOptions(question);
  const selected = options.find((option) => option.id === value);

  // `query` is what the user is typing; null means "show the chosen label".
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const needle = (query ?? "").trim().toLowerCase();
  const matches = options.filter((option) => option.label.toLowerCase().includes(needle));
  const placeholder =
    typeof question.properties.placeholder === "string" && question.properties.placeholder
      ? question.properties.placeholder
      : "Type or select an option";

  function choose(optionId: number) {
    onChange(optionId);
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((current) => (matches.length === 0 ? 0 : (current + step + matches.length) % matches.length));
    } else if (event.key === "Enter" && open && matches[highlighted]) {
      event.preventDefault(); // pick the highlighted option instead of moving to the next question
      choose(matches[highlighted].id);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery(null);
    }
  }

  return (
    <>
      <div className="relative">
        <div className="flex items-center border-b border-[color-mix(in_srgb,var(--r-fg)_40%,transparent)] focus-within:border-b-2 focus-within:border-[var(--r-accent)]">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={question.title || "Choose an option"}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            data-autofocus
            autoComplete="off"
            className="runner-line-input !border-0 focus:!border-0"
            value={query ?? selected?.label ?? ""}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              setQuery(null);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <ChevronDown className="size-6 shrink-0 opacity-60" aria-hidden />
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-white py-1 text-lg text-ink shadow-popover"
          >
            {matches.length === 0 && <li className="px-4 py-2 text-ink-muted">No matching options</li>}
            {matches.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={option.id === value}
                // mousedown (not click) so the input does not lose focus and close the list first
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option.id);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={cn("cursor-pointer px-4 py-2", index === highlighted && "bg-surface-strong", option.id === value && "font-semibold")}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    {/* In the builder the options are edited right below the (closed) dropdown. */}
    {editing && (
      <div className="mt-6">
        <EditableChoices question={question} editing={editing} />
      </div>
    )}
    </>
  );
}
