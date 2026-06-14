# Smart Queue Workflow Contract

## Purpose

This contract defines the planned Smart Queue workflow for prompt-pack driven
Queue task creation, dependency-aware eligibility, coordinator decisions, and
Workspace Agent assistance boundaries.

It is a product/domain contract plus minimal frontend type vocabulary. It does
not implement a scheduler, backend worker, storage schema, Tauri command,
runtime execution path, hidden automation, Git mutation, Terminal launch,
Finder behavior, or provider/tool call.

## Status

Planned for Smart Queue workflow semantics. Current implementation may expose
some compatible Queue, prompt-pack import, worker, and coordinator UI concepts,
but this contract does not make the full Smart Queue runtime current.

## Source Workflow

The canonical Smart Queue flow is:

```text
Prompt pack -> Queue Importer -> QueueBatch + QueueTasks + dependencies + settings
Queue Active -> eligible tasks start
Worker Agent -> attempts task execution
Queue Coordinator -> retry / block / fail / needs-help / close decisions
Workspace Agent -> assists only when explicitly asked
Human/operator -> approves sensitive lifecycle, mutation, and acceptance steps
```

Prompt-pack import targets the singleton Workspace Queue defined by
`docs/QUEUE_SINGLETON_CONTRACT.md`. Import does not create another Queue view,
arm execution, start workers, mutate Git, launch Terminal, or run tasks by
itself.

## Roles

- Queue Importer: materializes an explicit operator-provided prompt pack into a
  QueueBatch, QueueTasks, structural dependencies, and visible task settings.
  It validates import shape and records import warnings, but it does not start
  execution.
- Queue Coordinator: owns Queue lifecycle decisions after import and during
  execution. It evaluates task results, dependency outcomes, worker attempts,
  validation state, and operator decisions, then chooses retry, block, fail,
  review, close, drain, or stop decisions.
- Queue Scheduler: selects eligible tasks only when the singleton Queue is
  Active and capacity/settings allow work. It applies dependency gates and
  worker availability. In this block it is contract-only; no scheduler runtime
  is added.
- Worker Agent: executes one explicit task attempt using the approved runtime
  path and returns a bounded report. It does not own Queue lifecycle decisions.
- Workspace Agent assistance channel: helps explain, draft, summarize, or
  propose next steps only after an explicit assistance request. It is not the
  Queue owner and cannot silently decide retry/block/fail/close.
- Human/operator approval: owns explicit approval gates, sensitive actions,
  final acceptance, manual override, and any future escalation that requires
  human input.

## Queue States

- Paused: Queue holds tasks but the scheduler must not start eligible work.
- Active: Queue may start eligible tasks through the approved scheduler and
  worker path.
- Draining: Queue allows already-running attempts to finish but starts no new
  tasks.
- Stopped: Queue is not running and should treat active runtime state as ended
  or cancelled according to the coordinator decision record.

Queue state belongs to the singleton Workspace Queue, not to local widget
state.

## Task Human Statuses

- Ready: task can be considered for scheduling when Queue state and worker
  capacity allow it.
- Waiting dependency: task is structurally dependent on upstream work that is
  not complete yet. This is normal waiting, not a blocker.
- Running: a worker attempt is active.
- Review: output exists and needs review, validation, or finalization.
- Needs decision: the Queue Coordinator needs a lifecycle decision before the
  task can continue.
- Blocked: task cannot proceed without intervention, configuration, or a
  coordinator decision.
- Failed: task has failed by coordinator decision or terminal worker outcome.
- Closed: task reached an accepted terminal outcome.
- Cancelled: task was explicitly cancelled before normal completion.

These are operator-facing statuses. They may map onto current compatibility
task statuses until a durable Smart Queue model is implemented.

## Dependency Semantics

Dependencies are structural relationships between tasks. If task B depends on
task A, that relationship remains true regardless of whether A is currently
running, waiting, blocked, failed, or closed.

Waiting dependency is normal waiting while upstream work is not complete.
Blocked means the task cannot proceed without intervention or a coordinator
decision. These states must not be collapsed into one generic blocked state.

If an upstream dependency fails, downstream waiting tasks become Blocked with
blocker kind `dependency_failed`.

If an upstream dependency is blocked, downstream waiting tasks should expose
dependency gate `blocked`. The Queue Coordinator decides whether to keep
waiting, request help, retry upstream, split work, override, or block/fail
downstream.

## Dependency Gates

- none: task has no structural dependencies.
- waiting: at least one upstream dependency is not complete yet and has not
  failed.
- satisfied: all upstream dependencies have reached accepted completion.
- failed: at least one upstream dependency failed.
- blocked: at least one upstream dependency is blocked or needs intervention.

Dependency gates are eligibility inputs, not task ownership decisions.

## Blocker Kinds

- dependency_failed
- dependency_blocked
- missing_config
- validation_requires_decision
- worker_unavailable
- dirty_worktree
- missing_prompt
- requires_human_input

Blocker records must be visible and reviewable. They must not trigger hidden
Workspace Agent execution or hidden Queue mutation.

## Eligibility

A task is eligible to start only when:

- Queue state is Active.
- Task human status is Ready.
- Dependency gate is none or satisfied.
- Required prompt and settings are present.
- A compatible worker is available.
- Safety/configuration blockers are absent.
- Any required human approval has already been given.

Eligibility does not imply automatic acceptance, automatic commit, automatic
push, hidden validation, or automatic downstream closure.

## Non-Goals

This contract does not implement:

- runtime scheduler behavior;
- backend worker pools;
- durable scheduler reconnect/resume;
- storage/schema changes;
- new widget ids or component ids;
- Queue id/task id/provider id/session id renames;
- Finder integration;
- Git mutation;
- Terminal launch;
- Workspace Agent ownership of Queue lifecycle.
