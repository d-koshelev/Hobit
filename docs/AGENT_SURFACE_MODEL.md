# Agent Surface Model

## Purpose

This contract defines Hobit's near-term agent and work surface model.

Coordinator Chat has returned as the primary operator-facing AI surface. The
updated product model is defined in
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

The goal is to keep the Workbench explainable by separating conversation and
planning, task organization, execution, and procedural runbooks. Coordinator
Chat is the conversation/planning surface; widgets expose controlled
capabilities; Agent Queue organizes executable tasks; Agent Executor executes
tasks and shows what ran.

This document is docs-only. It does not implement runtime behavior, frontend
UI, storage, schema, Tauri commands, queue execution, Interactive Agent, Runbook
behavior, Coordinator behavior, or Git mutation.

## Near-Term Surfaces

### Coordinator Chat

Coordinator Chat is the main operator-facing AI chat.

Near-term direction:

- reposition the existing Interactive Agent direction into Coordinator Chat
- do not keep separate freeform Interactive Agent plus Coordinator concepts in
  the near-term product
- reuse the current `interactive-agent` widget id/component as a
  compatibility/minimal UI foundation
- use widgets as controlled capability/tool surfaces, not hidden context stores

Coordinator Chat must follow
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`: no hidden Workspace reads, no
silent widget access, no secret use, no silent Terminal launch, no automatic
Queue dispatch, and no Git mutation without explicit approval.

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
- Each Agent Executor widget instance is a visible execution slot. The current
  UI uses the stable widget instance id as the technical slot identity.

Agent Executor should include:

- prompt or task input
- execution workspace or workspace boundary
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
- eventually route tasks to available Agent Executors through explicit
  operator-controlled start flows
- keep executor run history
- remain one Agent Queue per Workspace

Later Agent Queue may include:

- queue items
- statuses
- dependencies
- executor assignment
- history of executor runs

The future Queue Item model, dependency model, and executor capacity model are
defined in `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`. Detailed manual
Queue-to-Executor assignment rules are defined in
`docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`.
Manual run of an assigned Queue task is defined in
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`. A manual run foundation now exists;
automatic dispatch and scheduling remain future work.

Near-term simplification:

- keep Agent Queue as queue, review, and history
- prevent adding new duplicate Agent Queue widgets in one Workspace while
  preserving any existing persisted duplicates
- do not make it a universal workflow engine yet
- do not auto-dispatch or schedule queue items until those behaviors are
  explicitly implemented in later blocks

### Interactive Agent / Coordinator Chat Compatibility

The previous Interactive Agent direction is now repositioned as Coordinator
Chat. The widget contract is retained for compatibility and is superseded for
near-term product direction by
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

The legacy widget contract is defined in
`docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`.

Role:

- support the minimal local chat foundation now presented as Coordinator Chat
- preserve explicit context and action boundaries
- avoid separate freeform chat and Coordinator surfaces in the near term

MVP direction:

- chat transcript
- user messages
- agent responses
- explicit context selection later
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

## Coordinator-Centered Direction

Coordinator is no longer deferred as a product concept.

Coordinator Chat is the primary operator-facing AI surface, while widgets
remain controlled capability surfaces. Agent Queue remains task organization,
Agent Executor remains execution visibility, and Runbook remains deferred.

For now:

- do not implement Coordinator runtime in documentation blocks
- do not give Coordinator hidden Workspace or widget access
- do not make Queue a chat or global orchestrator
- do not let Coordinator silently launch Executor, Terminal, Git, SQL, or Queue
  actions
- keep future Coordinator behavior bound by
  `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and
  `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`

## Parallelism Model

The number of Agent Executor widgets determines available execution slots.

- 0 Agent Executors means queued work cannot run.
- 1 Agent Executor means one task can run at a time.
- N Agent Executors means up to N tasks may run concurrently.
- Current Agent Executor widgets show a compact slot identity. Agent Queue can
  manually assign tasks to those slots and explicitly start assigned tasks
  under `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

Automatic scheduling is future work. Manual execution from Agent Queue and
manual execution from an Agent Executor remain valid.

## Git Widget Binding Direction

Git Widget can remain independent.

Future binding direction:

- Git Widget can link to an Agent Executor.
- Git Widget can later link to a Runbook or Coordinator Chat if useful.
- Coordinator links must follow the Coordinator-centered capability model.
- Multiple Git Widgets may exist.
- Git Widget currently provides read-only status/diff review plus explicit
  selected-file local commit with operator confirmation. Push, reset, clean,
  stash, fetch, polling, watching, auto-commit, and Agent Executor auto-commit
  remain out of scope.

## What Not To Mix

- Do not keep separate Interactive Agent and Coordinator Chat concepts in the
  near-term product.
- Do not mix Coordinator Chat with Agent Queue responsibilities.
- Do not mix Runbook with Agent Queue in MVP.
- Do not make Agent Queue a universal workflow engine yet.
- Do not put every feature into Agent Executor.
- Keep each widget explainable in one sentence.

## One-Sentence Widget Roles

The current user-facing workbench widget set is:

- Agent Executor: run one task and show execution.
- Agent Queue: organize tasks and executor history.
- Coordinator Chat: understand, plan, propose controlled widget actions, and
  interpret results.
- Runbook: follow and manage procedural steps.
- Database / JDBC: manage connector metadata now; later run approved read-only
  SQL through controlled capabilities.
- Git Widget: review repository state.
- Terminal: run manual PTY sessions, with a collapsed legacy one-shot fallback.
- Notes: write/save local notes.

## Recommended Next Blocks

- Coordinator provider adapter foundation with mock/local provider first and
  tools disabled.
- Provider-backed Coordinator text response with explicit visible context only.
- Provider structured proposal drafts rendered as review cards, still no
  execution.
- Later controlled widget capability bridge.
- Later JDBC read-only query execution backend.
- Later JDBC result grid UI.
- Runbook persistence and edit mode later.
