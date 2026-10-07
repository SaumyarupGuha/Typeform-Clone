import { validateAnswer } from "@/lib/questionTypes";
import type { AnswerInput, JsonValue, Question } from "@/lib/types";
import { isEmptyAnswer } from "@/lib/validation";

/** Validates every question; returns {questionId: message} for the ones that fail. */
export function validateAll(
  questions: Question[],
  answers: Record<number, JsonValue>,
): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const question of questions) {
    const message = validateAnswer(question, answers[question.id]);
    if (message) errors[question.id] = message;
  }
  return errors;
}

/** The request body for submit: only questions the respondent actually answered. */
export function toAnswerPayload(questions: Question[], answers: Record<number, JsonValue>): AnswerInput[] {
  return questions
    .filter((question) => !isEmptyAnswer(answers[question.id]))
    .map((question) => ({ question_id: question.id, value: answers[question.id] }));
}

/** Index of the first question that has an error, or -1. */
export function firstErrorIndex(questions: Question[], errors: Record<number, string>): number {
  return questions.findIndex((question) => errors[question.id] !== undefined);
}

/** Share of questions the respondent has moved past, as a 0-100 percentage. */
export function progressPercent(status: string, index: number, total: number): number {
  if (status === "done") return 100;
  if (status === "welcome" || total === 0) return 0;
  return Math.round((index / total) * 100);
}
