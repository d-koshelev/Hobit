# Diff Review Workflow Status

## Status

Status: docs-only status record for Diff Review Item Workflow Block 001.

This document records the implemented Diff Review workflow surface and the
remaining gaps after the functional block. It does not add frontend behavior,
backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
Executor execution, Git mutation, Terminal launch, provider tools, automatic
finalization, commit, push, rollback, or dependency unblocking.

Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented Summary

Block 001 established Diff Review as an explicit Queue item workflow, not a
new runtime.

- Audit: `docs/DIFF_REVIEW_WORKFLOW_AUDIT.md` inspected Queue task models,
  Workspace Chat report cards, QueueV2 details, validation evidence, prompt
  pack metadata, Direct Work result surfaces, and read-only Git/diff sources.
- Model/checklist: the frontend model has Diff Review item vocabulary,
  creation eligibility, source/report metadata, linked-review lookup, and a
  bounded review prompt model. The expected checklist covers actual diff,
  report/evidence, validation, declared scope, forbidden files, tests, commit
  title, and dependent-task readiness.
- Input snapshot resolver: Diff Review creation can derive source information
  from visible Queue task/report state, prompt-pack text, validation evidence,
  Direct Work/result summaries, and explicit read-only Git availability where
  supported. Missing inputs are surfaced as warnings rather than treated as
  success.
- Queue item creation: QueueV2 can explicitly create an independent manual
  Diff Review Queue item from an implementation task with a worker report or
  coordinator-review state. The item reuses the existing Queue create bridge,
  keeps source linkage in frontend/model state and visible task text, and does
  not create a second Queue runtime or storage path.
- Workspace Chat action/card: Workspace Chat Queue report action cards can
  explicitly create a queued Diff Review item from a report card and track the
  linked review item in current-session card state. The action creates only a
  Queue record and does not run or finalize work.
- QueueV2 display: QueueV2 surfaces Diff Review item type, source item,
  report/commit metadata where available, review target summary, linked-review
  markers on source rows/details, and warning states for unavailable evidence.

## Expected Behavior

- A Diff Review item is an independent Queue item linked to a source
  implementation task/report where possible.
- Creation is explicit. No Diff Review item is created automatically from
  worker completion, validation results, Workspace Chat messages, or Queue
  state transitions.
- The created item is manual/read-only by default and must not edit code unless
  a future operator prompt explicitly changes that scope.
- Creating a Diff Review item must not auto-run Queue work, Agent Executor,
  Codex, validation, Git diff reads, provider calls, Terminal commands, source
  finalization, dependent unblocking, commit, push, or rollback.
- The review prompt/checklist asks the reviewer to report on actual diff,
  source report/evidence, validation status, declared scope, forbidden files,
  tests, expected commit title, and dependent-task readiness.
- Missing live diff, validation evidence, source report, source links, commit
  metadata, or expected commit title must be visible as warnings or unsupported
  states.
- Diff Review output is evidence for a coordinator/operator decision. It does
  not automatically finalize, accept, reject, unblock dependents, commit, push,
  or rollback.

## Manual Smoke Checklist

- Select an implementation Queue task that has a report or visible evidence.
- From Workspace Chat, show/open the Queue report action card for that task.
- Click the explicit `Create Diff Review` action.
- Verify a separate Diff Review task appears in QueueV2 through existing Queue
  state.
- Verify the created item is independent from the source task and has source
  links or source metadata in the card/details/prompt where available.
- Verify the Diff Review prompt is read-only by default and asks for a report,
  not code edits.
- Verify creation does not start Agent Executor, Codex, Queue Autorun,
  validation, Git mutation, Terminal, commit, push, rollback, source
  finalization, or dependent unblocking.
- Verify QueueV2/source details show a linked Diff Review marker when the link
  is available.
- Verify missing diff, validation evidence, or source report are visible as
  warnings instead of fake success.
- Repeat from the QueueV2 selected-task details action when available and
  confirm the same no-auto-run behavior.

## Remaining Gaps

- Executing the Diff Review item through an assigned agent still uses existing
  Queue/Executor controls and is not a dedicated review runtime.
- Diff Review reports are not parsed into a typed coordinator decision.
- Coordinator finalization gating is not enforced automatically from Diff
  Review results, validation results, or worker reports.
- Rollback workflow remains marker/recommendation only; no rollback execution
  path is implemented.
- Live Git diff snapshot is unavailable when an explicit repository root or
  execution workspace is absent, browser fallback is active, Git is
  unavailable, the path is not a repository, or untracked patch previews are
  needed.
- Durable typed Diff Review source links and linked review ids remain limited
  by the current Queue DTO/storage shape; source metadata is preserved through
  visible task text and current-session/frontend model state where possible.

## Recommended Next Blocks

1. Coordinator finalization plus commit hash workflow: record explicit
   coordinator decisions, accepted commit/no-change/follow-up/blocked closure,
   and visible commit hash metadata without auto-commit or auto-push.
2. Rollback/follow-up workflow: turn rollback recommendations and requested
   changes into explicit follow-up Queue items or visible rollback-request
   records without executing rollback automatically.
3. Self-development readiness smoke: run the full Workspace Chat -> QueueV2 ->
   Validation -> Diff Review -> coordinator decision dogfooding path on a
   small Hobit implementation task and record manual acceptance gaps.

## Non-Goals

- No source code, test, frontend, backend, Rust, Tauri, storage, schema, or
  runtime changes in this status block.
- No second Queue runtime/storage path.
- No Queue scheduler, Sequential Runner, or Autorun semantic changes.
- No automatic dependent task unblocking.
- No default code edits from Diff Review.
- No automatic Diff Review execution.
- No automatic finalization, acceptance, commit, push, rollback, reset, clean,
  stash, checkout, or Terminal launch.
- No hidden Workspace, file, Notes, Knowledge, Git, JDBC, Terminal, or provider
  context access.
