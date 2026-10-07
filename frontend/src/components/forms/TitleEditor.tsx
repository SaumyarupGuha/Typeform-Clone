"use client";

import { useState } from "react";
import { useRenameFormTitle } from "@/lib/queries";

/** The form title in the top bar: click to edit, Enter or click away to save, Escape to cancel. */
export function TitleEditor({ formId, title }: { formId: number; title: string }) {
  // null = not editing (show the saved title); a string = the text being typed.
  const [draft, setDraft] = useState<string | null>(null);
  const rename = useRenameFormTitle(formId);

  function commit() {
    const next = (draft ?? title).trim();
    setDraft(null);
    if (next && next !== title) rename.mutate(next);
  }

  return (
    <input
      value={draft ?? title}
      aria-label="Form title"
      maxLength={200}
      onFocus={(event) => {
        setDraft(title);
        event.target.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className="h-9 w-40 truncate rounded-control bg-transparent px-2 font-medium outline-none hover:bg-surface-strong focus:bg-white focus:shadow-[0_0_0_2px_var(--color-ink)] sm:w-64"
    />
  );
}
