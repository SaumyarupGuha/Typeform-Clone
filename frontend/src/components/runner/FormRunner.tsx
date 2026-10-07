"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { loadDraft, saveDraft } from "@/lib/draft";
import { useRunnerHotkeys } from "@/lib/keyboard";
import { computePath, nextIndex } from "@/lib/logic";
import { QUESTION_TYPES, validateAnswer } from "@/lib/questionTypes";
import { themeStyle } from "@/lib/theme";
import type { JsonValue, PublicForm, Question } from "@/lib/types";
import { ClosedScreen } from "./ClosedScreen";
import { NavArrows } from "./NavArrows";
import { PoweredBy } from "./PoweredBy";
import { ProgressBar } from "./ProgressBar";
import { QuestionScreen } from "./QuestionScreen";
import { Screen } from "./Screen";
import { ThankYouScreen } from "./ThankYouScreen";
import { WelcomeScreen } from "./WelcomeScreen";
import { createInitialState, runnerReducer } from "./runnerReducer";
import { firstErrorIndex, progressPercent, toAnswerPayload, validateAll } from "./runnerLogic";
import { useResponseSession } from "./useResponseSession";

/** Pause after picking a choice so the selection is visible before the next question slides in. */
const AUTO_ADVANCE_DELAY_MS = 500;
/** Ignores keys that arrive while a slide is still running, so a held key cannot skip questions. */
const NAVIGATION_LOCK_MS = 450;

interface FormRunnerProps {
  form: PublicForm;
  /** Preview mode (used by the builder): nothing is sent to the server or saved. */
  preview?: boolean;
}

const subscribeToNothing = () => () => undefined;

/**
 * The runner reads the saved draft from sessionStorage, which only exists in the
 * browser. Rendering it on the server would produce HTML that disagrees with the
 * client, so the server renders just the themed backdrop and the browser the real thing.
 */
export function FormRunner({ form, preview = false }: FormRunnerProps) {
  const isBrowser = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  return (
    <div
      style={themeStyle(form.settings.theme)}
      className="relative h-dvh w-full overflow-hidden bg-[var(--r-bg)] text-[var(--r-fg)]"
    >
      {isBrowser && <RunnerSession form={form} preview={preview} />}
    </div>
  );
}

function RunnerSession({ form, preview }: Required<FormRunnerProps>) {
  const questions = form.questions;

  const [draft] = useState(() => (preview ? null : loadDraft(form.slug)));
  const [state, dispatch] = useReducer(runnerReducer, undefined, () => createInitialState(form, draft));
  const session = useResponseSession(form, preview, draft?.token ?? null);

  const lockedUntil = useRef(0);
  const autoAdvanceTimer = useRef<number | undefined>(undefined);

  // Keep the draft in sessionStorage so a refresh does not lose progress.
  useEffect(() => {
    if (preview || state.status === "done" || state.status === "closed") return;
    saveDraft(form.slug, { token: session.getToken(), answers: state.answers, index: state.index, history: state.history });
  }, [preview, form.slug, session, state.answers, state.index, state.history, state.status]);

  const isNavigationLocked = () => Date.now() < lockedUntil.current;

  function goTo(index: number, direction: 1 | -1) {
    window.clearTimeout(autoAdvanceTimer.current);
    lockedUntil.current = Date.now() + NAVIGATION_LOCK_MS;
    dispatch({ type: "go", index, direction });
  }

  async function submit() {
    const errors = validateAll(questions, state.answers);
    const firstInvalid = firstErrorIndex(questions, errors);
    if (firstInvalid >= 0) {
      dispatch({ type: "fail", errors, goTo: firstInvalid });
      return;
    }

    dispatch({ type: "submitting" });
    const outcome = await session.submit(toAnswerPayload(questions, state.answers));

    switch (outcome.kind) {
      case "success":
        dispatch({ type: "submitted", thankYou: outcome.thankYou });
        break;
      case "invalid": {
        // The server disagreed with the browser: show its messages on the right questions.
        dispatch({ type: "fail", errors: outcome.errors, goTo: Math.max(firstErrorIndex(questions, outcome.errors), 0) });
        break;
      }
      case "closed":
        dispatch({ type: "closed" });
        break;
      case "failed":
        toast.error(outcome.message);
        dispatch({ type: "resume" }); // back to answering, same question
        break;
    }
  }

  function next() {
    if (state.status === "welcome") {
      session.startInBackground();
      dispatch({ type: "start" });
      return;
    }
    if (state.status !== "answering" || isNavigationLocked()) return;
    window.clearTimeout(autoAdvanceTimer.current);

    const question = questions[state.index];
    const message = validateAnswer(question, state.answers[question.id]);
    if (message) {
      dispatch({ type: "fail", errors: { [question.id]: message } }); // stay here; the input shakes
    } else {
      // Logic jumps decide what comes next; null means the route ends here, so submit.
      const upcoming = nextIndex(questions, state.index, state.answers);
      if (upcoming === null) void submit();
      else goTo(upcoming, 1);
    }
  }

  function previous() {
    // Back returns to the question we really came from, which a logic jump may have skipped over.
    const cameFrom = state.history.at(-1);
    if (state.status === "answering" && cameFrom !== undefined && !isNavigationLocked()) goTo(cameFrom, -1);
  }

  // The auto-advance timer fires later, so it must call the newest `next`, not the one it was created with.
  const latestNext = useRef(next);
  useEffect(() => {
    latestNext.current = next;
  });

  function changeAnswer(question: Question, value: JsonValue | undefined) {
    session.startInBackground();
    dispatch({ type: "answer", questionId: question.id, value });

    const picked = value !== undefined && !QUESTION_TYPES[question.type].isEmpty(value);
    if (picked && QUESTION_TYPES[question.type].autoAdvance(question)) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = window.setTimeout(() => latestNext.current(), AUTO_ADVANCE_DELAY_MS);
    }
  }

  function handleKey(key: string) {
    if (state.status !== "answering") return;
    const question = questions[state.index];
    const answer = QUESTION_TYPES[question.type].answerForKey(question, key, state.answers[question.id]);
    if (answer !== undefined) changeAnswer(question, answer);
  }

  useRunnerHotkeys(
    { onNext: next, onPrevious: previous, onKey: handleKey },
    state.status === "welcome" || state.status === "answering",
  );

  // ----- Rendering -----

  if (questions.length === 0) {
    return <ClosedScreen title="This form has no questions yet" description="Add a question in the builder to try it out." />;
  }
  if (state.status === "closed") return <ClosedScreen />;

  const question = questions[state.index];
  const isLastOnRoute = nextIndex(questions, state.index, state.answers) === null;
  const routeLength = computePath(questions, state.answers).length;
  const screenKey = state.status === "welcome" ? "welcome" : state.status === "done" ? "done" : `question-${question.id}`;

  return (
    <>
      <ProgressBar percent={progressPercent(state.status, state.history.length, routeLength)} />

      <AnimatePresence mode="popLayout" custom={state.direction}>
        <Screen key={screenKey} direction={state.direction}>
          {state.status === "welcome" && <WelcomeScreen settings={form.settings.welcome_screen} onStart={next} />}
          {state.status === "done" && state.thankYou && <ThankYouScreen settings={state.thankYou} />}
          {(state.status === "answering" || state.status === "submitting") && (
            <QuestionScreen
              question={question}
              number={state.index + 1}
              value={state.answers[question.id]}
              error={state.errors[question.id]}
              errorTick={state.errorTick}
              isLast={isLastOnRoute}
              submitting={state.status === "submitting"}
              onChange={(value) => changeAnswer(question, value)}
              onNext={next}
            />
          )}
        </Screen>
      </AnimatePresence>

      {(state.status === "answering" || state.status === "submitting") && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 sm:bottom-6 sm:right-6">
          <NavArrows
            canGoBack={state.history.length > 0}
            canGoForward={!isLastOnRoute}
            onPrevious={previous}
            onNext={next}
          />
          <PoweredBy />
        </div>
      )}
    </>
  );
}
