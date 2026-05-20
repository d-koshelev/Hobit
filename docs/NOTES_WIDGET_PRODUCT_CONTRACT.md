# Notes Widget Product Contract

## Purpose

This document is the product-level Notes contract for the current
workspace-local Notes surface and the next planned Notes stabilization slices.

It is a docs/contracts-only product contract. It does not implement frontend
UI, backend commands, Tauri commands, storage/schema changes, migrations,
autosave, delete/archive behavior, tags, Agent integration, Queue integration,
Git behavior, Terminal behavior, or PTY behavior.

The authoritative current widget boundary is
`docs/NOTES_WIDGET_CONTRACT.md`. The broader future Notebook/Markdown direction
is Deferred unless a later task explicitly scopes it.

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

## Current Product Role

Notes: capture and organize local workspace notes.

Current Notes is a workspace-local multi-note product UI. It is not a full
Notebook and must not be described as Markdown, rich text, AI-assisted, or
autosaved.

## Current Product Behavior

Current Notes supports:

- workspace-local notes
- create note
- list notes
- select/read note
- edit note title and body
- explicit save
- visible unsaved/saving/saved/unavailable states
- frontend filter/search across loaded note title and body
- pin/unpin through the selected note's pinned checkbox and explicit save
- pinned-first, recently-updated ordering from storage
- desktop/Tauri persistence through local SQLite-backed Workspace Notes APIs

Current Notes does not support:

- autosave
- note archive/delete UI
- tags
- folders
- Markdown preview or rendering
- Mermaid or diagram rendering
- structured checklists/todos
- attachments
- import/export/sync
- collaborative editing
- Agent Executor integration
- Agent Queue integration
- Runbook integration
- Git integration
- Terminal or PTY behavior
- hidden context access
- AI-in-Notes

Browser/Vite fallback behavior:

- The Workbench and widget insertion can run through the in-memory Workspace
  fallback.
- Workspace Notes create/list/read/update calls are unsupported in browser
  fallback and surface explicit unsupported-runtime errors.
- A dev-only in-memory Notes API is Proposed for Phase 2 in
  `docs/NOTES_DEV_MEMORY_API_DECISION.md`. It is not implemented yet and must
  remain dev-only, frontend-only, and non-persistent if a later task implements
  it.

## Current Implementation Foundation

The backend/storage/API foundation exists for workspace-local notes:

- SQLite stores `notes` records with `note_id`, `workspace_id`, `title`,
  `body`, `pinned`, `archived`, `created_at`, and `updated_at`.
- `hobit-app` exposes create, list, read, and update methods scoped to a
  Workspace.
- Tauri commands and frontend Workspace API methods expose the same
  create/list/read/update operations.
- Lists return non-archived notes with pinned notes first, then most recently
  updated notes.
- Deleting a Workspace deletes its workspace-local notes.

The current widget consumes this foundation for the workspace-local Notes
product UI. The `archived` field exists in storage/API records, but
archive/delete UI and archive/delete commands are not current product behavior.

## Current UI Boundary

Current UI includes:

- note list
- filter input
- new note action
- refresh action
- selected note editor
- title input
- body textarea
- pinned checkbox for the selected note
- explicit Save button
- clear empty/error/unsupported states

Current UI must stay honest:

- Do not show autosave until autosave exists.
- Do not show archive/delete controls until archive/delete behavior exists.
- Do not show tags until tags exist.
- Do not show Markdown, Mermaid, rich formatting, or preview controls until
  they work end to end.
- Do not show Agent, Queue, Runbook, Terminal, JDBC, or Git note actions until
  those actions are explicitly implemented and approval-aware where needed.

## Compatibility And Deprecated Behavior

The older widget-local draft state shaped as:

```json
{ "body": "..." }
```

is Compatibility/Deprecated for new Notes product work.

It may remain in persisted `widget_instances.state` data from older saved
widgets, but the current product model is workspace-local note records. This
contract does not implement a migration or require current UI to rewrite legacy
state.

The `NotesPlaceholderWidget` component name is Compatibility and must not be
used as evidence that the surface is only a placeholder.

## Planned Notes Stabilization

Planned near-term work should stabilize the current Notes surface without
adding Notebook scope.

Recommended follow-up blocks:

- Notes smoke checklist covering create/list/select/edit/save/filter/pin and
  unsupported browser fallback.
- Notes UI/controller refactor that preserves current behavior and widget
  identity.
- Dev-only memory Notes API implementation only after the decision in
  `docs/NOTES_DEV_MEMORY_API_DECISION.md`, with no production persistence,
  Tauri, SQLite, or backend behavior change.
- Archive/delete decision with explicit safety and storage behavior.
- Autosave decision with clear state reporting if approved later.
- Search/filter polish if product expectations grow beyond frontend filtering
  of loaded notes.

Planned work must remain Workspace-scoped by default and must not turn Notes
into hidden agent memory or automatic cross-widget context.

## Deferred Notebook Behavior

The following are Deferred unless a later task explicitly requests them:

- full Notebook model
- multiple tabs/documents inside one widget beyond the current workspace-local
  note list
- global Notes
- folders
- Markdown preview
- Markdown rendering
- Mermaid or diagram rendering
- rich formatting
- explicit formatting/transformation tools
- structured checklists/todos
- tags
- backlinks
- archive/delete UI
- autosave
- import/export
- sync
- collaborative editing
- attachments
- AI-in-Notes
- note-to-Knowledge review flow
- note-to-Evidence attachment
- automatic cross-widget context ingestion

Future Notebook source text must remain the source of truth. Rendered output
must be derived from source and must not execute commands, contact the network,
mutate note text, or become a hidden automation path.

## Relationship To Coordinator Chat

Coordinator Chat may create a Note through an approved create-Note proposal and
a separate explicit Create Note action.

Coordinator Chat must not automatically write Notes, read existing Notes,
search Notes, summarize Notes, or use Notes as hidden context.

## Relationship To Agent Executor

Notes are not Agent Executor logs.

Agent Executor may later create a note from a result through an explicit
operator action, but that is not part of the current Notes surface. Notes must
not automatically ingest Agent Executor output.

## Relationship To Agent Queue

Notes are not queue items.

Queue item comments or notes may exist later, but Workspace Notes remains a
separate widget/capability. No automatic Queue item creation from Notes is
current or planned for the stabilization slice.

## Relationship To Runbook

Runbook evidence and Notes are separate.

Runbook may later attach or link notes, but the current Notes surface must not
merge Runbook evidence storage with Notes.

## Relationship To Git

Notes do not mutate Git.

Notes are not committed automatically. If users later want notes committed to
repository files, that requires a separate explicit feature with its own Git
and file-write safety contract.

## Safety And Privacy

Notes may contain sensitive operator context.

Rules:

- Do not send notes to agents or providers automatically.
- Do not expose notes as hidden context.
- Any future context sharing must be explicit and visible.
- Any future copy, export, or context handoff must show what note content is
  being used.
- No hidden context access.
- No hidden note mutation.

## Non-Goals

This contract and the current foundation do not implement:

- Notebook features
- new Notes storage schema
- legacy state migration
- archive/delete behavior
- autosave
- tags
- folders
- Markdown rendering
- Mermaid rendering
- AI-in-Notes
- Agent Executor integration
- Agent Queue integration
- Runbook integration
- Git mutation
- Terminal or PTY behavior
