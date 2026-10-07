import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface ChoiceKeyProps {
  letter: string;
  label: string;
  selected: boolean;
  /** "radio" for pick-one, "checkbox" for pick-many; drives screen-reader semantics. */
  role: "radio" | "checkbox";
  onSelect: () => void;
}

/** One answer box: a letter badge (the keyboard shortcut) plus the label. */
export function ChoiceKey({ letter, label, selected, role, onSelect }: ChoiceKeyProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn("runner-choice", selected && "animate-blink")}
    >
      <span className="runner-choice-key">{selected ? <Check className="size-4" strokeWidth={3} /> : letter}</span>
      <span className="min-w-0 break-words">{label || <span className="opacity-40">Choice</span>}</span>
    </button>
  );
}
