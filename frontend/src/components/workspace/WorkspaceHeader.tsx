import { CircleHelp, LayoutList } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Top bar of the workspace: breadcrumb on the left, help and the (single, default) creator on the right. */
export function WorkspaceHeader() {
  return (
    <header className="flex h-[72px] items-center justify-between px-5">
      <div className="flex items-center gap-2 text-ink">
        <LayoutList className="size-5" aria-hidden />
        <span className="font-medium">Forms</span>
      </div>
      <div className="flex items-center gap-4 text-ink-muted">
        <ThemeToggle />
        <CircleHelp className="size-5" aria-label="Help" />
        <span
          title="Default Creator"
          className="flex size-10 items-center justify-center rounded-full bg-type-number text-sm font-semibold text-type-number-ink"
        >
          DC
        </span>
      </div>
    </header>
  );
}
