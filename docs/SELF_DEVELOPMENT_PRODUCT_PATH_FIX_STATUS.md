# Self-Development Product Path Fix Status

## Status

Status: docs-only status record for the self-development product path blocker
rerun after the prompt-pack import product-action and intent-routing fixes.

This document records observed blockers, fixed expected behavior, rerun
instructions, and pass/fail criteria. It does not add frontend behavior,
backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
Executor execution, validation automation, Diff Review execution, Git
mutation, Terminal launch, provider tools, automatic finalization, automatic
commit, push, rollback, or dependency execution. Current implemented widget
behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

## Observed Blockers

The self-development manual smoke exposed the remaining product-path blockers:

- Folder path source was unavailable for the prompt-pack import path.
- `prompt-batch.json` was parsed, but prompt bodies from referenced pack files
  were missing.
- Pasted Markdown imported one draft task instead of the two-task pack.
- The imported task had no ready/run action available from the Queue surface.
- Validation was unavailable for the Queue surface.

These blockers must be reported as visible unsupported or failed states when
they occur. They must not be bypassed with Codex natural-language execution,
raw SQLite inserts, shell commands, manual database edits, hidden folder reads,
Terminal launch, provider tools, or fake success.

## Fixed Expected Behavior

After the product-path fixes, the manual smoke rerun should show:

- The folder path source reads the prompt-pack files from the explicit operator
  path.
- Preview shows two tasks with populated prompt bodies:
  `001-safe-docs-noop` and `002-dependent-follow-up`.
- Preview shows the dependency from task 002 to task 001.
- `Create Queue items` creates Queue items through typed product
  services/actions.
- Task 002 is blocked by task 001 after creation.
- Task 001 can be explicitly prepared/run through visible Queue controls.
- Validation can be explicitly requested through visible Queue controls when
  the validation runner, action bridge, and execution workspace are available.

Prompt-pack import must not auto-run tasks. Queue task run and validation must
require explicit operator action.

## Exact Rerun Steps

1. Restart Hobit desktop.
2. Open or create a dedicated self-development smoke Workspace.
3. Open Workspace Agent / Workspace Chat and Agent Queue / QueueV2.
4. Confirm Queue Autorun is not armed unless the operator is explicitly
   testing Autorun disabled/no-start behavior.
5. Paste this exact import prompt into Workspace Agent:

   ```text
   Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:

   C:\Users\Dmitry\Documents\prj\hobit-realistic-dogfooding-smoke-pack
   ```

6. Verify an actionable prompt-pack import preview appears.
7. Verify the preview is sourced from the folder path and not from Codex,
   shell, raw SQLite, Terminal, provider tools, or hidden context.
8. Verify preview shows exactly the intended two tasks:
   `001-safe-docs-noop` and `002-dependent-follow-up`.
9. Verify both tasks have non-empty prompt bodies from their referenced
   prompt-pack files.
10. Verify preview shows task 002 depends on task 001, with no unresolved
    dependency for the fixture.
11. Verify validation commands are shown as suggestions only and have not run.
12. Click `Create Queue items`.
13. Verify the result card lists the created Queue item ids for both tasks.
14. Open Agent Queue / QueueV2.
15. Verify both imported tasks are present as draft/manual Queue items.
16. Verify task 002 is visibly blocked by task 001.
17. Open task 001 details.
18. Verify task 001 has an explicit prepare/run action only after the operator
    opens the appropriate visible Queue action path.
19. Click prepare/run for task 001 only if the smoke run is intended to verify
    execution readiness.
20. Verify no task starts before that explicit prepare/run action.
21. Open task 001 `Files / Validation`.
22. Click `Request validation` only if the validation action is enabled.
23. Verify validation transitions through a visible requesting/running/result
    or unavailable state.
24. Verify validation does not finalize task 001, mark task 002 ready, create
    commits, push, roll back, launch Terminal, call providers, start Autorun,
    or start another task.

## Pass Criteria

The product-path rerun passes only if all of these are true:

- The exact import prompt opens a preview and is not treated as confirmation.
- Folder path source reads the explicit prompt-pack files.
- Preview shows two tasks with populated bodies.
- Preview shows task 002 depends on task 001.
- `Create Queue items` creates two Queue items through typed product
  services/actions.
- QueueV2 shows task 002 blocked by task 001.
- Task 001 exposes an explicit prepare/run path and does not run before the
  operator uses it.
- Validation can be explicitly requested, or the UI shows a clear unavailable
  reason.
- No prompt-pack import auto-run, Queue Autorun start, hidden execution,
  automatic validation, automatic finalization, automatic commit, automatic
  push, rollback execution, Terminal launch, provider tool call, shell command,
  raw SQLite operation, or hidden Workspace read occurs.

## Fail Criteria

The rerun fails if any of these occur:

- Folder path source is unavailable without a visible unsupported reason.
- `prompt-batch.json` parses but prompt bodies are missing.
- Pasted Markdown or folder import creates only one draft task for the
  two-task fixture.
- Queue creation requires Codex text, shell commands, raw SQLite, storage
  reverse-engineering, or manual database edits.
- The result card omits created Queue item ids.
- Task 002 is not visibly blocked by task 001.
- Task 001 has no explicit prepare/run action when execution readiness is
  expected.
- Validation cannot be requested and no visible unavailable reason is shown.
- Any task auto-runs during import or validation.
- Any automatic finalization, commit, push, rollback, Terminal launch,
  provider tool call, hidden context read, or hidden mutation occurs.

## Non-Goals

- No source code, tests, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No Queue runtime, scheduler, Autorun, or dependency execution semantic
  changes.
- No prompt-pack import auto-run.
- No Queue task run without explicit operator action.
- No validation without explicit operator action.
- No automatic finalization, commit, push, rollback, or follow-up creation.
- No raw SQLite inserts, shell commands, or `node:sqlite` as product behavior.
