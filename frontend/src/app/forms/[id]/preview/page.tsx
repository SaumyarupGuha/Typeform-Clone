"use client";

import { useQuery } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormRunner } from "@/components/runner/FormRunner";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useFormId } from "@/lib/useFormId";

/** Full-screen run-through of the draft. Nothing is sent to the server or saved. */
export default function PreviewPage() {
  const formId = useFormId();
  // Its own cache key and no caching: a preview must show what was just edited.
  const form = useQuery({
    queryKey: ["form-preview", formId],
    queryFn: () => api.getForm(formId),
    gcTime: 0,
    staleTime: 0,
  });
  const [runCount, setRunCount] = useState(0);

  if (form.isPending) {
    return (
      <div className="flex h-dvh items-center justify-center text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (form.isError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <p className="text-xl">{form.error.message}</p>
        <Link href="/workspace">
          <Button variant="secondary">Back to workspace</Button>
        </Link>
      </div>
    );
  }

  const { title, slug, settings, questions } = form.data;

  return (
    <div className="relative">
      <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-panel bg-surface px-2 py-1.5 text-sm shadow-popover">
        <Link href={`/forms/${formId}/create`} aria-label="Close preview" className="rounded-control p-2 hover:bg-surface-strong">
          <X className="size-5" />
        </Link>
        <span className="hidden px-2 text-ink-muted sm:inline">Preview: answers are not saved</span>
        <button
          type="button"
          onClick={() => setRunCount((count) => count + 1)}
          aria-label="Restart preview"
          className="rounded-control p-2 hover:bg-surface-strong"
        >
          <RotateCcw className="size-5" />
        </button>
      </div>
      {/* Changing the key restarts the runner from the first question. */}
      <FormRunner key={runCount} form={{ title, slug, settings, questions }} preview />
    </div>
  );
}
