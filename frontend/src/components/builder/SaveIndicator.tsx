"use client";

import { Check, CloudOff } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useBuilderStore } from "@/store/builderStore";

export function SaveIndicator() {
  const saveState = useBuilderStore((state) => state.saveState);

  return (
    <span aria-live="polite" className="flex items-center gap-1.5 text-sm text-ink-muted">
      {saveState === "saving" && (
        <>
          <Spinner className="size-3.5" /> Saving…
        </>
      )}
      {saveState === "saved" && (
        <>
          <Check className="size-4 text-success" /> Saved
        </>
      )}
      {saveState === "error" && (
        <>
          <CloudOff className="size-4 text-danger" /> Not saved
        </>
      )}
    </span>
  );
}
