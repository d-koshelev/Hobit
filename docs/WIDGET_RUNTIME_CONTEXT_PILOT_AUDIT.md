# Widget Runtime Context Pilot Audit

## Purpose

This docs-only audit records what the minimal `WidgetRuntimeContext` Knowledge
/ Skills pilot proved and identifies the next safe reductions in
`widgetHostRenderProps` / `WidgetHost` coupling.

It does not add frontend behavior, backend/Tauri commands, storage/schema
changes, runtime behavior, widget migrations, WidgetHost rewrites,
WorkbenchCanvas rewrites, WorkspaceApi splits, new widget insertion behavior,
or tests.

Authoritative implementation boundaries remain in
`docs/CURRENT_WIDGET_SURFACE.md`,
`docs/WIDGET_RUNTIME_CONTEXT_DESIGN.md`,
`docs/WIDGET_UNIFICATION_STATUS.md`, and the affected domain contracts.

## Knowledge Pilot Result

The Knowledge / Skills pilot proved that a minimal per-widget runtime context
can be introduced beside existing widget props without changing widget
behavior.

What the pilot proved:

- `WidgetRuntimeContext` can carry shell-level identity and logs for one widget
  instance without replacing `WidgetHost`.
- `WidgetHost` can continue to act as the registry/component mapping and
  compatibility adapter while also providing runtime context.
- A widget can prefer runtime-context logs while preserving direct-prop
  fallback behavior for compatibility and tests.
- Knowledge / Skills can consume a shell-level runtime concern without moving
  its domain workflows, API calls, draft review, Queue context attachment, or
  Workspace Agent handoffs.
- The pilot did not require a broad `WidgetRenderProps` rewrite,
  WorkbenchCanvas rewrite, WorkspaceApi split, persistence change, or new
  runtime capability.

The pilot also confirmed the intended migration rule: context adoption should
start with shell-level concerns and keep existing props until a domain-specific
adapter has a focused replacement path and test coverage.

## Knowledge Prop Classification

The current Knowledge / Skills render-prop path is still a useful
compatibility adapter. It should be reduced in small slices, not removed in a
single cleanup.

Knowledge props that can move later:

- Widget-local logs access can remain behind `WidgetRuntimeContext.logs` and
  should no longer need a Knowledge-specific direct prop once all Knowledge
  log consumers use the context path.
- Widget identity currently implicit in `instance`, `definition`, and
  `workspaceId` can move behind `WidgetRuntimeContext.identity` for shell-level
  logic and tests.
- Basic Skill CRUD props can move behind a narrow Knowledge / Skills capability
  adapter after the adapter is proven against the existing workspace Skill API.
- Basic Knowledge Document CRUD/search/import props can move behind the same
  narrow Knowledge / Skills capability adapter, preserving current explicit
  operator actions and browser fallback behavior.
- Selected Skill or Knowledge Document attachment requests can move later to a
  typed handoff router, but only as visible current-session requests with
  bounded payload summaries.

Knowledge props that must remain domain-specific for now:

- Draft review acceptance/rejection and draft ledger access remain
  Knowledge-domain behavior, not shell runtime behavior.
- Queue task Knowledge / Skills attachment and materialization remain Queue and
  Knowledge domain behavior, not generic WidgetHost behavior.
- Workspace Agent attachment remains an explicit visible context handoff, not
  hidden prompt injection or automatic provider context.
- Import remains an explicit single-file plain text/Markdown Knowledge action;
  it must not become a generic file-read capability or Finder session shortcut.
- Knowledge Document fields, source refs, lifecycle/status, scope, enabled
  state, searchable state, relations, and review metadata remain Knowledge
  domain model details.

## Next Safe Pilot Candidates

### Queue V2 Board Shell

Queue v2 is a safe candidate only for board-shell presentation state, not
runtime action migration.

Safe first slice:

- expose widget identity and shell logs through `WidgetRuntimeContext`;
- keep Queue task CRUD, assignment, execution, autorun, run-link history,
  Knowledge context, report cards, and worker actions on the existing Queue
  controller;
- pilot a Queue v2 board shell adapter that receives a prepared board snapshot
  and renders lanes/selection without introducing new Queue runtime behavior.

This is safe because it tests context around a board visualization boundary
while leaving Queue's current execution and mutation paths unchanged.

### Terminal Settings / Logs

Terminal is a safe candidate for shell-level settings/logs cleanup if the work
does not touch PTY behavior.

Safe first slice:

- move Terminal widget-local logs access toward `WidgetRuntimeContext.logs`;
- wrap the Terminal settings shell in a runtime-context-aware adapter while
  keeping shell executable, argv, working directory, PTY lifecycle, output
  polling, and legacy fallback actions domain-owned;
- preserve the current boundary that PTY output is session-only and is not
  persisted as widget logs.

This is safe because the outer settings/logs plumbing can be reduced without
changing Terminal runtime semantics.

### Notes

Notes is a safe candidate for a narrow domain adapter because its current MVP
surface is workspace-local create/list/read/update with explicit save and pin
flows.

Safe first slice:

- keep the Notes UI and Notes API behavior unchanged;
- move list/read/create/update props behind a Notes capability adapter;
- keep the deprecated widget-local `{ "body": "..." }` state as
  compatibility-only;
- avoid Notebook, Markdown rendering, autosave, tags, delete/archive, AI in
  Notes, and hidden existing-note reads.

This is safe because Notes has a bounded current API and no runtime execution
path.

### Widget Catalog

Widget Catalog is a safe shell candidate if treated as insertion UI only.

Safe first slice:

- route catalog open/close and selected template display through a shell-owned
  adapter or popup/drawer runtime boundary;
- keep catalog template data, registry filtering, user-facing product widget
  exposure, and add-widget mutation behavior unchanged;
- do not add new widget entries, hidden discovery, broad scanning, or
  unsupported catalog behavior.

This is safe because the catalog is a visible operator-controlled insertion
surface and can prove shell routing without touching widget domain APIs.

## Unsafe Candidates For Now

### Workspace Agent Provider / Runtime

Workspace Agent provider/runtime props are unsafe for immediate context
reduction because they combine visible chat state, provider request assembly,
proposal drafts, visible attachments, Direct Work UI, Queue/Notes/Knowledge
creation actions, and current-session thread/working-directory state.

Do not move these into a generic runtime context yet. A future slice should
first extract provider request assembly, visible-context assembly, proposal
validation/state, and command adapters inside the Workspace Agent domain. No
migration may add hidden context access, provider tools, Terminal control, Git
mutation, JDBC execution, Agent Executor launch, or automatic Queue creation.

### Queue Runtime Actions

Queue runtime actions are unsafe for immediate context reduction because they
include assignment, explicit start, Autorun/session behavior, worker actions,
run-link refresh, Knowledge context materialization, report cards, and
Executor handoff state.

Do not move Queue runtime actions into a generic `WidgetRuntimeContext` or
router first. Start with board-shell rendering or a single non-execution
capability after the Queue v2 snapshot boundary is explicit.

### Finder Filesystem / Session

Finder filesystem/session props are unsafe for immediate context reduction
because approved root state, directory handles, bounded preview, edit/save,
floating preview presentation, and Finder Git plugin behavior are tightly
coupled to explicit operator approval and current-session file handles.

Do not abstract Finder through generic runtime context until a Finder-owned
session controller and Finder Git controller exist. No migration may add root
persistence, hidden file reads, recursive scanning, broad indexing, Workspace
Agent attachment, Terminal launch, Queue creation, or unsupported Git
operations.

## Follow-Up Blocks

### WidgetRuntimeContext Queue V2 Pilot

Goal: prove runtime-context adoption around Queue board-shell rendering without
moving Queue runtime actions.

Expected scope:

- add or adapt a Queue v2 board-shell boundary that reads identity/logs from
  `WidgetRuntimeContext`;
- preserve existing Queue controller props for task mutation, assignment,
  execution, workers, run links, Knowledge context, and report handoffs;
- keep current Queue behavior and tests unchanged except for focused context
  coverage.

Out of scope:

- Queue execution changes;
- Autorun changes;
- backend scheduler or durable runner;
- Queue context materialization changes;
- WidgetHost rewrite.

### WidgetRuntimeContext Terminal Shell Pilot

Goal: reduce Terminal shell/log/settings prop coupling without touching PTY
runtime behavior.

Expected scope:

- use `WidgetRuntimeContext.logs` for Terminal widget-local logs where
  applicable;
- adapt the Terminal settings shell around existing state and actions;
- keep PTY output session-only and preserve the collapsed legacy one-shot
  fallback.

Out of scope:

- tabs, split panes, command history, persistent transcript, Script Runner
  behavior, Terminal-to-Agent routing, Queue-triggered execution, or PTY output
  persistence.

### WidgetHost Prop Adapter Cleanup

Goal: shrink `widgetHostRenderProps` by moving one already-proven domain prop
  group into a widget-local compatibility adapter.

Expected scope:

- choose one domain with a proven context/capability path, preferably
  Knowledge / Skills or Notes;
- keep `WidgetHost` as the registry/component mapping layer;
- preserve old prop fallback until all consumers are migrated;
- delete only migrated prop paths in a later cleanup after tests prove no
  dependency remains.

Out of scope:

- broad `WidgetRenderProps` rewrite;
- all-widget prop cleanup;
- WorkspaceApi split;
- WorkbenchCanvas handoff extraction.

### Workbench Handoff Router Extraction

Goal: move one direct cross-widget handoff path into a typed current-session
router without changing behavior.

Expected scope:

- define a small visible request event with source identity, explicit target
  surface or widget id, bounded payload summary, and correlation id;
- migrate one existing handoff path and preserve current UI behavior exactly;
- reject unsupported or oversized payloads in tests.

Out of scope:

- hidden automation bus;
- backend scheduler;
- provider tool layer;
- cross-widget mutation shortcut;
- Queue auto-dispatch;
- Terminal, Git, JDBC, Finder, or Workspace Agent runtime expansion.

## Recommended Order

1. `WidgetRuntimeContext Queue v2 pilot` for board-shell identity/logs only.
2. `WidgetRuntimeContext Terminal shell pilot` for settings/logs shell
   plumbing only.
3. `WidgetHost prop adapter cleanup` for one proven Knowledge / Skills or
   Notes prop group.
4. `Workbench handoff router extraction` for one bounded visible handoff.

This order keeps shell and visualization reductions ahead of runtime and
provider work, preserving the current Workbench-first, widget-first, explicit
operator-control boundaries.

## Explicit Non-Goals

- No code changes.
- No frontend behavior changes.
- No backend/Tauri command changes.
- No storage/schema changes.
- No runtime execution behavior changes.
- No new widget implementation or catalog exposure.
- No WidgetHost rewrite.
- No WorkbenchCanvas rewrite.
- No WorkspaceApi split.
- No hidden context access, hidden mutation, hidden execution, or automatic
  Queue creation.
