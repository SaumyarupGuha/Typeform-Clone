import type { Draft } from "@/lib/draft";
import { asFileAnswer } from "@/lib/fileAnswer";
import { computePath } from "@/lib/logic";
import type { JsonValue, PublicForm, ThankYouScreen } from "@/lib/types";

export type RunnerStatus = "welcome" | "answering" | "submitting" | "done" | "closed";

export interface RunnerState {
  status: RunnerStatus;
  index: number;
  /** 1 = moving forward (screens slide up), -1 = moving back. Drives the slide direction. */
  direction: 1 | -1;
  /**
   * Indices of the questions already passed, oldest first. Logic jumps make the route
   * non-linear, so "back" returns to the last entry rather than to index - 1.
   */
  history: number[];
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
  | { type: "resume" }
  | { type: "fail"; errors: Record<number, string>; goTo?: number }
  | { type: "submitting" }
  | { type: "submitted"; thankYou: ThankYouScreen }
  | { type: "closed" };

/** A saved draft can hold an upload that never finished; it is not an answer, so it is dropped. */
function withoutRunningUploads(answers: Record<number, JsonValue>): Record<number, JsonValue> {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => !asFileAnswer(value)?.uploading));
}

export function createInitialState(form: PublicForm, draft: Draft | null): RunnerState {
  const hasProgress = draft !== null && (Object.keys(draft.answers).length > 0 || draft.index > 0);
  const showWelcome = form.settings.welcome_screen.enabled && !hasProgress;
  const index = draft ? Math.min(draft.index, Math.max(form.questions.length - 1, 0)) : 0;
  // Older drafts have no history: rebuild it from the route the saved answers lead along.
  const rebuilt = draft
    ? computePath(form.questions, draft.answers)
        .map((question) => form.questions.indexOf(question))
        .filter((position) => position < index)
    : [];
  return {
    status: showWelcome ? "welcome" : "answering",
    index,
    direction: 1,
    history: draft?.history ?? rebuilt,
    answers: withoutRunningUploads(draft?.answers ?? {}),
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
      return {
        ...state,
        status: "answering",
        index: action.index,
        direction: action.direction,
        // Forward remembers where we came from; back forgets the screen we are leaving.
        history: action.direction === 1 ? [...state.history, state.index] : state.history.slice(0, -1),
        errors: {},
      };

    case "resume":
      return { ...state, status: "answering" };

    case "fail": {
      const { goTo } = action;
      return {
        ...state,
        status: "answering",
        errors: action.errors,
        errorTick: state.errorTick + 1,
        index: goTo ?? state.index,
        direction: goTo !== undefined && goTo < state.index ? -1 : state.direction,
        // Jumping back to an earlier question forgets the screens after it.
        history: goTo === undefined ? state.history : state.history.filter((position) => position < goTo),
      };
    }

    case "submitting":
      return { ...state, status: "submitting" };

    case "submitted":
      return { ...state, status: "done", direction: 1, thankYou: action.thankYou };

    case "closed":
      return { ...state, status: "closed" };
  }
}
