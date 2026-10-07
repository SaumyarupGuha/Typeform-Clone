import type { JsonValue } from "./types";

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "yesterday", "just now". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = (now.getTime() - new Date(iso).getTime()) / 1000;
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (elapsed >= seconds) return formatter.format(-Math.floor(elapsed / seconds), unit);
  }
  return "just now";
}

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/** 222 -> "3m 42s", 45 -> "45s", null -> "-". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}

/** 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turns a stored answer into table text: lists joined, booleans as Yes/No, nothing as a dash. */
export function formatAnswer(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return String(value.name ?? "-"); // an uploaded file shows its name
  return String(value);
}
