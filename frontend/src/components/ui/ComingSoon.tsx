import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/** Small inline pill, for labelling a disabled option. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success", className)}>
      Coming soon
    </span>
  );
}

interface ComingSoonProps {
  title: string;
  description: string;
}

/** Full panel placeholder for features that are out of scope (integrations, logic, ...). */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="rounded-full bg-success-soft p-3 text-success">
        <Sparkles className="size-6" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-ink-muted">{description}</p>
      <ComingSoonBadge />
    </div>
  );
}
