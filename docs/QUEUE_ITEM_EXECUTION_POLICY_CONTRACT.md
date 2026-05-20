# Queue Item Execution Policy Contract

Contract status: Current for persisted Queue task policy model and
frontend-driven Sequential Queue Runner MVP

Source of truth for:

- Queue item execution policy naming
- persisted Queue task execution policy model support
- automatic/manual queue execution semantics
- current frontend-driven Sequential Queue Runner MVP behavior

Not source of truth for:

- Coordinator automation
- backend scheduler
- production autonomous orchestration

Related documents:

- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CONTRACT_DRIFT_DECISION_MATRIX.md`
- `docs/testing/WORKBENCH_CURRENT_SURFACE_SMOKE_CHECKLIST.md`

## Purpose

This contract defines the Queue item execution policy model and the current
frontend-driven Sequential Queue Runner MVP.

The persisted model, DTO support, and Queue editor policy selection UI for
`executionPolicy` are implemented. The visible Queue runner MVP is implemented
in frontend state only. Bulk prompt import, Coordinator automation, durable
background scheduling, and backend scheduling remain Planned or Deferred as
defined below.

It does not add Agent Executor runtime changes, Coordinator behavior, Terminal
behavior, Git behavior, backend scheduler behavior, or durable background
execution.

Current Agent Queue behavior remains the manual Queue task organization,
manual assignment, explicit assigned-task run flow, and visible
frontend-driven Sequential Queue Runner documented in
`docs/CURRENT_WIDGET_SURFACE.md`.

## Canonical Model

The Queue work item remains a `QueueTask` or Queue item. Do not model these
values as Queue item types in code. They are execution policies: how an
existing task is allowed to start.

Canonical field:

```text
executionPolicy
```

Storage and Tauri DTOs use `execution_policy`.

Allowed values:

- `manual`
- `auto`
- `after_previous_success`

User-facing labels:

- Manual / Requires operator command
- Auto / Run automatically
- After previous success / Run if previous task succeeded

## Policy Semantics

### `manual`

- Must not be started by an automatic runner.
- Requires an explicit operator Run command.
- If a runner reaches a `manual` task, the MVP runner should stop and report
  that operator action is required.
- The runner must not silently skip a `manual` task unless a future policy
  explicitly allows skip behavior.

### `auto`

The frontend-driven runner may start an `auto` task automatically only when all
hard launch preconditions pass:

- the task is runnable
- the task prompt is non-empty after trimming
- the selected Agent Executor exists
- the execution workspace/repo root exists
- the Codex executable exists
- the selected Agent Executor is not busy

### `after_previous_success`

The frontend-driven runner may start an `after_previous_success` task
automatically only if the previous task executed by the current runner pass
finished with a
success/completed final state.

Rules:

- If the previous executed task failed, was cancelled, or timed out, the runner
  stops before this task.
- If there is no previous executed task in the current runner pass, this policy
  should not auto-start by default unless explicitly configured in a later
  contract.
- For MVP, "previous task" means the previous task in the current runner
  pass/order, not a global historical previous task.

## Status Interaction

`executionPolicy` does not replace task status.

- Status describes lifecycle state.
- `executionPolicy` describes how the task is allowed to start.

Current Queue task status vocabulary includes:

- `draft`
- `queued`
- `ready`
- `blocked`
- `running`
- `completed`
- `failed`
- `cancelled`
- `review_needed`

Expected runnable statuses for automatic policy evaluation:

- `queued`
- `ready`
- `review_needed`

Expected non-runnable statuses:

- `draft`
- `blocked`
- `running`
- `completed`
- `failed`
- `cancelled`

Rules:

- Final statuses must not be auto-run again.
- Running tasks must not be started again.
- `blocked` tasks must not be auto-run while blocked.
- A future retry model must define how completed, failed, cancelled, or timed
  out work becomes runnable again before any runner restarts it.

## Current Sequential Queue Runner MVP

The Sequential Queue Runner MVP is a visible operator-started Queue/Executor
feature, not a hidden backend scheduler.

Current behavior:

- The operator selects one Agent Executor.
- The operator configures execution workspace/repo root, Codex executable,
  sandbox, and approval policy once.
- The runner scans ordered Queue tasks.
- The runner starts tasks according to `executionPolicy`.
- The runner uses the existing Queue -> Executor handoff.
- The runner waits for a final Agent Executor state before moving to the next
  task.
- If a runnable task is unassigned, the runner assigns it to the selected Agent
  Executor before starting it.
- If a runnable task is assigned to another Agent Executor, the runner stops
  and reports the mismatch.
- The runner does not require per-task Assign/Run clicks for tasks that policy
  allows it to start.
- The runner does not invoke Coordinator.
- The runner does not perform extra validation gates between tasks.
- The runner stops when the Workbench UI closes or reloads.
- The runner remains frontend-driven unless a later backend scheduler is
  explicitly approved.

## Without Extra Validations

"Without extra validations" means the runner still checks hard launch
preconditions, but it does not introduce additional review or approval gates
between policy-allowed tasks.

Allowed hard launch preconditions:

- prompt present
- executor selected and available
- execution workspace configured
- Codex executable configured
- executor not busy

Not allowed in the MVP runner:

- per-task confirmation
- Coordinator approval
- post-run validation gate before next task
- hidden review step
- manual Assign/Run click per task

Validation may remain available as a separate explicit Agent Executor action.
It must not become an automatic gate before the next Queue task starts unless a
later contract explicitly adds that behavior.

## Persistence Model

`executionPolicy` is persisted on Queue tasks and is consumed by the
frontend-driven Sequential Queue Runner MVP.

Implemented persistence/model support includes:

- SQLite/storage Queue task row/schema
- app service Queue task types
- Tauri Queue DTOs/commands
- frontend Queue types/API
- Queue editor UI control
- storage/app/Tauri tests for defaulting, explicit persistence, preserving
  policy when update omits it, changing policy when update supplies it, and
  rejecting unsupported policy values at the app-service validation boundary

Implemented frontend preparation support includes:

- pure policy/status helper coverage for normalizing policy values, identifying
  runnable statuses, blocking empty prompts, stopping on `manual`, allowing
  `auto` only when status and prompt are runnable, and allowing
  `after_previous_success` only after a previous task in the current runner
  pass completed successfully
- pure runner-selection coverage for assignment-before-start, stopping on
  manual policy, stopping on assignment mismatch, duplicate-start avoidance,
  non-runnable task skipping, and after-previous-success final-state behavior
- Queue controller coverage for assigning an unassigned `auto` task before
  start, avoiding duplicate start requests, and Stop preventing the next task
  from starting

Default policy:

- Existing tasks should default to `manual` unless a migration/compatibility
  decision explicitly chooses `auto`.
- New manually created tasks should default to `manual` unless the UI
  explicitly sets another policy.
- Bulk-added ready prompts may default to `auto` only if the bulk-add task
  explicitly scopes that behavior.

Still Planned:

- bulk prompt import/create UI

## Safety Boundaries

This policy model is not:

- backend scheduler
- autonomous Coordinator orchestration
- multi-agent swarm
- hidden tool execution
- Terminal automation
- Git automation
- multi-executor parallel runner
- dependency graph
- retry engine

Deferred:

- backend scheduler
- dependency graph
- retries
- parallel execution
- multi-executor scheduling
- persisted background runner
- Coordinator-driven automatic task creation/execution
- script/runbook execution policies
- conditional expressions beyond `after_previous_success`

The runner must preserve visible operator control. Queue execution policy must
not become hidden context access, hidden execution, Git automation, Terminal
automation, Coordinator automation, or a generic production orchestration
system.

## Future Implementation Order

Recommended order:

1. Persist `executionPolicy` on Queue tasks. Completed.
2. Add Queue editor UI control for `executionPolicy`. Completed.
3. Add tests for policy draft/load/save behavior. Completed.
4. Add Sequential Queue Runner using `executionPolicy`.
5. Add bulk prompt import/create UI.
6. Add smoke checklist for automatic queue execution.

Each step should be a focused implementation block. Do not implement runner
behavior before the persisted policy model and policy/status tests exist.
