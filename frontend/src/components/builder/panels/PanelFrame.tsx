import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface PanelFrameProps {
  title: string;
  description?: string;
  /** Shows the autosave state beside the title when given. */
  status?: "saving" | "saved";
  children: React.ReactNode;
}

/** The white sheet that replaces the question canvas when a form-level panel is open. */
export function PanelFrame({ title, description, status, children }: PanelFrameProps) {
  return (
    <section
      aria-label={title}
      className="min-h-0 overflow-y-auto rounded-panel bg-white p-6 shadow-[0_0_0_1px_var(--color-line)] sm:p-10"
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">{title}</h2>
          {status && (
            <span className="flex items-center gap-1.5 text-sm text-ink-muted" aria-live="polite">
              {status === "saving" ? (
                <>
                  <Spinner className="size-3.5" /> Saving…
                </>
              ) : (
                <>
                  <Check className="size-4 text-success" /> Saved
                </>
              )}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-ink-muted">{description}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
