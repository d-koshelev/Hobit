# Imported Queue Task Workspace Fix Status

## Status

Status: docs-only status record for the imported Queue task execution
workspace blocker.

This note records the manual-smoke failure, fixed expected behavior, and rerun
instruction. It does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue scheduling, Agent Executor execution, validation
automation, Git mutation, Terminal launch, provider tools, automatic
finalization, automatic commit, push, rollback, or dependency execution.
Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Observed Failure

Manual smoke reached imported task 001, but the task could not be made ready:

- task 001 imported and queued;
- task 001 moved to Blocked / queued;
- `Run task` was disabled;
- validation was disabled because the execution workspace was missing;
- `Set task workspace` was visible but not clickable/actionable.

This blocker must not be bypassed with Codex text execution, shell commands,
raw SQLite edits, Terminal launch, provider tools, hidden context reads, or
manual storage mutation.

## Fixed Expected Behavior

After the fix:

- imported tasks inherit the current workspace root when one is available;
- `Set task workspace` is a typed Queue action when execution workspace is
  missing;
- setting the workspace records only the workspace and does not run the task;
- validation and run actions become available according to normal Queue
  blockers after the workspace is present.

Prompt-pack import must not auto-run tasks. Queue task run and validation must
require explicit typed operator actions.

## Rerun Instruction

1. Restart Hobit.
2. Import the folder prompt pack.
3. Create Queue items through the visible import action.
4. Click Queue for run on task 001.
5. Verify task 001 has an execution workspace.
6. Verify only `Queue Disabled` remains as the task 001 run blocker.

## Non-Goals

- No source code, tests, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No Queue runtime, scheduler, Autorun, dependency execution, validation
  runner, prompt-pack import, Git, Terminal, or provider behavior changes.
- No automatic task run, validation, finalization, commit, push, rollback, or
  follow-up creation.
