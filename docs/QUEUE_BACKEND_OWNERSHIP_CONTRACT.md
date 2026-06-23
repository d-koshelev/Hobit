# Queue Backend Ownership Contract

## Purpose

This contract defines the Queue responsibility boundary for backend/domain,
storage, Tauri/API, Workspace Agent broker adapters, frontend API wrappers, and
UI.

Workflow orchestration, action risk classes, typed `nextAction`, structured
confirmation, and bounded grant rules are defined in
`docs/QUEUE_WORKFLOW_ORCHESTRATION_CONTRACT.md`.

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
idempotent action-summary state for supported create/setup/start,
worker-evidence, read/review/finalization runner phases.
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

The Queue workflow runtime adapter may call materialization, run-settings
setup, promotion, control-state read, and assigned-task worker start only
through typed backend/Tauri APIs for the create/setup/start phase. These calls
do not expose new Workspace Agent broker capabilities, do not route natural
language, and do not use UI state as Queue truth. The phase must stop after
persisting/reusing the upstream worker run id and reporting
`awaiting_worker_completion` / `worker_running`; downstream start remains
separate work.

Workflow-owned worker evidence recording is a separate narrow backend/domain
path. It requires explicit `workspaceId`, `workflowRunId`, `slot`, `taskId`,
`runId`, bounded worker final status/outcome/summary input, and an exact
workflow action idempotency key. The default key is
`workflowRunId:record_worker_evidence:slot:taskId:runId`. The backend must
validate that the task/run match the persisted slot binding, that the run
belongs to the task and workspace, and that the worker is durably complete
enough to record evidence. Existing matching evidence is idempotent success;
existing mismatched evidence, changed action refs, missing bindings, missing
worker completion, or ambiguous worker state must block or conflict. On
success the backend persists `evidenceBundleId`, evidence action refs,
recorded timestamp, and bounded worker final status into workflow state and
the action ledger. This path must not create/ACK reviews, mark done, fail,
block, follow up, validate, mutate Git, roll back, launch Terminal, start
workers, start downstream work, create/update/promote tasks, enable Queue, or
infer ids from prose/UI/session state.

The typed Queue workflow runtime adapter can now complete both
`dependency_acceptance_smoke` and `dependency_failure_smoke` end to end by
using only backend-owned workflow, aggregate, review, worker-evidence, and
finalization APIs. It resumes from an explicit `metadata.workflowRunId`, calls
the read-only resume planner before each continuation phase,
records/reconciles upstream evidence, creates and ACKs a durable review message
from explicit durable ids, then finalizes only the upstream task with a fresh
exact structured confirmation. Acceptance marks the upstream done and verifies
the explicit downstream task's dependency-ready/no-auto-start state. Failure
requires typed `failureReason`, fails the upstream task, and verifies the
explicit downstream task's `failed_upstream`/no-auto-start state. The workflow
report may persist bounded task/run/evidence/message/decision refs, sanitized
failure reason, and action counts, but must not persist raw transcripts,
reusable confirmation tokens, validation output, Git output, Terminal output,
rollback output, or downstream worker starts.

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
`workflowRunId`, `workflowActionId` or `actionIdempotencyKey`, `taskId`,
`executorWidgetId`, `settingsHash`, optional expected Queue-control version,
optional trusted actor id, and exact structured confirmation. No field may be
derived from prose, task title, UI order, file path, selected detail state, or
natural-language confirmation.

When workflow context is supplied, backend start writes/reads a
`start_worker` row in `agent_queue_workflow_actions`. The same
idempotency key and same target refs returns the existing run id/current state
without launching a second worker. The same key with changed task, executor,
workflow, action, or settings refs is a conflict. A prior incomplete action or
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
