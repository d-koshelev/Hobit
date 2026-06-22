# Queue Workflow Orchestration Contract

## Purpose

This contract defines how Workspace Agent, Broker capabilities, backend Queue
aggregate state, and typed next actions must orchestrate Queue dogfooding
workflows.

It does not add scheduler runtime, validation execution, Git mutation,
rollback execution, Terminal launch, hidden worker dispatch, Queue UI
migration, or new storage schema by itself.

## Queue Workflow Phases

The Queue workflow is phase based:

1. `intake`: task exists as draft or queued work.
2. `setup`: run settings, assignment, dependencies, and Queue enablement are
   made explicit.
3. `run_start`: one explicit Queue-linked worker run is started.
4. `worker_evidence`: worker completion/failure/not-completed output is
   recorded as durable evidence.
5. `review`: review message is created and ACKed.
6. `decision`: coordinator/operator chooses final accept, terminal fail,
   block, validation decision, or follow-up.
7. `closed`: durable accepted completion or terminal failure exists.

Every phase transition must be represented by a typed command/result. Prose is
not a phase transition.

## Backend Aggregate States

The authoritative backend aggregate exposes these dimensions:

- `ticketState`: draft, queued, blocked, running, awaiting_review, in_review,
  done, failure, or unknown.
- `workerRunState`: not_started, starting, running, completed,
  not_completed, failed, cancelled, unavailable, or unknown.
- `reviewState`: none, awaiting_review, review_message_created, in_review,
  done, failed, not_durable, or unknown.
- `evidenceState`: none, pending, available, not_durable, or unknown.
- `validationState`: not_requested, requested, running, passed, failed,
  approved_placeholder, not_durable, or unknown.
- `commitState`: none, not_durable, or unknown until durable commit decisions
  exist.
- `dependencyState`: none, ready, waiting, blocked, failed_upstream, or
  unknown.

Raw task status, UI lane, frontend overlay label, latest run status, worker
completion, review message creation, and review ACK are inputs to aggregate
state. They are not accepted completion by themselves.

WorkerProvider is the provider-neutral worker boundary for future explicit
work-item execution. It is separate from AgentProvider: AgentProvider produces
structured Workspace Agent turns, while WorkerProvider starts explicit worker
requests and emits normalized worker evidence/result events. Queue workflow
runners may consume WorkerProvider later, but this contract does not wire a
runner to WorkerProvider, does not auto-start workers, and does not change
current Queue-linked Direct Work behavior.

## Legal Transition Categories

- `read_state`: read aggregate/evidence state only.
- `setup_change`: create task, set run settings, promote draft, enable Queue.
- `start_worker`: start one explicit worker run.
- `record_worker_evidence`: persist durable worker evidence for explicit
  task/run ids.
- `create_review`: create durable review message.
- `ack_review`: ACK durable review message.
- `final_accept`: persist accepted-completion decision.
- `terminal_fail`: persist terminal-failure decision.
- `block_task`: persist or prepare a block decision.
- `follow_up`: persist or prepare a follow-up attempt.
- `validation_decision`: persist or prepare validation decision.
- `forbidden`: unsupported, unsafe, or out-of-contract action.

Backend preconditions remain authoritative even when the Broker has a valid
typed request.

## Action Risk Classes

Queue capability risk classes are:

- `read`: aggregate/evidence/self-test read, no mutation.
- `setup`: task/setup mutation that must not start work.
- `run_start`: starts exactly one explicit Queue-linked run.
- `worker_evidence`: records worker evidence, but does not decide acceptance.
- `review`: creates or ACKs review messages.
- `final_accept`: records durable accepted completion.
- `terminal_fail`: records durable terminal failure.
- `block`: records or prepares a block decision.
- `follow_up`: records or prepares follow-up work.
- `validation_decision`: records or prepares validation approval/rejection.
- `forbidden`: not executable.

Risk class is capability metadata. It must not be inferred from capability id
prefixes, prose, UI labels, or natural-language descriptions.
The Queue `ModuleControlSurface` adapts this capability metadata from the
Queue capability contract inventory for generic module tooling. That adapter
preserves backing status, risk class, confirmation metadata, required id
fields, and trusted actor context only; it does not execute capabilities,
authorize workflows, or change continuation policy. Queue workflow metadata now
declares `dependency_acceptance_smoke`, `dependency_failure_smoke`,
`review_acceptance`, and `terminal_failure` as `validation_only`. The metadata
records display summary, supported phases, required Queue capabilities,
required risk classes, required grant modes, required input-section summaries,
safety constraints, pause reasons, planned resume support, backend ownership
notes, transitional limitations, and implementation status. This metadata does
not execute workflows. Queue workflow request validation now exists for
`dependency_acceptance_smoke` and `dependency_failure_smoke`; it validates
typed `inputs.runSettings`, `inputs.tasks`, task slots, dependency slot
references, grant modes, and safety constraints before returning a
validation result that is eligible only for supported QueueWorkflowRunner
adapter phases. `review_acceptance` and `terminal_failure` are declared with
input validation deferred.

The generic workflow request envelope now exists as
`hobit.workflow.request`. It is module-neutral and contains `requestId`,
`moduleId`, `workflowId`, optional generic permission/scope `grant`, optional
object `inputs`, and optional compact `metadata`. Workspace Agent
protocol classification through `AgentProtocolRuntime` can validate this
envelope against
`ModuleControlSurfaceRegistry`, including reporting that Queue workflows are
declared but not executable. Unknown Queue workflow ids still return
not-declared/unknown workflow status. Generic validation enforces that
`grant` authorizes only permission/scope and `inputs` is the only workflow data
location. Product data such as runSettings, tasks, prompts, dependencies,
run-configuration fields, and direct task/run/message/evidence/executor ids is
rejected inside `grant` with field paths and stable reason codes. Scope ids
belong only under explicit arrays such as `grant.scope.taskIds`; prose is
never executable workflow input or confirmation. This is not
`hobit.queue.workflowRequest`; it validates the dependency smoke Queue input
shape before the Workspace Agent controller may invoke the narrow
QueueWorkflowRunner runtime adapter for supported Queue phases.

## Queue Workflow Request Validation MVP

For `dependency_acceptance_smoke` and `dependency_failure_smoke`, workflow data
lives only under `inputs`. `inputs.runSettings` requires non-empty
`codexExecutable` and `workspaceRoot`, exact `sandbox` values `read_only`,
`workspace_write`, or `danger_full_access`, and exact `approvalPolicy` values
`never`, `on_request`, or `untrusted`. `inputs.tasks` is a non-empty array of
task templates with non-empty `slot`, `title`, and `prompt`; `dependsOnSlots`
is optional but must reference existing slots when present. Slot names must be
unique, `upstream` and `downstream` slots are required, and
`downstream.dependsOnSlots` must explicitly include `upstream`.
Self-dependencies, unknown slot references, and simple cycles are rejected.
Dependencies are never inferred from title, order, prompt, prose, UI, or file
paths.

`dependency_failure_smoke` additionally requires non-empty
`inputs.failureReason`. The failure reason is validation input only; no failure
capability is called. `review_acceptance` and `terminal_failure` are declared
but return `input_validation_deferred` after grant validation until their typed
input contract and runner boundary are narrowed.

## Queue Workflow Runner MVP

`apps/desktop/frontend/src/workbench/agents/modules/queueWorkflowRunner.ts`
defines the deterministic Queue-specific workflow runner skeleton. It is a
pure/control-plane helper, not UI, not generic `AgentRuntime`, and not backend
truth.

The runner accepts a Queue workflow request plus its existing Queue workflow
validation result. For `dependency_acceptance_smoke` and
`dependency_failure_smoke`, it can read existing Queue state only when explicit
ids are supplied. Supported explicit id sources are structured workflow data
such as `inputs.taskIdsBySlot`, `inputs.runIdsBySlot`,
`inputs.evidenceBundleIdsBySlot`, `inputs.messageIdsBySlot`,
`inputs.evidenceReads`, and explicit `grant.scope.*Ids` arrays. Scope arrays
bound/read explicit ids but do not assign dependency slots by order. The runner
does not infer task ids, run ids, evidence bundle ids, message ids, or
executor widget ids from titles, prompts, prose, UI selection, UI order, file
paths, or repository roots.

The read-only phase uses only an injected `QueueWorkflowReadPort` with read
methods for Queue aggregate, lifecycle, list, and evidence inspection. The
review phase uses that read port plus a separate injected
`QueueWorkflowReviewPort` for review message create and ACK commands. The
finalization phase uses the read port plus a separate injected
`QueueWorkflowFinalizationPort` for explicit accepted completion or terminal
failure commands. Tests use fake ports. The runner does not import Queue UI,
visual shell modules, Tauri APIs, AgentProvider, WorkerProvider, Action Broker
invocation, or Queue adapter mutation handlers.

Read-only runner results are structured as `completed`, `blocked`, `paused`,
`invalid_request`, `unavailable`, or `failed_unexpected` with workflow-local
variables, read snapshots, steps, events, blockers, missing explicit ids, and a
read-only report. If dependency smoke requests do not include existing task ids
for the required `upstream` and `downstream` slots, the runner pauses with
`read_only_runner_requires_existing_tasks` / `missing_explicit_task_ids`.
The read-only runner still treats `review_acceptance` and `terminal_failure` as
`input_validation_deferred` and does not inspect or execute them.

The same module now also exposes an explicit Queue review runner phase through
an injected `QueueWorkflowReviewPort`. The review runner is provider-
independent and UI-independent. It can read lifecycle/aggregate state, read a
durable evidence bundle, create a backend review message, and ACK that review
message when all required typed ids are present. For dependency smoke
workflows, review targets only the explicit `upstream` slot and requires an
explicit upstream `taskId` plus explicit `runId` or `evidenceBundleId`.
`review_acceptance` is supported only through a minimal explicit typed input
shape such as `inputs.taskId` plus `inputs.runId` or
`inputs.evidenceBundleId`; its generic Workspace Agent request validation
remains deferred. Scope arrays bound ids but never assign slots by order.

Review runner statuses include `review_acknowledged`,
`review_blocked_missing_evidence`, `review_blocked_missing_task_or_run`,
`review_message_already_exists`, `review_not_supported_for_workflow`, and
`failed_unexpected`. Duplicate review creation with an existing `messageId`
is idempotent and can continue to ACK. ACK `already_done` or `already_exists`
is also idempotent. ACK uses canonical `messageId`; compatibility
`reviewMessageId` is not a runner input.

The same module now also exposes an explicit Queue finalization runner phase
through an injected `QueueWorkflowFinalizationPort`. For
`dependency_acceptance_smoke`, finalization targets only the explicit
`upstream` slot and calls `markDone` only when an explicit upstream task id,
exact structured `confirmationToken`, and review ACK/precondition proof are
present. For `dependency_failure_smoke`, finalization targets only the
explicit `upstream` slot and calls `failItem` only when those preconditions and
a non-empty structured `failureReason` are present. `already_done` is
idempotent acceptance success, and `already_failed` is idempotent failure
success. Other backend statuses stop as typed blockers or unexpected failures.
If an explicit downstream task id is present, the runner reads downstream
aggregate/lifecycle state after finalization and reports dependency-state and
no-auto-start verification. If downstream id is absent, upstream finalization
can still complete but downstream verification is reported missing. The runner
never infers downstream ids from titles, order, prose, UI, or file paths, and
never starts downstream work.

The review runner may mutate only the backend review message/ACK ledger
through the injected review port. ACK is not completion. The finalization
runner may mutate only explicit upstream accepted-completion or terminal-
failure state through the injected finalization port. The runner does not
create tasks, update run settings, promote drafts, enable Queue, start workers,
record worker evidence, block, add follow-up prompts, approve validation, run
validation, mutate Git, execute rollback, launch Terminal, call shell/Codex,
start downstream work, or add scheduler behavior. Broader mutating workflow
phases remain future explicit blocks.

## Queue Workflow Persistence MVP

Queue workflow run persistence is backend-owned. The storage/API foundation
now persists `agent_queue_workflow_runs` and `agent_queue_workflow_actions` as
workflow orchestration ledgers separate from Queue task/run/review/evidence/
completion/failure ledgers. `QueueWorkflowRun.status=failed` means workflow
execution failure and must not be interpreted as Queue task terminal failure.

The public backend/Tauri/frontend workflow API surface is limited to
start/get/list/cancel/report/planResume plus the narrow runner-report record
API consumed by the Queue workflow runtime adapter:

- `queue.workflow.start` creates or reuses a workflow-run record only. It is
  idempotent for the same `workspaceId + requestId` when the stable request
  hash matches. A different typed snapshot for the same workspace/request id is
  a typed conflict and must block runner invocation.
- `queue.workflow.get`, `queue.workflow.list`, and
  `queue.workflow.getReport` read backend-owned persisted workflow records and
  action ledger rows scoped to the requested workspace.
- `queue.workflow.cancel` is non-destructive. It marks non-terminal workflow
  runs cancelled and does not roll back, stop workers, mutate Queue tasks,
  mutate evidence/review/finalization ledgers, or start/stop any runtime.
- `queue.workflow.planResume` is a read-only backend-owned resume planner. It
  loads a persisted workflow run, reads its action ledger, parses only
  persisted typed snapshots, reconciles explicit slot bindings/variables
  against durable Queue facts, and returns a typed plan or blocker. It can
  report terminal workflow-run states, expected-version conflicts, unsupported
  phases, missing or mismatched task/run/evidence/review/finalization facts,
  next deterministic phase/step, and whether a fresh grant or exact structured
  confirmation is required. It must not execute workflow steps, call
  `QueueWorkflowRunner`, create/update/promote/enable tasks, start workers,
  record worker evidence, create/ACK review messages, mark done, fail, block,
  follow up, validate, mutate Git, roll back, launch Terminal, start
  downstream work, or infer ids from frontend/session/prose.
- `queue.workflow.recordRunnerReport` records bounded runtime-adapter report
  state and action-ledger summaries for already-supported read/review/
  finalization runner phases. It may update only
  `agent_queue_workflow_runs` and `agent_queue_workflow_actions`; it must not
  mutate Queue tasks, run links, worker evidence, review messages,
  completion/failure decisions, Queue control state, validation, Git,
  rollback, Terminal, scheduler, or downstream worker state.
- A separate public `queue.workflow.resume` execution command is not
  implemented. Continuation from an explicit typed `metadata.workflowRunId`
  uses `queue.workflow.planResume` first, then the frontend runtime adapter may
  invoke only the already-supported safe runner phase when the plan is ready
  and fresh typed grant/confirmation input is present when required.

Persisted workflow snapshots contain only validated typed workflow inputs and
safe bounded grant summaries. They must not contain raw prompts outside bounded
validated input fields, raw provider transcripts, terminal output, Git output,
secrets, or reusable confirmation tokens. A grant summary may persist safe
fields such as actor, mode, risk classes, constraints, scope, issued/expiry
time, restart policy, max actions, and consumed action count; reusable
`confirmationToken` values are rejected/redacted before persistence.

The action ledger records backend-internal step/action idempotency metadata.
It is not exposed as a public append-event command. The QueueWorkflowRunner
runtime adapter now creates or reuses durable workflow runs before supported
runner invocation, persists bounded report/action summaries after the runner
returns, and includes the workflow run id/status in Workspace Agent
activity/transcript output. Workflow persistence commands remain typed backend
APIs consumed by the adapter; they are not Workspace Agent broker
capabilities. Resume planning may read durable Queue aggregate, run-link,
evidence, review, completion, and failure facts, but the planner itself is
still read-only and never executes steps.

Resume planner statuses are typed and stable: `resume_ready`,
`resume_read_only_ready`, `blocked_missing_task`,
`blocked_state_mismatch`, `blocked_missing_review_ack`,
`blocked_missing_evidence`, `blocked_missing_confirmation`,
`blocked_stale_grant`, `terminal_completed`, `terminal_failed`,
`terminal_cancelled`, `unsupported_phase`, `failed_unexpected`, and
`version_conflict`. `terminal_failed` means the workflow run itself is failed;
it is not a Queue task failure. Mutating or finalizing next steps after
restart require a fresh grant and fresh exact structured confirmation unless a
future restart policy explicitly narrows a safe exception. Persisted
confirmation tokens must never be replayed.

Provider turns now pass through the provider-neutral `AgentRuntime` event loop,
which owns AgentProvider run lifecycle and delegates final-output
classification to `AgentProtocolRuntime`. The current controller still owns
broker invocation, visible state, continuation turn application, and activity
application after classification; this contract does not move broker
execution into the runtime or protocol runtime. Runtime adapter helpers now
own provider-turn input construction, provider-event compatibility mapping, and
protocol fallback resolution so the controller remains a React adapter instead
of a provider lifecycle implementation. Pure continuation-chain
orchestration lives in `BrokerContinuationRuntime`, which emits typed
intents/effects for broker action invocation, same-thread continuation,
protocol repair, stop, and completion. It delegates Queue bounded-autonomy
decisions to the existing explicitly Queue-specific continuation helpers; that
Queue policy remains transitional for action continuation. Valid structured
Queue `hobit.workflow.request` envelopes can invoke the QueueWorkflowRunner
runtime adapter for supported persisted read/review/finalization phases only.
BrokerInvocationRuntime remains future work.
Workspace Agent activity/log/transcript formatting is isolated in the pure
`AgentActivityRecorder`. It consumes only events and results that provider,
protocol, broker, and continuation code have already decided, then returns
append intents for the React controller to apply. It does not authorize Queue
actions, follow `nextAction`, execute workflows, infer ids from prose, or
change Queue policy.

## Auto-Continuation Rules

Without a structured Queue autonomy grant, an action may auto-continue only
when all of these are true:

- The previous result status is `succeeded`, or an actionable/idempotent
  status (`blocked_actionable`, `already_exists`, `already_done`, or
  `precondition_failed`) with a schema-valid typed `nextAction`.
- The target capability is registered.
- The target capability contract says `autoContinuationSafe=true`.
- The risk class is allowed by default policy.
- The result contains a schema-valid generic typed `nextAction`.
- `nextAction.input` uses canonical target fields.
- `nextAction.requiresConfirmation=false`.
- No `confirmationRequired` object is present.
- Broker policy allows the target capability.
- The action is not repeated by request id or capability/input fingerprint.
- No hidden side-effect flags indicate shell, Codex, Git, validation,
  rollback, Terminal, or unsafe worker behavior.

`nextSuggestedCapability` alone is never executable; it is human/UI
compatibility context only.

Default safe risk classes are `read` and the narrow review action needed for
ACK-to-read continuation. Setup mutations such as
`queue.item.updateRunSettings`, `queue.item.promoteDraft`, and `queue.enable`
require a valid structured Queue autonomy grant for same-thread
auto-continuation. Finalizing and unsafe transitions are not
auto-continuation safe by default.

With a valid structured `hobit.queue.autonomyGrant`, Workspace Agent may
continue through schema-valid generic typed `nextAction` payloads when all policy
conditions pass:

- `nextAction.capabilityId` is registered.
- `nextAction.input` validates against that capability contract.
- `nextAction.capabilityId` agrees with `nextSuggestedCapability` when both
  are present.
- the capability risk class is allowed by the grant mode;
- the capability is not denied and, when `allowedCapabilities` is supplied, is
  also in that intersection;
- the action budget remains;
- backend/result blockers such as dependency waiting do not forbid the
  follow-up;
- no request id or capability/input fingerprint loop is detected;
- grant constraints still forbid Git, validation execution, rollback,
  Terminal, delete, downstream auto-start, shell, raw Codex, and hidden worker
  behavior;
- required confirmation is exact and structured.

When continuation stops, the product-facing policy diagnostic must identify
the target `capabilityId`, module id when known, risk class, whether a grant
is active, grant mode when present, allowed risk classes, a stable reason code
and product-facing message, whether `nextAction` was present, whether its payload validated,
whether confirmation was missing or injected, and whether
`deniedCapabilities` blocked it. Expected reason codes include
`no_grant_for_risk_class`, `grant_not_parsed`, `risk_class_not_allowed`,
`capability_denied_by_grant`, `next_action_payload_invalid`,
`confirmation_required`, `dependency_waiting`, `ambiguous_next_action`,
`out_of_scope_task`, and `max_actions_exceeded`.

## Structured Confirmation

Structured confirmation is required for:

- `queue.item.startRun`
- `queue.importPromptPack`
- `queue.item.markDone`
- `queue.item.fail`
- any future destructive, external, or finalizing Queue action

The current confirmation token is a top-level action-request field:

```json
{"confirmationToken":"operator-confirmed"}
```

It must not be placed inside `input`. Prose such as "I confirm" is not
confirmation and must not be converted into confirmation.

A structured Queue autonomy grant may supply the exact top-level token for a
validated pending `nextAction` only when the grant contains
`confirmationToken: "operator-confirmed"`, the mode permits that risk class,
the capability requires that exact token, and all required ids are already in
the typed payload. Injection is limited to registered Queue run-start,
accepted-completion, and terminal-failure next actions. It is never available
for unknown, transitional, Git, validation, rollback, Terminal, delete, shell,
raw Codex, or arbitrary execution capabilities.

## Operator Grant Policy

The implemented Queue autonomy grant is:

- a structured JSON object with `type: "hobit.queue.autonomyGrant"`;
- may be embedded in prompt prose or a fenced JSON block, but only the JSON
  object is parsed;
- never inferred from prose;
- bounded by risk class, capability set, task scope, workspace, action budget,
  and current session;
- explicit about whether it may start runs or finalize accepted completion or
  terminal failure;
- unable to bypass backend preconditions;
- unable to synthesize ids or unsupported confirmation;
- unable to permit hidden Git, validation, rollback, Terminal, shell, Codex,
  or scheduler behavior.

Grant modes are `none`, `read_only`, `queue_smoke`,
`queue_acceptance_smoke`, `queue_failure_smoke`, and
`queue_operator_flow`. `read_only` allows only reads. `queue_smoke` allows
read, setup, run start, worker evidence, and review, but no markDone/fail.
`queue_acceptance_smoke` additionally allows `final_accept`.
`queue_failure_smoke` additionally allows `terminal_fail`.
`queue_operator_flow` allows the same Queue workflow risk classes, but still
does not enable Git, validation, rollback, Terminal, delete, shell, raw Codex,
downstream auto-start, or hidden worker behavior.

Queue workflow requests use the generic `grant` shape but require
Queue-specific grant modes. `dependency_acceptance_smoke` accepts
`queue_acceptance_smoke` or `queue_operator_flow`; `dependency_failure_smoke`
accepts `queue_failure_smoke` or `queue_operator_flow`; `review_acceptance`
accepts `queue_acceptance_smoke`, `queue_failure_smoke`, or
`queue_operator_flow`; `terminal_failure` accepts `queue_failure_smoke` or
`queue_operator_flow`. For dependency smoke validation, `grant.constraints`
must set `noGit`, `noValidationExecution`, `noRollback`, `noTerminal`,
`noDelete`, and `noDownstreamAutoStart` to exactly `true`.

Transitional risk classes `block`, `follow_up`, and `validation_decision`
remain blocked for bounded autonomy. If a grant is absent or invalid, default
policy applies. Invalid grant JSON is rejected with a visible reason; prose-only
grant text is ignored as no grant.

## `nextAction` Construction And Validation

`nextAction` is the generic machine continuation contract. Queue is the first
reference module using this module-neutral envelope:

```json
{
  "moduleId": "queue",
  "capabilityId": "queue.review.ack",
  "input": {"taskId":"task-id","messageId":"message-id"},
  "requiresConfirmation": false,
  "autoContinuationSafe": true
}
```

The producer may emit `nextAction` only when all required target input is
known. It must validate the payload against the registered capability schema,
ModuleControlSurface capability metadata where applicable, and target module
contract before returning it. Future workflow runners must consume this same
typed `nextAction` contract instead of parsing prose or using Queue-specific
shortcut fields.

`nextSuggestedCapability` is a human-readable/UI compatibility suggestion and
must not be treated as executable. If a typed action cannot be produced, the
result should expose `nextActionUnavailable` with a stable reason code/message
and compact metadata such as `missingRequiredInputs`,
`ambiguousCandidateIds`, or `invalidPayloadReason`.

Rules:

- Use canonical field names.
- Use `messageId` for review ACK and typed review next actions.
- Use `approvalPolicy`, not `approval_policy`.
- Use `dependsOn`, not `dependencies` or `depends_on`.
- Use `taskId`, `runId`, `evidenceBundleId`, and `executorWidgetId` exactly.
- Do not include unsupported fields.
- Do not include finalizing confirmation inside `input`.
- If `nextAction` and `nextSuggestedCapability` both exist, their capability
  ids must agree.
- If required target input is missing, return structured
  `nextActionUnavailable` metadata or a blocker instead of asking the model to
  infer ids.
- If multiple Queue items could be the target, do not choose from titles,
  prompts, UI selection, order, or prose. Return `ambiguous_next_action` with
  candidate task ids, or require a typed `nextAction` / `queue.items.list`
  scoped to one exact `taskId`. A structured grant `scope.taskIds` may bound
  policy for typed next actions, but it does not permit id inference.

## Result Status Taxonomy

Use result statuses deliberately:

- `succeeded`: command completed and returned authoritative result state.
- `invalid_input`: schema, missing field, enum, id, or confirmation shape is
  invalid before command execution.
- `needs_confirmation`: exact structured confirmation is required.
- `policy_blocked`: Broker policy forbids the action.
- `unavailable`: required API/runtime is unavailable.
- `paused`: operation or workflow is paused and may resume later.
- `blocked`: backend/domain precondition blocks the current action and no safe
  typed `nextAction` exists.
- `blocked_actionable`: backend/domain precondition blocks the current action
  but reports a safe typed `nextAction`.
- `already_exists`: idempotent domain state where the requested object/action
  already exists.
- `already_done`: idempotent domain state where the requested action is
  already durably done.
- `already_failed`: idempotent domain state where the requested action is
  already terminal failed.
- `precondition_failed`: backend/domain precondition failed; it may be
  actionable only when the result also carries a valid typed `nextAction`.
- `failed_unexpected`: unexpected runtime/system failure.

`dry_run_required` and `failed` may remain as compatibility statuses, but new
Queue mappings should prefer the taxonomy above.

Idempotent and actionable states must not be collapsed into generic failure.
Future workflow runners depend on the typed status plus stable `reasonCode`,
not prose reason strings. Queue is the reference mapping: duplicate review
create maps to `already_exists` with typed ACK `nextAction.input.messageId`
when safe, finalizer idempotency maps to `already_done` / `already_failed`,
domain blockers map to `precondition_failed` or `blocked_actionable`, missing
confirmation maps to `needs_confirmation`, and thrown runtime errors map to
`failed_unexpected`.

## Dependency Satisfaction

Dependencies are satisfied only by durable accepted completion from
`queue.item.markDone`.

These do not satisfy dependencies:

- worker completion;
- latest run completion;
- raw task status `completed`;
- durable worker evidence;
- review message creation;
- review ACK;
- validation approval placeholder;
- frontend lifecycle overlay state;
- UI lane or board state.

Downstream `failed_upstream` comes only from durable terminal failure through
`queue.item.fail`. No downstream task starts automatically after dependency
unblocking or upstream failure.

## UI Cannot Be Truth

UI renders authoritative DTOs and owns display state only. UI selection, board
lanes, overlay evidence maps, details panels, and local controller state must
not be read by backend-backed capabilities as Queue product truth.

Transitional UI/controller overlays are allowed only for capabilities still
classified as transitional. They must be labeled as such and have a backend
replacement path.

## Prose Cannot Be Permission

Natural language can request work, ask questions, or provide human-readable
context. It cannot:

- select a capability;
- confirm an action;
- grant autonomy;
- provide trusted ids;
- unblock dependencies;
- mark work done or failed;
- authorize Git, validation, rollback, Terminal, shell, Codex, or worker start.
- provide workflow inputs, workflow ids, grants, confirmations, or task/run/
  message/evidence/executor ids for workflow execution.

Product action execution requires structured `hobit.action.request` plus
Broker policy and backend preconditions.
Workflow requests require structured `hobit.workflow.request` and are currently
validated/classified before execution. The QueueWorkflowRunner runtime adapter
can invoke explicit read, review, and finalization phases through typed ports
for supported `moduleId: "queue"` workflow requests only. Unsupported,
invalid, or still-deferred workflows do not invoke the runner.

## Non-Goals

This contract does not implement:

- backend scheduler redesign;
- hidden Queue Autorun;
- provider-driven Queue workflow execution through WorkerProvider;
- validation execution;
- Git commit/push/revert/reset;
- rollback execution;
- Terminal launch;
- broad worker automation;
- Queue workflow mutation/execution beyond explicit read/review/finalization
  runner phases;
- Queue-specific input validation for review/terminal workflows;
- UI redesign;
- additional Queue widget/view surfaces.
