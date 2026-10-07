"use client";

import { LayoutList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SaveIndicator } from "@/components/builder/SaveIndicator";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useForm } from "@/lib/queries";
import { PublishControl } from "./PublishControl";
import { TitleEditor } from "./TitleEditor";

type TabId = "create" | "share" | "results";

/** Top bar shared by the Create, Share and Results pages of one form. */
export function FormShell({ formId, children }: { formId: number; children: React.ReactNode }) {
  const form = useForm(formId);
  const pathname = usePathname();

  if (form.isPending) {
    return (
      <div className="flex h-dvh items-center justify-center text-ink-muted">
        <Spinner />
      </div>
    );
  }

  if (form.isError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">{form.error.message}</h1>
        <Link href="/workspace">
          <Button variant="secondary">Back to workspace</Button>
        </Link>
      </div>
    );
  }

  const tabs: TabItem<TabId>[] = [
    { id: "create", label: "Create", href: `/forms/${formId}/create` },
    { id: "share", label: "Share", href: `/forms/${formId}/share` },
    { id: "results", label: "Results", href: `/forms/${formId}/results` },
  ];
  const activeTab = tabs.find((tab) => pathname.endsWith(`/${tab.id}`))?.id ?? "create";

  return (
    <>
      <header className="flex h-[72px] items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Link
            href="/workspace"
            className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-strong"
            aria-label="Back to workspace"
          >
            <LayoutList className="size-5" aria-hidden />
            <span className="hidden font-medium sm:inline">Forms</span>
          </Link>
          <span className="text-ink-faint" aria-hidden>
            ›
          </span>
          <TitleEditor formId={formId} title={form.data.title} />
        </div>

        <Tabs items={tabs} value={activeTab} className="hidden lg:flex" />

        <div className="flex flex-1 items-center justify-end gap-4">
          <SaveIndicator />
          <PublishControl form={form.data} />
        </div>
      </header>
      {/* The header tabs need room; on small screens they move to their own row. */}
      <Tabs items={tabs} value={activeTab} className="mb-3 justify-center lg:hidden" />
      <main className="px-5 pb-5">{children}</main>
    </>
  );
}
