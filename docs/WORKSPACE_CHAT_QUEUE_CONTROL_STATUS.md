# Workspace Chat Queue Control Status

## Purpose

This document records the docs-only status after Workspace Chat -> Queue
Control Block 001.

Status: docs-only status record.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, scheduler behavior, Autorun
behavior, provider tools, validation execution, diff review execution, rollback
execution, Git mutation, Terminal execution, Workspace Agent V1 replacement,
Workspace Agent V2 replacement, or KnowledgeV2 behavior. Current implemented
widget behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`.

## Implemented In Block 001

### Audit

`docs/WORKSPACE_CHAT_QUEUE_CONTROL_AUDIT.md` records the inspect-only audit of
existing Workspace Chat, Workspace Agent, QueueV2, Queue Widget API, Queue
controller, report-card, and parser-based Queue command paths.

The audit identified the safe control-plane shape:

- Workspace Chat can present typed Queue action cards over existing Queue APIs;
- QueueV2 remains the visual/model surface over canonical Queue state;
- Queue task creation, task opening, selected-task run, and report review must
  delegate to existing Queue controller/API paths;
- parser-based Queue commands remain compatibility/convenience behavior, not
  the primary control-plane model;
- validation, diff review, stop/cancel, rollback, runner, Git, Terminal, and
  provider-tool actions must stay unavailable unless a later block adds an
  explicit typed bridge to an existing safe operation.

### Typed Queue Action Model And Service

Block 001 added a typed Workspace Chat Queue control model/service over the
existing Queue action surfaces.

Real behavior:

- create task actions validate visible draft fields before calling the existing
  Queue create bridge;
- open task actions use the existing Queue open/select callback when supplied;
- run selected task actions delegate to existing Queue controller run behavior
  and do not call lower-level runtime APIs directly;
- coordinator decision actions map only supported explicit decisions through
  existing Queue update/create paths;
- unsupported control actions return structured unavailable results with
  visible reasons;
- action results are current-session chat/report state, not a second Queue
  store.

The service does not create a new Queue runtime, write storage directly, start
Agent Executor directly, arm Autorun, run validation, create a diff review task
unless a supported explicit action path is available, execute rollback, mutate
Git, launch Terminal, call providers, or read hidden Workspace context.

### Create Queue Task From Chat

Workspace Chat can create a Queue task from visible chat/card inputs through the
typed Queue action path.

Real behavior:

- the operator reviews editable task fields in chat;
- creation requires an explicit click;
- creation uses the existing Queue create API/bridge;
- created tasks remain Queue-owned and appear in QueueV2 through the canonical
  Queue task state;
- creation does not assign, dispatch, run, validate, arm Autorun, commit, push,
  finalize, or accept anything.

### Queue Status And Report Cards

Workspace Chat can show Queue status/report cards for supported current-session
Queue review flows.

Real behavior:

- status cards summarize selected Queue task state using existing Queue data;
- report cards preserve report/evidence review as visible operator context;
- cards expose supported actions such as open task, explicit selected-task run
  where available, accept/no-change, request changes, create follow-up, mark
  blocked, mark failed/rejected, and mark rollback required where the existing
  update/create bridge supports them;
- cards keep unsupported actions visible as unavailable with a reason instead
  of silently hiding or running alternate behavior.

Report/status cards are not Queue runtime owners. They do not parse provider
responses into automatic decisions, execute validation, run diff review, run
rollback, mutate Git, launch Terminal, or auto-finalize Queue tasks.

### Explicit Queue Control Actions

Workspace Chat can act as a Queue control plane for supported actions only.

Supported action categories are explicit and operator-triggered:

- create Queue task from visible chat/card fields;
- open/select a Queue task when the host callback is available;
- run a selected/targeted Queue task through the existing explicit Queue run
  action where the Queue controller reports it is supported;
- view current Queue status/report cards;
- accept, request changes, create follow-up, or mark follow-up/blocked/failed/
  rollback-required only through explicit report/card actions where supported.

Unsupported actions remain explicit unavailable/follow-up states:

- selected-task stop/cancel from Workspace Chat;
- validation execution from Workspace Chat;
- diff review item workflow as a general Workspace Chat Queue control action;
- rollback execution or Git reset/clean/stash/revert from Workspace Chat;
- automatic finalization, automatic acceptance, automatic commit, automatic
  push, hidden Terminal launch, hidden provider tool use, and hidden context
  access.

## Exact Behavior Record

- Workspace Chat can act as a Queue control plane for supported actions.
- Create Queue task from Workspace Chat does not auto-run the task.
- Created tasks are owned by Agent Queue and surface in QueueV2 through the
  existing Queue state/API path.
- Explicit selected-task run remains the existing Queue-to-Executor path where
  supported by Queue controller state.
- Queue runtime, scheduler, Sequential Runner, and Autorun semantics are
  unchanged.
- Queue Autorun remains explicit, operator-armed, desktop-local, and
  current-session-only; Workspace Chat Queue control does not arm or start it
  implicitly.
- Unsupported validation, diff review, rollback, and stop/cancel actions show
  a reason and do not run fallback behavior.
- Workspace Agent V1/V2 behavior and KnowledgeV2 behavior are preserved.

## Safety Record

Block 001 preserves these boundaries:

- no hidden Queue task creation;
- no hidden Queue execution;
- no hidden Queue scheduler or Autorun start;
- no second Queue runtime or storage path;
- no direct Agent Executor launch outside existing Queue controller action
  paths;
- no validation execution;
- no diff review execution;
- no rollback execution;
- no auto-finalize, auto-accept, auto-commit, or auto-push;
- no Git mutation;
- no Terminal launch;
- no provider tool mode;
- no hidden Workspace, file, Notes, Knowledge, Queue, Executor, Git, JDBC,
  Terminal, or Runbook context access.

## Manual Smoke Checklist

Use a Workspace with Workspace Chat / Workspace Agent and Agent Queue / QueueV2
available.

1. Create a Queue task from Workspace Chat through the typed chat/card action.
2. Confirm the task appears in QueueV2.
3. Verify the task is not auto-run after creation.
4. Open the task from the chat card.
5. Run the task through the explicit action if supported by the selected task
   and Queue controller state.
6. View the report card in Workspace Chat.
7. Accept, request changes, or create a follow-up only through explicit card
   actions.
8. Verify unsupported actions show a reason, including validation execution,
   diff review control, rollback execution, and selected-task stop/cancel.
9. Verify Queue Autorun is not armed or started by any chat card unless the
   operator uses the separate existing Autorun controls.
10. Verify Workspace Agent V1/V2 and KnowledgeV2 still load and behave through
    their existing paths.

## Remaining Gaps

- Prompt pack import is not implemented.
- Validation runner/evidence workflow is not implemented for Workspace Chat
  Queue control.
- Diff review item workflow remains a follow-up and is not a general chat
  Queue control action.
- Coordinator finalization plus commit hash workflow remains incomplete.
- Self-development readiness smoke remains manual/future validation work.
- Selected-task stop/cancel remains Executor-owned or unavailable from
  Workspace Chat until a typed existing cancellation bridge is explicitly
  designed.
- Queue runtime/scheduler hardening remains outside this block.

## Recommended Next Functional Blocks

1. Prompt pack import.
   Add explicit import/review of reusable prompts without creating hidden
   provider tools or automatic Queue execution.

2. Validation runner/evidence.
   Add an explicit validation request/evidence workflow that preserves
   operator control and records validation output without auto-accepting work.

3. Diff review item workflow.
   Define and implement explicit Diff Review Queue item creation/review without
   automatic diff execution, Git mutation, or hidden rollback behavior.

4. Coordinator finalization plus commit hash workflow.
   Connect explicit coordinator acceptance/finalization with visible commit
   hash recording where a separate approved Git/commit path supplies it.

5. Self-development readiness smoke.
   Run and document the manual dogfooding smoke for Workspace Chat -> Queue ->
   Executor -> report review -> explicit decision flow.
