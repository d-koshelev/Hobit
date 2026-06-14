# Smart Queue Implementation Status

## Purpose

This checkpoint records the current implemented Smart Queue foundation and the
next implementation sequence. It exists to prevent future Queue work from
confusing pure frontend/product-model foundations with durable runtime
features.

This is a docs/status artifact only. It does not add frontend behavior,
backend/runtime behavior, storage/schema changes, Tauri commands, IPC,
scheduler or worker runtime, persistence, UI redesign, Finder behavior, Git
mutation, Terminal launch, Workspace Agent provider calls, or Agent Executor
execution.

## Current Status

Smart Queue has an implemented foundation for the singleton Queue surface,
duplicate Queue view protection/repair, pure dependency and eligibility
semantics, pure prompt-pack materialization, pure coordinator decision
selection, QueueV2 smart status presentation, frontend prompt-pack import
preview integration with Smart Queue materialization, and explicit
prompt-pack Create Queue items wiring from the Smart Queue materialized graph.

The durable Smart Queue runtime is not implemented yet. Current Smart Queue
modules are frontend/product-model foundations unless explicitly noted
otherwise.

## Implemented

### Queue UI singleton create guard

Implemented for the normal frontend Widget Catalog / Workbench add path.

- `apps/desktop/frontend/src/workbench/workspaceSingletonWidgets.ts` resolves
  singleton widgets by registry singleton metadata.
- `apps/desktop/frontend/src/workbench/workspaceWidgetActions.ts` reuses an
  existing visible Queue view or restores the same hidden Queue view instead of
  creating another `agent-queue` instance.
- This is a UI-view create guard only. It does not create durable Queue domain
  state, schedule work, or start workers.

### Persisted duplicate Queue view repair

Implemented as presentation-only frontend repair.

- `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.ts`
  exposes the duplicate Queue view repair helpers from
  `workspaceSingletonWidgets.ts`.
- The repair selects one canonical Queue view deterministically and hides
  duplicate Queue views when safe visibility fields are available.
- The repair does not delete Queue tasks, run links, worker config, reports,
  tags, context attachments, widget logs/results, or other Queue-owned domain
  data.

### Active Queue product surface ownership

Implemented as an explicit active/compat surface boundary.

- `apps/desktop/frontend/src/workbench/queue/queueSurfaceOwnership.ts` records
  the active product route:

```text
WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board
```

- The active product Queue uses the saved-compatible `agent-queue` widget
  definition id and `agent-queue-placeholder` component key.
- The WidgetV2 Queue path is smoke/compat/dev-only and must not become a
  second product Queue surface.

### Dependency / eligibility pure model

Implemented as a pure frontend model.

- `apps/desktop/frontend/src/workbench/queue/smartQueueEligibility.ts`
  computes dependency gates, dependency-derived blockers, human statuses, task
  eligibility, and dependency failure propagation.
- It distinguishes `waiting_dependency` from `blocked`.
- It requires Queue state `active`, ready task status, satisfied or absent
  dependencies, no blockers, and worker capacity before a task is considered
  auto-eligible.
- This is not a durable scheduler, backend worker selector, or persistence
  model.

### Prompt-pack materialization pure model

Implemented as a pure preview/materialization model.

- `apps/desktop/frontend/src/workbench/queue/smartQueuePromptPackMaterialization.ts`
  maps an explicit prompt pack input into a singleton Workspace Queue graph
  preview with materialized tasks, dependency edges, source metadata, merged
  settings, validation issues, and summary counts.
- The model targets queue id/key `workspace-queue`.
- Materialized tasks include `wouldStart: false`, and the preview includes
  `wouldStartTasks: false`.
- This model does not write persisted Queue tasks, arm execution, start
  workers, call Agent Executor, call Workspace Agent, mutate Git, or launch
  Terminal.

### Prompt-pack import preview integration

Implemented in the active frontend prompt-pack preview/import flow.

- `apps/desktop/frontend/src/workbench/queue/smartQueuePromptPackPreviewAdapter.ts`
  converts the existing prompt-pack preview shape into
  `SmartQueuePromptPackInput`.
- `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreview.ts`
  attaches Smart Queue materialization output to the active prompt-pack import
  preview model.
- `apps/desktop/frontend/src/workbench/promptPack/promptPackImportPreviewComponent.tsx`
  renders compact product-facing Smart Queue graph counts, Ready / Waiting
  dependency / Blocked counts, materialization issues, task settings, the
  singleton Workspace Queue target, and `wouldStartTasks: false`.
- Preview integration does not create Queue tasks, create or request a Queue
  widget/view, arm Queue Autorun, start workers, call Agent Executor, call
  Workspace Agent, mutate Git, launch Terminal, or change persistence/runtime
  semantics.

### Prompt-pack explicit Queue task creation

Implemented in the existing explicit `Create Queue items` action.

- `apps/desktop/frontend/src/workbench/promptPack/promptPackMaterialization.ts`
  now uses the preview's `smartQueueMaterialization` tasks and dependency
  edges as the Queue creation source of truth.
- Created Queue tasks preserve prompt title/body, source pack and prompt
  metadata, materialized settings where the current Queue task API has fields,
  and remaining prompt-pack metadata in the Queue prompt body.
- Materialized dependency edges are represented through the current Queue
  compatibility dependency field (`dependsOn` / `dependencies`) after all
  selected tasks are created.
- Blocking Smart Queue materialization issues prevent Queue task creation with
  a short product-facing error.
- Creation targets the singleton Workspace Queue through the existing
  workspace-scoped Queue bridge. It does not create a Queue widget/view, create
  another Queue, arm Queue Autorun, start workers, launch Agent Executor, launch
  Terminal, mutate Git, or implement scheduler runtime behavior.

### Coordinator decision pure model

Implemented as a pure decision/proposal model.

- `apps/desktop/frontend/src/workbench/queue/smartQueueCoordinatorDecision.ts`
  maps worker report inputs into coordinator decision records, retry policy,
  available/recommended actions, human status labels, and optional assistance
  request payloads.
- Side-effect flags are explicitly false: no Workspace Agent call, retry
  execution, Queue mutation, rollback, or worker start happens from this model.
- This is not a persisted coordinator ledger and does not execute decisions.

### QueueV2 Smart status presentation

Implemented for Smart Queue status presentation in the QueueV2 foundation.

- `apps/desktop/frontend/src/workbench/queue/smartQueueStatusPresentation.ts`
  turns eligibility, dependency, blocker, and coordinator decision state into
  human-facing status labels/details.
- `apps/desktop/frontend/src/workbench/queue/queueV2SmartStatusModel.ts`
  adapts current QueueV2 task/dependency state to the Smart Queue presentation
  vocabulary.
- This is presentation/model logic only. It does not change Queue lifecycle,
  run scheduling, worker execution, validation, finalization, or persistence.

### Active/Pause execution gate

Implemented for the current frontend Queue controller execution path.

- `apps/desktop/frontend/src/workbench/queue/smartQueueExecutionGate.ts`
  adapts the current singleton Queue global state into Smart Queue
  `active`/`paused` execution mode and centralizes the startability check.
- The existing autonomous Queue task picker now uses the gate before selecting
  a Ready task for execution.
- Queue Disabled/Paused prevents Ready tasks from being picked. Active permits
  only eligible Ready tasks with satisfied dependencies and no blockers.
- Waiting dependency, blocked dependency, needs-decision, failed, closed, and
  cancelled tasks are not startable through the gate.
- This is frontend/controller gate integration only. It is not a durable
  backend scheduler, worker runtime redesign, storage model, IPC contract, or
  persistence migration.

## Not Implemented Yet

The following features are not current implementation and must not be claimed
as available from the foundation above:

- durable backend/storage Smart Queue model
- worker stuck report integration
- retry execution
- rollback execution
- Workspace Agent assistance runtime call
- dependency failure propagation in durable runtime
- durable backend scheduler/worker auto-start of eligible tasks when Queue is
  Active
- durable Smart Queue batch/dependency storage beyond the current Queue task
  compatibility fields

The existing explicit prompt-pack `Create Queue items` action creates current
persisted Queue tasks through the pre-existing frontend Queue bridge using the
Smart Queue materialized graph. That import action is not a durable Smart Queue
scheduler/runtime and does not auto-run tasks.

## Active Architecture Summary

- There is one Workspace Queue per workspace.
- There is one Queue UI view per workspace.
- The active Queue product route is:

```text
WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board
```

- The WidgetV2 Queue path is smoke/compat/dev-only and must not become a second
  product Queue surface.
- The Queue Widget displays and controls Queue state. Queue domain/service
  code must own lifecycle logic.
- View creation, hiding, docking, floating, and duplicate view repair are
  presentation concerns. They must not delete or rewrite Queue domain data.

## Smart Queue Runtime Direction

- Prompt pack import preview creates a materialized Queue graph only.
- Explicit Create Queue items creates current Queue tasks from that materialized
  graph only after operator confirmation.
- Materialization must not auto-run tasks.
- Queue Active/Pause gate controls execution.
- Waiting dependency is not Blocked.
- Blocked means intervention or Queue Coordinator decision is required.
- Queue Coordinator owns lifecycle decisions.
- Workspace Agent is assistance/escalation, not Queue lifecycle owner.
- Worker Agent executes and reports, but does not decide retry, block, fail, or
  rollback.

## Recommended Next Implementation Order

1. Add durable Queue Active/Pause domain state if needed beyond the current
   frontend/controller mapping.
2. Add durable scheduler/worker runtime pickup if explicitly requested.
3. Add worker stuck report capture.
4. Add coordinator decision record / UI card.
5. Add retry same / retry with modified prompt.
6. Add Workspace Agent assistance request protocol wiring.
7. Add rollback proposal only, then safe rollback later.

## Implementation References

- `apps/desktop/frontend/src/workbench/workspaceSingletonWidgets.ts`
- `apps/desktop/frontend/src/workbench/workspaceWidgetActions.ts`
- `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.ts`
- `apps/desktop/frontend/src/workbench/queue/queueSurfaceOwnership.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueEligibility.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueuePromptPackMaterialization.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueCoordinatorDecision.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueStatusPresentation.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueExecutionGate.ts`
- `apps/desktop/frontend/src/workbench/queue/queueV2SmartStatusModel.ts`

## Guardrails

- Do not implement durable scheduler/runtime behavior from the pure models
  alone.
- Do not add a second Queue product surface through WidgetV2 Queue paths.
- Do not make Workspace Agent the owner of Queue lifecycle decisions.
- Do not treat prompt-pack materialization as an execution trigger.
- Do not collapse Waiting dependency and Blocked into one state.
- Do not touch Finder for Smart Queue implementation work unless a future task
  explicitly scopes Finder.
