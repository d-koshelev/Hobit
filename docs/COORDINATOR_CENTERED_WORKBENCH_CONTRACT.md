# Coordinator-Centered Workbench Contract

## Purpose

This contract defines Hobit's Coordinator-centered product model.

Hobit is not just a canvas of independent widgets. Hobit is a Workbench where
the operator works primarily through Coordinator Chat, and widgets expose
controlled capabilities, tools, and proxy surfaces.

This document is docs/contracts only. It does not implement frontend UI,
backend or Tauri commands, storage/schema changes, AI provider integration,
Coordinator runtime, widget tool execution, JDBC implementation, Queue
execution changes, Agent Executor runtime changes, Git mutation, Terminal or
PTY work, or Runbook work.

## One-Sentence Product Model

Coordinator understands and plans. Widgets expose controlled capabilities.
Queue organizes executable tasks. Agent Executors execute tasks and provide
visibility. Operator controls autonomy and approvals.

## Coordinator Role

Coordinator Chat is the main operator-facing AI chat.

Coordinator can:

- understand a problem
- ask clarifying questions
- propose investigation steps
- propose widget actions
- interpret widget results
- create Agent Queue tasks
- summarize evidence and next steps

Coordinator must not:

- silently access every widget
- silently read all Workspace data
- bypass widget boundaries
- use secrets
- mutate Git without explicit permission
- run SQL without an approved connector/action policy
- launch Terminal commands silently
- auto-dispatch Queue tasks
- auto-commit or push

Coordinator is a planner, interpreter, and action proposer. It is not an
unrestricted background automation channel.

## Widget Capability Model

Widgets are controlled tool/proxy surfaces.

Each widget may expose selected capabilities to Coordinator. A widget capability
must remain explicit, scoped, and approval-aware where risk requires it.
The detailed descriptor, risk, autonomy, context, secrets, and audit model is
defined in `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`.

### JDBC Widget Future Capabilities

The JDBC/Database Connector widget may later expose:

- list connectors
- show selected connector metadata
- run approved read-only SQL
- run `EXPLAIN`
- return capped result samples
- return explain summaries
- send approved query, result, or explain output to AI context

Connector secrets must stay outside prompts and Coordinator context.

### Git Widget Capabilities

The Git widget may expose:

- read status
- read diff summary
- create local commit only after explicit confirmation
- suggest commit message later
- prepare PR summary later

Git mutations remain Git-widget-owned, explicit, and approval-gated.

### Notes Capabilities

Notes may expose:

- create note
- list notes
- read selected note
- update selected note
- save Coordinator summary as note later

Notes content must not become hidden Coordinator context.

### Agent Queue Capabilities

Agent Queue may expose:

- create task
- list tasks
- update task
- assign executor
- start assigned task only through an explicit run action

Queue is not the Coordinator and must not become a hidden scheduler.

### Agent Executor Capabilities

Agent Executor may expose:

- run task
- show run status
- show logs, result, diff, validation, and history
- stop run

Agent Executor owns live execution visibility.

### Terminal Capabilities

Terminal currently exposes a one-shot command widget only.

Future PTY behavior is a manual operator shell. Coordinator must not control
Terminal in the MVP.

## Coordinator And Agent Queue

Agent Queue is task organization for Agent Executors.

Coordinator may create Queue tasks after operator approval or according to a
future explicit autonomy policy.

Agent Queue does not replace Coordinator. Agent Queue is not a chat. Agent
Queue does not reason. Agent Queue does not auto-dispatch in the current model.

## Coordinator And Agent Executor

Agent Executor executes tasks.

Coordinator may propose a task for Agent Executor. Coordinator may create a
Queue item for execution. Coordinator must not silently launch Executor work
without visible policy and action.

Agent Executor owns:

- live logs
- result
- diff
- validation
- history
- stop/cancel

Coordinator owns:

- conversation
- planning
- interpretation
- task proposal
- summary

## Coordinator And JDBC

JDBC/Database Connector is a first-version scope candidate.

Coordinator should use JDBC only through the JDBC widget capability boundary.

JDBC safety rules:

- read-only by default
- connector secrets never enter prompts
- SQL execution requires explicit approval or an approved autonomy mode
- query result rows are capped
- result sharing to AI is explicit
- write SQL is not in the first slice
- `EXPLAIN` is read-only
- AI may suggest SQL or optimization, but operator or policy decides execution

## Coordinator And Evidence/Sources

Evidence/Sources is a future trust layer.

Coordinator should eventually ground analysis in evidence such as:

- SQL result
- `EXPLAIN` output
- Git diff
- validation result
- YouTube analytics snapshot
- notes
- external source

AI output is not itself evidence unless marked as AI interpretation.

Evidence should track source, timestamp, context, and approval for AI use.

## Autonomy Policy

Coordinator must support autonomy levels in the future.

Conceptual modes:

- manual approval
- guided
- autonomous bounded
- dangerous or full access later

### Manual Approval

Coordinator proposes actions. Operator approves.

### Guided

Coordinator may perform low-risk read-only actions under policy. Risky actions
require approval.

### Autonomous Bounded

Coordinator can work within explicit bounds, budgets, allowed tools, and
validation requirements.

### Dangerous Or Full Access

Dangerous or full access is not default. It is future-only and requires strong
warnings and external sandboxing.

## Action Proposal Pattern

Coordinator actions should be visible as action cards.

Examples:

- Run read-only SQL
- Create Queue task
- Assign Queue task to Executor
- Start assigned task
- Create local commit
- Save summary as Note

An action card should show:

- action type
- target widget
- input preview
- risk level
- what data will be used
- what will happen
- confirmation or policy status

## Context Policy

Coordinator should not receive all Workspace data by default.

Coordinator context must be explicit and inspectable.

Possible context sources:

- current conversation
- selected widget state
- selected Queue task
- selected Note
- selected Git diff
- selected validation result
- selected SQL result
- selected evidence item
- recent Workspace summary

A future context pack should show:

- what is included
- why it is included
- estimated token size
- whether the operator approved it

## Token Economy

Coordinator should use compact context.

Do not send full logs, all notes, all queue tasks, all SQL results, or all
comments by default.

Use summaries, selected artifacts, capped samples, and evidence items.

## Audit And Observability

Coordinator-driven actions should be auditable.

Later implementation should record or expose:

- who requested
- which widget capability
- input summary
- approval mode
- result summary
- timestamp
- errors
- whether AI saw the result

This contract does not implement audit storage.

## Reposition Interactive Agent

Near-term direction: Interactive Agent should become Coordinator Chat.

Do not keep two separate primary chat concepts in the current product.

The internal widget id may remain temporarily for compatibility. The
user-facing title should become Coordinator or Coordinator Chat in a later
implementation block.

The current Interactive Agent local chat can be reused as the minimal
Coordinator Chat UI foundation later.

## Runbook Status

Runbook remains Preview/minimal and deferred from the active roadmap.

Do not build Coordinator-to-Runbook integration in the near-term scope.

## Medical Domain Status

Medical and healthcare workflows are out of active roadmap due to
privacy/compliance/safety sensitivity.

Do not use medical workflows as a near-term demo or design driver.

## First Practical Coordinator Scenario

The first practical Coordinator scenario is database investigation with JDBC.

Flow:

1. Operator describes a database problem.
2. Coordinator asks clarifying questions.
3. Coordinator proposes read-only SQL.
4. JDBC widget executes the approved query.
5. Coordinator interprets the result.
6. Coordinator may create a Queue task for engineering follow-up.
7. Agent Executor may execute that task if the operator starts it.

## Recommended Next Blocks

- Block 206 - Reposition Interactive Agent as Coordinator Chat.
- Block 207 - Coordinator Chat minimal UI.
- Block 208 - JDBC widget contract.
- Block 209 - JDBC connector model/API foundation.
- Block 210 - JDBC query UI MVP.
- Block 211 - Coordinator action proposal UI pattern.
- Block 212 - Coordinator to JDBC read-only query proposal flow.
- Block 213 - Coordinator to Queue task creation flow.
- Block 214 - Evidence/Sources contract.
- Block 215 - AI context/token economy contract.

## Non-Goals

This contract does not implement:

- frontend UI
- backend implementation
- Tauri commands
- storage/schema changes
- AI provider integration
- Coordinator runtime
- widget tools implementation
- JDBC implementation
- Queue execution changes
- Agent Executor runtime changes
- Git mutation
- Terminal or PTY changes
- Runbook work
