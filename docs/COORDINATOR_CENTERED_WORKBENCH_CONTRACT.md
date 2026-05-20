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

Terminal is currently a PTY-first manual operator shell with a collapsed legacy
one-shot command fallback.

Coordinator must not control Terminal PTY or the legacy one-shot fallback in
the MVP.

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

Coordinator may perform low-risk read-only actions under policy. Risky actions
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
cards in Coordinator Chat. A card should show the proposal title, target
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

Initial safe proposal types:

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
current-session Coordinator Chat messages, visible proposal draft context that
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

Provider calls must be visible user-triggered Coordinator Chat actions. Widget
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

Near-term direction: Interactive Agent should become Coordinator Chat.

Do not keep two separate primary chat concepts in the current product.

The user-facing title is Coordinator Chat. The internal widget id may remain
temporarily as `interactive-agent` for compatibility.

The current local chat is the minimal Coordinator Chat UI foundation. It can
request backend-owned mock/local provider responses or a configured HTTP JSON
provider response from visible chat context only, with `allowed_tools: []`.
Provider proposal drafts are validated before rendering. Coordinator Chat
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
6. Coordinator may create a Queue task for engineering follow-up.
7. Agent Executor may execute that task if the operator starts it.

## Recommended Next Blocks

- Provider error/cancellation hardening and structured draft UX smoke with
  tools disabled and explicit visible context only.
- Later controlled widget capability bridge.
- Later Coordinator to JDBC read-only query proposal flow after JDBC execution
  and result review are contract-ready.
- Evidence/Sources storage/API foundation.
- AI context/token economy contract.

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
