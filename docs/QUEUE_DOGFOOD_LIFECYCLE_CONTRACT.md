# Queue Dogfood Lifecycle Contract

## Purpose

This contract defines the frontend pure model for the Queue dogfooding
lifecycle. It separates Queue ticket state from agent/prompt state so Hobit can
model review gates before later durability, worker, validation, and commit
integration blocks.

This contract does not add backend durability, SQLite schema, Tauri commands,
real worker execution, scheduler redesign, Git commit execution, rollback
execution, Terminal launch, Finder behavior, or natural-language prompt
routing.

## Status

Current as a frontend pure model foundation with frontend controller/view-model
adapter integration, typed frontend Action Broker capability access, a
frontend Queue worker evidence bundle model, a frontend Queue worker evidence
ingestion bridge, a Queue-linked Direct Work metadata seam, and a broker-driven
fake dogfooding loop self-test.

The implemented model and adapter layer live under:

- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle*.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycleController.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceBundle.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.ts`
- `apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts`

The model is not yet persisted and is not yet wired as the authoritative
runtime Queue lifecycle. The controller/view-model adapter is an overlay for
frontend Queue controller helpers, QueueV2 presentation, fake lifecycle tests,
and broker capability handlers. Broker capability execution mutates only this
frontend/controller overlay where dependencies are available.

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
input. It can carry task, attempt, run, thread, worker, provider, started and
completed timestamps, outcome, final agent message, changed-file evidence,
validation summary/output/exit code, failure or stuck reason, log reference,
and raw provider summary when those fields are available.

The implemented outcome values map directly to lifecycle review outcomes:

- `completed`
- `not_completed`
- `failed`

Bundle validation is pure frontend validation:

- `completed` requires a final agent message or final report equivalent.
- `failed` requires a failure reason or final agent message.
- `not_completed` requires a final agent message or stuck reason.
- changed-file evidence and validation output previews are bounded for display.
- missing run id, thread id, worker id, and provider id are accepted.
- task id mismatch between action input and evidence bundle is invalid.
- attempt id mismatch is invalid when both are supplied.

Product-facing bundle summaries use labels such as `Agent completed`, `Agent
did not complete`, `Agent failed`, `N changed files`, `Validation passed`,
`Validation failed`, `Validation not run`, `Final report available`, `Logs
available`, and `Frontend evidence only - not durable`.

This model is not backend durability and is not evidence execution. It does
not read the filesystem, start Direct Work, call Codex, call shell, run
validation, inspect Git, execute commits, launch Terminal, start Queue workers,
or persist evidence.

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
- validates task id, attempt id, outcome, and final report/evidence
  requirements before broker invocation;
- invokes only `queue.lifecycle.agentFinished` through the Action Broker when
  broker dependencies are available;
- supports dry-run preview without lifecycle mutation;
- returns a structured ingestion result that preserves broker status and
  exposes product-facing labels such as `Queue worker evidence ingested`,
  `Queue item awaiting review`, `Queue evidence ingestion failed`, and `Queue
  evidence ingestion skipped`.

Successful real ingestion moves the frontend/controller lifecycle overlay for
the linked running Queue task to `awaiting_review` and stores normalized
frontend-only evidence where the current controller supports it. The evidence
is then readable through `queue.review.getEvidenceBundle`, and an explicit
later `queue.review.createMessage` can include the bounded evidence summary.

The bridge does not auto-create review messages, ACK review messages, approve
validation, mark done, fail or block tickets, start dependents, start workers,
run validation, run Git/commit commands, execute rollback, launch Terminal,
call shell/Codex, create Queue views, or persist backend state.

Broad automatic real worker event wiring is not implemented in this bridge.
Existing controller/runtime code must call the bridge only when a run carries
an explicit Queue task link.

## Queue-Linked Direct Work Metadata Seam

`apps/desktop/frontend/src/workbench/queueLinkedDirectWorkMetadata.ts` defines
the frontend-only metadata seam for Queue-launched Direct Work. It carries the
explicit Queue item id, Direct Work run id, Agent Executor widget id, optional
future attempt id, handoff source, linked/completed timestamps where available,
and a current-session idempotency key for future ingestion wiring.

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

The model can record:

- validation approval
- commit request
- fake commit result

Done currently requires:

- ticket is `in_review`
- review outcome is `completed`
- validation has been approved
- a successful commit result placeholder is attached

Commit result attachment is model-only and includes `noGitMutationPerformed:
true`. It does not run Git and does not create a commit.

## Dependency Done Gate

Dependent tasks can start only when every upstream dependency has reached the
accepted ticket state `done`.

The following are not enough to unblock a dependent task:

- agent prompt completed
- ticket awaiting review
- ticket in review
- validation approved without done
- commit result attached without done

The frontend controller/view-model adapter can apply this gate to current Queue
task objects through a model overlay. This gate is currently frontend/model
logic only; backend scheduler dependency enforcement is not implemented.

## Frontend Controller And View-Model Adapter

The frontend adapter layer can:

- create or derive a dogfood lifecycle overlay for an existing Queue task
  without renaming or removing the legacy task status;
- apply model transitions for agent completion, coordinator ACK, validation
  approval, fake commit result attachment, done, block/fail, and follow-up
  prompt decisions;
- answer whether the item is awaiting review, in review, done-gated for
  dependents, or running a follow-up prompt;
- expose `additionalPromptCount` and review outcome for presentation;
- map dogfood lifecycle states into QueueV2 view-model lifecycle and
  human-status presentation when an explicit lifecycle overlay is supplied;
- use the existing Smart Queue dependency propagation model so dependents stay
  blocked until upstream dogfood `done`.

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

These capabilities are frontend/controller lifecycle capabilities only. They
validate structured inputs, enforce broker policy, support dry-run previews,
return compact lifecycle results, and emit compact activity/audit labels.

`queue.lifecycle.agentFinished` accepts the existing explicit fields and can
also accept an optional normalized or raw `evidenceBundle`. When evidence is
valid, it can supply `taskId`, `attemptId`, `threadId`, `outcome`,
`finalAgentMessage`, `validationSummary`, and `changedFilesSummary` to the
lifecycle transition. Explicit display fields may override bundle display
fields for the broker result and review handoff, but task id, attempt id,
outcome, and thread id mismatches are rejected. Invalid evidence returns
`invalid_input`. Dry-run with evidence previews the transition without
mutating lifecycle overlay state.

`queue.review.createMessage` can include the normalized evidence summary in
the review message when evidence is supplied. `queue.review.getEvidenceBundle`
returns the normalized frontend bundle stored in the fake/controller overlay
when one is available, and reports that the bundle is frontend-only and not
durable. Review message creation and evidence reads still work when no bundle
exists.

Dry-run:

- previews the intended lifecycle transition;
- does not mutate lifecycle overlay state;
- does not create review messages;
- does not mark done, blocked, or failed;
- does not start workers, run validation, call Git, launch Terminal, execute
  rollback, call shell, or call Codex.

Real invocation:

- mutates only the frontend/controller lifecycle overlay when the Queue bridge
  or injected lifecycle adapter can provide the current task;
- may attach model-only validation approval and fake commit result metadata as
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
- Failure
- Agent completed
- Agent not completed
- Agent failed
- Agent did not complete
- N changed files
- Validation passed
- Validation failed
- Validation not run
- Final report available
- Logs available
- Frontend evidence only - not durable
- Queue worker evidence ingested
- Queue item awaiting review
- Queue evidence ingestion failed
- Queue evidence ingestion skipped
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
- attach fake commit result
- mark done
- dependent startability only after done
- follow-up prompt branch returning the same item to running
- QueueV2/controller-level presentation for awaiting review, in review, done,
  and follow-up prompt states

The self-test asserts no Codex, shell, worker start, Terminal launch, Git
mutation, rollback execution, Workspace API call, or persistence side effects.
Broker adapter tests also cover lifecycle dry-runs, real frontend overlay
transitions, wrong-message ACK failure, validation approval placeholders,
follow-up prompt state, done-gated dependents, unavailable dependencies, and
Workspace Agent structured action-request invocation.

`apps/desktop/frontend/src/workbench/agents/selfTest/hobitQueueDogfoodBrokerSelfTest.ts`
adds a full fake broker-driven dogfooding loop through the real Action Broker
and registered Queue lifecycle handlers. It uses a deterministic in-memory
frontend lifecycle/controller store and invokes:

- `queue.lifecycle.agentFinished`
- `queue.review.createMessage`
- `queue.review.ack`
- `queue.coordinator.approveValidation`
- `queue.item.markDone`
- `queue.coordinator.addFollowUpPrompt`

The broker self-test verifies the main success path from agent finished to
awaiting review, review message creation, coordinator ACK to in review,
model-only validation approval, fake commit metadata on mark done, and
done-gated dependent unblocking. It also verifies the follow-up branch returns
the same item to `running` with agent/prompt state
`additional_prompt_running` and increments `additionalPromptCount`, plus a
failure branch that keeps dependent work ineligible.

The main success path invokes `queue.lifecycle.agentFinished` with a fake
frontend worker evidence bundle instead of only loose final-agent fields. That
bundle includes task id, attempt id, thread id, completed outcome, final agent
message, changed files, validation summary/output preview, and a fake log
reference. The self-test asserts the broker consumes the bundle, the review
message includes the product-facing evidence summary, `queue.review.getEvidenceBundle`
returns the normalized frontend bundle when available, mark done still does not
execute Git, and dependent unblocking remains gated on dogfood `done`.

`apps/desktop/frontend/src/workbench/queue/smartQueueWorkerEvidenceIngestion.test.ts`
adds a focused broker-ingestion test group for Queue-linked frontend
completion shapes. It proves dry-run immutability, real broker mutation to
`awaiting_review`, explicit task-link failures, task/attempt mismatch
failures, invalid evidence failures, unavailable controller handling,
Direct Work / Workspace Agent / Agent Executor / Queue worker report adapter
wrappers, explicit review-message evidence summary readback, non-linked Direct
Work skip behavior, done-gated dependents, and hidden-side-effect guards.

The broker self-test is explicitly fake/model/controller/broker-level only. It
reports backend durability as skipped and real worker execution, real
validation execution, and real Git commit execution as blocked/not covered. It
does not call Codex, shell, Terminal, Git, rollback, backend storage, Tauri/IPC,
or a real Queue worker, and it does not create duplicate Queue views or add
natural-language prompt routing.

## Non-Goals

This contract does not implement:

- backend durability
- SQLite migrations
- Tauri or IPC APIs
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
