# Queue v2 Foundation Status

## Purpose

This document records the implementation status after the Queue v2 view-model
and board-shell foundation work.

It is a docs-only status record. It does not add frontend behavior, backend or
Rust behavior, tests, storage/schema, scheduling, dependency execution, Git
mutation, Terminal launch, or hidden automation.

## Status

Queue v2 foundation is partially implemented as a frontend view/read model and
board shell over existing Agent Queue data.

The foundation is intentionally conservative: current Queue data is mapped into
Queue v2 lifecycle, lane, next-action, eligibility, capacity, and inspector
snapshot shapes without changing persisted Queue task storage or runtime
execution behavior.

## Implemented Foundation

### View model selectors

- `selectQueueV2ViewModel` derives a Queue v2 read model from existing
  `AgentQueueTask` records, selected task id, visible worker summaries, global
  Queue execution state, Autorun armed state, and paused Queue tags.
- The selector returns derived task view models, lane groupings, top-level
  counts, capacity summary, and an optional selected-task inspector snapshot.
- Inputs are treated as read-only; the selector preserves task order and does
  not mutate the source task array.

### Lifecycle mapping

- Current Queue task statuses are conservatively mapped into Queue v2 lifecycle
  states.
- Existing `completed` task data maps to `report_ready`, not `finalized`.
- Existing `review_needed` task data maps to `review_required`.
- Explicit closure outcomes are required before a task derives as
  `finalized`.
- Failed, cancelled, closure-blocked, and needs-changes cases remain distinct
  from accepted closure.

### Lanes

The implemented board lane model derives these Queue v2 lanes:

- `intake_draft`
- `ready`
- `running`
- `review`
- `blocked`
- `closed`

Lane derivation keeps report-ready and review-required tasks in `review` until
explicit closure, keeps dependency or safety blockers in `blocked`, and places
terminal cancelled tasks in `closed` only when no reviewable output exists.

### Next action model

- `queueV2NextActionForTask` derives one primary action per task.
- Implemented actions include draft editing, run-now, assignment/capacity
  waiting, dependency/blocker resolution, review/report actions, follow-up or
  change-request hints, retry/rerun, cancelled close, and history viewing.
- Next actions are derived from lifecycle, eligibility, blocked reason codes,
  assignment state, reviewable output, and review action hints.

### Eligibility, blockers, and capacity

- The view model derives `QueueTaskEligibility` for queued/ready tasks.
- Blocked reasons include disabled Queue state, open or invalid dependency
  graph, missing prompt/run settings, context budget or blocked warnings,
  paused tags, unavailable runtime, unavailable capacity, paused workers,
  operator review requirements, and safety blockers.
- Worker capacity is a read-only summary of visible worker snapshots,
  available/running/paused/unavailable slot counts, eligible-now count,
  review-needed count, Queue enabled state, and Autorun armed state.
- Dry-run position is assigned for currently eligible tasks only as a view
  derivation; it does not dispatch work.

### Board shell

- `AgentQueueV2Board` is implemented as a visible Queue Board pane.
- The board renders a compact command summary, lane columns, compact task
  cards, selected-card state, and a collapsed activity drawer shell.
- The board is wired into the existing Agent Queue widget while keeping the
  existing Flow Map available.
- Cards expose lane and task identifiers for focused UI tests.

### Inspector snapshot foundation

- The selector can derive a selected-task `QueueInspectorSnapshot` with title,
  objective, lifecycle, closure state, lane, priority, next action, secondary
  actions, dependency state, eligibility, blockers, worker assignment, run
  summary, report summary, review decision state, context summary, attachment
  summary, source ref summary, and activity group ids.
- This is a foundation model only. The full right inspector product surface is
  not complete.

### Tests

- Queue v2 selector tests cover status-to-lifecycle mapping, lane derivation,
  report-ready and review-required safety, explicit-closure-only finalization,
  dependency/tag blockers, next-action derivation, counts, capacity,
  selected-task inspector snapshot, and input immutability.
- Agent Queue widget tests cover the Queue Board v2 shell, selected-task run
  controls integration, Flow Map availability, and lane/card rendering checks.

## Remaining Work

These items remain future work and require separate focused implementation
blocks where appropriate:

- Full selected-task inspector: complete the right decision surface with one
  primary next action, review controls, task summaries, run/report summaries,
  and secondary safe actions.
- Left rail: add compact filters, worker/capacity summaries, ready-now counts,
  review-required counts, and Autorun state without duplicating task detail.
- Activity drawer: replace the shell with bounded grouped lifecycle, run,
  validation, review, closure, capacity, and safety detail; keep it collapsed
  by default.
- Dependency model: add durable dependency refs, graph validation, cycle
  rejection, dependency-blocked summaries, and dependency-aware UI once a
  focused data/API contract exists.
- Capacity model: harden worker/provider capacity snapshots, paused workers,
  paused tags, compatibility explanation, timestamps/source, and UI summary.
- Parallel dry-run groups: compute and show independent eligible task groups as
  planner/dry-run output only.
- Runtime/scheduler changes: no parallel dispatch, dependency-aware dispatch,
  backend scheduler, durable runner, reconnect/resume, server worker, or
  response parser/validator has been implemented.

## Safety Status

Queue v2 foundation preserves the current operator-control boundary:

- No hidden auto-run.
- No unarmed dispatch.
- No auto-commit.
- No auto-push.
- No auto-finalize.
- No automatic acceptance from successful execution.
- No Git mutation from Queue.
- No Terminal launch from Queue.
- No hidden dependency execution.
- No provider/tool execution hidden behind lane movement or card rendering.
- No backend/runtime behavior change.
- No storage/schema change.

Eligibility, capacity, lanes, next actions, inspector snapshots, and dry-run
positions are view-model derivations only. They organize and explain current
Queue data; they do not run, accept, commit, push, finalize, or schedule work.

## Manual Smoke Checklist

Use this checklist for the current Queue v2 foundation after normal app
validation is healthy:

- Open a Workspace with Agent Queue available.
- Add or create tasks in draft, queued/ready, running, completed/review,
  failed/blocked, and cancelled-like states where the current UI permits it.
- Confirm Queue Board is visible and Flow Map remains available.
- Confirm task cards appear in the expected Queue v2 lanes:
  `Intake / Draft`, `Ready`, `Running`, `Review`, `Blocked`, and `Closed`.
- Confirm completed/report-ready work appears in `Review`, not `Closed`, until
  an explicit closure outcome exists.
- Confirm review-needed or needs-changes work shows a review/change-oriented
  next action instead of accepted/finalized copy.
- Confirm a ready task with a compatible idle worker shows a run-oriented next
  action.
- Confirm a ready task with no compatible capacity shows assignment or
  capacity-waiting copy, not hidden execution.
- Confirm a task with an open dependency or paused tag moves to `Blocked` with
  a visible blocker summary.
- Confirm selecting a board card updates the selected task without starting a
  run.
- Confirm the command summary counts eligible-now, review-needed, running, and
  capacity facts without claiming scheduling.
- Confirm the activity drawer is collapsed by default and does not replace the
  board as the normal operating surface.
- Confirm manual run controls, if used through existing Queue paths, still
  require explicit operator action.
- Confirm Autorun remains explicitly armed/off and does not start because a
  card moved lanes.
- Confirm no commits, pushes, task finalization, Terminal launches, or runtime
  changes occur from viewing or selecting Queue v2 board cards.

## Contract Notes

The authoritative Queue v2 planning contracts remain:

- `docs/QUEUE_V2_PRODUCT_CONTRACT.md`
- `docs/QUEUE_V2_STATE_MODEL.md`

This status record does not make remaining planned Queue v2 work current. It
only records the foundation already present after the view-model and board-shell
implementation blocks.
