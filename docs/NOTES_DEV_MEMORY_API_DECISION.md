# Notes Dev Memory API Decision

## Contract / Decision Header

Decision status: Implemented for Phase 2 dev/browser fallback

Decision area: Notes browser/dev fallback

Source of truth for:

- Whether to implement a dev-only in-memory Notes API
- Boundaries for that implementation

Not source of truth for:

- production Notes persistence
- Tauri/SQLite storage
- future Notebook features
- Coordinator / Queue / Executor behavior

Related documents:

- `docs/NOTES_WIDGET_CONTRACT.md`
- `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`
- `docs/testing/NOTES_SMOKE_CHECKLIST.md`
- `docs/development/FEATURE_SLICE_CHECKLIST.md`
- `docs/CURRENT_WIDGET_SURFACE.md`

## Current Problem

Current Notes persistence is desktop/Tauri backed. In the Tauri desktop shell,
Workspace Notes create/list/read/update flows use local SQLite-backed
Workspace Notes APIs.

Browser/Vite fallback currently keeps the Workbench and Notes widget
insertable through the in-memory Workspace fallback, but it does not provide
real Notes persistence. Current browser fallback Notes create/list/get/update
calls return visible unsupported-runtime errors.

This makes Notes UI iteration slower because polishing the current Notes UI and
smoking create/list/get/update flows requires the desktop/Tauri path.

A dev-only in-memory Notes API could speed up browser development and smoke
checks. It must be clearly non-persistent and must not be confused with
production behavior.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Option A - Keep current unsupported-runtime browser behavior | Safest. No risk of pretending browser persistence is real. No implementation work. | Slower UI iteration. Harder to smoke-test Notes UI in browser. |
| Option B - Add dev-only in-memory Notes API | Faster Notes UI iteration. Browser/Vite smoke checks can exercise create/list/get/update flows. Supports future Notes UI refactors. | Could confuse dev behavior with production if not clearly labeled. Requires strict boundaries and documentation. |
| Option C - Add production browser persistence | None for current Phase 2. | Out of scope. Risks changing product model. Requires storage/security decisions. |

## Recommended Decision

Prefer Option B for Phase 2.

Implement the future follow-up as dev-only, non-persistent, explicitly labeled
memory behavior. Keep production/Tauri Notes persistence unchanged. Keep
unsupported-runtime behavior available where appropriate if the app is not in a
dev/browser memory mode.

This decision is implemented for browser/Vite development only. The
implementation is frontend-only, in-memory, and non-persistent. It does not
change desktop/Tauri persistence or add production browser persistence.

## Implementation Boundaries

Implemented behavior:

- Browser/Vite development mode can create, list, get/select, and update
  workspace-local Notes in frontend memory.
- Notes are keyed by Workspace id and reset on page reload.
- The memory fallback preserves the current title, body, pinned, archived,
  createdAt, and updatedAt frontend shape.
- Tauri desktop continues to use SQLite-backed Workspace Notes APIs.
- Non-dev browser fallback keeps unsupported-runtime Notes persistence errors.

Allowed in this implementation boundary:

- Add a frontend-only memory Notes API for browser/dev mode.
- Support only current Notes behavior:
  - create note
  - list notes
  - get/select note
  - update title/body/isPinned
  - frontend filter remains client-side if already current
- Mark data as non-persistent.
- Reset data on page reload unless an explicit later task changes that.
- Display or expose clear dev-only/non-persistent status if the current UI can
  reasonably show it.
- Keep Tauri desktop behavior unchanged.
- Keep Notes smoke checklist honest.

Not allowed:

- no SQLite changes
- no Tauri command changes
- no backend changes
- no production browser persistence
- no localStorage/sessionStorage persistence unless separately approved
- no delete/archive/autosave
- no Markdown/Notebook/tags/folders/AI-in-Notes
- no change to widget IDs
- no WorkspaceApi split unless separately scoped
- no WidgetRenderProps/action bag cleanup in the implementation task

## Implementation Acceptance Criteria

Implementation status: satisfied for the Phase 2 dev/browser memory API slice.

- Browser/dev mode can create/list/get/update notes in memory.
- Memory Notes behavior is clearly dev-only/non-persistent.
- Tauri desktop Notes persistence remains unchanged.
- Browser reload loses in-memory notes unless a later task explicitly adds
  persistence.
- Current unsupported-runtime messaging is replaced or scoped only where memory
  mode is enabled.
- Notes smoke checklist is updated if needed.
- No backend/Tauri/storage changes.
- No new Notes features.
- Frontend typecheck is run if dependencies exist, or missing dependency
  failure is reported honestly.
- `cargo check --workspace` and `cargo test --workspace` remain passing if run.

## Current / Planned / Deferred Classification

Current:

- Desktop/Tauri Notes persistence through local SQLite-backed Workspace Notes
  APIs.
- Dev-only frontend memory Notes API for browser/Vite development, limited to
  the current create/list/get/update Notes behavior and non-persistent across
  reloads.
- Non-dev browser fallback unsupported-runtime behavior for Notes persistence
  reads and writes.

Deferred:

- Production browser Notes persistence.
- Notebook behavior, including Markdown rendering, tags, folders, autosave,
  delete/archive UI, and AI-in-Notes.
- Coordinator, Queue, Executor, Terminal, Git, JDBC, Runbook, or hidden
  cross-widget Notes behavior.
