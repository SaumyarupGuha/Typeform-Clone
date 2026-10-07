"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";
import { Modal } from "@/components/ui/Modal";

interface CreateFormModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export function CreateFormModal({ open, loading, onClose, onCreate }: CreateFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="What would you like to create?">
      <CreateForm loading={loading} onCreate={onCreate} />
    </Modal>
  );
}

// Its own component so the input state starts fresh each time the modal opens.
function CreateForm({ loading, onCreate }: Pick<CreateFormModalProps, "loading" | "onCreate">) {
  const [title, setTitle] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onCreate(title.trim() || "My new form");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-ink-muted">Form name</span>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="My new form"
          className="h-11 w-full rounded-control border border-line px-3 outline-none focus:border-ink"
        />
      </label>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Start from scratch
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {["Generate with AI", "Use a template"].map((label) => (
          <div
            key={label}
            aria-disabled
            className="flex flex-col items-center gap-1 rounded-control bg-surface px-3 py-3 text-sm text-ink-muted"
          >
            {label}
            <ComingSoonBadge />
          </div>
        ))}
      </div>
    </form>
  );
}
