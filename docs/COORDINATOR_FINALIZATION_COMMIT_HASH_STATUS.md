# Coordinator Finalization Commit Hash Status

## Status

Status: docs-only status record for Coordinator Finalization + Commit Hash
Workflow Block 001.

This document records what the functional coordinator-finalization block
implemented and what remains. It does not add frontend behavior,
backend/runtime behavior, storage/schema changes, Queue scheduling, Agent
Executor execution, Git mutation, Terminal launch, provider tools, automatic
finalization, commit, push, rollback, or dependency execution.

Current implemented widget behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented Summary

Block 001 established explicit coordinator finalization as the closure step
after implementation reports, validation evidence, and Diff Review evidence.

- Audit: `docs/COORDINATOR_FINALIZATION_COMMIT_HASH_AUDIT.md` inspected Queue
  lifecycle fields, coordinator status, closure state, reports, dependencies,
  validation evidence, Diff Review metadata, prompt-pack metadata, Workspace
  Chat controls, QueueV2 actions, and Git commit metadata availability.
- Coordinator decision / commit validation model: the frontend finalization
  model now distinguishes accepted-with-commit, accepted-without-commit,
  requested-changes, follow-up-required, blocked, failed/rejected, rollback
  required, and manual-review style coordinator outcomes. Commit hash/title
  inputs are validated for safe shape and title quality before acceptance.
- Queue finalization service and dependency gates: finalization decisions are
  routed through a shared Queue finalization action path instead of being only
  local card state. The service derives closure state, records visible warnings
  for unsupported verification, and evaluates dependents using the rule that a
  prerequisite is ready only when it is completed and coordinator-finalized.
- Workspace Chat controls: Workspace Chat Queue cards can surface coordinator
  finalization controls, require explicit confirmation for accepting decisions,
  show validation/Diff Review/commit evidence, and report dependency impact
  without starting dependent work.
- QueueV2 display/actions: QueueV2 task details can show coordinator state,
  commit hash/title where supplied, dependency-gate impact, and explicit
  finalization actions alongside existing validation and Diff Review evidence.

The block preserves the existing Queue runtime/storage path. It does not add a
second Queue runtime, scheduler, backend worker, durable finalization storage
table, automatic execution path, or Git mutation path.

## Expected Behavior

- A Queue item is not finalized until the coordinator/operator makes an
  explicit decision.
- Validation results and Diff Review reports are evidence for review. They are
  not acceptance, finalization, commit creation, push approval, rollback
  approval, or dependent-task release by themselves.
- `accept_with_commit` is supported when a commit hash is supplied, and the
  supplied commit hash/title are recorded in the visible coordinator
  finalization result when the current Queue state path can preserve them.
- `accept_without_commit` is supported only as an explicit decision with a
  visible reason, normally for no-change or documentation/status-only closure.
- Generic or low-information commit titles are rejected or warned before
  acceptance. Examples include placeholder titles such as `update`, `fix`,
  `changes`, or an unchanged generic prompt-pack fallback.
- Dependent readiness is gated by accepted/finalized prerequisites. A completed
  worker run, passed validation, or completed Diff Review is not enough by
  itself to make dependent work ready.
- Request-changes, follow-up-required, blocked, failed/rejected,
  rollback-required, and manual-review outcomes keep dependents blocked unless
  a later explicit coordinator decision finalizes the prerequisite.
- Follow-up creation is explicit and does not automatically finalize the source
  item, run the follow-up, or unblock dependents.
- Missing Git lookup, missing durable fields, missing Diff Review linkage, or
  unsupported evidence state is shown as an unsupported/warning state rather
  than fake success.
- No coordinator finalization path auto-runs Queue tasks, arms Autorun,
  launches Agent Executor, creates commits, pushes, rolls back, resets, cleans,
  stashes, checks out branches, launches Terminal, calls providers, or reads
  hidden Workspace context.

## Manual Smoke Checklist

Use a Workspace with Workspace Agent / Workspace Chat and Agent Queue / QueueV2
available.

1. Choose a Queue item that has worker report evidence plus validation and/or
   Diff Review evidence visible in Workspace Chat and QueueV2.
2. Run `accept_without_commit` with an explicit reason for a no-change or
   status-only item. Verify the item becomes coordinator-finalized, no commit
   hash is required, and no commit/push/run/rollback starts.
3. Run `accept_with_commit` with a concrete commit hash and non-generic title.
   Verify the visible finalization result records the hash/title and reports
   Git lookup as verified or explicitly unverified depending on available
   support.
4. Attempt `accept_with_commit` with a generic title such as `update` or
   `fix`. Verify the UI rejects or warns before finalization.
5. Request changes on a review-ready item. Verify coordinator state changes to
   needs-changes/request-changes and dependents remain blocked.
6. Create a follow-up from the finalization/review surface. Verify the
   follow-up Queue item is created only after explicit action and does not
   auto-run or auto-finalize the source item.
7. Verify dependent task gating: a dependent remains blocked when the
   prerequisite is only completed, validated, or Diff Reviewed; it becomes
   ready only after the prerequisite is explicitly accepted/finalized.
8. Verify QueueV2 task details display coordinator state, closure state,
   commit hash/title when supplied, validation evidence, Diff Review evidence,
   and dependency-gate impact.
9. Verify Workspace Chat displays the same coordinator state/result summary as
   QueueV2 for the selected Queue item.
10. Verify no Queue task auto-runs, Autorun is not armed or started, no commit
    is created, no push occurs, no rollback executes, and no Terminal/provider
    path is launched.

## Remaining Gaps

- Real Git commit lookup remains a follow-up where unavailable. A safe lookup
  should validate an explicit hash/title against an explicit repository root
  without fetch, push, stage, commit, reset, clean, stash, checkout, or hidden
  repository discovery.
- Rollback workflow remains a visible coordinator decision marker and follow-up
  planning path. No rollback execution, reset, clean, stash, checkout, or file
  mutation path is implemented.
- Self-development readiness smoke remains pending: run the full dogfooding
  path from prompt-pack import through QueueV2, execution evidence,
  validation, Diff Review, explicit coordinator finalization, and dependency
  readiness on a small Hobit implementation task.
- Stronger dependency graph visualization remains follow-up work. Current
  readiness/gating summaries are enough for review, but a clearer graph view
  would help larger prompt-pack batches.
- Durable first-class Queue finalization, dependency, prompt-pack, validation,
  Diff Review, and commit metadata fields remain limited by the current Queue
  DTO/storage shape unless a later storage/API block explicitly adds them.

## Safety Record

Block 001 preserves these boundaries:

- no hidden finalization;
- no validation-as-acceptance;
- no Diff Review-as-acceptance;
- no second Queue runtime or storage path;
- no Queue scheduler, Sequential Runner, or Autorun semantic changes;
- no automatic dependent task start;
- no auto-commit, auto-push, auto-rollback, reset, clean, stash, or checkout;
- no Git mutation from finalization;
- no Terminal launch;
- no provider tool mode;
- no hidden Workspace, file, Notes, Knowledge, Queue, Executor, Git, JDBC,
  Terminal, or Runbook context access.
