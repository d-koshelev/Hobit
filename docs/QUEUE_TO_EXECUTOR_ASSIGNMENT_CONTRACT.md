# Queue To Executor Assignment Contract

## Purpose

This contract defines how Agent Queue tasks may be manually assigned to visible
Agent Executor slots before any automatic dispatch, scheduler, dependency
execution, or run-from-queue behavior exists.

It is a product and safety contract. The current implementation foundation
includes storage, app service, Tauri, frontend API assignment methods, and a
compact Agent Queue assignment UI. It does not add queue execution, Agent
Executor runtime behavior, dependencies, Git mutation, Terminal launch, or
background work.

## One-Sentence Rule

Manual assignment first.

An operator may assign a Queue task to a visible Agent Executor slot, but
assignment alone does not automatically run the task.

## What Assignment Is

Assignment means:

- a Queue task references one Agent Executor widget instance
- the assigned executor is the intended execution slot for a future run
- the assignment is visible in Agent Queue
- the assignment may be visible in Agent Executor when that UI is implemented
- the assignment can be changed manually while the task is not running

Assignment is a planning and routing state. It records operator intent about
which visible execution slot should own the task later.

## What Assignment Is Not

Assignment is not:

- execution
- dispatch
- scheduling
- an automatic run
- dependency resolution
- hidden background work
- Git mutation
- commit or push
- Terminal launch
- Agent Executor auto-start

Assigning a task must not start Codex, start Terminal, mutate files, mutate Git,
or create hidden work.

## Assignment Fields

Future Queue task assignment should use:

- `assigned_executor_widget_id`
- `assigned_at`, if timestamped assignment history is useful later
- `assigned_by`, if user identity exists later
- `assignment_status`, if assignment needs a richer lifecycle later

For the near-term implementation, `assigned_executor_widget_id` is enough.

## Current Implementation Foundation

The backend/API foundation now persists `assigned_executor_widget_id` on
Workspace-scoped Agent Queue tasks.

Implemented behavior:

- assign a Queue task to an existing Agent Executor widget instance
- clear a Queue task assignment
- return assignment state from create, list, read, update, assign, and clear
  task APIs
- update the task `updated_at` timestamp on assignment changes
- reject assignment to non-Agent Executor widgets, unknown widgets,
  cross-Workspace widgets, unknown tasks, cross-Workspace tasks, and final task
  statuses

This foundation does not add run-from-queue behavior, queue dispatch, scheduler
behavior, dependency behavior, Codex launch, Terminal launch, Direct Work run
creation, widget run creation, execution logs, Git mutation, or automatic task
status transitions.

## Executor Identity

An Agent Executor widget instance is the execution slot.

Use the existing stable `widget_instance_id` as the slot identity. Do not add a
separate persistent executor id unless a later implementation block proves that
the widget instance id is insufficient.

The UI may display the slot as a compact label such as:

```text
Agent Executor 8f3a2c
```

The displayed suffix is only a readable abbreviation of the
`widget_instance_id`; it is not a second identifier.

## Valid Assignment Rules

A Queue task may be assigned only to:

- an Agent Executor widget
- in the same Workspace
- preferably in the same Workbench when that is the active product scope

Assignment must reject:

- Git widgets
- Terminal widgets
- Notes widgets
- Agent Queue widgets
- Interactive Agent widgets
- Runbook widgets
- retired widgets
- unknown widgets
- widgets in another Workspace

Rejected assignment should be explicit and visible to the operator.

## Task Status Rules

Assignment should not automatically change task status unless a later contract
and implementation explicitly add that behavior.

Recommended near-term behavior:

- `draft` tasks can be assigned
- `queued` tasks can be assigned
- `ready` tasks can be assigned
- `completed`, `failed`, and `cancelled` tasks should not be reassigned unless a
  future retry model allows it
- `running` tasks should not be reassigned

If a later implementation chooses a simpler rule, that rule must be documented
before coding.

## Execution Separation

Assignment and execution must remain separate.

Future intended flow:

1. Operator creates a Queue task.
2. Operator assigns the task to an Agent Executor slot.
3. Operator reviews the task prompt and context.
4. Operator clicks a visible `Run assigned task` action.
5. Agent Executor runs the task.
6. Agent Queue status updates from the visible run result.

The current assignment foundation does not implement that flow. It only stores
and clears assignment state before execution exists.

## Capacity Model

Agent Queue should later show Agent Executor capacity:

- zero Agent Executor widgets means no queued execution can run
- one Agent Executor widget means one active task can run later
- N Agent Executor widgets means up to N active tasks can run later

Manual assignment can exist before auto-dispatch.

Auto-dispatch is future work and requires a separate contract before
implementation.

## Dependencies Relationship

Dependencies are future work.

Assignment must not imply dependency scheduling. Once dependencies exist, a
blocked task should not be runnable until its dependencies are satisfied.

The current assignment foundation does not implement dependencies,
ready/blocked computation, or dependency-driven execution.

## Queue UI Direction

Future Agent Queue UI should show:

- assigned executor column
- unassigned state
- executor slot picker
- assignment status
- manual assign action
- manual unassign action when safe

Agent Queue must not show automatic dispatch controls before dispatch exists.

## Agent Executor UI Direction

Future Agent Executor UI may show:

- assigned Queue task
- task title
- task prompt
- source Queue item id
- `Run assigned task` action

Agent Executor must not silently run assigned tasks.

## Safety Boundaries

Manual assignment must preserve these boundaries:

- no hidden task execution
- no automatic Agent Executor launch
- no Terminal command launch
- no Git mutation
- no commit or push
- no file deletion
- no background scheduler
- no queue execution without visible operator action

## Recommended Implementation Blocks

- Block 194  Run assigned queue item in selected Agent Executor.
- Block 195  Queue dependencies MVP.
- Block 196  Queue ready/blocked view.
- Block 197  Parallel executor planner contract.
- Block 198  Auto-dispatch contract later.

## Non-Goals

This contract and current foundation do not implement:

- run-from-queue behavior
- queue execution
- automatic dispatch
- scheduler behavior
- dependencies implementation
- Agent Executor runtime changes
- Git mutation
- commit, push, stage, reset, or clean
- PTY or interactive session behavior
