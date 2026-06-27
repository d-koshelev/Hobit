# Queue Backend Ownership Contract

## Purpose

This contract defines the Queue responsibility boundary for backend/domain,
storage, Tauri/API, Workspace Agent broker adapters, frontend API wrappers, and
UI.

Workflow orchestration, action risk classes, typed `nextAction`, structured
confirmation, and bounded grant rules are defined in
`docs/QUEUE_WORKFLOW_ORCHESTRATION_CONTRACT.md`.

Queue coordination vocabulary for Task, RunAttempt, ActorRef,
ExecutorTarget, QueueEvent, ArtifactLink, Assignment, and Claim is defined in
`docs/QUEUE_WORKSPACE_COORDINATION_CONTRACT.md`. New Queue backend/API work
must use that vocabulary when adding coordination model fields or contracts.

## Ownership Rules

- Queue business truth lives in backend/domain/storage.
- Storage persists durable Queue task rows, dependencies, run links, worker
  evidence bundles, review message/ACK ledgers, completion/failure decisions,
  and Queue workflow run/action ledgers.
- Tauri/API exposes typed commands and DTOs over backend state. It does not
  depend on React, Queue boards, view models, or frontend overlays.
- Workspace Agent and broker adapters call typed Queue backend/Tauri APIs
  through an injected Queue backend API port. They do not own product lifecycle
  truth.
- The Queue `ModuleControlSurface` is the agent-facing metadata contract over
  these typed APIs. It may describe backend-backed, bridge-backed,
  model-preview, transitional, unavailable, and future workflow metadata, but
  it does not execute Queue behavior by itself.
- Queue capability metadata for the generic `ModuleControlSurface` is adapted
  from the existing Queue capability contract inventory. Queue remains the
  reference module for rich capability metadata: exact capability ids,
  backend-backed versus transitional backing, risk classes, structured
  confirmation requirements, required id fields, and trusted actor context are
  preserved for generic module tooling. The adapter is metadata-only and does
  not change backend lifecycle semantics, broker execution, Queue UI behavior,
  or action continuation policy.
- `ModuleControlSurfaceRegistry` is the UI-independent discovery layer for
  agent-facing module surfaces. Queue is the first registered module. Registry
  metadata is not runtime behavior and must not import Queue UI, widget
  components, CSS, or visual shell modules. Other modules will register later.
- Queue UI widgets are not executable Queue APIs. Backend-backed capabilities
  must remain testable without mounting Queue UI components.
- Backend Queue APIs must not require Queue UI, Agent Queue widget presence, or
  Agent Executor widget identity for backend-owned `queue_local` workflows.
  Widget ids are compatibility/display attribution unless an older explicit
  Agent Executor path is being preserved.
- Frontend API wrappers translate desktop/browser availability into typed API
  calls. They do not derive Queue state from UI-selected task detail.
- UI may render authoritative DTOs, collect explicit operator input, and manage
  local loading/selection/display state only.
- No frontend overlay, board-local evidence map, selected-task detail, or UI
  view model may be used as the source of truth for product Queue state.
- Queue correctness for backend-backed behavior must be testable through
  backend/domain/Tauri/API contracts without launching the frontend UI.
- Any frontend-only transitional Queue code must be labeled as transitional and
  have a removal path to backend/domain ownership.

## Workflow Persistence Ownership

Queue workflow run state is backend/domain/storage truth, not frontend session
memory. `agent_queue_workflow_runs` stores the durable workflow-run header,
typed input snapshot, safe bounded grant summary, variables, slot bindings,
mutation references, idempotency keys, compact action-log summary, phase/step,
status, pause/block reasons, and timestamps. `agent_queue_workflow_actions`
stores backend-internal step/action idempotency ledger rows keyed by workflow
run and idempotency key.

The typed workflow persistence API exposes start/get/list/cancel/report,
read-only resume planning, and a narrow runner-report record API. Start is
idempotent by `workspaceId + requestId + requestHash`; same request id with a
different typed snapshot is a conflict and must block runner invocation. Cancel
is non-destructive and does not mutate Queue tasks, run links, review messages,
evidence bundles, completion/failure decisions, workers, Git, Terminal,
validation, rollback, or scheduler state. Reports read persisted workflow/run
action rows. Resume planning reads persisted workflow state and durable Queue
facts to return a typed plan/blocker; it does not execute workflow steps.
Runner-report recording may update only the workflow run/action ledgers with
bounded status, phase/step, blocker, variable/slot-binding, mutation-ref, and
idempotent action-summary state for legacy read/report compatibility.
Create/setup/start, worker-evidence, review, and finalization transition state
is produced by backend StepPlan/StepResult paths, not by frontend report
synthesis.
Slot bindings are backend-owned recovery bindings, not frontend runner
variables. Runner-report recording must merge incoming binding fields into the
existing binding, preserve existing non-null task/spec/dependency/settings/
promotion/run/evidence/review/decision refs when the incoming report omits
them, and reject conflicting non-empty refs as typed conflicts. Minimal runner
slot maps may be persisted under `variables_json` for report readability, but
they must not replace `slot_bindings_json`.

Backend workflow task slot materialization is now a narrow workflow-internal
domain method. It creates or reuses draft/manual Queue tasks by explicit
`workflowRunId + slot + taskSpecHash`, records a backend `create_task` action
ledger row keyed by `workflowRunId:create_task:slot:taskSpecHash`, and persists
the durable slot-to-task binding in `agent_queue_workflow_runs.slot_bindings_json`.
It may materialize dependency edges only by resolving explicit
`dependsOnSlots` to already-bound upstream task ids in the same workspace. It
must block on missing upstream bindings, task-spec hash conflicts, conflicting
action refs, cross-workspace task ids, or dependency-edge mismatches. It must
not update run settings, assign/promote tasks, enable Queue, start workers,
record evidence, create/ACK reviews, finalize, validate, mutate Git, roll
back, launch Terminal, schedule work, or start downstream tasks.

Workflow-owned run-settings setup and task promotion are separate narrow
backend/domain methods for already materialized slots. Run-settings setup
applies explicit typed task run settings and executor assignment to the bound
task, computes/persists `settingsHash`, stores a bounded `runSettings`
snapshot and `updateRunSettings` action refs in the slot binding, and records
an `update_run_settings` action keyed by
`workflowRunId:update_run_settings:slot:settingsHash`. Task promotion requires
matching `taskSpecHash`, matching `settingsHash`, and durable task settings/
executor assignment that match the slot binding; it moves `draft` to `queued`
or treats already `queued`/`ready` as idempotent only with matching hashes. It
stores promoted refs in the slot binding and records a `promote_task` action
keyed by `workflowRunId:promote_task:slot:taskSpecHash:settingsHash`.
Both actions are idempotent for identical typed refs and conflict/block for
changed slot hashes, task ids, action refs, or executor assignment. They do
not start workers, create run links, satisfy dependencies, record evidence,
create/ACK reviews, finalize, validate, mutate Git, roll back, launch
Terminal, schedule, or auto-start downstream work. The current MVP accepts
only `manual` workflow execution policy for setup.

Workflow persistence APIs are not Workspace Agent broker capabilities. They
are backend-backed storage/reporting APIs consumed by the typed Queue workflow
runtime adapter. No public append-event command exists; action-ledger mutation
remains backend-internal. Persisted grant summaries and runner reports must not
store reusable confirmation tokens or secrets.

Workflow-owned create/setup/start is a backend/domain StepPlan/StepResult
transition. Planning and execution must share the same resolver, canonical
request hash, task/dependency/settings/execution-target hashes, Queue control
snapshot, blockers, action-ledger model, and slot-binding merge behavior.
Execution starts or reuses the workflow run by `workspaceId + requestId +
requestHash`, materializes explicit upstream/downstream slots, creates explicit
dependency edges, applies upstream run settings, promotes only upstream,
checks backend Queue control, starts only the upstream worker with canonical
`start_worker` refs, stores `runId`, and pauses at `run_start` /
`awaiting_worker_completion`. Same request id with a different typed snapshot
is a backend conflict. Expected blockers are stored on focused action rows
when possible. The frontend workflow path must call this step instead of raw
materialization/settings/promote/start ports, must not synthesize create/setup/
start action rows, must not write slot-binding deltas, and must not decide
persistent workflow status/currentStep. The step does not record evidence,
create/ACK reviews, finalize, validate, mutate Git, roll back, launch Terminal,
schedule work, create synthetic widget runs, infer ids from prose/UI/order/
path, or start downstream work.

The backend StepResult is also the source of an internal worker launch intent
for Tauri when the create/setup/start step newly creates a backend-owned
`queue_local` run. The intent carries typed launch refs such as workspace id,
task id, run id, run-link id when known, execution target kind, provider id,
workflow run/action refs, launch disposition, and the internal Direct Work
input. This intent is not frontend product truth and must not be serialized in
the frontend workflow StepResult DTO. Tauri consumes only
`launchDisposition: newly_started` for `executionTargetKind: queue_local`,
registers that run in the in-session `DirectWorkActiveRunRegistry`, and starts
one Codex Direct Work process. Duplicate/idempotent StepResults,
already-running starts, disabled Queue control, conflicts, invalid input, and
blocked preconditions do not launch. On process terminal status, the existing
completion bridge updates the Queue run link and task lifecycle; worker
evidence remains a separate explicit phase. Backend-owned `queue_local`
launch/completion does not require an Agent Executor widget, Agent Queue
widget, or `widget_runs`, and no synthetic widget run may be created.

Workflow-owned worker evidence recording is a separate narrow backend/domain
path. It requires
explicit `workspaceId`, `workflowRunId`, `slot`, `taskId`, `runId`, bounded
worker final status/outcome/summary input, and an exact workflow action
idempotency key. The default key is
`workflowRunId:record_worker_evidence:slot:taskId:runId`. Planning and
execution must share the same worker-evidence resolver, canonical refs,
preconditions, blocker taxonomy, idempotency key, slot-binding merge behavior,
and action-ledger behavior. The backend must validate that the task/run match
the persisted slot binding, that the run belongs to the task and workspace via
`agent_queue_task_run_links`, and that the worker is durably complete enough to
record evidence. Backend-owned `queue_local` runs do not require `widget_runs`
rows and must not synthesize them; widget attribution is optional and only
stored when a real widget instance exists. Existing matching evidence is
idempotent success; existing mismatched evidence, changed action refs, missing
bindings, missing worker completion, or ambiguous worker state must block or
conflict. Execution creates or locks the canonical `record_worker_evidence`
action before the mutation attempt. On success the backend completes that
action and persists `evidenceBundleId`, evidence action refs, recorded
timestamp, and bounded worker final status into workflow state and the action
ledger. This path must not create/ACK reviews, mark done, fail, block, follow
up, validate, mutate Git, roll back, launch Terminal, start workers, start
downstream work, create/update/promote tasks, enable Queue, or infer ids from
prose/UI/session state.

Workflow-owned review is a separate narrow backend/domain transition step.
Planning and execution must share the same review resolver, canonical refs,
preconditions, blocker taxonomy, slot-binding merge behavior, and action-ledger
behavior. The resolver validates the persisted workflow run, explicit slot,
task, queue-local run link, durable evidence bundle, existing review message,
terminal decision absence, downstream-not-started state, and fresh grant
constraints. The canonical create action key is
`workflowRunId:create_review_message:slot:taskId:runId:evidenceBundleId`; the
canonical ACK action key is
`workflowRunId:ack_review_message:slot:messageId`. Execution creates or reuses
the review message, ACKs it idempotently, records completed create/ACK action
rows, persists `messageId` and review action refs into workflow state, and
pauses at `review / awaiting_finalization` with `nextPhase=finalization`.
Backend-owned `queue_local` review runs validate through
`agent_queue_task_run_links`; `agent_queue_review_messages.run_id` does not
require a `widget_runs` row and no synthetic widget run is created. This path
must not finalize, mark done, fail, block, follow up, validate, mutate Git,
roll back, launch Terminal, start workers, start downstream work,
create/update/promote tasks, enable Queue, or infer ids from prose/UI/session
state.

Workflow-owned finalization is a separate narrow backend/domain transition
step. Planning and execution must share the same finalization resolver,
canonical refs, preconditions, blocker taxonomy, slot-binding merge behavior,
terminal workflow-state update, downstream read-only verification, and
action-ledger model. Acceptance finalization targets only
`dependency_acceptance_smoke`, requires durable worker evidence, a durable
review message and ACK, a fresh exact structured confirmation token, and no
failure reason, then idempotently calls `markDone`, persists
`completionDecisionId`, completes the workflow, and verifies downstream
dependency-ready/no-auto-start state. Failure finalization targets only
`dependency_failure_smoke`, requires the same durable evidence/review/ACK and
fresh exact confirmation plus a typed non-empty `failureReason`, then
idempotently calls `failItem`, persists `failureDecisionId`, completes the
workflow, and verifies downstream `failed_upstream`/no-auto-start state.
Backend-owned `queue_local` finalization validates run identity through
`agent_queue_task_run_links`, evidence bundles, review messages/ACKs, and
Queue task ownership; completion/failure decision `run_id` values do not
require a `widget_runs` row and no synthetic widget run is created. Raw
confirmation tokens must not be stored in workflow JSON, action refs, reports,
logs, or debug projections.

The typed Queue workflow runtime adapter now delegates `create_setup_start`,
`worker_evidence`, `review`, and `finalization` dependency-smoke transitions
to backend StepResult APIs through a thin frontend backend-step dispatcher.
For initial requests, the adapter passes the structured workflow request to
the backend create/setup/start step without independently starting the workflow
run. For continuations, it resumes from an explicit
`metadata.workflowRunId`, calls the read-only resume planner before
continuation phases, invokes the backend step when the backend plan marks that
step ready/retryable, and projects the returned StepResult for
activity/report/debug display. For those backend-owned phases, the frontend
does not call raw materialization/settings/promote/start/evidence/review/
finalization mutation ports, inspect local Queue aggregates or local refs to
decide executability, synthesize workflow action rows, write slot-binding
deltas, persist authoritative workflow status/currentStep, repair stale
actions, or turn typed backend blockers into generic runner-failed action
rows. Backend StepResult action snapshots may remain visible as backend-owned
debug/report data.

The frontend phase boundary is:

- `backendOwnedPhases`: `create_setup_start`, `worker_evidence`, `review`,
  `finalization`.
- `legacyFrontendPhases`: `read`.

All mutating dependency-smoke workflow phases are backend-owned. No new
mutating workflow phase may be added to frontend orchestration; future mutating
phases must start as backend/domain StepPlan/StepResult commands with
frontend request normalization and projection only.
The frontend runtime adapter no longer exposes raw workflow mutation ports for
materialize/settings/promote/start, worker evidence recording, review
create/ACK, or final mark-done/fail execution. Deleted legacy frontend phase
modules must not be reintroduced; backend StepResult action snapshots may be
projected for display/debug, but frontend code must not synthesize mutating
action rows, slot-binding deltas, workflow status/currentStep, retryability,
or recovery decisions for these phases.

Resume planning must reconcile only explicit persisted bindings and variables:
task ids, run ids, evidence bundle ids, review message ids, completion decision
ids, failure decision ids, and future executor widget ids. Bound ids must
belong to the same workspace and to each other when both sides are present
(for example run-to-task, evidence-to-task/run, review-to-task/run/evidence,
and completion/failure decision-to-task). Missing durable facts return typed
missing blockers; mismatched durable facts return `blocked_state_mismatch`.
When bindings are incomplete, completed workflow action rows may be used only
as secondary typed recovery evidence from their target/result refs. Missing
action refs block as `blocked_incomplete_workflow_action_refs`, and missing
slot identity blocks as `blocked_incomplete_slot_binding`; planner code must
not continue with weak proof.
Planner code must not infer ids, permissions, confirmations, or workflow input
from task titles, prompts, UI selection, frontend order, file paths, or prose.
For workflow materialized slots, resume planning also validates persisted
`taskSpecHash`, `dependencySpecHash`, `dependencyEdgeHash`, `settingsHash`,
bounded run-settings snapshots, executor bindings, and promoted state when
enough typed input or binding data is present. It returns
`blocked_dependency_edge_missing` for missing exact dependency edges,
`blocked_settings_mismatch` for settings drift,
`blocked_executor_mismatch` for executor drift, and
`blocked_promote_state_mismatch` for promote-state drift without repairing
durable state. After worker start, a persisted run binding with no evidence
returns `awaiting_worker_completion` while the worker is still running and
`waiting_for_worker_evidence` when the worker has durably finished. If a
workflow binding contains an `evidenceBundleId` that cannot be found, planning
returns `blocked_missing_evidence`; mismatched evidence/task/run facts return
`blocked_state_mismatch`. The planner never records evidence by itself.
Any mutating restart target must require a fresh grant where its capability
contract requires one. Worker start and finalization restart targets also
require fresh exact structured confirmation. Review create/ACK restart targets
require durable evidence/message ids and a fresh grant, but they must not
replay or persist reusable confirmation tokens. Persisted confirmation tokens
are never replayed.
The only terminal failed review retry allowed today is
`retryable_review_failure_before_mutation`, which requires strict proof that
review failed before durable review mutation: durable worker evidence exists,
no review message or ACK exists, no terminal task decision exists, downstream
has not started, no review mutation action or partial message result exists,
and only stale diagnostic read history remains after evidence.

## Backend-Backed Capabilities

These Workspace Agent/Broker capabilities are backend-backed now:

- `queue.items.list`
- `queue.lifecycle.get`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.lifecycle.agentFinished`
- `queue.review.getEvidenceBundle`
- `queue.item.markDone`
- `queue.item.fail`

These capabilities must read/write through backend aggregate, review, or worker
evidence APIs. They must not read frontend lifecycle controllers, Queue board
snapshots, selected task detail, evidence overlays, or UI view models as product
truth.

`queue.item.markDone` is the backend/domain accepted-completion command. It
requires explicit `workspaceId`, `taskId`, trusted actor id, and the exact
structured confirmation token declared by the Queue capability contract. It
persists an accepted-completion decision in backend storage and updates the
authoritative aggregate so `ticketState=done`, `reviewState=done`,
`workerRunState=completed`, `evidenceState=available`, `validationState`
unchanged, `commitState` unchanged, `nextSuggestedCapability=null`, and
`durableFlags.completionState=true`. Worker completion and review ACK alone
remain not done.

`queue.item.fail` is the backend/domain terminal failure command. It requires
explicit `workspaceId`, `taskId`, non-empty reason, trusted actor id, and the
exact structured confirmation token declared by the Queue capability contract.
Optional `runId`, `evidenceBundleId`, and `reviewMessageId`/`messageId` are
validation guards only. It persists a failure decision in backend storage and
updates the authoritative aggregate so `ticketState=failure`,
`reviewState=failed`, actual worker run state remains visible,
`evidenceState=available` when durable evidence exists, validation and commit
state remain unchanged, `nextSuggestedCapability=null`, and
`durableFlags.failureState=true`. Worker failure evidence and review ACK alone
remain not terminal failure.

Queue dependency eligibility is also backend/domain aggregate truth.
Downstream dependencies are satisfied only by an upstream durable accepted
completion decision from `queue.item.markDone`. Worker completion, durable
worker evidence, review message creation, review ACK, latest-run completion,
raw `task.status=completed`, and frontend overlay state do not unblock
dependents. Downstream `failed_upstream` derives from an upstream durable
failure decision from `queue.item.fail`, not worker failure evidence or review
ACK alone. Aggregate dependency states `waiting`, `blocked`,
`failed_upstream`, and `unknown` expose blockers and must not suggest
`queue.item.startRun` or runnable `queue.item.promoteDraft`. After upstream
`markDone`, downstream aggregate reads clear that dependency blocker and expose
the downstream task's own next action; no dependent starts automatically.

Typed Workspace Agent Queue create capabilities expose dependencies as
`dependsOn: string[]` over explicit upstream task ids. The broker passes those
ids through the typed Queue API to Tauri/backend storage; backend/domain remains
authoritative for missing dependency, workspace mismatch, self, duplicate, and
cycle validation where each shape is testable. Frontend adapters may reject
only shallow shape errors such as non-array or non-string dependency fields.
They must not infer dependencies from title, prompt, item order, prose, UI
selection, or prompt-pack-local ids.

Durable dependency block propagation remains limited until a backend block
command exists. Failed-upstream propagation is now backed by the durable
failure decision ledger.

Their Workspace Agent capability contracts must state exact required ids,
optional fields, trusted runtime/backend actor defaults, enum values, and
registered `nextSuggestedCapability` ids. The model must not invent task ids,
run ids, message ids, evidence ids, actor ids, capability ids, or enum values
from prose or UI state.
Broker/capability adapters translate backend aggregate/review/evidence/
completion results into typed action results. When a Queue result can safely
name a follow-up capability and all required target inputs are known, it must
emit a validated `nextAction` payload using canonical target schema field
names. `nextSuggestedCapability` remains compatibility context only and is not
sufficient for machine execution. If both fields are present, they must agree.
If the payload cannot be schema-valid, the adapter must report missing or
unavailable next-action input instead of inferring ids from prose, title, UI
selection, file paths, or display text.

Broker action statuses are typed and module-neutral. Queue adapters are the
reference mapping for the taxonomy: `invalid_input` carries invalid payload or
field-path details, `needs_confirmation` means exact structured confirmation
is missing, `policy_blocked` means broker/runtime policy denied the action,
`blocked` means no safe typed follow-up exists, `blocked_actionable` means a
safe validated `nextAction` exists, `already_exists` / `already_done` /
`already_failed` are idempotent domain states, `precondition_failed` is a
backend/domain precondition without automatic execution, `unavailable` is API
or capability absence, `paused` is resumable waiting, and
`failed_unexpected` is an unexpected runtime/system error. Logic must use
typed `reasonCode` values such as `review_message_already_exists`,
`queue_disabled`, `dependency_waiting`, `invalid_payload`,
`capability_unavailable`, and `unexpected_error`, not prose reason parsing.

Broker auto-continuation must use registered Queue capability contract metadata
and risk classes, not a second static allowlist. Finalizing, terminal failure,
block, follow-up, validation-decision, and run-start actions remain blocked or
confirmation-gated unless a future structured bounded grant and backend
preconditions explicitly allow the exact transition.

`queue.review.ack` input is `messageId`, not `reviewMessageId`. Duplicate
review creation blockers with `blockerCode=review_message_already_exists` map
backend `existingMessageId` to `nextAction.input.messageId` for
`queue.review.ack`. Unsafe or finalizing actions, including
`queue.item.markDone` and `queue.item.fail`, remain explicit and
confirmation-gated.

Queue enabled/disabled control state is backend-owned. The durable
per-workspace state is `agent_queue_control_states.status` with MVP values:

- `disabled`: explicit typed worker start must block.
- `manual_enabled`: explicit typed worker start may proceed later when every
  other backend precondition passes.

`manual_enabled` is not an autonomous/scheduler/Autorun arm state. Setting it
must not start workers, mutate tasks, create run links, record evidence,
execute validation, run Git, launch Terminal, or pick up unrelated Queue
items. Workspace Agent and workflow control-plane paths must read this typed
backend state through Tauri/API wrappers instead of treating frontend
`globalExecutionState` or Queue UI/controller state as product truth. Browser
or non-desktop controller state may remain transitional display/compatibility
state only.

Worker start idempotency is backend/domain truth. The assigned Queue task start
path accepts an optional typed workflow start context with explicit
`workflowRunId`, `workflowActionId` or `actionIdempotencyKey`, optional `slot`, `taskId`,
optional `executorWidgetId`, `settingsHash`, optional `executionTargetHash`, optional
expected Queue-control version, optional trusted actor id, and exact
structured confirmation. Backend-owned Queue-local workflow starts require
`executionTargetHash`/`settingsHash` and may omit both
`queueOwnerWidgetInstanceId` and compatibility `executorWidgetId`; a supplied
`queueOwnerWidgetInstanceId` is optional Agent Queue widget attribution and no
`agent-run` widget is required for that target kind. No field may be derived
from prose, task title, UI order, file path, selected detail state, or
natural-language confirmation.

When workflow context is supplied, backend start writes/reads a
`start_worker` row in `agent_queue_workflow_actions`. The same
idempotency key and same target refs returns the existing run id/current state
without launching a second worker. The same key with changed task, executor
owner, execution target hash, workflow, action, or settings refs is a conflict.
New `start_worker` target refs include `slot`, `taskId`, `settingsHash`,
`executionTargetHash`, `executionTargetKind`, and `providerId`; optional
`queueOwnerWidgetInstanceId` appears only when supplied, and
`executorWidgetId` appears only for legacy `agent_executor` starts. Result refs
include the durable `runId`. Existing completed start rows that predate `slot`
can recover only when `targetRefs.taskId` maps to exactly one persisted slot
binding. Queue-local recovery must not require an Agent Executor widget, Agent
Queue widget, queue owner widget id, or legacy executor widget id.
A prior incomplete action or
ambiguous run-link/runtime state is persisted as a blocker such as
`start_state_unknown` or `orphaned_start`; the backend must not silently retry
or create a second run.

Before a new run link is accepted, backend start checks durable Queue control
state, task readiness, dependency readiness, executor binding, and settings
hash. `disabled` blocks as `blocked_control_disabled`; `manual_enabled` is only
a precondition for the exact explicit start and does not dispatch, schedule,
record evidence, finish lifecycle, or start downstream tasks.

## Transitional Capabilities

These capabilities are still transitional:

| Capability | Current Owner | Correct Owner | Next Block |
| --- | --- | --- | --- |
| `queue.coordinator.approveValidation` | Frontend dogfood lifecycle overlay | Backend Queue validation/coordinator decision service | Add durable validation decision command and aggregate coverage. |
| `queue.coordinator.addFollowUpPrompt` | Frontend dogfood lifecycle overlay | Backend Queue coordinator/follow-up service | Add durable follow-up command and aggregate readback. |
| `queue.item.block` | Frontend dogfood lifecycle overlay | Backend Queue coordinator decision service | Add durable block command and dependency blocker propagation. |

## Test Rules

- Backend/domain tests prove Queue aggregate, review, worker evidence,
  accepted completion, dependency gates, and lifecycle preconditions
  headlessly.
- Tauri/API tests prove DTO serialization, typed command behavior, explicit
  task/run identity, and no hidden execution.
- Tauri/backend headless smoke tests prove full
  `dependency_acceptance_smoke` and `dependency_failure_smoke` lifecycles
  through `cargo test -p hobit-desktop queue_workflow_headless_smoke` using a
  test-only Queue-local launcher and the Direct Work completion bridge. They
  must not call real Codex, shell, Git, Terminal, validation, rollback, Queue
  UI, Agent Queue widgets, Agent Executor widgets, or synthetic `widget_runs`.
  Manual Workspace Agent smoke is exploratory/product validation only after
  automated smoke passes, and stale workflow ids are not proof.
- Broker/adapter tests prove backend-backed capabilities use the backend port,
  do not import Queue UI modules, do not use frontend overlays as truth, and
  return only registered `nextSuggestedCapability` ids.
- Broker/adapter tests prove emitted `nextAction` payloads are schema-valid,
  use canonical input field names, include required ids, reject unsupported
  fields/enums, and agree with `nextSuggestedCapability` when both are present.
- Broker/adapter tests prove Queue capability manifest examples use exact
  schema fields/enums/confirmation tokens, reject missing required ids, and do
  not infer ids or confirmation from natural language.
- Module Control Surface tests prove Queue backend-backed and transitional
  capability lists match the active contracts, do not overlap, and do not
  import Queue UI files.
- Workspace Agent protocol tests prove actions come only from
  `hobit.action.request`, request ids remain unique, task/run ids are explicit,
  and natural-language regex routing is absent.

## Non-Goals

This contract does not add validation execution, Git mutation, rollback
execution, hidden Terminal launch, backend scheduler redesign, Queue UI
migration, or new capabilities.
