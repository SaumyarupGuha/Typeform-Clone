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
] as const;

export type QuestionType = (typeof QUESTION_TYPE_NAMES)[number];

export interface Option {
  id: number;
  label: string;
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
}

export interface AnswerInput {
  question_id: number;
  value: JsonValue;
}

// ----- Results -----

export interface ResponseRow {
  id: number;
  submitted_at: string;
  answers: Record<string, JsonValue>;
}

export interface ResponseList {
  items: ResponseRow[];
  total: number;
  page: number;
  limit: number;
  questions: Question[];
}

export interface ResponseDetail {
  id: number;
  started_at: string;
  submitted_at: string;
  answers: { question: Question; value: JsonValue }[];
}

export interface QuestionSummary {
  question_id: number;
  title: string;
  type: QuestionType;
  answered: number;
  stats: Record<string, JsonValue>;
}

export interface Summary {
  started: number;
  completed: number;
  completion_rate: number;
  avg_seconds: number | null;
  questions: QuestionSummary[];
}

// ----- Errors -----

/** Shape of every error body the backend returns, under `detail`. */
export interface ApiErrorDetail {
  code: string;
  message: string;
  errors: Record<string, string>;
}
