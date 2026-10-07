"use client";

import { FilePlus2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import {
  useCreateForm,
  useDeleteForm,
  useDuplicateForm,
  useForms,
  useRenameForm,
} from "@/lib/queries";
import type { FormSummary } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { CreateFormModal } from "./CreateFormModal";
import { FormCard } from "./FormCard";
import { FormListSkeleton } from "./FormListSkeleton";
import { RenameModal } from "./RenameModal";

type StatusTab = "all" | "published" | "draft";

const STATUS_TABS: TabItem<StatusTab>[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
];

export function WorkspaceView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FormSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormSummary | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const filters = { search: debouncedSearch || undefined, status: statusTab === "all" ? undefined : statusTab };
  const isFiltering = Boolean(filters.search || filters.status);
  const forms = useForms(filters);

  const createForm = useCreateForm();
  const renameForm = useRenameForm();
  const duplicateForm = useDuplicateForm();
  const deleteForm = useDeleteForm();

  function handleCreate(title: string) {
    createForm.mutate(title, {
      onSuccess: (form) => router.push(`/forms/${form.id}/create`),
    });
  }

  function handleRename(title: string) {
    if (!renameTarget) return;
    renameForm.mutate({ id: renameTarget.id, title }, { onSuccess: () => setRenameTarget(null) });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteForm.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) });
  }

  return (
    <main className="mx-5 min-h-[calc(100vh-92px)] rounded-panel bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My workspace</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create new form
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-line">
          <Tabs items={STATUS_TABS} value={statusTab} onChange={setStatusTab} />
          <label className="relative mb-2 block w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search forms"
              aria-label="Search forms"
              className="h-9 w-full rounded-control border border-line bg-card pl-9 pr-3 text-sm outline-none focus:border-ink"
            />
          </label>
        </div>

        <div className="mt-6">
          {forms.isPending && <FormListSkeleton />}

          {forms.isError && (
            <div className="rounded-control bg-card p-8 text-center">
              <p className="mb-4 text-ink-muted">{forms.error.message}</p>
              <Button variant="secondary" onClick={() => void forms.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {forms.isSuccess && forms.data.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-control bg-card px-6 py-16 text-center">
              <FilePlus2 className="size-10 text-ink-faint" />
              <p className="text-lg font-medium">{isFiltering ? "No forms match your search" : "No forms yet"}</p>
              {!isFiltering && (
                <>
                  <p className="text-ink-muted">Create your first form to start collecting responses.</p>
                  <Button onClick={() => setCreateOpen(true)}>Create new form</Button>
                </>
              )}
            </div>
          )}

          {forms.isSuccess && forms.data.length > 0 && (
            <ul className="space-y-2">
              {forms.data.map((form) => (
                <FormCard
                  key={form.id}
                  form={form}
                  onRename={() => setRenameTarget(form)}
                  onDuplicate={() => duplicateForm.mutate(form.id)}
                  onDelete={() => setDeleteTarget(form)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <CreateFormModal
        open={createOpen}
        loading={createForm.isPending}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <RenameModal
        open={renameTarget !== null}
        initialTitle={renameTarget?.title ?? ""}
        loading={renameForm.isPending}
        onClose={() => setRenameTarget(null)}
        onRename={handleRename}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this form?"
        description={`"${deleteTarget?.title ?? ""}" and all of its responses will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete form"
        loading={deleteForm.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
