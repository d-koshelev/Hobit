# Hobit Agent Capability Runtime

## Purpose

Define the target runtime contract for in-app Hobit agents. This is a
frontend architecture foundation and contract. It does not implement backend
runtime, storage schema, Tauri/IPC commands, scheduler behavior, workers,
Terminal launch, Git mutation, Finder changes, or full Workspace Agent
behavior beyond the current frontend structured action-request boundary.

## Agent Role

An in-app agent is a Hobit product operator/orchestrator first. It receives the
raw user prompt, Hobit app context, current Workspace/surface/widget context,
role instructions, a capability manifest, policy constraints, and self-test
capabilities.

Code execution, shell commands, and Codex Direct Work are restricted
capabilities. They are not the default path for product actions such as Queue
item creation, prompt-pack import, Notes changes, Knowledge actions, widget
state changes, or app navigation.

Regex routing must not be used as the Workspace Agent product-action
architecture. Product actions must flow through raw prompt plus Hobit app
context, capability manifest, policy constraints, Action Broker validation,
internal app API invocation, and structured result/activity output. Queue item
creation is a Queue capability, not a phrase route. Codex and shell remain
restricted capabilities for explicit workspace/code execution requests only.

## Runtime Components

- App Context: structured Hobit, Workspace, surface, widget, role, prompt, and
  policy context supplied to the agent.
- Capability Registry: typed manifest of app capabilities available to the
  agent in the current context.
- Action Broker: typed invocation boundary that validates action requests,
  capability availability, policy, confirmation, dry-run requirements, and
  side-effect constraints before any handler can run.
- Policy Layer: central enforcement for role, availability, permission,
  confirmation, dry-run, scope, and side-effect constraints.
- Preview/Dry-run: safe capability mode for planning, import preview, and
  self-tests before mutation.
- Confirmation Model: capability metadata declares whether confirmation is
  none, recommended, or required.
- Audit/Activity Events: every action produces structured events, including
  unavailable and policy-blocked attempts.
- Structured Results: all action outcomes return typed module-neutral statuses
  such as `succeeded`, `invalid_input`, `needs_confirmation`,
  `policy_blocked`, `blocked`, `blocked_actionable`, `already_exists`,
  `already_done`, `already_failed`, `precondition_failed`, `unavailable`,
  `paused`, and `failed_unexpected`, plus stable `reasonCode` where practical.
- SelfTest Runtime: safe test harness that checks capability availability and
  policy without hidden mutation.
- Multi-Agent Runtime: frontend-only agent instance, status, bounded history,
  typed message, and model self-test foundation documented in
  `docs/HOBIT_MULTI_AGENT_RUNTIME.md`. It does not execute broker actions or
  call shell/Codex for agent-to-agent communication.
- AgentProvider Runtime: provider-neutral frontend execution seam for
  Workspace Agent turns. The seam exposes provider identity/capabilities,
  start/continue-by-thread inputs, cancellation support when available, and
  normalized run events such as run started, message/text output, structured
  action/workflow output, final answer, error, run finished, and cancellation.
  Codex Direct Work is the current default AgentProvider implementation, not
  the Workspace Agent architecture. Fake AgentProviders are allowed for
  deterministic protocol/action/workflow tests.
- AgentRuntime: provider-neutral frontend turn lifecycle layer around
  AgentProvider. It starts provider turns, owns provider run handle metadata,
  exposes cancellation through the provider seam, preserves provider events,
  and emits normalized lifecycle/protocol events for final answers, structured
  `hobit.action.request`, structured `hobit.workflow.request`, invalid
  protocol output, provider errors, run finish, cancellation, and stopped
  states. It may classify final provider output by delegating to
  AgentProtocolRuntime. It does not invoke the Action Broker, execute
  workflows, start workers, call backend/Tauri APIs, mutate UI state, or touch
  Queue UI.
- AgentProtocolRuntime: provider-neutral, pure frontend protocol
  classification for Workspace Agent model output. It distinguishes final
  answers, structured `hobit.action.request` envelopes, structured
  `hobit.workflow.request` envelopes, invalid action/workflow envelopes, mixed
  action/workflow envelopes, protocol stalls, and no-output cases. It reuses
  the existing envelope parsers and final-answer marker logic; it does not
  invoke the Action Broker, execute workflows, infer permissions or ids from
  prose, call providers, or touch Queue UI.
- AgentActivityRecorder: pure frontend formatting and intent generation for
  Workspace Agent provider/protocol/broker/continuation output. It turns
  already-decided runtime events into transcript append intents, activity
  append intents, notice intents, and log append intents. It does not call
  providers, invoke the broker, choose continuation policy, execute workflows,
  mutate UI state, or touch Queue UI.
- BrokerContinuationRuntime: pure frontend continuation-chain orchestration for
  Workspace Agent broker action mode. It consumes protocol and broker results,
  updates continuation state, and emits typed intents/effects such as broker
  action invocation, same-thread continuation, protocol repair, stop, and
  complete. It delegates the current Queue-specific bounded-autonomy policy to
  the explicit Queue continuation helpers and does not call providers, invoke
  the broker, call backend/Tauri APIs, execute workflows, format activity, or
  touch Queue UI.
- WorkerProvider Runtime: provider-neutral frontend execution seam for
  explicit work items. It is separate from AgentProvider: AgentProvider
  generates structured Workspace Agent turns, while WorkerProvider starts an
  explicit worker request and emits normalized worker run, output/log,
  evidence, completion, failure, cancellation, stopped, and provider-error
  events. Codex Direct Work is the current concrete/default worker
  implementation through a CodexWorkerProvider adapter, not the worker
  architecture. Fake WorkerProviders are allowed for deterministic evidence
  and terminal-state tests. Future Queue workflow phases may consume
  WorkerProvider later, but this seam does not add worker starts, scheduler
  behavior, validation execution, Git mutation, rollback, Terminal launch, or
  hidden worker starts.
- Agent-to-Agent SelfTest: pure model peer checks where Agent A can test Agent
  B and Agent B can test Agent A through status, history, capability manifest,
  and typed message APIs. This is the foundation for future agent-executed
  smoke through peer and widget self-tests, not a UI, broker execution path,
  Queue adapter, Codex run, shell command, or app-control action.
- Agent API Smoke Runner: first pure frontend agent-executed smoke layer over
  implemented agent runtime APIs only: `agent.status.read`,
  `agent.history.read`, `agent.message.send`, `agent.capabilities.read`, and
  `agent.selfTest.run`. It produces a structured product-facing report and
  hidden-side-effect assertions without Queue mutation, Codex/shell use,
  Terminal launch, Git mutation, rollback execution, worker start, widget/view
  creation, backend calls, or real app API execution.
- Agent-executed Smoke Report Foundation: shared pure frontend aggregation
  under `selfTest/` that combines Agent API smoke, peer self-test evidence,
  active Widget Agent Contract checks, brokered Queue `queue.selfTest`
  dry-run evidence through the injected Queue adapter, the fake Queue dogfood
  broker loop, backend worker evidence bundle readback, and hidden-side-effect
  assertions. Queue rows cover singleton targeting, createItems preview,
  prompt-pack preview, no real Queue mutation, no worker start, and no Queue
  view creation. Queue dogfood broker rows cover agent finished with an
  explicit worker evidence bundle/run id, durable evidence readback, review
  message evidence summary, ACK,
  validation approval, backend-required mark done, accepted-completion-gated
  dependent unblock, follow-up prompt return to running, failure
  dependent blocking, and honest backend/worker/validation/Git not-covered
  rows. It is the foundation for replacing parts of manual smoke with
  structured agent-executed smoke reports. It does not add natural-language
  routing, real Terminal command execution, Git mutation, rollback execution,
  worker dispatch, Queue view creation, or new Knowledge / Skills, Notes, or
  Terminal adapters.
- Agent Self-Test Runner UI MVP: implemented as a visible secondary Workspace
  Agent action, `Run Agent Self-Test`. It uses the aggregate
  agent-executed smoke report foundation over the safe agent API smoke runner,
  peer self-test, Workspace Agent capability-context checks, capability
  manifest checks, active Widget Agent Contract checks, Queue
  `queue.selfTest` dry-run checks through the Action Broker, the fake Queue
  dogfood broker-loop self-test, and restricted Codex/shell capability
  assertions. It renders a structured report instead of raw JSON.
- Workspace Agent Capability Context Injection: the active Workspace Agent
  provider prompt path now attaches Hobit app context, Workspace
  Agent role instructions, a compact capability manifest, and policy rules
  before provider execution. Codex remains the default current implementation
  through the Codex AgentProvider adapter. When the agent returns a valid
  `hobit.action.request` envelope, the frontend parses that structured machine
  request, invokes the Action Broker, and renders a compact product-facing
  result. The compact manifest includes field-level schema and examples for
  Queue create action requests and Queue dogfood lifecycle action requests
  without dumping the raw registry. Non-action chat outside typed-capability
  action mode remains ordinary prose.
- Workspace Agent Broker Action Continuation MVP: after an eligible successful
  broker action, the frontend appends a compact structured
  `hobit.action.result` context back to the same Codex thread and lets the
  model emit the next single `hobit.action.request` envelope or explicit
  `hobit.final.answer` marker.
  The loop is frontend-only, capped at 16 actions, grouped in transcript and
  activity, and can use a structured Queue bounded autonomy grant:
  `{"type":"hobit.queue.autonomyGrant","mode":"queue_acceptance_smoke",...}`.
  The grant is machine-readable JSON only and may be embedded in ordinary
  prompt text or a fenced JSON block, but only the JSON object is parsed; prose
  such as "go" or "I confirm" is not a grant. The parsed grant is stored in
  the action-chain state and remains available across same-thread continuation
  turns until the chain ends. Inside a valid grant, the continuation policy may
  follow a schema-valid generic typed `nextAction` through the grant's
  Queue risk-class mode, capability allow/deny intersection, optional task/run
  scope, exact confirmation token, and action budget. Required-confirmation Queue actions
  may receive only the canonical top-level
  `confirmationToken: "operator-confirmed"` from the grant, and only for
  registered run-start/finalizer Queue next actions whose ids are already
  present in the typed payload. Without a structured grant, setup mutations
  such as `queue.item.updateRunSettings` do not auto-continue. The loop may
  continue from `blocked_actionable`, `already_exists`, `already_done`, or
  `precondition_failed` only when the result includes a schema-valid typed
  `nextAction` allowed by policy. It stops on `invalid_input`,
  `needs_confirmation`, `policy_blocked`, `unavailable`, `paused`, `blocked`,
  `already_failed`, `failed_unexpected`, dry-run-required compatibility,
  repeated request, repeated capability/input, unsupported envelope,
  restricted capability, ambiguous next action, confirmation-required without
  an exact grant token, max action budget, or missing same-thread continuation
  state. Policy stop diagnostics identify the target
  `capabilityId`, module id when known, risk class, grant active/mode state,
  allowed risk classes, reason code/message, nextAction presence and payload validation state,
  confirmation missing/injected state, denied-capability state, and candidate
  task ids when ambiguity blocked continuation. It does not accept action
  lists, regex-route user prompts, infer task ids, or add unrelated backend
  durability, validation execution, Git mutation, rollback, Terminal, shell,
  raw Codex automation, deletion, downstream auto-start, or UI truth. Missing
  or blank request ids are derived per continuation action from the chain id,
  action index, and capability id; explicit duplicate request ids still stop
  as the replay guard.

### Broker Result Status Taxonomy

The broker status taxonomy is typed and module-neutral. Logic must branch on
`status`, structured `reasonCode`, field paths, and validated `nextAction`, not
prose reason text. `reasonCode` examples include
`review_message_already_exists`, `evidence_bundle_missing`, `task_not_ready`,
`queue_disabled`, `dependency_waiting`, `confirmation_required`,
`invalid_payload`, `capability_unavailable`, `policy_denied`, and
`unexpected_error`.

Idempotent states are not generic failures. `already_exists`, `already_done`,
and `already_failed` report stable domain state; actionable blockers use
`blocked_actionable` only when a safe typed `nextAction` exists. Domain
preconditions without a safe follow-up use `precondition_failed` or `blocked`.
Unexpected thrown/runtime errors use `failed_unexpected`.

Queue is the reference mapping for this taxonomy. Duplicate review create
preserves typed ACK follow-up as `nextAction.input.messageId`; review/finalizer
idempotency keeps `already_*`; missing confirmation returns
`needs_confirmation`; malformed payloads return `invalid_input` with field
paths; dependency waiting does not start downstream work.

Queue worker start idempotency is a backend-owned typed contract, not a new
natural-language route. The Queue create/setup/start workflow phase starts
only the explicit upstream worker by calling typed backend/Tauri APIs with
explicit workflow/action/task/executor/settings refs and exact structured
confirmation, then pauses before evidence recording. Broker and Workspace Agent
logic must not infer `taskId`, `runId`, `workflowRunId`,
`actionIdempotencyKey`, `settingsHash`, or `executorWidgetId` from prose,
title, UI order, file path, or selected detail state. The current
QueueWorkflowRunner exposes this only through validated typed dependency-smoke
workflow requests and does not expose materialization/setup/promote/start as
broker capabilities.

Queue workflow worker evidence recording is also backend-owned typed workflow
behavior, not a natural-language route and not a new broker capability. It can
resume only from explicit `metadata.workflowRunId` plus typed worker-evidence
input for the `upstream` slot, exact `taskId`, exact `runId`, bounded worker
outcome/summary data, and a workflow action idempotency key. The backend
validates the persisted slot/run binding, records or reconciles durable
worker evidence by `workflowRunId + slot + taskId + runId`, persists
`evidenceBundleId` in the workflow state/action ledger, and stops at
`awaiting_review`. It does not create review messages, ACK reviews, finalize,
start downstream work, run validation, mutate Git, roll back, launch Terminal,
start workers, or infer ids from prose/UI/session state.

The typed Queue workflow runtime adapter can now complete both
`dependency_acceptance_smoke` and `dependency_failure_smoke` end to end across
durable continuation requests. After the create/setup/start pause, each
continuation with explicit `metadata.workflowRunId` calls the backend resume
planner first, records typed upstream worker evidence when supplied, creates
and ACKs the durable review message only from explicit evidence/message refs,
and finalizes only the upstream task with fresh exact structured confirmation.
Acceptance calls `queue.item.markDone` and verifies explicit downstream
dependency-ready/no-auto-start state. Failure requires typed `failureReason`,
calls `queue.item.fail`, and verifies explicit downstream
`failed_upstream`/no-auto-start state. The path does not infer task/run/
evidence/message/workflow ids or permission from prose, does not persist
reusable confirmation tokens, does not run validation/Git/rollback/Terminal
behavior, does not schedule work, and does not start downstream tasks.
Workflow restart recovery remains backend-owned: frontend runner variables are
lightweight report state and cannot overwrite backend-rich workflow slot
bindings. Resume planning may use completed workflow action target/result refs
as secondary typed evidence, but incomplete action refs, orphan start windows,
or missing slot identity block with typed recovery statuses instead of
restarting workers or using UI/session/prose state.
- Workspace Agent Action Protocol Enforcement MVP: Workspace Agent Direct Work
  turns that receive Hobit capability context are treated as typed-capability
  action mode. In that mode the model must emit exactly one
  `hobit.action.request` envelope for a broker action, or exactly one
  explicit final-answer marker such as
  `{"type":"hobit.final.answer","message":"..."}` when the user-facing answer
  is complete or blocked. If the turn emits malformed action JSON, the run
  stops as an invalid action request. If the turn emits empty or intermediate
  non-envelope prose, including prose like awaiting a capability result, the
  controller sends one compact same-thread repair prompt. If repair still does
  not produce a valid action request or explicit final answer, the chain stops
  with a visible protocol error and reports that no broker action was executed.
  `AgentProtocolRuntime` owns this classification boundary;
  `AgentRuntime` owns provider-neutral provider turn lifecycle and emits the
  classified protocol result; `BrokerContinuationRuntime` owns continuation
  decisions/intents. `useWorkspaceAgentDirectWorkController` now also delegates
  provider-turn input construction, provider-event compatibility mapping, and
  protocol fallback resolution to small UI-independent runtime adapter helpers.
  The current React controller still owns visible UI state arrays, broker
  invocation, continuation turn application, and transcript/activity
  application. BrokerInvocationRuntime remains a future cleanup block if the
  broker invocation/application boundary needs another split.
  `AgentActivityRecorder` owns formatting and append-intent generation only,
  preserving the current visible labels, summaries, protocol repair copy,
  workflow recognition copy, and broker-result transcript text.
  This enforcement does not infer capability ids from prose, does not parse
  awaiting text into `queue.items.list`, and does not add natural-language
  routing.

- Structured Workflow Request Envelope MVP: Workspace Agent now recognizes a
  module-neutral `hobit.workflow.request` JSON envelope with `requestId`,
  `moduleId`, `workflowId`, optional generic permission/scope `grant`,
  optional opaque object `inputs`, and optional compact `metadata`. The
  generic envelope path classifies and validates before any runner phase can
  run. It verifies `moduleId` through `ModuleControlSurfaceRegistry` and
  reports whether `workflowId` is unknown, declared but not executable, or
  runtime-available by that module. `metadata.workflowRunId` is the only typed
  workflow-continuation id field; it is never inferred from prose. For
  `moduleId: "queue"`, the Workspace Agent controller can now pass validated
  supported Queue workflow requests to the QueueWorkflowRunner runtime adapter.
  Declared workflow validation can expose compact workflow metadata such as
  backing status, required capabilities, required risk classes, required grant
  modes, input-section summary, safety constraints, pause/resume notes, and
  backend ownership notes without executing the workflow. Generic validation now enforces the
  grant/input split: `grant` is permission and scope metadata only, while
  `inputs` is the only workflow data location. Product data such as
  runSettings, tasks, prompts, dependencies, run configuration, and direct ids
  are rejected inside `grant`; ids may appear only under explicit
  `grant.scope.*Ids` arrays. Confirmation tokens in `grant` are permission
  metadata only and are never inferred from prose. It rejects malformed JSON,
  arrays, unknown workflow envelope types, multiple workflow envelopes, mixed
  action/workflow envelopes, malformed grants, malformed inputs, invalid scope
  fields, and product input in grants. Validation itself does not execute
  workflows, call broker capabilities, run Queue adapters, infer workflow
  inputs from prose, or treat prose permission as a grant. Queue-specific validation now exists for
  declared Queue dependency smoke workflows: `inputs.runSettings`,
  `inputs.tasks`, task `slot` values, `dependsOnSlots`, grant modes, and
  required safety constraints are validated before any mutating runner phase.
  The request can validate as `workflow_valid_not_executable`, which means the
  metadata remains non-runtime-available even though supported Queue runner
  phases can be invoked through the narrow adapter. A Queue-specific
  `QueueWorkflowRunner` now exists as an explicit control-plane helper with
  separate create/setup/start, worker-evidence, read-only, review, and
  finalization phases. The
  create/setup/start phase materializes explicit upstream/downstream slots,
  applies upstream run settings, promotes upstream, verifies backend
  `manual_enabled`, starts only the explicit upstream worker with typed
  workflow start context, persists bounded action/report summaries, and pauses
  at `awaiting_worker_completion` / `worker_running` before evidence. The
  worker-evidence phase can then record or reconcile durable upstream evidence
  from typed completion input and stop at `awaiting_review`. The
  read-only phase inspects existing Queue state through injected read ports.
  The review phase can read lifecycle/aggregate/evidence state, create a
  backend review message, and ACK that review message through an injected
  review port when explicit typed task/run/evidence/message ids are available.
  ACK is review state, not completion. Already-existing review messages and
  already-done ACKs are idempotent, actionable states rather than generic
  failures. The finalization phase can call injected typed finalization ports
  for `queue.item.markDone` on `dependency_acceptance_smoke` and
  `queue.item.fail` on `dependency_failure_smoke` only after explicit upstream
  task id, exact structured `confirmationToken`, explicit failure reason for
  failure, and review ACK/precondition evidence are present. It verifies
  downstream dependency/no-auto-start state only when an explicit downstream
  task id is available and never starts downstream work. Outside the scoped
  create/setup/start task materialization/settings/promote/upstream-start
  phase, worker-evidence record/reconcile phase, review message/ACK phase, and
  explicit upstream finalization ports, the runner does not call
  `queue.lifecycle.agentFinished`, record evidence, block, follow up, run
  validation, mutate Git, launch Terminal, roll back, or mutate Queue state. It
  requires explicit typed task/run/evidence/message/workflow/executor/settings
  ids and never infers ids from titles, prose, UI order, or file paths.
  For `dependency_acceptance_smoke` and `dependency_failure_smoke`, the runtime
  adapter now sequences those typed phases through durable workflow persistence
  until the workflow run is completed: upstream evidence, review create/ACK,
  upstream accepted completion or typed terminal failure, downstream
  ready/`failed_upstream` no-auto-start verification, and bounded final report
  persistence.
  `review_acceptance` remains supported only by a minimal explicit typed runner
  input shape, while generic request validation for `review_acceptance` and
  `terminal_failure` remains `input_validation_deferred`.

## Module Control Surface

`ModuleControlSurface` is the generic agent-facing module contract for Hobit
modules. It lives under
`apps/desktop/frontend/src/workbench/agents/modules/` and describes module id,
display name, version, backend/API ownership, typed capability ids, workflow
ids, capability backing status, risk classes, confirmation requirements, actor
context policy, UI dependency policy, compatibility notes, and contract-test
requirements.

`ModuleControlSurfaceRegistry` is the discovery layer for agent-facing modules.
It can list and retrieve registered module surfaces and validate compact
metadata consistency. Queue is the first registered module. Registry metadata
is not runtime behavior, does not execute workflows, and must remain
UI-independent. Knowledge, Notes, Terminal, and other modules will register
later only after safe module surface metadata exists.

UI widgets are not executable module APIs. Widgets may render module DTOs and
collect explicit operator input, but agents must use typed module capability
metadata plus the Action Broker and module API ports for product actions.

Capabilities are atomic typed operations. Workflows are multi-step typed
processes and are validated through the generic `hobit.workflow.request`
envelope before any executable runner phase can run. Queue is the first reference module surface. Its backend-
backed capabilities are labeled separately from transitional controller-backed
capabilities. Transitional capabilities must remain labeled and migrate later.
Queue capability module metadata is adapted from the existing Queue capability
contract inventory into the generic `ModuleControlSurface` shape. The adapter
preserves exact capability ids, backing status, risk class, confirmation
tokens, required id fields, and trusted actor context fields. It is
metadata-only and does not change broker execution, backend lifecycle
semantics, Queue UI behavior, or continuation policy. Queue workflow metadata
now declares the initial Queue workflows
`dependency_acceptance_smoke`, `dependency_failure_smoke`,
`review_acceptance`, and `terminal_failure` as `validation_only`. Generic
`hobit.workflow.request` validation can recognize those workflow ids. Queue
dependency acceptance/failure smoke requests now validate typed
`inputs.runSettings`, typed task slots, explicit dependency slot references,
grant modes, and safety constraints for setup phases. Phase-tagged typed
continuations may omit setup inputs and rely on persisted workflow bindings;
`dependency_failure_smoke` still requires a typed non-empty `failureReason` at
the finalization runner boundary before `queue.item.fail`. The validation
result is non-executable and eligible only for supported QueueWorkflowRunner
adapter phases. `review_acceptance` and `terminal_failure` remain declared
with deferred input validation in the generic request path.
`QueueWorkflowRunner` can consume validated Queue workflow requests for
explicit read inspection through a `QueueWorkflowReadPort`; its explicit review
phase can consume a `QueueWorkflowReviewPort` to perform evidence lookup,
review message create, and review ACK; and its explicit finalization phase can
consume a `QueueWorkflowFinalizationPort` to mark the explicit upstream done or
failed for the dependency smoke workflows only. Workspace Agent workflow
requests now invoke it only for supported Queue phases through typed backend
ports. Create/setup/start can create/reuse dependency-smoke task slots, apply
settings, promote upstream, start the explicit upstream worker, and pause
awaiting worker completion. The separate worker-evidence phase can resume from
typed completion input, record/reconcile durable upstream evidence through the
backend workflow evidence command, persist `evidenceBundleId`, and stop before
review. There is still no validation execution, Git mutation, rollback,
Terminal launch, scheduler behavior, backend lifecycle semantic change beyond
this phase, Queue UI truth path, or downstream auto-start.

Queue workflow persistence now exists as a backend-owned storage/API
foundation for workflow-run and action-ledger records. The typed
start/get/list/cancel/report/planResume API stores bounded validated input
snapshots, safe grant summaries, phase/step/status, slot/variable/idempotency
metadata, and internal action ledger rows. `queue.workflow.start` is
idempotent by `workspaceId + requestId + requestHash`; a different hash for the
same request id is a typed conflict and blocks runner invocation. Reusable
confirmation tokens are not persisted as grants. The Queue workflow runtime
adapter now creates or reuses a durable workflow run before invoking supported
create/setup/start, worker-evidence, read/review/finalization phases, records
bounded runner reports and action
summaries back to the workflow run/action ledgers, and includes workflow run id
and persisted status in Workspace Agent activity/transcript output.
`queue.workflow.planResume` is a read-only backend planner that reconciles
persisted workflow state with durable Queue facts and returns a typed resume
plan or blocker. When `metadata.workflowRunId` is present, the adapter calls
the planner before execution and invokes only currently supported phases when
the plan is ready and fresh typed grant/confirmation input is present when
required. Workspace Agent now exposes safe, bounded, read-only broker
capabilities for workflow debug reads: `queue.workflow.get`,
`queue.workflow.list`, `queue.workflow.getReport`,
`queue.workflow.planResume`, and `queue.workflow.readActionLog`. These
capabilities read the backend/Tauri workflow run, report, resume planner, and
persisted action ledger summaries only. They do not invoke workflows, start
workers, mutate Queue state, create tasks, record evidence, create/ACK reviews,
finalize tasks, launch shell/Git/Terminal/validation/rollback behavior, or
expose raw provider transcripts or raw confirmation tokens. This persistence
surface still does not implement `queue.workflow.invoke` or a generic public
resume executor.
Backend workflow task slot materialization now exists as a workflow-internal
typed domain method: it creates/reuses draft/manual Queue tasks by explicit
`workflowRunId + slot + taskSpecHash`, persists slot bindings, and materializes
dependency edges only from explicit `dependsOnSlots` resolved to bound upstream
task ids. It is not a Workspace Agent broker route or natural-language route;
it is wired only through validated typed QueueWorkflowRunner create/setup/start
execution. It does not itself update run settings, promote tasks, enable
Queue, start workers, record evidence/reviews/finalization, run validation,
mutate Git, roll back, launch Terminal, schedule, or auto-start downstream
work.
Backend workflow run-settings setup and promote now exist as separate
workflow-internal typed domain methods for already materialized slots. They
persist `settingsHash` / `update_run_settings` refs and `promote_task` refs in
workflow slot bindings/action ledgers, are idempotent for exact typed refs, and
block/conflict on mismatched hashes, task ids, executor assignments, or action
refs. They are not Workspace Agent broker routes or natural-language routes;
they are wired only through typed QueueWorkflowRunner create/setup/start
execution and do not themselves start workers or create run links.
Queue control state is now backend-owned and durable per workspace through
typed control APIs. The MVP states are `disabled` and `manual_enabled`;
`manual_enabled` is a manual/no-autodispatch gate for future explicit typed
worker starts and does not start workers, arm Queue Autorun, run a scheduler,
mutate tasks, or create run links.

Codex is a provider/worker implementation for explicit Direct Work paths. It
is not the module integration architecture. WorkerProvider is the normalized
worker boundary for future explicit work-item execution and evidence events;
the current Queue workflow runner create/setup/start phase uses the existing
backend assigned-task start path rather than hidden WorkerProvider calls.

## Generic `nextAction` Contract

`nextAction` is a module-neutral typed follow-up action. It carries a compact
target envelope with `moduleId` when known, `capabilityId`, `input`, optional
risk/confirmation/target-id metadata, and source/reason fields. It is
executable only after validation proves the capability is registered, the
optional module/capability pair is known through `ModuleControlSurface`, and
the input matches the target capability schema and module-specific contract.

`nextSuggestedCapability` is human/UI compatibility context only. It may help
render the next likely step, but it is never executable by itself. Missing,
ambiguous, or invalid follow-ups are represented by `nextActionUnavailable`
with stable reason metadata such as `missingRequiredInputs`,
`ambiguousCandidateIds`, and `invalidPayloadReason`.

Queue is the first reference module for this contract. Queue next actions
validate against the Queue capability contract inventory, including exact
field names, enum values, confirmation requirements, and module metadata.
Future workflow runners must consume the same generic `nextAction` contract
instead of parsing prose or Queue-specific shortcut fields. They must not infer
task ids, run ids, evidence bundle ids, message ids, executor widget ids,
permissions, confirmations, or workflow inputs from titles, prompts, file
paths, UI order, or natural-language text.

## Module Ownership

Frontend agent runtime foundation code lives under
`apps/desktop/frontend/src/workbench/agents/`. New agent infrastructure must
land in the owned module folder that matches its responsibility:

- `context/`: Hobit app, Workspace, surface, role, prompt, policy-context
  models, Workspace Agent context helpers, and instruction block generation.
- `capabilities/`: typed capability metadata, capability ids, capability
  registries, the initial honest manifest, availability helpers, and policy
  helper functions.
- `broker/`: action request/result/audit/broker result contracts, policy
  validation helpers, deterministic test handlers, and the pure frontend
  Action Broker MVP. The broker validates and invokes typed handlers; app
  module behavior belongs in adapters, not the generic broker layer.
- `runtime/`: pure frontend agent instance, status, runtime-state, snapshot,
  and deterministic test-agent models for the Multi-Agent Runtime MVP.
- `messaging/`: pure frontend typed agent message, bounded history, delivery,
  and failure-result models. This folder does not implement a backend message
  bus, broker execution, or app control.
- `selfTest/`: self-test instructions, requests, cases, results, reports, and
  report summary helpers.
- `widgets/`: future Widget Agent Contract models. It does not implement widget
  contracts yet.
- `modules/`: Module Control Surface metadata for agent-facing module
  contracts. This folder describes typed module capabilities and workflows; it
  must not import widget components or React state.
- `adapters/`: typed app-module adapters. The Queue Capability Adapter MVP
  lives here as the first real app-module adapter behind the Action Broker.
  Workspace Agent broker execution is wired for structured Queue action
  requests; additional app adapters remain later.

Workspace Agent UI components must not become the owner of agent runtime
logic. The UI may render context, proposal, and review surfaces, but typed
capability selection, policy contracts, broker request/result shapes, and
self-test models belong in the agent runtime modules above.

Regex routing is not the architecture. Do not implement product behavior as
`user text -> regex classifier -> product action`. Product actions must flow
through raw prompt plus Hobit app context, capability manifest, policy
constraints, Action Broker validation, internal app API invocation, and
structured result/activity output.

## Action Broker MVP

The frontend Action Broker MVP lives under
`apps/desktop/frontend/src/workbench/agents/broker/`. It is a pure model layer
and does not add UI, backend/Tauri/IPC commands, storage/schema changes, Queue
runtime behavior, Terminal launch, Git mutation, rollback execution, scheduler
behavior, worker runtime, or hidden Workspace Agent execution.

The Workspace Agent structured action-request protocol is classified by the
frontend `AgentProtocolRuntime` and then handled by the current direct-run
controller path. Agents may emit a minimal JSON envelope:

```json
{
  "type": "hobit.action.request",
  "capabilityId": "queue.createItems",
  "dryRun": false,
  "input": {
    "items": [
      {
        "title": "Test Queue item",
        "prompt": "Review the current workspace state and report one safe next step.",
        "status": "draft"
      }
    ]
  },
  "reason": "optional",
  "requestId": "optional",
  "confirmationToken": "optional"
}
```

Only this structured envelope is parsed as an app action request. The model
must emit one envelope at a time; action lists are invalid. User prompt text
and ordinary assistant prose are not classified or regex-routed into product
actions. Invalid envelopes produce a product-facing invalid action request
result. Unknown capabilities still go through the broker and return structured
unavailable results.

Queue capability contracts are inventoried in
`apps/desktop/frontend/src/workbench/agents/capabilities/queueCapabilityContracts.ts`
and mirrored by manifest examples/tests. For registered `queue.*`
capabilities, the model must use exact capability ids, required fields, enum
values, and structured confirmation fields from the manifest. It must not
guess task ids, run ids, executor widget ids, evidence bundle ids, message ids,
actor ids, enum spellings, or capability ids from prose or UI selection.
Queue capability results may expose a typed `nextAction` payload when the
producer knows every required target input and the payload validates against
the target capability contract. `nextAction.capabilityId` and
`nextAction.input` are the machine-readable continuation contract and use
canonical schema field names. `nextSuggestedCapability` may remain as compact
human-readable compatibility context, but it is not sufficient for machine
execution. If both are present, they must agree. If a valid payload cannot be
built, the result reports missing or unavailable next-action input instead of
asking the model to infer ids or field names.
`queue.createItem` and `queue.createItems` expose dependencies with the public
field `dependsOn: string[]`; the ids must come from typed Queue results, not
from title, prompt, item order, prose, or prompt-pack-local ids. Dependency
smoke should create the upstream task first, then create the downstream task
with the returned upstream task id.
`queue.item.updateRunSettings` accepts only sandbox values `read_only`,
`workspace_write`, `danger_full_access` and approval policy values `never`,
`on_request`, `untrusted`. Queue confirmation-required capabilities use
top-level `confirmationToken: "operator-confirmed"` after operator
confirmation; prose such as "I confirm" is insufficient and is not inferred.
`queue.item.startRun` also requires explicit `taskId` and `executorWidgetId`
in `input`. It also requires backend Queue control to be `manual_enabled`
already. New live smoke setup uses `queue.control.get` followed by
`queue.control.setManualEnabled` when needed. Older typed `nextAction` payloads
for `queue.enable` remain a compatibility path before `queue.item.startRun`,
but `nextSuggestedCapability` alone is informational and not executable.

Typed-capability action mode now also has an explicit terminal answer marker:

```json
{
  "type": "hobit.final.answer",
  "message": "Visible final answer or blocker."
}
```

This marker is not an app action and cannot trigger a broker capability. It is
only the control-loop boundary that distinguishes a completed user-facing answer
from an intermediate non-action stall. Prose such as "Awaiting
`queue.items.list` result" is not treated as success and is not routed to
`queue.items.list`; it causes one bounded repair prompt or a visible protocol
error.

The Workspace Agent direct-run controller can continue a broker action chain
only from structured broker results. It feeds a bounded `hobit.action.result`
summary into the same Codex thread with queue state, blockers, explicit ids,
validated `nextAction` when available, and safety flags such as no validation
run, no Git mutation, no rollback, no deletion, no shell command, and no
Terminal launch. The next model step may emit exactly one new
`hobit.action.request` or explicit `hobit.final.answer`. The model must prefer
returned `nextAction` exactly, must not rename input fields, and must not guess
from `nextSuggestedCapability` alone. The controller continues a `nextAction`
only when the target capability is registered, the payload validates against
the target contract, `nextAction` agrees with `nextSuggestedCapability` when
both exist, the Queue risk class is allowed by default policy or a structured
`hobit.queue.autonomyGrant`, policy allows the target, backend/result blockers
do not forbid continuation, no fingerprint loop is detected, and required
confirmation is already exact or can be injected from the structured grant.
Auto-continuation policy is derived from capability contract metadata and risk
class, not from natural-language descriptions or a separate static allowlist.
Otherwise it stops with a visible blocker and leaves the typed payload for
operator/model review. The controller stops instead of continuing when a
result requires confirmation without a valid grant token, is
blocked, unavailable, invalid, paused, policy-blocked, failed unexpectedly, is
a dry-run-required compatibility result, repeats a previous request id or
capability/input fingerprint, exceeds the action budget, lacks a usable thread
id, or touches restricted capabilities. `blocked_actionable`,
`already_exists`, `already_done`, and `precondition_failed` require a valid
typed `nextAction` before continuation. The continuation loop does not infer
`taskId`, `runId`, `messageId`, `evidenceBundleId`, or `executorWidgetId` from
prose, titles, file paths, final messages, repository roots, UI state, or
other natural-language content.

Queue backend-backed broker capabilities are `queue.items.list`,
`queue.lifecycle.get`, `queue.review.getEvidenceBundle`,
`queue.review.createMessage`, `queue.review.ack`, and
`queue.lifecycle.agentFinished`, `queue.item.markDone`, and `queue.item.fail`.
`queue.item.markDone`
is the accepted-completion command and requires explicit `taskId`, trusted
actor id from runtime context, and top-level
`confirmationToken: "operator-confirmed"`; prose confirmation is insufficient.
`queue.item.fail` is the terminal-failure command and requires explicit
`taskId`, visible `reason`, trusted actor id from runtime context, durable
worker evidence, an ACKed review message, and the same exact top-level
confirmation token. Worker failure evidence alone is not terminal failure. Both
commands are not auto-continuation safe. Transitional lifecycle capabilities
remain
`queue.coordinator.approveValidation`,
`queue.coordinator.addFollowUpPrompt`, and `queue.item.block`; these are not
auto-continuation safe
and must remain policy-restricted until moved to durable backend ownership.
Among backend-backed writes, only a successful `queue.review.ack` is
auto-continuation safe, and only so the same action chain can read final
backend aggregate state with `queue.lifecycle.get`. ACK does not imply done,
accepted completion, validation approval, commit state, dependency unblock, or
safe finalization.

Agents are expected to produce typed capability action requests with request
id, agent id, agent role, capability id, input, dry-run state, optional
confirmation token, reason, and creation timestamp. The broker validates the
request shape, looks up the capability in the registry, evaluates role access,
availability, restricted execution policy, confirmation requirements, dry-run
requirements, and side-effect constraints, then returns a structured action
result.

Broker results include success, failure, unavailable, policy-blocked,
needs-confirmation, dry-run-required, and invalid-input outcomes. Results carry
a product-facing message, structured output when available, the policy
decision, stable audit/activity events, and hidden-side-effect flags asserting
that safe model handlers did not run shell, Codex, Queue mutation, Terminal,
Git, rollback, or workers.

The generic broker MVP includes deterministic frontend test handlers only for
pure agent model APIs:

- `agent.status.read`
- `agent.capabilities.read`
- `agent.message.send` dry-run

Queue-specific behavior does not live in the generic broker layer. Queue
handlers are supplied by the Queue Capability Adapter through
`createQueueAgentActionHandlers(adapterApi)`.

Workspace Agent live app-context discovery is not routed through
`agent.status.read`. The Workspace Agent broker runtime injects read-only
handlers for `workspace.context.get` and `workbench.widgets.list` from the
live renderer-held Workspace/Workbench state, and `queue.control.get` through
the typed Queue control bridge. These reads do not use UI text, DOM scraping,
localStorage as truth, transcript text, title inference, shell, Git, Terminal,
rollback, validation execution, worker start, or Queue mutation. Codex shell
still cannot run live Queue smoke by itself because it has no live Tauri
renderer/IPC context.

Workspace Agent can also set backend Queue control to `manual_enabled` through
the typed `queue.control.setManualEnabled` broker action. This is a setup
capability, not a read, and it follows the Queue setup grant/policy path. It
mutates only backend Queue control state; it does not start workers, arm or
dispatch a scheduler, create run links, mutate Queue tasks, record evidence,
create/ACK reviews, finalize tasks, invoke workflows, launch shell/Terminal,
run Git/validation/rollback, or start downstream work.

Codex and shell capabilities remain restricted execute capabilities. They are
not default Hobit app-action paths, and the broker MVP blocks restricted
execute invocation unless a future explicit policy/adaptor slice deliberately
opens that path.

## Queue Capability Adapter MVP

The Queue Capability Adapter MVP is the first real app-module adapter for the
Hobit Agent Capability Runtime. It lives under
`apps/desktop/frontend/src/workbench/agents/adapters/` and exposes typed Queue
capability handlers for the Action Broker through dependency injection.
Queue backend ownership is governed by
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`: backend/domain/storage owns Queue
business truth, broker adapters use typed backend/Tauri APIs, and UI state is
never product truth.

Supported Queue capabilities:

- `queue.targetSingletonQueue`
- `queue.createItem`
- `queue.createItems`
- `queue.preparePromptPackPreview`
- `queue.importPromptPack`
- `queue.selfTest`
- `queue.control.get`
- `queue.control.setManualEnabled`
- `queue.items.list`
- `queue.item.updateRunSettings`
- `queue.item.promoteDraft`
- `queue.enable`
- `queue.item.startRun`
- `queue.lifecycle.agentFinished`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.coordinator.approveValidation`
- `queue.coordinator.addFollowUpPrompt`
- `queue.item.markDone`
- `queue.item.block`
- `queue.item.fail`
- `queue.lifecycle.get`
- `queue.review.getEvidenceBundle`

Backend/domain aggregate and review command note: the desktop backend now
exposes `QueueItemAggregate` DTOs over durable Queue task rows, run links,
dependencies, and review message ledger rows. It is the authoritative
read-model contract for Queue state reads. `queue.items.list` and
`queue.lifecycle.get` call typed frontend bridge methods backed by Tauri
aggregate list/get commands and return task state dimensions, blockers,
nextActions, latestRun, evidenceSummary, and durable flags from that DTO.
Dependency blockers from the backend aggregate remain authoritative in broker
results: `waiting`, `blocked`, `failed_upstream`, and `unknown` do not get
converted into `queue.item.startRun`, `queue.enable`, or runnable
`queue.item.promoteDraft` suggestions.
`queue.review.createMessage` and `queue.review.ack` call typed frontend bridge
methods backed by Tauri review command DTOs. `queue.item.markDone` and
`queue.item.fail` call typed frontend bridge methods backed by the Tauri
accepted-completion and terminal-failure command DTOs. These paths do not read
Queue board snapshots, selected task detail,
frontend lifecycle or evidence overlays, UI hooks, or broker-local lifecycle
maps as product truth. The aggregate read, review command, completion command,
and failure command paths do not run workers, validation, Git, rollback,
Terminal, shell, or Codex, and do not infer task ids from natural language.
Backend and Tauri
headless contract tests now prove aggregate list/get,
lifecycle/readiness inspection, run-link state, dependency
waiting/failed-upstream state, review create/ACK preconditions and durability,
accepted-completion preconditions and durability, terminal-failure
preconditions and durability, read-only aggregate behavior, explicit task
identity, and honest `not_durable` / `unknown` states without launching the
frontend. Queue
card/details rendering migration to the aggregate DTO remains a later phase.
The Workspace Agent bridge adapter uses an injected Queue backend API port for
backend-backed Queue capabilities so those paths can be tested without
mounting the Queue UI.

The adapter boundary is typed and injected. It does not import React hooks,
mutate global UI state directly, create widgets/views directly, couple to the
Workspace Agent UI, route natural language, call shell, launch Terminal, mutate
Git, execute rollback, arm Queue Autorun, or create duplicate Queue views.
Only the explicit `queue.item.startRun` capability may request a Queue-linked
Direct Work start through the injected Queue bridge, and that path must return
blocked/unavailable instead of claiming success when the bridge cannot accept a
real start.

Queue create action input is intentionally strict at the adapter boundary.
`queue.createItem` requires `title` and `prompt`. `queue.createItems` requires
a non-empty `items` array, and every item requires `title` and `prompt`. The
`prompt` field is the runnable task instruction, not a display-only
description. Optional adapter fields are `status`, `description`,
`dependsOn`, `source`, `sourceMetadata`, and `id`; unsupported aliases such as
`body`, `text`, `content`, `operatorPrompt`, `initialState`, `dependencies`,
`depends_on`, `queueTag`, and `priority` do not satisfy Queue create input.
`dependsOn` must be a string array of explicit upstream Queue task ids returned
by typed Queue results; it is never inferred from prose, title, prompt text, or
item order.

Workspace Agent capability instructions may tell the model that explicit
test, dummy, or example Queue item requests can use a safe placeholder prompt,
for example "Review the current workspace state and report one safe next
step." If a user asks to create a real Queue item without providing runnable
task content, the agent should ask a concise clarification instead of emitting
an invalid action request. This is model guidance in the capability context,
not app-side natural-language routing.

Dry-run Queue creation returns a structured preview with:

- `wouldCreateItems`
- `wouldTargetSingletonQueue: true`
- `wouldAutoRunWorkers: false`
- `wouldCreateDuplicateQueueView: false`

Invoke Queue creation uses the injected Queue adapter API and targets the
singleton Workspace Queue. It preserves title, prompt, source metadata,
and dependency edges where the adapter supports them. If dependency edges
cannot be represented, the handler returns a structured unavailable
result instead of silently dropping them.

The public Workspace Agent dependency field is `dependsOn: string[]` on
`queue.createItem` and `items[].dependsOn` on `queue.createItems`. It accepts
only explicit upstream Queue task ids returned by typed Queue results. The
adapter performs shallow shape validation and passes accepted ids through the
typed Queue bridge; backend/domain storage remains the source of truth for
missing, workspace-mismatched, duplicate, self, and cyclic dependency
validation where each case is testable. Intra-batch references to tasks being
created in the same `queue.createItems` call are deliberately not a stable
public contract in this block.

Prompt-pack preview uses existing prompt-pack and Smart Queue materialization
models where practical and does not create Queue tasks. Prompt-pack import
creates Queue items only through the injected adapter API after valid input and
policy approval, and it does not auto-run workers after import.

Queue run-control capabilities are typed bridge actions. `queue.item.startRun`
requires explicit `taskId` and `executorWidgetId`, never infers task identity
from prompt text, and returns success only when the injected Queue bridge
accepts a real Queue-linked Direct Work start and returns a run id. Blocked or
unavailable start dependencies return blocked/unavailable capability results
with compact reasons. After an accepted start, the frontend Queue controller
refreshes task state and latest run-link metadata so the selected Queue item,
board lane, and returned run id converge with the backend run state.

Queue self-test through the Action Broker and Queue adapter is implemented as a
safe dry-run/model check. The broker invokes the typed `queue.selfTest`
capability handler supplied by `createQueueAgentActionHandlers(adapterApi)`;
the default handler calls only `getSingletonQueueTarget`, `previewCreateItems`,
and `previewPromptPack`. It verifies singleton targeting, createItems preview,
`wouldTargetSingletonQueue: true`, `wouldAutoRunWorkers: false`,
`wouldCreateDuplicateQueueView: false`, prompt-pack preview materialization,
no Queue mutation, no worker start, no duplicate Queue view, and no hidden
side effects. If real target inspection is unavailable, that specific
sub-check is reported as skipped or blocked with a product-facing reason such
as `Adapter not available`, while safe dry-run/model-level checks still run
against the represented singleton Queue target. Queue self-test does not call
Queue create/import APIs, create Queue tasks, create Queue views, enable or
auto-run Queue workers, call Codex/shell, launch Terminal, mutate Git, execute
rollback, or modify backend/storage/schema.

Queue dogfood lifecycle capabilities are typed broker capabilities. Workspace
Agent or Coordinator Agent can report an agent finish with explicit `taskId`
and `runId`, create and ACK review messages, record validation approval
placeholders, add follow-up prompts, request backend accepted completion, and
request backend terminal failure or block an item through structured
`hobit.action.request` envelopes.
`queue.lifecycle.agentFinished`, `queue.review.getEvidenceBundle`,
`queue.review.createMessage`, `queue.review.ack`, `queue.item.markDone`, and
`queue.item.fail` are backend/domain/Tauri-backed in the Workspace Agent bridge
path. Worker-finished
persists only the durable worker evidence bundle plus task/run-link completion
state required for aggregate readiness. Review create/ACK persist only the
review message ledger. `queue.review.ack` input is `messageId`, not
`reviewMessageId`; when `queue.review.createMessage` reports
`review_message_already_exists`, backend `existingMessageId` maps to
`nextAction.input.messageId` for a typed ACK follow-up. MarkDone persists only
the accepted-completion decision ledger after backend aggregate preconditions pass.
Fail persists only the terminal-failure decision ledger after backend aggregate
preconditions pass; worker failure evidence and review ACK alone do not mark
terminal failure.
The model does not need to invent
`coordinatorAgentId`; the Workspace Agent bridge supplies a trusted actor id
from request context and falls back to `workspace-agent` only when no stronger
context exists. Validation approval, follow-up, and block
remain transitional frontend/controller overlay writes and do not persist
durable validation/commit/decision state. `queue.lifecycle.get` requires
explicit `taskId`, reads the backend aggregate DTO, returns ticket, worker,
review, evidence, validation, commit, and dependency state dimensions plus
blockers, next actions, latest run, evidence summary, durable flags, and
`authoritativeBackendAggregate=true`, and is safe for broker auto-continuation
after success. `queue.review.ack` is backend-backed and continuation-safe after
success only to let the next model step read state, normally through
`queue.lifecycle.get`; it does not auto-finalize or mark the Queue item done.
Only explicit `queue.item.markDone` can finalize done, only explicit
`queue.item.fail` can mark terminal failure, and neither is auto-continuation
safe.
`queue.review.getEvidenceBundle` is a backend-backed read-only evidence query,
requires explicit `taskId`, accepts optional `runId`, does not mutate Queue
state, and is also safe for broker auto-continuation after success. These
capabilities do not parse user prompts, route natural-language phrases, start
workers, run validation, execute Git commits, launch Terminal, execute
rollback, call shell, call Codex, or create Queue views. The continuation
action budget remains 16, and confirmation, unavailable, policy, invalid,
unexpected failure, restricted, repeated fingerprint, and safety stops are
unchanged.

The optional `queue.lifecycle.agentFinished` evidence bundle is normalized in
frontend adapter code, then passed to the backend command. Real invocation
requires explicit task id and run id, either top-level or in the bundle. It can
supply attempt id, thread id, outcome, final agent message, changed files
summary, validation summary, validation output preview, failure or stuck
reason, source/worker id, and log reference when available. Task, run, attempt,
outcome, or thread mismatches between explicit fields and the bundle are
rejected as invalid input. Product-facing summaries are bounded and use labels
such as `Agent completed`, `Agent did not complete`, `Agent failed`,
`N changed files`, `Validation passed`, `Validation failed`, `Validation not
run`, `Final report available`, and `Logs available`.

`queue.review.createMessage` can pass a bounded final/evidence summary to the
backend review message command. `queue.review.getEvidenceBundle` requires
explicit `taskId`, accepts optional `runId`, calls the backend evidence query,
and returns durable evidence state, bundle id, run id, outcome, summary,
blockers, nextActions, and the latest aggregate when available. The frontend
evidence overlay is transitional/deprecated for product truth.

`apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
adds a frontend ingestion bridge for explicitly Queue-linked completion shapes.
It requires a `taskId` and run id, builds or normalizes a
`QueueWorkerEvidenceBundle`, validates task/run/attempt/outcome/final-report
requirements, and invokes
`queue.lifecycle.agentFinished` through the Action Broker. It can adapt
explicit fake/frontend Direct Work, Workspace Agent, Agent Executor, and Queue
worker report results where those shapes are clear. Non-linked Direct Work
results are skipped instead of routed by prompt text or final-message text.
The bridge exposes product-facing labels such as `Queue worker evidence
ingested`, `Queue item awaiting review`, `Queue evidence ingestion failed`, and
`Queue evidence ingestion skipped`.

`apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.ts`,
`apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`, and
the active Queue run-metadata hook now wire safe automatic ingestion points for
Queue-started Direct Work completion with valid explicit Queue-linked metadata
and matching final `AgentExecutorRunDetail`. Agent Executor-owned handoffs use
the existing Executor handoff/final-detail path. Queue-owned starts use the
latest Queue run link plus final detail owned by the Agent Queue widget. The
wiring calls only the existing ingestion bridge, which then invokes
`queue.lifecycle.agentFinished` through the Action Broker. It is
current-session frontend wiring with a metadata idempotency key; repeated final
stream events, rerenders, or recovered final detail for the same Queue item/run
do not duplicate bridge calls.

Raw Workspace Agent final events, raw Direct Work final events without Queue
metadata, Agent Activity events, standalone Executor history, and task-id
inference from text/title/path/final-message/changed-files content remain
blocked as ingestion sources.

The ingestion bridge does not auto-create review messages, ACK review,
approve validation, mark done, start dependents, start workers, run validation,
execute Git/commit, execute rollback, launch Terminal, call shell/Codex, or
create Queue views. It persists only backend worker evidence through the typed
worker evidence command. Full lifecycle restart recovery, real validation
execution, real Git commit execution, rollback execution, and broad automatic
real worker event integration remain future work.

Lifecycle dry-runs preview the intended transition and do not mutate the
frontend lifecycle overlay, backend worker evidence ledger, or backend review
ledger. `queue.item.markDone` and `queue.item.fail` are not advertised as
dry-run safe and require exact structured confirmation for real invocation.
Worker-finished invocation
with `dryRun: false` mutates only the backend worker evidence ledger plus
task/run-link completion state through typed Tauri commands and returns
updated aggregate state. Review create/ACK invocation with `dryRun: false`
mutates only the backend review message ledger through typed Tauri commands
and returns updated aggregate state. MarkDone invocation with `dryRun: false`
mutates only the backend accepted-completion ledger and returns updated
aggregate state. Fail invocation with `dryRun: false` mutates only the backend
terminal-failure ledger and returns updated aggregate state. Other lifecycle
invocation with `dryRun: false` mutates only
the current frontend/controller overlay when the injected lifecycle adapter or
Queue bridge can provide the task seed. No Git command, validation execution,
rollback, Terminal launch, worker start, or commit capability is implemented
in this block.

The current Workspace Agent direct-run result path can invoke these Queue
handlers through the Action Broker when the agent emits a valid structured
Hobit action request envelope. The Queue bridge adapter targets the singleton
Queue, does not create duplicate Queue views, and does not start workers,
Codex, shell, Terminal, Git, or rollback behavior.

`apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
now runs the full fake dogfooding loop through the real Action Broker and
registered Queue lifecycle handlers. It is fake/model/controller/broker-level
for later decision gaps, while worker evidence and review create/ACK now
exercise backend-backed bridge paths when a Workspace Agent queue bridge is
available. The main success path feeds a structured worker evidence bundle and
explicit run id to `queue.lifecycle.agentFinished`, asserts review message
evidence summary and durable evidence readback through
`queue.review.getEvidenceBundle`, and explicitly reports validation/commit
durability gaps plus real worker execution, real validation execution, and real
Git commit execution as blocked or not covered. It also reports Queue-linked
evidence event wiring availability, raw non-Queue Direct Work ingestion
blocking, and duplicate completion guarding as current frontend inventory rows
without claiming broad backend scheduler durability.

Backend durability for lifecycle records beyond worker evidence, the review
message/ACK ledger, and accepted completion, real validation evidence
execution, and real Git commit execution remain future work.

## Widget Agent Contracts

Every Hobit widget or module must expose an agent-readable Widget Agent
Contract before it is considered complete. The contract describes product
functionality, typed agent-facing capabilities, input/output schema
descriptions, side-effect levels, confirmation and dry-run/preview
requirements, forbidden side effects, availability and unavailable reasons,
audit/activity event names, safe self-test capabilities, and the agent
self-test instruction.

Manual smoke is moving toward agent-executed smoke through widget self-tests.
The self-test contract must let an agent report `passed`, `failed`, `skipped`,
or `blocked` with structured evidence and no hidden side effects. Side-effecting
capabilities must use dry-run/model evidence or an explicit safe test sandbox;
missing or unavailable capabilities must be skipped or blocked instead of
treated as silent success.

The peer self-test foundation extends this model to multiple in-app agents:
one registered agent can check another registered agent's status, bounded
history, model-level capability manifest, and typed message receipt, then the
roles can be reversed. The peer report is product-facing and explicitly asserts
no Codex/shell usage, no Queue mutation, no Terminal launch, no Git mutation,
no rollback execution, and no hidden worker start.

The Agent API Smoke Runner is the first smoke layer built on this foundation.
It asks one agent to check another agent's implemented runtime API surface
using safe model checks for status, history, capabilities, messaging, and peer
self-test. It does not test Queue app behavior. Queue app capability smoke is
covered separately by the Queue adapter and Workspace Agent structured
action-request tests.

The Agent-executed Smoke Report foundation is the unified report layer above
those pieces. It creates a product-facing smoke instruction and plan, then
aggregates Agent API smoke, peer self-test evidence, active Widget Agent
Contract checks, Queue singleton/create-items/prompt-pack dry-run rows through
the brokered Queue self-test, fake Queue dogfood broker-loop rows, skipped or
blocked metadata-only execution checks, and hidden-side-effect assertions.
Knowledge / Skills, Notes, and Terminal execution adapters remain future work;
their contracts can pass while adapter/runtime execution reports
`Adapter not implemented yet`, `Runtime execution not implemented yet`, or
`Restricted capability`.

The smoke report does not perform hidden side effects. It does not call Codex,
run shell commands, mutate Queue, start Queue workers, create Queue views,
launch Terminal, run Terminal commands, mutate Git, execute rollback, create
or update Notes/Knowledge, attach context, add adapters, or parse user prompts
with natural-language regex routing. Any product action path remains
structured action request plus Action Broker validation.

The Workspace Agent `Run Agent Self-Test` UI action now exposes this smoke
foundation in-product. The visible report uses `Passed`, `Failed`, `Skipped`,
and `Blocked` statuses, summary counts, per-check rows, product-facing skipped
or blocked reasons, and a `No hidden side effects` assertion summary. Hidden
side-effect assertions cover no Codex run, shell command, Queue mutation,
Queue worker start, Queue view creation, Terminal launch, Git mutation, or
rollback execution.

This UI runner is safe/dry-run only. It does not call Codex, call shell,
launch Terminal, mutate Git, execute rollback, start Queue workers, auto-run
Queue, create Queue views, or perform unsupported widget APIs. If a brokered
self-test path requires confirmation, requires dry-run, is policy blocked, or
is unavailable, the UI reports that check as blocked or skipped and does not
auto-confirm it.

Queue and Widget smoke expansion is incremental. The MVP checks the current
Agent API smoke runner, active Agent Queue, Workspace Agent, Knowledge /
Skills, Notes, and Terminal widget contracts, adapter-unavailable or
restricted execution checks for Knowledge / Skills, Notes, and Terminal, and
Finder exclusion from active contract scope. It does not yet replace full
manual Queue UI smoke until broader Queue widget self-test coverage exists.

The initial Widget Agent Contract registry lives under
`apps/desktop/frontend/src/workbench/agents/widgets/`. Active contracts are
Agent Queue / QueueV2, Workspace Agent, Knowledge / Skills, Notes, and
Terminal. Knowledge / Skills, Notes, and Terminal contracts are metadata-only
in this block: their widget product behavior is described honestly, their safe
self-test instructions exist, and their non-self-test agent actions remain
unavailable or restricted until explicit adapters/execution blocks are
implemented. Terminal execute/destructive capabilities are restricted, require
confirmation where declared, and must never be default product-action paths.
Finder is out of scope for the current active Widget Agent Contract registry.

## Capability Metadata

Each capability has:

- `id`
- `title`
- `ownerSurface`
- `description`
- `inputSchemaDescription`
- `outputSchemaDescription`
- `sideEffectLevel`: `read | write | execute | destructive`
- `confirmationRequirement`: `none | recommended | required`
- `restricted`
- `supportsDryRun`
- `allowedAgentRoles`
- `forbiddenSideEffects`
- `auditEventNames`
- `availability` and unavailable reason
- `supportsSelfTest`

## Initial Capability Manifest

Current honest foundation capabilities:

- `workspace.context.get`: read-only live Workspace/Workbench context read
  from typed renderer state, with optional Queue control and widget summary.
- `workbench.widgets.list`: read-only bounded live widget list; Agent Executor
  discovery uses `definitionId === "agent-run"` and never title/prose/order
  inference.
- `agent.status.read`: model-level in-app agent status read.
- `agent.history.read`: model-level bounded in-app agent history read.
- `agent.message.send`: typed in-app agent message send through the pure
  Multi-Agent Runtime model.
- `agent.capabilities.read`: model-level in-app agent capability manifest
  read.
- `agent.selfTest.run`: safe model-level in-app agent self-test.
- `queue.createItem`: in-app Queue item creation through the singleton
  Workspace Queue path; optional `dependsOn: string[]` over explicit upstream
  Queue task ids; write side effect; no duplicate Queue view; no worker start.
- `queue.createItems`: in-app batch Queue item creation; write side effect;
  supports `items[].dependsOn` only for explicit existing upstream Queue task
  ids and supports dry-run/preview where a preview exists; no duplicate Queue
  view; no Queue Autorun or worker start.
- `queue.preparePromptPackPreview`: safe prompt-pack preview/materialization;
  read side effect; targets the singleton Workspace Queue; no Queue items are
  created.
- `queue.importPromptPack`: explicit Queue item creation from a confirmed
  prompt-pack preview; write side effect; uses existing Queue bridge paths; no
  auto-run workers.
- `queue.targetSingletonQueue`: read-only capability that resolves the single
  Workspace Queue target and forbids duplicate Queue views.
- `queue.selfTest`: safe dry-run Queue capability self-test surface through
  the Action Broker and injected Queue adapter.
- `queue.control.get`: read-only Queue control state read through the existing
  Queue control bridge; reports `disabled` or `manual_enabled`, version, and
  backend metadata when available; it does not enable Queue, start workers,
  start Queue Autorun, create tasks, or start Direct Work.
- `queue.control.setManualEnabled`: setup/write Queue control action through
  the existing backend/Tauri Queue control API; sets only backend Queue control
  state to `manual_enabled`, supports optional `expectedVersion` conflict
  checking and bounded `reason`, and does not start workers, schedule/dispatch,
  mutate Queue tasks, create run links, record evidence/reviews/finalization,
  invoke workflows, or launch shell/Git/Terminal/validation/rollback behavior.
- `queue.workflow.get`: read-only Queue workflow run summary by explicit
  `workflowRunId`, with phase/currentStep/status/timestamps, bounded
  variable/slot summaries, continuation refs by slot, blockers, and
  no-mutation flags.
- `queue.workflow.list`: read-only bounded Queue workflow run list with
  optional exact `status`, `workflowId`, and `limit`, for recovering lost
  workflow run ids without UI/prose inference.
- `queue.workflow.getReport`: read-only bounded Queue workflow report with
  task/run/evidence/message/completion/failure decision refs by slot, blockers,
  resume status, action count summary, and bounded report/action summaries.
- `queue.workflow.planResume`: read-only Queue workflow resume planner over
  existing backend state; returns resume status, next phase/step, blockers,
  required fresh grant/confirmation flags, task snapshots, and continuation
  refs without executing any workflow step.
- `queue.workflow.readActionLog`: read-only bounded action summary projection
  from the existing workflow report/action ledger, with optional status filter
  and limit; it exposes safe target/result refs and never raw logs or raw
  confirmation tokens.
- `workspaceAgent.selfTest`: safe Workspace Agent capability self-test surface.
- `codex.runTask`: restricted execute capability for explicit Codex Direct
  Work; not a product-action default.
- `workspace.shell.runCommand`: restricted execute capability for explicit
  shell command execution where a future safe shell capability is available;
  not a product-action default.

No brokered Knowledge / Skills, Notes, Terminal-open, backend scheduler,
durable worker execution, Git mutation, or Finder capability is claimed by the
initial global capability manifest. The Queue manifest does claim the typed
backend worker evidence command/query path for `queue.lifecycle.agentFinished`
and `queue.review.getEvidenceBundle`. Knowledge / Skills, Notes, and Terminal
now have Widget Agent Contracts and metadata-only self-tests, but their real
adapters and execution paths remain future blocks.

## Policy Rules

- App actions must use typed app capabilities before Codex or shell.
- Product actions must not inspect source files to discover or mutate product
  state.
- Product actions must not use shell unless an explicit shell capability is
  selected and permitted.
- Product actions must not use Codex unless an explicit Codex capability is
  selected and permitted.
- Queue item creation must use Queue capabilities and the singleton Queue
  target.
- No action may create duplicate Queue views.
- No action may auto-run workers unless that capability explicitly allows it.
- Destructive actions require confirmation.
- Unavailable actions return structured unavailable results.
- Policy-blocked actions return structured blocked results.
- All actions produce audit/activity events.

## Self-Test Rules

- Self-tests use safe or dry-run capabilities.
- Side-effecting capabilities require dry-run or an explicit test sandbox.
- Self-test status is `passed`, `failed`, `skipped`, or `blocked`.
- Self-tests must assert no hidden side effects.
- Self-tests must not call shell or Codex unless a self-test capability
  explicitly allows it.
- Capabilities without a safe self-test are marked skipped, not executed.
- Policy-blocked self-tests report blocked with the policy reason.
