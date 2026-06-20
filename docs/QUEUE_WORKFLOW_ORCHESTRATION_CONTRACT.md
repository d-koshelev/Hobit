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

## Auto-Continuation Rules

Without a structured Queue autonomy grant, an action may auto-continue only
when all of these are true:

- The previous result status is `succeeded`.
- The target capability is registered.
- The target capability contract says `autoContinuationSafe=true`.
- The risk class is allowed by default policy.
- The result contains a schema-valid `nextAction`.
- `nextAction.input` uses canonical target fields.
- `nextAction.requiresConfirmation=false`.
- No `confirmationRequired` object is present.
- Broker policy allows the target capability.
- The action is not repeated by request id or capability/input fingerprint.
- No hidden side-effect flags indicate shell, Codex, Git, validation,
  rollback, Terminal, or unsafe worker behavior.

`nextSuggestedCapability` alone is never executable.

Default safe risk classes are `read`, `setup`, and the narrow review action
needed for ACK-to-read continuation. Finalizing and unsafe transitions are not
auto-continuation safe by default.

With a valid structured `hobit.queue.autonomyGrant`, Workspace Agent may
continue through schema-valid typed Queue `nextAction` payloads when all policy
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

Transitional risk classes `block`, `follow_up`, and `validation_decision`
remain blocked for bounded autonomy. If a grant is absent or invalid, default
policy applies. Invalid grant JSON is rejected with a visible reason; prose-only
grant text is ignored as no grant.

## `nextAction` Construction And Validation

`nextAction` is the machine continuation contract:

```json
{
  "capabilityId": "queue.review.ack",
  "input": {"taskId":"task-id","messageId":"message-id"},
  "requiresConfirmation": false,
  "autoContinuationSafe": true
}
```

The producer may emit `nextAction` only when all required target input is
known. It must validate the payload against the target capability contract
before returning it.

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
- If required target input is missing, return a typed
  `nextActionUnavailableReason` or blocker instead of asking the model to
  infer ids.

## Result Status Taxonomy

Use result statuses deliberately:

- `succeeded`: command completed and returned authoritative result state.
- `invalid_input`: schema, missing field, enum, id, or confirmation shape is
  invalid before command execution.
- `needs_confirmation`: exact structured confirmation is required.
- `dry_run_required`: policy requires preview before mutation.
- `policy_blocked`: Broker policy forbids the action.
- `unavailable`: required API/runtime is unavailable.
- `blocked_actionable`: backend/domain precondition blocks the current action
  but reports a safe typed next action or explicit blocker.
- `failed`: command attempted and failed unexpectedly or reached a terminal
  error state that is not an actionable precondition.

`blocked_actionable` must not be collapsed into generic `failed`. It tells the
agent/operator what safe explicit action or missing input is required next.

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

Product action execution requires structured `hobit.action.request` plus
Broker policy and backend preconditions.

## Non-Goals

This contract does not implement:

- backend scheduler redesign;
- hidden Queue Autorun;
- validation execution;
- Git commit/push/revert/reset;
- rollback execution;
- Terminal launch;
- broad worker automation;
- UI redesign;
- additional Queue widget/view surfaces.
