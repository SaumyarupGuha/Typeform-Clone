# Typeform Clone

A full-stack clone of [Typeform](https://www.typeform.com): build a form in a drag-and-drop builder, publish it behind a shareable link, collect answers through the signature one-question-at-a-time experience, and read the results.

> Built for a hiring assignment. The original brief is in [`docs/ASSIGNMENT.md`](docs/ASSIGNMENT.md), the plan I followed is [`docs/PLAN.md`](docs/PLAN.md), and a phase-by-phase build log with design decisions is [`docs/PROGRESS.md`](docs/PROGRESS.md).

| | |
| --- | --- |
| **Live app** | _Add your Vercel URL here after deploying (see [Deployment](#deployment))_ |
| **Sample public form** | _`https://<your-app>.vercel.app/to/<slug>`: the seeded "Customer Satisfaction Survey" is a good one to try_ |
| **API docs (Swagger)** | _`https://<your-api>.up.railway.app/docs`_ |

![Workspace](docs/screenshots/workspace.png)

| Builder | Respondent flow |
| --- | --- |
| ![Builder](docs/screenshots/builder.png) | ![Respondent](docs/screenshots/respondent.png) |

| Results: summary | Results: responses |
| --- | --- |
| ![Summary](docs/screenshots/results-summary.png) | ![Responses](docs/screenshots/results-responses.png) |

## Contents

1. [Features](#features) · 2. [Tech stack](#tech-stack) · 3. [Local setup](#local-setup) · 4. [Architecture](#architecture) · 5. [Database schema](#database-schema) · 6. [API overview](#api-overview) · 7. [Feature checklist](#feature-checklist) · 8. [Assumptions](#assumptions) · 9. [Testing](#testing) · 10. [Deployment](#deployment) · 11. [What I would do next](#what-i-would-do-next)

## Features

- **Respondent flow** (`/to/<slug>`, no login): one question at a time, full screen, vertical slide transitions, progress bar, inline errors with a shake, thank-you screen, welcome and "form closed" screens, answers kept across a refresh, and a mobile layout.
- **Keyboard first**: `Enter` or `↓` next, `↑` back, letters pick choices, `Y`/`N` for yes/no, digits for ratings, `Shift+Enter` for a line break; single-choice, dropdown, yes/no and rating auto-advance after a short pause.
- **Builder**: eight question types, inline editing on a live canvas that uses the very same input components as the respondent flow, drag-and-drop reorder (mouse and keyboard), per-question settings, debounced autosave with a "Saving… / Saved" indicator, duplicate and delete, preview.
- **Workspace**: create, rename, duplicate, delete (with confirmation), copy link, search and status tabs.
- **Publishing**: publish and unpublish, shareable link, edits to a published form go live immediately.
- **Results**: completion funnel (views, submissions, completion rate, average time), per-question summaries, a paginated responses table, a response drawer with delete, and CSV export.
- **Settings**: 8 theme presets plus custom colours and font, editable thank-you and welcome screens.
- **Validation twice, one rule set**: the browser (zod) and the server (Python validators) apply the same rules and messages per question type; the server is the authority and answers `422` with per-question errors.
- **Placeholders** ("Coming soon"): logic jumps, integrations and webhooks, team sharing, file-upload and payment question types.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend framework | Next.js 16 (App Router) + TypeScript (strict) | File-based routes map to the builder, results and the public form |
| Styling | Tailwind CSS 4, design tokens in `@theme` | Fast pixel matching; the form theme becomes CSS variables |
| Animation | framer-motion | The vertical slide between questions, drawer, modals, error shake |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible, keyboard-capable sortable list |
| Builder state | Zustand | One store for the form being edited, with optimistic updates |
| Server state | TanStack Query | Caching and invalidation for forms and results |
| Client validation | zod | One schema per question type, mirroring the server |
| Toasts / icons | sonner / lucide-react | |
| Backend | FastAPI + Uvicorn | OpenAPI docs at `/docs` |
| ORM / schemas | SQLAlchemy 2.0, Pydantic v2 (+ email-validator) | Typed models and request/response contracts |
| Database | SQLite | Required; one file, on a volume in production |
| Tests | pytest + FastAPI `TestClient` | 54 tests |
| Hosting | Vercel (frontend), Railway with a volume (backend) | |

The font is **Inter**: Typeform's own typeface is proprietary, so I used the closest free geometric sans. Everything is written from scratch; no code was copied from existing Typeform clones.

## Local setup

You need **Python 3.12+** and **Node 20+**.

**1. Backend** (http://127.0.0.1:8000, docs at `/docs`)

```bash
cd backend
python -m venv .venv
# macOS / Linux:  source .venv/bin/activate        Windows:  .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The first start creates `typeform.db` and seeds it automatically when it is empty: the default creator, two published forms with realistic responses and one draft (see [Seed data](#seed-data)). To reseed by hand: `python -m app.seed --reset`.

**2. Frontend** (http://localhost:3000)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** (not `127.0.0.1:3000`; CORS allows `localhost:3000` by default).

**Environment variables** (both have a `.env.example`)

| File | Variable | Default | Meaning |
| --- | --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | `sqlite:///./typeform.db` | SQLite file; `sqlite:////data/typeform.db` on Railway |
| `backend/.env` | `FRONTEND_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated CORS origins; the first one builds public links |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Base URL of the API |

> Use `127.0.0.1`, not `localhost`, for the API on Windows: Node resolves `localhost` to IPv6 first, where uvicorn is not listening, which breaks server-side fetches.

**Checks**

```bash
cd backend && python -m pytest          # 54 tests
cd frontend && npm run lint && npm run build
```

### Seed data

| Form | Status | Questions | Responses |
| --- | --- | --- | --- |
| Customer Satisfaction Survey | Published | Name, email, rating (5), single choice, multiple choice, dropdown, yes/no, number, long text | 40 completed + 8 in progress |
| Event Registration | Published | Name, email, dropdown, number (guests), yes/no, long text | 15 completed |
| Product Research | Draft | Short text, multiple choice, rating | none |

Answers come from a fixed `random.seed(42)` with weighted choices, spread over the last 30 days, so the summary charts look realistic and are repeatable.

## Architecture

```mermaid
flowchart LR
    subgraph Vercel
      FE[Next.js app<br/>builder · results · public form]
    end
    subgraph Railway
      API[FastAPI service]
      DB[(SQLite on /data volume)]
      API --> DB
    end
    Creator -->|creator screens| FE
    Respondent -->|/to/slug| FE
    FE -->|REST JSON| API
```

**Layering (backend).** `routes` (HTTP and status codes only) → `services` (business rules and transactions) → `models` (SQLAlchemy). `schemas` define every request and response. Routes never contain business logic.

**The question-type registry.** Each type is defined once on each side, and every other part reads from it:

| Frontend `lib/questionTypes.tsx` | Backend `app/question_types/` |
| --- | --- |
| label, icon, colour, default properties | `default_properties`, `has_options` |
| `Input` (used by the runner **and** the builder canvas) | n/a |
| `Settings` (builder settings panel) | `validate_properties` |
| `schema` (zod) and `isEmpty` | `validate` and `is_empty` |
| `Summary` (results view) | `stats` |
| `autoAdvance`, `answerForKey` (keyboard) | `to_columns`, `display_value` |

Adding a type means adding one entry per side. There is no `if type == ...` branching in the routes, services or screens.

**One request, end to end (submit).**

1. The respondent presses Enter on the last question; the runner validates every answer with the registry's zod rules.
2. `POST /api/public/forms/{slug}/responses/{token}/submit`.
3. The router parses the body with Pydantic and calls `response_service.submit_response`.
4. The service loads the published form, checks the token is still `in_progress`, and runs each type's validator, collecting **all** errors.
5. If there are errors: `422` with `{"detail": {"code": "validation_error", "errors": {"<question id>": "message"}}}` and nothing is written.
6. Otherwise answers and `answer_options` rows are inserted and the response becomes `completed` in **one commit**.
7. `201` returns the thank-you screen settings and the runner animates to it. On a `422` it jumps to the first failing question and shows the server's message.

**Builder data flow.** TanStack Query holds the form-level data (title, status, settings). A Zustand store holds the questions being edited. Edits update the store instantly, then a debounced (600 ms) PATCH saves the whole question. Saves run strictly one at a time per question, so an older response can never overwrite a newer one. A failed write shows a toast and reloads from the server as the rollback.

### Repository layout

```text
typeform-clone/
├── README.md
├── docs/                         ASSIGNMENT.md · PLAN.md · PROGRESS.md · typeform-ref/ · screenshots/
├── backend/
│   ├── app/
│   │   ├── main.py               app factory, CORS, routers, create tables and seed on startup
│   │   ├── seed.py               demo data (also `python -m app.seed [--reset]`)
│   │   ├── core/                 config · database (FK pragma) · deps (get_current_user) · errors
│   │   ├── models/               user · form · question (+options) · response · answer (+answer_options)
│   │   ├── schemas/              Pydantic request/response models
│   │   ├── routes/               forms · questions · responses · public
│   │   ├── services/             form · question · response · summary · export
│   │   └── question_types/       one handler per type + registry.py
│   ├── tests/                    forms · submit validation · results · config
│   ├── requirements.txt · railway.json · .env.example
└── frontend/
    └── src/
        ├── app/                  workspace · forms/[id]/(create|share|results) · forms/[id]/preview · to/[slug]
        ├── components/
        │   ├── ui/               Button · Modal · ConfirmDialog · Toggle · Menu · Tabs · Skeleton · ComingSoon
        │   ├── workspace/        FormCard · CreateFormModal · RenameModal · skeleton
        │   ├── forms/            FormShell (top bar) · TitleEditor · PublishControl
        │   ├── builder/          sidebar · canvas · settings panel · TypeSettings/ · panels/ (design, thank-you, welcome)
        │   ├── runner/           FormRunner · reducer · screens · inputs/ (the 8 inputs)
        │   └── results/          summary cards · summaries/ · responses table · drawer
        ├── lib/                  api · types · questionTypes (registry) · validation · keyboard · queries · theme
        └── store/                builderStore (Zustand)
```

## Database schema

Seven tables. Options and answers are normalised so summary stats are plain `GROUP BY` queries and renaming an option never breaks historic responses.

```mermaid
erDiagram
    users ||--o{ forms : owns
    forms ||--o{ questions : has
    forms ||--o{ responses : receives
    questions ||--o{ question_options : offers
    responses ||--o{ answers : contains
    questions ||--o{ answers : "answered by"
    answers ||--o{ answer_options : selects
    question_options ||--o{ answer_options : "chosen as"
```

The DDL below is generated from the SQLAlchemy models (`Base.metadata`), so it is exactly what runs:

```sql
CREATE TABLE users (
  id INTEGER NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME NOT NULL,
  PRIMARY KEY (id), UNIQUE (email)
);

CREATE TABLE forms (
  id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  title TEXT DEFAULT 'My new form' NOT NULL,
  slug TEXT NOT NULL,                              -- 8 random chars, used in /to/{slug}
  status TEXT DEFAULT 'draft' NOT NULL,
  settings JSON DEFAULT '{}' NOT NULL,             -- theme, welcome screen, thank-you screen
  published_at DATETIME, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_forms_status CHECK (status IN ('draft','published')),
  FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (slug)
);
CREATE INDEX ix_forms_owner ON forms (owner_id, updated_at);

CREATE TABLE questions (
  id INTEGER NOT NULL,
  form_id INTEGER NOT NULL,
  position INTEGER NOT NULL,                       -- 0-based order
  type TEXT NOT NULL,
  title TEXT DEFAULT '' NOT NULL, description TEXT,
  required BOOLEAN DEFAULT 0 NOT NULL,
  properties JSON DEFAULT '{}' NOT NULL,           -- type-specific settings
  deleted_at DATETIME,                             -- soft delete keeps old answers readable
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_questions_type CHECK (type IN ('short_text','long_text','multiple_choice','dropdown','email','number','yes_no','rating')),
  FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
);
CREATE INDEX ix_questions_form_pos ON questions (form_id, position);

CREATE TABLE question_options (
  id INTEGER NOT NULL, question_id INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL,
  PRIMARY KEY (id), FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);
CREATE INDEX ix_options_question ON question_options (question_id, position);

CREATE TABLE responses (
  id INTEGER NOT NULL, form_id INTEGER NOT NULL,
  token TEXT NOT NULL,                             -- opaque id given to the respondent
  status TEXT DEFAULT 'in_progress' NOT NULL,
  started_at DATETIME NOT NULL, submitted_at DATETIME,
  metadata JSON DEFAULT '{}' NOT NULL,             -- user agent, etc.
  PRIMARY KEY (id),
  CONSTRAINT ck_responses_status CHECK (status IN ('in_progress','completed')),
  FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE,
  UNIQUE (token)
);
CREATE INDEX ix_responses_form ON responses (form_id, status, submitted_at);

CREATE TABLE answers (
  id INTEGER NOT NULL, response_id INTEGER NOT NULL, question_id INTEGER NOT NULL,
  text_value TEXT,                                 -- short_text, long_text, email
  number_value REAL,                               -- number, rating
  boolean_value BOOLEAN,                           -- yes_no
  PRIMARY KEY (id), UNIQUE (response_id, question_id),
  FOREIGN KEY(response_id) REFERENCES responses (id) ON DELETE CASCADE,
  FOREIGN KEY(question_id) REFERENCES questions (id)
);
CREATE INDEX ix_answers_question ON answers (question_id);

CREATE TABLE answer_options (                      -- multiple_choice (1..n) and dropdown (1)
  answer_id INTEGER NOT NULL, option_id INTEGER NOT NULL,
  PRIMARY KEY (answer_id, option_id),
  FOREIGN KEY(answer_id) REFERENCES answers (id) ON DELETE CASCADE,
  FOREIGN KEY(option_id) REFERENCES question_options (id)
);
CREATE INDEX ix_answer_options_option ON answer_options (option_id);
```

`questions.properties` holds type-specific settings: `placeholder` and `max_length` (text), `allow_multiple` / `randomize` / `vertical` (multiple choice), `placeholder` / `alphabetical` (dropdown), `min` / `max` (number), `steps` and `shape` (rating). `forms.settings` holds `theme` (`primary`, `background`, `font`), `welcome_screen` and `thank_you_screen`.

**Design decisions**

- **Typed answer columns, not one JSON blob.** Averages for number and rating, and yes/no counts, are single SQL aggregates.
- **Options as rows.** Stats group by `option_id`, so renaming "Very good" to "Great" keeps historic counts. Removing an option that has responses is refused (`409`).
- **Soft delete for questions.** Deleting a question that has answers sets `deleted_at`: the builder and public form hide it, while the responses table and CSV still show its column.
- **`responses.status` and `started_at`.** A response is created when the respondent first interacts, so completion rate (completed / started) comes for free. Answers are only written on a successful submit.
- **`slug` separate from `id`.** Public URLs never expose sequential ids.
- **Foreign keys on.** SQLite needs `PRAGMA foreign_keys=ON` per connection; it is set in a SQLAlchemy `connect` listener, so `ON DELETE CASCADE` really cascades. Form and response deletes are single bulk `DELETE` statements so the database does the cascading.
- **Position, not a linked list.** Reorder rewrites `position` for the whole form in one transaction.
- **Timestamps** are stored as naive UTC and serialised with an explicit `+00:00`.

## API overview

Interactive docs live at `/docs`. Every error uses one shape: `{"detail": {"code", "message", "errors": {<question id or field>: message}}}`.

**Forms** (creator; a default user is injected by `get_current_user`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/forms?search=&status=` | List with `response_count` (one grouped query, no N+1) |
| POST | `/api/forms` | Create (201) |
| GET / PATCH / DELETE | `/api/forms/{id}` | Read, rename or update settings, delete (cascades) |
| POST | `/api/forms/{id}/duplicate` | Copy of the form, questions and options |
| POST | `/api/forms/{id}/publish` · `/unpublish` | Publish (422 if no questions) or take offline |

**Questions**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/forms/{id}/questions` | Add at a position; type defaults and starter options |
| PATCH | `/api/questions/{qid}` | Edit; `options` is diffed (keep, rename, add, delete) |
| DELETE | `/api/questions/{qid}` | Hard delete, or soft delete if it has answers |
| POST | `/api/questions/{qid}/duplicate` | Copy inserted below |
| PUT | `/api/forms/{id}/questions/order` | Reorder; must list every live question exactly once |

**Results**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/forms/{id}/responses?page=&limit=` | Completed responses, newest first, plus the table's columns |
| GET / DELETE | `/api/forms/{id}/responses/{rid}` | One response with every question and answer, or delete it |
| GET | `/api/forms/{id}/summary` | Views, submissions, completion rate, average time, per-question stats |
| GET | `/api/forms/{id}/responses/export.csv` | CSV (formula-injection safe) |

**Public** (no auth; published forms only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/forms/{slug}` | Sanitised definition; 404 for drafts |
| POST | `/api/public/forms/{slug}/responses` | Start a response, returns a `token` |
| POST | `/api/public/forms/{slug}/responses/{token}/submit` | Validate and store; `422` with per-question errors |

**Server validation** (on submit, in one transaction): the form is published; the token belongs to the form and is still `in_progress` (blocks double submit); every answered question is a live question of the form; required questions are non-empty; and the type's validator passes (email syntax, numeric range, integer rating within `steps`, option ids belonging to the question, single-select has exactly one option, text under `max_length`).

## Feature checklist

| Assignment requirement | Status |
| --- | --- |
| Form builder: title, ordered questions, add / edit / reorder (drag and drop) / delete | Done |
| 8 question types, required toggle, description, live preview | Done |
| Form management: list with status and response count, create / rename / duplicate / delete | Done |
| Publish and unpublish, shareable link, persistence | Done |
| One question at a time, full screen, smooth transitions, keyboard navigation, progress | Done |
| Client and server validation, submit stores the response, thank-you screen, no login | Done |
| Responses table, individual response view, per-question summary stats | Done |
| Typeform look and feel, modals, inline editing, toasts, settings placeholders | Done |
| Seed data: published forms with responses | Done |
| Bonus: CSV export, completion rate (views vs submissions, with in-progress responses tracked), custom themes | Done |
| Bonus: dark theme | Partial: the "Inky Black" and "Midnight" form themes; the creator app has no dark mode |
| Bonus: logic jumps, file upload | Not done: "Coming soon" placeholders (as the brief allows) |
| Placeholders: integrations, team sharing, payments, file upload, advanced logic | "Coming soon" panels |
| Real creator authentication | Simplified: one seeded default creator behind `get_current_user` |

## Assumptions

- **A single default creator.** There is no sign-up or login; the seeded creator is injected by one dependency (`get_current_user`), the single place to swap in real auth.
- **Edits to a published form go live immediately** (there are no versioned snapshots); the top bar shows "Live" so the creator knows.
- **A "view" is a started response**, created when the respondent first interacts, not at page load.
- **Progress** is questions passed divided by total, as in Typeform; skipping an optional question still moves it.
- **Option and type changes are protected.** Removing an answered option, or changing the type of an answered question, returns `409`, since mixed historic data would be meaningless.
- **Substitute font.** Inter instead of Typeform's proprietary typeface.
- **Tables are created with `create_all`** at startup (no Alembic), as the plan allows.
- **SQLite on a volume.** One writer is enough for this scale; see below for what would change.

## Testing

- **Backend:** `cd backend && python -m pytest` runs 54 tests: form CRUD and cascades, the options diff, reorder, soft delete, submit validation for every question type (including 422 shape and "nothing saved on error"), double submit, summary statistics, CSV safety, the seed, and configuration.
- **Frontend:** `npm run lint` and `npm run build` must be clean (zero errors).
- **End to end:** each phase was also verified in real Chrome with Playwright (respondent flow, builder, results, settings, responsive sweep at 390, 768 and 1440 px). Those scripts were run from outside the repository so the project carries no extra dependency.

## Deployment

**Backend on Railway** (with a volume so the SQLite file survives redeploys)

1. New project → deploy from this repo, **root directory `backend/`**. `railway.json` sets the start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and the `/health` check.
2. Add a **volume** mounted at `/data`.
3. Set variables: `DATABASE_URL=sqlite:////data/typeform.db` and `FRONTEND_ORIGIN=https://<your-app>.vercel.app` (comma-separate extra origins, such as a preview URL).
4. Deploy. On first start the app creates the folder and tables and seeds the demo data. The seed runs only when the database is empty, so redeploys keep real data.

**Frontend on Vercel**

1. Import the repo, set the **root directory to `frontend/`** (framework: Next.js).
2. Set `NEXT_PUBLIC_API_URL=https://<your-api>.up.railway.app`.
3. Deploy, then put the Vercel URL into the Railway `FRONTEND_ORIGIN` and redeploy the backend (CORS and public links use it).

**Fallback:** a Render free web service also works, but its disk is not persistent. The seed-on-empty startup keeps the demo usable after each restart, but data created in the app is lost, so say so in the demo.

## What I would do next

- **Real authentication and multiple creators**: replace `get_current_user`, add per-owner scoping of every query (already filtered by `owner_id`), and workspaces.
- **Alembic migrations** instead of `create_all`, and Postgres for concurrent writers.
- **Versioned published snapshots**, so editing a live form does not change what is being answered mid-session.
- **Logic jumps** (conditional branching) and recall (`@field`) in question text.
- **File-upload questions** with object storage, and webhooks/integrations on submit.
- **Partial-answer capture** (saving answers as they are given) for richer drop-off analytics, and per-question drop-off charts.
- **Dark mode** for the creator app and a custom-domain share option.
