"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface RenameModalProps {
  open: boolean;
  initialTitle: string;
  loading: boolean;
  onClose: () => void;
  onRename: (title: string) => void;
}

export function RenameModal({ open, initialTitle, loading, onClose, onRename }: RenameModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Rename form">
      {/* Its own component so the input state starts fresh each time the modal opens. */}
      <RenameForm initialTitle={initialTitle} loading={loading} onClose={onClose} onRename={onRename} />
    </Modal>
  );
}

function RenameForm({ initialTitle, loading, onClose, onRename }: Omit<RenameModalProps, "open">) {
  const [title, setTitle] = useState(initialTitle);
  const trimmed = title.trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (trimmed) onRename(trimmed);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        autoFocus
        onFocus={(event) => event.target.select()}
        aria-label="Form name"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={200}
        className="h-11 w-full rounded-control border border-line px-3 outline-none focus:border-ink"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed} loading={loading}>
          Rename
        </Button>
      </div>
    </form>
  );
}
