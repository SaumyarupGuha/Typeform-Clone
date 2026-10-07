"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";
import { cn } from "@/lib/cn";
import { useBuilderStore } from "@/store/builderStore";
import { PANEL_LINKS, type BuilderView } from "./builderViews";
import { SortableQuestionItem } from "./SortableQuestionItem";

/** Keeps a dragged row on the list's vertical axis. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface QuestionSidebarProps {
  onAdd: () => void;
  view: BuilderView;
  onViewChange: (view: BuilderView) => void;
}

export function QuestionSidebar({ onAdd, view, onViewChange }: QuestionSidebarProps) {
  const questions = useBuilderStore((state) => state.questions);
  const selectedId = useBuilderStore((state) => state.selectedId);
  const { select, reorder, duplicateQuestion, deleteQuestion } = useBuilderStore.getState();

  // A few pixels of movement before a drag starts, so plain clicks are never mistaken for drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = questions.findIndex((q) => q.id === active.id);
    const to = questions.findIndex((q) => q.id === over.id);
    void reorder(from, to);
  }

  return (
    <aside aria-label="Questions" className="flex min-h-0 flex-col rounded-panel bg-surface p-3">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <h2 className="font-semibold">Questions</h2>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add question"
          className="flex size-8 items-center justify-center rounded-control border border-line bg-card hover:bg-surface-strong"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Capped on small screens so the editor below stays reachable; fills the column on large ones. */}
      <div className="max-h-72 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
        {questions.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-muted">No questions yet. Use + to add one.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {questions.map((question, index) => (
                  <SortableQuestionItem
                    key={question.id}
                    question={question}
                    number={index + 1}
                    selected={view === "question" && question.id === selectedId}
                    onSelect={() => {
                      select(question.id);
                      onViewChange("question");
                    }}
                    onDuplicate={() => void duplicateQuestion(question.id)}
                    onDelete={() => void deleteQuestion(question.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <nav aria-label="Form settings" className="mt-2 border-t border-line pt-2">
        <ul className="space-y-0.5">
          {PANEL_LINKS.map(({ view: target, label, icon: Icon, comingSoon }) => (
            <li key={target}>
              <button
                type="button"
                onClick={() => onViewChange(target)}
                aria-current={view === target}
                className={cn(
                  "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm",
                  view === target ? "bg-card shadow-[0_0_0_2px_var(--color-ink)]" : "hover:bg-card/70",
                )}
              >
                <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <span className="flex-1">{label}</span>
                {comingSoon && <ComingSoonBadge />}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
