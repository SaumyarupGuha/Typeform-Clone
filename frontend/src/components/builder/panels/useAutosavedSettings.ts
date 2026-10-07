import { useEffect, useRef, useState } from "react";
import { useUpdateFormSettings } from "@/lib/queries";
import type { Form, FormSettings } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const SAVE_DELAY_MS = 600;

const sameSettings = (a: FormSettings, b: FormSettings) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Editing state for the form-level settings (theme, welcome screen, thank-you screen).
 * Changes show instantly (`settings`), then are saved once the user pauses. If the page is
 * left before the pause ends, the pending change is sent on the way out.
 */
export function useAutosavedSettings(form: Form) {
  const [draft, setDraft] = useState<FormSettings>(form.settings);
  const debounced = useDebouncedValue(draft, SAVE_DELAY_MS);
  const { mutate, isPending } = useUpdateFormSettings(form.id);
  const saved = form.settings;

  useEffect(() => {
    if (!sameSettings(debounced, saved)) mutate(debounced);
  }, [debounced, saved, mutate]);

  // On unmount, save anything still waiting for the debounce.
  const latest = useRef({ draft, saved });
  useEffect(() => {
    latest.current = { draft, saved };
  });
  useEffect(
    () => () => {
      if (!sameSettings(latest.current.draft, latest.current.saved)) mutate(latest.current.draft);
    },
    [mutate],
  );

  return {
    settings: draft,
    update: (changes: Partial<FormSettings>) => setDraft((current) => ({ ...current, ...changes })),
    status: isPending || !sameSettings(draft, saved) ? ("saving" as const) : ("saved" as const),
  };
}

export type AutosavedSettings = ReturnType<typeof useAutosavedSettings>;
