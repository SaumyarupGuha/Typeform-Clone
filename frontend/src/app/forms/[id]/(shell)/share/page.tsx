"use client";

import { Copy, ExternalLink, Globe, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";
import { Spinner } from "@/components/ui/Spinner";
import { copyLink } from "@/lib/clipboard";
import { useForm, usePublishForm, useUnpublishForm } from "@/lib/queries";
import { useFormId } from "@/lib/useFormId";
import { useBuilderStore } from "@/store/builderStore";

export default function SharePage() {
  const formId = useFormId();
  const router = useRouter();
  const form = useForm(formId);
  const publish = usePublishForm(formId);
  const unpublish = useUnpublishForm(formId);

  if (!form.data) {
    return (
      <div className="flex justify-center py-20 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  const { public_url: url, status } = form.data;
  const published = status === "published";

  async function handlePublish() {
    await useBuilderStore.getState().flush();
    publish.mutate(undefined);
  }

  return (
    <div className="min-h-[calc(100dvh-92px)] rounded-panel bg-surface px-4 py-12 sm:px-8">
      <h1 className="text-center text-3xl">Choose how you&apos;d like to share your form</h1>

      <div className="mx-auto mt-10 max-w-2xl rounded-panel bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => void copyLink(url)} disabled={!published} className="shrink-0">
            <Copy className="size-4" />
            Copy link
          </Button>
          <input
            readOnly
            value={url}
            aria-label="Public link"
            onFocus={(event) => event.target.select()}
            className={`h-10 w-full min-w-0 rounded-control sm:flex-1 border border-line px-3 text-sm outline-none ${published ? "" : "text-ink-faint line-through"}`}
          />
        </div>

        {published ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="flex items-center gap-2 text-sm text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              Your form is live. Anyone with the link can respond.
            </p>
            <div className="flex gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="size-4" />
                  Open form
                </Button>
              </a>
              <Button variant="secondary" loading={unpublish.isPending} onClick={() => unpublish.mutate(undefined)}>
                Unpublish
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-sm text-ink-muted">This form is a draft. Publish it to activate the link.</p>
            <Button variant="cta" loading={publish.isPending} onClick={() => void handlePublish()}>
              Publish
            </Button>
          </div>
        )}
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <h2 className="mb-3 font-semibold">Embed form</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "On your website", icon: Globe },
            { label: "In your email", icon: Mail },
          ].map(({ label, icon: Icon }) => (
            <div key={label} aria-disabled className="flex items-center gap-3 rounded-panel bg-white p-4 text-ink-muted">
              <Icon className="size-5" />
              <span className="flex-1">{label}</span>
              <ComingSoonBadge />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center">
        <Button variant="ghost" onClick={() => router.push(`/forms/${formId}/create`)}>
          Back to editor
        </Button>
      </div>
    </div>
  );
}
