# Smart Queue Implementation Status

## Purpose

This checkpoint records the current implemented Smart Queue foundation and the
next implementation sequence. It exists to prevent future Queue work from
confusing pure frontend/product-model foundations with durable runtime
features.

Queue backend ownership is centralized in
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`; this status document records
implementation state and must not be used to move Queue business truth into
frontend UI or overlays.

This is a docs/status artifact only. It does not add frontend behavior,
backend/runtime behavior beyond the explicitly listed Queue aggregate,
worker-evidence, review command, finalization, and workflow-persistence
contracts, storage/schema changes beyond those explicitly listed ledgers,
Tauri commands, IPC, scheduler or worker runtime, persistence, UI redesign,
Finder behavior, Git mutation, Terminal launch, Workspace Agent provider
calls, or Agent Executor execution.

## Current Status

Smart Queue has an implemented backend/domain read-model foundation plus a
frontend foundation for singleton Queue view safety, prompt-pack
materialization, dependency-aware eligibility,
frontend/controller execution gating, attempt and coordinator decision
presentation, explicit retry/handoff/proposal actions, typed Queue dogfood
lifecycle broker capabilities, a full fake broker-driven Queue dogfood loop
self-test, a frontend Queue worker evidence bundle model/adapter path, and
a frontend Queue worker evidence ingestion bridge, a Queue-linked Direct Work
metadata seam, Queue-linked Direct Work evidence event wiring, and focused
smoke coverage, a bounded Workspace Agent broker-action continuation loop for
structured action-request chains, Workspace Agent action-protocol enforcement
for typed capability mode, an active Queue V2 Codex executable setup
affordance for existing tasks, active Queue V2 Draft readiness discoverability
and explicit Draft-to-queued promotion through the existing Queue task update
path, plus a minimal active Queue details review/evidence UI for explicit
broker-driven coordinator review actions. Workspace Agent/Broker read
capabilities `queue.items.list` and `queue.lifecycle.get` now read
backend/Tauri authoritative Queue item aggregate DTOs, and
`queue.lifecycle.agentFinished`, `queue.review.getEvidenceBundle`,
`queue.review.createMessage`, `queue.review.ack`, `queue.item.markDone`, and
`queue.item.fail` now call
backend/domain/Tauri command or query contracts. These paths do not use Queue
board snapshots, selected task detail, frontend lifecycle/evidence overlays,
UI hooks, or broker-local lifecycle maps as product truth.
The Workspace Agent/Broker adapter boundary uses an injected Queue backend API
port so backend-backed capability paths can be tested without mounting the
frontend Queue UI.
Queue workflow persistence now has a backend-owned MVP: durable
`agent_queue_workflow_runs` and `agent_queue_workflow_actions` storage,
typed start/get/list/cancel/report/planResume plus runner-report-record backend
and Tauri/frontend API wrappers, idempotent start by request hash, bounded JSON
snapshots, safe grant-summary persistence, action-ledger idempotency rows, and
a read-only resume planner. The Workspace Agent Queue workflow runtime adapter
now creates or reuses a durable workflow run before supported runner
invocation, blocks request-hash conflicts before execution, records bounded
runner reports/action summaries, and uses the resume planner before continuing
an explicit typed `metadata.workflowRunId`. Create/setup/start plus existing
worker-evidence/read/review/finalization runner phases are wired. The
`dependency_acceptance_smoke` and `dependency_failure_smoke` paths can now
compose those phases end to end: upstream task setup/start, typed upstream
evidence recording, review message create/ACK, upstream accepted completion or
typed terminal failure with fresh exact structured confirmation, downstream
dependency-ready or `failed_upstream` no-auto-start verification, and a
completed bounded workflow report. Scheduler behavior, downstream auto-start,
and generic public resume execution remain not implemented.
Restart/recovery hardening is implemented for those existing dependency smoke
workflows: runner reports no longer overwrite backend-rich slot bindings with
frontend slot variables, backend report persistence merges authoritative
binding refs and rejects conflicts, and the resume planner can recover safe
refs from completed workflow actions or block incomplete binding/action/orphan
worker states explicitly.
Block 39 smoke-readiness audit verdict:
`ready_for_manual_headless_smoke`. The next step is to execute the manual
headless checklist in `docs/SMART_QUEUE_MANUAL_SMOKE_CHECKLIST.md` for both
dependency workflows. No runtime blocker was identified for the typed
workflow-request, persisted report, resume-plan, worker-evidence, review, and
finalization path. The checklist remains operator/manual smoke only; it does
not add scheduler behavior, downstream auto-start, validation execution, Git
mutation, rollback, Terminal launch, or Queue UI truth.
Workflow persistence APIs are not exposed as Workspace Agent broker
capabilities.
Queue workflow task slot materialization now exists as a backend/domain MVP.
It creates or reuses durable draft/manual Queue tasks by explicit
`workflowRunId + slot + taskSpecHash`, stores slot-to-task bindings in
workflow persistence, records a `create_task` workflow action row, and writes
dependency edges only by resolving explicit `dependsOnSlots` to already-bound
upstream task ids. The same workflow/slot/hash is idempotent, a different hash
for the same workflow/slot conflicts, and the same slot/spec in a different
workflow does not deduplicate globally. This is wired only into the
QueueWorkflowRunner create/setup/start path through typed runtime-adapter ports,
not Workspace Agent broker routing, and materialization itself does not update
run settings, promote tasks, enable Queue, start workers, record evidence/
reviews/finalization, run validation, mutate Git, roll back, launch Terminal,
schedule, or auto-start downstream work.
Queue workflow run-settings setup and task promotion now exist as backend/
domain MVP primitives for already materialized slots. Run-settings setup
applies typed durable task settings plus executor assignment, computes a
canonical `settingsHash`, persists a bounded `runSettings` snapshot and
`updateRunSettings` refs in the slot binding, and records an
`update_run_settings` workflow action row keyed by
`workflowRunId:update_run_settings:slot:settingsHash`. Promotion requires
matching `taskSpecHash`, matching `settingsHash`, and matching durable task
settings/executor assignment, moves draft to queued or treats already
queued/ready as idempotent only with matching hashes, persists promote refs in
the slot binding, and records a `promote_task` action row keyed by
`workflowRunId:promote_task:slot:taskSpecHash:settingsHash`. These backend
methods are wired only into QueueWorkflowRunner create/setup/start execution
through typed runtime-adapter ports, not Workspace Agent broker routing, and
they do not themselves start workers, create run links, enable Queue, satisfy
dependencies, record evidence/reviews/finalization, run validation, mutate Git,
roll back, launch Terminal, schedule, or auto-start downstream work.
Queue control state is also backend-owned and durable per workspace. The MVP
control states are `disabled` and `manual_enabled`, exposed through typed
backend/Tauri/frontend wrappers. `manual_enabled` is a manual/no-autodispatch
state for future explicit typed worker-start preconditions; setting it does
not start workers, arm Queue Autorun, run a scheduler, create run links, or
mutate tasks.
Workspace Agent can read this state with `queue.control.get` and set it to
`manual_enabled` with `queue.control.setManualEnabled`; the set capability
supports optional `expectedVersion` conflict checking and bounded `reason`, and
it mutates only backend Queue control state.
Workspace Agent live Queue smoke capabilities required before actual smoke
execution are now registry-consistent across the manifest, context
instructions, Action Broker handlers, `ModuleControlSurface` metadata, and
BrokerContinuationRuntime policy lookup. `workspace.context.get`,
`workbench.widgets.list`, `queue.control.get`, and Queue workflow debug reads
resolve concrete module/risk metadata and are read-only auto-continuation safe
without grant or confirmation. `queue.control.setManualEnabled` remains a
setup/write capability that can auto-continue only under setup-capable
structured Queue grant policy. `hobit.workflow.request` remains the official
workflow invocation path; `queue.workflow.invoke` is not implemented.
Worker start now has a backend-owned idempotency/control contract on the
existing assigned-task start path for Queue workflow phases. Workflow
context requires explicit workflow/action/task/executor/settings refs plus
exact confirmation, checks durable `manual_enabled`, task/dependency/executor
preconditions, and settings hash, records/reads `start_worker` action ledger
rows, returns the prior run for duplicate same-key/same-ref starts, conflicts
on changed refs, and blocks orphan/unknown start windows instead of silently
starting a second worker. QueueWorkflowRunner create/setup/start now uses this
path only for the explicit upstream dependency-smoke task and pauses before
workflow worker-evidence recording, lifecycle finalization, scheduler pickup,
or downstream auto-start.
Queue workflow worker-evidence recording now has a backend-owned MVP. The
runtime adapter can resume a persisted dependency-smoke workflow from explicit
typed `metadata.workflowRunId` plus `inputs.workerEvidence`, validate the
persisted upstream slot/task/run binding, call the backend workflow evidence
record/reconcile command, reuse existing matching durable evidence
idempotently, persist `evidenceBundleId` and bounded worker final status in
the workflow state/action ledger, and stop at `awaiting_review`. It does not
create/ACK reviews, mark done/fail/block/follow-up, run validation, mutate
Git, roll back, launch Terminal, start workers, create/update/promote tasks,
enable Queue, start downstream, or infer ids from prose/UI/session state.

Queue capability contract hardening is implemented at the manifest, instruction,
adapter, and test boundary. Every registered `queue.*` capability is covered by
a compact contract inventory that records implementation/backing status,
read/write/execute level, auto-continuation policy, exact required ids,
trusted context fields, exact enum values, structured confirmation
requirements, model-provided fields, and registered next-capability
possibilities. The continuation policy now reads this contract metadata and
Queue risk classes rather than maintaining a second static allowlist.
`queue.item.updateRunSettings` documents and validates exact
sandbox values `read_only`, `workspace_write`, `danger_full_access` and
approval policy values `never`, `on_request`, `untrusted`.
Queue capability results now expose generic typed `nextAction` payloads when a
follow-up can be built safely from known backend/adapter ids and validates
against the registered capability schema, Queue module metadata, and target
capability contract. `nextAction` is the machine-readable continuation
payload; `nextSuggestedCapability` is human/UI compatibility context and is
not enough for execution. Missing, ambiguous, or invalid follow-ups expose
structured `nextActionUnavailable` metadata while retaining compatibility
reason fields. The Workspace Agent must not rename fields or infer ids from
prose. `queue.review.ack` uses `messageId`; duplicate review-create
`existingMessageId` maps to `nextAction.input.messageId`.
Broker/module action results now use a typed module-neutral status taxonomy.
Idempotent Queue states are not generic failures: duplicate review create maps
to `already_exists`, accepted-completion idempotency maps to `already_done`,
terminal-failure idempotency maps to `already_failed`, backend/domain
preconditions map to `precondition_failed` or `blocked_actionable` when a safe
typed `nextAction` exists, missing exact confirmation maps to
`needs_confirmation`, invalid payloads map to `invalid_input` with field paths,
unavailable capability/API paths map to `unavailable`, and thrown runtime
errors map to `failed_unexpected`. New broker logic should use typed
`reasonCode` values, not prose reason strings.
Workspace Agent now supports a structured bounded Queue autonomy grant:
`{"type":"hobit.queue.autonomyGrant","mode":"queue_acceptance_smoke",...}`.
The grant is JSON only, never prose. Under grant policy, Workspace Agent may
continue through schema-valid generic typed Queue `nextAction` payloads while the
runtime enforces registered capability contracts, risk-class mode, optional
allowed/denied capability intersections, exact confirmation token, max action
budget, backend/result blockers, replay guards, and no Git/validation/
rollback/Terminal/delete/downstream-auto-start constraints. Grant modes are
`read_only`, `queue_smoke`, `queue_acceptance_smoke`,
`queue_failure_smoke`, and `queue_operator_flow`; transitional block,
follow-up, and validation decision capabilities remain blocked.
`queue.item.startRun` requires top-level
`confirmationToken: "operator-confirmed"` plus explicit `taskId` and
`executorWidgetId`; `queue.importPromptPack` uses the same top-level
confirmation token. Prose confirmation remains insufficient. Backend Queue
control must be `manual_enabled` before `queue.item.startRun`. New live smoke
setup uses `queue.control.get` followed by
`queue.control.setManualEnabled`; older typed `nextAction.capabilityId:
"queue.enable"` payloads remain a compatibility path before start.
Backend-backed reads/review/evidence/finalization
commands retain explicit id requirements, and remaining transitional commands
remain conservative and policy-restricted. This hardening does not move Queue
truth into frontend UI, redesign the backend aggregate, migrate Queue UI, add
regex routing, or add validation/Git/rollback/Terminal behavior.
`queue.item.markDone` is the backend-owned accepted-completion command. It
requires explicit `taskId`, trusted actor id, and top-level
`confirmationToken: "operator-confirmed"` after operator confirmation; prose
confirmation is insufficient. Worker completion and ACK remain not done.
`queue.item.fail` is the backend-owned terminal-failure command. It requires
explicit `taskId`, visible reason, trusted actor id, durable worker evidence,
an ACKed review message, and the same top-level confirmation token; worker
failure evidence and ACK alone do not imply terminal failure.
Without a structured grant, `queue.review.ack` is the only backend-backed
write allowed to continue after success, and that continuation is for reading
state, normally through `queue.lifecycle.get`. ACK remains review state; it
does not mark the task done, approve validation, attach commit state, unblock
dependencies, or make finalizing capabilities safe. With
`queue_acceptance_smoke` or `queue_failure_smoke`, `queue.item.markDone` or
`queue.item.fail` can be followed only from a valid typed nextAction with exact
structured confirmation and backend preconditions; successful finalizers end or
allow read-only inspection and never auto-start downstream work.

The generic `nextAction` contract is now module-neutral. Queue is the first
reference module; future deterministic workflow runners must consume the same
validated envelope and `nextActionUnavailable` metadata without parsing prose,
using regex routing, or inferring task/run/message/evidence/executor ids from
titles, prompts, UI order, file paths, or natural-language text.

The generic `hobit.workflow.request` envelope is now recognized by Workspace
Agent protocol classification as a separate module-neutral request type.
`AgentProtocolRuntime` is the pure provider-neutral facade for classifying
final answers, action requests, workflow requests, invalid requests, mixed
action/workflow requests, protocol stalls, and no-output cases. It reuses the
existing envelope parsers, validates the generic grant/input split and
`moduleId`/`workflowId` availability through `ModuleControlSurfaceRegistry`,
and does not execute workflows or broker actions. `grant` is now enforced as
permission/scope metadata only; `inputs` is the only workflow data location.
Product data such as runSettings, tasks, prompts, dependencies, run
configuration, and direct ids is rejected inside `grant`. For Queue, the initial
workflow ids `dependency_acceptance_smoke`, `dependency_failure_smoke`,
`review_acceptance`, and `terminal_failure` are now declared in
`ModuleControlSurface` metadata as `validation_only`. A request such as
`dependency_acceptance_smoke` or `dependency_failure_smoke` now validates typed
`inputs.runSettings`, typed task slots, explicit dependency slot references,
allowed Queue grant modes, and required safety constraints for setup phases,
then returns a `workflow_valid_not_executable` validation result. Phase-tagged
typed continuations may omit setup inputs and rely on persisted workflow
bindings; failure finalization still requires typed non-empty
`failureReason` at the runner boundary. `review_acceptance` and
`terminal_failure` remain declared with `input_validation_deferred`. Unknown
Queue workflow ids still report not declared. A deterministic
`QueueWorkflowRunner` now exists under the Queue module control-plane code with
separate create/setup/start, worker-evidence, read-only, review, and
finalization phases. It can consume validated
Queue workflow requests and inspect explicit existing Queue
aggregate/lifecycle/evidence ids through an injected read port, returning
workflow-local variables, read snapshots, steps, events, blockers, pause
reasons, and a structured report. The worker-evidence phase can resume from
typed upstream task/run completion input, record or reconcile durable evidence
through the backend workflow evidence command, persist `evidenceBundleId`, and
stop before review. The review phase can additionally resolve evidence, create
a backend review message, and ACK that review message through an injected
review port when all required explicit typed ids are present. The finalization
phase can call an injected typed finalization port to mark the explicit
upstream done for `dependency_acceptance_smoke` or failed for
`dependency_failure_smoke`, with exact structured confirmation, explicit
failure reason for failure, and review ACK/precondition proof. It verifies
explicit downstream dependency/no-auto-start state when a downstream task id is
available and reports verification missing when it is not. It requires explicit
task/run/evidence/message ids and does not infer ids from title, prompt, prose,
UI order, file paths, or repository roots. `review_acceptance` is supported
only by minimal explicit typed runner inputs while generic request validation
remains deferred. Already-existing evidence, already-existing review messages,
already-done ACKs,
`already_done`, and `already_failed` are idempotent/actionable states, not
generic failure. ACK is not task completion. The generic Workspace Agent
workflow request path now invokes the runner only for supported Queue phases
through a typed runtime adapter. The adapter persists supported invocations by
starting/reusing workflow-run records, recording bounded report/action-ledger
summaries, and using read-only resume planning before any typed continuation
from `metadata.workflowRunId`. For `dependency_acceptance_smoke` and
`dependency_failure_smoke`, that adapter now completes the full acceptance or
failure sequence and persists completed workflow status/report refs without
persisting raw transcripts or reusable confirmation tokens. Failure reports may
include sanitized typed failure reason and decision refs. This block does not
add
`hobit.queue.workflowRequest`, `queue.workflow.invoke`, scheduler behavior,
worker auto-start, task
creation outside create/setup/start, Queue mutation outside workflow-owned
upstream evidence recording, review message/ACK ledger, or explicit upstream
finalization ports, or Queue runtime changes. Prose is never executable
workflow input, permission, confirmation, or id source.

Workspace Agent direct turns now go through a provider-neutral AgentProvider
seam. Codex Direct Work remains the default implementation through a
CodexAgentProvider adapter, while deterministic FakeAgentProviders can emit
final answers, structured Hobit action requests, workflow requests, errors,
and cancellation/stopped events for tests without calling Codex. This does not
change Queue capability behavior, backend lifecycle semantics, bounded
autonomy policy, workflow request validation, or Queue UI.

Workspace Agent provider turns now also pass through a provider-neutral
AgentRuntime event loop around AgentProvider. AgentRuntime owns provider run
lifecycle, provider run handle metadata, provider cancellation delegation, and
normalized runtime events. It delegates final-output classification to
AgentProtocolRuntime and emits intent-like protocol events for the controller.
The React controller is now thinner: provider-turn input construction,
provider-event compatibility mapping, and protocol fallback resolution are
delegated to runtime adapter helpers. It still owns visible UI state, broker
invocation, continuation turn application, activity/transcript application,
and all existing broker/application flow. BrokerInvocationRuntime remains a
future block if broker invocation/application needs a dedicated runtime. No
mutating workflow execution beyond the explicit QueueWorkflowRunner
create/setup/start, worker-evidence, read/review/finalization adapter phases,
scheduler behavior, worker auto-start, backend lifecycle semantic change, or
new Queue capability is added.

Workspace Agent activity/transcript/log output formatting now goes through a
pure AgentActivityRecorder. It returns append intents for provider final
answers, provider terminal/error rows, invalid action/workflow requests, mixed
action/workflow rejection, broker action results, continuation stops, protocol
repair notices, and workflow-not-declared messages. The React controller still
owns UI state and applies those intents. Broker continuation orchestration now
goes through a pure BrokerContinuationRuntime that returns typed intents for
broker invocation, continuation turns, protocol repair, stop, and completion.
The runtime reuses the existing explicitly Queue-specific bounded-autonomy
helpers; Queue policy remains transitional and Queue-specific until a real
mutating Queue workflow runner is explicitly wired. Broker invocation,
provider behavior, continuation policy behavior, protocol classification,
Queue behavior, workflow execution, and backend lifecycle semantics are
unchanged.

WorkerProvider is now a separate provider-neutral frontend seam for explicit
work-item execution and normalized worker evidence/result events. The MVP
includes a deterministic FakeWorkerProvider, a thin CodexWorkerProvider adapter
around existing Direct Work stream APIs, and a pure mapping from
WorkerProvider final results into the current Queue worker evidence ingestion
input shape. Worker-backed Queue workflow execution remains not implemented:
no worker start, scheduler behavior, Queue auto-start, backend lifecycle
semantic change, or new Queue capability is added. The current
QueueWorkflowRunner phases do not consume WorkerProvider.

The full durable Smart Queue backend/runtime is not implemented yet. Current
Smart Queue modules are frontend/product-model foundations unless explicitly
noted otherwise. The implemented backend exceptions are the
`QueueItemAggregate` contract over existing durable Queue task rows, run links,
dependencies, durable worker evidence bundle rows, and review message ledger
rows, plus typed durable worker-finished/evidence-read and review
message create/ACK commands, plus typed durable accepted-completion
finalization, plus backend-owned Queue workflow run/action persistence with
start/get/list/cancel/report/planResume APIs and a narrow runner-report record
API for supported workflow runner phases, plus backend-owned Queue control
state with `disabled` / `manual_enabled`. This is not a scheduler, general
transition command set, generic workflow resume executor, validation runtime,
Git/commit flow, rollback flow, worker-start implementation, or full Queue
lifecycle store.

## Implemented Backend Aggregate, Worker Evidence, And Review Commands

The backend/domain layer now exposes a Queue aggregate, worker evidence
command/query, and review command contract:

- `crates/hobit-app/src/workspace_service/agent_queue_aggregate.rs` defines
  `QueueItemAggregate`, explicit ticket/worker/review/evidence/validation/
  commit/dependency state enums, bounded blockers, next actions, run settings,
  latest run summary, evidence summary, and durability flags.
- `WorkspaceService::list_queue_item_aggregates` and
  `WorkspaceService::get_queue_item_aggregate` build aggregates from durable
  task rows, compatibility dependency ids, latest run links, existing widget
  run summary metadata, and latest durable review message rows.
- `WorkspaceService::create_agent_queue_review_message` and
  `WorkspaceService::ack_agent_queue_review_message` validate aggregate
  preconditions and persist durable review message / ACK rows. Review-create
  blockers are typed backend results with ticket, worker-run, review, evidence,
  duplicate-message, required-field, selected id, and next-capability
  diagnostics instead of generic frontend failure text.
- `WorkspaceService::record_agent_queue_worker_finished` and
  `WorkspaceService::get_agent_queue_worker_evidence_bundle` require explicit
  workspace/task/run identity where applicable, validate task/run ownership,
  persist durable worker evidence bundles, expose no-evidence/not-found states,
  and update aggregate worker/review readiness without marking the Queue item
  done.
- `WorkspaceService::mark_agent_queue_item_done` validates accepted-completion
  preconditions from the backend aggregate, requires exact structured
  confirmation and trusted actor id, persists a durable completion decision,
  and updates the aggregate to done without running validation, Git, rollback,
  Terminal, workers, shell, or Codex.
- `apps/desktop/src-tauri/src/agent_queue_aggregate_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_aggregate_commands.rs` expose
  read-only desktop commands for aggregate list/get.
- `apps/desktop/src-tauri/src/agent_queue_worker_evidence_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_worker_evidence_commands.rs` expose
  typed desktop commands for worker-finished and evidence bundle readback.
- `apps/desktop/src-tauri/src/agent_queue_review_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_review_commands.rs` expose typed
  desktop commands for review create/ACK.
- `apps/desktop/src-tauri/src/agent_queue_completion_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_completion_commands.rs` expose typed
  desktop commands for accepted completion / mark done.
- The aggregate read model is deterministic and non-mutating. Worker evidence
  commands mutate only the task/run-link completion state needed for worker
  reporting plus the durable worker evidence ledger. Review commands mutate
  only the durable review message ledger. These paths do not start workers, run
  validation, mutate Git, execute rollback, launch Terminal, call Codex, or
  read frontend overlays.
- Successful worker evidence maps to `awaiting_review`; it does not mark the
  Queue item `done`. Failed worker evidence exposes failed worker-run evidence
  and durable error/evidence summary without marking the item terminal failed.
  Dependency satisfaction requires durable accepted completion, not worker
  completion or ACK.
- Backend aggregate dependency state is authoritative for backend-backed read
  capabilities. It exposes `none`, `ready`, `waiting`, `blocked`,
  `failed_upstream`, and `unknown`. `waiting`, `blocked`, `failed_upstream`,
  and `unknown` produce dependency blockers and no runnable next action, so
  broker reads do not suggest `queue.item.startRun`, `queue.enable`, or
  runnable `queue.item.promoteDraft` from dependency-blocked aggregate state.
  After upstream accepted completion is recorded through `queue.item.markDone`,
  downstream aggregate reads clear the dependency blocker and return the
  downstream task's own readiness action. After upstream terminal failure is
  recorded through `queue.item.fail`, downstream aggregate reads report
  `failed_upstream`. No worker starts automatically.
- Successful worker evidence with no review message exposes available
  `create_review_message`; review message creation requires durable backend
  worker evidence, maps to `review_message_created`, returns the selected
  evidence bundle id/run id, and exposes available `ack_review`; ACK maps to
  `in_review`; accepted completion maps to `done`; terminal failure maps to
  `failure`/`failed`.
- Backend headless contract tests now prove list/get, draft readiness, queued
  startability, running/completed/failed run-link state, dependency waiting,
  unknown, completed-run-link-not-satisfied, failed-upstream, and
  accepted-completion unblock state, read-only query behavior, durable worker evidence
  record/readback, worker evidence idempotency, run-link ownership rejection,
  review create/ACK preconditions, explicit task identity, unrelated task
  isolation, durable reload of worker evidence, review message state, and
  accepted completion state, terminal failure state and downstream
  `failed_upstream`, no prompt regex routing, and honest `not_durable` /
  `unknown` states without launching the frontend.
- Tauri aggregate command tests now prove the desktop list/get command helpers
  serialize ticket, worker, review, evidence, validation, commit, dependency,
  blocker, next-action, latest-run, and durability fields from the backend
  aggregate, remain read-only, and do not call Codex, shell, Git, validation,
  rollback, Terminal, or frontend code.
- Workspace Agent/Broker aggregate read wiring is implemented for
  `queue.items.list` and `queue.lifecycle.get`; worker evidence command/query
  wiring is implemented for `queue.lifecycle.agentFinished` and
  `queue.review.getEvidenceBundle`; review command wiring is implemented for
  `queue.review.createMessage` and `queue.review.ack`; accepted-completion
  wiring is implemented for `queue.item.markDone`; terminal-failure wiring is
  implemented for `queue.item.fail`. Queue UI rendering migration, validation
  decisions, commit decisions, durable block commands, and durable scheduler
  state remain future work. Backend failed-upstream propagation now uses the
  durable failure decision ledger for explicit terminal failures.
- Workspace Agent/Broker Queue create wiring can express dependency edges with
  `dependsOn: string[]` on `queue.createItem` and `items[].dependsOn` on
  `queue.createItems`. Those ids must be explicit upstream Queue task ids
  returned by typed Queue results. The broker passes them through the typed
  Queue API to backend/Tauri validation; it does not infer dependencies from
  title, prompt, order, prose, UI state, or prompt-pack-local ids. Dependency
  smoke should create upstream first, then downstream with the returned
  upstream task id. Intra-batch references to ids created earlier in the same
  batch are not a stable public contract in this block.

### Queue workflow persistence API

Implemented as backend/storage/API foundation only:

- `agent_queue_workflow_runs` stores durable workflow run identity,
  workspace/request/workflow ids, stable request hash, status, phase/current
  step, pause/block reasons, bounded typed input snapshots, safe grant
  summaries, variables, slot bindings, mutation refs, idempotency keys,
  compact action-log summary, versioning, schema version, and timestamps.
- `agent_queue_workflow_actions` stores backend-internal step/action ledger
  rows with idempotency keys, target/result refs, blockers, attempt count, and
  timestamps.
- `WorkspaceService::start_queue_workflow`,
  `get_queue_workflow_run`, `list_queue_workflow_runs`,
  `cancel_queue_workflow_run`, `get_queue_workflow_report`, and
  `plan_queue_workflow_resume` expose the backend contract. Tauri commands and
  frontend wrappers mirror those operations.
- `start_queue_workflow` is idempotent for the same workspace/request id and
  stable request hash; conflicting typed snapshots return a conflict instead
  of overwriting the previous run.
- Snapshot JSON fields are bounded and grant summaries do not persist
  reusable confirmation tokens.
- Cancel is non-destructive and does not roll back, stop workers, mutate Queue
  lifecycle/task/review/evidence/finalization state, or launch runtime work.
- Resume planning is read-only. It loads durable workflow state and action
  ledger rows, parses typed slot bindings/variables, reconciles bound
  task/run/evidence/review/completion/failure ids against durable Queue facts,
  reports terminal workflow-run states, blockers, next phase/step, and fresh
  grant/confirmation requirements, and never infers ids from title/prose/UI
  order/session state.

Not implemented here: generic public workflow resume execution, broker workflow
capability exposure, review/finalization execution beyond the existing runner
ports, validation, Git, rollback, Terminal,
scheduler, or downstream auto-start. QueueWorkflowRunner persistence execution
wiring now includes create/setup/start and worker evidence for dependency
smoke, with worker evidence stopping before review.

### Headless Queue API readiness

Current backend/domain ready operations:

- create/update Queue task rows through `WorkspaceService`;
- update task-scoped run settings through task update fields;
- promote a draft by updating the task status to `queued` when required fields
  are present;
- assign and clear visible Executor ownership;
- create/list/get Queue run links and record final run-link status;
- record and read durable worker evidence bundles for explicit task/run ids;
- inspect dependency eligibility through aggregate list/get;
- inspect aggregate list/get for durable task, run-link, blocker, next-action,
  dependency, review, evidence, validation, and commit state.
- create durable Queue review messages after backend aggregate state reports
  `awaiting_review` and durable worker evidence exists. `evidenceBundleId` is
  optional exact context; when omitted, the backend selects the latest durable
  evidence for the explicit task/run and returns the selected id.
- ACK durable Queue review messages and update aggregate review state to
  `in_review`.
- Mark ACKed Queue review items done through a durable accepted-completion
  decision after backend aggregate preconditions and exact structured
  confirmation pass.

Current Tauri/API ready operations:

- create/list/get/update/delete Queue tasks;
- assign/clear Executor ownership;
- start an explicitly assigned task through the existing Queue execution
  command path;
- list/get Queue task run links;
- list/get Queue item aggregates through authoritative DTOs.
- record worker finished and read worker evidence bundles through
  authoritative command/query DTOs.
- create and ACK Queue review messages through authoritative command DTOs.
- mark ACKed Queue review items done through authoritative accepted-completion
  command DTOs.
- Workspace Agent/Broker reads of Queue item summaries and lifecycle/effective
  state through those aggregate DTOs.
- Workspace Agent/Broker worker finished/evidence read through typed
  backend/Tauri APIs.
- Workspace Agent/Broker review create/ACK through typed backend/Tauri APIs;
  trusted actor id is supplied by runtime context/default rather than model
  invention.
- Workspace Agent/Broker accepted completion through typed backend/Tauri APIs;
  exact structured confirmation is required and the result is headless-testable
  without Queue UI.
- Workspace Agent/Broker terminal failure through typed backend/Tauri APIs;
  exact structured confirmation, visible reason, durable worker evidence, and
  ACKed review are required, and the result is headless-testable without Queue
  UI.

Frontend-only transitional operations:

- approve validation placeholder;
- add follow-up prompt;
- block through dogfood lifecycle overlay;
- frontend worker evidence bundle normalization and legacy/controller evidence
  overlay compatibility only; it is transitional/deprecated for product truth;
- Queue-linked Direct Work evidence ingestion and current-session idempotency;
- Queue active/pause and Autorun arming in the active Queue surface.

Missing backend commands:

- dedicated typed draft-promotion command;
- durable Queue Autorun arm command;
- durable validation approval command;
- durable follow-up command;
- durable block command;
- durable commit approval/result command.

Missing durability:

- validation decision/evidence state beyond run-link status strings;
- commit decision/result state;
- durable Queue scheduler/runner state and restart recovery.

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
- typed Workspace Agent `queue.item.startRun` accepted-start reconciliation:
  Queue task state and latest run-link metadata refresh after a real run id is
  returned, and Queue-owned final detail can feed the existing evidence
  ingestion bridge;
- Workspace Agent broker-action continuation: after an eligible structured
  broker result, the frontend feeds a compact `hobit.action.result`
  back into the same Codex thread so the model can emit the next single
  `hobit.action.request` or explicit `hobit.final.answer`, with a 16-action
  cap and typed stops for confirmation, policy, unavailable, paused,
  dry-run-required compatibility, invalid, blocked, unexpected failure,
  repeated, unsupported, restricted, protocol-error, or missing-thread cases.
  `blocked_actionable`, `already_exists`, `already_done`, and
  `precondition_failed` can continue only through a validated typed
  `nextAction`. The continuation runtime does not infer from
  `nextSuggestedCapability` alone. Structured Queue autonomy grants can allow
  bounded multi-step Queue
  workflows through risk-class policy and exact-token confirmation injection,
  but malformed grants or prose-only approvals do not grant permission;
- Workspace Agent action protocol enforcement: a typed-capability Direct Work
  turn with no valid action request and no explicit final-answer marker gets
  one compact same-thread repair prompt from the protocol runtime facade; if
  repair still produces empty or intermediate non-action prose, the chain stops
  with a visible protocol error and reports that no broker action was executed;
- prose such as awaiting `queue.items.list` result is not a successful Queue
  smoke outcome, is not parsed into `queue.items.list`, and is not
  natural-language routed to any capability;
- continuation request ids preserve replay safety: explicit duplicate
  requestIds hard-stop, while missing or blank requestIds are derived from the
  continuation chain id, action index, and capability id so runtime-generated
  fallback ids do not falsely repeat;
- read-only `queue.lifecycle.get` is allowed to participate in safe broker
  auto-continuation after success and reads backend aggregate state for one
  explicit `taskId`. Its broker result exposes ticket, worker, review,
  evidence, validation, commit, and dependency state dimensions, blockers,
  next actions, typed `nextAction` when schema-valid, `nextSuggestedCapability`,
  latest run, evidence summary, durable flags, and
  `authoritativeBackendAggregate=true`;
- successful backend-backed `queue.review.ack` is allowed to continue only so
  the next structured action can read state, normally with
  `queue.lifecycle.get`. It does not imply accepted completion or
  finalization;
- read-only `queue.review.getEvidenceBundle` reads backend durable worker
  evidence for an explicit `taskId` and optional `runId`, may expose typed
  `nextAction` for `queue.review.createMessage` when `taskId`, `runId`, and
  `evidenceBundleId` are known, and does not mutate Queue state. Review
  creation remains a write and is not auto-continuation safe by default;
- read-only `queue.items.list` returns backend aggregate task summaries with
  ticket/worker/review/evidence/validation/commit/dependency states,
  blockers, nextActions, latestRun, evidenceSummary, and durable flags;
- active Queue V2 Codex executable setup affordance for existing tasks through
  the existing task update/run-settings bridge;
- active Queue V2 Draft readiness explanation for existing Draft tasks and
  explicit queued promotion for Draft tasks that already have required run
  fields;
- minimal active Queue details review/evidence presentation and explicit
  broker-action controls for awaiting-review / in-review dogfood items;
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
- Materialized prompt-pack dependency edges are represented through the current
  Queue task dependency field (`dependsOn`; some internal prompt-pack adapter
  snapshots still use `dependencies`) after all selected tasks are created.
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

### Active Queue V2 Codex executable setup gate

Implemented for the active Queue product route only.

- The active Queue V2 board keeps `Enable Queue` disabled when no existing task
  has a task-scoped Codex executable configured.
- The disabled gate now has an explicit `Set Codex executable` action in the
  board header. The action opens the selected task when it is missing
  `codexExecutable`, otherwise the first existing task missing that field.
- The active task details popup renders a compact task-scoped Codex executable
  setup section for missing configuration. It uses an executable text input,
  explicit Save, Cancel, local empty-value validation, unavailable update
  state, and failed-save error reporting.
- Saving uses the existing Queue task update/run-settings bridge and persists
  only `codexExecutable` on the selected task. It does not create a separate
  global executable store and does not share Workspace Agent / Direct Work
  executable defaults.
- Saving Codex executable does not enable Queue, start workers, start Direct
  Work, promote Draft tasks, create review messages, change dogfood lifecycle,
  run validation, call Git, launch Terminal, call shell/Codex, execute
  rollback, or add unrelated backend durability.
- Draft tasks still need readiness/queueing separately before they can run.

### Active Queue V2 Draft readiness and explicit queueing

Implemented for the active Queue product route through the existing frontend
Queue view-model and controller/update path.

- Draft task cards and details now show compact product-facing readiness copy:
  `Draft task`, `Not runnable yet`, missing prompt, missing workspace, missing
  Codex executable, missing sandbox, missing approval policy, or
  `Ready to queue`.
- The active task details popup exposes the existing `Queue for run` promotion
  action only when the selected Draft has the required fields. Missing fields
  keep the action disabled with a compact blocker reason.
- Promotion uses the existing Queue task update controller to change the
  selected task from `draft` to `queued`. It does not create a parallel Queue
  state machine.
- The same readiness gate protects the controller callback, so stale UI or
  typed callers cannot promote an incomplete Draft through
  `draftPromotion.onPromote`.
- Saving the task-scoped Codex executable updates readiness but leaves the task
  in Draft until the operator explicitly queues it.
- Queueing a Draft does not enable Queue, start workers, start Direct Work,
  run validation, call Git, launch Terminal, execute rollback, create
  review/evidence actions, or change dogfood lifecycle review state.
- Backend durability, validation execution, Git/commit integration, rollback,
  scheduler/runtime redesign, and broader Queue UI redesign remain future work.

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
- The legacy frontend model supports review messages, coordinator ACK
  transition from `awaiting_review` to `in_review`, validation approval
  placeholders, commit request placeholders, fake commit result attachment,
  explicit block/fail, and same-item follow-up prompt records. Workspace Agent
  `queue.item.markDone` and `queue.item.fail` no longer use this overlay as
  product truth; they call backend accepted-completion and terminal-failure
  commands.
- Failed agent prompt outcomes are routed to review first; terminal ticket
  failure requires an explicit durable coordinator/operator decision through
  `queue.item.fail`.
- Dependents are startable only after upstream accepted completion, not merely
  after agent completion, awaiting review, in review, review ACK, validation
  approval, or fake commit result attachment.
- The controller adapter exposes pure helpers for lifecycle creation/derivation,
  agent-finished transitions, coordinator ACK, follow-up/fail/block decisions,
  dependency gates, and product-facing lifecycle presentation.
- QueueV2 view-model helpers can consume an explicit dogfood lifecycle overlay
  to show `Awaiting review`, `In review`, `Done`, `Failed`, `Agent completed`,
  `Agent did not complete`, `Agent failed`, `Follow-up prompt running`,
  `Review acknowledged`, `Waiting for coordinator review`, and `Additional
  prompts: N` without redesigning Queue cards.
- Frontend dependency summaries can use compatibility overlays so dependents
  stay waiting while upstream is agent-completed, awaiting review, or in
  review. Backend aggregate dependency state now treats upstream as satisfied
  only when a durable accepted-completion decision exists.
- Product-facing helpers emit labels such as `Awaiting review`, `In review`,
  `Agent completed`, `Follow-up prompt running`, `Review acknowledged`, and
  `Waiting for coordinator review`.
- `smartQueueDogfoodLifecycle.test.ts` covers the legacy fake lifecycle,
  follow-up branch, invalid transitions, terminal states, ACK targeting,
  fake commit attachment, compatibility dependency gates, and no hidden side
  effects.
- `smartQueueDogfoodLifecycleController.test.ts` covers controller overlays,
  QueueV2 presentation integration, done-gated frontend dependency eligibility,
  fake full lifecycle self-test, follow-up prompt branch, and hidden-side-effect
  guards.
- `queue.lifecycle.agentFinished`, `queue.review.createMessage`,
  `queue.review.ack`, `queue.coordinator.approveValidation`,
  `queue.coordinator.addFollowUpPrompt`, `queue.item.markDone`,
  `queue.item.block`, `queue.item.fail`, `queue.lifecycle.get`, and
  `queue.review.getEvidenceBundle` are exposed as typed Action Broker
  capabilities. `queue.lifecycle.get`, `queue.lifecycle.agentFinished`,
  `queue.review.getEvidenceBundle`, `queue.review.createMessage`, and
  `queue.review.ack`, `queue.item.markDone`, and `queue.item.fail` are
  backend/Tauri aggregate, worker-evidence, review, accepted-completion, or
  terminal-failure command-backed in the Workspace Agent bridge path;
  validation approval, follow-up, and block remain frontend/controller
  overlay-backed.
- Workspace Agent can invoke those capabilities only by emitting structured
  `hobit.action.request` envelopes. User prompt regex routing is not
  implemented. Workspace Agent can now continue a frontend broker-action chain
  only through compact structured `hobit.action.result` context in the same
  Codex thread. It still emits one action envelope at a time, never action
  lists, and must use returned ids from the structured result instead of
  inferring task ids or executor ids from prompt text, titles, repository
  paths, final messages, or other prose.
- In typed-capability action mode, a model response that says it is awaiting a
  Queue capability result without emitting a structured envelope is a protocol
  stall, not success. The controller asks for one repair response in the same
  thread and then fails visibly with protocol error if the model still does
  not emit a valid `hobit.action.request` or explicit `hobit.final.answer`.
  Broker actions remain triggered only by structured envelopes.
- `apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
  now proves a fake full dogfooding loop through the real broker and registered
  Queue lifecycle handlers: agent finished, review message, ACK, validation
  approval, backend-required mark done unavailability in the fake store,
  dependents remaining gated without backend accepted completion, follow-up
  prompt returning to running, failure-dependent blocking, and no hidden side
  effects.
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts`
  defines the frontend Queue worker evidence bundle model, outcome mapping,
  validation, bounded display summaries, lifecycle/review adapters, and pure
  adapters from existing frontend Direct Work, Agent Executor, Workspace Agent,
  and Queue worker report shapes where those shapes are clear.
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
  defines the frontend ingestion bridge that requires an explicit Queue
  `taskId` and run id, builds or normalizes a `QueueWorkerEvidenceBundle`,
  validates task/run/attempt/outcome/final-report requirements, invokes only
  `queue.lifecycle.agentFinished` through the Action Broker, supports dry-run
  preview, and returns product-facing labels such as `Queue worker evidence
  ingested`, `Queue item awaiting review`, `Queue evidence ingestion failed`,
  and `Queue evidence ingestion skipped`.
- `apps/desktop/frontend/src/workbench/queue/workerProviderEvidenceMapping.ts`
  defines the pure WorkerProvider-to-Queue evidence input mapping. It preserves
  explicit task/run/provider/thread ids, outcome, final report/summary,
  changed files, validation status, failure/stuck reason, and provider
  metadata, but it does not record evidence or call Queue lifecycle APIs by
  itself.
- `queue.lifecycle.agentFinished` accepts either the existing explicit fields
  or an optional structured evidence bundle, but it requires explicit `taskId`
  and `runId` and never infers either from prose. A valid bundle can supply
  task, run, attempt, thread, outcome, final agent message, validation summary,
  error summary, source/worker id, and changed-files summary. Task, run,
  attempt, outcome, or thread mismatches are rejected as invalid input. Real
  invocation records durable backend worker evidence and returns the updated
  backend aggregate.
- Review message creation can pass a bounded product-facing final/evidence
  summary into the backend review message command. Durable backend worker
  evidence is required; `evidenceBundleId` is optional exact typed context and
  is selected by the backend when omitted. Any supplied `runId` or
  `evidenceBundleId` is validated against durable evidence, never inferred from
  prose. Typed blockers surface backend ticket, worker-run, review, and
  evidence states. `queue.review.getEvidenceBundle` requires explicit `taskId`,
  accepts optional `runId`, and returns the durable backend evidence query
  state, bundle id, outcome, summary, blockers, nextActions, and latest
  aggregate when available.
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
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.ts`,
  `apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`, and
  `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunMetadata.ts` wire
  safe automatic ingestion points for Queue-started Direct Work completion
  with valid explicit metadata and matching final `AgentExecutorRunDetail`.
  Agent Executor-owned runs use the handoff/final-detail path; Queue-owned
  runs reconcile from the selected task's latest run link and final detail. The
  hooks call only the injected ingestion bridge callback, which then invokes
  `queue.lifecycle.agentFinished` through the Action Broker.
- Queue-linked evidence event wiring is current-session frontend-only and
  idempotent by the metadata key. Stream final event and recovered final detail
  for the same Queue item/run are ignored after the first bridge attempt.
  Different explicit run ids or Queue item ids can ingest separately.
- Raw Workspace Agent final events, raw Direct Work final events without Queue
  metadata, Agent Activity events, standalone Executor history, and text/title/
  path/final-message inference remain blocked as ingestion sources.
- Successful Queue-linked evidence event wiring records durable backend worker
  evidence through the bridge/broker/backend command path, moves only the
  linked item to backend `awaiting_review`, and makes the evidence readable for
  explicit backend evidence queries. It does not auto-create review messages,
  ACK review, approve validation, mark done, start dependents, start workers,
  run validation, run Git, execute rollback, launch Terminal, call shell/Codex,
  or persist validation/commit/follow-up/mark-done/fail/block state.
- The fake broker-loop success path now sends a fake worker evidence bundle
  into `queue.lifecycle.agentFinished` and asserts broker consumption, review
  message evidence summary through the backend-backed command path, durable
  backend evidence readback, no Git execution on mark done, and no dependent
  unblock without backend accepted completion.
- Lifecycle capability dry-runs preview transitions without mutating state,
  except `queue.item.markDone` and `queue.item.fail`, which are not dry-run
  advertised and require exact structured confirmation for real invocation. Real worker-finished
  invocation mutates only the backend worker evidence ledger plus task/run-link
  completion state; real review create/ACK invocation mutates only the backend
  review message ledger; real markDone invocation mutates only the backend
  completion decision ledger; real fail invocation mutates only the backend
  terminal-failure decision ledger. Other real lifecycle writes mutate only
  frontend/controller overlay state where an injected lifecycle adapter or
  Queue bridge task seed is available.
- Ingestion bridge tests prove dry-run immutability, broker-only mutation to
  backend evidence recording/readback, explicit review-message evidence
  summary inclusion, no auto-done/dependent unblock before coordinator
  `markDone`, unavailable dependency handling, no task-id inference from text,
  and no Codex/shell/Terminal/Git/rollback/worker/duplicate Queue side effects.
- This is not full durable backend lifecycle persistence, real worker
  execution, broad automatic real worker result event integration, scheduler
  redesign, validation execution, Git commit execution, rollback, Queue UI
  redesign, or Finder behavior.

### Queue review/evidence minimal UI

Implemented in the active Queue product details path.

- `apps/desktop/frontend/src/workbench/queue/queueReviewEvidenceViewModel.ts`
  maps dogfood lifecycle/evidence state into bounded product-facing labels and
  previews for the current Queue details surface.
- `apps/desktop/frontend/src/workbench/queue/queueReviewEvidenceActions.ts`
  builds structured `hobit.action.request` envelopes for explicit review
  actions. It does not parse user prompt text or infer task ids.
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskReviewEvidenceSection.tsx`
  renders a compact `Dogfood review` section in the active QueueV2 task details
  Result tab only when evidence, awaiting-review, in-review, dogfood overlay,
  or follow-up prompt state is relevant.
- The section shows lifecycle status, agent outcome, final agent message
  preview, changed-file count and capped filenames, validation summary/output
  preview, run/log references when available, and existing compatibility
  evidence labels. Until the Queue UI renders the authoritative aggregate/
  evidence DTO directly, frontend-only evidence labels are transitional and not
  product truth.
- Explicit review actions are wired through the Action Broker dependency where
  available: create review message, acknowledge review, approve validation,
  add follow-up prompt, mark done, mark failed, block, refresh evidence, and
  lifecycle reads.
- If the broker dependency is unavailable, the UI shows compact unavailable
  state and does not fake success.
- Follow-up prompt and fail/block inputs are small bounded text inputs with
  required-field validation.
- The section does not run validation, call Git, attach a real commit, execute
  rollback, launch Terminal, call shell/Codex, start workers, auto-start
  dependents, auto-create review messages, auto-ACK, auto-mark done, create a
  duplicate Queue view, persist validation/commit/follow-up/mark-done/fail/
  block state, redesign the Queue board/cards, or add Finder/Knowledge
  behavior.

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

- Actual live `dependency_acceptance_smoke` /
  `dependency_failure_smoke` smoke execution from the desktop Workspace Agent
  session. The discovery/control/invocation foundation is implemented:
  `workspace.context.get` reads current workspace/workbench/root context from
  live renderer state, `workbench.widgets.list` lists bounded widget instances
  and discovers Agent Executor widgets only by `definitionId === "agent-run"`,
  `queue.control.get` reads backend Queue control state through the Queue
  control bridge, `queue.control.setManualEnabled` sets only backend Queue
  control state to `manual_enabled`, and structured `hobit.workflow.request`
  invokes supported Queue workflow phases through the existing
  QueueWorkflowRunner runtime adapter. Workspace Agent can also read Queue
  workflow debug state through `queue.workflow.get`, `queue.workflow.list`,
  `queue.workflow.getReport`, `queue.workflow.planResume`, and
  `queue.workflow.readActionLog`; these are bounded read-only broker
  capabilities over existing backend/Tauri workflow run, report, resume plan,
  and action-ledger APIs. `queue.workflow.invoke` is intentionally not
  implemented, and `hobit.workflow.request` remains the only workflow
  invocation path. Codex shell still cannot perform live smoke without the
  live Tauri renderer/IPC context. Actual live Queue smoke remains the next
  step after the registry-consistent discovery/control/debug surface.
- durable backend Smart Queue persistence;
- Queue workflow runner execution beyond the full typed
  `dependency_acceptance_smoke` and `dependency_failure_smoke` paths and the
  existing explicit create/setup/start, worker-evidence, read/review/
  finalization helper phases;
- Queue-specific input validation for review/terminal workflows;
- durable Queue lifecycle transition commands beyond the current aggregate DTO,
  worker-evidence/review create/ACK commands, and accepted-completion /
  terminal-failure finalization commands;
- backend scheduler/runner ownership;
- durable attempt persistence;
- durable coordinator decision persistence;
- durable dogfood lifecycle persistence;
- broad automatic real worker result event integration with the dogfood
  lifecycle model;
- durable Queue review decision persistence beyond message create/ACK;
- broad dogfood lifecycle restart recovery beyond the hardened
  `dependency_acceptance_smoke` / `dependency_failure_smoke` workflow
  persistence, durable worker evidence, and durable review message/ACK ledger;
- full Queue review/evidence UI redesign or polish;
- real validation evidence execution or durable attachment to the dogfood
  lifecycle model;
- real commit execution or durable commit metadata attachment;
- actual rollback execution;
- Workspace Agent runtime auto-call;
- Git/file mutation actions;
- Terminal launch/actions;
- remote/server/enterprise queue runtime;
- broad backend migrations or storage schema changes beyond the current narrow
  worker evidence, review message, and workflow run/action ledger tables.

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

1. Design durable backend persistence for attempts, lifecycle decisions,
   validation evidence, and commit metadata.
2. Design backend scheduler/runtime ownership.
3. Integrate real worker reports, validation evidence, and explicit commit
   approval/results with the dogfood lifecycle model.
4. Add safe Workspace Agent handoff integration.
5. Design rollback execution only after the approval/safety contract is ready.

Queue-linked Direct Work completion evidence wiring is now available only for
explicit Queue handoffs or Queue-owned run links with matching final Agent
Executor run detail. Worker evidence is durable through the backend worker
evidence ledger; broader lifecycle restart recovery, real validation evidence
execution, and real Git commit execution remain separate later blocks. Broad
Queue UI polish is not the blocker for proving the current fake broker loop.

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
- `apps/desktop/frontend/src/workbench/queue/queueV2DraftReadiness.ts`

## Guardrails

- Do not implement durable scheduler/runtime behavior from the pure models
  alone.
- Do not add a second Queue product surface through WidgetV2 Queue paths.
- Do not make Workspace Agent the owner of Queue lifecycle decisions.
- Do not treat prompt-pack materialization as an execution trigger.
- Do not collapse Waiting dependency and Blocked into one state.
- Do not touch Finder for Smart Queue implementation work unless a future task
  explicitly scopes Finder.
