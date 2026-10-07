import { computePath } from "@/lib/logic";
import { validateAnswer } from "@/lib/questionTypes";
import type { AnswerInput, JsonValue, Question } from "@/lib/types";
import { isEmptyAnswer } from "@/lib/validation";

/**
 * Validates every question the respondent was shown; returns {questionId: message} for the
 * ones that fail. Questions skipped by a logic jump are not checked, so a skipped
 * "required" question never blocks the submit.
 */
export function validateAll(
  questions: Question[],
  answers: Record<number, JsonValue>,
): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const question of computePath(questions, answers)) {
    const message = validateAnswer(question, answers[question.id]);
    if (message) errors[question.id] = message;
  }
  return errors;
}

/** The request body for submit: only questions on the respondent's route that they answered. */
export function toAnswerPayload(questions: Question[], answers: Record<number, JsonValue>): AnswerInput[] {
  return computePath(questions, answers)
    .filter((question) => !isEmptyAnswer(answers[question.id]))
    .map((question) => ({ question_id: question.id, value: answers[question.id] }));
}

/** Index of the first question that has an error, or -1. */
export function firstErrorIndex(questions: Question[], errors: Record<number, string>): number {
  return questions.findIndex((question) => errors[question.id] !== undefined);
}

/**
 * How far along the respondent is, 0-100: questions passed over the length of their route.
 * With logic jumps the route can shrink or grow as answers change, so it is recomputed each time.
 */
export function progressPercent(status: string, passed: number, routeLength: number): number {
  if (status === "done") return 100;
  if (status === "welcome" || routeLength === 0) return 0;
  return Math.round((passed / routeLength) * 100);
}
