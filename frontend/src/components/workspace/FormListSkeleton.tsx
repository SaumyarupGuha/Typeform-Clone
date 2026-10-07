import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder rows with the same height as FormCard while the list loads. */
export function FormListSkeleton() {
  return (
    <ul className="space-y-2" role="status" aria-label="Loading forms">
      {[0, 1, 2, 3].map((row) => (
        <li key={row} className="flex items-center gap-4 rounded-control bg-card p-3 shadow-[0_0_0_1px_var(--color-line)]">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-6 w-16 sm:block" />
        </li>
      ))}
    </ul>
  );
}
