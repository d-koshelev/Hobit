# Queue Item Execution Policy Contract

Contract status: Current for persisted Queue task policy model; Planned for
Sequential Queue Runner behavior

Source of truth for:

- Queue item execution policy naming
- persisted Queue task execution policy model support
- automatic/manual queue execution semantics
- future Sequential Queue Runner behavior

Not source of truth for:

- current Queue runner behavior, because no runner is implemented yet
- Coordinator automation
- backend scheduler
- production autonomous orchestration

Related documents:

- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CONTRACT_DRIFT_DECISION_MATRIX.md`
- `docs/testing/WORKBENCH_CURRENT_SURFACE_SMOKE_CHECKLIST.md`

## Purpose

This contract defines the Queue item execution policy model before automatic
Queue execution is implemented.

The persisted model, DTO support, and Queue editor policy selection UI for
`executionPolicy` are implemented. Runner behavior, bulk prompt import,
Coordinator automation, and automatic execution remain Planned or Deferred as
defined below.

It does not add Queue runner behavior, Agent Executor runtime changes,
Coordinator behavior, Terminal behavior, Git behavior, or automatic product
behavior.

Current Agent Queue behavior remains the manual Queue task organization,
manual assignment, and explicit assigned-task run flow documented in
`docs/CURRENT_WIDGET_SURFACE.md` and `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

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

The future runner may start an `auto` task automatically only when all hard
launch preconditions pass:

- the task is runnable
- the task prompt is non-empty after trimming
- the selected Agent Executor exists
- the execution workspace/repo root exists
- the Codex executable exists
- the selected Agent Executor is not busy

### `after_previous_success`

The future runner may start an `after_previous_success` task automatically only
if the previous task executed by the current runner pass finished with a
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

## Future Sequential Queue Runner MVP

The future Sequential Queue Runner MVP should be a visible operator-started
Queue/Executor feature, not a hidden backend scheduler.

Target behavior:

- The operator selects one Agent Executor.
- The operator configures execution workspace/repo root, Codex executable,
  sandbox, and approval policy once.
- The runner scans ordered Queue tasks.
- The runner starts tasks according to `executionPolicy`.
- The runner uses the existing Queue -> Executor handoff.
- The runner waits for a final Agent Executor state before moving to the next
  task.
- The runner does not require per-task Assign/Run clicks for tasks that policy
  allows it to start.
- The runner does not invoke Coordinator.
- The runner does not perform extra validation gates between tasks.
- The runner remains frontend-driven MVP unless a later backend scheduler is
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

`executionPolicy` is persisted on Queue tasks before the Sequential Queue
Runner is implemented.

Implemented persistence/model support includes:

- SQLite/storage Queue task row/schema
- app service Queue task types
- Tauri Queue DTOs/commands
- frontend Queue types/API
- Queue editor UI control
- storage/app/Tauri tests for defaulting, explicit persistence, preserving
  policy when update omits it, changing policy when update supplies it, and
  rejecting unsupported policy values at the app-service validation boundary

Default policy:

- Existing tasks should default to `manual` unless a migration/compatibility
  decision explicitly chooses `auto`.
- New manually created tasks should default to `manual` unless the UI
  explicitly sets another policy.
- Bulk-added ready prompts may default to `auto` only if the bulk-add task
  explicitly scopes that behavior.

Still Planned:

- Sequential Queue Runner
- bulk prompt import/create UI
- smoke checklist for automatic queue execution

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
