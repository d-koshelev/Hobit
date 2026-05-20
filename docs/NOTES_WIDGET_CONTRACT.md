# Notes Widget Contract

## Purpose

This document is the authoritative current Notes widget contract during Phase 1
stabilization.

It separates the shipped Notes surface from the future Notebook direction. It
does not implement frontend UI, backend commands, Tauri commands, storage
schema changes, migrations, Markdown rendering, autosave, delete/archive
behavior, tags, AI-in-Notes, or cross-widget automation.

For product planning beyond the current surface, see
`docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.

## Status Model

- Current: implemented behavior that exists in the codebase and is safe to rely
  on.
- Planned: approved next-step behavior, but not necessarily implemented yet.
- Deferred: future behavior that must not be implemented unless explicitly
  requested.
- Compatibility: legacy IDs, names, aliases, old component names, old state
  shapes, or old code paths that still exist but are not preferred
  product/domain names.
- Deprecated: old behavior or terminology that should not be used for new work.

Do not implement Planned, Deferred, Compatibility, or Deprecated behavior from
this contract unless a future task explicitly requests it.

## Product Role

Notes is the current first-class widget/capability for operator-authored text
inside a Workspace.

Notes gives the operator a simple place to capture and organize workspace-local
text without turning that text into Knowledge, Evidence, Runbooks, Agent Queue
items, Git changes, Terminal input, or agent memory by default.

Notes is optional Workbench capability, not the product center.

## Current Shipped Behavior

Current Notes is a workspace-local multi-note widget surface.

Implemented behavior:

- Notes is available from the current Widget Catalog.
- Notes uses the `notes` widget definition id.
- The frontend component is still named `NotesPlaceholderWidget` for
  Compatibility.
- The widget loads workspace-local notes through the Workspace Notes API.
- It supports listing workspace notes.
- It supports frontend filtering across note title and body.
- It supports creating a new workspace-local note from the widget header.
- It supports selecting and reading a note from the list.
- It supports editing the selected note title and body as plain source text.
- It supports an explicit Save action.
- It blocks selecting, refreshing, or creating another note while the selected
  note has unsaved edits.
- It supports pin/unpin by editing the selected note's pinned checkbox and
  saving the note.
- The persisted list returned by storage is non-archived notes ordered with
  pinned notes first, then most recently updated notes.
- The editor shows visible load, unavailable, unsaved, saving, saved, and empty
  states.
- Widget logs, layout editing, in-app floating mode, and workspace activity are
  provided by the shared widget foundation.

Current data fields:

- `note_id`
- `workspace_id`
- `title`
- `body`
- `pinned`
- `archived`
- `created_at`
- `updated_at`

Current storage/API behavior:

- Desktop/Tauri uses local SQLite-backed Workspace Notes APIs.
- `hobit-app` exposes workspace-scoped create, list, read, and update methods.
- Tauri commands and frontend Workspace API methods expose the same
  create/list/read/update operations.
- Notes are scoped to one Workspace.
- Workspace deletion deletes that Workspace's workspace-local notes.
- Browser/Vite fallback keeps the widget insertable through the in-memory
  Workbench fallback, but Workspace Notes persistence is unsupported there and
  note create/list/read/update calls return visible unsupported-runtime errors.

Current Coordinator relationship:

- Coordinator Chat can create a new workspace-local Note only from an approved
  visible create-Note proposal and a separate explicit Create Note action.
- Only visible title, body, and pinned fields from the approved proposal can be
  written.
- Existing Notes content is not read, searched, summarized, or sent to agents.

## Current Boundaries

Current Notes stores and edits plain title/body source text. It does not render
a Notebook document model.

Current Notes does not implement:

- full Notebook behavior
- multiple tabs/documents inside one Notes widget beyond the workspace-local
  note list
- Markdown rendering or Markdown preview
- Mermaid or other diagram rendering
- rich formatting tools
- checklists/todos as structured state
- folders
- tags
- archive/delete UI
- autosave
- sync/import/export
- collaborative editing
- attachments
- backlinks
- copy/export/context handoff flows
- AI-in-Notes
- hidden agent context access
- automatic Knowledge ingestion
- automatic Evidence creation
- Agent Executor integration
- Agent Queue integration
- Runbook integration
- Terminal integration
- Git mutation or automatic Git persistence
- cross-widget automatic context ingestion

## Compatibility And Deprecated Behavior

The older widget-local draft state shaped as:

```json
{ "body": "..." }
```

is Compatibility/Deprecated for new product work.

Meaning:

- It is a legacy widget-state shape from the earlier minimal Notes placeholder.
- It may exist in persisted `widget_instances.state` data.
- It is not the preferred current product model for new Notes work.
- Current product Notes behavior should be described through workspace-local
  notes records and Workspace Notes APIs, not a single widget-local draft.
- Future Notebook or migration work must preserve existing text and must not
  silently discard unknown legacy state.
- This task does not implement a migration, cleanup, or rewrite of legacy saved
  state.

The `NotesPlaceholderWidget` component name is also Compatibility. It may
contain current product UI and must not be renamed casually.

## Planned Notes Product Slice

Near-term Notes work should remain small and should start from the shipped
workspace-local multi-note surface. Product planning is governed by
`docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.

Planned work may include:

- focused Notes smoke checklist coverage
- Notes UI/controller refactor without behavior change
- clearer browser/dev memory Notes API support if explicitly scoped
- explicit archive/delete decisions
- explicit autosave decisions
- UI polish for search, pinning, empty states, and save states

Planned work must not imply the future Notebook feature set is current.

## Deferred Notebook Direction

Notebook is the deferred richer text workbench direction for Notes. It may
eventually support multiple text tabs/documents, Markdown source editing,
rendered previews, diagram previews, formatting tools, and operator-approved
AI-assisted editing.

Deferred Notebook capabilities include:

- widget-local tabs/documents
- global notes
- folder trees
- Markdown preview
- Markdown rendering
- Mermaid fenced-block rendering
- rendered JSON/code/table/checklist previews
- rich formatting controls
- explicit text transformation actions such as JSON prettify or list cleanup
- tags
- backlinks
- templates
- note-to-Knowledge review flow
- note-to-Evidence attachment
- import/export
- sync
- collaborative editing
- attachments
- AI-assisted note editing

Future Notebook source text must remain the durable source of truth. Rendered
Markdown, diagrams, JSON previews, tables, and other previews must be derived
from stored source text and must not replace source text as durable state.

Future rendering must not execute commands, mutate Notebook source, load remote
assets by default, contact the network, or become a Terminal, SQL runner,
script executor, or hidden automation path.

## Future Notebook Compatibility Rules

Future Notebook implementations must safely handle existing Notes data:

- Workspace-local note records must remain readable.
- Legacy `{ "body": "..." }` widget state must remain readable until an
  explicit migration or compatibility adapter is implemented.
- Existing saved Notes content must not be lost.
- A future migration may adapt legacy body text into one note or one tab only
  when that migration is explicitly designed, tested, and reversible enough to
  diagnose failures.
- Unknown state fields must not be silently discarded.
- Invalid or unexpected state must fail conservatively, preserve the original
  stored value where possible, and show an understandable error or fallback.
- Opening a widget must not rewrite all saved Notes merely because a future
  Notebook model exists unless that behavior is explicitly designed and tested.

## Safety Principles

- No hidden note reads.
- No hidden note writes.
- No hidden formatting.
- No hidden rendering side effects.
- No hidden AI rewriting.
- No hidden context use.
- No automatic command execution from note text, Markdown, code blocks, or
  diagram blocks.
- No automatic promotion to Knowledge or Evidence.
- No automatic Agent Queue item creation.
- No automatic Agent Executor, Terminal, JDBC, Runbook, or Git action.
- Cross-widget use of Notes content must be visible and operator-controlled.
- Any future provider/agent context sharing must show what note content is
  being used.
- Destructive future delete/archive behavior must be explicit and recoverable
  or confirmation-gated.

## Relationship To Other Concepts

### Notes vs Knowledge

Notes are freeform operator-authored text. Knowledge is structured, reviewed,
or validated context. Notes may be promoted to Knowledge candidates only through
explicit operator action in a future scoped feature.

### Notes vs Evidence

Notes are not Evidence by default. A note excerpt may become an Evidence
candidate only through explicit operator action in a future scoped feature.

### Notes vs Runbook

Notes may contain instructions or checklists, but they do not define executable
or governed runbook behavior.

### Notes vs To-do List

Ordinary checklist and todo use cases belong in the future Notebook direction
by default. A separate To-do List widget should remain deferred unless a future
contract explicitly needs structured task-management behavior such as
assignment, filtering, scheduling, external synchronization, or governed
completion workflows.

### Notes vs Event Log

Notes are operator-authored text. Event Log is structured Workspace and
Workbench history. Notes do not replace event history.

## Non-Goals

Current Notes is not:

- Knowledge Catalog
- Evidence by default
- Runbook
- Agent memory
- Terminal
- Script Runner
- SQL runner
- Git storage
- Workspace event history
- hidden context source for Coordinator Chat or Agent Executor

This contract does not authorize implementation of Notebook features, Notes
migrations, new storage schema, new Tauri commands, new widget insertion
behavior, component renames, or cross-widget automation.
