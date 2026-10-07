import { useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { clearDraft, saveDraftToken } from "@/lib/draft";
import type { AnswerInput, PublicForm, ThankYouScreen, UploadedFile } from "@/lib/types";

export type SubmitOutcome =
  | { kind: "success"; thankYou: ThankYouScreen }
  | { kind: "invalid"; errors: Record<number, string> }
  | { kind: "closed" }
  | { kind: "failed"; message: string };

/** The server sends question ids as strings (JSON object keys); the runner uses numbers. */
function toNumericKeys(errors: Record<string, string>): Record<number, string> {
  return Object.fromEntries(Object.entries(errors).map(([id, message]) => [Number(id), message]));
}

/**
 * Talks to the backend on behalf of one respondent: creates the response when they
 * first interact (that is what makes "completion rate" possible) and submits it.
 * In preview mode nothing is sent and nothing is saved.
 */
export function useResponseSession(form: PublicForm, preview: boolean, initialToken: string | null) {
  const token = useRef<string | null>(initialToken);
  // Shared by concurrent callers so rapid first keystrokes create only one response.
  const starting = useRef<Promise<string> | null>(null);

  async function ensureStarted(): Promise<string | null> {
    if (preview) return null;
    if (token.current) return token.current;
    starting.current ??= api
      .startResponse(form.slug)
      .then((started) => {
        token.current = started.token;
        saveDraftToken(form.slug, started.token);
        return started.token;
      })
      .finally(() => {
        starting.current = null;
      });
    return starting.current;
  }

  /** Fire-and-forget version used on first interaction; a failure here must not block answering. */
  function startInBackground(): void {
    void ensureStarted().catch(() => undefined);
  }

  /**
   * Saves the answers given so far, so a respondent who leaves part-way is still recorded as a
   * partial response. Best effort: a failure here must never get in the respondent's way.
   */
  async function saveProgress(answers: AnswerInput[], keepalive = false): Promise<void> {
    if (preview) return;
    try {
      const current = await ensureStarted();
      if (current) await api.saveProgress(form.slug, current, answers, keepalive);
    } catch {
      // ignore: the final submit sends everything again
    }
  }

  /** Uploads a file for a file question. In preview nothing is sent: the file is only remembered by name. */
  async function uploadFile(questionId: number, file: File, onProgress: (fraction: number) => void): Promise<UploadedFile> {
    if (preview) {
      onProgress(1);
      return { file_id: 1, name: file.name, size: file.size };
    }
    const current = await ensureStarted();
    return api.uploadFile(form.slug, current as string, questionId, file, onProgress);
  }

  async function submit(answers: AnswerInput[]): Promise<SubmitOutcome> {
    if (preview) return { kind: "success", thankYou: form.settings.thank_you_screen };

    async function attempt() {
      const current = await ensureStarted();
      return api.submitResponse(form.slug, current as string, answers);
    }

    try {
      let result;
      try {
        result = await attempt();
      } catch (error) {
        // The stored token can be stale (for example the database was reset): start a fresh response once.
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        token.current = null;
        result = await attempt();
      }
      clearDraft(form.slug);
      return { kind: "success", thankYou: result.thank_you_screen };
    } catch (error) {
      if (!(error instanceof ApiError)) return { kind: "failed", message: "Something went wrong. Please try again." };
      if (error.status === 422) return { kind: "invalid", errors: toNumericKeys(error.errors) };
      if (error.status === 404) return { kind: "closed" };
      if (error.status === 409) {
        // Already submitted (for example a double click): treat it as done.
        clearDraft(form.slug);
        return { kind: "success", thankYou: form.settings.thank_you_screen };
      }
      return { kind: "failed", message: error.message };
    }
  }

  return { getToken: () => token.current, startInBackground, saveProgress, uploadFile, submit };
}
