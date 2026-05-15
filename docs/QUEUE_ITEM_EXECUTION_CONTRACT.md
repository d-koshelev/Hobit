# Queue Item Execution Contract

## Purpose

This contract defines how an assigned Agent Queue task may be manually run in
its assigned Agent Executor.

It is a product and safety gate before implementation. This document does not
add frontend UI, backend/Tauri commands, storage/schema changes, queue
execution implementation, Agent Executor runtime behavior, scheduler behavior,
automatic dispatch, dependencies, Git mutation, Terminal launch, PTY behavior,
or interactive session behavior.

## One-Sentence Rule

Manual run only.

A Queue task may run in its assigned Agent Executor only after the operator
explicitly starts the run.

## What Run From Queue Is

Run from Queue means:

- an operator-selected Queue item
- an assigned Agent Executor widget
- a visible confirmation or explicit `Run assigned task` action
- use of the Queue task `prompt` as the Agent Executor prompt
- creation of a normal Agent Executor Direct Work run
- linkage from the Queue task to the resulting run when linkage fields exist
- Queue task status updates based on the visible run result
- Agent Executor remaining the live execution surface

The Queue provides the task record and routing intent. Agent Executor owns the
actual run.

## What Run From Queue Is Not

Run from Queue is not:

- automatic dispatch
- scheduler behavior
- a background queue worker
- a dependency engine
- auto-run after assignment
- auto-run after task creation
- hidden Codex execution
- Terminal launch
- Git mutation
- commit or push
- validation auto-run unless separately implemented

Running an assigned task must not become a hidden automation path. The operator
must see where and when execution starts.

## Required Preconditions

Before a Queue item can run:

- the task exists
- the task belongs to the active Workspace
- the task has `assigned_executor_widget_id`
- the assigned executor widget exists
- the assigned executor widget is an `agent-run` Agent Executor
- the assigned executor widget is in the same Workspace
- the task status is runnable
- the task prompt is non-empty after trimming
- the repository root is known, or the operator provides it before the run
- no active run is already running in the target Agent Executor when
  single-run-per-executor behavior is required

Implementations should return clear operator-visible errors for unmet
preconditions.

## Repo Root Policy

The current Queue task model does not include `repo_root`.

First implementation options:

- Option A: ask the operator for repository root at run time.
- Option B: use the selected Agent Executor current repository root if it is
  clearly visible and editable.
- Option C: add a Queue task `repo_root` field in a later storage/API block.

Recommended first implementation: ask the operator for repository root at run
time, or use the selected Agent Executor current repository root only when it is
clearly visible and editable before launch.

Hobit must not silently guess a repository root.

## Runnable Statuses

Recommended runnable statuses:

- `queued`
- `ready`
- `review_needed`

`draft` should either be blocked until promoted or require an explicit
confirmation that the draft task is ready to run.

`completed`, `failed`, and `cancelled` should not run again unless a future
retry model is defined.

If an implementation chooses a narrower runnable-status rule, that rule must be
documented before coding.

## Status Transition Model

Recommended future transitions:

- `queued` or `ready` to `running` when the run starts
- `running` to `completed` when the Agent Executor run succeeds
- `running` to `failed` when the Agent Executor run fails
- `running` to `cancelled` when the operator cancels the run

The persisted task status model supports `running` as data before queue item
execution exists. A later queue execution implementation may use that status
for visible lifecycle transitions.

The first queue execution implementation must not add automatic dependency
status transitions.

## Run Ownership

Agent Executor owns:

- live logs
- Stop run
- final response
- changed files
- diff summary
- validation
- run history

Agent Queue owns:

- task title
- task prompt
- assignment
- task status
- `last_run_id`, if implemented
- result summary, if implemented

Agent Queue should summarize or link to run history, but it should not replace
Agent Executor as the live execution surface.

## Run Linkage Fields

Recommended future Queue task linkage fields:

- `last_run_id`
- `result_summary`
- `last_run_status`
- `started_at`
- `completed_at`

If this is too broad for the first implementation, it may update only task
status and leave richer run linkage for a later block.

## Queue UI Direction

Future Agent Queue UI should show:

- `Run assigned task` only when the task is assigned and runnable
- assigned executor
- repository root selection or a visible repository root
- run status
- last result summary
- link to the Agent Executor run detail

Agent Queue must not show auto-dispatch controls until auto-dispatch is
explicitly implemented.

## Agent Executor UI Direction

When a Queue task starts, Agent Executor may show:

- current task source
- Queue task title
- source Queue item id

Agent Executor should still look and behave like normal Direct Work execution.
It must not silently run assigned tasks without visible activity.

## Concurrency And Capacity

Only one active run should exist per Agent Executor unless a later design
changes that rule.

Agent Queue should not start a task in an Agent Executor that is already
running. Parallelism comes from multiple Agent Executor widgets in the
Workspace.

No scheduler or auto-dispatch is part of the first implementation.

## Cancellation

If a Queue-started Agent Executor run is cancelled:

- the Agent Executor run becomes cancelled
- the Queue task should either become `cancelled` or return to `queued`,
  depending on the chosen policy

Recommended first implementation: a cancelled run sets the Queue task to
`cancelled` and records a cancellation summary when summary fields exist.

A retry model can be added later.

## Validation

Validation must not automatically run after Queue-started execution in the
first implementation.

The operator may run validation manually in Agent Executor. Agent Queue may
display validation summary later when an explicit linkage exists.

## Git Behavior

Running a Queue task through Agent Executor may modify files through the normal
Direct Work path.

Hobit must not auto-commit. Hobit must not push.

Git review remains explicit through Git Widget and Agent Executor diff summary.
Commit, push, stage, reset, clean, checkout, restore, and other Git mutations
require separate explicit Git features.

## Safety Boundaries

Run from Queue must preserve these boundaries:

- no hidden execution
- no automatic dispatch
- no scheduler
- no dependency engine
- no Terminal launch
- no Git mutation by Queue
- no commit or push
- no reset or clean
- no file deletion cleanup
- operator-visible start, target executor, repository root, and run status

Agent proposes; operator controls.

## Recommended Implementation Blocks

- Block 195  Queue item execution backend/API foundation.
- Block 196  Queue item execution UI.
- Block 197  Queue item execution smoke and hardening.
- Block 198  Queue dependencies MVP.
- Block 199  Queue ready and blocked view.
- Block 200  Parallel executor planner contract.
- Block 201  Auto-dispatch contract later.

## Non-Goals

This contract does not implement:

- frontend UI
- backend behavior
- Tauri commands
- storage/schema changes
- queue execution implementation
- Agent Executor launch
- Codex run
- Terminal launch
- scheduler behavior
- automatic dispatch
- dependencies implementation
- Git mutation
- commit, push, stage, reset, or clean
- PTY or interactive session behavior
