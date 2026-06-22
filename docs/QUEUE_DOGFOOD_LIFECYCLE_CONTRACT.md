# Queue Dogfood Lifecycle Contract

## Purpose

This contract defines the Queue dogfooding lifecycle boundary. The older
frontend pure model still separates Queue ticket state from agent/prompt state
for transitional UI and self-test flows, while backend/domain Queue aggregate
review command contracts now own durable worker evidence, review-message
preconditions, review message/ACK state, accepted completion, and terminal
failure decisions.

Queue backend ownership is governed by
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`. If this document and the ownership
contract conflict, use the ownership contract for Queue backend/API/UI truth
boundaries.
Queue action phases, risk classes, structured confirmation, typed
`nextAction`, auto-continuation, and bounded grant policy are governed by
`docs/QUEUE_WORKFLOW_ORCHESTRATION_CONTRACT.md`.

This contract does not add full backend lifecycle durability, real worker
execution, scheduler redesign, Git commit execution, rollback execution,
Terminal launch, Finder behavior, or natural-language prompt routing. The
backend/domain `QueueItemAggregate` read model is the authoritative durable read
path over existing Queue task rows, run links, dependencies, worker evidence
bundle rows, and review message ledger rows. The backend now persists Queue
worker evidence, review messages, ACK state, and accepted-completion
decisions, and terminal-failure decisions; validation decisions, commit
decisions, block, and scheduler
state remain later work.

## Status

Current as a frontend pure model foundation plus backend/domain aggregate and
review command MVP plus backend worker evidence command/query MVP. The frontend
controller/view-model adapter, worker evidence bundle model, ingestion bridge,
Queue-linked Direct Work metadata seam, and broker-driven fake dogfooding
self-test remain transitional. The backend owns `queue.lifecycle.agentFinished`,
`queue.review.getEvidenceBundle`, `queue.review.createMessage`, and
`queue.review.ack`, `queue.item.markDone`, and `queue.item.fail` for Workspace
Agent bridge paths through typed Tauri commands.

The implemented model and adapter layer live under:

- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle*.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycleController.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
- `apps/desktop/frontend/src/workbench/queue/queueReviewEvidence*.ts`
- `apps/desktop/frontend/src/workbench/queue/details/AgentQueueTaskReviewEvidenceSection.tsx`
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts`
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.ts`
- `apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`

The frontend lifecycle model is not the authoritative runtime Queue lifecycle.
The controller/view-model adapter remains an overlay for frontend Queue
controller helpers, QueueV2 presentation, fake lifecycle tests, evidence
bundle reads, and lifecycle commands that have not moved to backend/domain yet.
`queue.lifecycle.agentFinished`, `queue.review.getEvidenceBundle`,
`queue.review.createMessage`, `queue.review.ack`, `queue.item.markDone`, and
`queue.item.fail` no longer use that overlay as product truth in the Workspace
Agent bridge path.

Backend/domain aggregate and review command foundation:

- `crates/hobit-app/src/workspace_service/agent_queue_aggregate.rs` builds a
  `QueueItemAggregate` from durable Queue task rows, dependency ids, latest
  Queue run links, available widget run summary metadata, and latest durable
  Queue review message rows.
- `crates/hobit-app/src/workspace_service/agent_queue_review.rs` owns backend
  create/ACK review command preconditions from the aggregate and persists the
  review message ledger.
  `queue.review.createMessage` returns typed backend-owned blockers instead of
  generic frontend failures when a message cannot be created. Blockers include
  ticket, worker-run, review, and evidence states, duplicate-message state,
  required-field state, selected run/evidence ids when known, and a next
  suggested capability when available.
- `crates/hobit-app/src/workspace_service/agent_queue_worker_evidence.rs`
  owns backend worker-finished/evidence command preconditions, requires
  explicit workspace/task/run identity, rejects run links for other tasks, and
  persists durable worker evidence bundles.
- `crates/hobit-app/src/workspace_service/agent_queue_completion.rs` owns the
  backend accepted-completion command. It requires explicit workspace/task
  identity, trusted actor id, exact structured confirmation, durable completed
  worker evidence, a durable ACKed review message, and aggregate preconditions
  before persisting the completion decision.
- `crates/hobit-app/src/workspace_service/agent_queue_failure.rs` owns the
  backend terminal-failure command. It requires explicit workspace/task
  identity, trusted actor id, exact structured confirmation, visible reason,
  durable worker evidence, a durable ACKed review message, and aggregate
  preconditions before persisting the failure decision. Worker failure evidence
  alone is not terminal task failure.
- `apps/desktop/src-tauri/src/agent_queue_aggregate_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_aggregate_commands.rs` expose
  read-only aggregate list/get commands to the desktop bridge.
- `apps/desktop/src-tauri/src/agent_queue_review_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_review_commands.rs` expose typed
  review create/ACK commands to the desktop bridge.
- `apps/desktop/src-tauri/src/agent_queue_worker_evidence_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_worker_evidence_commands.rs` expose
  typed worker-finished/evidence read commands to the desktop bridge.
- `apps/desktop/src-tauri/src/agent_queue_completion_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_completion_commands.rs` expose typed
  accepted-completion commands to the desktop bridge.
- `apps/desktop/src-tauri/src/agent_queue_failure_dto.rs` and
  `apps/desktop/src-tauri/src/agent_queue_failure_commands.rs` expose typed
  terminal-failure commands to the desktop bridge.
- `crates/hobit-app/src/workspace_service/agent_queue_headless_contract_tests.rs`
  proves the backend/domain contract headlessly through `WorkspaceService` and
  storage fixtures, without launching the frontend.
- `apps/desktop/src-tauri/src/agent_queue_aggregate_commands/tests.rs` proves
  the Tauri list/get commands serialize the authoritative aggregate DTO and
  remain read-only without starting workers.
- The aggregate treats raw `task.status` as legacy input, not final product
  truth. A successful worker completion maps to `awaiting_review`, not `done`.
  Dependency satisfaction is not granted by worker completion alone.
- Worker completion maps to `awaiting_review` with available
  `create_review_message`; review-message creation maps to
  `review_message_created` with available `ack_review`; ACK maps to
  `in_review` with available `mark_done`. Worker completion and ACK still do
  not mean `done`; only the backend accepted-completion command does.
- Where validation/commit durability is not implemented, the aggregate returns
  honest `not_durable`, `unknown`, or unavailable next-action reasons instead
  of reading frontend overlays. Worker evidence is durable when recorded
  through the backend worker evidence command.
- Workspace Agent / broker read wiring for `queue.items.list` and
  `queue.lifecycle.get` now uses this aggregate DTO through the typed frontend
  bridge. Workspace Agent / broker worker finished, evidence read, review
  create, ACK, accepted completion, and terminal failure now call typed
  backend/Tauri commands.
  Queue UI rendering
  migration to the aggregate DTO remains a later phase, and the frontend overlay
  remains transitional compatibility behavior for validation, follow-up,
  and block lifecycle capabilities until durable commands exist.
- Queue run-control next-action selection reads backend-owned Queue control
  state through the typed Workspace Queue bridge. `disabled` surfaces
  `queue_disabled` / `Queue disabled.` and `nextSuggestedCapability:
  "queue.enable"`; `manual_enabled` is a manual/no-autodispatch control state.
  `queue.item.startRun` remains an explicit command that rejects disabled
  Queue state and never auto-enables.
- Queue worker start has a backend-owned idempotency/control contract for
  workflow start phases. Workflow-owned starts must provide explicit
  workflow/action/task/executor/settings refs and exact confirmation; backend
  start records/reads a `start_worker` workflow action row, returns an existing
  run for duplicate same-key/same-ref starts, conflicts on same-key/different
  refs, and blocks ambiguous orphan windows instead of silently starting a
  second worker. This does not record worker evidence, call
  `queue.lifecycle.agentFinished`, ACK reviews, mark done/fail/block/follow-up,
  run validation/Git/rollback/Terminal, or auto-start downstream tasks.
- Queue workflow setup now has backend-owned idempotent run-settings and
  promote actions for already materialized workflow slots. Run-settings setup
  applies explicit typed task settings and executor assignment, persists
  `settingsHash` and `update_run_settings` action refs, and accepts only
  manual execution policy in this MVP. Promotion records `promote_task` refs
  and moves a matching configured draft task to queued, or treats already
  queued/ready as idempotent only when typed hashes match. These setup actions
  do not start workers, create run links, satisfy dependencies, call
  `queue.lifecycle.agentFinished`, record evidence, ACK reviews, mark
  done/fail/block/follow-up, run validation/Git/rollback/Terminal, or
  auto-start downstream tasks.
- Queue create/setup/start workflow execution now exists for dependency smoke
  workflows through typed runtime-adapter ports. It materializes explicit
  upstream/downstream slots, applies upstream run settings, promotes upstream,
  verifies backend `manual_enabled`, starts only the explicit upstream worker
  with workflow start context, persists report/action summaries, and pauses at
  `awaiting_worker_completion` / `worker_running`. It does not record evidence,
  call `queue.lifecycle.agentFinished`, review/ACK, mark done/fail/block/
  follow-up, run validation/Git/rollback/Terminal, schedule workers, or
  auto-start downstream.
- Queue workflow worker-evidence recording now exists as the next dependency
  smoke phase after explicit upstream worker completion. It resumes only from
  typed workflow continuation input with exact `workflowRunId`, `slot:
  "upstream"`, `taskId`, `runId`, bounded worker outcome/summary data, and the
  workflow action idempotency key
  `workflowRunId:record_worker_evidence:slot:taskId:runId` unless an equivalent
  exact key is supplied. It reconciles existing matching durable evidence as
  idempotent success, persists `evidenceBundleId` and bounded final worker
  status in the workflow state/action ledger, and stops at `awaiting_review`.
  It does not create/ACK review messages, mark done/fail/block/follow-up, run
  validation/Git/rollback/Terminal, schedule workers, start downstream, or
  infer task/run/evidence ids from prose/UI/session state.
- Queue capability result mappers now emit typed `nextAction` payloads when a
  follow-up can be built with known canonical target fields. The runtime must
  prefer `nextAction.capabilityId` plus `nextAction.input` and must not guess
  from `nextSuggestedCapability` alone. `nextSuggestedCapability` remains
  compatibility context and must agree with `nextAction.capabilityId` when both
  are present.

The backend aggregate is now the authoritative Queue read model for durable
task/run-link/dependency/worker-evidence/review-message inspection and
Workspace Agent/Broker read, worker-finished, evidence-read, review create, and
ACK, and accepted-completion capabilities. Queue correctness for those states
is testable with Rust backend and Tauri command tests without opening or
launching the frontend.
Queue UI must later render this authoritative DTO and send typed commands only;
frontend overlays must not become product truth.

## State Dimensions

Ticket state and agent/prompt state are separate.

Ticket states:

- `draft`
- `queued`
- `blocked`
- `running`
- `awaiting_review`
- `in_review`
- `done`
- `failure`

Agent/prompt states:

- `idle`
- `running`
- `completed`
- `not_completed`
- `failed`
- `additional_prompt_running`

Agent outcome/review outcome values are:

- `completed`
- `not_completed`
- `failed`

A completed agent prompt is review evidence only. It does not make the ticket
done.

ACK is also not done. A Queue task becomes done only after an explicit backend
accepted-completion command with exact structured confirmation and valid
backend aggregate preconditions.

Review ACK input uses `messageId`, not `reviewMessageId`. When backend review
message creation reports `review_message_already_exists`, its
`existingMessageId` is mapped to `nextAction.input.messageId` for
`queue.review.ack`. ACK success may expose a read-only
`queue.lifecycle.get` next action, but it must not imply or auto-run
`queue.item.markDone`.

## Review Lifecycle

The model supports:

- `running` plus agent completed -> `awaiting_review`
- `running` plus agent not completed -> `awaiting_review`
- `running` plus agent failed -> `awaiting_review`
- review message from Queue item to coordinator
- coordinator ACK of that message
- ACK transition from `awaiting_review` to `in_review`

The MVP deliberately sends failed agent outcomes to review instead of directly
failing the ticket. Terminal ticket failure requires an explicit coordinator
decision.

Review message records include:

- message id
- task id
- attempt id when available
- source Queue item id
- target coordinator agent id
- review outcome
- final agent message
- validation summary when available
- changed files summary when available
- frontend worker evidence summary when available
- normalized frontend worker evidence bundle when available
- created timestamp

ACK records include:

- ACK id
- message id
- coordinator agent id
- received timestamp

ACK fails when the ticket is not awaiting review, when the message is missing,
or when the message target does not match the task/coordinator.

## Coordinator Decisions

The pure model records coordinator decision placeholders for:

- approve validation
- request commit
- attach commit result
- mark done
- add follow-up prompt
- return to running with added prompt
- block task
- fail task

These records are model state only. They do not call Workspace APIs, workers,
Codex, shell, Git, Terminal, rollback, or storage.

## Worker Evidence Bundle

The frontend worker evidence bundle model can normalize structured output from
existing frontend run/result shapes or fake worker reports into Queue lifecycle
input. It is an adapter shape, not product truth. The authoritative product
state is the backend durable worker evidence bundle recorded by
`queue.lifecycle.agentFinished` and read by `queue.review.getEvidenceBundle`.
The adapter shape can carry task, attempt, run, thread, worker, provider,
started and completed timestamps, outcome, final agent message, changed-file
evidence, validation summary/output/exit code, failure or stuck reason, log
reference, and raw provider summary when those fields are available.

The implemented outcome values map directly to lifecycle review outcomes:

- `completed`
- `not_completed`
- `failed`

Bundle validation is pure frontend validation:

- `completed` requires a final agent message or final report equivalent.
- `failed` requires a failure reason or final agent message.
- `not_completed` requires a final agent message or stuck reason.
- changed-file evidence and validation output previews are bounded for display.
- missing thread id, worker id, and provider id are accepted.
- missing run id is accepted only for pure frontend normalization; real
  backend-backed `queue.lifecycle.agentFinished` requires explicit `taskId` and
  `runId`, either as top-level fields or in the evidence bundle.
- task id mismatch between action input and evidence bundle is invalid.
- attempt id mismatch is invalid when both are supplied.

Product-facing bundle summaries use labels such as `Agent completed`, `Agent
did not complete`, `Agent failed`, `N changed files`, `Validation passed`,
`Validation failed`, `Validation not run`, `Final report available`, `Logs
available`, and durable backend evidence/readiness labels. Legacy transitional
frontend-only paths may still display `Frontend evidence only - not durable`,
but Workspace Agent/Broker evidence reads must use the backend evidence query
as product truth.

This frontend model is not backend durability and is not evidence execution.
It does not read the filesystem, start Direct Work, call Codex, call shell, run
validation, inspect Git, execute commits, launch Terminal, start Queue workers,
or persist evidence. Persistence happens only through the typed backend worker
evidence command.

## Worker Evidence Ingestion Bridge

`apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
is the frontend ingestion bridge from an explicitly Queue-linked worker,
Direct Work, Workspace Agent, Agent Executor, or Queue worker report
completion shape into the typed Action Broker lifecycle path.

The bridge:

- requires an explicit `taskId` Queue link;
- never infers `taskId` from prompt text, final-message text, file paths, task
  title, or other natural-language content;
- builds or normalizes a `QueueWorkerEvidenceBundle`;
- validates task id, run id, attempt id, outcome, and final report/evidence
  requirements before broker invocation;
- invokes only `queue.lifecycle.agentFinished` through the Action Broker when
  broker dependencies are available;
- supports dry-run preview without lifecycle mutation;
- returns a structured ingestion result that preserves broker status and
  exposes product-facing labels such as `Queue worker evidence ingested`,
  `Queue item awaiting review`, `Queue evidence ingestion failed`, and `Queue
  evidence ingestion skipped`.

Successful real ingestion calls the backend/domain worker evidence command via
the broker bridge. It requires explicit `taskId` and `runId`, stores durable
worker evidence, updates backend aggregate worker/review readiness, and leaves
the Queue item not done. The evidence is then readable through the backend
`queue.review.getEvidenceBundle` query, and an explicit later
`queue.review.createMessage` can include a bounded evidence summary.

The bridge does not auto-create review messages, ACK review messages, approve
validation, mark done, fail or block tickets, start dependents, start workers,
run validation, run Git/commit commands, execute rollback, launch Terminal,
call shell/Codex, create Queue views, or persist validation/commit/follow-up/
mark-done/fail/block state.

Broad automatic real worker event wiring is not implemented in this bridge.
Existing controller/runtime code must call the bridge only when a run carries
an explicit Queue task link.

## Queue-Linked Direct Work Metadata Seam

`apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts` defines
the frontend-only metadata seam for Queue-launched Direct Work. It carries the
explicit Queue item id, Direct Work run id, Agent Executor widget id, optional
future attempt id, handoff source, linked/completed timestamps where available,
and a current-session idempotency key for Queue-linked evidence event wiring.

The seam is populated from the existing Queue-to-Direct-Work handoff path and
finalization checks can compare the handoff with Agent Executor run detail or
final stream events. Mismatched run ids, missing Queue item ids, missing run
ids, and missing executor widget ids are rejected as structured non-ingestion
states.

The idempotency key is derived only from explicit link fields: workspace id
when available, Queue item id, run id, and attempt id when available. It never
uses prompt text, task title, repository path, final agent message, changed
files, validation output, or other natural-language content.

This seam does not call the evidence ingestion bridge, does not call
`queue.lifecycle.agentFinished`, does not move a Queue item to
`awaiting_review`, and does not create review messages. It does not add backend
durability, SQLite schema, Tauri/IPC behavior, worker execution changes,
validation execution, Git/commit execution, rollback execution, Terminal
launch, or natural-language prompt routing.

## Queue-Linked Direct Work Evidence Event Wiring

`apps/desktop/frontend/src/workbench/queueLinkedDirectWorkEvidenceWiring.ts`,
`apps/desktop/frontend/src/workbench/useCodexDirectWorkQueueHandoff.ts`, and
the active Queue run-metadata hook define the first automatic Queue worker
evidence event wiring paths.

The wiring is current-session frontend/controller wiring only. It runs only
for Queue-started Direct Work handoffs that have a valid explicit
Queue-linked completion identity and matching final `AgentExecutorRunDetail`.
It requires:

- Queue item id;
- Direct Work run id;
- Agent Executor widget id;
- valid finalization identity;
- matching Agent Executor run detail run id;
- final Agent Executor run detail status;
- current-session idempotency key from the Queue-linked metadata seam;
- an injected ingestion callback backed by the existing ingestion bridge.

The mutation path remains:

```text
Queue-linked Direct Work completion -> evidence ingestion bridge -> Action Broker -> queue.lifecycle.agentFinished
```

The wiring builds evidence from `AgentExecutorRunDetail` plus Queue-linked
metadata and passes available run/thread/worker/final-message/changed-files/
validation/log-reference fields to the bridge. Successful ingestion moves the
linked frontend lifecycle overlay to `awaiting_review` and keeps evidence
available for explicit `queue.review.getEvidenceBundle` and later explicit
`queue.review.createMessage`.

Queue-owned Direct Work starts, where the Agent Queue widget is the Direct Work
owner, reconcile through the selected task's latest run link and final
`AgentExecutorRunDetail`. That path builds the same explicit Queue-linked
handoff identity from stored run-link fields and only ingests when the run id,
Queue item id, executor widget id, and final detail match.

The wiring is idempotent only for the current UI session. Repeated final stream
events, recovered final detail, or rerendered final notifications for the same
Queue item/run key do not call the bridge twice. Different explicit run ids or
Queue item ids can ingest independently. Failed bridge attempts are not
automatically retried in this block; that avoids duplicate completion handling
until durable retry policy exists.

The wiring does not ingest raw Workspace Agent final events, raw Direct Work
final events without Queue metadata, Agent Activity events, or standalone Agent
Executor history. It does not infer task id from prompt text, task title, final
message, repository path, changed files, validation output, or other
natural-language content.

The wiring does not auto-create review messages, ACK review, approve
validation, mark done, start dependents, start workers, run validation, run
Git/commit commands, execute rollback, launch Terminal, call shell/Codex,
create Queue views, or persist validation/commit/follow-up/mark-done/fail/
block state.

## Minimal Queue Review/Evidence Surface

The active Queue product route now has a minimal details Result-tab section for
dogfood review/evidence. It is intentionally bounded and does not redesign the
Queue board, global task cards, sidebar, popup system, Agent Activity,
Workspace Agent transcript, Finder, or Knowledge / Skills.

The section renders only when review/evidence state is relevant: frontend
worker evidence exists, a linked item is awaiting review or in review, a
dogfood lifecycle overlay exists, or a follow-up prompt is running. It shows
product-facing labels such as `Awaiting review`, `In review`, `Done`, `Failed`,
`Agent completed`, `Agent did not complete`, `Agent failed`, `Evidence
available`, `Waiting for coordinator review`, and `Follow-up prompt running`.
It caps final agent messages, changed-file previews, and validation output
previews. It does not render raw lifecycle enum names, raw huge JSON, or huge
logs inline.

The section uses typed Action Broker capabilities for explicit review actions
where the broker dependency is injected into the current Queue surface:

- `queue.review.createMessage`
- `queue.review.ack`
- `queue.coordinator.approveValidation`
- `queue.coordinator.addFollowUpPrompt`
- `queue.item.markDone`
- `queue.item.fail`
- `queue.item.block`
- `queue.review.getEvidenceBundle`
- `queue.lifecycle.get`

If broker access is unavailable, the section shows a compact unavailable state
instead of fake-working buttons or fake success. Follow-up prompts and fail/block
reasons require bounded explicit text.

This UI remains frontend-only/current-session overlay behavior. It does not add
backend durability, restart recovery, schema changes, validation execution, Git
commit execution, rollback execution, hidden worker start, hidden dependent
start, auto-ACK, auto-review-message creation, auto-done, task id inference, or
natural-language product-action routing.

## Follow-Up Prompts

Follow-up prompt records include:

- follow-up prompt id
- task id
- parent attempt id when available
- thread id when available
- prompt text
- coordinator agent id
- created timestamp

Adding a follow-up prompt from `in_review`:

- preserves the original prompt
- appends the follow-up prompt record
- increments `additionalPromptCount`
- sets agent/prompt state to `additional_prompt_running`
- returns ticket state to `running`
- does not start a worker by itself

## Validation And Commit Placeholders

The legacy frontend model can record:

- validation approval
- commit request
- fake commit result

Those placeholders are not authoritative product completion. Backend
`queue.item.markDone` does not execute validation or Git, does not require a
fake commit placeholder, and leaves validation and commit state unchanged.
Accepted completion is the durable backend completion decision.

Commit result attachment is model-only and includes `noGitMutationPerformed:
true`. It does not run Git and does not create a commit.

## Dependency Done Gate

Dependent tasks can start only when every upstream dependency has reached the
accepted ticket state `done`.

The following are not enough to unblock a dependent task:

- agent prompt completed
- ticket awaiting review
- ticket in review
- review ACKed
- validation approved without done
- commit result attached without done

The backend aggregate read model applies this gate from durable accepted
completion decisions. It exposes dependency states `none`, `ready`, `waiting`,
`blocked`, `failed_upstream`, and `unknown`. `waiting`, `blocked`,
`failed_upstream`, and `unknown` surface dependency blockers and do not expose
`start_run` or runnable `promote_draft` next actions. A workflow-promoted
downstream task remains blocked by this gate until upstream accepted
completion exists. After upstream
`queue.item.markDone` succeeds, downstream re-query clears that dependency
blocker and exposes the downstream task's own next action, such as updating run
settings or starting only after Queue enablement and explicit start
preconditions. After upstream `queue.item.fail` succeeds, downstream re-query
reports `failed_upstream` from the durable failure decision ledger and does not
expose a runnable next action.

Workspace Agent dependency smoke must use typed create actions, not UI state:
create upstream task A, read the returned task id, then create downstream task B
with `dependsOn: [A taskId]`. `queue.createItem` and `queue.createItems` accept
only explicit dependency task id arrays. They must not infer dependencies from
create order, title, prompt text, or prose. Intra-batch dependency references to
newly created ids are not a stable public contract in this block.

Backend scheduler dependency enforcement remains a later runtime concern;
frontend compatibility overlays may only mirror this rule and must not become
product truth. No downstream task auto-starts from dependency unblocking.

## Frontend Controller And View-Model Adapter

The frontend adapter layer can:

- create or derive a dogfood lifecycle overlay for an existing Queue task
  without renaming or removing the legacy task status;
- apply model transitions for agent completion, coordinator ACK, validation
  approval, fake commit result attachment, block, and follow-up prompt
  decisions;
- answer whether the item is awaiting review, in review, done-gated for
  dependents, or running a follow-up prompt;
- expose `additionalPromptCount` and review outcome for presentation;
- map dogfood lifecycle states into QueueV2 view-model lifecycle and
  human-status presentation when an explicit lifecycle overlay is supplied;
- use the existing Smart Queue dependency propagation model so dependents stay
  blocked until upstream accepted completion.

This adapter does not persist lifecycle state, start workers, call Codex or
shell, launch Terminal, mutate Git, execute rollback, call Tauri/IPC, or change
real scheduler/runtime semantics.

## Action Broker Capabilities

The frontend Action Broker can expose the dogfood lifecycle through structured
`hobit.action.request` envelopes. Supported typed capability ids are:

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

`queue.lifecycle.get` requires an explicit `taskId`, reads the backend/Tauri
authoritative aggregate DTO, and returns ticket/worker/review/evidence/
validation/commit/dependency states, blockers, nextActions, latestRun,
evidenceSummary, durable flags, and `authoritativeBackendAggregate=true`.

`queue.review.createMessage` and `queue.review.ack` require explicit task
identity and call backend/domain/Tauri review commands through the typed
Workspace Agent queue bridge. The model does not need to invent
`coordinatorAgentId`; the bridge injects a trusted actor id from Workspace
Agent/request context and falls back to `workspace-agent` only when no stronger
context id exists. Backend aggregate preconditions decide whether review create
or ACK is allowed. Results include the durable message id, backend review
state, blockers, nextActions, selected run/evidence ids when applicable, and
updated aggregate state. Review-create failures return typed blockers with
backend aggregate states; broker and Tauri layers must not collapse them to a
generic failure. Duplicate review-create blockers that include
`existingMessageId` expose product status `already_exists` and a typed
`nextAction` for `queue.review.ack` with `input.messageId` set to that existing
message id.

`queue.item.markDone` requires explicit `taskId` plus top-level
`confirmationToken="operator-confirmed"` after explicit operator confirmation.
The broker injects trusted actor id from runtime/request context and calls the
backend/Tauri accepted-completion command. It succeeds only when the backend
aggregate proves completed worker evidence is durable, a review message exists
and has been ACKed, the task is in review, dependencies do not forbid
finalization, and the task is not already failed/running/draft/queued. Prose
confirmation is insufficient. Success returns `ticketState=done`,
`reviewState=done`, `workerRunState=completed`, `evidenceState=available`,
`nextSuggestedCapability=null`, and durable completion state. Blocked results
surface typed backend blockers and aggregate state. Success emits no
`nextAction` by default. Blocked finalization may point only to safe
read-only inspection when helpful; it must not auto-provide confirmation,
auto-run ACK, validation, Git, rollback, Terminal, shell, Codex, or workers.

`queue.item.fail` requires explicit `taskId`, visible `reason`, and top-level
`confirmationToken="operator-confirmed"` after explicit operator confirmation.
The broker injects trusted actor id from runtime/request context and calls the
backend/Tauri terminal-failure command. Optional `runId`, `evidenceBundleId`,
`messageId`, and `reviewMessageId` are validation guards only. It succeeds only
when the backend aggregate proves durable worker evidence exists, a review
message exists and has been ACKed, the task is in review, and the task is not
already done, already failed, running, draft, or queued. Worker failure evidence
alone and review ACK alone do not mark terminal failure. Success returns
`ticketState=failure`, `reviewState=failed`, durable failure state, and no
next suggested capability. Blocked results surface typed backend blockers and
aggregate state. Success emits no `nextAction`; it must not auto-run follow-up,
validation, Git, rollback, Terminal, shell, Codex, workers, or downstream work.

The remaining transitional lifecycle decision capabilities validate structured
inputs, enforce broker policy, support dry-run previews, return compact
lifecycle results, and emit compact activity/audit labels. They are not
durable product truth until backend/domain commands exist.

Workspace Agent can now continue across multiple frontend broker actions by
feeding compact structured `hobit.action.result` context back into the same
Codex thread after eligible successful results. Continuation remains
structured-action-only: the model emits one `hobit.action.request` envelope at
a time, never action lists, and must prefer a validated `nextAction` payload
when present. The model must not rename `nextAction.input` fields and must not
guess ids or actions from `nextSuggestedCapability` alone. A user/operator can
grant bounded Queue autonomy only with structured JSON
`type: "hobit.queue.autonomyGrant"`; prose such as "go" or "I confirm" is not
a grant. Inside a valid grant, the loop may follow typed `nextAction` through
the grant's risk-class mode, capability allow/deny intersection, exact
confirmation token, and action budget. The grant does not move Queue truth to
the frontend: backend aggregate preconditions remain authoritative, and
dependency waiting, failed upstream, invalid input, or policy blockers still
stop continuation. The loop is capped and stops on confirmation-required
without an exact grant token, policy-blocked, unavailable, dry-run-required,
failed, invalid-input, repeated request id, repeated capability/input,
unsupported envelope, restricted capability, max action count, or missing
same-thread continuation state. It does not infer task ids or executor ids
from prose and does not add validation execution, Git/commit execution,
rollback execution, Terminal, shell, Codex, delete, downstream auto-start, or
scheduler behavior. Transitional validation, follow-up, and block capabilities
remain blocked for bounded autonomy.

`queue.lifecycle.agentFinished` requires explicit task and run identity. The
model may provide `taskId` and `runId` as top-level fields or inside a
structured evidence bundle, but the broker must reject missing ids and must not
infer them from prompt text, task title, final message, repository path, or
file paths. Valid evidence can supply outcome/status, final agent message,
validation summary text, error summary, changed-file summary, source, and
worker id to the backend worker evidence command. Task id, run id, attempt id,
outcome, and thread id mismatches are rejected. Invalid evidence returns
`invalid_input`. Dry-run previews the backend aggregate transition without
storing evidence.

`queue.review.createMessage` may pass a bounded final agent/evidence summary
as review message body, but the backend owns the persisted message row and
precondition. Durable backend worker evidence is required. `evidenceBundleId`
is not required; when omitted, the backend selects the latest durable evidence
for the explicit `taskId` and optional exact `runId`, validates any supplied
exact `runId`/`evidenceBundleId`, and returns the selected evidence bundle id.
The model must not invent run or evidence ids and must not infer them from
prose. `queue.review.getEvidenceBundle` requires explicit `taskId`, accepts
optional `runId`, calls the backend/domain evidence query, and returns durable
evidence state, bundle id, run id, outcome, summary, blockers, nextActions, and
the latest aggregate when available. Missing durable evidence is reported as
`no_evidence` or `not_found`; the Workspace Agent/Broker path does not read
frontend/controller evidence overlays as product truth.

Dry-run:

- previews the intended lifecycle transition;
- does not mutate lifecycle overlay state;
- does not create backend review messages or ACK review messages;
- does not mark done, blocked, or failed;
- does not start workers, run validation, call Git, launch Terminal, execute
  rollback, call shell, or call Codex.

Real invocation for backend-backed worker finished/evidence read:

- records or reads durable worker evidence through backend/domain/Tauri
  commands;
- requires explicit task identity, and `agentFinished` requires explicit run
  identity;
- validates that the task exists in the workspace and that the run link belongs
  to the task when run-link data exists;
- returns updated backend aggregate/evidence state;
- does not mark the Queue item done;
- does not run workers, run validation, execute a Git commit, launch Terminal,
  execute rollback, call shell, or call Codex.

Real invocation for backend-backed review create/ACK:

- persists only the review message/ACK ledger row through backend/domain/Tauri
  commands;
- returns updated backend aggregate state;
- does not run workers, run validation, execute a Git commit, launch Terminal,
  execute rollback, call shell, or call Codex.

Real invocation for backend-backed accepted completion:

- persists only the accepted-completion decision ledger row through
  backend/domain/Tauri commands;
- requires exact structured confirmation and trusted actor id;
- returns updated backend aggregate state with done/review done and no next
  suggested capability;
- does not run workers, run validation, execute a Git commit, launch Terminal,
  execute rollback, call shell, or call Codex.

Real invocation for backend-backed terminal failure:

- persists only the failure decision ledger row through backend/domain/Tauri
  commands;
- requires exact structured confirmation, trusted actor id, and visible reason;
- returns updated backend aggregate state with ticket failure/review failed and
  no next suggested capability;
- causes downstream dependency reads to report `failed_upstream`;
- does not run workers, run validation, execute a Git commit, launch Terminal,
  execute rollback, call shell, or call Codex.

Real invocation for remaining transitional lifecycle writes:

- mutates only the frontend/controller lifecycle overlay when the Queue bridge
  or injected lifecycle adapter can provide the current task;
- may attach model-only validation approval or follow-up/block metadata as
  required by the pure model;
- does not claim backend durability;
- does not run workers, run validation, execute a Git commit, launch Terminal,
  execute rollback, call shell, or call Codex.

No commit execution capability exists in this block. Any commit-like data is a
fake commit result placeholder with `noGitMutationPerformed: true`.

## Product Labels

Human-facing helpers return labels such as:

- Draft
- Queued
- Running
- Awaiting review
- In review
- Done
- Failed
- Agent completed
- Agent failed
- Agent did not complete
- N changed files
- Validation passed
- Validation failed
- Validation not run
- Final report available
- Logs available
- Frontend evidence only - not durable (legacy/transitional UI label only)
- Queue worker evidence ingested
- Queue item awaiting review
- Queue evidence ingestion failed
- Queue evidence ingestion skipped
- Queue-linked evidence event wiring available
- Raw non-Queue Direct Work ingestion is blocked
- Duplicate Queue-linked completion ingestion is guarded
- Follow-up prompt running
- Review acknowledged
- Waiting for coordinator review

Product UI should use these labels rather than raw enum names.

## Self-Test

The pure model and controller adapter include fake lifecycle self-test helpers
covering:

- create task
- queue task
- start run
- agent completes
- normalize worker evidence bundle
- create review message
- coordinator ACK
- approve validation
- request mark done and require backend accepted completion
- dependent startability only after accepted completion
- follow-up prompt branch returning the same item to running
- QueueV2/controller-level presentation for awaiting review, in review, done,
  and follow-up prompt states

The self-test asserts no Codex, shell, worker start, Terminal launch, Git
mutation, rollback execution, Workspace API call, or persistence side effects.
Broker adapter tests also cover lifecycle dry-runs, real frontend overlay
transitions, wrong-message ACK failure, validation approval placeholders,
follow-up prompt state, done-gated dependents, unavailable dependencies, and
Workspace Agent structured action-request invocation.

Queue lifecycle capability hardening is schema-first. Registered backend-backed
capabilities (`queue.lifecycle.get`, `queue.review.getEvidenceBundle`,
`queue.review.createMessage`, `queue.review.ack`,
`queue.lifecycle.agentFinished`, `queue.item.markDone`, and `queue.item.fail`)
list exact required ids and trusted
runtime/backend actor defaults in the manifest. The registered evidence read id
is `queue.review.getEvidenceBundle`; there is no lifecycle-namespaced evidence
read alias. Transitional lifecycle writes
(`queue.coordinator.approveValidation`, `queue.coordinator.addFollowUpPrompt`,
and `queue.item.block`) remain
frontend/controller overlay operations, are not auto-continuation safe, and do
not run validation, Git, rollback, Terminal, shell, Codex, or workers. Prose
confirmation and prose id mentions remain insufficient for any structured
capability call.

`apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
adds a full fake broker-driven dogfooding loop through the real Action Broker
and registered Queue lifecycle handlers. It uses a deterministic in-memory
frontend lifecycle/controller store and invokes:

- `queue.lifecycle.agentFinished`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.coordinator.approveValidation`
- `queue.item.markDone`
- `queue.item.fail`
- `queue.coordinator.addFollowUpPrompt`

The broker self-test verifies the main success path from agent finished to
awaiting review, review message creation, coordinator ACK to in review,
model-only validation approval, backend-required mark done unavailability in
the fake frontend store, and dependents staying gated without durable accepted
completion. It also verifies the follow-up branch returns the same item to
`running` with agent/prompt state
`additional_prompt_running` and increments `additionalPromptCount`, plus a
backend-required terminal failure boundary in the fake frontend store.

The main success path invokes `queue.lifecycle.agentFinished` with a fake
frontend worker evidence bundle instead of only loose final-agent fields. That
bundle includes task id, attempt id, thread id, completed outcome, final agent
message, changed files, validation summary/output preview, and a fake log
reference. The self-test asserts the broker consumes the bundle, the review
message includes the product-facing evidence summary, `queue.review.getEvidenceBundle`
returns the normalized frontend bundle when available, mark done still does not
execute Git or fake finalization, and dependent unblocking remains gated on
backend accepted completion.

`apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.test.ts`
adds a focused broker-ingestion test group for Queue-linked frontend
completion shapes. It proves dry-run immutability, real broker mutation to
`awaiting_review`, explicit task-link failures, task/attempt mismatch
failures, invalid evidence failures, unavailable controller handling,
Direct Work / Workspace Agent / Agent Executor / Queue worker report adapter
wrappers, explicit review-message evidence summary readback, non-linked Direct
Work skip behavior, done-gated dependents, and hidden-side-effect guards.

The broker self-test is explicitly fake/model/controller/broker-level only. It
reports backend durability for the fake store as skipped and real worker
execution, real validation execution, and real Git commit execution as
blocked/not covered. It
does not call Codex, shell, Terminal, Git, rollback, backend storage, Tauri/IPC,
or a real Queue worker, and it does not create duplicate Queue views or add
natural-language prompt routing.

## Non-Goals

This contract does not implement:

- full lifecycle backend durability beyond current aggregate, worker evidence,
  review message/ACK, and accepted-completion contracts
- broad SQLite migrations beyond current worker evidence, review, and
  completion ledgers
- Tauri or IPC APIs beyond current aggregate, worker evidence, review, and
  completion commands
- real worker execution changes
- broad automatic real worker result event integration
- scheduler redesign
- real validation execution changes
- durable validation evidence execution or persistence
- real Git commit execution
- rollback execution
- Queue UI redesign
- Finder integration
- natural-language regex routing
