# Agent Queue Product Model Contract

## Purpose

This contract defines the future product and technical model for evolving
Agent Queue into the Workspace-level surface for organizing agent tasks and
Agent Executor run history.

This document is contracts-only. It does not add frontend UI, backend/Tauri
commands, storage/schema changes, queue execution, task dispatch, scheduling,
Agent Executor assignment, Git behavior, Runbook behavior, Coordinator
behavior, PTY behavior, or runtime changes.

## One-Sentence Role

Agent Queue: organize tasks and executor history.

## What Agent Queue Is

Agent Queue is the Workspace-level queue and history surface for structured
Agent Executor work. It is not the primary chat or global orchestrator; that
role belongs to Coordinator Chat under
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

Future Agent Queue is:

- one per Workspace
- a task backlog
- a task status table
- a future executor assignment surface
- a future dependency tracker
- a future history surface for Agent Executor work

Agent Queue is an optional Workbench capability. It is not the product center,
and it must preserve the Workbench-first and Widget-first model.

## What Agent Queue Is Not Yet

Current Agent Queue is still a preview/foundation surface.

Agent Queue does not yet provide:

- automatic dispatch
- a scheduler
- dependency execution
- automatic Agent Executor launch
- Git mutation
- commit or push behavior
- Coordinator ownership or global orchestration
- Runbook dependency

Manual assigned-task execution UI and current-session Executor handoff now
exist. Dispatch, scheduling, dependency running, automatic assignment, and
automatic Agent Executor launch require later explicit implementation blocks.

## Singleton Rule

Agent Queue is singleton per Workspace.

The backend already prevents adding more than one Agent Queue widget per
Workspace. Existing persisted duplicate Agent Queue widgets are preserved, but
new duplicates cannot be added.

The singleton rule applies to the Workspace, not only to one Workbench surface.
Future multiple Workbenches in one Workspace should still share one
Workspace-level Agent Queue.

## Queue Item Model

A future Queue Item is one concrete unit of agent work in a Workspace.

Intended future fields:

- `queue_item_id`
- `workspace_id`
- `title`
- `description`
- `prompt`
- `status`
- `priority`
- `created_at`
- `updated_at`
- `source`
- `assigned_executor_widget_id`
- `dependencies`
- `blocked_reason`
- `last_run_id`
- `result_summary`

The implementation may refine names or split fields when storage and API work
arrives, but the product model should remain clear: a Queue Item is a
Workspace-scoped task record that can later be assigned to an Agent Executor
and linked to run history.

## Queue Item Statuses

Future Queue Item statuses:

- `draft`
- `queued`
- `ready`
- `blocked`
- `running`
- `completed`
- `failed`
- `cancelled`
- `review_needed`

Status meanings:

- `draft`: not ready to run.
- `queued`: accepted into the queue.
- `ready`: dependencies are satisfied.
- `blocked`: waiting on dependencies, missing executor capacity, or another
  visible blocker.
- `running`: assigned to an Agent Executor.
- `completed`: execution finished successfully.
- `failed`: execution failed.
- `cancelled`: stopped by the operator.
- `review_needed`: output exists and needs operator review.

Status changes must be explicit and auditable when persistence exists. A
successful run must not automatically imply acceptance.

## Dependencies Model

Queue Items may depend on other Queue Items.

Rules:

- A dependent item is blocked until its dependencies are completed.
- Independent items can run in parallel later.
- The dependency graph must reject cycles when implemented.
- Dependency state should be visible in Agent Queue before any dispatch feature
  uses it.

Example:

```text
t1 depends on nothing
t2 depends on t1
t3 depends on t2
t4 depends on nothing and can run independently
```

In this example, `t1` and `t4` can be ready at the same time, while `t2` waits
for `t1` and `t3` waits for `t2`.

## Executor Capacity Model

Agent Executor widgets are future execution slots for queued work.

Current Agent Executor UI shows a compact slot identity derived from the stable
widget instance id. No separate persistent executor id exists yet.

Capacity rules:

- Zero Agent Executor widgets means no queued execution.
- One Agent Executor widget means one active queued task at a time.
- N Agent Executor widgets means up to N active queued tasks later.
- Agent Queue should show available executor capacity when assignment or
  dispatch UI exists.

Current Agent Executor manual execution remains valid and does not require
Agent Queue. A non-executing assignment API and UI foundation exists, but
dispatch to these slots remains future work.

## Assignment Model

Near-term assignment direction is manual first.

Rules:

- The operator chooses a Queue Item and an Agent Executor.
- The Queue Item should show the assigned executor if any.
- Automatic dispatch is later work.
- No auto-dispatch may exist until explicitly implemented.
- Assignment must not start an Agent Executor run silently.

Manual assignment is the bridge between a task backlog and future execution.
Detailed manual Queue-to-Executor assignment rules are defined in
`docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`.
Manual run-from-assignment rules are defined in
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`; backend/API and frontend run control
foundations now exist. Automatic dispatch, scheduler behavior, and dependency
execution remain future work.
It should be visible, reversible when safe, and understandable from Agent
Queue.

## Relationship To Agent Executor

Agent Executor runs tasks.

Agent Queue organizes tasks and history.

Agent Queue should not contain live execution UI itself. When a Queue Item is
assigned or run, Agent Executor owns:

- live logs
- result display
- validation
- changed-file or diff review summaries
- stop or cancel controls
- run-local status

Agent Queue may link to Agent Executor run history and summarize the latest
run result, but Agent Executor remains the live execution slot.

## Relationship To Git Widget

Git Widget remains the repository review and commit surface.

Agent Queue does not mutate Git.

A Queue Item may later show related repository root, Git review status, or run
result summary. Git review remains explicit through Git Widget, and commit,
push, stage, reset, clean, restore, stash, or other Git mutations require
separate explicit Git features.

## Relationship To Coordinator Chat

Coordinator Chat is the main operator-facing AI chat.

Coordinator may create Queue tasks after operator approval or under a future
explicit autonomy policy. Creating a task does not start execution, accept
work, mutate Git, launch Terminal, or bypass Agent Queue and Agent Executor
boundaries.

Agent Queue is not a chat, does not reason, and is not the Coordinator.

The previous Interactive Agent direction is being repositioned into
Coordinator Chat. Do not add separate Interactive Agent-to-Queue and
Coordinator-to-Queue models in the near term.

## Relationship To Runbook

Runbook is deferred from the active near-term plan.

Runbook does not create Queue Items in the MVP. A future Runbook integration
may create Queue Items from steps, but not now.

## UI Direction

Future Agent Queue UI should show:

- task table
- status chips
- ready, running, blocked, and completed sections
- assigned executor column
- dependency column
- priority
- created and updated timestamps
- last run summary
- manual New task action

Do not show scheduler or dispatch controls until implementation exists.
Preview surfaces must remain honest about current capability.

## Safety Boundaries

Agent Queue must not:

- run hidden tasks
- auto-dispatch without an explicit future feature
- mutate Git
- commit or push
- reset or clean
- delete files
- launch Terminal commands
- start Agent Executor runs without an operator-visible action in the first
  implementation

Queue history and assignment must remain visible. Agent proposes; operator
controls.

## MVP Implementation Direction

Recommended first implementation after this contract:

- backend/storage task model foundation
- manual create/list/update Queue Items
- no dispatch
- no dependency execution
- no scheduler

Completed implementation slices now include the task storage/API foundation,
Queue product UI, manual assignment to Agent Executor, explicit assigned-task
run UI, current-session Queue-to-Executor handoff, and final-status
auto-refresh.

Recommended next slices:

- dependencies MVP
- ready/blocked view
- capacity/planner contract later
- auto-dispatch contract later

## Current State

Current Agent Queue remains:

- Preview
- singleton per Workspace
- backed by a manual task storage/API foundation for create, list, read, and
  update operations
- surfaced through a manual product UI for create, list, select, edit, status,
  priority, explicit save, and visible executor assignment
- backed by an assignment API foundation for manually assigning or clearing an
  Agent Executor widget slot
- supports `running` as task status data for manual queue-start lifecycle
- backed by a manual backend/API foundation for starting an assigned task in
  its assigned Agent Executor
- with explicit frontend Run assigned task controls
- with frontend current-session Queue-to-Executor handoff and final-status
  auto-refresh
- non-dispatching
- without dependency management

The task and assignment foundation stores Workspace-scoped task records only. It
does not add scheduler behavior, dependency execution, automatic dispatch, or
automatic status transitions outside the explicit manual start API.
Manual run of an assigned task is governed by
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

The current preview/review foundation must not be treated as a task runner,
scheduler, or hidden execution path.

## Recommended Follow-Up Blocks

- Queue dependencies MVP.
- Queue ready and blocked view.
- Capacity/planner contract later.
- Auto-dispatch contract later.

## Non-Goals

This contract does not define or require:

- automatic dispatch or scheduler UI
- backend behavior beyond the manual task, assignment, and explicit
  assigned-run foundations noted above
- Tauri commands beyond manual task create/list/read/update/assign/clear/start
- storage/schema behavior beyond Workspace-scoped manual task records and
  nullable assignment state
- automatic queue execution beyond explicit operator-started assigned runs
- task dispatch
- scheduler
- dependencies implementation
- Agent Executor runtime changes
- Git mutation
- commit
- push
- stage
- reset
- clean
- Runbook work
- Coordinator work
- PTY or interactive session
