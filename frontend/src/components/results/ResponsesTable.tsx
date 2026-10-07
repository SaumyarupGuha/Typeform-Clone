"use client";

import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatAnswer, formatDateTime } from "@/lib/format";
import { RESPONSES_PAGE_SIZE, useResponses } from "@/lib/queries";
import type { ResponseStatusFilter } from "@/lib/types";
import { ResponseDrawer } from "./ResponseDrawer";

const EMPTY_TEXT: Record<ResponseStatusFilter, { title: string; hint: string }> = {
  completed: { title: "No responses yet", hint: "Share your form link and the answers will show up here." },
  partial: { title: "No partial responses", hint: "People who start the form but do not finish it appear here." },
  all: { title: "No responses yet", hint: "Share your form link and the answers will show up here." },
};

export function ResponsesTable({ formId }: { formId: number }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ResponseStatusFilter>("completed");
  const [openId, setOpenId] = useState<number | null>(null);
  const responses = useResponses(formId, page, status);

  function changeStatus(next: ResponseStatusFilter) {
    setStatus(next);
    setPage(1); // a different list starts from its first page
  }

  if (responses.isPending) {
    return (
      <div className="flex justify-center py-20 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (responses.isError) {
    return (
      <div className="rounded-panel bg-card p-8 text-center">
        <p className="mb-4 text-ink-muted">{responses.error.message}</p>
        <Button variant="secondary" onClick={() => void responses.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { items, total, questions, completed_count: completedCount, partial_count: partialCount } = responses.data;
  const lastPage = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));
  const first = (page - 1) * RESPONSES_PAGE_SIZE + 1;
  const last = first + items.length - 1;
  const showStatus = status !== "completed";

  const filters: { id: ResponseStatusFilter; label: string; count: number }[] = [
    { id: "completed", label: "Completed", count: completedCount },
    { id: "partial", label: "Partial", count: partialCount },
    { id: "all", label: "All", count: completedCount + partialCount },
  ];

  return (
    <div>
      <div role="group" aria-label="Filter responses" className="mb-3 inline-flex rounded-control bg-surface-strong p-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={status === filter.id}
            onClick={() => changeStatus(filter.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === filter.id ? "bg-card shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {filter.label} <span className="text-ink-faint">{filter.count}</span>
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-panel bg-card px-6 py-16 text-center">
          <Inbox className="size-10 text-ink-faint" />
          <p className="text-lg font-medium">{EMPTY_TEXT[status].title}</p>
          <p className="text-ink-muted">{EMPTY_TEXT[status].hint}</p>
        </div>
      ) : (
        <div className="rounded-panel bg-card">
          {/* The table scrolls sideways inside this box; the first column stays in view. */}
          <div className="max-h-[70vh] overflow-auto rounded-t-panel">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr>
                  <th scope="col" className="sticky left-0 bg-surface px-4 py-3 text-left font-medium text-ink-muted">
                    {showStatus ? "Date" : "Submitted at"}
                  </th>
                  {showStatus && (
                    <th scope="col" className="px-4 py-3 text-left font-medium text-ink-muted">
                      Status
                    </th>
                  )}
                  {questions.map((question) => (
                    <th key={question.id} scope="col" className="max-w-64 px-4 py-3 text-left font-medium text-ink-muted">
                      <span className="block truncate" title={question.title}>
                        {question.title || "Untitled question"}
                      </span>
                      {question.deleted && <span className="text-xs font-normal text-ink-faint">(deleted question)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setOpenId(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setOpenId(row.id);
                    }}
                    className="cursor-pointer border-t border-line hover:bg-surface"
                  >
                    <td className="sticky left-0 whitespace-nowrap bg-inherit px-4 py-3">
                      {formatDateTime(row.submitted_at ?? row.started_at)}
                    </td>
                    {showStatus && (
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            row.status === "completed" ? "bg-success-soft text-success" : "bg-surface-strong text-ink-muted",
                          )}
                        >
                          {row.status === "completed" ? "Completed" : "Partial"}
                        </span>
                      </td>
                    )}
                    {questions.map((question) => (
                      <td key={question.id} className="max-w-64 px-4 py-3">
                        <span className="block truncate">{formatAnswer(row.answers[String(question.id)])}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-muted">
            <span>
              {first}-{last} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ResponseDrawer formId={formId} responseIds={items.map((row) => row.id)} openId={openId} onOpenChange={setOpenId} />
    </div>
  );
}
