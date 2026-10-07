"use client";

import { Button } from "@/components/ui/Button";

/** Last-resort screen for an unexpected crash while rendering a page. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-ink-muted">An unexpected error occurred. Try again, or reload the page.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
