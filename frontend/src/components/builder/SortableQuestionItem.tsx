"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CopyPlus, GitBranch, GripVertical, MoreVertical, Trash2 } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { hasLogic } from "@/lib/logic";
import type { Question } from "@/lib/types";
import { TypeChip } from "./TypeChip";

interface SortableQuestionItemProps {
  question: Question;
  number: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableQuestionItem({ question, number, selected, onSelect, onDuplicate, onDelete }: SortableQuestionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex items-center gap-1 rounded-control p-1.5",
        selected ? "bg-white shadow-[0_0_0_2px_var(--color-ink)]" : "hover:bg-white/70",
        isDragging && "z-10 opacity-70 shadow-popover",
      )}
    >
      {/* Only the handle starts a drag, so clicking the row and its menu stay normal clicks. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder question ${number}`}
        className="cursor-grab touch-none rounded p-1 text-ink-faint hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
        <TypeChip type={question.type} />
        <span className="w-4 shrink-0 text-xs font-medium text-ink-muted">{number}</span>
        <span className={cn("truncate text-sm", !question.title && "italic text-ink-faint")}>
          {question.title || "Your question here"}
        </span>
        {hasLogic(question) && <GitBranch className="size-3.5 shrink-0 text-ink-muted" aria-label="Has logic" />}
      </button>
      <Menu
        label={`Actions for question ${number}`}
        trigger={<MoreVertical className="size-4" />}
        items={[
          { label: "Duplicate", icon: <CopyPlus className="size-4" />, onSelect: onDuplicate },
          { label: "Delete", icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true },
        ]}
      />
    </li>
  );
}
