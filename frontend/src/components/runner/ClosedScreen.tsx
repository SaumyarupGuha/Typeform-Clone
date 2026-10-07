interface ClosedScreenProps {
  title?: string;
  description?: string;
}

/** Shown for unpublished or missing forms (and for forms that close while someone is filling them). */
export function ClosedScreen({
  title = "This form is closed",
  description = "It is no longer accepting responses.",
}: ClosedScreenProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#fafafa] px-6 text-center text-ink">
      <div>
        <h1 className="text-3xl leading-snug sm:text-4xl">{title}</h1>
        <p className="mt-3 text-lg text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
