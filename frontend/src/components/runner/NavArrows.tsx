import { ChevronDown, ChevronUp } from "lucide-react";

interface NavArrowsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const BUTTON =
  "flex size-8 items-center justify-center bg-[var(--r-accent)] text-[var(--r-on-accent)] transition-opacity hover:opacity-80 disabled:opacity-40 sm:size-9";

/** The up/down pair at the bottom right; same actions as the ArrowUp/ArrowDown keys. */
export function NavArrows({ canGoBack, canGoForward, onPrevious, onNext }: NavArrowsProps) {
  return (
    <div className="flex overflow-hidden rounded-md">
      <button type="button" data-runner-action aria-label="Previous question" disabled={!canGoBack} onClick={onPrevious} className={BUTTON}>
        <ChevronUp className="size-5" />
      </button>
      <button type="button" data-runner-action aria-label="Next question" disabled={!canGoForward} onClick={onNext} className={`${BUTTON} border-l border-white/20`}>
        <ChevronDown className="size-5" />
      </button>
    </div>
  );
}
