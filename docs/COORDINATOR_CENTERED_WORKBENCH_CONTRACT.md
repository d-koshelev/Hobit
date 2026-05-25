# Workspace Agent Workbench Contract

## Purpose

This legacy-named contract defines Hobit's Workspace Agent product model.
Coordinator was the previous user-facing name for the Workspace Agent surface.
The filename remains unchanged for compatibility with existing references.

Hobit is not just a canvas of independent widgets. Hobit is a Workbench where
the operator works through one or more Workspace Agent widgets: foreground
interactive AI agents for Workspace work. Workspace Agent uses chat as the
primary interaction model, but chat is not the capability boundary. Multiple
Workspace Agents can exist in one Workspace, and each agent has independent
current-session context/thread state and working directory. Widgets expose
controlled capabilities, tools, and proxy surfaces that Workspace Agent can use
only through explicit policy, context, approval, and observability boundaries.

This document is docs/contracts only. It does not implement frontend UI,
backend or Tauri commands, storage/schema changes, AI provider integration,
Workspace Agent runtime, widget tool execution, JDBC implementation, Queue
execution changes, Agent Executor runtime changes, Git mutation, Terminal or
PTY work, or Runbook work.

## One-Sentence Product Model

Workspace Agent is the foreground interactive AI agent widget. Widgets expose
controlled Workspace capabilities. Queue organizes promoted async work. Agent
Executors run queued/background tasks and provide execution visibility.
Executor is not the only agent that can do work; it is the background worker
for queued tasks. Operator controls context, autonomy, approvals, and
acceptance.

## Workspace Agent Role

Workspace Agent is a foreground AI agent widget for one active Workspace.
Multiple Workspace Agent widgets may be open in the same Workspace when the
operator wants independent agent threads for different problems.

Workspace Agent can:

- understand a problem
- ask clarifying questions
- reason over approved Workspace context
- perform interactive Workspace work through controlled capabilities
- propose or execute approved coding, code review, file, command, validation,
  database, Git, Notes, Skill/Knowledge, Queue, Executor, run-history, and
  future Artifact/Evidence actions
- propose investigation steps
- propose widget actions
- interpret widget results
- create Agent Queue tasks when work should become async/background work
- summarize evidence and next steps

Workspace Agent must not:

- silently access every widget
- silently read all Workspace data
- bypass widget boundaries
- use secrets
- mutate Git without explicit permission
- run SQL without an approved connector/action policy
- launch Terminal commands silently
- auto-dispatch Queue tasks
- auto-commit or push

Workspace Agent is not only a planner, interpreter, or task drafter. Workspace Agent
is the foreground agent surface for interactive work. It is not an
unrestricted background automation channel, hidden scanner, or shortcut around
widget-owned capability boundaries.

## Coordinator Modes

Future Coordinator work should be described in explicit modes:

- Chat / Reasoning mode: conversation, clarification, planning, analysis,
  result review, and decision support.
- Workspace Read mode: approved reads of selected Workspace context such as
  files, Notes, Git summaries, JDBC metadata/results, Queue tasks, Executor run
  summaries, Skills, Knowledge, Artifacts, or Evidence.
- Workspace Action mode: approved local mutations such as file edits, Notes
  edits, Queue task changes, Git local actions, or future artifact/evidence
  updates through owning capability providers.
- Command / Validation mode: approved command, Terminal, SSH, validation, or
  tool actions with explicit target, working directory, caps, and result
  visibility.
- Async Delegation mode: promotion of larger, delayed, overnight, or
  long-running work to Queue and Agent Executor.

These modes are target architecture. Current Workspace Agent implements only
the visible chat/proposal/attachment subset described in
`docs/CURRENT_WIDGET_SURFACE.md`.

## Widget Capability Model

Widgets are controlled tool/proxy surfaces and Workspace capability providers.

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

Queue is not Workspace Agent and must not become a hidden scheduler.

### Agent Executor Capabilities

Agent Executor may expose:

- run task
- show run status
- show logs, result, diff, validation, and history
- stop run

Agent Executor owns live execution visibility for queued/background Executor
work. It is not the only place where AI-assisted work can happen; it is the
async/background worker path for bounded Queue tasks.

### Skill Library / Knowledge Capabilities

Skill Library and future Knowledge surfaces may expose:

- list or search approved Skills
- read selected Skill content
- attach selected Skill guidance to Coordinator
- promote reviewed knowledge or evidence later

Skill and Knowledge content must not become hidden provider prompt context.

### Filesystem And Code Capabilities

Future file/code capabilities may expose:

- read selected files or directories within the approved Workspace/project
  boundary
- propose file edits with diff preview
- apply approved edits
- run code review over approved files or diffs

No silent unbounded scanning, hidden file reads, or silent file mutation is
allowed.

### Terminal Capabilities

Terminal is currently a PTY-first manual operator shell with a collapsed legacy
one-shot command fallback.

Coordinator must not control Terminal PTY or the legacy one-shot fallback in
the MVP.

Future Terminal or SSH capabilities may expose approved command and remote
execution actions, but only with explicit target, command preview, working
directory or remote host scope, output caps, confirmation/policy, and visible
logs/results.

## Workspace Agent And Agent Queue

Agent Queue is task organization for Agent Executors.

Workspace Agent may create Queue tasks after operator approval or according to a
future explicit autonomy policy.

Agent Queue does not replace Workspace Agent. Agent Queue is not a chat. Agent
Queue does not reason. Agent Queue does not auto-dispatch in the current model.
Queue is for promoted, larger, delayed, long-running, or overnight work. It is
not the default destination for every Workspace Agent action, every file edit, or
every quick validation step.

## Workspace Agent And Agent Executor

Agent Executor is the async/background worker for Queue tasks.

Workspace Agent may propose a task for Agent Executor. Workspace Agent may create a
Queue item for execution. Workspace Agent must not silently launch Executor work
without visible policy and action.

Agent Executor owns:

- live logs
- result
- diff
- validation
- history
- stop/cancel

Workspace Agent owns:

- conversation
- planning
- interpretation
- foreground interactive work through approved capabilities
- task proposal
- summary

Executor ownership of queued/background logs and results does not limit
Workspace Agent's future foreground capability set.

## Safety And Action Levels

Capability use must classify the requested action before context is read or
work begins:

- Safe read: low-risk bounded metadata or selected content that excludes
  secrets and sensitive raw payloads.
- Sensitive read: selected files, logs, raw output, database rows, secrets-adjacent
  metadata, or other context that requires explicit inclusion and redaction
  rules.
- Mutation: local state changes such as file edits, Notes changes, Queue task
  updates, Git local commit, or artifact/evidence updates.
- Remote/database action: JDBC, SSH, remote command, external API, or other
  external-system action.
- Async execution: work delegated to Queue/Executor or future durable runners.

Dangerous actions require confirmation or a future explicit policy. Queue
Autorun and Executor starts remain explicit. Secret values must not enter
provider prompts, logs, proposal cards, or ordinary context.

## Coordinator And JDBC

JDBC/Database Connector is a first-version scope candidate.

Coordinator should use JDBC only through the JDBC widget capability boundary.
The detailed JDBC product and safety model is defined in
`docs/JDBC_WIDGET_CONTRACT.md`.

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
The detailed trust, provenance, capping, redaction, and AI-context approval
boundary is defined in `docs/EVIDENCE_SOURCES_CONTRACT.md`.

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
Coordinator must not treat raw widget output, widget state, logs, notes, SQL
results, Git diffs, or AI interpretation as approved evidence unless the
operator has reviewed and approved the evidence boundary.

Action proposals should remain compatible with future Evidence/Sources by
allowing later source or evidence references, but the proposal model must not
depend on Evidence/Sources storage/API. This contract does not implement
evidence capture, evidence review, source storage, or AI context approval.

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

Workspace Agent may perform low-risk read-only actions under policy. Risky actions
require approval.

### Autonomous Bounded

Coordinator can work within explicit bounds, budgets, allowed tools, and
validation requirements.

### Dangerous Or Full Access

Dangerous or full access is not default. It is future-only and requires strong
warnings and external sandboxing.

## Action Proposal Pattern

Coordinator actions should first appear as inert action proposals. A proposal
is a visible, reviewable plan to use a widget capability. It is not tool
execution, provider tool access, or permission to inspect hidden Workspace data.

An action proposal should define:

- `proposal_id`
- `source_message_id`
- `title`
- `target_widget`
- `target_capability`
- `intent`
- `required_inputs`
- `visible_risk_notes`
- `expected_result`
- `approval_status`
- `execution_status`
- `result_summary`

Conceptual approval statuses:

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `edited`

Conceptual execution statuses:

- `not_run`
- `running`
- `completed`
- `failed`
- `cancelled`

These fields are a product/contract model only. They do not define a storage
schema, frontend type, Rust type, Tauri command, runtime registry, provider
tool schema, or widget capability implementation in this block.

Coordinator action proposals should be visible as message-associated action
cards in Workspace Agent. A card should show the proposal title, target
widget, target capability, intent, input preview, risk/safety notes, expected
result, approval status, execution status, and result summary when one exists.

Minimum card controls:

- Approve
- Reject
- Edit
- Copy

Cards must show all inputs that would be sent to the target capability before
approval. Nothing may execute invisibly. If the first UI slice is frontend-only
and inert, Approve must clearly mean "approve this draft/preview" or remain
disabled until an execution bridge exists.

Initial implemented safe proposal types:

- Create Agent Queue task from explicit Coordinator/operator text. This creates
  a task only after operator approval; it does not start execution.
- Create Note from explicit Coordinator/operator text. This writes only the
  approved note body/title; it does not read hidden Notes content.
- Prepare JDBC query suggestion text. This is an analysis/planning proposal
  only; it must not execute SQL or inspect database metadata beyond explicit
  operator-provided text.

Do not use the first implementation slice for:

- Terminal command execution
- Git commit, push, reset, clean, stash, checkout, or restore
- JDBC SQL execution
- Agent Executor run launch
- hidden context compilation
- Queue auto-dispatch

This first implementation boundary does not define Workspace Agent's long-term
capability ceiling. It only defines what the current provider/proposal slice is
allowed to do today.

Terminal command proposals are future-only and require a separate safety
contract before any UI or runtime work. Coordinator must not control Terminal
PTY or the legacy one-shot command runner in the current slice.

## Capability Reference Boundary

The first action proposal implementation may use a static frontend proposal
type registry that lists allowed proposal types, display labels, target widget
kinds, required inputs, risk notes, and disabled/unsupported reasons.

Later work may replace or supplement that with widget capability descriptors,
but Coordinator still must not use runtime hidden introspection of widget
state. The capability boundary is descriptive until the operator approves a
specific visible action.

Coordinator must not automatically read:

- widget logs
- widget results
- Terminal output
- Agent Executor logs or final responses
- Git diffs or repository files
- JDBC connector secrets, schemas, query results, or external database data
- Notes bodies
- filesystem paths or file contents
- environment variables
- provider secrets

## Approval, Edit, And Execution Flow

The required proposal flow is:

1. Coordinator produces or displays a proposal associated with a chat message.
2. The operator reviews visible target, capability, intent, inputs, risks, and
   expected result.
3. The operator may edit proposal inputs before execution.
4. The operator approves or rejects the proposal.
5. Only an approved proposal can become a Tool Action through the target widget
   capability boundary.
6. The action result, failure, or cancellation is shown visibly on the proposal
   card or adjacent message.

Failed execution must be visible and non-silent. Approval of a proposal does
not grant broad future autonomy, hidden context access, or permission to run a
different action.

## Context Policy

Coordinator should not receive all Workspace data by default.

Coordinator context must be explicit and inspectable.

Current allowed context for the first proposal UI work:

- current conversation
- explicit operator text
- safe Workspace identity summary
- safe visible widget identity summary, such as widget title, definition id, and
  visible availability state

Not allowed without a later approved context/evidence flow:

- Terminal output
- Agent Executor logs, prompts, final responses, diffs, or validation output
- Git diffs, file contents, repository files, or status snapshots
- JDBC results, connector secrets, schemas, or query output
- Notes bodies
- Runbook notes/evidence
- filesystem contents
- environment variables
- secrets

A future context pack should show:

- what is included
- why it is included
- estimated token size
- whether the operator approved it

## Provider Runtime Boundary

The first Coordinator provider runtime must be drafting-only.

Provider input may include only the explicit operator chat message, visible
current-session Workspace Agent messages, visible proposal draft context that
the operator can inspect, and compact safe system/product instructions. It must
not include hidden widget state, Terminal output, Agent Executor logs/results,
Git diffs/status, JDBC connector metadata/results/secrets, Notes bodies,
filesystem contents, environment variables, secrets, or unapproved
Evidence/Sources.

The first provider request must use:

```text
allowed_tools: []
```

Provider output may contain assistant text and optional structured proposal
drafts for the currently supported safe proposal types: create Agent Queue
task, create Note, and prepare JDBC query suggestion text without execution.
Provider output must be parsed and validated before rendering. Unsupported,
malformed, or unsafe proposals must degrade to plain text or a visibly rejected
draft; they must never trigger fallback execution.

Provider-backed proposals preserve the same approval boundary as local
proposals:

- Approve is not execution.
- Queue task creation requires a separate `Create Queue task` action.
- Note creation requires a separate `Create Note` action.
- JDBC proposals remain non-executing suggestions.
- Terminal, Git, Agent Executor launch, Queue auto-dispatch, JDBC SQL
  execution, and hidden context compilation are not supported in the first
  provider slice.

Provider calls must be visible user-triggered Workspace Agent actions. Widget
changes must not trigger background provider calls. Provider errors, network
failures, timeouts, invalid responses, not-configured external provider
selection, and unsupported configuration must be visible. External provider
credentials are backend-owned configuration only and must never appear in
prompts, logs, frontend state, or proposal cards. Current configured HTTP JSON
provider calls are bounded by backend timeout and request/response size caps;
provider cancellation remains future work until the runtime supports it.

The detailed first-provider boundary is defined in
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`.

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

Near-term direction: Interactive Agent should become Workspace Agent.

Do not keep two separate primary chat concepts in the current product.

The user-facing title is Workspace Agent. The internal widget id remains
`interactive-agent` for compatibility.

The current local chat is the minimal Workspace Agent UI foundation. It can
request backend-owned mock/local provider responses or a configured HTTP JSON
provider response from visible chat context only, with `allowed_tools: []`.
Provider proposal drafts are validated before rendering. Workspace Agent
still does not execute widget tools, compile hidden context, or perform
Workspace actions directly.

## Runbook Status

Runbook remains Preview/minimal and deferred from the active roadmap.

Do not build Coordinator-to-Runbook integration in the near-term scope.

## Medical Domain Status

Medical and healthcare workflows are out of active roadmap due to
privacy/compliance/safety sensitivity.

Do not use medical workflows as a near-term demo or design driver.

## First Practical Coordinator Scenario

The first product scenario remains database investigation with JDBC once JDBC
read-only execution and result review exist. The first action proposal UI slice
should still start smaller: inert proposal cards, then approved Queue task
creation, before any SQL execution or provider runtime.

Flow:

1. Operator describes a database problem.
2. Coordinator asks clarifying questions.
3. Coordinator proposes read-only SQL.
4. JDBC widget executes the approved query.
5. Coordinator interprets the result.
6. Workspace Agent may create a Queue task for engineering follow-up.
7. Agent Executor may execute that task if the operator starts it.

## Recommended Next Blocks

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
