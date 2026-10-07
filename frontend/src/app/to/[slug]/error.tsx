"use client";

import { Button } from "@/components/ui/Button";

export default function RespondentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#fafafa] px-6 text-center">
      <h1 className="text-3xl">We could not load this form</h1>
      <p className="text-ink-muted">Check your connection and try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
