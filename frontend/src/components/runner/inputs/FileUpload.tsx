"use client";

import { FileText, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { asFileAnswer } from "@/lib/fileAnswer";
import { acceptAttribute, describeAllowed, fileProblem, isAllowedTypes } from "@/lib/fileTypes";
import { formatBytes } from "@/lib/format";
import type { JsonValue } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ErrorMessage } from "../ErrorMessage";
import type { QuestionInputProps } from "./types";

export function FileUpload({ question, value, onChange, upload, errorId }: QuestionInputProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null); // 0 to 1 while uploading
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const maxMb = typeof question.properties.max_size_mb === "number" ? question.properties.max_size_mb : 10;
  const allowed = isAllowedTypes(question.properties.allowed_types) ? question.properties.allowed_types : "any";
  const answer = asFileAnswer(value);
  const uploading = progress !== null;

  async function handleFile(file: File) {
    setProblem(null);
    const message = fileProblem(file, maxMb, allowed);
    if (message) {
      setProblem(message);
      return;
    }
    setProgress(0);
    // While the upload runs the answer says so; validation then asks the respondent to wait
    // instead of letting them move on without the file.
    onChange({ file_id: 0, name: file.name, size: file.size, uploading: true });
    try {
      // Without an uploader (the builder canvas) the file is only shown, never sent anywhere.
      const stored: JsonValue = upload ? await upload(file, setProgress) : { file_id: 1, name: file.name, size: file.size };
      onChange(stored);
    } catch (error) {
      onChange(undefined);
      setProblem(error instanceof ApiError ? error.message : "The upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (file) void handleFile(file);
    if (picker.current) picker.current.value = ""; // lets the same file be chosen again after removing it
  }

  return (
    <div>
      {/* The real <input> stays in the page (visually hidden) so the keyboard and screen readers can reach it. */}
      <input
        ref={picker}
        id={inputId}
        type="file"
        className="sr-only"
        accept={acceptAttribute(allowed)}
        disabled={uploading}
        aria-label={question.title || "Upload a file"}
        aria-describedby={problem ? messageId : errorId}
        onChange={(event) => choose(event.target.files)}
      />

      {answer && !answer.uploading && !uploading ? (
        <div className="flex max-w-md items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--r-fg)_30%,transparent)] bg-[color-mix(in_srgb,var(--r-fg)_6%,transparent)] p-3">
          <FileText className="size-8 shrink-0 text-[var(--r-accent)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{answer.name}</p>
            <p className="text-sm opacity-70">{formatBytes(answer.size)}</p>
          </div>
          <label htmlFor={inputId} className="cursor-pointer text-sm underline underline-offset-4 hover:opacity-70">
            Replace
          </label>
          <button
            type="button"
            onClick={() => {
              setProblem(null);
              onChange(undefined);
            }}
            aria-label="Remove file"
            className="rounded p-1.5 hover:bg-black/10"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : uploading ? (
        <div className="max-w-md rounded-lg border border-[color-mix(in_srgb,var(--r-fg)_30%,transparent)] p-4" role="status">
          <p className="truncate font-medium">{answer?.name ?? "Uploading"}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--r-fg)_15%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--r-accent)] transition-[width] duration-200"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm opacity-70">Uploading… {Math.round((progress ?? 0) * 100)}%</p>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files);
          }}
          className={cn(
            "flex max-w-md cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            "peer-focus-visible:outline-2",
            dragging
              ? "border-[var(--r-accent)] bg-[color-mix(in_srgb,var(--r-accent)_12%,transparent)]"
              : "border-[color-mix(in_srgb,var(--r-fg)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--r-fg)_6%,transparent)]",
          )}
        >
          <Upload className="size-8 text-[var(--r-accent)]" aria-hidden />
          <span className="text-lg">
            Drag and drop a file here or <span className="font-semibold underline underline-offset-4">choose a file</span>
          </span>
          <span className="text-sm opacity-70">
            {describeAllowed(allowed)} · up to {maxMb} MB
          </span>
        </label>
      )}

      {problem && <ErrorMessage id={messageId} message={problem} />}
    </div>
  );
}
