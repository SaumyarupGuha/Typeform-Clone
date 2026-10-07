import { MessageSquareText } from "lucide-react";

export function PoweredBy() {
  return (
    <span className="hidden items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs text-white sm:inline-flex">
      Powered by
      <MessageSquareText className="size-4" aria-hidden />
      <strong className="font-semibold">Typeform Clone</strong>
    </span>
  );
}
