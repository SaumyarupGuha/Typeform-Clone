import { Link2 } from "lucide-react";
import Link from "next/link";
import { copyLink } from "@/lib/clipboard";
import { pluralize, timeAgo } from "@/lib/format";
import type { FormSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { FormRowMenu } from "./FormRowMenu";

interface FormCardProps {
  form: FormSummary;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function FormCard({ form, onRename, onDuplicate, onDelete }: FormCardProps) {
  const published = form.status === "published";

  return (
    <li className="flex items-center gap-4 rounded-control bg-card p-3 pr-2 shadow-[0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-popover">
      <Link href={`/forms/${form.id}/create`} className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-surface-strong text-lg font-semibold text-ink-muted">
          {form.title.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{form.title}</span>
          <span className="block text-sm text-ink-muted">Updated {timeAgo(form.updated_at)}</span>
        </span>
      </Link>

      <span
        className={cn(
          "hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline",
          published ? "bg-success-soft text-success" : "bg-surface-strong text-ink-muted",
        )}
      >
        {published ? "Live" : "Draft"}
      </span>
      <span className="hidden w-28 text-right text-sm text-ink-muted md:block">
        {pluralize(form.response_count, "response")}
      </span>
      {published ? (
        // On phones the row menu already offers "Copy link"; the button would squeeze the title.
        <span className="hidden sm:block">
          <Button variant="secondary" size="sm" onClick={() => void copyLink(form.public_url)}>
            <Link2 className="size-4" />
            Copy link
          </Button>
        </span>
      ) : (
        <span className="hidden w-[104px] sm:block" aria-hidden />
      )}
      <FormRowMenu form={form} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
    </li>
  );
}
