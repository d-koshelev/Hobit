# Feature Slice Checklist

## Purpose

This checklist is the standard process guide for future Codex-driven Hobit
feature slices.

It is a development/process document only. It does not override product
contracts, does not make Planned or Deferred behavior current, and does not add
runtime behavior. Current widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`; task-specific contracts remain authoritative
for their domains.

## Core Rules

- One task = one type of change.
- Allowed files must be explicit before editing starts.
- Do docs-only contract cleanup first when contracts are unclear or stale.
- Do not implement Deferred behavior unless explicitly requested.
- Do not rename persistence IDs unless explicitly requested.
- Do not touch unrelated widgets.
- Do not change validation scripts unless the task explicitly targets
  validation tooling.
- Do not hide validation failures.
- Do not claim validation passed when dependencies are missing or a command was
  not run.
- Leave unrelated dirty files untouched.
- Final reports must summarize changed files, validation, and remaining
  ambiguity.

## Feature Slice Types

### A. Docs-Only Contract Update

Use this slice when contracts are unclear, stale, conflicting, or missing
authority language.

Checklist:

- [ ] Confirm the relevant source-of-truth chain in
  `docs/ACTIVE_CONTRACT_INDEX.md`.
- [ ] Decide whether the behavior is Current, Preview, Planned, Deferred,
  Compatibility, or Deprecated.
- [ ] Update only the affected docs.
- [ ] Update authority or index docs when a new process or contract document is
  added.
- [ ] Do not change product code, tests, persistence, runtime behavior, or
  validation scripts.
- [ ] Run docs-appropriate validation and scoped diff checks.

### B. Frontend-Only UI / Refactor

Use this slice when the change is visual, structural, or controller-level in
frontend code only.

Checklist:

- [ ] Confirm no backend behavior change is needed.
- [ ] Confirm no persistence change is needed.
- [ ] Confirm no Tauri command or DTO change is needed.
- [ ] Keep the work scoped to the target widget or shell surface.
- [ ] Avoid unrelated widgets and shared action bags unless explicitly scoped.
- [ ] Preserve widget registry and WidgetHost mapping patterns.
- [ ] Update smoke checklists if current or preview behavior changes.
- [ ] Run frontend and scoped validation that is possible in the local
  environment.

### C. Frontend Dev / Mock / Fallback Feature

Use this slice for browser/Vite-only, mock-only, or unsupported-runtime
fallback behavior.

Checklist:

- [ ] Confirm the task explicitly scopes browser/dev/mock/fallback behavior.
- [ ] Label non-persistent behavior clearly in UI, docs, or smoke checklist as
  appropriate.
- [ ] Do not represent dev fallback behavior as desktop production behavior.
- [ ] Do not add hidden production runtime paths.
- [ ] Do not use dev-only smoke HTML entry points as product surfaces.
- [ ] Update smoke docs when fallback expectations change.

### D. Persisted Workspace Feature

Use this slice when behavior crosses workspace storage, Rust app services,
Tauri commands, frontend APIs, controllers, and UI.

Checklist:

- [ ] Contract/source-of-truth checked.
- [ ] Current vs Planned vs Deferred status decided.
- [ ] Storage migration needed? yes/no.
- [ ] SQLite schema updated if needed.
- [ ] Storage row/input/mapping updated if needed.
- [ ] Storage tests updated if needed.
- [ ] App service method added if needed.
- [ ] Tauri DTO shape defined.
- [ ] Tauri command registered.
- [ ] Rust DTO serialization/mapping checked.
- [ ] Frontend type added.
- [ ] Frontend API wrapper added.
- [ ] Browser/dev fallback behavior defined.
- [ ] Unsupported-runtime behavior defined where no fallback is allowed.
- [ ] Widget controller/state management updated.
- [ ] UI updated.
- [ ] Error states handled.
- [ ] Smoke checklist updated.
- [ ] `docs/CURRENT_WIDGET_SURFACE.md` updated only if current behavior
  changed.
- [ ] Task-specific contract updated.
- [ ] Validation commands run or honestly reported.
- [ ] Unrelated dirty files left untouched.

### E. Runtime / Tooling Feature

Use this slice for process execution, shelling out, provider calls, sidecars,
tooling commands, validation tooling, or any behavior that can affect the local
machine or external systems.

Checklist:

- [ ] Use the strictest scope that can satisfy the task.
- [ ] Confirm the task explicitly allows runtime or tooling behavior.
- [ ] Define safety boundaries before implementation.
- [ ] Keep tools/actions explicit, visible, and approval-aware.
- [ ] Do not add hidden automation.
- [ ] Do not add Coordinator, Queue, Terminal, Git, JDBC, or Agent Executor
  cross-control unless explicitly requested and contract-approved.
- [ ] Document platform limits.
- [ ] Add or update process/lifecycle tests where behavior changes.
- [ ] Run the required validation profile or report why it could not run.

### F. Compatibility / Deprecation Cleanup

Use this slice when old names, old APIs, old components, retained persistence
IDs, or pending-retirement paths need clarification or removal.

Checklist:

- [ ] Identify old names, IDs, APIs, state shapes, and modules.
- [ ] Decide keep-as-Compatibility vs retire/delete.
- [ ] Preserve persistence IDs unless the task explicitly requests migration.
- [ ] Avoid component renames unless explicitly scoped.
- [ ] Update `docs/CURRENT_WIDGET_SURFACE.md` if current behavior or
  compatibility status changes.
- [ ] Update compatibility contracts or the active index where needed.
- [ ] Do not remove retained paths without targeted validation.

## Persisted Feature Checklist

Use this detailed checklist before and during any workspace-persisted feature
slice.

- [ ] Contract/source-of-truth checked.
- [ ] Current vs Planned vs Deferred status decided.
- [ ] Storage migration needed? yes/no.
- [ ] SQLite schema updated if needed.
- [ ] Storage tests updated if needed.
- [ ] App service method added if needed.
- [ ] Tauri DTO shape defined.
- [ ] Tauri command registered.
- [ ] Rust DTO serialization/mapping checked.
- [ ] Frontend type added.
- [ ] Frontend API wrapper added.
- [ ] Browser/dev fallback behavior defined.
- [ ] Widget controller updated.
- [ ] UI updated.
- [ ] Error states handled.
- [ ] Smoke checklist updated.
- [ ] `docs/CURRENT_WIDGET_SURFACE.md` updated only if current behavior
  changed.
- [ ] Task-specific contract updated.
- [ ] Validation commands run or honestly reported.
- [ ] Unrelated dirty files left untouched.

## Closeout Expectations

Every feature-slice final report should include:

- files changed
- what changed
- validation commands and results
- expected environment failures, if any
- remaining ambiguity or deferred work
- commit hash, when a commit was created
