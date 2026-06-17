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

Smart Queue has an implemented frontend foundation for singleton Queue view
safety, prompt-pack materialization, dependency-aware eligibility,
frontend/controller execution gating, attempt and coordinator decision
presentation, explicit retry/handoff/proposal actions, typed Queue dogfood
lifecycle broker capabilities, a full fake broker-driven Queue dogfood loop
self-test, a frontend Queue worker evidence bundle model/adapter path, and
a frontend Queue worker evidence ingestion bridge, a Queue-linked Direct Work
metadata seam, Queue-linked Direct Work evidence event wiring, and focused
smoke coverage.

The durable Smart Queue backend/runtime is not implemented yet. Current Smart
Queue modules are frontend/product-model foundations unless explicitly noted
otherwise.

## Implemented Frontend Behavior

The current implemented frontend behavior is:

- singleton Queue view guard;
- persisted duplicate Queue UI-view repair;
- active Queue route ownership;
- prompt-pack materialization preview;
- explicit Create Queue items from the Smart Queue materialized graph;
- Active/Pause execution gate;
- dependency propagation/recovery;
- Smart Queue attempt model;
- Queue dogfood lifecycle model and frontend controller/view-model integration;
- typed frontend Action Broker capabilities for Queue dogfood lifecycle
  controller overlays;
- full fake Queue dogfood broker-loop self-test through those typed broker
  capabilities;
- frontend Queue worker evidence bundle model, validation, summaries, and
  adapters for existing/fake frontend run result shapes;
- frontend Queue worker evidence ingestion bridge from explicitly Queue-linked
  frontend completion shapes into `queue.lifecycle.agentFinished`;
- Queue-linked Direct Work metadata seam carrying explicit Queue item, run,
  executor, source, optional future attempt, and current-session idempotency
  identity for Queue-linked evidence event wiring;
- Queue-linked Direct Work completion event wiring from valid explicit
  Queue-linked metadata plus matching final Agent Executor run detail into the
  existing evidence ingestion bridge and Action Broker path;
- worker failure/stuck report to coordinator decision integration;
- QueueV2 Coordinator Decision Card;
- Retry same action;
- Retry with changes action;
- Ask Workspace Agent assistance request preparation;
- rollback proposal-only preparation;
- Smart Queue frontend smoke coverage.

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

### Frontend dependency failure propagation and recovery

Implemented for the active frontend Queue controller/model path.

- `apps/desktop/frontend/src/workbench/queue/smartQueueDependencyPropagation.ts`
  computes reversible dependency state from the current task graph without
  mutating downstream task status.
- Direct dependencies distinguish normal Waiting dependency from
  `Blocked: dependency failed` and `Blocked: dependency blocked`.
- Transitive failed dependencies now block grandchildren as
  `Blocked: dependency blocked` because their direct upstream is blocked by
  dependency state.
- QueueV2 status, lane placement, details summaries, autonomous task
  selection, and prompt-pack created dependency chains consume the recomputed
  frontend dependency state.
- Recovery is recomputed from current upstream state: closing a recovered
  upstream clears dependency-derived blockers while preserving other unfinished
  dependencies or non-dependency blockers.
- This is frontend/controller/model propagation only. It is not durable backend
  propagation, a storage/schema migration, backend scheduler behavior, retry
  execution, or worker runtime redesign.

### Attempt history pure model

Implemented as a pure frontend model foundation.

- `apps/desktop/frontend/src/workbench/queue/smartQueueAttemptModel.ts`
  models explicit Queue task attempt records, attempt history, current-attempt
  selection, retry-number foundation, coordinator decision attachment,
  validation/failure summaries, changed-file counts, and rollback-scope
  metadata.
- The first attempt is numbered 1. Appended retry foundation attempts use the
  previous maximum attempt number plus 1 while preserving previous attempts.
- Terminal attempt lifecycle helpers preserve completed, failed, and cancelled
  attempt records instead of rewriting their execution history.
- Failed attempts can be converted into a pure coordinator worker-report shape
  that references `taskId` and `attemptId` and carries product-facing evidence
  summaries for coordinator decisions.
- Attempt summaries are product-facing and do not expose internal enum names.
- Rollback scope is metadata only: changed files, base revision, attempt id,
  approval requirement, and a false execution flag.
- This is not durable backend attempt persistence, actual retry execution,
  actual rollback execution, scheduler behavior, worker runtime behavior,
  storage/schema migration, Tauri/IPC behavior, Git mutation, or Terminal
  launch.

### Queue dogfood lifecycle pure model and frontend controller adapters

Implemented as a pure frontend model foundation with controller/view-model
adapter integration and typed frontend Action Broker capability access.

- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle*.ts`
  separates dogfooding ticket state from agent/prompt state.
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycleController.ts`
  adapts dogfood lifecycle overlays to existing Queue task objects without
  renaming or removing legacy Queue task statuses.
- Ticket states are `draft`, `queued`, `blocked`, `running`,
  `awaiting_review`, `in_review`, `done`, and `failure`.
- Agent/prompt states are `idle`, `running`, `completed`, `not_completed`,
  `failed`, and `additional_prompt_running`.
- The model supports review messages, coordinator ACK transition from
  `awaiting_review` to `in_review`, validation approval placeholders, commit
  request placeholders, fake commit result attachment, explicit done, explicit
  block/fail, and same-item follow-up prompt records.
- Failed agent prompt outcomes are routed to review first; terminal ticket
  failure requires an explicit coordinator decision.
- Dependents are startable only after the upstream ticket reaches `done`, not
  merely after agent completion, awaiting review, in review, validation
  approval, or fake commit result attachment.
- The controller adapter exposes pure helpers for lifecycle creation/derivation,
  agent-finished transitions, coordinator ACK, done/follow-up decisions,
  dependency done gates, and product-facing lifecycle presentation.
- QueueV2 view-model helpers can consume an explicit dogfood lifecycle overlay
  to show `Awaiting review`, `In review`, `Done`, `Failure`, `Agent completed`,
  `Agent not completed`, `Agent failed`, `Follow-up prompt running`,
  `Review acknowledged`, `Waiting for coordinator review`, and `Additional
  prompts: N` without redesigning Queue cards.
- Frontend dependency summaries can use the dogfood overlay so dependents stay
  waiting while upstream is agent-completed, awaiting review, or in review, and
  become eligible only when upstream is dogfood `done`.
- Product-facing helpers emit labels such as `Awaiting review`, `In review`,
  `Agent completed`, `Follow-up prompt running`, `Review acknowledged`, and
  `Waiting for coordinator review`.
- `smartQueueDogfoodLifecycle.test.ts` covers the fake full lifecycle,
  follow-up branch, invalid transitions, terminal states, ACK targeting,
  fake commit attachment, done-gated dependencies, and no hidden side effects.
- `smartQueueDogfoodLifecycleController.test.ts` covers controller overlays,
  QueueV2 presentation integration, done-gated frontend dependency eligibility,
  fake full lifecycle self-test, follow-up prompt branch, and hidden-side-effect
  guards.
- `queue.lifecycle.agentFinished`, `queue.review.createMessage`,
  `queue.review.ack`, `queue.coordinator.approveValidation`,
  `queue.coordinator.addFollowUpPrompt`, `queue.item.markDone`,
  `queue.item.block`, `queue.item.fail`, `queue.lifecycle.get`, and
  `queue.review.getEvidenceBundle` are exposed as typed Action Broker
  capabilities for frontend/controller lifecycle overlays.
- Workspace Agent can invoke those capabilities only by emitting structured
  `hobit.action.request` envelopes. User prompt regex routing is not
  implemented.
- `apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
  now proves a fake full dogfooding loop through the real broker and registered
  Queue lifecycle handlers: agent finished, review message, ACK, validation
  approval, mark done with fake commit metadata, done-gated dependent unblock,
  follow-up prompt returning to running, failure-dependent blocking, and no
  hidden side effects.
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts`
  defines the frontend Queue worker evidence bundle model, outcome mapping,
  validation, bounded display summaries, lifecycle/review adapters, and pure
  adapters from existing frontend Direct Work, Agent Executor, Workspace Agent,
  and Queue worker report shapes where those shapes are clear.
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
  defines the frontend ingestion bridge that requires an explicit Queue
  `taskId`, builds or normalizes a `QueueWorkerEvidenceBundle`, validates
  task/attempt/outcome/final-report requirements, invokes only
  `queue.lifecycle.agentFinished` through the Action Broker, supports dry-run
  preview, and returns product-facing labels such as `Queue worker evidence
  ingested`, `Queue item awaiting review`, `Queue evidence ingestion failed`,
  and `Queue evidence ingestion skipped`.
- `queue.lifecycle.agentFinished` accepts either the existing explicit fields
  or an optional structured evidence bundle. A valid bundle can supply task,
  attempt, thread, outcome, final agent message, validation summary, and
  changed-files summary. Task, attempt, outcome, or thread mismatches are
  rejected as invalid input.
- Review message creation can attach the bundle's bounded product-facing
  evidence summary, and `queue.review.getEvidenceBundle` can return the
  normalized frontend bundle from the controller/fake store when available.
- The ingestion bridge can adapt explicitly Queue-linked fake/frontend Direct
  Work, Workspace Agent, Agent Executor, and Queue worker report completion
  data where those shapes are clear. Non-linked Direct Work completion returns
  an explicit skipped/not-linked result instead of inferring the task from
  text.
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts`
  defines the frontend-only Queue-linked Direct Work metadata seam. Queue start
  handoffs can carry explicit Queue item id, Direct Work run id, Agent Executor
  widget id, source, optional future attempt id, linked/completed timestamps
  where available, and a stable current-session idempotency key.
- The metadata seam validates handoff identity and finalization identity
  without calling the ingestion bridge. Agent Executor run detail or final
  stream events must match the explicit run id before a valid completion
  identity can be produced. Final stream events alone do not create Queue
  evidence without an explicit Queue handoff.
- The idempotency key uses only explicit link fields: workspace id when
  available, Queue item id, run id, and attempt id when available. It does not
  use prompt text, task title, repository path, final agent message, changed
  files, validation output, or other natural-language content.
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.ts`
  and `apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`
  wire the safe first automatic ingestion point: Queue-started Direct Work
  completion with valid explicit metadata and matching final
  `AgentExecutorRunDetail`. The hook calls only the injected ingestion bridge
  callback, which then invokes `queue.lifecycle.agentFinished` through the
  Action Broker.
- Queue-linked evidence event wiring is current-session frontend-only and
  idempotent by the metadata key. Stream final event and recovered final detail
  for the same Queue item/run are ignored after the first bridge attempt.
  Different explicit run ids or Queue item ids can ingest separately.
- Raw Workspace Agent final events, raw Direct Work final events without Queue
  metadata, Agent Activity events, standalone Executor history, and text/title/
  path/final-message inference remain blocked as ingestion sources.
- Successful Queue-linked evidence event wiring moves only the linked item to
  `awaiting_review` through the bridge/broker/controller path and makes
  normalized frontend-only evidence readable for explicit review/evidence
  actions. It does not auto-create review messages, ACK review, approve
  validation, mark done, start dependents, start workers, run validation, run
  Git, execute rollback, launch Terminal, call shell/Codex, or persist backend
  state.
- The fake broker-loop success path now sends a fake worker evidence bundle
  into `queue.lifecycle.agentFinished` and asserts broker consumption, review
  message evidence summary, normalized evidence readback, no Git execution on
  mark done, and done-gated dependent unblocking.
- Lifecycle capability dry-runs preview transitions without mutating state.
  Real invocation mutates only frontend/controller overlay state where an
  injected lifecycle adapter or Queue bridge task seed is available.
- Ingestion bridge tests prove dry-run immutability, broker-only mutation to
  `awaiting_review`, evidence readback, explicit review-message evidence
  summary inclusion, no auto-done/dependent unblock before coordinator
  `markDone`, unavailable dependency handling, no task-id inference from text,
  and no Codex/shell/Terminal/Git/rollback/worker/duplicate Queue side effects.
- This is not durable backend lifecycle persistence, real worker execution,
  broad automatic real worker result event integration, scheduler redesign, validation
  execution, Git commit execution, rollback, storage/schema migration,
  Tauri/IPC behavior, Queue UI redesign, or Finder behavior.

### Frontend worker failure/stuck report integration

Implemented for the active frontend Queue controller/model path.

- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerReportIntegration.ts`
  converts current Queue execution, validation, setup, timeout/tool, dirty
  workspace, and unknown failure signals into Smart Queue failed attempt
  evidence, worker reports, Queue Coordinator decision proposals, and short
  product-facing Queue statuses.
- The autonomous Queue controller records structured failure evidence on
  missing task config, Direct Work start failure, failed/timed-out execution
  completion, validation failure evidence, and active-run terminal failure
  reconciliation.
- Worker failure handling now reports failure/stuck evidence and stores a
  Coordinator proposal in the existing frontend report/local task model. The
  worker path does not silently decide retry, rollback, final failure, or
  acceptance.
- QueueV2 status presentation can read the structured Smart Queue failure
  payload from the latest worker report and show product-facing labels such as
  `Needs decision: validation failed`, `Blocked: exec failure`,
  `Blocked: missing config`, `Blocked: dirty workspace`, `Retry available`, and
  `Retry limit reached`.
- Needs-decision and blocked tasks remain ineligible for autonomous selection.
- This is frontend controller/model integration only. Durable backend
  persistence for Smart Queue attempts/decisions is not implemented. Automatic
  retry execution / worker start is not implemented. Rollback execution is not
  implemented. Workspace Agent assistance runtime calls are not implemented.

### QueueV2 Coordinator Decision card UI

Implemented for the active Queue product details path.

- Active Queue task details can render a compact Coordinator Decision card when
  the selected task has a structured Smart Queue worker failure/coordinator
  decision payload.
- The card shows what happened, why a decision is needed, the recommended
  action, allowed next actions, approval requirement, destructive-action
  status, and an honest unavailable action state for actions that are not yet
  wired.
- Legacy tasks without structured Smart Queue decision payloads render existing
  details unchanged.
- The card is enabled only on the active Queue route
  `WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board`; the
  WidgetV2 Queue smoke/compat path does not opt into this product card.
- Retry same UI/controller action is implemented when a structured Smart Queue
  coordinator decision explicitly allows `retry_same` and retry budget remains.
  Accepting Retry same records a new pending frontend attempt/retry metadata
  record, preserves previous failed report evidence, clears the current
  needs-decision state for the task, and returns it to Ready without starting
  a worker. Queue Active/Pause, dependency, blocker, retry-budget, and worker
  gates still control any later pickup.
- Retry with modified prompt UI/controller action is implemented when a
  structured Smart Queue coordinator decision explicitly allows
  `retry_with_modified_prompt` and retry budget remains. The active Queue task
  details card opens a compact operator editor with the current prompt and an
  editable modified prompt. Accepting the retry records a new pending frontend
  attempt/retry metadata record, preserves previous failed report evidence,
  stores the original and modified prompt in retry metadata, updates only the
  task's next runnable prompt field, clears the current needs-decision state,
  and returns the task to Ready without starting a worker. Queue Active/Pause,
  dependency, blocker, retry-budget, and worker gates still control any later
  pickup.
- Ask Workspace Agent assistance request UI/controller action is implemented
  when a structured Smart Queue coordinator decision explicitly allows
  `request_workspace_agent_assistance`. The active Queue task details card
  shows a real Ask Workspace Agent action only when the Queue controller
  handler exists. Accepting the action records a bounded frontend assistance
  request/handoff report, preserves previous failed report evidence and
  attempts, keeps the task blocked or awaiting coordinator review, and shows a
  product-facing handoff prompt for the operator to send to Workspace Agent.
  This handoff preparation does not start Workspace Agent, start a worker,
  queue retry execution, execute rollback, mutate Git, launch Terminal, clear
  dependency blockers, or create another Queue view.
- Rollback proposal preparation UI/controller action is implemented when a
  structured Smart Queue coordinator decision explicitly allows
  `rollback_attempt_proposal`. The active Queue task details card shows a real
  Prepare rollback proposal action only when the Queue controller handler
  exists. Accepting the action records bounded frontend rollback proposal
  metadata, preserves previous failed report evidence and attempts, keeps the
  task blocked or awaiting coordinator review, and shows approval-required,
  destructive, affected-file, base-revision, reason/evidence, and
  no-rollback-executed state inside the existing task details popup. This
  proposal preparation does not execute rollback, mutate Git or files, start a
  worker, create a retry attempt, call Workspace Agent, launch Terminal, clear
  dependency blockers, or create another Queue view.
- Rollback execution is not implemented.
- Git/file mutation for rollback is not implemented.
- Workspace Agent assistance runtime calls are not implemented.
- Durable backend attempt persistence is not implemented; retry attempt history
  and rollback proposal metadata are carried through the current frontend Queue
  task worker-report payloads and update path where that model supports report
  history.

### Smart Queue frontend smoke coverage

Implemented as focused frontend smoke/regression coverage.

- `apps/desktop/frontend/src/workbench/queue/smartQueueEndToEndSmoke.test.tsx`
  covers prompt-pack import to the singleton Queue, dependency edge
  materialization, no-view/no-worker import safety, Queue Active/Pause
  eligibility, dependency failure propagation and recovery, worker validation
  failure evidence to the active QueueV2 Coordinator Decision card, Retry same,
  Retry with changes, Workspace Agent assistance request handoff preparation,
  rollback proposal-only preparation, active product route rendering, WidgetV2
  Queue compat non-opt-in behavior, singleton view safety, and hidden side-effect
  guards.
- The smoke coverage asserts product-facing labels such as Ready, Waiting
  dependency, Blocked: dependency failed, Blocked: dependency blocked, Needs
  decision: validation failed, Retry available, Approval required, Destructive,
  and No rollback executed, while rejecting raw internal action/blocker enum
  names in the rendered decision card.

## Not Implemented Yet

The following features are not current implementation and must not be claimed
as available from the foundation above:

- durable backend Smart Queue persistence;
- backend scheduler/runner ownership;
- durable attempt persistence;
- durable coordinator decision persistence;
- durable dogfood lifecycle persistence;
- broad automatic real worker result event integration with the dogfood
  lifecycle model;
- durable worker evidence bundle persistence;
- real validation evidence execution or durable attachment to the dogfood
  lifecycle model;
- real commit execution or durable commit metadata attachment;
- actual rollback execution;
- Workspace Agent runtime auto-call;
- Git/file mutation actions;
- Terminal launch/actions;
- remote/server/enterprise queue runtime;
- backend migrations or storage schema changes.

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

## Next Engineering Blocks

1. Design durable backend persistence for attempts, lifecycle, review
   messages, ACKs, decisions, worker evidence, validation evidence, and commit
   metadata.
2. Design backend scheduler/runtime ownership.
3. Integrate real worker reports, validation evidence, and explicit commit
   approval/results with the dogfood lifecycle model.
4. Add safe Workspace Agent handoff integration.
5. Design rollback execution only after the approval/safety contract is ready.

Queue-linked Direct Work completion evidence wiring is now available only for
explicit Queue handoffs with matching final Agent Executor run detail. Backend
durability, restart recovery, real validation evidence execution, and real Git
commit execution remain separate later blocks. Broad Queue UI polish is not
the blocker for proving the current fake broker loop.

## Implementation References

- `apps/desktop/frontend/src/workbench/workspaceSingletonWidgets.ts`
- `apps/desktop/frontend/src/workbench/workspaceWidgetActions.ts`
- `apps/desktop/frontend/src/workbench/queue/queueSingletonViewRepair.ts`
- `apps/desktop/frontend/src/workbench/queue/queueSurfaceOwnership.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueEligibility.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueuePromptPackMaterialization.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueCoordinatorDecision.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle*.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycleController.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts`
- `apps/desktop/frontend/src/workbench/useDirectWorkRunHandoff.ts`
- `apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`
- `apps/desktop/frontend/src/workbench/agents/adapters/queueAgentDogfoodLifecycleCapabilities.ts`
- `apps/desktop/frontend/src/workbench/agents/adapters/queueAgentDogfoodLifecycleController.ts`
- `apps/desktop/frontend/src/workbench/agents/capabilities/queueDogfoodLifecycleCapabilityManifest.ts`
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
