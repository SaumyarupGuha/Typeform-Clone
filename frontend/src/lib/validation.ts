/**
 * Client-side validation rules, one zod schema per question type.
 *
 * They mirror backend/app/question_types exactly (same rules, same messages) so a
 * respondent sees the same text whether the browser or the server caught the problem.
 * The server stays the authority: these only save a round trip.
 */
import { z } from "zod";
import type { JsonValue, Question } from "./types";

export const REQUIRED_MESSAGE = "This question is required";

/** True when nothing was answered. `false` (yes/no) and `0` are real answers. */
export function isEmptyAnswer(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function numberProperty(question: Question, key: string): number | null {
  const value = question.properties[key];
  return typeof value === "number" ? value : null;
}

function optionIds(question: Question): Set<number> {
  return new Set(question.options.map((option) => option.id));
}

function textSchema(question: Question, defaultMax: number) {
  const max = numberProperty(question, "max_length") ?? defaultMax;
  return z
    .string({ error: "Please enter some text" })
    .trim()
    .max(max, `Please keep this under ${max} characters`);
}

export const shortTextSchema = (question: Question) => textSchema(question, 255);
export const longTextSchema = (question: Question) => textSchema(question, 5000);

export const emailSchema = () =>
  z.string({ error: "Please enter a valid email" }).trim().pipe(z.email("Please enter a valid email"));

function rangeMessage(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `Please enter a number between ${min} and ${max}`;
  if (min !== null) return `Please enter a number that is at least ${min}`;
  return `Please enter a number that is at most ${max}`;
}

export function numberSchema(question: Question) {
  const min = numberProperty(question, "min");
  const max = numberProperty(question, "max");
  return z
    .number({ error: "Please enter a number" })
    .refine((value) => (min === null || value >= min) && (max === null || value <= max), rangeMessage(min, max));
}

export function ratingSchema(question: Question) {
  const steps = numberProperty(question, "steps") ?? 5;
  return z
    .number({ error: `Please choose a rating from 1 to ${steps}` })
    .int(`Please choose a rating from 1 to ${steps}`)
    .min(1, `Please choose a rating from 1 to ${steps}`)
    .max(steps, `Please choose a rating from 1 to ${steps}`);
}

export const yesNoSchema = () => z.boolean({ error: "Please choose Yes or No" });

export function dropdownSchema(question: Question) {
  const ids = optionIds(question);
  return z
    .number({ error: "Please choose one of the options" })
    .refine((id) => ids.has(id), "Please choose one of the options");
}

export function multipleChoiceSchema(question: Question) {
  const ids = optionIds(question);
  const allowMultiple = question.properties.allow_multiple === true;
  return z
    .array(z.number(), { error: "Please choose from the options" })
    .refine((chosen) => chosen.every((id) => ids.has(id)), "Please choose from the options")
    .refine((chosen) => new Set(chosen).size === chosen.length, "Please choose each option only once")
    .refine((chosen) => allowMultiple || chosen.length === 1, "Please choose only one option");
}
