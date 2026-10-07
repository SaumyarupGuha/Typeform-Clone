import type { JsonValue } from "./types";

export interface FileAnswer {
  file_id: number;
  name: string;
  size: number;
  /** True while the upload is still running; such a value is not an answer yet. */
  uploading: boolean;
}

/** Reads a file answer out of a loosely typed JSON value, or returns null if it is not one. */
export function asFileAnswer(value: JsonValue | undefined): FileAnswer | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { file_id: id, name, size, uploading } = value;
  if (typeof id !== "number" || typeof name !== "string") return null;
  return { file_id: id, name, size: typeof size === "number" ? size : 0, uploading: uploading === true };
}
