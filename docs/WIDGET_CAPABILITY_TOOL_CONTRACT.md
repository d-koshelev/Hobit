# Widget Capability Tool Contract

## Purpose

This contract defines how Hobit widgets expose controlled capabilities/tools to
Coordinator Chat.

Coordinator Chat is the primary operator-facing AI surface, but Coordinator
must not gain hidden access to all Workspace data or bypass widget boundaries.
The goal is to make Coordinator useful by letting it work through explicit,
widget-defined capability boundaries with clear risk, approval, context, and
observability rules.

This document is docs/contracts only. It does not implement frontend UI,
backend or Tauri commands, storage/schema changes, Coordinator runtime, AI
provider integration, widget tool execution, JDBC implementation, Git mutation,
Terminal or PTY work, Queue behavior, Agent Executor behavior, Notes behavior,
or Runbook work.

## One-Sentence Rule

Coordinator can use widget capabilities only through explicit widget-defined
tool boundaries.

## What A Widget Capability Is

A widget capability is a named operation exposed by a widget.

A capability has:

- typed input
- typed output
- a risk level
- permission and autonomy requirements
- clear data exposure rules
- audit and observability expectations

Examples:

- Git status read
- Git diff summary read
- Create local Git commit
- Create Queue task
- Start assigned Queue task
- Create Note
- Run read-only SQL through JDBC

A capability belongs to the widget that exposes it. Coordinator may request or
propose use of that capability, but it does not own the widget internals.

## What A Widget Capability Is Not

A widget capability is not:

- raw access to widget internals
- hidden Workspace-wide access
- arbitrary command execution
- direct secret access
- a way to bypass widget UI or policy
- unrestricted tool use by AI
- automatic mutation unless allowed by an explicit autonomy policy

Coordinator must not treat widget capability access as permission to inspect
all widget state, logs, results, files, credentials, repositories, notes,
queues, or external systems.

## Capability Descriptor Model

A future capability descriptor should define:

- `capability_id`
- `widget_definition_id`
- `widget_instance_id` when instance-scoped
- `display_name`
- `description`
- `input_schema`
- `output_schema`
- `risk_level`
- `autonomy_allowed_modes`
- `requires_confirmation`
- `requires_selected_context`
- `secrets_policy`
- `result_visibility`
- `audit_level`
- `side_effects`
- `enabled_state`
- `unsupported_reason`

This model is conceptual only. It does not define a storage schema, Rust type,
TypeScript type, API DTO, Tauri command, or runtime registry in this block.

## Risk Levels

Capability risk levels:

- `read_only`
- `analysis_only`
- `local_write`
- `external_read`
- `external_write`
- `destructive`
- `secret_sensitive`

Examples:

- Git status is `read_only`.
- Git diff summary is `read_only`.
- Asking AI to explain a selected SQL query is `analysis_only` if no external
  system is queried.
- Git local commit is `local_write`.
- Creating or updating a Note is `local_write`.
- Creating or updating a Queue task is `local_write`.
- JDBC `SELECT` is `external_read`.
- JDBC write SQL is `external_write` and is not in the first JDBC slice.
- Workspace deletion is `destructive`.
- A connector metadata action that can expose credential-bearing values is
  `secret_sensitive` unless the output is masked.
- Terminal command execution is high risk and manual only in the MVP.

Risk levels are not just labels. They determine default confirmation,
autonomy, context exposure, UI warning, and audit expectations.

## Autonomy And Confirmation Model

Capabilities must declare how they interact with Coordinator autonomy.

### Manual Mode

Coordinator proposes an action. The operator approves before execution.

### Guided Mode

Coordinator may perform low-risk read-only capabilities only when policy allows
that exact capability and context scope. Risky actions still require operator
approval.

### Autonomous Bounded Mode

Coordinator may execute explicitly allowed capabilities within declared bounds,
budgets, targets, and validation requirements.

### Dangerous Or Full Access

Dangerous or full access is future-only and must not be the default. It
requires strong warnings and external sandboxing before it can be considered.

Some capabilities always require explicit confirmation:

- Git commit
- push later
- destructive actions
- write SQL
- Terminal command execution
- Workspace deletion
- widget deletion

Future autonomy policy may become more expressive, but it must not silently
weaken these boundaries.

## Context Exposure Policy

A capability must define what data is sent to AI.

Coordinator must not automatically receive:

- all notes
- all logs
- all Queue tasks
- all SQL results
- all Git diffs
- all Terminal output
- secrets
- database credentials
- provider tokens

Capabilities should expose compact outputs by default:

- summaries
- previews
- capped results
- structured facts
- selected evidence

Full raw data requires explicit inclusion. Large logs, full diffs, large SQL
result sets, complete note collections, and Terminal transcripts must not be
included as hidden context.

## Secrets Policy

Secrets never enter AI prompts.

Rules:

- database passwords and tokens are not returned by capabilities
- connection strings must be masked
- provider API keys are backend-only
- secret-bearing capability outputs must be redacted by default
- Coordinator must not request or store raw secrets as ordinary context
- widgets that handle secrets must return only safe metadata unless a later
  contract defines a stronger secret-handling model

## Audit And Observability

Future capability execution should be auditable.

Later implementation should record or expose:

- who or what requested the capability
- widget instance
- capability id
- input summary
- approval mode
- result summary
- timestamp
- error
- whether AI saw the result

This block does not implement audit storage or event persistence.

## Capability Lifecycle

Capability lifecycle states:

- `available`
- `disabled`
- `unsupported`
- `requires_configuration`
- `requires_confirmation`
- `running`
- `completed`
- `failed`

Coordinator should show unsupported or disabled capabilities honestly. It must
not pretend that browser-only fallbacks, missing desktop APIs, missing
connectors, missing execution workspace boundaries, missing repository roots
for Git-specific actions, or unconfigured providers are usable.

## Agent Executor Capabilities

Current and future Agent Executor capabilities include:

- run Direct Work task
- stop active run
- read run status
- read run history
- read run result
- read validation result
- read diff summary

Boundaries:

- Agent Executor is the execution surface.
- Coordinator may propose a task for Agent Executor.
- Coordinator may create a Queue task for later Executor work through Agent
  Queue capability boundaries.
- Coordinator must not silently start Executor runs unless an explicit future
  autonomy policy allows that exact capability and context.
- No auto-commit.
- No push.

Agent Executor owns live execution visibility: logs, result, diff, validation,
history, and stop/cancel.

## Agent Queue Capabilities

Current and future Agent Queue capabilities include:

- create Queue task
- list Queue tasks
- update Queue task
- assign executor
- clear assignment
- start assigned task with an explicit action
- read task status

Boundaries:

- Queue is task organization.
- No scheduler.
- No auto-dispatch.
- No hidden execution.
- Queue does not show live logs.
- Agent Executor owns execution visibility.

Coordinator may create or update Queue tasks only through visible Queue
capabilities and approved context/policy.

## Git Capabilities

Current and future Git capabilities include:

- read status
- read diff summary
- create local commit with confirmation
- suggest commit message later
- prepare PR summary later
- push later only after a separate push contract

Boundaries:

- No auto-commit.
- No auto-push.
- No reset, clean, checkout, or restore from Coordinator.
- Local commit requires explicit confirmation unless a future autonomy policy
  explicitly allows it, and even then it must not be default.
- Repository root must be explicit and operator-approved before Git reads.
- Git capability outputs must not automatically expose secrets, full diffs, or
  sensitive file contents to AI.

## Notes Capabilities

Current and future Notes capabilities include:

- create note
- list notes
- read selected note
- update selected note
- save Coordinator summary as note later

Boundaries:

- Notes are Workspace-local unless a future contract defines global sharing.
- Notes are not hidden AI context.
- Coordinator may use selected or approved notes only.
- No automatic provider sharing.
- No hidden note mutation.

## Terminal Capabilities

Terminal is currently a bounded one-shot command runner.

Future Terminal direction is a PTY manual operator shell.

Boundaries:

- The current one-shot path remains an explicit `Run command` capability until
  PTY support lands.
- Coordinator must not control Terminal in the MVP.
- No hidden shell execution.
- Terminal commands require explicit operator action.
- No Queue-driven Terminal launch.
- Terminal output must not become hidden Coordinator context.
- Future PTY sessions must be visible in the owning Terminal widget and scoped
  to an explicit execution workspace / working directory.

Terminal remains a manual operator surface, not a Coordinator execution backend.

## JDBC Capabilities

First-version target JDBC capabilities:

- list connectors
- select connector
- show connector metadata
- run approved read-only SQL
- run `EXPLAIN`
- return capped result sample
- return capped explain output
- ask AI to explain SQL
- ask AI to optimize SQL
- ask AI to explain `EXPLAIN` plan

Boundaries:

- read-only by default
- no write SQL in the first slice
- no secrets in prompts
- row and output caps
- explicit approval or autonomy policy required to run a query
- AI may suggest SQL, but execution is through the JDBC widget capability only
- result sharing to AI is explicit and inspectable

JDBC is the first practical Coordinator tool/proxy scenario. The connector
metadata model and Preview metadata UI exist, but SQL execution and Coordinator
capability use remain contract-gated. The JDBC product and safety model is
defined in `docs/JDBC_WIDGET_CONTRACT.md`.

## Coordinator Chat Capabilities

Coordinator itself may have capabilities:

- ask clarifying question
- summarize conversation
- propose action
- create action card
- compile context pack later
- create Queue task through Queue capability
- save summary to Notes through Notes capability

Coordinator must not bypass widgets. Any action that uses widget state,
external systems, files, repositories, tasks, notes, or processes must go
through the owning widget capability boundary.

## Evidence And Sources Relationship

Capabilities can produce evidence candidates:

- SQL result
- `EXPLAIN` output
- Git diff
- validation result
- commit result
- note
- Queue task result
- YouTube analysis snapshot later

AI interpretation is not evidence unless marked as AI interpretation.

Evidence/Sources is a future trust layer. It should preserve source,
timestamp, context, approval status, and whether the AI saw the evidence.
The detailed Evidence/Sources boundary is defined in
`docs/EVIDENCE_SOURCES_CONTRACT.md`. Capability outputs must not become
AI-readable context automatically.

## Token Economy Relationship

Capabilities should return compact structured outputs by default.

Large outputs should be capped. Coordinator should request more context only
when needed and when allowed by policy.

Future context compilation should prefer summaries, selected artifacts, capped
samples, and evidence items over raw data.

## UI Direction

Future Coordinator action cards should show:

- capability name
- target widget
- input preview
- risk level
- context included
- confirmation status
- result summary

Action cards are preview and approval surfaces, not hidden execution. This
block does not implement action cards.

## Relationship To Tool Actions

Widget capabilities are the operations that widgets expose. Tool Actions are
the visible requests or executions of those capabilities.

When Coordinator proposes or runs a capability, the action must still follow
`docs/TOOL_ACTION_CONTRACT.md`: typed request, purpose, risk, approval
requirement, expected output, visible result, and operator awareness for
state-changing or external effects.

## Recommended Follow-Up Blocks

- JDBC read-only query execution backend.
- JDBC result grid UI.
- Coordinator action proposal UI pattern.
- Coordinator to JDBC read-only query proposal flow.
- Coordinator to Queue task creation flow.
- Evidence/Sources storage/API foundation.
- AI context/token economy contract.

## Non-Goals

This contract does not implement:

- frontend UI
- backend or Tauri commands
- storage/schema changes
- AI provider integration
- Coordinator runtime
- widget tool execution
- JDBC implementation
- Git mutation
- Terminal or PTY work
- Queue behavior changes
- Agent Executor behavior changes
- Notes behavior changes
- Runbook work
