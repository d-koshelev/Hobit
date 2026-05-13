# Runbook Widget Contract

## Purpose

Runbook is a separate widget for step-based procedural work.

It helps the operator follow, track, and complete a sequence of steps for
operational procedures, investigation flows, deployment checklists, incident
response, diagnostics, and repeatable engineering procedures.

This contract is docs-only. It does not implement frontend UI, runtime
behavior, provider integration, Tauri commands, storage/schema changes, queue
execution, Agent Executor integration, Interactive Agent integration, Git
mutation, Terminal execution, file mutation, tool execution, PTY, or an
interactive process/session.

## One-Sentence Role

Runbook: follow and manage procedural steps.

## What Runbook Is

Runbook is:

- a separate Workbench widget
- a surface for ordered procedural steps
- a list of steps plus selected step details
- a place to show step state, instructions, notes, and evidence
- manual-first in v1
- useful for operational procedures, investigations, deployments, incident
  response, diagnostics, and repeatable engineering procedures

The operator controls step progress, state changes, notes, and evidence. The
Runbook surface should make the current step and next operator action obvious.

## What Runbook Is Not In V1

Runbook is not:

- Agent Queue
- Agent Executor
- Interactive Agent
- Coordinator
- an automatic scheduler
- an automatic tool runner
- queue execution
- agent execution
- Git mutation
- Terminal automation
- an approval/apply workflow

Runbook v1 must not dispatch queue items, launch Agent Executor tasks, start
Interactive Agent sessions, run Terminal commands, mutate Git, mutate files,
execute tools, create queue items automatically, or depend on Coordinator.

## Step Model

The initial Runbook step model should stay small and explicit.

Initial step fields:

- `id`
- `title`
- `description` or `instructions`
- `state`
- `notes` or `evidence`

Future optional step fields:

- `command_text`
- `expected_result`

The future fields are descriptive until a later block explicitly adds behavior.
They must not imply automatic Terminal execution, Git mutation, file mutation,
or agent execution.

## Step States

Initial step states:

- `pending`
- `running`
- `done`
- `failed`
- `skipped`
- `blocked`

State meanings:

- `pending`: not started
- `running`: currently being worked on
- `done`: completed successfully
- `failed`: attempted but failed
- `skipped`: intentionally skipped
- `blocked`: cannot proceed until something else happens

State changes are operator-visible workflow state. They are not Queue execution,
Agent Executor execution, Terminal execution, or hidden automation.

## MVP Behavior

### Minimal

The first implementation target should be a local/manual runbook surface:

- list of sample or current-session steps
- selected step details
- visible state per step
- manual step state changes
- notes or evidence editing if simple
- no backend unless explicitly scoped
- no queue integration
- no Agent Executor integration
- no Interactive Agent integration
- no agent assistance
- no tool execution
- no Git mutation
- no Terminal execution
- no file mutation

Minimal Runbook should be honest about whether steps are sample, local
current-session, or persisted.

### Operational Later

Operational behavior may add:

- runbook editing
- add, remove, and reorder steps
- commands or checks per step as explicit text first
- evidence attachment
- step history
- runbook persistence
- reusable runbook templates

Each item requires a focused block and must preserve explicit operator control.

### Full / Expert Later

Full / Expert behavior may add:

- runbook builder from documentation
- runbook builder from knowledge base content
- runbook builder from web or internet sources
- agent-assisted step interpretation
- semi-automatic agent help inside a step
- optional handoff from a step to Agent Executor
- optional runbook result and history
- versioning and templates

Full / Expert behavior must not become the default first surface.

## Agent Assistance Boundary

Future agent assistance inside a Runbook step may help by:

- explaining the step
- suggesting a command or check
- interpreting evidence
- proposing a next action

In v1, Runbook must not:

- execute agents
- execute tools automatically
- read hidden context
- create queue items automatically
- launch Agent Executor
- start Interactive Agent automatically
- mutate files, Git, Terminal state, Notes, Queue, or workspace content

Agent proposes; operator controls.

## Relationship To Agent Queue

Runbook is not Agent Queue in v1.

Runbook steps are procedural workflow state. Queue items are future queued agent
work and executor history.

Future behavior may allow:

- a Runbook step to create a Queue item
- Agent Queue to track runbook-related tasks

Those integrations must be explicit, operator-controlled, and separately
scoped. They are not part of the MVP.

## Relationship To Agent Executor

Runbook does not execute Agent Executor tasks in v1.

Agent Executor runs one operator-approved task. Runbook follows procedural
steps.

Future behavior may allow:

- a step to hand off selected work to Agent Executor
- an Agent Executor result to be attached back to the step

That handoff must be explicit, previewed where needed, and separately scoped.
It is not part of the MVP.

## Relationship To Interactive Agent

Interactive Agent is manual long-chat work with an agent.

Runbook is structured step work.

Future behavior may allow:

- a step to ask Interactive Agent for help
- conversation output to be copied into step evidence

Those integrations must be explicit and are not part of the MVP.

## Relationship To Terminal And Git

For MVP:

- Runbook does not run Terminal commands automatically.
- Runbook does not mutate Git.
- Command text, if present later, is descriptive until an explicit execution
  feature is scoped.

Future behavior may add command copy/run affordances or Git Widget links when a
runbook involves repository work. Git mutations, Terminal execution, and file
mutation remain separate explicit features and must not be hidden in Runbook.

## UI Guidance

For the v1 placeholder or Minimal UI:

- use a simple step list
- show selected step details
- show visible state per step
- use calm status styling
- keep copy short
- avoid overloaded future controls
- avoid raw/debug panels by default
- do not include agent, queue, executor, Git mutation, Terminal automation, or
  Coordinator controls in the minimal surface

The widget should follow `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` and
start at Minimal unless a later prompt explicitly targets Operational or Full /
Expert.

## Recommended Next Blocks

- Block 166  Runbook minimal UI
- Later  Runbook edit MVP
- Later  Runbook persistence
- Later  Runbook builder from pasted documentation
- Later  Runbook builder from knowledge/web sources
- Later  optional agent assistance inside a step
- Later  optional handoff to Agent Executor

## Non-Goals

This contract does not implement:

- frontend UI
- runtime behavior
- provider or LLM integration
- Codex execution
- Agent Executor integration
- Agent Queue integration
- Interactive Agent integration
- storage/schema changes
- Tauri commands
- Git mutation
- Terminal execution
- file mutation
- tool execution
- hidden context
- commit, push, stage, reset, clean, or stash
- PTY or interactive process/session implementation
