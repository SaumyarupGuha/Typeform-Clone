// Mirrors the backend's Pydantic schemas (backend/app/schemas).

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const QUESTION_TYPE_NAMES = [
  "short_text",
  "long_text",
  "multiple_choice",
  "dropdown",
  "email",
  "number",
  "yes_no",
  "rating",
  "file_upload",
] as const;

export type QuestionType = (typeof QUESTION_TYPE_NAMES)[number];

export interface Option {
  id: number;
  label: string;
}

/** The answer to a file_upload question; what the server returns after an upload. */
// A type alias (not an interface) so it is assignable to JsonValue, which answers are stored as.
export type UploadedFile = {
  file_id: number;
  name: string;
  size: number;
};

// ----- Logic jumps -----

export type LogicOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "begins_with"
  | "ends_with"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "is_answered"
  | "is_not_answered";

/** A question id, or "end" for the thank-you screen. */
export type JumpTarget = number | "end";

export interface LogicCondition {
  question_id: number;
  operator: LogicOperator;
  value: JsonValue;
}

export interface LogicRule {
  match: "all" | "any";
  conditions: LogicCondition[];
  jump_to: JumpTarget;
}

export interface LogicConfig {
  rules: LogicRule[];
  /** Where to go when no rule matches; null means the next question. */
  otherwise: JumpTarget | null;
}

export interface Question {
  id: number;
  position: number;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  properties: Record<string, JsonValue>;
  options: Option[];
  deleted: boolean;
  logic: LogicConfig;
}

export interface FormTheme {
  primary: string;
  background: string;
  font: string;
}

export interface WelcomeScreen {
  enabled: boolean;
  title: string;
  button_text: string;
}

export interface ThankYouScreen {
  title: string;
  description: string;
}

export interface FormSettings {
  theme: FormTheme;
  welcome_screen: WelcomeScreen;
  thank_you_screen: ThankYouScreen;
}

export type FormStatus = "draft" | "published";

export interface FormSummary {
  id: number;
  title: string;
  slug: string;
  status: FormStatus;
  response_count: number;
  updated_at: string;
  public_url: string;
}

export interface Form {
  id: number;
  title: string;
  slug: string;
  status: FormStatus;
  settings: FormSettings;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  public_url: string;
  questions: Question[];
}

/** What a respondent receives: no id, status or counts. */
export interface PublicForm {
  title: string;
  slug: string;
  settings: FormSettings;
  questions: Question[];
}

/** Body for PATCH /api/questions/{id}; only the fields present are changed. */
export interface QuestionUpdate {
  title?: string;
  description?: string | null;
  required?: boolean;
  type?: QuestionType;
  properties?: Record<string, JsonValue>;
  options?: { id?: number; label: string }[];
  logic?: LogicConfig;
}

export interface AnswerInput {
  question_id: number;
  value: JsonValue;
}

// ----- Results -----

export type ResponseStatus = "completed" | "partial";
export type ResponseStatusFilter = ResponseStatus | "all";

export interface ResponseRow {
  id: number;
  status: ResponseStatus;
  started_at: string;
  /** null while the response is still partial. */
  submitted_at: string | null;
  /** The furthest question answered: where a partial response stopped. */
  last_question_id: number | null;
  answers: Record<string, JsonValue>;
}

export interface ResponseList {
  items: ResponseRow[];
  total: number;
  page: number;
  limit: number;
  completed_count: number;
  partial_count: number;
  questions: Question[];
}

export interface ResponseDetail {
  id: number;
  status: ResponseStatus;
  started_at: string;
  submitted_at: string | null;
  last_question_id: number | null;
  answers: { question: Question; value: JsonValue }[];
}

export interface QuestionSummary {
  question_id: number;
  title: string;
  type: QuestionType;
  answered: number;
  stats: Record<string, JsonValue>;
}

export interface FunnelStep {
  question_id: number;
  title: string;
  /** Responses (completed or partial) that answered this question. */
  answered: number;
  /** Partial responses whose furthest answer was this question. */
  left_here: number;
}

export interface Summary {
  started: number;
  completed: number;
  partial: number;
  completion_rate: number;
  avg_seconds: number | null;
  /** Partial responses that never answered anything. */
  left_before_first: number;
  funnel: FunnelStep[];
  questions: QuestionSummary[];
}

// ----- Errors -----

/** Shape of every error body the backend returns, under `detail`. */
export interface ApiErrorDetail {
  code: string;
  message: string;
  errors: Record<string, string>;
}
