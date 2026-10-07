import type { Draft } from "@/lib/draft";
import type { JsonValue, PublicForm, ThankYouScreen } from "@/lib/types";

export type RunnerStatus = "welcome" | "answering" | "submitting" | "done" | "closed";

export interface RunnerState {
  status: RunnerStatus;
  index: number;
  /** 1 = moving forward (screens slide up), -1 = moving back. Drives the slide direction. */
  direction: 1 | -1;
  answers: Record<number, JsonValue>;
  /** Error message per question id. */
  errors: Record<number, string>;
  /** Bumped on every failed attempt so the shake animation replays even for the same message. */
  errorTick: number;
  thankYou: ThankYouScreen | null;
}

export type RunnerAction =
  | { type: "start" }
  | { type: "answer"; questionId: number; value: JsonValue | undefined }
  | { type: "go"; index: number; direction: 1 | -1 }
  | { type: "fail"; errors: Record<number, string>; goTo?: number }
  | { type: "submitting" }
  | { type: "submitted"; thankYou: ThankYouScreen }
  | { type: "closed" };

export function createInitialState(form: PublicForm, draft: Draft | null): RunnerState {
  const hasProgress = draft !== null && (Object.keys(draft.answers).length > 0 || draft.index > 0);
  const showWelcome = form.settings.welcome_screen.enabled && !hasProgress;
  return {
    status: showWelcome ? "welcome" : "answering",
    index: draft ? Math.min(draft.index, Math.max(form.questions.length - 1, 0)) : 0,
    direction: 1,
    answers: draft?.answers ?? {},
    errors: {},
    errorTick: 0,
    thankYou: null,
  };
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "start":
      return { ...state, status: "answering", direction: 1 };

    case "answer": {
      const answers = { ...state.answers };
      if (action.value === undefined) delete answers[action.questionId];
      else answers[action.questionId] = action.value;
      // Editing an answer clears its error; the next attempt re-validates.
      const errors = { ...state.errors };
      delete errors[action.questionId];
      return { ...state, answers, errors };
    }

    case "go":
      return { ...state, status: "answering", index: action.index, direction: action.direction, errors: {} };

    case "fail":
      return {
        ...state,
        status: "answering",
        errors: action.errors,
        errorTick: state.errorTick + 1,
        index: action.goTo ?? state.index,
        direction: action.goTo !== undefined && action.goTo < state.index ? -1 : state.direction,
      };

    case "submitting":
      return { ...state, status: "submitting" };

    case "submitted":
      return { ...state, status: "done", direction: 1, thankYou: action.thankYou };

    case "closed":
      return { ...state, status: "closed" };
  }
}
