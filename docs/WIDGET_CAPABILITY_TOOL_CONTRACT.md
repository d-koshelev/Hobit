# Widget Capability Tool Contract

## Purpose

This contract defines how Hobit widgets expose controlled capabilities/tools to
Coordinator.

Coordinator is the primary foreground AI agent and operator-facing work
surface. Chat is the primary interaction model, not the capability limit.
Coordinator must eventually be able to use all approved Workspace
functionality through explicit capability providers, but it must not gain
hidden access to all Workspace data or bypass widget boundaries. The goal is
to make Coordinator useful by letting it work through explicit, widget-defined
capability boundaries with clear risk, approval, context, and observability
rules.

This document is docs/contracts only. It does not implement frontend UI,
backend or Tauri commands, storage/schema changes, Coordinator runtime, AI
provider integration, widget tool execution, JDBC implementation, Git mutation,
Terminal or PTY work, Queue behavior, Agent Executor behavior, Notes behavior,
or Runbook work.

## One-Sentence Rule

Coordinator can use Workspace capabilities only through explicit
widget-defined or Workspace-defined tool boundaries.

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

- Read selected Workspace files
- Propose/apply file edit with diff preview
- Run approved validation command
- Run approved Terminal or SSH command
- Git status read
- Git diff summary read
- Create local Git commit
- Create Queue task
- Start assigned Queue task
- Create Note
- Run read-only SQL through JDBC
- Attach selected Skill guidance
- Read Executor run metadata or selected result excerpt

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

## Capability Providers

Widgets are not only UI panels. In the target architecture they are UI
surfaces plus capability providers for Coordinator:

- Filesystem/code capability provider: selected file and directory reads,
  diff-preview edit proposals, approved edit apply, and code review over
  approved context.
- JDBC widget: database connector metadata, approved read-only SQL, capped
  result samples, explain output when implemented, and database result
  context.
- Terminal / SSH: command and remote execution capabilities with explicit
  target, working directory or remote scope, command preview, caps, and
  confirmation/policy.
- Git widget: status, diff, commit-message assistance, and approval-gated
  local commit capabilities.
- Skill Library / Knowledge: selected Skill lookup/attach/use and future
  approved Knowledge context.
- Notes: selected note read/update/create and summary-save capabilities.
- Agent Queue: task creation, status, assignment, delegation, and async work
  organization capabilities.
- Agent Executor: run/review/result capabilities for queued/background
  execution, including safe run metadata and selected excerpts.
- Run history: safe run-link metadata, selected result summaries, and future
  approved Raw/Overview/Result views.
- Future Artifacts / Evidence: approved source-backed context and result
  references.

Each provider owns its policy, inputs, output classification, logs/results,
and failure display. Coordinator requests or proposes provider capabilities;
it does not become the hidden owner of provider internals.

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

## Safety And Action Levels

Capability descriptors must also map to operator-facing action levels:

- Safe read: bounded metadata, selected summaries, selected visible text, or
  capped previews with no secrets or sensitive raw payloads.
- Sensitive read: selected source files, raw logs, raw command output, database
  rows, full diffs, large Notes, or other material requiring explicit
  inclusion, capping, and redaction rules.
- Mutation: local file edits, Notes updates, Queue task changes, Git local
  commits, artifact/evidence updates, or other Workspace-local state changes.
- Remote/database action: JDBC execution, SSH, remote commands, external APIs,
  or other external-system reads/writes.
- Async execution: delegation to Queue/Agent Executor or future durable runner
  starts.

The Workspace/project boundary must be explicit before file, Git, command,
Terminal, SSH, database, or Executor work. Dangerous actions require
confirmation or an explicit future policy. Queue Autorun starts remain
operator-explicit.

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
- SSH command execution
- file mutation
- Queue/Executor async execution starts
- Workspace deletion
- widget deletion

Future autonomy policy may become more expressive, but it must not silently
weaken these boundaries.

## Coordinator Modes

Coordinator capability use should identify the active mode:

- Chat / Reasoning mode.
- Workspace Read mode.
- Workspace Action mode.
- Command / Validation mode.
- Async Delegation mode through Queue/Executor.

Mode labels are product semantics for future UX and audit. They do not grant
permission by themselves.

## Context Exposure Policy

A capability must define what data is sent to AI.

Coordinator must not automatically receive:

- all files
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

- Agent Executor is the async/background execution surface for Queue/Executor
  work.
- Coordinator may propose a task for Agent Executor.
- Coordinator may create a Queue task for later Executor work through Agent
  Queue capability boundaries.
- Coordinator must not silently start Executor runs unless an explicit future
  autonomy policy allows that exact capability and context.
- No auto-commit.
- No push.

Agent Executor owns live execution visibility: logs, result, diff, validation,
history, and stop/cancel.

Executor is the async/background worker for bounded Queue tasks. It does not
define the maximum capability set available to Coordinator for foreground
interactive work.

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

- Queue is task organization for promoted, larger, delayed, long-running, or
  overnight work.
- No backend scheduler.
- No hidden or unarmed auto-dispatch.
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

## Terminal / SSH Capabilities

Terminal is currently a PTY-first manual operator shell with a bounded
one-shot command runner retained as a collapsed legacy fallback.

Boundaries:

- The current one-shot path remains a compatibility capability but is no longer
  the normal visible Terminal surface.
- Coordinator must not control Terminal in the MVP.
- No hidden shell execution.
- Terminal commands require explicit operator action.
- No Queue-driven Terminal launch.
- Terminal output must not become hidden Coordinator context.
- Future PTY sessions must be visible in the owning Terminal widget and scoped
  to an explicit execution workspace / working directory.
- SSH is a future capability surface. It must require explicit remote target,
  command preview, credential/secret isolation, output caps, and approval or
  policy before any remote command runs.

Terminal and SSH are capability providers only when future policy and UI make
their actions explicit, visible, attributable, capped, and reviewable.

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

## Skill Library / Knowledge Capabilities

Current and future Skill Library / Knowledge capabilities include:

- list or search approved Skills later
- read selected Skill
- attach selected Skill to Coordinator
- use selected Skill guidance in the current request
- promote reviewed Knowledge or Evidence later

Boundaries:

- Skills and Knowledge are not hidden AI memory.
- Coordinator may use only selected or approved Skill/Knowledge context.
- Secret-bearing or sensitive Knowledge must not enter prompts.
- Skill selection/use must remain visible and attributable.

## Filesystem / Code Capabilities

Future filesystem and code capabilities include:

- read selected file
- read bounded directory summary
- propose file edit with diff preview
- apply approved file edit
- review approved code or diff
- run approved validation command against an explicit Workspace/project root

Boundaries:

- No silent unbounded scanning.
- No hidden file reads.
- No silent mutation.
- Workspace/project root must be explicit.
- Diffs must be previewed before apply.
- Command and validation output must be capped and classified.

## Coordinator Capabilities

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

## Coordinator Provider Tool Boundary

The first provider-backed Coordinator slice has no tools.

Provider requests must declare:

```text
allowed_tools: []
```

The provider may draft assistant text and structured proposal drafts, but it
must not call widget capabilities, inspect widget internals, create Queue
tasks, create Notes, execute Terminal commands, run SQL, mutate Git, launch
Agent Executor, read files, or compile hidden context.

Provider-generated proposal drafts are descriptive requests only. They must be
validated against the current supported proposal types or a later explicit
capability descriptor before rendering. Only an approved proposal can proceed
to a separate visible operator action, and that action must still be owned by
the target widget capability boundary.

## Coordinator Action Proposal Boundary

A Coordinator action proposal is an inert, visible request to use a widget
capability later. It is not capability execution and does not grant hidden
access to widget internals.

The proposal model should include:

- title
- target widget or widget kind
- target capability
- intent
- required inputs
- visible risk/safety notes
- expected result
- approval status
- execution status
- result summary

The first implementation may use a static frontend registry of supported
proposal types. That registry may describe display labels, required inputs,
target widget kinds, risk notes, and unsupported reasons. It must not introspect
widget state, logs, output buffers, files, repositories, databases, notes,
environment variables, or secrets.

Initial safe proposal types:

- Create Agent Queue task from explicit Coordinator/operator text.
- Create Note from explicit Coordinator/operator text.
- Prepare JDBC query suggestion text without execution.

Out of first-slice proposal execution:

- Terminal PTY or one-shot command execution.
- Git mutation, including commit, push, reset, clean, stash, checkout, or
  restore.
- JDBC SQL execution.
- Agent Executor run launch.
- Queue auto-dispatch.
- hidden context compilation.

Only an approved proposal can become a Tool Action, and that conversion must
still pass through the owning widget capability boundary and the Tool Action
approval model.

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

- title
- capability name
- target widget
- intent
- input preview
- risk level
- visible risk/safety notes
- context included
- approval status
- execution status
- expected result
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

- Coordinator provider adapter foundation with mock/local provider first and
  tools disabled.
- Provider-backed Coordinator text response with explicit visible context only.
- Provider structured proposal drafts rendered as review cards, still no
  execution.
- Later controlled widget capability bridge.
- Current bounded mock/safe JDBC read-only validation/execution remains owned
  by the Database / JDBC widget and is not a Coordinator tool today.
- Later production JDBC runtime and richer result grid UI.
- Later Coordinator to JDBC read-only query proposal flow.
- Evidence/Sources storage/API foundation.
- AI context/token economy contract.

## Coordinator Capability Roadmap

Near-term target sequence:

1. Coordinator capability registry.
2. Coordinator read selected Workspace files.
3. Coordinator propose/apply file edits with diff preview.
4. Coordinator command/validation action.
5. Coordinator JDBC widget capability.
6. Coordinator SSH/Terminal capability.
7. Policy/approval model.
8. Background delegation through Queue/Executor.

## Non-Goals

This contract does not implement:

- frontend UI
- backend or Tauri commands
- storage/schema changes
- AI provider integration
- Coordinator runtime
- widget tool execution
- direct Coordinator filesystem read/write capability
- direct Coordinator command, Terminal, SSH, JDBC, Git, Queue, Executor, or
  artifact capability execution
- unified policy/approval UI
- audit emission or persistence
- production JDBC implementation
- Git mutation
- Terminal or PTY work
- Queue behavior changes
- Agent Executor behavior changes
- Notes behavior changes
- Runbook work
