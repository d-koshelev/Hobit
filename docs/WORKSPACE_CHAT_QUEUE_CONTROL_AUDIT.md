# Workspace Chat Queue Control Audit

Status: docs-only functional audit.

## Purpose

Audit how Workspace Chat / Workspace Agent can become the operator-facing
control plane for Agent Queue without adding a second Queue runtime, hidden
execution path, or parser-first command surface.

This audit is based on existing Queue APIs/actions only. It does not add
frontend behavior, backend behavior, storage/schema changes, Queue scheduler
behavior, Agent Executor runtime behavior, validation execution, Git mutation,
or Workspace Agent provider tools.

## Current Workspace Chat Integration Points

The current Workspace Chat product surface is the saved-compatible
`interactive-agent` widget implemented by
`apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`.

Current transcript/message model:

- `WorkspaceAgentTranscriptMessage` in
  `apps/desktop/frontend/src/workbench/WorkspaceAgentTranscript.tsx` carries
  `planId`, `proposalIds`, `queueReportCardId`, `queueActionResultId`,
  `queueIntentDraftIds`, provider metadata, run metadata, role, and body.
- `InteractiveAgentPlaceholderWidget` owns current-session local state for
  messages, plans, reviews, proposals, Queue report cards, Queue action
  results, and Queue intent drafts.
- Queue report cards arrive through `queueReportActionCardRequest`, are stored
  in current-session chat state, and render through
  `WorkspaceAgentQueueReportActionCard`.
- Queue intent draft cards are generated from visible local/provider text and
  render through `WorkspaceAgentQueueIntentDraftCard`, which dispatches to
  create or update draft cards.
- Existing proposal cards can create Queue tasks through
  `runCreateQueueTaskProposal`, but only after the proposal is approved and
  the operator clicks the separate create action.

Current typed Workspace Agent -> Queue props:

- `workspaceAgentWidgetProps` passes `onCreateAgentQueueTask`,
  `onUpdateAgentQueueTask`, `onOpenAgentQueueItem`, and
  `workspaceAgentQueueBridge` into Workspace Agent.
- `workspaceAgentQueueBridge` wraps the Queue Widget API with workspace scope
  and exposes `createItem`, `getSnapshot`, `updateItem`, context attach
  helpers, and current Autonomous Queue helpers.
- `WorkspaceAgentQueueCreateDraftCard` and
  `WorkspaceAgentQueueUpdateDraftCard` are the safest existing chat-native
  typed action cards. They show editable fields, validate blocking conditions,
  and call `bridge.createItem` or `bridge.updateItem` only when the operator
  clicks Apply.

## QueueV2 Integration Points

QueueV2 is not a second runtime.

The saved Agent Queue widget still renders through
`AgentQueuePlaceholderWidget`, which owns the existing `AgentQueueController`
from `useWorkspaceQueueApi` / `useAgentQueueController`.

Current QueueV2 surface:

- `AgentQueuePlaceholderWidget` renders `AgentQueueV2Board` with the existing
  controller, selected task, task list, workers, Knowledge handlers, and report
  handoff callback.
- `AgentQueueV2Board` derives board state from `selectQueueV2ViewModel` and
  opens a task details popup. Selecting a task calls the existing
  `queue.selectTask`.
- `QueueV2TaskDetailsPopup` displays overview, prompt, result, agent log,
  context, files/validation, and developer tabs.
- `buildQueueV2TaskDetailsActions` maps popup actions to existing controller
  actions: refresh, new task, run task, view report, attach report,
  accept/finalize/request changes/create follow-up, and developer details.
- The standalone `widgetV2/queueV2/QueueV2Widget` is frontend-only/demo-like:
  it accepts tasks/workers and derives a view model, but it does not own the
  operational Queue APIs.

QueueV2 state model:

- `queueV2ViewModel.ts` is a selector/model over existing `AgentQueueTask`
  records and worker summaries.
- It computes lanes, lifecycle, closure state, eligibility, blocked reasons,
  capacity, inspector snapshots, and next actions.
- It should remain a read/model layer over the canonical Queue task state,
  not a mutation or runtime owner.

## Existing Queue Action Paths

### Create Queue Task

Safest typed paths:

- Chat draft card:
  `WorkspaceAgentQueueCreateDraftCard` -> `WorkspaceAgentQueueBridge.createItem`
  -> `createAgentQueueWidgetApi.createItem` -> `createAgentQueueTask`.
- Existing approved proposal:
  `runCreateQueueTaskProposal` -> `queueTaskRequestFromProposal` ->
  `onCreateAgentQueueTask`.
- Queue widget dialog:
  `AgentQueuePlaceholderWidget` -> `queue.createTask` ->
  `onCreateAgentQueueTask`.

Preferred control-plane path: extend the typed chat draft-card model. It is
visible, editable, validates required fields, and returns an action result card.

### Open / Select Queue Task

Existing paths:

- `onOpenAgentQueueItem` is passed into Workspace Agent and Queue report cards.
- Queue widget receives `agentQueueItemOpenRequest`; if it targets the Queue
  widget instance, it calls `selectTask(queueItemId)`.
- `AgentQueueV2Board` selection and details popup call the existing
  `queue.selectTask`.

Preferred control-plane path: a typed chat action should emit an explicit
open/select request using the existing `onOpenAgentQueueItem`/open-request
plumbing. It should not duplicate selection state inside chat.

### Run Selected Task

Existing selected-task path:

- QueueV2 popup action `run` calls `queue.run.onStartAssignedTask()`.
- Controller action `startAssignedTask` validates `canStart`, assignment,
  execution workspace, Codex executable, sandbox, approval policy, and active
  run constraints before calling `onStartAssignedAgentQueueTask`.
- Frontend API `startAssignedAgentQueueTask` maps to Tauri command
  `start_assigned_agent_queue_task`.
- Tauri starts the existing Agent Executor Direct Work stream path and records
  Queue run-link metadata. Agent Executor remains the runtime owner.

Preferred control-plane path: introduce a typed chat action that targets a
selected Queue task and delegates to the same controller/run action after an
explicit operator click. Do not call the runner/session APIs for selected-task
run. Do not infer execution workspace from chat unless it is visible and
confirmed in the action card.

### Stop / Cancel Selected Task

Supported today:

- Agent Executor owns live Direct Work cancellation.
- Queue Autorun can be stopped through `stopAgentQueueRunnerSession`, which
  stops future scheduling and does not itself kill the active run.
- Workspace Agent Direct Work has `onCancelCodexDirectWorkRun`, but Queue
  selected-task controls do not expose a typed Queue-owned selected-run cancel
  action.

Unsupported as a Queue control-plane action today:

- There is no existing typed selected Queue task stop/cancel action in
  `WorkspaceAgentQueueBridge`, `AgentQueueWidgetApi`, or
  `QueueV2TaskDetailsActions`.
- A future chat stop action should either open the Agent Executor run detail
  where cancellation already belongs, or add a tiny typed bridge to the
  existing Agent Executor cancellation primitive with explicit run identity.
  It must not kill runs through Queue state alone.

### Review / Report Cards

Existing paths:

- Queue selected-task result evidence can request
  `onShowQueueReportInWorkspaceChat`.
- Workspace Agent receives `queueReportActionCardRequest` and renders
  `WorkspaceAgentQueueReportActionCard`.
- Report cards support opening source/linked items, read-only Git review,
  creating follow-up or Diff Review Queue tasks, and explicit source Queue
  decision updates when `onUpdateQueueTask` is available.

Preferred control-plane path: reuse report action cards as the typed chat
surface for report/status review. They already preserve no-hidden-run and
no-auto-finalize messaging.

### Coordinator Decision Actions

Existing Queue widget/controller path:

- `AgentQueueTaskCoordinatorDecisionSection` exposes Accept result, Commit
  result, Accept without commit, Request changes, Create follow-up, Mark ready
  for finalization, Mark blocked, Mark failed/rejected, and Mark rollback
  required.
- `agentQueueTaskCoordinatorActions.ts` maps report actions to Queue status,
  validation status, closure state, and coordinator status.
- `createFollowUpTaskFromSelectedTask` creates a queued follow-up task and
  updates the source task, but does not run it.

Existing Workspace Agent report-card path:

- `WorkspaceAgentQueueReportActionCard` supports
  `mark_ready_for_finalization`, `finalize_accept_item`,
  `accept_without_commit`, `mark_needs_changes`,
  `mark_follow_up_required`, `create_follow_up`, `create_diff_review`,
  `mark_blocked`, `mark_failed_rejected`, and `mark_rollback_required`.
- It uses `onCreateQueueTask` and `onUpdateQueueTask` where available.
- Some card-only actions such as `pause_dependent_items` and `pause_queue_tag`
  only record a card result and do not currently mutate Queue pause state.

Preferred control-plane path: use the report-card/coordinator action model for
chat review cards, then converge shared decision mapping with the Queue
controller so the same typed actions apply the same Queue updates.

### Validation / Diff Review Requests

Existing safe pieces:

- Diff Review Queue task creation exists from Queue controller and Workspace
  Agent report cards. It creates a separate queued/manual task and does not
  run it.
- `review_changes` in `WorkspaceAgentQueueReportActionCard` performs a
  read-only Workspace Git status/diff-summary review when the source task has
  an execution workspace.

Unsupported today:

- There is no generic "run validation" Queue action exposed to Workspace Chat.
- Validation auto-run remains out of scope.
- Diff Review creation is a task-creation path, not validation execution.

## Parser-Based Paths That Should Not Be Primary

The following natural-language paths exist but should not be the primary
Workspace Chat control plane:

- `parseWorkspaceAgentQueueCommand` recognizes free-text analyze, create,
  update, prompt-through-Queue, Knowledge-generation task creation, Autonomous
  Queue start/stop, and unsupported Queue-control intents.
- `runWorkspaceAgentQueueCommand` can call `bridge.createItem`,
  `bridge.updateItem`, `bridge.getSnapshot`, `bridge.runAutonomousQueue`, and
  `bridge.stopAutonomousQueueAfterCurrent` from parsed text.
- Batch commands can create multiple items and start Autonomous Queue in the
  same parsed command when run settings are present.

Why not primary:

- Parser intent matching is brittle compared with typed action cards.
- It can mutate Queue state from message text without the same review/edit
  affordance as typed draft cards.
- It exposes Autonomous Queue start/stop as chat commands, which is broader
  than selected-task control and risks confusing chat coordination with runner
  arming.
- It can blur task drafting, creation, and runner start in one text command.

Recommended status: keep parser behavior as compatibility/convenience only,
and route new control-plane work through typed intent/action cards with
explicit operator clicks.

## Recommended Typed Control-Plane Path

Use one app-native Queue control model layered over the existing Queue APIs:

```text
Workspace Agent typed action card
  -> WorkspaceAgentQueueBridge / existing Queue controller action
  -> existing workspace Queue API
  -> existing Tauri/app service path where applicable
  -> existing Agent Executor Direct Work runtime only for explicit run
```

Do not add:

- a second Queue runtime;
- a chat-local task store;
- a new Queue scheduler;
- hidden Queue dispatch;
- parser-first mutation;
- provider tools for Queue;
- automatic finalization, validation, commit, push, rollback, or Terminal
  launch.

Safe typed surface additions can reuse existing shapes:

- `queue.getSnapshot`: status/report cards and selected-task snapshots.
- `queue.createItem`: create draft/queued task from visible chat.
- `queue.updateItem`: explicit task updates and coordinator decisions.
- Existing controller `selectTask`: open/select target task.
- Existing controller `run.onStartAssignedTask`: explicit selected-task run.
- Existing report-card actions: review, follow-up, diff review, accept/finalize
  where evidence and update APIs are available.

The current `WorkspaceAgentQueueBridge` only exposes snapshot/create/update and
Autonomous Queue controls. If chat needs selected-task run/open as first-class
typed actions, the safest tiny bridge is frontend-only and delegates to the
existing `AgentQueueController` methods rather than adding backend APIs:

- `openItem(queueItemId)`: calls the same open/select request path already
  used by report cards.
- `runSelectedItem(queueItemId)`: requires the Queue controller selected task
  to match or first selects it visibly, then calls
  `queue.run.onStartAssignedTask()` after the user clicks Run on a typed card.
- `requestStopSelectedRun(queueItemId)`: initially opens Executor/run detail
  or reports unsupported until a typed existing cancellation bridge is exposed.

## Unsupported Actions And Follow-Ups

Unsupported or only partially supported today:

- Chat-owned selected Queue task stop/cancel.
- Chat-owned validation run.
- Chat-owned durable Queue runner control beyond existing current-session
  Autorun helpers.
- Chat-owned task dependency resolution.
- Chat-owned Git commit/push/reset/rollback.
- Direct provider/tool execution from Workspace Agent into Queue.
- Queue status docs/status cards as a unified typed command model.
- Persisted Workspace Chat transcript or durable chat card state.
- Full Queue pause dependent items / pause queue tag mutation from chat report
  cards; current report-card actions are card-result messages unless wired to
  Queue controller pause actions.

Implementation follow-ups:

- Define a `WorkspaceChatQueueAction` discriminated union for typed chat cards:
  `createTaskDraft`, `updateTaskDraft`, `showSnapshot`, `openTask`,
  `runSelectedTask`, `requestStopRun`, `showReportCard`,
  `coordinatorDecision`.
- Keep action cards inert until explicit Apply / Open / Run / Mark / Create
  button clicks.
- Prefer frontend-only bridge reuse first. Add backend/Rust/Tauri only if an
  existing typed operation is unavailable and the bridge can delegate to an
  already implemented app service primitive.
- Remove Autonomous Queue start from new chat control-plane affordances unless
  the action is explicitly labeled as session-only Queue Autorun and remains
  separate from selected-task Run.

## Recommended Phases

1. Typed command/action model.
   Define a small Workspace Chat Queue action union and rendering contract.
   Treat parser output as draft input only, not as the execution path.

2. Create Queue task from chat.
   Reuse `WorkspaceAgentQueueCreateDraftCard` and
   `WorkspaceAgentQueueBridge.createItem`. Require visible fields and explicit
   Apply. Creating a task must not assign, run, arm Autorun, validate, commit,
   or push.

3. Queue task/status cards in chat.
   Reuse `WorkspaceAgentQueueBridge.getSnapshot`, `WorkspaceAgentQueueSnapshotCard`,
   `WorkspaceAgentQueueResultCard`, and existing report-card shapes. Cards
   should summarize Queue state and provide Open actions through the existing
   open/select plumbing.

4. Explicit Queue control actions.
   Add frontend-only typed actions that delegate to existing controller methods
   for Open/select and selected-task Run. Keep Stop/Cancel as unsupported or
   Executor-owned until a typed existing cancellation bridge is available.
   Keep Autorun controls separate and explicitly session-only.

5. Status docs.
   Record the implemented control-plane status after each slice, including
   supported actions, unsupported actions, parser compatibility status,
   validation coverage, and no-hidden-execution boundaries.

## Audit Conclusion

The safest path is to make Workspace Chat a typed action-card control plane
over the existing Queue controller and Queue Widget API. QueueV2 should remain
the visual/model surface over canonical Queue state. Workspace Chat should not
gain a parallel Queue task store, Queue runtime, scheduler, parser-first
execution path, or hidden Executor launch path.

