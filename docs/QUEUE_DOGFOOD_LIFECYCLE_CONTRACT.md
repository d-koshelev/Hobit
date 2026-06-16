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
adapter integration.

The implemented model and adapter layer live under:

- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycle*.ts`
- `apps/desktop/frontend/src/workbench/queue/smartQueueDogfoodLifecycleController.ts`

The model is not yet persisted and is not yet wired as the authoritative
runtime Queue lifecycle. The controller/view-model adapter is an overlay for
frontend Queue controller helpers, QueueV2 presentation, fake lifecycle tests,
and future broker capability preparation.

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

## Non-Goals

This contract does not implement:

- backend durability
- SQLite migrations
- Tauri or IPC APIs
- real worker execution changes
- scheduler redesign
- real validation execution changes
- real Git commit execution
- rollback execution
- Queue UI redesign
- Finder integration
- natural-language regex routing
