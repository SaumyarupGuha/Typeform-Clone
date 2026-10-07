# Typeform Clone — 12-Hour Workplan & Architecture

Oct 6, 2026 · @SG2

## Goal and scope strategy

Ship every Must-Have in 12 hours by building the respondent flow first, then reusing its components as the builder's live preview. The respondent flow and the builder carry most of the evaluation weight, so they get 5 of the 12 hours.

The core trick: one question-type registry on the frontend and one on the backend. Every type (short text, rating, etc.) is defined once with its input component, default settings and validation rule. Builder, preview, respondent flow, validation and results stats all read from it.

| Tier | What | Decision |
| --- | --- | --- |
| P0 Must | Forms CRUD, builder with 8 types, drag reorder, required + description, publish link, one-at-a-time flow with transitions, keyboard nav, progress bar, client + server validation, thank-you screen, responses table, single response view, per-question stats, seed data, deploy, README | Build fully |
| P1 Must (polish) | Live preview, toasts, inline title editing, duplicate, confirm modals, settings placeholders (theme, thank-you screen) | Build, keep simple |
| P2 Cheap bonus | CSV export, completion rate (start + submit tracking), editable thank-you screen text | Build if on schedule; each is about 20 to 30 min |
| P3 Bonus | Basic logic jumps, custom themes, dark mode | Only if 1+ hour remains |
| Placeholder | Integrations, team sharing, payments, file upload, advanced logic | "Coming soon" panels |
| Simplified | Creator authentication | One seeded default creator injected by a backend dependency |

Cut order if you fall behind: P3, then P2, then shrink the results summary to choice counts only. Never cut transitions, keyboard nav or validation.

## Tech stack and key libraries

Pick libraries that remove whole problems (drag and drop, animation, toasts) so the 12 hours go into Typeform fidelity, not plumbing.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 14+ App Router, TypeScript | Required; file-based routes map cleanly to builder, results and public form |
| Styling | Tailwind CSS with design tokens in `tailwind.config.ts` | Fast pixel matching; theme colours become CSS variables for the respondent theme |
| Animation | framer-motion (`AnimatePresence`) | The vertical slide between questions, choice selection blink, error shake |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable | Accessible, keyboard-capable sortable list for the builder sidebar |
| Builder state | Zustand | One store for the form being edited; easy optimistic updates |
| Server state | TanStack Query | Caching and invalidation for forms list and results |
| Toasts | sonner (or react-hot-toast) | Typeform-style bottom toasts in one line of code |
| Icons | lucide-react | Question-type icons and UI glyphs |
| Client validation | zod | Schemas per question type, mirrored on the server |
| API | FastAPI + Uvicorn | Required; automatic OpenAPI docs at `/docs` help the demo |
| ORM | SQLAlchemy 2.0 | Typed models, relationships, cascades |
| Schemas | Pydantic v2 + email-validator | Request/response models and email checks |
| Database | SQLite | Required; one file, mounted on a persistent volume in production |
| Migrations | `Base.metadata.create_all` at startup (Alembic optional) | Saves 30+ min; mention Alembic as the production path |
| Tests | pytest + FastAPI `TestClient` | A handful of tests on validation and submit |
| Hosting | Vercel (frontend), Railway with a volume (backend) | Free tiers; Railway volumes keep the SQLite file across restarts |

For the look: Typeform's typeface is proprietary, so use a close geometric sans (for example Inter) and say so in the README.

## System architecture

Two deployables talk over REST: a Next.js app on Vercel serves both the creator screens and the public form, and a FastAPI service on Railway owns all data in one SQLite file.

&#91;embedded content: system architecture · 2 deployables, 1 database\]

The creator app and the public runner share the question-type registry, so the builder preview and the live form render the same components; the backend mirrors this with its own `question_types` module.

### Request flow for one submit

1. Respondent presses Enter on the last question; the runner validates it with the registry's zod rule.
2. `POST /api/public/forms/{slug}/responses/{token}/submit` with all answers.
3. Router parses the body with Pydantic and calls `response_service.submit`.
4. Service loads the form and questions, runs each type's validator, and opens a transaction.
5. Answers and answer options are inserted; the response is marked completed.
6. 201 returns the thank-you settings; the runner animates to the thank-you screen.

### Repository layout

```text
typeform-clone/
  README.md
  frontend/                 # see Frontend architecture
  backend/
    app/
      main.py               # app factory, CORS, routers, seed-on-empty at startup
      core/config.py        # env settings (DATABASE_URL, FRONTEND_ORIGIN)
      core/database.py      # engine, SessionLocal, FK pragma, get_db
      core/deps.py          # get_current_user -> seeded default creator
      core/errors.py        # NotFound / Conflict / ValidationFailed + handlers
      models/               # user, form, question, question_option, response, answer
      schemas/              # form, question, response, summary (Pydantic)
      routes/               # forms, questions, responses, public
      services/             # form, question, response, summary, export
      question_types/       # base.py + one validator/stats class per type, registry.py
      seed.py
    tests/                  # test_submit_validation.py, test_forms.py
    requirements.txt
    .env.example
```

## Database schema

Seven tables: users, forms, questions, question\_options, responses, answers, answer\_options. Options and answers are normalized so summary stats are plain `GROUP BY` queries and renaming an option never breaks old responses.

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forms (
  id            INTEGER PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'My new form',
  slug          TEXT NOT NULL UNIQUE,          -- 8-char random id used in /to/{slug}
  status        TEXT NOT NULL DEFAULT 'draft'  CHECK (status IN ('draft','published')),
  settings      JSON NOT NULL DEFAULT '{}',    -- theme, welcome screen, thank-you screen
  published_at  DATETIME,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_forms_owner ON forms(owner_id, updated_at);

CREATE TABLE questions (
  id           INTEGER PRIMARY KEY,
  form_id      INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,               -- 0-based order
  type         TEXT NOT NULL CHECK (type IN ('short_text','long_text','multiple_choice',
                 'dropdown','email','number','yes_no','rating')),
  title        TEXT NOT NULL DEFAULT '',
  description  TEXT,
  required     BOOLEAN NOT NULL DEFAULT 0,
  properties   JSON NOT NULL DEFAULT '{}',     -- type-specific config, see below
  deleted_at   DATETIME,                       -- soft delete keeps old answers readable
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_questions_form_pos ON questions(form_id, position);

CREATE TABLE question_options (
  id           INTEGER PRIMARY KEY,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  label        TEXT NOT NULL
);
CREATE INDEX ix_options_question ON question_options(question_id, position);

CREATE TABLE responses (
  id            INTEGER PRIMARY KEY,
  form_id       INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,          -- opaque id given to the respondent
  status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  started_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at  DATETIME,
  metadata      JSON NOT NULL DEFAULT '{}'     -- user agent, referrer
);
CREATE INDEX ix_responses_form ON responses(form_id, status, submitted_at);

CREATE TABLE answers (
  id             INTEGER PRIMARY KEY,
  response_id    INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id),
  text_value     TEXT,     -- short_text, long_text, email
  number_value   REAL,     -- number, rating
  boolean_value  BOOLEAN,  -- yes_no
  UNIQUE (response_id, question_id)
);
CREATE INDEX ix_answers_question ON answers(question_id);

CREATE TABLE answer_options (  -- multiple_choice (1..n) and dropdown (1)
  answer_id  INTEGER NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  option_id  INTEGER NOT NULL REFERENCES question_options(id),
  PRIMARY KEY (answer_id, option_id)
);
CREATE INDEX ix_answer_options_option ON answer_options(option_id);
```

Relationships: a user owns many forms; a form has many questions (ordered) and many responses; a question has many options; a response has one answer per question; an answer links to one or more options.

`questions.properties` per type:

| Type | properties keys |
| --- | --- |
| short\_text | `placeholder`, `max_length` (default 255) |
| long\_text | `placeholder`, `max_length` (default 5000) |
| multiple\_choice | `allow_multiple`, `randomize`, `vertical` |
| dropdown | `placeholder`, `alphabetical` |
| email | `placeholder` |
| number | `min`, `max` |
| yes\_no | none |
| rating | `steps` (3 to 10, default 5), `shape` (star) |

`forms.settings` holds `theme` (`primary`, `background`, `font`), `welcome_screen` (`enabled`, `title`, `button_text`) and `thank_you_screen` (`title`, `description`).

Design decisions to defend in the interview:

- **Typed answer columns, not one JSON blob.** Averages for number and rating, and yes/no counts, are single SQL aggregates.
- **Options as rows.** Stats group by `option_id`, so renaming "Very good" to "Great" keeps historic counts. Deleted options are blocked if answered, or soft-handled the same way as questions.
- **Soft delete for questions.** Deleting a question that has answers sets `deleted_at`; the builder hides it, the responses table still shows its column.
- **`responses.status` + `started_at`.** Creating the response when the respondent starts gives completion rate for free (completed / started).
- **`slug` separate from `id`.** Public URLs never expose sequential ids; matches Typeform's `/to/AbC123xy` style.
- **Foreign keys on.** SQLite needs `PRAGMA foreign_keys=ON` per connection; set it in a SQLAlchemy `connect` event listener.
- **Position, not a linked list.** Reorder rewrites `position` for the whole form in one transaction; forms have tens of questions, so this is cheap and simple.

## Backend API design

REST over JSON with two audiences: creator routes under `/api/forms` (default user injected) and public routes under `/api/public` (no auth, published forms only). Routers stay thin; all rules live in services.

**Layering:** `routes` (HTTP, status codes) → `services` (business rules, transactions) → `models` (SQLAlchemy). `schemas` (Pydantic) define every request and response. `question_types` holds one validator and one stats function per type, used by both submit and summary.

### Creator: forms

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/forms` | ?search, ?status | List: id, title, slug, status, response\_count, updated\_at |
| POST | `/api/forms` | `{title}` | Full form (201) |
| GET | `/api/forms/{id}` |  | Full form with ordered questions and options |
| PATCH | `/api/forms/{id}` | `{title?, settings?}` | Full form (rename, theme, thank-you screen) |
| DELETE | `/api/forms/{id}` |  | 204, cascades questions and responses |
| POST | `/api/forms/{id}/duplicate` |  | New draft form "Copy of …" with copied questions and options, no responses |
| POST | `/api/forms/{id}/publish` |  | Form with status `published` and `public_url`; 422 if it has no questions |
| POST | `/api/forms/{id}/unpublish` |  | Form with status `draft`; public link then returns 404 |

`response_count` comes from one `LEFT JOIN … GROUP BY` subquery on completed responses, not N+1 queries.

### Creator: questions

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/forms/{id}/questions` | `{type, position?}` | New question with type defaults (2 starter options for choice types) |
| PATCH | `/api/questions/{qid}` | `{title?, description?, required?, type?, properties?, options?}` | Updated question |
| DELETE | `/api/questions/{qid}` |  | 204; soft delete if answered |
| PUT | `/api/forms/{id}/questions/order` | `{question_ids: [..]}` | Ordered list; must contain exactly the form's live question ids |
| POST | `/api/questions/{qid}/duplicate` |  | Copy inserted right below |

`options` in PATCH is the full list `[{id?, label}]`. The service diffs it: keeps existing ids, inserts new ones, deletes removed ones, rewrites positions.

### Creator: results

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/forms/{id}/responses?page=&limit=` | Completed responses, newest first, each with answers keyed by question id |
| GET | `/api/forms/{id}/responses/{rid}` | One response with every question and its answer |
| DELETE | `/api/forms/{id}/responses/{rid}` | 204 |
| GET | `/api/forms/{id}/summary` | `{started, completed, completion_rate, avg_seconds, questions:[…stats]}` |
| GET | `/api/forms/{id}/responses/export.csv` | CSV stream, one column per question (bonus) |

Stats per question type: choice and dropdown give counts and percent per option; yes/no gives yes/no counts; rating gives average and count per step; number gives min, max, average; text and email give answered count plus the 5 latest values.

### Public (respondent)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/public/forms/{slug}` |  | Sanitized definition (no owner, no counts); 404 if draft or missing |
| POST | `/api/public/forms/{slug}/responses` | `{metadata?}` | `{token}`; creates an `in_progress` response when the respondent starts |
| POST | `/api/public/forms/{slug}/responses/{token}/submit` | `{answers: [{question_id, value}]}` | 201 with thank-you screen; 422 with per-question errors |

`value` shapes: string for text and email, number for number and rating, boolean for yes/no, list of option ids for multiple choice, single option id for dropdown.

### Server validation (run on submit, inside one transaction)

1. Form exists and is published; token belongs to this form and is still `in_progress` (blocks double submit).
2. Every answered `question_id` is a live question of this form.
3. Every required question has a non-empty value.
4. The type validator passes: email format, number is numeric and inside `min`/`max`, rating is an integer from 1 to `steps`, option ids belong to the question, a single-select has exactly one option, text under `max_length`.
5. On success, insert answers and answer\_options, set status `completed` and `submitted_at`.

Errors use one shape so the frontend can map them to screens:

```json
{"detail": {"code": "validation_error", "message": "Some answers are invalid",
  "errors": {"12": "Please enter a valid email", "15": "This question is required"}}}
```

Cross-cutting: CORS limited to the frontend origin, a `get_current_user` dependency that returns the seeded creator (one place to swap in real auth later), `get_db` session dependency, and a global handler that turns service errors into 404/409/422.

## Frontend architecture

Six routes, one shared question-type registry, and the respondent components reused inside the builder canvas so the live preview is the real thing.

### Routes (App Router)

| Route | Screen | Mirrors Typeform's |
| --- | --- | --- |
| `/` → redirect `/workspace` | Forms list | Workspace dashboard |
| `/forms/[id]/create` | Builder | "Create" tab |
| `/forms/[id]/share` | Public link, copy button, publish state | "Share" tab |
| `/forms/[id]/results` | Summary and Responses sub-tabs | "Results" tab |
| `/forms/[id]/preview` | Full-screen runner on the draft, nothing saved | Preview mode |
| `/to/[slug]` | Public respondent flow, no login | `form.typeform.com/to/…` |

The three `/forms/[id]/*` pages share a `layout.tsx` with the top bar: workspace breadcrumb, inline-editable form title, Create / Share / Results tabs, and the Publish button on the right.

### Folder structure

```text
frontend/src/
  app/
    workspace/page.tsx
    forms/[id]/layout.tsx          # top bar + tabs
    forms/[id]/create/page.tsx
    forms/[id]/share/page.tsx
    forms/[id]/results/page.tsx
    forms/[id]/preview/page.tsx
    to/[slug]/page.tsx             # server component fetches form, renders <FormRunner>
  components/
    ui/            Button, Modal, ConfirmDialog, Toggle, Menu, Tabs, Spinner, ComingSoon
    workspace/     FormCard, FormRowMenu, CreateFormModal, RenameModal
    builder/       BuilderShell, QuestionSidebar, SortableQuestionItem, AddQuestionModal,
                   QuestionCanvas, InlineEditable, SettingsPanel, TypeSettings/*, ThemePanel,
                   ThankYouEditor, SaveIndicator
    runner/        FormRunner, QuestionScreen, WelcomeScreen, ThankYouScreen, ProgressBar,
                   NavArrows, OkButton, ErrorMessage, PoweredBy
    runner/inputs/ ShortText, LongText, MultipleChoice, Dropdown, Email, NumberInput,
                   YesNo, Rating, ChoiceKey
    results/       StatsHeader, QuestionSummaryCard, ChoiceBars, ResponsesTable, ResponseDrawer
  lib/
    api.ts          # typed fetch wrapper, base URL from NEXT_PUBLIC_API_URL
    types.ts        # Form, Question, Option, Response, Answer
    questionTypes.tsx  # THE registry (below)
    validation.ts   # zod schema per type, mirrors server rules
    keyboard.ts     # useHotkeys helpers
  store/
    builderStore.ts # Zustand: form, selectedId, saveState, actions
```

### The question-type registry

One object per type; adding a type means adding one entry.

```ts
export const QUESTION_TYPES: Record<QuestionType, QuestionTypeDef> = {
  rating: {
    label: 'Rating',
    icon: Star,
    color: '#…',               // each type has its own colour chip, as in Typeform
    defaultProperties: { steps: 5, shape: 'star' },
    Input: RatingInput,         // used by runner AND builder canvas
    Settings: RatingSettings,   // right panel controls
    validate: (q, v) => …,      // client rule, same as server
    isEmpty: v => v == null,
  },
  // short_text, long_text, multiple_choice, dropdown, email, number, yes_no
};
```

### State and data flow

- **Workspace and results:** TanStack Query (`useForms`, `useSummary`, `useResponses`); mutations invalidate and fire a toast.
- **Builder:** Zustand store loaded from `GET /api/forms/{id}`. Edits update the store instantly (optimistic), then a debounced (600 ms) PATCH per question. A SaveIndicator shows "Saving…" / "Saved". Reorder and add/delete call the API immediately.
- **Runner:** local `useReducer` with `index`, `direction`, `answers`, `errors`, `status` (`welcome` | `answering` | `submitting` | `done`). Pure client state until submit.

### Matching the Typeform look

Study a free Typeform account for 30 minutes first and screenshot the builder, a live form and results. Details that sell the clone:

- **Runner:** large question text with a small number and arrow before it ("1 →"), description in a lighter tone, answers in the theme colour, text inputs as a single bottom-border line with large type.
- **Choices:** bordered boxes, each with a letter key badge (A, B, C) that fills on select, with a short blink animation before auto-advance.
- **Actions:** an "OK ✓" button with a "press Enter ↵" hint beside it; "Submit" on the last question.
- **Chrome:** a thin progress bar at the top, up/down arrow buttons and a "Powered by" badge at the bottom right.
- **Builder:** colour-coded type icons in the left list, white canvas card in the centre with editable text in place, a right settings panel with the Required toggle on top.
- **Global:** generous whitespace, rounded 4–8 px corners, soft neutral grey surfaces, toasts at the bottom of the screen.

Put colours, radii and font sizes in Tailwind tokens on day one so the whole app stays consistent.

## End-to-end workflows

A form moves through four workflows: the creator manages it in the workspace, builds it, publishes it, respondents fill it, and the creator reads results. Each step below names the UI, the API call and the table it touches.

### 1. Form management (workspace)

1. Workspace loads `GET /api/forms`: cards or rows with title, Draft/Published badge, response count, last updated.
2. **Create:** "Create new form" opens a modal (title, "Start from scratch"; templates/AI as Coming soon) → `POST /api/forms` → redirect to `/forms/{id}/create`.
3. **Rename:** inline on the top bar or via the "…" menu modal → `PATCH /api/forms/{id}` → toast "Form renamed".
4. **Duplicate:** "…" menu → `POST /api/forms/{id}/duplicate` → new draft appears at the top → toast.
5. **Delete:** "…" menu → ConfirmDialog warning that responses are deleted too → `DELETE` → toast with the form name.
6. **Copy link:** shown only for published forms.

### 2. Building a form

1. Builder loads the form into the Zustand store; the first question is selected.
2. **Add:** "+" in the sidebar opens AddQuestionModal, a grid of the 8 colour-coded types (Payment, File upload, etc. greyed with "Coming soon") → `POST /questions` with `position = selected + 1` → new item selected and title focused.
3. **Edit inline:** the canvas renders the question with the runner's own component; title and description are contentEditable fields; choice labels are editable in place, with "Add choice" below → store updates instantly, debounced PATCH saves.
4. **Settings panel:** question type switcher, Required toggle, description toggle, and type settings (multiple selection, randomize, rating steps, number min/max, max characters).
5. **Reorder:** drag a sidebar item (dnd-kit) → store reorders with `arrayMove` → `PUT /questions/order` → on failure, roll back and toast an error.
6. **Delete/duplicate:** hover menu on a sidebar item → API call → toast with the question title.
7. **Form settings:** Theme panel (a few preset themes written to `settings.theme`), Thank-you screen editor (`settings.thank_you_screen`), and Logic, Integrations, Share with team as Coming soon panels.
8. **Preview:** the canvas is always a live preview; a "Preview" button opens `/forms/{id}/preview` to click through the full flow on the draft.

### 3. Publishing and sharing

1. Publish button → `POST /publish` → status `published`, `published_at` set → toast "Your form is live" → navigate to Share tab.
2. Share tab shows `https://<frontend>/to/{slug}` with Copy (toast "Link copied") and Open buttons.
3. Unpublish (in the Publish dropdown) → `POST /unpublish` → the public route shows a "This form is closed" screen.
4. Assumption: edits to a published form go live immediately; the top bar shows "Live" so the creator knows.

### 4. Respondent flow (`/to/[slug]`)

1. Server component fetches `GET /api/public/forms/{slug}`; 404 renders the closed/not-found screen.
2. Welcome screen if enabled, else question 1. On the first interaction the runner calls `POST /responses` and keeps the `token` (this powers completion rate).
3. Each question fills the screen, vertically centred, inside `AnimatePresence`. Going forward the old screen slides up and fades, the new one rises from below (about 400 ms); going back reverses it.
4. **Keyboard:** Enter = OK/next (Shift+Enter = new line in long text); ArrowDown/ArrowUp = next/previous when not typing; letters A–Z pick choices; Y/N for yes/no; digits 1–9 (0 = 10) for rating; Escape closes the dropdown. Focus moves to the new input when the transition ends.
5. **Auto-advance:** single-select choice, dropdown, yes/no and rating advance about 500 ms after a pick, after the selected box blinks.
6. **Client validation on next:** the zod rule for that type runs; on failure, a red message with a warning icon appears under the input, the input shakes, and the screen does not move.
7. **Progress:** the top bar width = answered questions / total questions, animated.
8. **Submit:** the last question shows "Submit" → `POST …/{token}/submit` with all answers. A 422 jumps to the first question with a server error and shows it. Success → ThankYouScreen using `settings.thank_you_screen`.
9. Draft answers are also kept in `sessionStorage` per slug, so a refresh does not lose progress.

### 5. Results

1. **Summary sub-tab:** `GET /summary` → header with Views (started), Submissions, Completion rate, Average time; then one card per question: horizontal percentage bars for choices, dropdown and yes/no; average plus step distribution for rating; min/avg/max for number; latest answers list for text and email.
2. **Responses sub-tab:** `GET /responses` → table with Submitted at plus one column per question, horizontally scrollable, newest first, paginated.
3. **Single response:** clicking a row opens ResponseDrawer from the right with every question and answer in order, plus Previous/Next and Delete (ConfirmDialog → toast).
4. **Export:** "Download CSV" → `export.csv` (bonus).

Empty states everywhere (no forms, no questions, no responses) with a single clear call to action, as Typeform does.

## Seed data, deployment and README

Seed three forms so every screen has something to show on first load, deploy the backend with a persistent volume, and write the README as you go.

### Seed data (`python -m app.seed`, also run at startup when the DB is empty)

| Form | Status | Questions | Responses |
| --- | --- | --- | --- |
| Customer Satisfaction Survey | Published | All 8 types: name, email, rating (5), multiple choice (single), multiple choice (multi), dropdown, yes/no, number, long text | About 40 completed + 8 in progress |
| Event Registration | Published | Short text, email, dropdown (session), number (guests), yes/no (dietary needs), long text | About 15 completed |
| Product Research | Draft | Short text, multiple choice, rating | None |

Generate answers with a fixed `random.seed(42)` and weighted choices so the summary bars look realistic, and spread `submitted_at` over the last 30 days. The seed function is idempotent: `--reset` drops and recreates tables.

### Deployment

| Piece | Where | Settings |
| --- | --- | --- |
| Backend | Railway service from `backend/` | Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; volume mounted at `/data`; `DATABASE_URL=sqlite:////data/typeform.db`; `FRONTEND_ORIGIN=https://<app>.vercel.app` |
| Frontend | Vercel project with root `frontend/` | `NEXT_PUBLIC_API_URL=https://<api>.up.railway.app` |
| Fallback | Render free web service | Disk is not persistent, so auto-seed on startup keeps the demo usable; state this in the README |

Deploy a "hello world" of both at hour 4, not hour 11, so CORS and env problems surface early.

### README outline

1. Live demo link, public form link to try, short GIF of the respondent flow.
2. Tech stack table.
3. Local setup: `cd backend && python -m venv .venv && pip install -r requirements.txt && python -m app.seed && uvicorn app.main:app --reload`; `cd frontend && npm i && npm run dev`; `.env.example` for both.
4. Architecture overview with the diagram from this doc and the folder trees.
5. Database schema: the ER description, the DDL and the design decisions list.
6. API overview: the endpoint tables (link to `/docs` for full OpenAPI).
7. Feature checklist mapped to the assignment, with what is placeholder.
8. Assumptions: single default creator, edits to published forms go live immediately, substitute font, SQLite on a volume, no branching unless bonus done.
9. What I would do next: auth, Alembic, versioned published snapshots, logic jumps, file upload to object storage.

## 12-hour build schedule

Backend first (3.5 h) so the frontend never waits, then the respondent flow (2.5 h) before the builder (2.5 h) because the builder canvas reuses the runner's inputs. If you split it over two days, end day 1 at hour 6 with a working public form.

| Hours | Block | Build | Done when |
| --- | --- | --- | --- |
| 0:00–0:45 | Setup + UI study | Repo with `frontend/` and `backend/`, Next.js + Tailwind scaffold, FastAPI scaffold; sign up for Typeform and screenshot builder, runner, results | Both apps run locally; screenshot folder ready |
| 0:45–2:15 | Backend core | DB engine + FK pragma, 7 models, Pydantic schemas, forms CRUD, duplicate, publish/unpublish, questions CRUD with options diff, reorder | All creator endpoints pass in `/docs` |
| 2:15–3:30 | Backend responses | Public GET, start, submit, `question_types` validators, responses list/detail, summary stats, CSV, seed script, 4–5 pytest cases on submit validation | Seeded DB; summary JSON looks right; tests green |
| 3:30–4:30 | Frontend foundation | Tokens in Tailwind, `api.ts`, `types.ts`, registry skeleton, Toaster, Modal/ConfirmDialog; Workspace page with create/rename/duplicate/delete; deploy hello world to Vercel + Railway | Forms CRUD works from the UI against deployed API |
| 4:30–7:00 | Respondent flow | FormRunner reducer, 8 inputs, AnimatePresence transitions, keyboard hotkeys, auto-advance, progress bar, nav arrows, zod validation + errors, submit + server error mapping, thank-you, closed screen | A seeded form can be completed with only the keyboard, on desktop and phone width |
| 7:00–9:30 | Builder | Top bar + tabs layout, sidebar with dnd-kit, AddQuestionModal, canvas with inline editing via registry inputs, settings panel per type, debounced autosave + SaveIndicator, Publish + Share tab, Preview route | New form built, reordered, published and filled end to end |
| 9:30–10:45 | Results + settings | Summary cards with bars, responses table, ResponseDrawer, delete response, CSV button; Theme and Thank-you panels; Coming soon panels | Seeded results look like Typeform's Results tab |
| 10:45–11:30 | Polish + deploy | Empty states, loading skeletons, transition timing, focus rings, mobile check, redeploy, reseed production | Fresh browser: whole demo works on the live URL |
| 11:30–12:00 | README + final QA | README sections, screenshots/GIF, run the QA checklist, push | Repo public, both links submitted |

Final QA checklist:

- [ ] Create, rename, duplicate, delete a form; toasts show each time
- [ ] Add all 8 types, edit inline, toggle Required, drag to reorder, refresh and order persists
- [ ] Publish, copy link, open in a private window with no login
- [ ] Enter and arrows navigate; letters pick choices; required and email errors block progress
- [ ] Submit with devtools validation bypassed and confirm the server returns 422
- [ ] Thank-you screen shows; response count on the workspace increases
- [ ] Summary counts, responses table and single response view are correct
- [ ] Unpublish and confirm the public link shows the closed screen

## Risks, shortcuts and interview prep

The biggest risks are losing the SQLite file on the host and running out of time on the builder; both have a fallback below.

| Risk | Fallback |
| --- | --- |
| SQLite file wiped on redeploy | Railway volume at `/data`; auto-seed on empty DB as a safety net |
| framer-motion exit animation not firing in App Router | Key the motion element by question id inside `AnimatePresence mode="wait"` in a client component |
| Autosave races (two PATCHes out of order) | Debounce per question, send the whole question each time, ignore stale responses by a counter |
| Reorder leaves gaps or duplicates in `position` | Server rewrites all positions 0..n-1 in one transaction from the id list |
| Hotkeys fire while typing | Ignore letter/arrow hotkeys when focus is in an input or textarea, except Enter |
| CORS or env mismatch at the end | Deploy both at hour 4 and redeploy often |
| Builder runs long | Drop the type switcher and theme presets first; keep inline edit, drag, required, add/delete |
| Pixel fidelity time sink | Polish the runner first, then the builder; results can be cleaner and simpler |

AI-assisted shortcuts that are safe: generate Pydantic schemas from the models, the 8 input components from one well-written example, the seed answer generator, and the README tables. Review each generated file line by line, since you must explain all of it.

Questions to rehearse:

- Why typed answer columns and an `answer_options` join table instead of a JSON `value`?
- How does option renaming keep historic stats correct, and what happens when a question with answers is deleted?
- Walk through a submit request: which checks run, in what order, and in which transaction?
- How is the response count on the workspace computed without N+1 queries?
- How does the registry let one component serve both the builder preview and the respondent flow?
- How do the slide transitions know their direction, and how is focus managed after them?
- How does completion rate work, and what counts as a view?
- What would change for real auth, multiple creators, and versioned published forms?
