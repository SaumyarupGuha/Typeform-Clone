"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function FormError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">This form could not be loaded</h1>
      <p className="text-ink-muted">Check your connection and try again.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/workspace">
          <Button variant="secondary">Back to workspace</Button>
        </Link>
      </div>
    </main>
  );
}
