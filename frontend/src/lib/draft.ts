import type { JsonValue } from "./types";

/** In-progress answers, kept in sessionStorage per form so a refresh does not lose them. */
export interface Draft {
  token: string | null;
  answers: Record<number, JsonValue>;
  index: number;
  /** Questions already passed (logic jumps make the route non-linear). Absent in older drafts. */
  history?: number[];
}

const key = (slug: string) => `typeform-draft:${slug}`;

// Storage can be unavailable (private mode, blocked cookies); drafts are a nicety, so every call is guarded.

export function loadDraft(slug: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(slug: string, draft: Draft): void {
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

/** Remember the response token without touching the answers already saved. */
export function saveDraftToken(slug: string, token: string): void {
  const existing = loadDraft(slug) ?? { token: null, answers: {}, index: 0 };
  saveDraft(slug, { ...existing, token });
}

export function clearDraft(slug: string): void {
  try {
    sessionStorage.removeItem(key(slug));
  } catch {
    // ignore
  }
}
