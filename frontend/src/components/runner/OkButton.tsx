import { Check, CornerDownLeft } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface OkButtonProps {
  label: string;
  loading?: boolean;
  onClick: () => void;
  /** Hide the "press Enter" hint (the welcome screen shows it differently). */
  showHint?: boolean;
  showCheck?: boolean;
}

/** The primary action under each question, with the keyboard hint beside it. */
export function OkButton({ label, loading = false, onClick, showHint = true, showCheck = true }: OkButtonProps) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        type="button"
        data-runner-action
        disabled={loading}
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-md bg-[var(--r-accent)] px-5 py-2.5 text-lg font-semibold text-[var(--r-on-accent)] transition-opacity hover:opacity-85 disabled:opacity-60"
      >
        {label}
        {loading ? <Spinner className="size-4" /> : showCheck && <Check className="size-5" strokeWidth={3} />}
      </button>
      {showHint && (
        <span className="hidden items-center gap-1 text-sm opacity-70 sm:inline-flex">
          press <strong>Enter</strong> <CornerDownLeft className="size-3.5" />
        </span>
      )}
    </div>
  );
}
