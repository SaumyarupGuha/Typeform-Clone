/**
 * Which files a file question accepts. Mirrors backend/app/services/file_service.py, so a file the
 * browser lets through is one the server accepts, and the other way round (the server stays the authority).
 */

export type AllowedTypes = "any" | "images" | "documents" | "media";

export const ALLOWED_TYPE_OPTIONS: { value: AllowedTypes; label: string }[] = [
  { value: "any", label: "Any file" },
  { value: "images", label: "Images" },
  { value: "documents", label: "Documents" },
  { value: "media", label: "Audio and video" },
];

const PRESET_EXTENSIONS: Record<Exclude<AllowedTypes, "any">, string[]> = {
  images: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
  documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".odt"],
  media: [".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".mov", ".webm", ".mkv"],
};

/** Files a computer would run: never accepted. */
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".js", ".vbs", ".ps1", ".sh", ".jar", ".dll", ".apk", ".app"];

export const HARD_LIMIT_MB = 25;

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

export function isAllowedTypes(value: unknown): value is AllowedTypes {
  return value === "any" || value === "images" || value === "documents" || value === "media";
}

/** The value for the file picker's `accept` attribute (a hint; the checks below are the rule). */
export function acceptAttribute(allowed: AllowedTypes): string | undefined {
  return allowed === "any" ? undefined : PRESET_EXTENSIONS[allowed].join(",");
}

export function describeAllowed(allowed: AllowedTypes): string {
  return ALLOWED_TYPE_OPTIONS.find((option) => option.value === allowed)?.label ?? "Any file";
}

/** A reason this file cannot be uploaded, or null when it is fine. */
export function fileProblem(file: File, maxMb: number, allowed: AllowedTypes): string | null {
  if (file.size === 0) return "This file is empty";
  if (file.size > maxMb * 1024 * 1024) return `This file is too large. The limit is ${maxMb} MB.`;
  const extension = extensionOf(file.name);
  if (BLOCKED_EXTENSIONS.includes(extension)) return "This type of file cannot be uploaded";
  if (allowed !== "any" && !PRESET_EXTENSIONS[allowed].includes(extension)) {
    return `Please upload a file of this kind: ${PRESET_EXTENSIONS[allowed].join(", ")}`;
  }
  return null;
}
