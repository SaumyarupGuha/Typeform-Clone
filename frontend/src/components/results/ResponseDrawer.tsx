"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatAnswer, formatDateTime } from "@/lib/format";
import { useDeleteResponse, useResponse } from "@/lib/queries";
import type { ResponseDetail } from "@/lib/types";

interface ResponseDrawerProps {
  formId: number;
  /** Ids on the current page, in table order; Previous/Next move through them. */
  responseIds: number[];
  /** The open response, or null when the drawer is closed. */
  openId: number | null;
  onOpenChange: (id: number | null) => void;
}

export function ResponseDrawer({ formId, responseIds, openId, onOpenChange }: ResponseDrawerProps) {
  const response = useResponse(formId, openId);
  const deleteResponse = useDeleteResponse(formId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const index = openId === null ? -1 : responseIds.indexOf(openId);
  const previousId = index > 0 ? responseIds[index - 1] : null;
  const nextId = index >= 0 && index < responseIds.length - 1 ? responseIds[index + 1] : null;

  function handleDelete() {
    if (openId === null) return;
    deleteResponse.mutate(openId, {
      onSuccess: () => {
        setConfirmOpen(false);
        // Show the neighbour if there is one, otherwise close.
        onOpenChange(nextId ?? previousId);
      },
    });
  }

  return (
    <>
      <Modal
        open={openId !== null}
        // While the delete confirmation is on top, Escape and outside clicks belong to it.
        onClose={() => !confirmOpen && onOpenChange(null)}
        title={`Response${index >= 0 ? ` ${index + 1} of ${responseIds.length}` : ""}`}
        placement="right"
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">
            {response.data
              ? response.data.submitted_at
                ? `Submitted ${formatDateTime(response.data.submitted_at)}`
                : `Started ${formatDateTime(response.data.started_at)}`
              : " "}
          </p>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" disabled={previousId === null} onClick={() => onOpenChange(previousId)} aria-label="Previous response">
              <ChevronUp className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" disabled={nextId === null} onClick={() => onOpenChange(nextId)} aria-label="Next response">
              <ChevronDown className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)} aria-label="Delete response">
              <Trash2 className="size-4 text-danger" />
            </Button>
          </div>
        </div>

        {response.isPending && (
          <div className="flex justify-center py-10 text-ink-muted">
            <Spinner />
          </div>
        )}
        {response.isError && <p className="text-danger">{response.error.message}</p>}
        {response.data?.status === "partial" && (
          <p className="mb-5 rounded-control bg-surface px-4 py-3 text-sm">
            <strong>Partial response.</strong>{" "}
            {stoppedAfter(response.data)
              ? `The respondent left after "${stoppedAfter(response.data)}".`
              : "The respondent left before answering anything."}
          </p>
        )}
        {response.data && (
          <dl className="space-y-5">
            {response.data.answers.map(({ question, value }) => (
              <div key={question.id}>
                <dt className="text-sm text-ink-muted">
                  {question.title || "Untitled question"}
                  {question.deleted && <span className="ml-1 text-ink-faint">(deleted question)</span>}
                </dt>
                <dd className={cn("mt-1 whitespace-pre-wrap break-words text-lg", value === null && "text-ink-faint")}>
                  {formatAnswer(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this response?"
        description="This response will be permanently deleted. This cannot be undone."
        confirmLabel="Delete response"
        loading={deleteResponse.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** The title of the furthest question a partial response answered. */
function stoppedAfter(response: ResponseDetail): string | null {
  const last = response.answers.find((entry) => entry.question.id === response.last_question_id);
  return last ? last.question.title || "Untitled question" : null;
}
