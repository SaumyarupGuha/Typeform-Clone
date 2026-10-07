/**
 * Typed readers for QuestionSummary.stats. The backend sends a loosely typed object whose
 * shape depends on the question type (see each handler's `stats` method); these functions
 * check it at runtime and hand the UI properly typed values.
 */
import type { JsonValue, QuestionSummary } from "./types";

type JsonObject = { [key: string]: JsonValue };

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asNumber = (value: JsonValue | undefined): number | null => (typeof value === "number" ? value : null);

export interface ChoiceStat {
  optionId: number;
  label: string;
  count: number;
  percent: number;
}

export function choiceStats(summary: QuestionSummary): ChoiceStat[] {
  const raw = summary.stats.options;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isObject(item) || typeof item.label !== "string") return [];
    return [
      {
        optionId: asNumber(item.option_id) ?? 0,
        label: item.label,
        count: asNumber(item.count) ?? 0,
        percent: asNumber(item.percent) ?? 0,
      },
    ];
  });
}

export function yesNoStats(summary: QuestionSummary): { yes: number; no: number } {
  return { yes: asNumber(summary.stats.yes) ?? 0, no: asNumber(summary.stats.no) ?? 0 };
}

export interface RatingStats {
  steps: number;
  average: number | null;
  distribution: { value: number; count: number }[];
}

export function ratingStats(summary: QuestionSummary): RatingStats {
  const raw = summary.stats.distribution;
  const distribution = Array.isArray(raw)
    ? raw.flatMap((item) =>
        isObject(item) ? [{ value: asNumber(item.value) ?? 0, count: asNumber(item.count) ?? 0 }] : [],
      )
    : [];
  return {
    steps: asNumber(summary.stats.steps) ?? distribution.length,
    average: asNumber(summary.stats.average),
    distribution,
  };
}

export function numberStats(summary: QuestionSummary): { min: number | null; max: number | null; average: number | null } {
  return {
    min: asNumber(summary.stats.min),
    max: asNumber(summary.stats.max),
    average: asNumber(summary.stats.average),
  };
}

export function latestAnswers(summary: QuestionSummary): string[] {
  const raw = summary.stats.latest;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}
