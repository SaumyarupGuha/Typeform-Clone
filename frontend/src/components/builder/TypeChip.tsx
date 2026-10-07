import { QUESTION_TYPES } from "@/lib/questionTypes";
import { cn } from "@/lib/cn";
import type { QuestionType } from "@/lib/types";

/** The small coloured square with a type's icon, used in the sidebar, modal and settings. */
export function TypeChip({ type, className }: { type: QuestionType; className?: string }) {
  const { icon: Icon, chipClass } = QUESTION_TYPES[type];
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", chipClass, className)}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
