# Prompt Pack Import Product Action Fix Status

## Status

Status: docs-only status record for the failed self-development manual smoke
and the product-action wiring fix expectation.

This document records observed smoke facts, expected fixed behavior, and the
exact rerun procedure. It does not add frontend behavior, backend/runtime
behavior, storage/schema changes, Queue scheduling, Agent Executor execution,
validation automation, Diff Review execution, Git mutation, Terminal launch,
provider tools, automatic finalization, automatic commit, push, rollback, or
dependency execution. Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Failed Manual Smoke Facts

The failed smoke reached the prompt-pack import preview but did not complete
the product action path.

- Preview passed: the prompt-pack import preview rendered and recognized the
  selected self-development fixture items.
- The expected `Create Queue items` and `Cancel` buttons were absent from the
  actionable preview card.
- Text confirmation routed back through Codex natural-language execution
  instead of invoking a typed product action.
- The run consumed 159 steps and approximately 3M input tokens while trying to
  complete what should have been a direct product action.
- Investigation drifted into raw SQLite and shell inspection to determine
  whether tasks had been created.
- No Queue tasks were created.
- No Queue item was run.
- No coordinator finalization occurred.
- No commit was created.
- No push occurred.

## Product-Action Fix Expected Behavior

After the fix, prompt-pack import confirmation must stay inside the app-native
product action path.

- The import preview renders as an actionable preview card, not only as text
  for conversational confirmation.
- The card includes an explicit `Create Queue items` action and a `Cancel`
  action when preview is valid and creation is available.
- Clicking `Create Queue items` calls the typed Workspace/Queue bridge for
  Queue item creation.
- The dependency from `002-dependent-follow-up` to `001-safe-docs-noop` is
  persisted durably through the typed Queue dependency/update path.
- The result card shows the created Queue task ids.
- QueueV2 shows task 002 blocked by task 001.
- The confirmation path does not route through Codex, shell commands, raw
  SQLite, or reverse-engineered storage behavior.

## Rerun Procedure From Import Preview

Start from a valid `Prompt-pack import preview` card for the self-development
fixture.

1. Verify the preview is valid and shows tasks 001 and 002 selected.
2. Verify the preview card shows `Create Queue items` and `Cancel`.
3. Click `Cancel` once in a disposable preview attempt.
4. Confirm no Queue tasks are created and no Codex/shell/SQLite path starts.
5. Recreate or reopen the valid preview.
6. Click `Create Queue items`.
7. Verify the result card appears and lists created task ids for
   `001-safe-docs-noop` and `002-dependent-follow-up`.
8. Open QueueV2 from the result action or Agent Queue widget.
9. Verify both imported tasks are present as draft/manual Queue items.
10. Verify QueueV2 shows task 002 blocked by its dependency on task 001.
11. Verify no Queue run, Agent Executor run, validation run, finalization,
    commit, push, rollback, Terminal command, provider tool call, shell
    command, or raw SQLite operation occurred during import creation.

## Pass Criteria

The rerun passes only if all of these are true:

- A valid import preview exposes explicit `Create Queue items` and `Cancel`
  product actions.
- `Cancel` exits the preview without creating tasks or invoking Codex/shell/
  SQLite.
- `Create Queue items` creates Queue tasks through typed app services/actions.
- The result card shows the created task ids.
- QueueV2 shows task 001 and task 002.
- QueueV2 shows task 002 blocked by task 001.
- No Codex natural-language confirmation, shell command, raw SQLite operation,
  Queue run, Agent Executor run, validation run, finalization, commit, push,
  rollback, Terminal launch, or hidden automation occurs.

## Fail Criteria

The rerun fails if any of these occur:

- The preview lacks `Create Queue items` or `Cancel`.
- Confirmation requires typing natural language to Workspace Agent/Codex.
- Queue creation depends on shell commands, raw SQLite, storage
  reverse-engineering, or manual DB edits.
- The result card omits created task ids.
- QueueV2 does not show both tasks.
- Task 002 is not visibly blocked by task 001 after creation.
- Any task starts, finalizes, commits, pushes, rolls back, launches Terminal,
  calls provider tools, or performs hidden execution as part of import
  creation.

## Recommended Next Work

1. Rerun the self-development manual smoke from the prompt-pack import preview
   and record pass/fail evidence in
   `docs/SELF_DEVELOPMENT_READINESS_STATUS.md`.
2. Add rollback/follow-up hardening so rollback-required and requested-changes
   outcomes can create explicit follow-up records without executing rollback.
3. Add live Git diff snapshot support if it is still missing, using only
   explicit repository roots and read-only Git operations.

## Non-Goals

- No source code, test, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No Queue runtime, scheduler, Autorun, or dependency execution semantic
  changes.
- No prompt-pack auto-run.
- No automatic finalization, commit, push, rollback, or follow-up creation.
- No raw SQLite inserts as product behavior.
- No natural-language Codex execution path for import confirmation.
- No hidden Workspace Agent storage reverse-engineering to perform product
  actions.
