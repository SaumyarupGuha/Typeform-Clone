# Progress log

## Phase 1: Backend

### What was built
`backend/` is a complete FastAPI service.

- **Core** (`app/core`): env config, SQLAlchemy engine with the `PRAGMA foreign_keys=ON` connect listener, `get_db`, `get_current_user` (the single seeded creator), and error classes plus handlers.
- **Models** (`app/models`): the 7 tables from PLAN.md with the same columns, CHECK constraints, indexes and `ON DELETE CASCADE`.
- **Question types** (`app/question_types`): one handler class per type. Each owns validation, mapping to answer columns, display value, default properties and summary stats. `registry.py` is the only place that lists them.
- **Schemas** (`app/schemas`): Pydantic request and response models.
- **Services** (`app/services`):
  - forms: CRUD, duplicate, publish
  - questions: add at position, options diff, reorder, soft delete
  - responses: start, submit, list, detail, delete
  - summary
  - CSV export
- **Routes** (`app/routes`): thin HTTP layer. Creator forms and questions, results, and public endpoints, with the paths from PLAN.md.
- **Seed** (`app/seed.py`): `python -m app.seed [--reset]`. Also runs on startup when there are no users.
- **Tests**: 52 pytest cases covering form CRUD, question operations, submit validation, results and stats, CSV, and the seed.

### Key design decisions
- **One error shape everywhere.** Domain errors and FastAPI's own body or query validation errors all return `{"detail": {"code", "message", "errors"}}`. The frontend needs only one parser.
- **Submit is validate-then-write.** All answers are checked first and every error is collected at once. Only if there are none do we insert answers and mark the response completed, in a single commit. A failed submit leaves the response `in_progress`, so the respondent can fix it and retry with the same token.
- **Answers are stored only for non-empty values.** An optional question that was skipped has no row. `False` and `0` count as answers.
- **Display values.** The results API returns choice answers as option labels, not ids. Renaming an option therefore updates old responses, while the stored link is still the option id.
- **Bulk DELETE for forms and responses.** The database cascades through the whole tree in one statement. Going through the ORM would delete questions before the answers that reference them.
- **Changing the type of a question that has responses returns 409.** Removing an option that has responses also returns 409, since mixed historic data would be meaningless. This is the "blocked if answered" option from the PLAN.
- **Soft-deleted questions** (those with answers) disappear from the builder and the public form. They stay as extra columns in the responses table and CSV, flagged `deleted: true`.
- **Timestamps** are stored as naive UTC and serialized with an explicit `+00:00` so browsers parse them correctly.
- **CSV cells** starting with `= + - @` are prefixed with `'` to prevent spreadsheet formula injection. Numeric cells are left alone.
- **Properties are validated** per type on PATCH (rating steps 3-10, number min <= max, max_length >= 1). Unknown keys are dropped.

### PLAN deviations and ambiguities
- The PLAN's `value` for a single-select `multiple_choice` is an id list. Validation requires exactly one id unless `allow_multiple` is on.
- Extra response fields beyond the PLAN: `public_url` on forms, `deleted` on questions, and `questions` (the table columns) in the responses list.
- No Alembic. Tables are created with `create_all` at startup, as the PLAN allows.
- The seed produces 40 + 15 completed and 8 in-progress responses. In-progress responses carry no answers, because answers are only written on submit.

### How to test manually
```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m pytest                                    # 52 tests
.venv\Scripts\python -m app.seed --reset                          # optional; also automatic on an empty DB
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/docs. Try:
- `GET /api/forms`, then `GET /api/forms/1/summary` and `GET /api/forms/1/responses/export.csv`.
- Take a published form's slug, then `POST /api/public/forms/{slug}/responses` to get a token.
- `POST .../responses/{token}/submit` with an invalid email to see the 422 shape.

### Deferred
Nothing in phase 1 is stubbed. The following depend on later phases: respondent UI, builder UI, results UI, deployment files and the README.

## Phase 2: Frontend foundation and Workspace

### What was built
`frontend/` is Next.js 16 (App Router) + TypeScript (strict) + Tailwind 4, plus framer-motion, @dnd-kit, Zustand, TanStack Query, sonner, lucide-react and zod. Zustand, dnd-kit and zod are installed but first used in later phases.

- **Design tokens** (`src/app/globals.css`, `@theme`): neutrals, charcoal action colour, green CTA, per-type chip colours, radii, shadows and the `shake` keyframes. They were taken from the reference screenshots: white page, `#F6F6F6` rounded panels, charcoal buttons, pastel type chips. Inter is the substitute font.
- **`lib/types.ts`**: TypeScript mirror of every backend schema.
- **`lib/api.ts`**: a typed fetch wrapper with one `ApiError` (status, code, message, per-question `errors`) and the full API surface. Questions, results and public calls are included now, so later phases only consume them.
- **`lib/questionTypes.tsx`**: the registry skeleton. It currently holds label, icon, chip colour, default properties, `hasOptions` and `isEmpty` for the 8 types, plus the Coming soon types (File Upload, Payment).
- **`components/ui/`**: Button, Modal (portal, Escape, focus trap and focus restore), ConfirmDialog, Toggle, Menu, Tabs, Spinner, ComingSoon. All are hand-written; no Radix or other UI library was added.
- **Toaster**: sonner at the bottom centre, in the dark Typeform style (`components/Providers.tsx`).
- **Workspace** (`/workspace`; `/` redirects there):
  - Create (modal), rename, duplicate, delete (confirm dialog), copy link (published forms only).
  - Status tabs, debounced search, loading, error and empty states.
  - Each action shows a toast.

### Key design decisions
- **Tailwind 4**, which `create-next-app` installs now, has no `tailwind.config.ts`. The same design tokens live in `@theme`, and each token becomes a utility (`bg-surface`, `rounded-panel`, ...).
- **Mutations share one hook** (`useFormMutation` in `lib/queries.ts`): call the API, invalidate the forms list, toast on success or error. Components contain no fetch logic.
- **Modal forms are their own inner components**, so their input state resets every time the modal opens.
- **The registry is metadata-only for now.** `Input`, `Settings` and `validate` are added when the runner (phase 3) and builder (phase 4) need them. That keeps the registry the single place a type is defined.

### Deviations / notes
- Tailwind 4 and Next 16 instead of the PLAN's `tailwind.config.ts` and "Next 14+".
- The workspace uses list rows instead of thumbnail cards. The PLAN allows "cards or rows".
- Clicking a form goes to `/forms/{id}/create`, which is built in phase 4. It returns 404 until then.
- `npm install` on this machine was very slow (about 6 minutes per large tarball) and needed extended fetch timeouts. This is a network issue, not a project one.

### How to test manually
```powershell
# terminal 1
cd backend; .venv\Scripts\python -m uvicorn app.main:app --port 8000
# terminal 2
cd frontend; npm install; npm run dev     # http://localhost:3000
```
1. `/` redirects to `/workspace`, which shows the 3 seeded forms. Check the Live/Draft badges and response counts (40, 15, 0).
2. Create a form (modal), rename it, duplicate it, copy its link (published forms only) and delete it. Each shows a toast, and delete asks for confirmation.
3. Try the search box and the All/Published/Drafts tabs.
4. Stop the backend and reload. The error state appears with a "Try again" button.

### Verification
`npm run lint` and `npm run build` pass with zero errors. A smoke test against the production build and the API checked:
- `/workspace` returns 200 and renders the heading.
- `/` redirects (307).
- CORS from `localhost:3000` works.
- Create, duplicate and delete API calls work.

Clicking through the UI in a browser was not automated here.

### Deferred
Respondent flow (phase 3), builder (phase 4) and results (phase 5). `README.md` inside `frontend/` is still the scaffold's and is replaced in phase 6.

## Phase 3: Respondent flow (`/to/[slug]`)

### What was built
- **Route:** `app/to/[slug]/page.tsx` is a server component. It fetches the public form (`cache()` shares one request with `generateMetadata`), shows the closed screen for a 404 (draft, unpublished or missing), and has an `error.tsx` retry screen.
- **`FormRunner`** (`components/runner/`):
  - State is a `useReducer` over a pure reducer (`runnerReducer.ts`). Statuses are `welcome | answering | submitting | done | closed`, plus `direction`, `answers`, `errors` and an `errorTick`.
  - Validation, payload building and progress live in `runnerLogic.ts`.
  - The HTTP side lives in `useResponseSession.ts`.
- **Screens and chrome:**
  - `Screen`, `QuestionScreen`, `WelcomeScreen`, `ThankYouScreen`, `ClosedScreen`.
  - `ProgressBar`, `NavArrows`, `OkButton`, `ErrorMessage`, `PoweredBy`.
- **8 inputs** (`components/runner/inputs/`): ShortText, LongText, Email, NumberInput, MultipleChoice (single and multi), Dropdown (a typeahead combobox), YesNo, Rating, plus the shared `ChoiceKey` letter box.
- **Registry** (`lib/questionTypes.tsx`) now carries `Input`, `schema`, `autoAdvance` and `answerForKey` per type, and exports `validateAnswer`.
- **Client validation** (`lib/validation.ts`): one zod schema per type. Messages are identical to the server's.
- **Supporting libs:**
  - `keyboard.ts` (document-level hotkeys).
  - `options.ts` (shared option order, letters and a seeded shuffle).
  - `theme.ts` (theme to CSS variables, readable text colour).
  - `draft.ts` (sessionStorage draft).
- **Behaviour:**
  - **Navigation:** one question at a time. Screens slide vertically (400 ms, popLayout) and reverse when going back.
  - **Keyboard:**
    - Enter and ArrowDown go next.
    - ArrowUp goes back.
    - Letters pick choices (toggle on multi-select).
    - Y/N answer yes/no.
    - Digits answer ratings (0 = 10).
    - Shift+Enter is a line break in long text.
  - **Auto-advance:** single-select, dropdown, yes/no and rating advance 500 ms after the pick, with a blink.
  - **Errors:** failed validation shows an inline error with a warning icon and a shake, and does not move.
  - **Submit:** a 422 jumps to the first failing question and shows the server's message.
  - **Other states:** thank-you screen, closed screen (including a form that closes mid-session), `sessionStorage` draft restore, and a mobile layout (`h-dvh`, hints hidden on small screens).

### Key design decisions
- **Hotkeys:**
  - One document listener handles every key. Inputs that need Enter (the dropdown) call `preventDefault()`, and the listener skips defaulted events.
  - Letters and arrows are ignored while typing in a field. Enter always advances.
  - Buttons marked `data-runner-action` keep native Enter behaviour.
- **Navigation lock** of 450 ms stops a held key or a double Enter from skipping questions during a slide.
- **Response starts on first interaction.** `ensureStarted` shares one in-flight promise, so rapid keystrokes create exactly one response row. This is what powers completion rate. The token is saved in the draft, so a refresh continues the same response. A stale token (404) is replaced once automatically.
- **The runner renders only in the browser.** The draft lives in sessionStorage, so the server sends a themed backdrop and the browser mounts the runner. This avoids hydration mismatches.
- **One component per type serves runner and builder.** Inputs only take `{question, value, onChange}`. `orderedOptions(question, shuffle)` takes `shuffle=false` for the builder.
- **Theme via CSS variables** (`--r-bg`, `--r-fg`, `--r-accent`). Text colour is computed from the background for contrast.
- **Default theme changed to "Pearl White"** (primary `#262627`, background `#FAFAFA`) to match the reference screenshots. This is a backend schema default and affects only forms without saved theme settings.
- **API default URL is `127.0.0.1:8000`**, not `localhost`. Node resolves `localhost` to IPv6 `::1`, where uvicorn does not listen, which would break server-side fetches.

### Deviations / notes
- **Progress bar** is `questions passed / total`, not "answered / total". Skipping an optional question still moves it. This is Typeform's behaviour.
- **Submit hint** says "press Enter". Typeform shows Ctrl+Enter for long text. Ours uses Enter, with Shift+Enter for line breaks, as in PLAN.md.
- **"Create your own form"** on the thank-you screen links to `/workspace`.
- `FormRunner` already accepts `preview`, which sends nothing and saves nothing. The builder's Preview route in phase 4 will use it.

### How to test manually
1. Start the backend and frontend as in phase 2. Open a published form from the workspace ("Copy link") or `http://localhost:3000/to/<slug>`.
2. Complete the **Customer Satisfaction Survey** using only the keyboard:
   - **Required fields:** press Enter on an empty name (shake and error). Enter a bad email (error).
   - **Auto-advance:** press `4` for the rating, then `b` for the choice. Both advance on their own.
   - **Multi-select:** press `a` and `c`, then Enter.
   - **Dropdown:** type "Pro" and press Enter.
   - **Yes/No:** press `y`.
   - **Number:** enter text (error), then a number.
   - **Long text:** Shift+Enter makes a newline; Enter submits.
   - **Result:** the thank-you screen appears, and the workspace count goes up by 1.
3. Press ArrowUp/ArrowDown outside a field, use the on-screen arrows, then refresh mid-way to confirm the draft is restored.
4. Open the draft form's link (Product Research) to see the closed screen.
5. Shrink the window to phone width.

### Verification
- `npm run lint` and `npm run build` pass with zero errors; backend pytest still 52/52.
- **End-to-end in real Chrome** (Playwright, scripts kept outside the repo to avoid a new dependency): 23/23 checks pass.
  - one question on screen
  - focus moves into the field after the slide
  - required, email and number errors
  - rating digit, letter key, multi-select and dropdown flows
  - ArrowUp/ArrowDown with answers kept
  - Shift+Enter
  - progress 100% and the thank-you screen
  - the response count rising 40 to 41
  - draft restore after reload
  - closed screen for a draft form
  - no horizontal overflow at 390 px
  - zero console errors
- A second test intercepts the submit call and returns a 422. The runner jumps back to the failing question and shows the server's message.
- Screenshots were reviewed against the reference: choice boxes with letter badges, outline stars with numbers, the OK button with the Enter hint, nav arrows and the "Powered by" pill.

### Deferred
- The slide animation's smoothness is judged visually only. There is no automated frame check.
- Builder, results and settings screens (phases 4 and 5).
- No dark-mode toggle for respondents. The theme background and primary colour already switch text colours automatically.

## Phase 4: Builder

### What was built
- **Routes** (all under `app/forms/[id]/`):
  - The group `(shell)` shares one layout with the top bar and holds `create` (builder), `share` and `results`.
  - `preview` sits outside the group so it is full screen with no top bar.
- **Top bar** (`components/forms/`): breadcrumb back to the workspace, an inline-editable title (Enter or blur saves, Escape cancels), Create/Share/Results tabs, a save indicator, Preview, and Publish.
  - Once published, the Publish button becomes a green "Live" menu: Copy link, Open form, Unpublish.
  - Preview and Publish save pending edits first.
- **Builder** (`components/builder/`):
  - **Sidebar:** drag-and-drop reorder with dnd-kit. Only the grip handle starts a drag, so clicks and the row menu stay normal clicks. Keyboard drag works (Space, arrows, Space). Each row has a Duplicate/Delete menu.
  - **AddQuestionModal:** grouped, searchable, with colour-coded types. File Upload and Payment are greyed with a "Coming soon" badge.
  - **Canvas:** the selected question drawn in the form's theme. Title and description are inline-editable. The answer area is the same `Input` component the respondent uses. Choice labels are edited in place, with "Add choice" and remove. For a dropdown the closed dropdown is shown with its options editable below.
  - **Settings panel:**
    - A type switcher, Required and Description toggles.
    - Per-type settings, via the registry's new `Settings` entry:
      - placeholder, max characters
      - multiple selection, randomize, alignment
      - alphabetical order
      - number min/max
      - rating steps
- **Autosave** (`store/builderStore.ts`, Zustand):
  - Edits update the screen instantly and are saved after a 600 ms pause, one PATCH with the whole question.
  - Saves run strictly one at a time per question, with a queued re-save if edited meanwhile, so an older response can never overwrite a newer one. This resolves the PLAN's "out-of-order PATCH" risk with ordering instead of a counter.
  - Any failed write shows a toast and reloads the form from the server as the rollback.
  - Reorder is optimistic with the same rollback.
- **Share page:** link, Copy, Open, and Publish or Unpublish. The embed options are Coming soon.
- **Preview page:** `FormRunner` in `preview` mode with a floating Close and Restart pill. It always fetches fresh data and sends nothing.
- **Registry** gained `Settings` per type. Added types, hooks and helpers: `useForm`, publish/unpublish/rename hooks that write the server's answer into the query cache, `useFormId`.

### Key design decisions
- **Server data vs editing state.** TanStack Query holds form-level data (title, status, settings). The Zustand store holds the questions being edited, loaded once per form. After that the store is the source of truth.
- **Reuse, not duplication.** The canvas imports the runner's `Input`. The only builder-specific hook into it is the optional `editing` prop on choice inputs. A creator can also click and type in the preview, which is never saved.
- **Temporary option ids.** New options get negative client ids and are sent without an id, so the server creates them. The server's real ids are adopted once the save finishes and nothing newer is waiting.
- **Description toggle** is `null` = off, `""` = on but empty. An empty description is stored as null, so a toggled-on empty description turns off after a reload.
- **Crossed number range** (min > max) is never sent. The panel shows a message instead of letting the server reject it.
- **Custom vertical-axis drag modifier** (one line) instead of adding `@dnd-kit/modifiers`.

### Deviations / notes
- **Results route is a temporary placeholder** ("Coming soon") so the tab resolves. Phase 5 replaces it with the real Summary and Responses views.
- **The sidebar has no Welcome/Ending entries yet.** The Thank-you screen and Theme panels arrive in phase 5.
- **Deleting a question** deletes immediately with a toast (no confirm dialog), as in PLAN's workflow. If it has responses, the server soft-deletes it.
- **Changing the type** of a question that already has responses, or removing an answered option, returns 409 and shows the server's message.

### How to test manually
1. Start the backend and frontend. In the workspace, click "Create new form"; you land in the builder.
2. Add questions with "Add your first question" and the + in the sidebar. The title is focused automatically. Try all 8 types, search in the modal, and note the greyed Coming soon items.
3. Edit inline: the title, the description (settings toggle), choice labels, "Add choice" and the remove X. Toggle Required. Watch "Saving…" turn into "Saved" in the top bar.
4. Reorder by dragging the grip handle, or focus it and use Space, ↑/↓, Space. Reload to confirm order and content persisted.
5. Use the type switcher in the settings panel and the sidebar row menu (Duplicate, Delete).
6. Rename the form in the top bar.
7. Click Preview to run through the draft. Close returns to the builder.
8. Click Publish. You land on Share with the link. Open the link in a private window and answer it. Unpublish, then reload the link to see the closed screen.

### Verification
- `npm run lint` and `npm run build` pass with zero errors; backend pytest still 52/52.
- **End-to-end in real Chrome:** 27/27 checks pass.
  - creating a form and the empty state
  - adding all 8 types and focusing the new title
  - autosave Saving then Saved, with database checks
  - choice edits and settings persisting
  - the crossed-range message
  - keyboard and mouse drag reorder persisting
  - type switch, duplicate, delete, inline rename, and reload
  - preview, publish with the Share link, the public form rendering, and the closed screen after unpublish
  - zero console errors
- The E2E run found two real issues, both fixed: the crossed-range message never showed, and the default API URL needed `127.0.0.1`. Keyboard drag only needs human-paced key presses, which is how dnd-kit is designed.

### Deferred
Summary, Responses, CSV, Theme and Thank-you panels (phase 5); polish, deployment files and the README (phase 6).

## Phase 5: Results and settings

### What was built
- **Results page** (`/forms/[id]/results`, `components/results/`), with a **Summary** and a **Responses** sub-tab and a **Download CSV** button.
  - **Summary:**
    - A stats header (Views, Submissions, Completion rate, Average time) and one card per question.
    - Each card is drawn by the type's own `Summary` component, which is a new registry entry per type.
    - Choice, dropdown and yes/no show percentage bars; rating shows the average plus a distribution; number shows min, average and max; text and email show the latest answers.
  - **Responses table:**
    - Newest first, 20 per page, with Previous/Next and a "1-20 of 40" label.
    - It scrolls sideways with a sticky first column.
    - It has one column per question, including soft-deleted questions that still have answers, marked "(deleted question)".
  - **Response drawer:**
    - Opens on a row click or Enter. It slides in from the right.
    - It shows every question with its answer, has Previous/Next, and Delete with a confirmation.
    - After a delete it moves to the neighbouring response, or closes.
    - Escape closes it.
  - **CSV:** a plain link to the backend endpoint, which responds with `Content-Disposition: attachment`.
- **Form-level settings panels.** These are new entries in the builder sidebar, below the question list. They replace the centre canvas, and the right column hides while one is open.
  - **Design (theme):** 8 preset themes drawn like Typeform's gallery, plus custom background and button colours and a font, with a live sample.
  - **Thank-you screen:** title and description, with a preview.
  - **Welcome screen:** an enable toggle, title and button text. The runner already supported it.
  - **Logic jumps, Integrations, Share with team:** "Coming soon" panels.
- **Autosave for settings** (`useAutosavedSettings`): changes show instantly, are saved after a 600 ms pause, and any pending change is sent when the panel is left. The hook lives in `BuilderShell`, so the canvas picks up theme changes immediately.
- **Modal** gained `placement="right"` for the drawer.
- **Registry** gained `Summary` per type. The Results code has no per-type branching.

### Key design decisions
- **The Summary tab uses titles and types from the summary response itself** (`question_id`, `title`, `type`), not the cached form. The cached form's questions can be stale after builder edits. This bug was found while writing the code. A test now checks that an edited title appears in Summary.
- **The builder now loads a form fresh** the first time it is opened, after flushing any pending saves from another form. Before, it could load a stale cache and lose edits made earlier in the session.
- **Results queries use `staleTime: 0`**, so each visit refetches. `keepPreviousData` keeps the old page visible while the next one loads.
- **Delete moves to the neighbouring response**, so a reviewer can clear several responses without reopening the drawer.
- **Theme presets are plain data** (`lib/themePresets.ts`). Fonts are limited to ones that need no download: Inter plus system fonts.

### Deviations / notes
- **Sub-tab state** (Summary/Responses) is local and not in the URL, so a refresh returns to Summary.
- **Previous/Next in the drawer** moves within the current page only, not across pages.
- **Welcome screen** was not strictly required by the phase list, but was cheap because the runner and schema already supported it.
- **Dev-environment gotcha:** on Windows, killing uvicorn can leave an orphaned worker process holding the SQLite file, which then cannot be deleted. Stop the whole process tree, or the worker whose parent is the dead uvicorn.

### How to test manually
1. Open **Customer Satisfaction Survey**, then the **Results** tab.
   - **Summary:** the stats header should read 48 / 40 / 83.3% / about 3m 42s, followed by a card per question with bars, ratings, number stats and latest answers.
   - **Responses:** click a row to open the drawer. Use Previous/Next, then Delete (confirm). The counts drop by one in both tabs and in the workspace.
   - Download the CSV and open it in a spreadsheet.
2. Open **Event Registration** (or any form) in the builder and use the sidebar sections:
   - **Design:** pick a theme or colours. Open the form's public link to see it applied.
   - **Thank-you screen** and **Welcome screen:** edit the text, then submit or open the public form to see them.
   - **Logic jumps, Integrations, Share with team:** each shows "Coming soon".
3. Rename a question in the builder and check that the new title appears in Results > Summary.

### Verification
- `npm run lint` and `npm run build` pass with zero errors; backend pytest still 52/52.
- **End-to-end in real Chrome:**
  - **Results** (25 of 25 checks): stats, one card per question, bars and meters, pagination, drawer, Next response, Escape, delete (and the server summary dropping to 39), CSV download, header plus 39 rows.
  - **Settings** (14 of 14 checks): preset, custom colour and font saved to the server, the public runner applying the saved theme (CSS variables and font), thank-you saved even when leaving quickly, welcome screen saved and shown publicly, three Coming soon panels, a fresh title in Summary, and zero console errors.
- Screenshots were reviewed against the references.

### Deferred
Phase 6: empty-state and loading polish, transition timing, focus handling, a responsive check, `.env.example` files, deployment config and the README.

## Phase 6: Polish and ship

### What was done
- **Deployment readiness (backend)**
  - `FRONTEND_ORIGIN` accepts a comma-separated list. The first origin builds public links, and all of them are allowed by CORS.
  - The SQLite folder is created on startup, so a fresh Railway volume at `/data` works.
  - `backend/railway.json` sets the start command and a `/health` check; `.python-version` pins 3.12.
  - Two new tests cover the config and the folder creation (54 tests in total).
  - **Schema exactness:** the `answers` columns are now declared `TEXT` / `REAL`, matching PLAN.md exactly. They had come out as `VARCHAR` / `DOUBLE`, which behave identically in SQLite but are not what the spec says.
- **Polish**
  - Skeleton rows for the workspace list instead of a spinner.
  - App-level not-found and error screens, and an error boundary for `forms/[id]`.
  - A real favicon (the scaffold's default is removed).
  - TanStack Query no longer retries 4xx responses (a missing form now shows its message immediately).
- **Focus and motion**
  - The keyboard focus ring follows the form theme, so it stays visible on dark themes (`--focus-ring`).
  - `prefers-reduced-motion` is respected by CSS animations and by the slide transitions.
- **Responsive pass** at 390, 768 and 1440 px across workspace, builder, results, share, runner and preview. It found and fixed:
  - the builder's grid overflowing on phones
  - the question list collapsing to nothing on small screens
  - header tabs overlapping the title at tablet width (they now show from `lg`, with a tab row below on smaller screens)
  - the workspace's "Copy link" button squeezing titles on phones
  - the Share link input collapsing in a column layout
- **Docs:** a full root `README.md` following the PLAN outline, with the generated DDL, ER and architecture diagrams, API tables, a feature checklist, assumptions and deployment steps. It has 5 real screenshots in `docs/screenshots/`, a short `frontend/README.md`, and a `.gitattributes`.
- **Final QA:** the checklist at the end of PLAN.md was run end to end in Chrome (see below).

### Verification (final build)
- Backend `pytest`: **54 passed**. Frontend `npm run lint`: **0 problems**; `npm run build`: **success**.
- Real-Chrome Playwright suites, all against a freshly seeded database on the final build:
  - results and settings: **33/33**
  - respondent flow: **23/23**
  - builder: **27/27**
  - PLAN's final QA checklist: **17/17**
    - create, rename, duplicate and delete a form, with toasts
    - copy link puts the public URL on the clipboard
    - the link opens in a private window with no login
    - a submit with the browser's validation bypassed gets a `422` with the documented per-question errors
    - the thank-you screen shows after submit, and the workspace count goes up by one
    - unpublish makes the public link show the closed screen
    - a missing form and an unknown page show their error screens
    - no unexpected console errors (the two browser-logged 404s come from deliberately opening a missing form and page)
  - responsive sweep (18 page/size combinations): no horizontal overflow anywhere.

### Things the owner must do (cannot be done from this machine)
1. **Deploy**, following the README's Deployment section: Railway (`backend/`, volume at `/data`, `DATABASE_URL`, `FRONTEND_ORIGIN`) and Vercel (`frontend/`, `NEXT_PUBLIC_API_URL`). Then put the live URLs into the top table of the README. They are marked there as placeholders.
2. **Record a short GIF** of the respondent flow if wanted. The README has screenshots but no GIF.
3. Push to a **public GitHub repository**.

### Known limitations
- The creator app has no dark mode (form themes include dark ones).
- Logic jumps, file upload and integrations are "Coming soon" placeholders, as the brief allows.
- Playwright suites live outside the repo to avoid a dev dependency. The PLAN's QA checklist is documented in this log and the README's Testing section instead.

## Extension: logic jumps, partial responses, file upload, dark mode

Requested after the six phases: check which of the assignment's bonus items were missing and implement them properly, with Typeform's UX. Status at the start:

| Item | Status before | Now |
| --- | --- | --- |
| Publish / unpublish with a shareable link | Done | Done |
| Client and server validation | Done | Done |
| Logic jumps / conditional branching | Only a "Coming soon" panel | **Done** |
| Partial-response tracking / completion rate | Completion rate only; no partial data | **Done** |
| File-upload question type | "Coming soon" | **Done** |
| Dark mode | Not present (only dark form themes) | **Done** (creator app) |

### 1. Logic jumps
- **Storage:** rules live in `questions.properties["logic"]` as plain JSON, so the schema did not change. The question API exposes them as a separate `logic` field and hides the key from `properties`.
- **Model:** a rule is `{match: all|any, conditions: [{question_id, operator, value}], jump_to: question id | "end"}`. A question holds an ordered list of rules plus an `otherwise` target; the first matching rule wins.
- **Operators come from the type.** Each question type declares one `logic_kind` (text, number, choice, boolean or file) and gets the matching operators on both sides (`question_types/logic.py`, `lib/logic.ts`). For example "contains" for text, "is greater than" for numbers, "is" for options, and only "is answered" for files.
- **One evaluator on both sides.** The browser decides which screen comes next and the server decides which questions were on the route. This matters for correctness: a required question skipped by a jump must not block the submit, and an answer given before the respondent changed their mind (and then skipped) must not be stored. `compute_path` is used by submit, progress and the seed.
- **Forward only.** A jump may only go to a later question or the end, and a condition may only use the current or an earlier question, so a form can never loop. The server validates this when rules are saved, with a message per problem. If a later reorder leaves a backward jump, it is ignored when answering and shown as a problem in the editor.
- **Builder UX** (`components/builder/logic/`): a "Logic +" row at the bottom of the settings panel (as in Typeform), a short summary of the rules, a branch icon on questions that have logic, and a modal rule editor with all/any conditions, "Jump to" and "All other cases".
- **Runner:** keeps a `history` of passed questions, so Back returns to where the respondent really came from. Progress is "questions passed over the length of the current route", and the last question on the route says Submit.
- **Keeping rules valid:** deleting a question prunes the rules that use it (server and store). Duplicating a form remaps question and option ids inside rules to the copies (number values are left alone).
- **Safety on save:** the store sends `logic` only when it was edited, so an unrelated edit (a title) can never be rejected because of a rule elsewhere.
- **Seed:** the survey sends ratings of 2 or less to the open question; the registration form jumps to the end when there are no dietary needs. Seeded responses follow those routes.

### 2. Partial responses
- **Saving as they go:** the runner calls `PUT .../progress` each time a respondent advances, and again (with `keepalive`) when the tab is hidden, so a half-typed but valid answer is kept. The endpoint never complains: required questions may still be open and invalid or half-typed values are skipped. Each call replaces the previous one, and a submit does the same, so there are never duplicate answers.
- **Results:** Summary gains a Partial stat, a "Where respondents drop off" card (answers per question and how many left right after it) and a note about people who left before answering anything. The Responses tab has a Completed / Partial / All filter with counts, a Status column, and a drawer that says where a partial respondent stopped. CSV can include partial responses (adds a Status column). Question statistics and the workspace response count still use completed responses only.
- **No schema change:** a partial answer is an ordinary `answers` row of an `in_progress` response.

### 3. File upload
- **Respondent UX:** a dashed dropzone ("Drag and drop a file here or choose a file", with the limits shown), upload progress, then a file card with Replace and remove. Wrong kind, too large and empty files are refused before uploading, and the server enforces the same rules. While a file is uploading, "next" asks the respondent to wait instead of losing the file.
- **Creator UX:** File Upload is in the add-question modal, with settings for allowed files (any, images, documents, audio and video) and the maximum size (1 to 25 MB). In the builder and in Preview a chosen file is only shown; nothing is uploaded.
- **Backend:** the raw file is the body of `PUT .../files/{question_id}` (no multipart dependency), read with a size limit. Files are stored under `UPLOAD_DIR` with random names. Programs (`.exe`, `.sh` and similar) are always refused; client file names are cleaned so they cannot escape the folder; a second upload for the same question replaces the first and removes the old bytes.
- **Access:** only the form's owner can download a file (`GET /api/forms/{id}/files/{file_id}`), always as an attachment with `nosniff`, never rendered inline.
- **Cleanup:** deleting a response or a form removes its files from disk (after the database rows are gone). A question with uploaded files is soft-deleted rather than hard-deleted.
- **Data model:** the only schema addition is a `files` table (created automatically by `create_all`). Older databases are upgraded once at startup by `core/migrations.py`, which rebuilds the `questions` table so its type constraint accepts `file_upload`. This is tested against a database with the old constraint and keeps existing rows.
- **Results:** a summary card (count, total size, latest names), the file name in the table and CSV, and a download link in the drawer.

### 4. Dark mode
- **Switcher:** an Appearance menu (Light, Dark, System) in the workspace and builder headers. The choice is stored in `localStorage` and "System" follows the operating system live. A small inline script sets `data-theme` before first paint, so there is no white flash.
- **How it works:** every creator colour was already a token, so dark mode redefines the tokens under `data-theme="dark"`. I added `card` and `on-action` tokens and replaced the remaining hard-coded `bg-white` and `text-white` in the creator UI. Native controls follow through `color-scheme`.
- **Respondent pages stay light**, and the builder canvas keeps the form's own theme, because a form is styled by its creator and not by the app's mode. The few runner pieces that sit on the form theme (dropdown list, error pill, "Powered by") use fixed colours.
- **Accessibility finding:** an automated contrast sweep (every visible text element on every creator screen, in both modes) found that the light-mode "faint" text colour was only 2.5:1 on white. It is now 4.5:1, which fixes hint text everywhere.

### Bugs found and fixed along the way
- The Logic dialog was taller than the screen and clipped its title. Dialogs now scroll inside the viewport.
- The "System" appearance did not react live to an operating-system change until `ThemeSync` listened to the media query directly.
- The sticky first column of the responses table had a transparent background, so scrolled cells showed through it.
- The builder's question-number badge used the app colour on the form-themed canvas (pale on pale in dark mode). It now uses the form's colours.
- Remapping option ids when duplicating a form must only touch conditions on choice questions, otherwise a number that happens to equal an option id would be rewritten. There is a test for it.
- The color-scheme code was first imported by the server-rendered root layout, which the build rejected (a React hook in a server component). The pre-paint script now lives in its own hook-free module.

### Verification
- Backend `pytest`: **136 passed** (was 54): logic evaluator and rules, partial responses and funnel, file uploads, and the schema upgrade.
- `npm run lint`: 0 problems. `npm run build`: success.
- Real-Chrome end-to-end suites, each on a freshly seeded database:
  - results and settings: 32/32
  - respondent flow: 23/23
  - builder: 27/27
  - logic jumps: 22/22
  - partial responses: 18/18
  - file upload: 25/25
  - dark mode, including the contrast sweep: 26/26
  - PLAN QA checklist: 17/17
  - responsive sweep: no horizontal overflow at 390, 768 and 1440 px

### Limitations
- A single ending (the thank-you screen): "jump to the end" goes there. Several endings are not built.
- Uploads are kept on the backend disk (a volume on Railway). Abandoned uploads stay until their response is deleted, and there is no virus scanning.
- A file question cannot change type once it has answers (the same rule as the other types).
