# Agent Surface Model

## Purpose

This contract defines Hobit's near-term agent and work surface model.

The goal is to keep the Workbench explainable by separating execution, queue
history, manual interactive agent work, and procedural runbooks. These surfaces
may cooperate later, but they should not be collapsed into one broad
Coordinator, queue, chat, or workflow engine before the simple model is proven.

This document is docs-only. It does not implement runtime behavior, frontend
UI, storage, schema, Tauri commands, queue execution, Interactive Agent, Runbook
behavior, Coordinator behavior, or Git mutation.

## Near-Term Surfaces

### Agent Executor

Agent Executor runs one task and shows execution.

Role:

- execute one operator-approved task
- show live logs, final result, changed files, validation, and stop/cancel
- provide the main execution/monitoring/result surface for that task
- keep execution agent-agnostic for future executor kinds

Current implementation direction:

- Agent Executor is the current user-facing name.
- The implementation still uses the Codex CLI Direct Work path internally.
- The current implementation still reuses the existing `agent-run` identity for
  persistence compatibility.

Agent Executor should include:

- prompt or task input
- repository root or execution context
- sandbox or mode
- live monitoring
- result artifact
- validation capture
- changed-files summary
- no auto-commit or auto-push by default

Agent Executor should not include:

- queue scheduling logic
- Coordinator planning
- Runbook step editing
- automatic Git mutations
- every future agent feature in one widget

### Agent Queue

Agent Queue organizes tasks and executor history.

Role:

- hold queued tasks
- eventually dispatch tasks to available Agent Executors
- keep executor run history
- remain one Agent Queue per Workspace

Later Agent Queue may include:

- queue items
- statuses
- dependencies
- executor assignment
- history of executor runs

Near-term simplification:

- keep Agent Queue as queue, review, and history
- prevent adding new duplicate Agent Queue widgets in one Workspace while
  preserving any existing persisted duplicates
- do not make it a universal workflow engine yet
- do not execute queue items until queue execution is explicitly implemented in
  a later block

### Interactive Agent

Interactive Agent is a manual long-running chat or work session with an agent.
The widget contract is defined in
`docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`.

Role:

- support manual exploratory work with an agent
- feel closer to working with Codex CLI on a problem
- stay separate from Agent Queue and Agent Executor in v1

MVP direction:

- chat transcript
- user messages
- agent responses
- possible repository or context selection later
- no queue integration
- no monitoring integration
- no executor history recording
- no Runbook integration
- no tool execution, file mutation, Git mutation, or Terminal execution in v1

Reason:

- exploratory agent work is useful across different projects
- manual interactive work should stay distinct from scheduled or queued
  execution

### Runbook

Runbook follows and manages procedural steps.
The widget contract is defined in `docs/RUNBOOK_WIDGET_CONTRACT.md`.

Role:

- provide a step-based procedural work surface
- guide the operator through ordered or grouped steps
- track the state of each step

Step states:

- `pending`
- `running`
- `done`
- `failed`
- `skipped`
- `blocked`

MVP direction:

- list of steps
- step detail
- state changes
- notes or evidence per step

Future direction:

- runbook edit mode
- runbook builder from documentation
- runbook builder from knowledge base content
- runbook builder from internet or other sources
- semi-automatic agent help inside a step
- optional interactive interaction inside a step

Important boundaries:

- Runbook is not Agent Queue in v1.
- Runbook is not Coordinator.
- Do not force Runbook into Agent Executor before real usage clarifies the
  model.

## Deferred Coordinator

Coordinator widget or surface behavior is deferred from the near-term product
scope.

Coordinator may return later as a planning or chat surface, but it is not
required for Agent Queue, Agent Executor, Interactive Agent, or Runbook.

For now:

- do not make basic work depend on Coordinator
- do not add Coordinator-driven flows before simpler surfaces are proven
- keep future Coordinator behavior bound by
  `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`

## Parallelism Model

The number of Agent Executor widgets determines available execution slots.

- 0 Agent Executors means queued work cannot run.
- 1 Agent Executor means one task can run at a time.
- N Agent Executors means up to N tasks may run concurrently.

Automatic scheduling is future work. Manual execution from an Agent Executor
remains valid.

## Git Widget Binding Direction

Git Widget can remain independent.

Future binding direction:

- Git Widget can link to an Agent Executor.
- Git Widget can later link to a Runbook or Interactive Agent if useful.
- Coordinator links are deferred with Coordinator.
- Multiple Git Widgets may exist.
- Git Widget remains read-only until explicit Git mutation features are added.

## What Not To Mix

- Do not mix Interactive Agent with Agent Queue in MVP.
- Do not mix Runbook with Agent Queue in MVP.
- Do not make Agent Queue a universal workflow engine yet.
- Do not add a Coordinator dependency to basic work.
- Do not put every feature into Agent Executor.
- Keep each widget explainable in one sentence.

## One-Sentence Widget Roles

The current user-facing workbench widget set is:

- Agent Executor: run one task and show execution.
- Agent Queue: organize tasks and executor history.
- Interactive Agent: manually chat/work with an agent.
- Runbook: follow and manage procedural steps.
- Git Widget: review repository state.
- Terminal: run manual one-shot commands.
- Notes: write/save local notes.

## Recommended Next Blocks

- Add Runbook minimal UI.
- Add Interactive Agent session persistence later.
- Add Interactive Agent provider/Codex integration later.
- Keep Coordinator deferred.
