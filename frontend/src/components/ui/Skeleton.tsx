import { cn } from "@/lib/cn";

/** A pulsing grey placeholder shown while content loads, so the layout does not jump. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-surface-strong", className)} />;
}
