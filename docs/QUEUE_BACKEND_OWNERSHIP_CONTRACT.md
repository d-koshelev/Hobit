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
  evidence bundles, and review message/ACK ledgers.
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

Queue enabled/disabled control state is currently exposed to broker adapters
through the typed Workspace Queue bridge from controller execution state. This
is transitional frontend/controller ownership, not Queue UI truth. Broker
adapters may use that typed bridge read to choose between `queue.enable` and
`queue.item.startRun`, while `queue.item.startRun` must still reject disabled
Queue state and must not auto-enable Queue.

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
