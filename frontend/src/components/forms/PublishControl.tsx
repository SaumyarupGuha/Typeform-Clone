"use client";

import { ChevronDown, Copy, ExternalLink, Play, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { copyLink } from "@/lib/clipboard";
import { usePublishForm, useUnpublishForm } from "@/lib/queries";
import type { Form } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

/** Preview and Publish buttons of the top bar. Both save pending edits first. */
export function PublishControl({ form }: { form: Form }) {
  const router = useRouter();
  const publish = usePublishForm(form.id);
  const unpublish = useUnpublishForm(form.id);

  const saveFirst = () => useBuilderStore.getState().flush();

  async function openPreview() {
    await saveFirst();
    router.push(`/forms/${form.id}/preview`);
  }

  async function handlePublish() {
    await saveFirst();
    publish.mutate(undefined, { onSuccess: () => router.push(`/forms/${form.id}/share`) });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => void openPreview()}>
        <Play className="size-4" />
        <span className="hidden sm:inline">Preview</span>
      </Button>

      {form.status === "draft" ? (
        <Button variant="cta" loading={publish.isPending} onClick={() => void handlePublish()}>
          Publish
        </Button>
      ) : (
        <Menu
          label="Published options"
          triggerClassName="inline-flex h-10 items-center gap-2 rounded-control bg-success-soft px-4 text-sm font-medium text-success hover:opacity-80"
          trigger={
            <>
              <span className="size-2 rounded-full bg-success" aria-hidden />
              Live
              <ChevronDown className="size-4" />
            </>
          }
          items={[
            { label: "Copy link", icon: <Copy className="size-4" />, onSelect: () => void copyLink(form.public_url) },
            {
              label: "Open form",
              icon: <ExternalLink className="size-4" />,
              onSelect: () => window.open(form.public_url, "_blank", "noopener"),
            },
            { label: "Unpublish", icon: <Undo2 className="size-4" />, onSelect: () => unpublish.mutate(undefined), danger: true },
          ]}
        />
      )}
    </div>
  );
}
