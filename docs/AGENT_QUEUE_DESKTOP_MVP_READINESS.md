# Agent Queue Desktop MVP Readiness

## Purpose

This document records the Agent Queue desktop MVP readiness inspection.

It is a Queue-focused product and architecture checkpoint. It does not add a
backend scheduler, hidden/unarmed auto-dispatch, durable runner, server
runtime, enterprise/RBAC, Direct Work behavior, Agent Executor behavior, schema
changes, frontend behavior, or hidden execution.

## Current Surface

Agent Queue is a preview manual task organization and async execution-support
surface for workspace-local work. It is for promoted/larger work blocks that
need assignment, sequencing, current-session runner support, or later review;
it is not the default place for every Coordinator idea, quick decision, file
edit, validation step, or small operator action.

The product role distinction is:

- Coordinator is the primary foreground AI agent and central operator-facing
  work surface for interactive Workspace work through controlled
  capabilities.
- Queue is the organization and delegation surface for promoted, larger,
  delayed, long-running, or overnight work.
- Agent Executor is the async/background worker for bounded Queue task prompts
  and owns queued execution logs, results, review state, and run history.

Executor is not the only agent that can do work and does not define
Coordinator's future foreground capability set.

Currently working:

- create, list, read, update, filter, and select Queue tasks;
- explicit confirmation-gated Queue task deletion for non-running,
  non-active tasks;
- persisted task title, description, prompt, status, priority, execution
  policy, assignment, and timestamps;
- task assignment to a visible Agent Executor widget;
- assignment clearing when task status allows it;
- explicit assigned-task start through the existing Agent Executor Direct Work
  path;
- task status transition to `running` when a Queue-started Direct Work run is
  created;
- task final status update to `completed`, `failed`, or `cancelled` when the
  Queue-started Direct Work run finishes in the current desktop process;
- current-session handoff so the assigned Agent Executor can attach to the
  Queue-started Direct Work stream;
- current-session Queue auto-refresh after the assigned Agent Executor reaches
  a final state;
- selected-task latest run metadata display from durable safe run-link records,
  including source/status/timestamps and a frontend-only Open Executor scroll
  action;
- selected-task compact run history from the same safe run-link metadata,
  showing recent status/source/run refs and a count without rendering Executor
  payloads;
- visible frontend Sequential Queue Runner that can run policy-eligible tasks
  after the operator starts the runner;
- visible Queue Autorun panel that can arm, stop, and refresh desktop-local
  runner session state;
- Queue Autorun can start one eligible assigned `auto` task through the
  existing Queue-to-Executor path after explicit operator Start Autorun. It
  can observe the recorded run's final status on snapshot refresh and continue
  from a successful task to exactly one next eligible assigned `auto` or
  `after_previous_success` task per refresh;
- Queue Autorun also has a desktop-local current-session tick that periodically
  runs the same reconciliation path while Hobit remains open.

## Durable Today

Durable in `hobit-app` / SQLite-backed storage:

- Queue task rows;
- explicit task deletion removes only the Queue task row and does not delete
  Agent Executor run/log/result artifacts;
- durable Queue task to Agent Executor / Direct Work run-link metadata rows,
  with one Queue task able to have multiple run links over time;
- task lifecycle status vocabulary;
- task execution policy values: `manual`, `auto`,
  `after_previous_success`;
- task assignment to an Agent Executor widget id;
- explicit assigned-task start API creating a normal Agent Executor Direct
  Work run;
- Direct Work run/log/result records owned by Agent Executor runtime paths.

The Queue task record does not persist `last_run_id`, result summary, runner
id, dependency state, or retry state on the task row. Safe run-link metadata
lives in a separate table and references Executor-owned Direct Work runs. The
Queue API exposes the latest safe link and recent safe link summaries for a
selected task without exposing prompts, stdout/stderr, logs, final responses,
raw diffs, repo paths, secrets, or raw JSON payloads.

## Current-Session Only

Frontend and desktop-local current-session only:

- Sequential Queue Runner state;
- desktop-local Queue runner session arm/stop/snapshot state;
- selected runner Agent Executor;
- runner stopped/running/waiting status;
- runner observed final status for the active Autorun-started run;
- runner last non-sensitive reconciliation/tick timestamp;
- runner continuation decision for the current refresh/tick;
- execution workspace draft;
- Codex executable draft;
- sandbox and approval policy selections in the Queue run panel;
- Queue-to-Executor handoff object used by the Agent Executor UI;
- Queue auto-refresh request after an Executor final state;
- selected task and task filter UI state.

Reloading the Workbench or closing the desktop UI loses these session-only
runner and handoff details. The Autorun tick also stops when Hobit closes or
the app session ends. Machine sleep, shutdown, or OS process termination can
interrupt Autorun. There is no durable runner reconnect or resume.

## Explicit Execution Flow

The explicit manual assigned-task flow is:

1. Operator creates or edits a Queue task.
2. Operator saves a runnable status and non-empty prompt.
3. Operator assigns the task to a visible Agent Executor.
4. Operator provides an explicit execution workspace, Codex executable,
   sandbox, and approval policy.
5. Operator clicks `Run assigned task`.
6. Backend validates the task, assignment, executor ownership, status, prompt,
   and Direct Work input.
7. Backend starts a normal Agent Executor Direct Work stream and marks the task
   `running`.
8. Agent Executor owns live logs, stop/cancel, final output, diff, validation,
   and run history.
9. When the run finishes, Queue status is updated from the Direct Work final
   status.

The Sequential Queue Runner is also operator-triggered. After the operator
clicks `Run queue`, the frontend runner may assign and start policy-eligible
tasks in the selected Agent Executor. This is not a backend scheduler and does
not survive reload.

## Not Implemented

- backend scheduler;
- hidden or unarmed auto-dispatch without an operator-started visible runner;
- durable runner, reconnect, or resume;
- multi-executor scheduling;
- dependency graph or blocked/ready dependency model;
- retry model;
- full Queue run-history browser or `last_run_id` task-row fields;
- Queue-owned live logs or result detail;
- Queue-owned raw run details;
- bulk task import;
- Coordinator-driven Queue execution;
- treating every Coordinator idea, file edit, validation step, or small
  operation as a Queue task;
- Terminal launch;
- Git mutation, auto-commit, or push;
- validation auto-run between tasks;
- server runtime;
- enterprise/RBAC.

## Top UX / Product Gaps

- Execution policy labels, especially `auto`, can read stronger than the
  current implementation. The product should keep saying that policy is used
  only by the visible, operator-started Sequential Queue Runner.
- Queue now shows latest durable run-link metadata and a compact recent
  history for the selected task, but not a full run-history browser or
  Executor-owned result detail.
- Queue task detail has many controls in one panel; the next UI pass should
  make planning, assignment, manual run, and runner controls easier to scan.
- Empty states explain task creation, but there is no guided path for
  "create task -> set runnable status -> assign -> run".
- Execution workspace is session-only and must be re-entered for future
  sessions.
- Runner stop behavior does not stop the active Agent Executor run; that is
  correct today but should stay very visible.
- No dependency/blocking model exists, so `blocked`/ready planning remains
  manual status management.

## Top Architecture Risks

- The frontend runner depends on current-session React state and final-state
  handoff events. It should not be treated as durable orchestration.
- Queue-started run linkage is persisted as safe metadata in a separate
  run-link table. Future Queue run-history visibility should continue to
  reference Executor-owned runs rather than duplicating runtime output into
  Queue.
- Auto-refresh can be blocked by dirty task edits; operators may need manual
  refresh to see final task status.
- Agent Executor remains the runtime owner. Adding Queue-side run detail later
  should reference Executor-owned runs rather than duplicating runtime output.
- A future durable runner would need explicit runner ids, task/run linkage,
  ownership, cancellation/retry policy, and audit/capability mapping before
  implementation.

## Recommended Next Implementation Slices

1. Queue UI/UX hardening: clarify policy labels/copy, separate planning from
   run controls, and improve the first-task empty path.
2. Operator-armed Queue Autorun hardening: follow
   `docs/AGENT_QUEUE_AUTORUN_CONTRACT.md` to keep automatic mode
   explicit, desktop-local, current-session-only, one-task-at-a-time, and
   stopped on failure/review/cancel/missing executor/missing prompt/invalid
   config. Current Tauri runner commands can start one eligible assigned
   `auto` task through the existing Queue-to-Executor path, observe final
   status on refresh, and continue after success to one next eligible task per
   refresh/tick.
3. Queue task detail polish: improve status/policy guidance, validation
   messages, assignment affordances, and dirty-state handling.
4. Queue runner reliability hardening: make current-session limits clearer,
   improve stop/waiting/final-state messages, and strengthen frontend tests.
5. Queue task run visibility/history: minimal durable run-link metadata,
   selected-task latest-run visibility, and a compact history list/count now
   exist. The next slice should add deeper Executor-owned run opening or
   filtering only through safe references.
6. Queue dependencies / blocked-ready model: design dependency semantics
   before adding UI or storage.
7. Later durable backend runner design contract: no implementation until the
   contract covers scheduler boundaries, explicit operator control,
   reconnect/resume, cancellation, retries, audit/capability refs, and failure
   modes.

## Preserved Boundaries

Queue is not a backend scheduler.

Queue is not the Coordinator work surface and should not replace
Coordinator-led foreground work, planning, reasoning, task drafting, review,
or decision-making.

Executor is the Queue/background worker. It does not limit Coordinator's
future ability to use approved Workspace capabilities directly in the
foreground.

Queue does not auto-dispatch without an explicit operator-started visible
runner, and it has no backend scheduler.

Sequential Queue Runner is frontend/current-session-only.

Queue-to-Executor starts require explicit operator action: either `Run assigned
task` for one task or `Run queue` for the visible current-session runner.

Direct Work owns runtime execution.

No durable reconnect/resume exists.

No server runtime exists.
