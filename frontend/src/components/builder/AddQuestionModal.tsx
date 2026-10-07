"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";
import { Modal } from "@/components/ui/Modal";
import { COMING_SOON_TYPES, QUESTION_TYPES } from "@/lib/questionTypes";
import type { QuestionType } from "@/lib/types";
import { TypeChip } from "./TypeChip";

const GROUPS: { title: string; types: QuestionType[] }[] = [
  { title: "Text", types: ["short_text", "long_text"] },
  { title: "Choice", types: ["multiple_choice", "dropdown", "yes_no"] },
  { title: "Contact info", types: ["email"] },
  { title: "Rating", types: ["rating"] },
  { title: "Other", types: ["number", "file_upload"] },
];

interface AddQuestionModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: QuestionType) => void;
}

export function AddQuestionModal({ open, onClose, onPick }: AddQuestionModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Add form elements" className="max-w-2xl">
      <TypePicker onPick={onPick} />
    </Modal>
  );
}

// Own component so the search box starts empty each time the modal opens.
function TypePicker({ onPick }: { onPick: (type: QuestionType) => void }) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const matches = (label: string) => label.toLowerCase().includes(needle);

  const groups = GROUPS.map((group) => ({
    ...group,
    types: group.types.filter((type) => matches(QUESTION_TYPES[type].label)),
  })).filter((group) => group.types.length > 0);
  const comingSoon = COMING_SOON_TYPES.filter((type) => matches(type.label));

  return (
    <div>
      <label className="relative mb-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search form elements"
          aria-label="Search form elements"
          className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-sm outline-none focus:border-ink"
        />
      </label>

      {groups.length === 0 && comingSoon.length === 0 && <p className="py-6 text-center text-ink-muted">No elements match.</p>}

      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-semibold">{group.title}</h3>
            <ul className="space-y-1">
              {group.types.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onPick(type)}
                    className="flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left hover:bg-surface-strong"
                  >
                    <TypeChip type={type} />
                    {QUESTION_TYPES[type].label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {comingSoon.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">More</h3>
            <ul className="space-y-1">
              {comingSoon.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-3 px-2 py-1.5 text-ink-faint">
                  <span className="flex size-7 items-center justify-center rounded-md bg-surface-strong">
                    <Icon className="size-4" />
                  </span>
                  {label}
                  <ComingSoonBadge />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
