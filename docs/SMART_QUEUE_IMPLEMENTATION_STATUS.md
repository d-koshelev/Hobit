# Smart Queue Implementation Status

## Purpose

This document records the current implemented Smart Queue foundation and the
parts that remain deferred. It is a status artifact only. It does not add Queue
runtime behavior, scheduler behavior, storage/schema changes, Tauri commands,
Agent Executor execution, Workspace Agent tool execution, Finder behavior, Git
mutation, Terminal launch, provider calls, or server/headless behavior.

## Status Summary

Smart Queue is partially implemented as a frontend/product-model foundation.
The codebase has test-backed models for the Queue singleton surface, duplicate
Queue view handling, dependency/eligibility semantics, prompt-pack
materialization previews, coordinator decision proposals, and QueueV2 Smart
status display.

The full Smart Queue runtime is not implemented. Current implementation remains
bounded to explicit operator-controlled Queue behavior and current-session
frontend/product model paths unless another current contract says otherwise.

## Implemented And Test-Backed

### Queue Singleton Domain/UI Invariant

Status: implemented for frontend registry metadata and UI-view resolution.

The saved-compatible Queue widget id remains `agent-queue`. The registry marks
only that definition as the Workspace singleton Queue surface with
`singleton: true`, `singletonScope: "workspace"`, and
`singletonKey: "workspace-queue"` in
`apps/desktop/frontend/src/workbench/widgetRegistry.ts`.

`apps/desktop/frontend/src/workbench/workspaceSingletonWidgets.ts` resolves the
existing singleton view by registry singleton metadata rather than by raw
definition array order.

Tests:

- `apps/desktop/frontend/src/workbench/widgetRegistry.test.ts`
- `apps/desktop/frontend/src/workbench/WidgetHost.queue-surface.test.tsx`

### Active Queue Surface

Status: implemented for the current product route.

The active user-facing Queue surface keeps saved compatibility through
`agent-queue` and the `agent-queue-placeholder` component key. `WidgetHost`
routes that saved-compatible surface to the current Agent Queue product
implementation, and `queue-v2` is not a separate insertable/product Queue id.

Primary references:

- `apps/desktop/frontend/src/workbench/widgetRegistry.ts`
- `apps/desktop/frontend/src/workbench/WidgetHost.queue-surface.test.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx`

### Duplicate Queue View Create Guard

Status: implemented for the normal frontend add/open path.

The singleton create/open guard reuses or restores the existing Workspace Queue
view before creating a new widget instance. The guard is metadata-driven by the
same registry singleton fields used by the Queue singleton invariant.

Primary references:

- `apps/desktop/frontend/src/workbench/useWorkbenchWidgetActions.ts`
- `apps/desktop/frontend/src/workbench/workspaceSingletonWidgets.ts`
- `apps/desktop/frontend/src/workbench/WorkbenchWidgetActions.test.ts`

### Persisted Duplicate Repair

Status: implemented as presentation-only frontend repair.

Persisted duplicate `agent-queue` views are detected and repaired before normal
Workbench rendering by hiding duplicate Queue views when a safe visibility field
is available. One canonical Queue view is selected deterministically. The repair
does not delete Queue domain data.

Primary references:

- `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.ts`
- `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.test.ts`

### Dependency/Eligibility Pure Model

Status: implemented as a pure frontend model and tests. It is not a durable
scheduler runtime.

The dependency model computes dependency gates (`none`, `waiting`, `satisfied`,
`failed`, `blocked`), separates `waiting_dependency` from `blocked`, maps
dependency failures to visible blockers, and computes start eligibility from
Queue state, task status, dependency gate, blockers, run configuration, and
worker capacity.

Primary references:

- `apps/desktop/frontend/src/workbench/queue/queueDependencyEligibilityModel.ts`
- `apps/desktop/frontend/src/workbench/queue/queueDependencyEligibilityModel.test.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueMvpSmoke.test.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkflowTypes.test.ts`

### Prompt-Pack Materialization Model

Status: implemented as a frontend preview/materialization model. It does not
start workers.

Prompt-pack materialization targets the singleton Workspace Queue id
`workspace-queue`, creates task drafts, preserves source/settings metadata,
creates dependency draft edges, surfaces invalid dependencies and missing
prompts/configuration as validation issues, warns when the Queue is Active, and
returns `wouldStartWorkers: false`.

Primary references:

- `apps/desktop/frontend/src/workbench/queue/queuePromptPackMaterializationModel.ts`
- `apps/desktop/frontend/src/workbench/queue/queuePromptPackMaterializationModel.test.ts`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackMaterialization.ts`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackMaterialization.test.ts`
- `apps/desktop/frontend/src/workbench/promptPack/promptPackImportQueueV2Regression.test.tsx`

### Queue Coordinator Decision MVP

Status: implemented as a typed frontend decision/proposal model. It does not
persist a full coordinator ledger or execute decisions by itself.

The coordinator model turns worker stuck reports into product-facing decision
records for validation failures, exec failures, missing context/config/prompt,
dirty worktree, dependency failure/blockage, retry proposals, and explicit
Workspace Agent assistance requests. Assistance responses become coordinator
decision proposals and still require coordinator/operator decision.

Primary references:

- `apps/desktop/frontend/src/workbench/queue/queueCoordinatorDecisionModel.ts`
- `apps/desktop/frontend/src/workbench/queue/queueCoordinatorDecisionModel.test.ts`
- `apps/desktop/frontend/src/workbench/queue/queueCoordinatorFinalizationService.ts`
- `apps/desktop/frontend/src/workbench/queue/queueCoordinatorFinalizationService.test.ts`
- `apps/desktop/frontend/src/workbench/workspaceChatQueueFinalizationActions.ts`
- `apps/desktop/frontend/src/workbench/WorkspaceAgentQueueTaskStatusCard.test.tsx`

### QueueV2 Smart Status UI

Status: implemented in the QueueV2 view model and product display mapping.

QueueV2 derives human-facing status text, dependency summaries, lanes,
eligibility flags, blocker summaries, next actions, and selected-task inspector
snapshots from current Queue task data. Imported prompt-pack dependents remain
in a waiting-dependency lane until prerequisites reach explicit closure, and
completed/report-ready work remains reviewable until explicit finalization.

Primary references:

- `apps/desktop/frontend/src/workbench/queue/queueV2SmartStatusModel.ts`
- `apps/desktop/frontend/src/workbench/queue/queueV2ViewModel.ts`
- `apps/desktop/frontend/src/workbench/queue/queueV2ViewModel.test.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/model/queueV2EligibilityModel.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/model/queueV2EligibilityModel.test.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Board.test.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2TaskDetailsPopup.test.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/queueV2/QueueV2Blockers.test.tsx`

## Current Test Coverage

The current focused Smart Queue coverage includes:

- Queue singleton registry metadata and product-surface routing:
  `apps/desktop/frontend/src/workbench/widgetRegistry.test.ts`,
  `apps/desktop/frontend/src/workbench/WidgetHost.queue-surface.test.tsx`
- Duplicate Queue view repair:
  `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.test.ts`
- Dependency gates, human statuses, blockers, and eligibility:
  `apps/desktop/frontend/src/workbench/queue/queueDependencyEligibilityModel.test.ts`
- Prompt-pack Queue materialization:
  `apps/desktop/frontend/src/workbench/queue/queuePromptPackMaterializationModel.test.ts`
- Coordinator decision proposal model:
  `apps/desktop/frontend/src/workbench/queue/queueCoordinatorDecisionModel.test.ts`
- End-to-end pure-model smoke for prompt-pack import, Queue paused/active
  eligibility, dependency closure, failure blocking, and coordinator validation
  decisions:
  `apps/desktop/frontend/src/workbench/queue/smartQueueMvpSmoke.test.ts`
- Smart Queue exported type vocabulary:
  `apps/desktop/frontend/src/workbench/queue/smartQueueWorkflowTypes.test.ts`
- QueueV2 status/eligibility display:
  `apps/desktop/frontend/src/workbench/queue/queueV2ViewModel.test.ts`,
  `apps/desktop/frontend/src/workbench/widgetV2/queueV2/model/queueV2EligibilityModel.test.ts`

## Deferred Work

The following remain deferred and must not be claimed complete from the current
implementation:

- Durable Smart Queue storage for first-class batches, dependency records,
  coordinator decisions, assistance requests/responses, and prompt-pack
  materialization records.
- Full scheduler/runtime behavior, including durable queue state transitions,
  reconnect/resume, background worker selection, and backend capacity
  enforcement.
- Retry execution, including actual retry attempt launch, retry result capture,
  retry history persistence, and automatic retry policies.
- Rollback isolation, including rollback execution, rollback validation,
  rollback evidence, and isolated rollback workspaces.
- Workspace Agent assistance execution. Current assistance is a typed request
  and decision-proposal boundary only; Workspace Agent does not own Queue
  lifecycle, start workers, mutate tasks hiddenly, or execute Queue work.
- Server/headless mode, including durable service workers, shared/team Queue
  state, server scheduler, server-side provider execution, RBAC, and remote
  wake/resume.

## Explicit Non-Changes In This Status Pack

- No runtime behavior was changed.
- No Finder files were modified.
- No widget ids, component ids, persisted ids, registry ids, task ids, IPC
  contracts, or storage compatibility contracts were renamed.
- No Spark-specific behavior or model routing was added.
