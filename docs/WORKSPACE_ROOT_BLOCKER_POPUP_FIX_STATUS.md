# Workspace Root, Blocker, And Popup Resize Fix Status

## Status

Status: docs-only status record for
`WORKSPACE-ROOT-BLOCKER-POPUP-STATUS-01`.

This note records targeted fixes and the manual smoke rerun step for imported
Queue task workspace roots, QueueV2 blocker visibility, and shared popup mouse
resize behavior. It does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue scheduling, Agent Executor execution, validation
automation, Git mutation, Terminal launch, provider tools, automatic
finalization, automatic commit, push, rollback, or dependency execution.
Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Observed Failures

- Imported task 001 was queued but blocked by missing execution workspace.
- QueueV2 reported the current workspace root as unavailable even when a Hobit
  Workspace was active.
- `Set task workspace` was disabled for the missing-workspace task.
- Blocked task cards and task details made blocker reasons hard to find.
- Shared popup windows were not mouse-resizable.

## Fixed Expected Behavior

- Imported Queue tasks inherit the current workspace root when one is
  available.
- Missing-workspace Queue tasks can be repaired through typed
  `Set task workspace`.
- Blocker reasons are visible on blocked task cards and in task details.
- Shared popup windows are mouse-resizable.

Prompt-pack import must not auto-run tasks. Queue task run and validation must
require explicit typed operator actions.

## Manual Smoke Rerun

1. Restart Hobit.
2. Preferably re-import the smoke pack cleanly.
3. Click Queue for run on task 001.
4. Verify task 001 has an execution workspace.
5. If Queue is disabled, verify `Queue Disabled` is the only remaining run
   blocker.
6. Verify the blocker reason is visible on the task 001 card.
7. Open the QueueV2 task details popup and verify it resizes with the mouse.

## Non-Goals

- No source code, tests, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No Queue runtime, scheduler, Autorun, dependency execution, validation
  runner, prompt-pack import, Git, Terminal, or provider behavior changes.
- No automatic task run, validation, finalization, commit, push, rollback, or
  follow-up creation.
