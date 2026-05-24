# Agent Queue Autorun Contract

Contract status: Current Preview boundary

## Purpose

This contract defines the implemented operator-armed Queue Autorun boundary for
the desktop MVP.

It is not a backend scheduler, server worker, durable runner, reconnect/resume
system, Coordinator automation path, approval bypass, or hidden execution
system. The current preview keeps runner state in desktop process memory and
uses existing Queue-to-Executor / Agent Executor paths. It does not add durable
runner persistence, schema, Direct Work behavior, Agent Executor behavior,
server runtime, enterprise/RBAC, or multi-user workers by itself.

## Product Model

Queue Autorun is explicit operator-armed automation.

Queue itself is a supporting async execution pipeline for promoted/larger work
blocks. Coordinator remains the central place for planning, reasoning, task
drafting, review, and deciding whether work should be promoted to Queue.
Autorun applies only after explicit Queue task creation, assignment, policy,
runtime configuration, and operator Start / Arm action.

One example use case is leaving Hobit open while the operator is away, such as
overnight. The feature name is Queue Autorun, not overnight mode.

The intended near-term workflow is:

1. The operator creates Queue tasks with prompts.
2. The operator chooses which tasks may run automatically through each task's
   execution policy.
3. The operator selects one visible Agent Executor and the Direct Work runtime
   config for the current session.
4. The operator clicks a visible Start / Arm queue control.
5. Hobit runs at most one Queue task at a time through the existing
   Queue-to-Executor and Agent Executor Direct Work path.
6. Hobit stops on defined stop conditions and leaves results for later
   operator review.

Creating a task, setting `executionPolicy`, assigning an executor, or opening a
Workspace must not start work. Work starts only after an explicit operator
Start / Arm action in the current app session.

## Current-App-Session Boundary

Queue Autorun is desktop-local and current-app-session only.

It may keep runner state in memory while Hobit is open. It must not claim to
survive:

- app close;
- Workbench reload;
- desktop process restart;
- lost Direct Work stream attachment;
- machine sleep or OS process termination.

Durable reconnect/resume is a separate future design and implementation
problem. Until it exists, Queue task rows and Agent Executor run/log/result
records may persist, but the runner session itself does not.

## Explicit Arm Requirement

The runner must have a distinct armed/running session state.

Rules:

- task creation is not arming;
- assignment is not arming;
- `executionPolicy: auto` is not arming;
- opening Hobit is not arming;
- Coordinator proposals or chat messages are not arming;
- arming does not imply every task will run;
- stopping the runner must prevent later tasks from starting.

The Start / Arm action must be visible in Agent Queue and tied to the selected
Executor and current session configuration.

## Task Selection Rules

The current Queue Autorun implementation must remain conservative:

- one selected Agent Executor;
- one active task at a time;
- current ordered Queue task list only;
- runnable statuses only: `queued`, `ready`, and `review_needed`;
- prompt required after trimming;
- selected executor required;
- assigned executor must match, or the runner stops;
- unassigned runnable tasks are not auto-assigned by Queue Autorun;
- `manual` tasks stop the runner for operator action;
- `auto` tasks may run when all hard launch preconditions pass;
- `after_previous_success` tasks may run only after the previous task in the
  same runner pass completed successfully;
- final statuses are not retried automatically.

The runner must not read hidden Notes, artifacts, evidence, knowledge, Context
Packs, widget logs, Git state, JDBC state, Terminal output, or Coordinator
state while selecting tasks.

## Runtime Preconditions

Before starting a task, the runner must have:

- a selected Agent Executor;
- no active Direct Work run in that Executor;
- a valid Queue task and assignment state;
- a non-empty prompt;
- an explicit execution workspace where current Direct Work requires one;
- an explicit Codex executable;
- explicit sandbox and approval policy settings;
- current-session access to the existing Queue-to-Executor start path.

Hobit must not guess an execution workspace or default to broad folders such as
home, Documents, or Downloads.

## Stop Conditions

The runner must stop on:

- operator Stop;
- app session end;
- no runnable tasks;
- manual task reached;
- previous-success policy without a successful previous task;
- task assigned to a different executor;
- selected executor missing or busy;
- missing prompt;
- invalid runtime config;
- Direct Work failure;
- `review_needed` when policy requires review stop;
- cancellation or force kill;
- unknown Direct Work final status;
- Queue refresh or handoff failure that prevents safe sequencing.

Stopping the runner must not itself kill the active Agent Executor run unless a
separate explicit Stop run action is used.

## Failure And Review Behavior

Default policy is stop-on-failure and stop-on-review-needed.

A successful Direct Work run does not imply acceptance of the work. Review,
validation, Git inspection, commit, push, note updates, and any future approval
state remain explicit operator actions.

Failure must be visible in Agent Queue runner status and in the Agent Executor
run result. The runner must not continue after an unknown or ambiguous final
state.

Morning review after Autorun is governed by
`docs/QUEUE_RUN_HISTORY_VISIBILITY_CONTRACT.md`. Queue should reference
Executor-owned run metadata for each task and must not copy raw stdout, stderr,
prompts, final responses, diffs, logs, or result payloads into Queue.

## Relationship To Agent Executor

Agent Executor remains the runtime owner.

Agent Queue may select and start tasks through the existing assigned-task
Queue-to-Executor path. Agent Executor owns:

- Codex Direct Work execution;
- live logs;
- cancellation and force kill;
- final result;
- run history;
- changed-file and validation surfaces.

The runner must not duplicate live execution, bypass Agent Executor, or create
a second runtime path.

## Direct Work Final Status Mapping

The runner must consume final Direct Work status conservatively:

- `completed` may allow the next eligible task;
- `failed` and `timed_out` stop by default;
- `cancelled` stops by default;
- `review_needed`, when represented by future Direct Work or Queue linkage,
  stops by default;
- unknown final status stops and requires operator review.

Queue task status mapping remains owned by the existing app service lifecycle
rules. This contract does not add new Queue storage fields.

## Expected UX Controls

The Queue Autorun UX should show:

- selected Agent Executor;
- execution workspace;
- Codex executable;
- sandbox and approval policy;
- Start / Arm queue;
- Stop runner;
- current runner status;
- current task title/status;
- waiting-for-executor state;
- last non-sensitive reconciliation/tick timestamp;
- last stop reason;
- clear current-session limitation copy;
- warning that Stop runner does not stop the active Agent Executor run.

Controls must be honest about the current-session boundary. They must not imply
durable scheduling, hidden execution, or server workers.

## Current Code Foundation

The first foundation includes private desktop-only session vocabulary for:

- runner session id;
- runner status;
- runner policy;
- stop reason;
- start request;
- snapshot.

The desktop-local session state and Tauri commands can:

- start/arm a Queue runner session;
- stop the current Queue runner session;
- read the current Queue runner snapshot.

The Agent Queue frontend can start/arm, stop, and refresh this session
snapshot. The first execution slice can select one eligible `auto` Queue task
and submit it through the existing assigned-task Queue-to-Executor path.
Snapshot refresh can reconcile the recorded Autorun-started run id with the
stored Agent Executor run status and update the session with a safe final run
status or stop reason. After a successful final status, snapshot refresh can
select exactly one next eligible `auto` or `after_previous_success` task and
submit it through the same Queue-to-Executor path.

The desktop shell also owns a conservative current-session tick loop for the
explicitly armed session. The tick periodically runs the same reconciliation
path so Autorun can continue without manual Refresh while Hobit remains open
and the machine remains awake.

This slice starts at most one continuation task per tick or manual refresh. It
does not assign unassigned tasks, persist runner state, add schema, add durable
reconnect, or add a backend scheduler. Autorun still stops on failure, review,
cancellation, kill, unknown final status, manual task policy, missing executor,
invalid runtime config, or no next runnable task.

## Manual Desktop Smoke Checklist

For the current desktop MVP, a manual Queue Autorun smoke should verify:

1. Create two assigned `auto` Queue tasks, start Queue Autorun, keep Hobit
   open, and verify task 1 starts before task 2 starts after task 1 succeeds.
2. Verify a failed or timed-out first task stops Autorun and does not start
   task 2.
3. Verify `review_needed`, cancelled, force-killed, or unknown final status
   stops Autorun and does not start the next task.
4. Verify Stop Autorun prevents future scheduling and does not cancel the
   active Agent Executor run.
5. Verify a long-running Agent Executor task leaves Autorun waiting and does
   not start another task.
6. Verify no next eligible task completes the session with a non-sensitive stop
   reason.
7. Verify app close, reload, shutdown, or machine sleep can interrupt Autorun
   because no durable reconnect/resume exists.

## Non-Goals

This contract does not implement:

- backend scheduler;
- auto-dispatch without explicit operator arming;
- durable reconnect/resume;
- server runtime;
- enterprise/RBAC;
- multi-user workers;
- Coordinator-triggered execution;
- hidden context reads;
- hidden task starts;
- treating every Coordinator idea or small operation as Queue work;
- schema changes;
- Queue run history persistence;
- Queue-side raw run output or result copying;
- automatic retries;
- dependency execution;
- Git mutation, auto-commit, or push;
- Terminal launch;
- validation auto-run;
- approval workflow UI.

## Relationship To Current Queue Docs

Read this with:

- `docs/AGENT_QUEUE_DESKTOP_MVP_READINESS.md`;
- `docs/QUEUE_ITEM_EXECUTION_POLICY_CONTRACT.md`;
- `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`;
- `docs/QUEUE_RUN_HISTORY_VISIBILITY_CONTRACT.md`;
- `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`;
- `docs/DIRECT_MODE_AGENT_CONTRACT.md`;
- `docs/CURRENT_WIDGET_SURFACE.md`.

Current behavior remains the visible frontend Sequential Queue Runner and
explicit assigned-task start path unless a later implementation block changes
it deliberately.
