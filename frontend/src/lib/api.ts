import type {
  AnswerInput,
  ApiErrorDetail,
  Form,
  FormSettings,
  FormSummary,
  JsonValue,
  PublicForm,
  Question,
  QuestionType,
  QuestionUpdate,
  ResponseDetail,
  ResponseList,
  ResponseStatusFilter,
  Summary,
  ThankYouScreen,
  UploadedFile,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/** Any non-2xx response. `errors` maps question ids (or field names) to messages. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isErrorBody(body: unknown): body is { detail: ApiErrorDetail } {
  if (typeof body !== "object" || body === null || !("detail" in body)) return false;
  const detail = (body as { detail: unknown }).detail;
  return typeof detail === "object" && detail !== null && "code" in detail && "message" in detail;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection.");
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorBody(body)) {
      const { code, message, errors } = body.detail;
      throw new ApiError(response.status, code, message, errors ?? {});
    }
    throw new ApiError(response.status, "unknown_error", `Request failed (${response.status})`);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export interface FormFilters {
  search?: string;
  status?: "draft" | "published";
}

export const api = {
  // ----- Creator: forms -----
  listForms: ({ search, status }: FormFilters = {}) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const query = params.toString();
    return request<FormSummary[]>(`/api/forms${query ? `?${query}` : ""}`);
  },
  createForm: (title: string) => request<Form>("/api/forms", json("POST", { title })),
  getForm: (id: number) => request<Form>(`/api/forms/${id}`),
  updateForm: (id: number, changes: { title?: string; settings?: FormSettings }) =>
    request<Form>(`/api/forms/${id}`, json("PATCH", changes)),
  deleteForm: (id: number) => request<void>(`/api/forms/${id}`, json("DELETE")),
  duplicateForm: (id: number) => request<Form>(`/api/forms/${id}/duplicate`, json("POST")),
  publishForm: (id: number) => request<Form>(`/api/forms/${id}/publish`, json("POST")),
  unpublishForm: (id: number) => request<Form>(`/api/forms/${id}/unpublish`, json("POST")),

  // ----- Creator: questions -----
  addQuestion: (formId: number, type: QuestionType, position?: number) =>
    request<Question>(`/api/forms/${formId}/questions`, json("POST", { type, position })),
  updateQuestion: (id: number, changes: QuestionUpdate) =>
    request<Question>(`/api/questions/${id}`, json("PATCH", changes)),
  deleteQuestion: (id: number) => request<void>(`/api/questions/${id}`, json("DELETE")),
  duplicateQuestion: (id: number) => request<Question>(`/api/questions/${id}/duplicate`, json("POST")),
  reorderQuestions: (formId: number, questionIds: number[]) =>
    request<Question[]>(`/api/forms/${formId}/questions/order`, json("PUT", { question_ids: questionIds })),

  // ----- Creator: results -----
  getSummary: (formId: number) => request<Summary>(`/api/forms/${formId}/summary`),
  listResponses: (formId: number, page: number, limit: number, status: ResponseStatusFilter = "completed") =>
    request<ResponseList>(`/api/forms/${formId}/responses?page=${page}&limit=${limit}&status=${status}`),
  getResponse: (formId: number, responseId: number) =>
    request<ResponseDetail>(`/api/forms/${formId}/responses/${responseId}`),
  deleteResponse: (formId: number, responseId: number) =>
    request<void>(`/api/forms/${formId}/responses/${responseId}`, json("DELETE")),
  csvExportUrl: (formId: number, status: ResponseStatusFilter = "completed") =>
    `${API_URL}/api/forms/${formId}/responses/export.csv?status=${status}`,

  // ----- Public (respondent) -----
  getPublicForm: (slug: string) => request<PublicForm>(`/api/public/forms/${slug}`),
  startResponse: (slug: string, metadata: Record<string, JsonValue> = {}) =>
    request<{ token: string }>(`/api/public/forms/${slug}/responses`, json("POST", { metadata })),
  /** Saves the answers so far (best effort). `keepalive` lets it finish while the tab is closing. */
  saveProgress: (slug: string, token: string, answers: AnswerInput[], keepalive = false) =>
    request<void>(`/api/public/forms/${slug}/responses/${token}/progress`, {
      ...json("PUT", { answers }),
      keepalive,
    }),
  /** Uploads a file for a file question. Uses XMLHttpRequest because fetch cannot report upload progress. */
  uploadFile: (
    slug: string,
    token: string,
    questionId: number,
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<UploadedFile> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `${API_URL}/api/public/forms/${slug}/responses/${token}/files/${questionId}`);
      // The raw file is the body; its name travels in a header (percent-encoded so any name is safe).
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
      xhr.onerror = () => reject(new ApiError(0, "network_error", "Could not reach the server. Check your connection."));
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // not JSON; handled below
        }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body as UploadedFile);
        if (isErrorBody(body)) {
          const { code, message, errors } = body.detail;
          return reject(new ApiError(xhr.status, code, message, errors ?? {}));
        }
        reject(new ApiError(xhr.status, "unknown_error", `Upload failed (${xhr.status})`));
      };
      xhr.send(file);
    }),
  /** The link a form's owner follows to download a respondent's file. */
  fileUrl: (formId: number, fileId: number) => `${API_URL}/api/forms/${formId}/files/${fileId}`,
  submitResponse: (slug: string, token: string, answers: AnswerInput[]) =>
    request<{ thank_you_screen: ThankYouScreen }>(
      `/api/public/forms/${slug}/responses/${token}/submit`,
      json("POST", { answers }),
    ),
};
