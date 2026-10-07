import Link from "next/link";
import type { ThankYouScreen as ThankYouSettings } from "@/lib/types";

export function ThankYouScreen({ settings }: { settings: ThankYouSettings }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl leading-snug sm:text-5xl">{settings.title}</h1>
      {settings.description && <p className="mt-4 text-xl opacity-70">{settings.description}</p>}
      <Link
        href="/workspace"
        className="mt-10 inline-block rounded-md bg-[var(--r-accent)] px-6 py-3 text-lg font-semibold text-[var(--r-on-accent)] hover:opacity-85"
      >
        Create your own form
      </Link>
    </div>
  );
}
