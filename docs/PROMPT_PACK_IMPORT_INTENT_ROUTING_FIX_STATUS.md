# Prompt Pack Import Intent Routing Fix Status

## Status

Status: docs-only status record for the second self-development manual-smoke
failure and the prompt-pack import intent-routing fix expectation.

This document records observed smoke facts, expected fixed behavior, rerun
instructions, and pass/fail criteria. It does not add frontend behavior,
backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
Executor execution, validation automation, Diff Review execution, Git
mutation, Terminal launch, provider tools, automatic finalization, automatic
commit, push, rollback, or dependency execution. Current implemented widget
behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

## Second Failed Manual Smoke Facts

The operator entered this initial Workspace Agent request:

```text
Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:

C:\Users\Dmitry\Documents\prj\hobit-realistic-dogfooding-smoke-pack
```

Workspace Agent returned:

```text
typed product action unavailable: no active preview
```

Observed safety facts:

- No Codex run occurred.
- No shell command occurred.
- No raw SQLite/tool-loop investigation or write occurred.
- No Queue item was created.
- No Queue item was run.
- No Queue Autorun, Terminal command, validation run, coordinator
  finalization, commit, push, or rollback occurred.

Root cause:

- The initial import-start request was treated as a prompt-pack import
  confirmation.
- Confirmation correctly requires an active preview, so the route fail-fasted
  instead of starting the preview.
- The safety guard prevented fallback Codex/shell/SQLite execution, but the
  intent classifier was wrong for import-start text with a path.

## Fixed Behavior To Verify

After the intent-routing fix:

- Import-start text with an explicit path starts the prompt-pack import preview
  flow instead of being treated as confirmation.
- The preview card is actionable and visible to the operator.
- `Create Queue items` is available only for an active valid preview.
- Confirmation requires an active preview.
- `Cancel` clears/cancels the active preview without creating Queue items.
- True confirmation text without an active preview fail-fasts with a visible
  no-active-preview message.
- Import does not auto-run Queue tasks and does not route product actions
  through Codex, shell commands, raw SQLite, Terminal, provider tools, Git, or
  hidden Workspace reads.

## Rerun Instructions

1. Restart Hobit.
2. Open the Workspace Agent surface in the smoke Workspace.
3. Paste this exact import prompt:

   ```text
   Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:

   C:\Users\Dmitry\Documents\prj\hobit-realistic-dogfooding-smoke-pack
   ```

4. Expect an actionable prompt-pack import preview card, not the
   `typed product action unavailable: no active preview` failure.
5. Review the preview. If path/folder source reading is still unsupported,
   the preview/card must say so visibly and provide the typed import surface
   for pasted source; it must not fake success.
6. Once the preview is valid and shows the intended selected items, click
   `Create Queue items`.
7. Verify the result card lists created Queue item ids.
8. Open Agent Queue / QueueV2 and verify imported tasks are draft/manual items
   and dependency state is visible.

## Pass Criteria

The rerun passes only if all of these are true:

- The exact import-start prompt starts or opens the prompt-pack import preview
  flow.
- The initial prompt is not classified as confirmation.
- A valid active preview exposes `Create Queue items` and `Cancel`.
- `Create Queue items` uses the typed Queue materialization path and shows
  created Queue item ids.
- `Cancel` clears/cancels the active preview and creates no Queue items.
- True confirmation text without an active preview fail-fasts visibly.
- No Codex run, shell command, raw SQLite/tool-loop, Queue run, Queue Autorun,
  validation run, coordinator finalization, Terminal command, provider tool,
  commit, push, rollback, or hidden automation occurs during import start,
  cancel, or creation.

## Fail Criteria

The rerun fails if any of these occur:

- The exact import-start prompt returns `typed product action unavailable: no
  active preview`.
- The initial import-start prompt is treated as confirmation.
- Preview creation requires Codex, shell commands, raw SQLite inspection, or
  storage reverse-engineering.
- The preview lacks `Create Queue items` or `Cancel` when it is valid and
  creation is available.
- Clicking `Create Queue items` does not list created Queue item ids.
- Queue items auto-run or Queue Autorun starts as part of import.
- Any automatic finalization, commit, push, rollback, Terminal launch,
  provider tool call, hidden Workspace read, or hidden mutation occurs.

## Non-Goals

- No source code, test, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No local folder reader, zip reader, recursive prompt-pack scan, or
  multi-file Tauri prompt-pack reader is added by this document.
- No Queue runtime, scheduler, Autorun, dependency execution, validation,
  Diff Review, finalization, commit, push, or rollback semantic changes.
