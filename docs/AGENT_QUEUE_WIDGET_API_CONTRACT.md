# Agent Queue Widget API Contract

Contract status: docs-only Widget API contract.

This contract defines the first concrete Workspace Widget API contract for
Agent Queue. It does not implement frontend UI, backend or Tauri commands,
Rust or TypeScript types, storage/schema changes, provider tools, semantic
test runner behavior, Queue runtime behavior, Agent Executor behavior, Git
behavior, or autonomous Coordinator runtime.

For current implemented behavior, use `docs/CURRENT_WIDGET_SURFACE.md`. For
the general Widget API model, use `docs/WORKSPACE_WIDGET_API_CONTRACT.md`. For
the MVP single-Coordinator model, use
`docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md`. For Queue product and runtime
boundaries, use `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`,
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`,
`docs/QUEUE_ITEM_EXECUTION_POLICY_CONTRACT.md`,
`docs/AGENT_QUEUE_AUTORUN_CONTRACT.md`, and
`docs/QUEUE_RUN_HISTORY_VISIBILITY_CONTRACT.md`.

## 1. Purpose

Agent Queue is the singleton task ledger and execution coordination surface for
a Workspace.

It organizes Queue items, task lifecycle state, run settings, execution links,
review state, evidence summaries, and Coordinator decisions for promoted async
or background work. It is not the Workspace Agent, not Agent Executor, not Git,
not Terminal, and not a hidden scheduler.

Agent Queue exposes an app-native Widget API so Workspace Agent Coordinator can
inspect, plan, modify, run, and test Queue work through typed Workspace/widget
actions. Coordinator must use this API instead of shell commands, filesystem
state edits, ad hoc SQLite writes, localStorage mutation, DOM scraping, or
private frontend component calls.

The API boundary keeps Queue work:

- Workspace-scoped;
- machine-readable;
- operator-visible;
- approval-aware;
- safe for Workspace Agent reasoning;
- compatible with future multi-Coordinator architecture without implementing
  multi-Coordinator runtime now.

## 2. Primary user

Primary user: Workspace Agent Coordinator acting on behalf of the operator.

Primary decision: what Queue work exists, what should change, what can run,
what is blocked, what evidence is ready, and what needs explicit Coordinator or
operator decision.

What the Coordinator needs to see:

- safe Queue snapshot;
- task fields and statuses;
- blockers and dependencies;
- run settings and run-link summaries;
- report/evidence state;
- pending confirmations;
- events and semantic test reports.

What the Coordinator must control only through app-native APIs:

- Queue item creation and updates;
- task ordering and dependencies;
- follow-up creation;
- selected task execution when explicitly requested;
- autonomous Queue start/stop when explicitly requested;
- semantic test hooks;
- Coordinator decisions and finalization state.

The human operator remains able to inspect, approve, override, and finalize
work through UI. The Coordinator is not allowed to silently accept, finalize,
delete, execute, or mutate work unless a future explicit autonomous Coordinator
mode defines that authority.

## 3. Product scenario

Scenario: Workspace Agent Coordinator manages the Workspace Queue as the shared
task ledger.

Starting condition: a Workspace has one canonical Agent Queue with zero or more
Queue items. Some items may be draft, queued, running, blocked,
report-ready, awaiting Coordinator review, or finalized.

User intent: the operator asks Workspace Agent Coordinator to inspect Queue
work, plan next tasks, update Queue records, run a selected task, start
autonomous Queue execution, review results, create follow-ups, or run semantic
tests.

Expected path:

1. Workspace Agent Coordinator analyzes the current Queue snapshot.
2. Coordinator summarizes blockers, runnable work, waiting work, and report
   readiness.
3. Coordinator creates or updates Queue items through app-native Queue actions.
4. Coordinator runs a selected task or autonomous Queue only when explicitly
   requested or when a future explicit policy allows that exact behavior.
5. Queue and Executor emit execution, report, evidence, and decision events.
6. Coordinator observes events and reports, then creates follow-up tasks or
   asks for a Coordinator/operator decision.
7. Coordinator does not silently finalize completed work unless a future
   explicit autonomous Coordinator mode exists.

Why this belongs in a Widget API: Queue is a widget-owned Workspace capability.
The visible Queue widget is the presentation/control surface, while the Queue
service is the source of truth for the singleton Workspace ledger. Coordinator
must use the Queue API rather than implementation-specific storage or UI hacks.

## 4. Singleton Rule

There is exactly one canonical Agent Queue per Workspace.

Rules:

- The canonical Queue state is Workspace-scoped.
- `queueId` identifies the canonical Queue ledger for the Workspace.
- Multiple future Queue UI views must point to the same Queue state.
- Multiple Workbenches in one Workspace may show the same Queue.
- Existing duplicate persisted Queue widget instances, where present, are a
  compatibility concern; they do not create multiple canonical Queues.
- Queue service is the source of truth for items, ordering, dependencies, run
  links, evidence, review state, and Coordinator decisions.
- Agent Queue widget instances are presentation/control surfaces over the
  singleton Queue.
- Moving, floating, docking, or duplicating a view must not fork Queue state.

## 5. Queue Identity

Conceptual Queue identity:

```text
widgetType: agent-queue
queueId: <canonical workspace queue id>
workspaceId: <workspace id>
widgetInstanceId: <visible Queue widget/view id when action targets a UI view>
viewId: <future distinct Queue view id when needed>
coordinatorId: primary
```

MVP identity rules:

- `widgetType` is `agent-queue`.
- `queueId` identifies the one canonical Queue ledger for the Workspace.
- `workspaceId` scopes the Queue and all Queue items.
- `widgetInstanceId` identifies the visible Queue widget view when a request
  needs UI focus, selection, or view-local state.
- `viewId` is optional/future; it may distinguish multiple views over the same
  Queue state.
- `coordinatorId` is `primary` for the MVP.

Future identity extension:

```text
coordinatorId: <stable coordinator id>
coordinatorScope: <workspace | queueTag | taskSet | widget | repository>
observedRevision: <latest observed queue revision>
viewRevision: <latest observed view-local revision>
```

Future support for multiple Coordinators must preserve one canonical Queue per
Workspace, explicit Coordinator scope, optimistic revisions, conflict
detection, and operator-visible ownership.

## 6. Queue Snapshot

`queue.getSnapshot` returns a safe, structured, machine-readable snapshot for
Workspace Agent reasoning and semantic tests.

Required conceptual fields:

```text
queueId
workspaceId
widgetType
coordinatorId
revision
snapshotGeneratedAt
globalQueueState
queueTags
items
selectedItem
itemCounts
localExecutorState
autonomousRunnerState
lastEvents
pendingConfirmations
capsAndRedactions
unsupportedReason
```

`globalQueueState` should summarize:

- lifecycle status such as `idle`, `has_running_work`, `blocked`,
  `awaiting_review`, `autorun_running`, `autorun_stopping`, or `failed`;
- last known refresh time;
- global errors or unsupported-runtime state;
- safe current-session runner status when available.

`queueTags` should summarize:

- known tags or scopes;
- item counts per tag;
- blocked/running/report-ready/finalized counts per tag when available.

`items` should include bounded, safe Queue item summaries. It must not include
raw Executor stdout/stderr, raw logs, full final responses, full diffs, secret
values, or hidden widget state by default.

`selectedItem` should include the selected item id and safe selected-item
details when a visible Queue view has a selection. Selection is view-local; the
selected item does not define Queue identity.

`itemCounts` must include at least:

- total;
- draft;
- queued;
- running;
- blocked;
- waiting;
- report-ready;
- awaiting Coordinator review;
- finalized;
- failed;
- cancelled;
- deleted or archived when supported.

`localExecutorState` should summarize:

- visible Agent Executor slots relevant to Queue when available;
- assigned executor refs;
- active run presence;
- missing or unsupported executor state;
- safe run-link counts.

`autonomousRunnerState` should summarize:

- stopped/idle/running/stopping/completed/failed;
- current task id when safe;
- selected executor ref;
- current-session limitation;
- last stop reason;
- next eligible task summary when safe.

`lastEvents` should contain a bounded list of recent Queue events with safe
summaries and event ids.

`pendingConfirmations` should list actions that require operator confirmation
before they can apply, such as delete, multi-action patch apply, execution
start, autonomous runner start, or Coordinator finalization.

Each snapshot must be safe for Workspace Agent reasoning: compact, structured,
redacted, bounded, and explicit about omissions.

## 7. Queue Item Shape

A Queue item is one concrete unit of Workspace agent work tracked by the
canonical Queue ledger.

Conceptual fields:

```text
id
workspaceId
queueId
title
description
prompt
itemType
queueTag
priority
order
index
executionPolicy
executionStatus
coordinatorStatus
validationStatus
dependencies
blockers
parentItemId
followUpOf
createdBy
updatedBy
createdAt
updatedAt
queuedAt
startedAt
completedAt
revision
executionWorkspace
codexExecutable
sandbox
approvalPolicy
reportState
evidenceState
runLinks
directWorkEvidenceSummary
```

Field meanings:

- `id`: stable Queue item id.
- `title`: short human-readable task title.
- `description`: optional operator/Coordinator explanation.
- `prompt`: executor prompt or work request used by Agent Executor when run.
- `itemType`: task kind such as `work`, `review`, `validation`, `follow_up`,
  `smoke_test`, or future contract-defined values.
- `queueTag`: optional Workspace-local grouping/scope.
- `priority`: ordering hint such as low/normal/high/urgent or numeric value.
- `order` / `index`: explicit Queue ordering field used for deterministic
  sequencing.
- `executionPolicy`: policy such as `manual`, `auto`, or
  `after_previous_success`.
- `executionStatus`: execution lifecycle state.
- `coordinatorStatus`: review/finalization lifecycle state.
- `validationStatus`: validation state such as `not_run`, `running`,
  `passed`, `failed`, `skipped`, or `unknown`.
- `dependencies`: item ids that must complete before this item can run.
- `blockers`: structured visible blockers, including missing prompt,
  dependency, missing executor, missing execution workspace, failed validation,
  operator decision, or unsupported runtime.
- `parentItemId`: parent task for split or hierarchical work when supported.
- `followUpOf`: source item/report/evidence id for a follow-up task.
- `createdBy` / `updatedBy`: actor descriptors such as operator,
  Coordinator, test harness, or system-owned compatibility importer.
- `timestamps`: created, updated, queued, started, completed, finalized, and
  cancelled timestamps when available.
- `revision`: future optimistic concurrency value for item-level updates.

Task-scoped run settings:

- `executionWorkspace`: explicit existing repository or local project folder,
  or future explicit scratch/no-filesystem mode when separately implemented.
- `codexExecutable`: executable selected for Direct Work.
- `sandbox`: Direct Work sandbox setting.
- `approvalPolicy`: Direct Work approval policy.

`executionWorkspace` belongs to the Queue item, not the Queue widget view. A
Queue view may display or edit the item setting, but floating/docking/multiple
views must not fork or override the task-scoped execution workspace.

Report/evidence fields:

- `reportState`: report lifecycle such as `none`, `pending`,
  `report_ready`, `evidence_missing`, or `attached`.
- `evidenceState`: compact structured evidence summary availability.
- `runLinks`: safe metadata refs to Agent Executor runs, not raw run payloads.
- `directWorkEvidenceSummary`: safe summary of Direct Work final response,
  command summary, changed-files summary, validation summary, and timeline
  status when available.

## 8. Capabilities

Queue capabilities:

- inspect queue;
- create task;
- update task;
- delete task;
- reorder tasks;
- manage dependencies;
- create follow-up;
- run selected task;
- run autonomous queue;
- stop autonomous queue after current task;
- inspect reports/evidence;
- apply Coordinator decision;
- run semantic tests.

Capability descriptors should include:

```text
capabilityId
displayName
description
inputShape
outputShape
safetyClass
requiresConfirmation
requiresSelectedContext
enabledState
unsupportedReason
eventsEmitted
evidenceProduced
```

Capabilities are descriptive until an action request is made and approved.
Workspace Agent Coordinator cannot use a capability descriptor to bypass Queue
policy or call implementation internals.

## 9. Actions

All actions are conceptual app-native requests routed through Workspace and the
Queue service. They are not shell commands, direct storage edits, localStorage
mutations, DOM events, or private frontend component calls.

### `queue.getSnapshot`

Purpose: read the safe Queue snapshot for planning, review, or semantic tests.

Required input:

- `workspaceId`;
- `queueId`;
- optional `widgetInstanceId` / `viewId`;
- optional `includeSelectedItem`;
- optional caps for item count and event count.

Output/result:

- Queue snapshot as defined in section 6;
- snapshot revision;
- capping/redaction metadata.

Safety class: safe read.

Confirmation needs: none.

Events emitted: none required; optional `snapshotRead` audit/event later if
policy needs read observability.

### `queue.createItem`

Purpose: create a new Queue item in the singleton Workspace Queue.

Required input:

- `workspaceId`;
- `queueId`;
- `title`;
- `prompt` or explicit empty-prompt rationale for draft tasks;
- optional `description`;
- optional `itemType`;
- optional `queueTag`;
- optional `priority`;
- optional `executionPolicy`;
- optional task-scoped run settings;
- actor/requester.

Output/result:

- created item summary;
- new queue revision;
- event ids.

Safety class: safe create/update.

Confirmation needs: no confirmation for a single explicitly requested local
create; confirmation required for multi-action patches or bulk creation unless
directly requested.

Events emitted:

- `itemCreated`;
- `itemQueued` when initial status is queued;
- `coordinatorDecisionRequired` when the create needs operator review.

### `queue.updateItem`

Purpose: update safe mutable fields on a Queue item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- field patch;
- actor/requester;
- optional reason;
- optional expected revision in future.

Output/result:

- updated item summary;
- changed fields summary;
- new queue/item revision;
- event ids.

Safety class: safe create/update for normal fields; confirmation required when
the update changes run settings, status into a runnable state, dependencies
that unblock execution, or Coordinator finalization-related fields.

Confirmation needs: required for risky status changes, run setting changes that
enable execution, and multi-action patches unless directly requested.

Events emitted:

- `itemUpdated`;
- `itemQueued` when status enters queued;
- `dependencyBlocked` when dependency rules block the item;
- `coordinatorDecisionRequired` when review is needed.

### `queue.deleteItem`

Purpose: delete, archive, or remove a Queue item from the active ledger.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- delete mode such as `delete` or future `archive`;
- actor/requester;
- reason.

Output/result:

- deleted item id;
- delete/archive mode;
- new queue revision;
- event ids.

Safety class: destructive.

Confirmation needs: required unless the operator directly requested this exact
delete action. Bulk delete always requires confirmation.

Events emitted:

- `itemDeleted`;
- `coordinatorDecisionRequired` if deletion conflicts with dependencies,
  running state, reports, or pending review.

### `queue.reorderItems`

Purpose: update deterministic ordering/index of Queue items.

Required input:

- `workspaceId`;
- `queueId`;
- ordered item ids or move operation;
- optional queue tag/scope;
- actor/requester.

Output/result:

- new order summary;
- new queue revision;
- event ids.

Safety class: safe create/update; confirmation required when reordering affects
autonomous runner eligibility or multi-action patch apply.

Confirmation needs: not required for a direct single reorder; required for
multi-action patches unless directly requested.

Events emitted:

- `itemUpdated` for affected order/index fields;
- `dependencyBlocked` if ordering exposes dependency blocks;
- optional `itemQueued` when ordering changes queued sequence.

### `queue.addDependency`

Purpose: make one Queue item wait for another item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- `dependsOnItemId`;
- actor/requester.

Output/result:

- dependency summary;
- blocked/ready recomputation summary;
- new queue revision;
- event ids.

Safety class: safe create/update.

Confirmation needs: confirmation required when adding the dependency blocks an
already runnable or running-plan item.

Events emitted:

- `itemUpdated`;
- `dependencyBlocked` when the item becomes blocked.

### `queue.removeDependency`

Purpose: remove a dependency edge from a Queue item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- `dependsOnItemId`;
- actor/requester.

Output/result:

- dependency removal summary;
- ready/runnable recomputation summary;
- new queue revision;
- event ids.

Safety class: safe create/update; may become confirmation required when it
unblocks an item under an armed autonomous runner.

Confirmation needs: required when removing the dependency could make an item
eligible for immediate autonomous execution.

Events emitted:

- `itemUpdated`;
- `itemQueued` when the item becomes queued/runnable;
- `dependencyBlocked` when other dependency blockers remain.

### `queue.createFollowUp`

Purpose: create a follow-up item from a report, evidence summary, blocker, or
Coordinator/operator decision.

Required input:

- `workspaceId`;
- `queueId`;
- source `itemId` or evidence/report ref;
- `title`;
- `prompt`;
- optional `description`;
- optional `queueTag`;
- optional task-scoped run settings;
- actor/requester.

Output/result:

- created follow-up item summary;
- `followUpOf` reference;
- new queue revision;
- event ids.

Safety class: safe create/update.

Confirmation needs: no confirmation for a directly requested single follow-up;
confirmation required for multi-action patches or follow-ups that also change
source item finalization.

Events emitted:

- `itemCreated`;
- `itemUpdated` on source item when follow-up state changes;
- `coordinatorDecisionRequired` when source item still needs review.

### `queue.runTask`

Purpose: start one selected Queue task through its assigned Agent Executor or
future approved Queue-to-Executor path.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- task-scoped run settings or explicit selected task settings;
- target Agent Executor ref when required;
- actor/requester;
- explicit approval or policy reference.

Output/result:

- run-start result;
- safe Agent Executor run ref;
- task status summary;
- event ids.

Safety class: execution.

Confirmation needs: explicit action required. Workspace Agent Coordinator may
request this only when the operator explicitly asks or a future policy allows
the exact action.

Events emitted:

- `itemStarted`;
- `itemRunStageChanged`;
- `itemExecutionCompleted` when final status is observed;
- `reportReady` or `evidenceMissing` depending on evidence availability;
- `coordinatorDecisionRequired` after execution completes.

### `queue.runAutonomousQueue`

Purpose: start operator-explicit autonomous Queue execution for eligible tasks
within declared bounds.

Required input:

- `workspaceId`;
- `queueId`;
- allowed item scope or queue tag;
- stop conditions;
- eligible execution policies;
- executor/routing settings;
- actor/requester;
- explicit operator approval or future autonomy policy reference.

Output/result:

- autonomous runner session summary;
- first selected task summary when safe;
- event ids.

Safety class: autonomous execution.

Confirmation needs: explicit operator action required in MVP.

Events emitted:

- `autonomousRunnerStarted`;
- `itemStarted` for each task start;
- `itemRunStageChanged`;
- `itemExecutionCompleted`;
- `dependencyBlocked`;
- `reportReady` or `evidenceMissing`;
- `coordinatorDecisionRequired`;
- `autonomousRunnerCompleted`, `autonomousRunnerStopped`, or
  `autonomousRunnerFailed`.

### `queue.stopAutonomousQueue`

Purpose: request that autonomous Queue execution stop after the current task or
stop scheduling new tasks.

Required input:

- `workspaceId`;
- `queueId`;
- runner/session id when available;
- stop mode such as `after_current_task` or future `stop_now`;
- actor/requester;
- reason.

Output/result:

- runner status summary;
- current task unaffected/affected summary;
- event ids.

Safety class: confirmation required for modes that affect an active run;
safe update for stopping future scheduling only.

Confirmation needs: stopping future scheduling does not require confirmation
when directly requested. Killing or cancelling an active Executor run requires
separate explicit run cancellation confirmation through the owning Executor
path.

Events emitted:

- `autonomousRunnerStopped`;
- `itemRunStageChanged` if current task state changes.

### `queue.getReport`

Purpose: read a safe report/evidence summary for a Queue item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- optional report/evidence ref;
- optional caps.

Output/result:

- report summary;
- evidence summary;
- safe run-link refs;
- redaction/capping metadata;
- unavailable/missing-evidence reason when applicable.

Safety class: safe read for summaries; sensitive read for selected raw details.

Confirmation needs: none for safe summaries; explicit selection/approval for
raw developer details or large excerpts.

Events emitted: none required; optional `reportRead` audit/event later.

### `queue.attachReport`

Purpose: attach or update a safe report/evidence summary on a Queue item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- report/evidence summary;
- source run/evidence refs;
- actor/requester.

Output/result:

- attached report summary;
- report/evidence state;
- new queue/item revision;
- event ids.

Safety class: safe create/update when attaching summaries; sensitive read/write
if selected raw details are included.

Confirmation needs: confirmation required when attaching raw details, large
excerpts, or evidence that may become AI-readable context.

Events emitted:

- `reportReady`;
- `evidenceMissing` when report exists but required evidence refs are absent;
- `coordinatorDecisionRequired`.

### `queue.applyCoordinatorDecision`

Purpose: record explicit Coordinator/operator review decision for an item.

Required input:

- `workspaceId`;
- `queueId`;
- `itemId`;
- decision such as `finalized`, `needs_changes`,
  `follow_up_required`, `blocked`, `failed`, or `rollback_required`;
- rationale;
- actor/requester;
- evidence/report refs used.

Output/result:

- updated Coordinator state;
- decision summary;
- new queue/item revision;
- event ids.

Safety class: coordinator decision.

Confirmation needs: explicit decision required. Finalization must never be
implicit from execution completion or report readiness.

Events emitted:

- `coordinatorDecisionRequired` when decision input is incomplete;
- `coordinatorFinalized` when finalized;
- `itemUpdated`;
- `itemCreated` if a decision creates a follow-up.

### `queue.runSemanticTest`

Purpose: run a semantic Queue API test through app-native actions, events,
state assertions, and report output.

Required input:

- `workspaceId`;
- `queueId`;
- test name;
- fixture/scope;
- safety policy;
- cleanup policy;
- actor/requester.

Output/result:

- test report;
- observed action ids;
- observed event ids;
- state assertions;
- evidence assertions;
- cleanup summary.

Safety class: safe read, safe create/update, execution, or autonomous
execution depending on the test. Test hooks do not weaken normal safety
policy.

Confirmation needs: confirmation follows the highest-risk action inside the
test. Smoke-task creation/deletion must be scoped to test-owned items.

Events emitted:

- normal Queue events for actions under test;
- semantic test started/completed/failed events when supported.

## 10. QueuePatch Model

QueuePatch is the Workspace Agent Coordinator proposal/apply model for Queue
mutations.

MVP QueuePatch operations:

- create item;
- update item;
- delete item;
- reorder item;
- add dependency;
- remove dependency;
- create follow-up;
- update task-scoped run settings.

Conceptual MVP shape:

```text
queuePatchId
workspaceId
queueId
coordinatorId: primary
intent
operations
evidenceRefs
safetySummary
confirmationRequired
createdAt
```

MVP rules:

- There is one primary Coordinator.
- The canonical Queue is singleton per Workspace.
- A single safe action can apply directly when the operator explicitly
  requested that action and the action does not require confirmation.
- Multi-action patches require user confirmation before apply.
- Delete, bulk delete, execution start, autonomous runner start, and
  finalization-related patches require confirmation.
- QueuePatch application must use Queue APIs, not shell/storage hacks.

Future QueuePatch support:

- `expectedRevision`;
- conflict detection;
- item-level revisions;
- scopes such as Workspace, queue tag, task set, widget, or repository;
- multiple Coordinators;
- patch review UI;
- patch approved/rejected/applied/conflicted events;
- operator-visible conflict resolution.

Future conflict detection should reject or surface:

- updates from stale revisions;
- delete/update conflicts;
- dependency cycles;
- out-of-scope Coordinator changes;
- duplicate follow-ups from the same evidence;
- silent last-writer-wins behavior.

## 11. Events

Queue events use a safe event envelope.

Conceptual envelope:

```text
eventId
workspaceId
widgetType: agent-queue
queueId
itemId
type
timestamp
actor
coordinatorId
summary
payload
evidenceRefs
redaction
```

Fields:

- `eventId`: stable event id.
- `widgetType`: `agent-queue`.
- `queueId`: canonical Queue id.
- `itemId`: optional Queue item id.
- `type`: event type.
- `timestamp`: event time.
- `actor`: operator, Coordinator, test harness, Queue service, Agent Executor,
  or system.
- `coordinatorId`: `primary` in MVP when Coordinator-driven.
- `summary`: compact human-readable summary.
- `payload`: bounded structured event-specific data.
- `evidenceRefs`: safe references to reports, run links, or logs.
- `redaction`: capping/redaction metadata when payload omits raw details.

Example event types:

- `itemCreated`;
- `itemUpdated`;
- `itemDeleted`;
- `itemQueued`;
- `itemStarted`;
- `itemRunStageChanged`;
- `itemExecutionCompleted`;
- `reportReady`;
- `evidenceMissing`;
- `coordinatorDecisionRequired`;
- `coordinatorFinalized`;
- `dependencyBlocked`;
- `autonomousRunnerStarted`;
- `autonomousRunnerStopped`;
- `autonomousRunnerCompleted`;
- `autonomousRunnerFailed`.

Events must be suitable for semantic observation. Tests and Coordinator should
prefer events and snapshots over private implementation state.

## 12. Evidence And Logs

Queue API evidence should be safe, structured, and review-oriented.

Evidence available through the API:

- worker report summary;
- Direct Work final response summary;
- command summary;
- changed files summary;
- validation summary;
- human-readable timeline;
- raw developer details through explicit selected/capped detail access.

Evidence rules:

- Raw logs/details are not the primary API output.
- Queue evidence summaries should be human-readable and machine-readable.
- Report ready means evidence exists and can be inspected as a safe summary.
- Evidence missing is distinct from execution complete.
- Execution complete without evidence should surface `evidenceMissing`, not
  finalization.
- Queue may expose safe run-link metadata, but Agent Executor owns raw logs,
  stdout/stderr, final response bodies, validation detail, diffs, and run
  result payloads.
- Raw developer details require explicit selection, capping, redaction, and
  approval when they become sensitive or AI-readable.
- Queue must not copy raw Executor payloads into Queue records by default.

Safe evidence summary shape:

```text
reportId
itemId
runRefs
status
summary
directWorkFinalResponseSummary
commandSummary
changedFilesSummary
validationSummary
timelineSummary
missingEvidence
rawDetailRefs
redaction
```

## 13. State Machine

Queue API separates execution state from Coordinator/review state.

Execution states:

- `draft`;
- `queued`;
- `running`;
- `execution_complete`;
- `failed`;
- `blocked`;
- `cancelled`.

Review/Coordinator states:

- `not_ready`;
- `awaiting_coordinator_review`;
- `finalized`;
- `needs_changes`;
- `follow_up_required`;
- `blocked`;
- `failed`;
- `rollback_required`.

Execution state semantics:

- `draft`: item exists but is not ready to run.
- `queued`: item is ready or waiting for execution according to policy.
- `running`: Agent Executor or approved execution path is active.
- `execution_complete`: execution ended and may have report/evidence.
- `failed`: execution or required handoff failed.
- `blocked`: item cannot run due to dependency, missing setting, missing
  executor, missing approval, or other visible blocker.
- `cancelled`: operator or runtime cancelled the run.

Coordinator state semantics:

- `not_ready`: no review can happen yet.
- `awaiting_coordinator_review`: evidence/report exists or execution outcome
  needs review.
- `finalized`: Coordinator/operator explicitly finalized the item.
- `needs_changes`: follow-up or correction is required.
- `follow_up_required`: follow-up must be created or has been requested.
- `blocked`: Coordinator decision is blocked on input/evidence/environment.
- `failed`: review failed or item cannot be accepted as-is.
- `rollback_required`: work may need an explicit recovery/rollback plan.

Important distinctions:

- Execution complete is not Accepted.
- Report ready is not Finalized.
- Awaiting Coordinator review is not Done.
- Done/Finalized appears only after explicit Coordinator finalization.
- Autonomous runner does not auto-finalize.
- A successful Direct Work run does not imply acceptance, Git commit, push,
  Notes mutation, validation success, or clean Workspace state.

## 14. Autonomous Queue Semantics

Current autonomous mode is explicit operator-started Queue execution within the
current app/session boundary.

Rules:

- Autonomous Queue starts only after explicit operator action.
- It runs eligible queued tasks sequentially.
- It uses each task's own execution settings.
- It does not use Git as an automation surface.
- It does not auto-commit.
- It does not auto-push.
- It does not auto-accept.
- It does not auto-finalize.
- It leaves completed tasks Report ready / Awaiting Coordinator review.
- It continues independent eligible tasks when policy and stop conditions allow.
- Dependency-blocked tasks wait.
- It must not read hidden Notes, hidden widget state, raw logs, Git state,
  JDBC state, Terminal output, files, credentials, or Coordinator-private state
  while selecting tasks.
- It must stop or wait on missing execution workspace, missing executor,
  missing prompt, blocked dependency, manual policy, failed run, cancelled run,
  unknown final status, unsupported runtime, or operator stop according to the
  active Queue Autorun contract.

Autonomous Queue is not a backend scheduler, durable runner, reconnect/resume
system, server worker, hidden dispatcher, approval bypass, or acceptance
engine.

## 15. Safety Policy

Safety classes:

- `safe read`;
- `safe create/update`;
- `confirmation required`;
- `destructive`;
- `execution`;
- `autonomous execution`;
- `coordinator decision`.

Rules:

- Safe reads may return bounded Queue snapshots, item summaries, counts,
  statuses, safe run-link metadata, and safe evidence summaries.
- Safe create/update may create or update Queue task fields without execution
  when directly requested and within policy.
- Confirmation is required for multi-action patches, risky status changes,
  run setting changes that enable execution, dependency changes that unblock
  autonomous execution, attaching raw details, and finalization decisions.
- Delete and bulk delete require confirmation unless the operator directly
  requested the exact single delete action; bulk delete always requires
  confirmation.
- Running a task requires explicit action or a future explicit autonomy policy.
- Running autonomous Queue requires explicit action in MVP.
- Coordinator finalization requires an explicit decision.
- Test hooks must follow the same safety classes as the actions they call.
- No shell/filesystem direct Queue mutation.
- No direct SQLite/storage mutation as a product control path.
- No localStorage/DOM/private component mutation as a product control path.
- No Git automation in Queue API.
- No hidden execution.
- No automatic Queue dispatch from Workspace Agent chat/provider output.
- No raw Executor payload copying into Queue as default API output.
- No secrets in Queue snapshots, events, reports, or prompts.

## 16. Semantic Test Hooks

Workspace Agent Coordinator and test harnesses may use Queue semantic test
hooks through app-native actions.

Test hooks:

- create smoke task;
- create queued task;
- run task;
- run autonomous queue;
- wait for report;
- assert report ready;
- assert awaiting Coordinator review;
- assert no auto-finalization;
- assert dependency-blocked task waits;
- assert independent task continues;
- delete smoke tasks.

Testing model:

```text
action -> event/state -> assertion -> report
```

Required semantic test behavior:

1. Create deterministic test-owned fixture state through Queue APIs.
2. Call Queue actions with typed inputs.
3. Observe Queue events and/or safe snapshots.
4. Assert expected execution state, Coordinator state, reports, evidence, and
   safety metadata.
5. Produce a test report with action ids, event ids, state summaries,
   assertion results, failures, capping/redaction notes, and cleanup summary.
6. Delete only test-owned smoke tasks through confirmation-aware cleanup.

Semantic tests must not:

- mutate SQLite directly;
- edit files that back Queue state;
- call shell commands to impersonate product behavior;
- scrape DOM/private React state;
- bypass confirmation for execution/destructive actions;
- auto-finalize work.

## 17. Workspace Agent Integration

Workspace Agent Coordinator uses Queue API to:

- inspect the current Queue snapshot;
- summarize blockers, waiting work, running work, report-ready work, and
  finalization gaps;
- create QueuePatch proposals;
- apply direct single actions when they are explicitly requested and safe;
- request confirmation for multi-action, destructive, execution, autonomous,
  or finalization actions;
- create follow-ups from reports, blockers, validation failures, or operator
  decisions;
- run semantic tests;
- start autonomous Queue only when explicitly asked or when a future explicit
  autonomy policy allows that exact behavior.

Workspace Agent Coordinator must not:

- use Codex/shell to mutate Queue state;
- edit Queue storage files;
- issue ad hoc database writes;
- invoke frontend private components;
- scrape the DOM to control Queue;
- create hidden Queue work;
- start Agent Executor or Queue Autorun silently;
- finalize work because a run completed;
- use provider tool calls to bypass Queue capability policy.

Provider-backed Workspace Agent requests remain tool-disabled unless a later
contract explicitly adds Widget API tool execution. Provider output may draft
Queue proposals, but actual Queue changes must pass through app-native Queue
actions and required confirmation.

## 18. MVP Vs Future

MVP:

- one primary Coordinator;
- singleton Queue per Workspace;
- app-native Queue Widget API;
- safe machine-readable snapshots;
- task-scoped run settings;
- explicit action contracts;
- safe event envelope;
- report/evidence summaries;
- explicit execution and autonomous Queue safety boundaries;
- semantic test hooks;
- no shell/filesystem/storage hacks;
- no Git automation;
- no auto-finalization.

Future:

- multiple Coordinators;
- Coordinator scopes;
- optimistic revisions;
- QueuePatch review UI;
- conflict handling;
- event stream subscriptions across agents;
- richer report/evidence refs;
- ArtifactRef integration;
- durable runner/reconnect only after a separate explicit contract;
- broader semantic test runner support.

Future compatibility must not weaken the MVP safety model. Multiple
Coordinators still share one canonical Queue per Workspace and must use
app-native APIs with explicit scope, revision, conflict, event, evidence, and
operator-visible decision boundaries.

## 19. Acceptance Criteria

This contract is complete when:

- Queue API has clear identity, snapshot, action, event, evidence, and state
  sections.
- Task-scoped run settings are explicit.
- `executionWorkspace` is explicit as a Queue item field, not Queue widget view
  state.
- Singleton Queue rule is explicit.
- Autonomous semantics are explicit and Git-free.
- Workspace Agent control path is app-native.
- Safety boundaries are explicit.
- Semantic test hooks use action, event/state, assertion, and report flow.
- Future multi-Coordinator compatibility is noted without implementation.
- The contract does not implement frontend behavior, backend/runtime behavior,
  storage/schema changes, tests, provider tools, Git automation, hidden
  execution, or autonomous finalization.
