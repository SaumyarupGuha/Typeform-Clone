/**
 * Logic jumps: how a respondent's answers decide which question comes next.
 *
 * This mirrors backend/app/question_types/logic.py and backend/app/services/logic_service.py
 * line for line, so the browser (which screen to show) and the server (which required
 * questions were skipped) always agree.
 */
import { QUESTION_TYPES } from "./questionTypes";
import type { JsonValue, JumpTarget, LogicCondition, LogicConfig, LogicOperator, LogicRule, Question } from "./types";

export type LogicKind = "text" | "number" | "choice" | "boolean";

const ANSWERED: LogicOperator[] = ["is_answered", "is_not_answered"];

export const OPERATORS: Record<LogicKind, LogicOperator[]> = {
  text: ["is", "is_not", "contains", "not_contains", "begins_with", "ends_with", ...ANSWERED],
  number: ["is", "is_not", "greater_than", "greater_or_equal", "less_than", "less_or_equal", ...ANSWERED],
  choice: ["is", "is_not", ...ANSWERED],
  boolean: ["is", "is_not", ...ANSWERED],
};

export const OPERATOR_LABELS: Record<LogicOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  begins_with: "begins with",
  ends_with: "ends with",
  greater_than: "is greater than",
  greater_or_equal: "is greater than or equal to",
  less_than: "is less than",
  less_or_equal: "is less than or equal to",
  is_answered: "is answered",
  is_not_answered: "is not answered",
};

/** Operators that compare against nothing (no value field is shown). */
export const VALUELESS_OPERATORS: LogicOperator[] = ANSWERED;

export const EMPTY_LOGIC: LogicConfig = { rules: [], otherwise: null };

export function logicKindOf(question: Question): LogicKind {
  return QUESTION_TYPES[question.type].logicKind;
}

export function hasAnswer(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

const isNumber = (value: JsonValue | undefined): value is number => typeof value === "number";

export function evaluateCondition(
  kind: LogicKind,
  operator: LogicOperator,
  expected: JsonValue,
  actual: JsonValue | undefined,
): boolean {
  if (operator === "is_answered") return hasAnswer(actual);
  if (operator === "is_not_answered") return !hasAnswer(actual);
  if (!OPERATORS[kind].includes(operator)) return false;

  // An unanswered question is "not" anything, and matches nothing else.
  if (!hasAnswer(actual) || actual === undefined) return operator === "is_not" || operator === "not_contains";

  if (kind === "text") return compareText(operator, String(expected ?? ""), String(actual));
  if (kind === "number") return compareNumber(operator, expected, actual);
  if (kind === "choice") {
    const chosen = Array.isArray(actual) ? actual : [actual]; // multi-select: "is" means "includes"
    const found = chosen.includes(expected);
    return operator === "is" ? found : !found;
  }
  const same = typeof actual === "boolean" && actual === expected;
  return operator === "is" ? same : !same;
}

function compareText(operator: LogicOperator, expectedRaw: string, actualRaw: string): boolean {
  const expected = expectedRaw.trim().toLowerCase();
  const actual = actualRaw.trim().toLowerCase();
  switch (operator) {
    case "is":
      return actual === expected;
    case "is_not":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    case "not_contains":
      return !actual.includes(expected);
    case "begins_with":
      return actual.startsWith(expected);
    default:
      return actual.endsWith(expected); // ends_with
  }
}

function compareNumber(operator: LogicOperator, expected: JsonValue, actual: JsonValue): boolean {
  if (!isNumber(expected) || !isNumber(actual)) return operator === "is_not";
  switch (operator) {
    case "is":
      return actual === expected;
    case "is_not":
      return actual !== expected;
    case "greater_than":
      return actual > expected;
    case "greater_or_equal":
      return actual >= expected;
    case "less_than":
      return actual < expected;
    default:
      return actual <= expected; // less_or_equal
  }
}

function ruleMatches(rule: LogicRule, byId: Map<number, Question>, answers: Record<number, JsonValue>): boolean {
  const results = rule.conditions.map((condition) => {
    const source = byId.get(condition.question_id);
    if (!source) return false; // the question it depended on is gone
    return evaluateCondition(logicKindOf(source), condition.operator, condition.value, answers[source.id]);
  });
  if (results.length === 0) return false;
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

/**
 * The index to show after `questions[index]`, or null when the form ends there (a jump to the
 * end, or the last question). Only forward jumps count, so a form can never loop.
 * `answers` should only hold answers to questions already visited.
 */
export function nextIndex(questions: Question[], index: number, answers: Record<number, JsonValue>): number | null {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const position = new Map(questions.map((q, i) => [q.id, i]));
  const { rules, otherwise } = questions[index].logic;

  const matched = rules.find((rule) => ruleMatches(rule, byId, answers));
  const target: JumpTarget | null = matched ? matched.jump_to : otherwise;

  if (target === "end") return null;
  if (typeof target === "number") {
    const targetIndex = position.get(target);
    if (targetIndex !== undefined && targetIndex > index) return targetIndex;
  }
  return index + 1 < questions.length ? index + 1 : null;
}

/** The questions a respondent will see, in order, given the answers so far. */
export function computePath(questions: Question[], answers: Record<number, JsonValue>): Question[] {
  const path: Question[] = [];
  const visible: Record<number, JsonValue> = {};
  let index: number | null = questions.length > 0 ? 0 : null;
  while (index !== null) {
    const question: Question = questions[index];
    path.push(question);
    if (question.id in answers) visible[question.id] = answers[question.id];
    index = nextIndex(questions, index, visible);
  }
  return path;
}

// ----- Helpers for the builder's logic editor -----

export function hasLogic(question: Question): boolean {
  return question.logic.rules.length > 0 || question.logic.otherwise !== null;
}

/** A starting value for a condition on `source`, so a new rule is valid straight away. */
export function defaultConditionValue(source: Question, operator: LogicOperator): JsonValue {
  if (VALUELESS_OPERATORS.includes(operator)) return null;
  const kind = logicKindOf(source);
  if (kind === "choice") return source.options[0]?.id ?? null;
  if (kind === "boolean") return true;
  if (kind === "number") return 0;
  return "";
}

export function newCondition(source: Question): LogicCondition {
  const operator = OPERATORS[logicKindOf(source)][0];
  return { question_id: source.id, operator, value: defaultConditionValue(source, operator) };
}

/** Problems the editor should flag (the server rejects the same things when saving). */
export function ruleProblems(rule: LogicRule, questions: Question[], hereIndex: number): string[] {
  const problems: string[] = [];
  const position = new Map(questions.map((q, i) => [q.id, i]));
  for (const condition of rule.conditions) {
    const at = position.get(condition.question_id);
    if (at === undefined || at > hereIndex) problems.push("A condition uses a question that is not available here");
  }
  if (rule.jump_to !== "end") {
    const at = position.get(rule.jump_to);
    if (at === undefined || at <= hereIndex) problems.push("Jump to a question further down the form");
  }
  return problems;
}

export function targetProblem(target: JumpTarget | null, questions: Question[], hereIndex: number): string | null {
  if (target === null || target === "end") return null;
  const at = questions.findIndex((q) => q.id === target);
  return at <= hereIndex ? "Jump to a question further down the form" : null;
}

/** After a question is deleted: drop every rule that conditions on it or jumps to it (the server does the same). */
export function pruneReferences(questions: Question[], removedId: number): Question[] {
  return questions.map((question) => {
    const rules = question.logic.rules.filter(
      (rule) => rule.jump_to !== removedId && rule.conditions.every((condition) => condition.question_id !== removedId),
    );
    const otherwise = question.logic.otherwise === removedId ? null : question.logic.otherwise;
    const unchanged = rules.length === question.logic.rules.length && otherwise === question.logic.otherwise;
    return unchanged ? question : { ...question, logic: { rules, otherwise } };
  });
}

/** One short sentence for the settings panel, e.g. `If 3. Rating is less than or equal to 2 → 9. Anything else?`. */
export function describeRule(rule: LogicRule, questions: Question[]): string {
  const label = (id: number): string => {
    const index = questions.findIndex((q) => q.id === id);
    return index === -1 ? "(deleted question)" : `${index + 1}. ${questions[index].title || "Your question here"}`;
  };
  const conditions = rule.conditions.map((condition) => {
    const source = questions.find((q) => q.id === condition.question_id);
    const value =
      !source || VALUELESS_OPERATORS.includes(condition.operator)
        ? ""
        : ` ${logicKindOf(source) === "choice" ? (source.options.find((o) => o.id === condition.value)?.label ?? "?") : formatLogicValue(condition.value)}`;
    return `${label(condition.question_id)} ${OPERATOR_LABELS[condition.operator]}${value}`;
  });
  const joiner = rule.match === "all" ? " and " : " or ";
  const target = rule.jump_to === "end" ? "end of form" : label(rule.jump_to);
  return `If ${conditions.join(joiner)} → ${target}`;
}

function formatLogicValue(value: JsonValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}

export type { LogicConfig };
