# Notes Widget Product Contract

## Purpose

This contract defines the product and technical direction for moving Notes from
the current single saved draft into a real multi-note widget.

It is a docs/contracts-only product contract. It does not implement frontend
UI, backend commands, Tauri commands, storage/schema changes, autosave, search,
pinning, archive/delete behavior, Agent integration, Queue integration, Git
behavior, Terminal behavior, or PTY behavior.

The broader Notebook/Markdown direction remains governed by
`docs/NOTES_WIDGET_CONTRACT.md`. This document narrows the near-term product
slice for a workspace-local multi-note Notes widget.

## Current State

Current Notes is a workspace-local multi-note product UI:

- It uses the workspace-local notes storage/API foundation.
- It can create, list, read, update, filter, edit, save, and pin notes.
- It uses explicit Save.
- It has no autosave.
- It has no delete/archive UI.
- It has no tags.
- It has no linked tasks.
- It has no Agent Executor integration.
- It has no Agent Queue integration.
- Coordinator Chat can create a new workspace-local Note from an approved
  create-Note proposal using only visible title, body, and pinned inputs.
  Existing Notes content is not read or used as hidden Coordinator context.
- It has no Runbook integration.
- It has no Git integration.

Current Notes widget UI behavior should not be described as autosave,
archive/delete, tags, Markdown/Notebook, AI-in-Notes, or hidden context
behavior until those features exist.

## Current Implementation Foundation

The backend/storage/API foundation now exists for workspace-local notes:

- SQLite stores `notes` records with `note_id`, `workspace_id`, `title`, `body`,
  `pinned`, `archived`, `created_at`, and `updated_at`.
- `hobit-app` exposes create, list, read, and update methods scoped to a
  Workspace.
- Tauri commands and frontend Workspace API methods expose those same
  create/list/read/update operations for future UI work.
- Lists return non-archived notes with pinned notes first, then most recently
  updated notes.
- Deleting a Workspace deletes its workspace-local notes.

The current widget consumes this foundation for the workspace-local Notes
product UI. Autosave, note deletion/archive commands, tags, linked context, and
Agent/Queue/Runbook/Git integrations remain unimplemented.

## Target One-Sentence Role

Notes: capture and organize local workspace notes.

## Target Product Behavior

Future Notes should support:

- multiple notes
- note list
- selected note editor
- new note
- note title or rename behavior
- search
- pinned notes
- manual save or autosave depending on the implementation slice
- updated timestamp
- empty state
- delete or archive later
- local Workspace scope

These features should be added only when the backing storage/API and UI behavior
exist. Future UI must not overclaim unavailable note capabilities.

## Note Model

The first multi-note model should stay small.

Future v1 fields:

- `note_id`
- `workspace_id`
- `title`
- `body`
- `created_at`
- `updated_at`
- `pinned`
- `archived`

Later fields:

- `source`
- `linked_context`
- `tags`

The first implementation should not add tags, backlinks, linked tasks, or rich
document metadata unless a later block explicitly scopes those fields.

## Storage Scope

Notes should be scoped to a Workspace for the first multi-note product slice.

Rules:

- A note belongs to one Workspace.
- Notes are not global by default.
- Workspace notes should not leak into another Workspace.
- Deleting a Workspace should delete its workspace-local notes when note storage
  exists.
- Deleting a Notes widget should not necessarily delete workspace notes unless a
  later contract explicitly designs that behavior.
- Global notes remain a future explicit scope described by
  `docs/NOTES_WIDGET_CONTRACT.md` and ADR-0007; they are not the default MVP
  path for this product slice.

## MVP Implementation Direction

The first implementation after this contract is a backend/storage/API
foundation, not a visual-only multi-note UI.

Recommended MVP storage/API capabilities:

- create note
- list notes
- read note
- update note
- pin note through the scoped create/update payload
- delete or archive note later only if scoped and safe

Tags should not be implemented in the first slice unless a later prompt
explicitly scopes them and the data model remains small.

## UI Direction

Future product UI should include:

- left note list
- search input
- new note button
- selected note editor
- save or autosave state
- pinned section if supported
- empty state
- clear current note title
- compact metadata such as updated time

The UI must follow `docs/PRODUCT_UI_VISUAL_CONTRACT.md`: shared WidgetFrame
language, compact controls, honest empty/error states, no fake future controls,
and no clutter.

## Save And Autosave Policy

MVP may keep explicit Save for safety.

An Operational version may add autosave if it has clear state reporting:

- `saving`
- `saved`
- `unsaved`
- `error`

Autosave errors must be visible. Notes must not silently lose edits. If autosave
is implemented later, the UI must make save state understandable without forcing
the operator to inspect logs.

## Relationship To Agent Executor

Notes are not Agent Executor logs.

Agent Executor may later create a note from a result through an explicit
operator action, but that is not part of the multi-note MVP. Notes should not
automatically ingest Agent Executor output.

## Relationship To Agent Queue

Notes are not queue items.

Queue item comments or notes may exist later, but Workspace Notes remains a
separate widget/capability. No automatic queue item creation from Notes is part
of the MVP.

## Relationship To Interactive Agent

Coordinator Chat may create a Note through an approved create-Note proposal and
a separate explicit Create Note action.

Coordinator Chat must not automatically write Notes, read existing Notes, or
use Notes as hidden context.

## Relationship To Runbook

Runbook evidence and Notes are separate in the MVP.

Runbook may later attach or link notes, but the first multi-note slice should
not merge Runbook evidence storage with Notes.

## Relationship To Git

Notes do not mutate Git.

Notes are not committed automatically. If users later want notes committed to
repository files, that requires a separate explicit feature with its own Git and
file-write safety contract.

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

## UI Overclaim Rules

Future UI must stay honest:

- Do not show multi-note UI until the product UI is implemented.
- Do not show search until search works.
- Do not show pinned note controls until they work end to end.
- Do not show autosave until autosave exists.
- Do not show tags until tags exist.
- Do not show Agent, Queue, Runbook, or Git note actions until those actions are
  explicitly implemented and approval-aware where needed.

## Recommended Follow-Up Blocks

- Block 186  Notes product UI.
- Later  Notes autosave polish.
- Later  Notes search/pin/archive polish.
- Later  Optional Note from Agent Executor result.
- Later  Optional copy Interactive Agent transcript to Note.

## Non-Goals

This contract and the current foundation still do not implement:

- frontend UI changes
- note list
- note search
- autosave
- archive/delete behavior
- tags
- Agent Executor integration
- Agent Queue integration
- Interactive Agent integration
- Runbook integration
- Git mutation
- Terminal or PTY behavior
