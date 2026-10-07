"use client";

import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatAnswer, formatDateTime } from "@/lib/format";
import { RESPONSES_PAGE_SIZE, useResponses } from "@/lib/queries";
import { ResponseDrawer } from "./ResponseDrawer";

export function ResponsesTable({ formId }: { formId: number }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const responses = useResponses(formId, page);

  if (responses.isPending) {
    return (
      <div className="flex justify-center py-20 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (responses.isError) {
    return (
      <div className="rounded-panel bg-white p-8 text-center">
        <p className="mb-4 text-ink-muted">{responses.error.message}</p>
        <Button variant="secondary" onClick={() => void responses.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { items, total, questions } = responses.data;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel bg-white px-6 py-16 text-center">
        <Inbox className="size-10 text-ink-faint" />
        <p className="text-lg font-medium">No responses yet</p>
        <p className="text-ink-muted">Share your form link and the answers will show up here.</p>
      </div>
    );
  }

  const lastPage = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));
  const first = (page - 1) * RESPONSES_PAGE_SIZE + 1;
  const last = first + items.length - 1;

  return (
    <div className="rounded-panel bg-white">
      {/* The table scrolls sideways inside this box; the first column stays in view. */}
      <div className="max-h-[70vh] overflow-auto rounded-t-panel">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface px-4 py-3 text-left font-medium text-ink-muted">
                Submitted at
              </th>
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
                <td className="sticky left-0 whitespace-nowrap bg-inherit px-4 py-3">{formatDateTime(row.submitted_at)}</td>
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

      <ResponseDrawer
        formId={formId}
        responseIds={items.map((row) => row.id)}
        openId={openId}
        onOpenChange={setOpenId}
      />
    </div>
  );
}
