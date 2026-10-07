"use client";

import { ChevronDown } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import { QUESTION_TYPE_NAMES, type JsonValue } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { LogicPanel } from "./logic/LogicPanel";
import { ToggleRow } from "./TypeSettings/fields";
import { TypeChip } from "./TypeChip";

export function SettingsPanel() {
  const question = useBuilderStore((state) => state.questions.find((q) => q.id === state.selectedId));
  const { editQuestion, changeType } = useBuilderStore.getState();

  if (!question) {
    return (
      <aside aria-label="Question settings" className="rounded-panel bg-surface p-5 text-sm text-ink-muted">
        Select a question to change its settings.
      </aside>
    );
  }

  const { Settings, label } = QUESTION_TYPES[question.type];
  const current = question; // a const keeps the non-undefined type inside the closure below

  function changeProperties(changes: Record<string, JsonValue>) {
    editQuestion(current.id, { properties: { ...current.properties, ...changes } });
  }

  return (
    <aside aria-label="Question settings" className="min-h-0 overflow-y-auto rounded-panel bg-surface p-5">
      <Menu
        label="Change question type"
        align="left"
        triggerClassName="flex w-full items-center gap-3 rounded-control border border-line bg-card px-3 py-2 text-left hover:bg-surface-strong"
        trigger={
          <>
            <TypeChip type={question.type} />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronDown className="size-4 text-ink-muted" />
          </>
        }
        items={QUESTION_TYPE_NAMES.map((type) => ({
          label: QUESTION_TYPES[type].label,
          icon: <TypeChip type={type} className="size-6" />,
          onSelect: () => void changeType(question.id, type),
        }))}
      />

      <div className="mt-4 divide-y divide-line">
        <ToggleRow label="Required" checked={question.required} onChange={(required) => editQuestion(question.id, { required })} />
        <ToggleRow
          label="Description"
          checked={question.description !== null}
          onChange={(on) => editQuestion(question.id, { description: on ? "" : null })}
        />
      </div>

      <h3 className="mb-1 mt-5 text-sm font-semibold">{label} settings</h3>
      {/* Keyed by question so each field's typing state resets when another question is selected. */}
      <Settings key={`${question.id}-${question.type}`} question={question} onChange={changeProperties} />

      <LogicPanel question={question} />
    </aside>
  );
}
