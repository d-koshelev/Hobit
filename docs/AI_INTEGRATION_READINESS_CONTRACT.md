# AI Integration Readiness Contract

## Purpose

This contract defines the boundary for Hobit's first Coordinator Chat provider
integration slices.

Coordinator Chat is the primary operator-facing AI surface. A provider may help
draft response text and draft action proposals, but it must not receive hidden
Workspace context, call tools, execute widget capabilities, mutate state, or
turn Hobit into hidden automation.

This document is the contract for the current Coordinator direction. It does
not itself add frontend UI, backend or Tauri commands, storage/schema changes,
provider adapters, LLM calls, Coordinator runtime, widget tool execution, JDBC
SQL execution, Git mutation, Terminal control, Queue auto-dispatch, Agent
Executor launch, Evidence/Sources, or secret handling.

Older proposal-only Agent Chat provider compatibility paths may still exist in
the codebase. New work must use the Coordinator-centered model in
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and the widget capability
boundary in `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`; this document must not
be used to bypass current context, tool, approval, or widget boundaries.

## One-Sentence Rule

The first Coordinator provider slice is text-and-proposal drafting only:
`allowed_tools: []`, explicit visible context only, no execution.

## Current Coordinator Provider State

Coordinator Chat currently has:

- local proposal cards
- deterministic local proposal generation from explicit operator chat text
- approved Queue task creation through a separate explicit create action
- approved Note creation through a separate explicit create action
- JDBC SQL suggestion review/copy cards with no SQL execution
- backend-owned mock/local provider text responses
- backend-owned mock/local structured proposal drafts with validation before
  rendering
- backend-selected configured HTTP JSON provider path that can report
  not-configured, unsupported, network failure, timeout, invalid response,
  provider error, request-too-large, failed, or completed state
- no hidden context access
- no widget capability runtime
- no provider credentials in frontend state, prompts, logs, proposal cards, or
  test snapshots

Provider work starts from this surface. It must not widen any current behavior
implicitly.

## First Coordinator Provider Flow

The first provider-backed Coordinator flow should be:

```text
Coordinator Chat
  -> explicit operator message
  -> visible current-session Coordinator conversation
  -> minimal safe product/system instructions
  -> allowed_tools: []
  -> provider response text and optional proposal drafts
  -> parser/validator/normalizer
  -> visible assistant message and proposal review cards
  -> operator approval/edit/reject
  -> separate explicit Queue task or Note creation action where already allowed
```

The provider response may explain, ask questions, summarize the visible
conversation, and draft safe proposal cards. It must not execute actions or
mutate Hobit state. Proposal cards remain the operator review boundary.

## Current Configured Provider Boundary

The current desktop runtime keeps mock/local as the default provider. A
configured external provider is selected only by backend environment
configuration:

- `HOBIT_COORDINATOR_PROVIDER` or `HOBIT_COORDINATOR_PROVIDER_MODE` set to
  `external`, `configured`, `real`, or `provider`
- `HOBIT_COORDINATOR_PROVIDER_ENDPOINT` set to an explicit `http://` endpoint
- `HOBIT_COORDINATOR_PROVIDER_API_KEY` set backend-side
- optional `HOBIT_COORDINATOR_PROVIDER_KIND`; supported values are
  `hobit-http-json` and the compatibility alias `external-provider`

The configured provider receives Hobit's compact JSON request shape with
visible chat messages, visible proposal summaries, compact safety
instructions, and `allowed_tools: []`. The API key is used only as a backend
authorization header and is not serialized into the request body, frontend DTO,
prompt text, logs, proposal cards, or docs examples. HTTPS/direct vendor SDK
support and provider settings UI remain future work.

The configured HTTP JSON provider uses a backend request timeout, configured by
`HOBIT_COORDINATOR_PROVIDER_TIMEOUT_MS` and clamped to a safe range. Request and
response bodies are bounded by backend caps so malformed or oversized provider
traffic surfaces as visible provider errors instead of unbounded memory growth.
Provider cancellation is not implemented in the current blocking HTTP adapter;
the UI must not show fake cancellation controls for provider calls.

A local deterministic smoke provider is available at
`scripts/hobit/fake-coordinator-provider.mjs`, with the product smoke runner
`scripts/hobit/smoke-coordinator-provider.mjs`. These helpers exercise the
configured `hobit-http-json` path with text, safe draft, error, invalid JSON,
timeout, and oversized-response scenarios. They are not production provider
integrations and must not use real credentials.

The configured provider may return Hobit's JSON response shape directly:

```json
{
  "assistant_text": "Visible assistant text",
  "proposal_drafts": []
}
```

OpenAI-style chat-completion envelopes are accepted only when their message
content contains the same Hobit response JSON or plain assistant text. All
provider drafts still pass through local validation before rendering.

## Provider Input Boundary

The first provider slice may receive only:

- the explicit operator chat message that triggered the request
- current conversation messages visible in Coordinator Chat
- explicit proposal draft context that is already visible in Coordinator Chat,
  such as a local deterministic draft selected for provider rewrite or review
- minimal safe product/system instructions and output-shape instructions
- a compact statement of current supported proposal types and safety rules

The first provider slice must not receive:

- hidden widget state
- Terminal output, PTY transcripts, or one-shot command output
- Agent Executor prompts, logs, results, diffs, validation output, or history
- Git diff, status, file contents, repository paths, or repository files
- JDBC connector metadata, connector secrets, schemas, query results, or
  database output
- Notes bodies or hidden note metadata
- Runbook notes/evidence
- filesystem paths or file contents
- environment variables
- provider API keys, database credentials, tokens, passwords, or other secrets
- unapproved Evidence/Sources artifacts or context packs
- broad Workspace summaries assembled from hidden widget data

Safe Workspace or widget identity summaries may be introduced only in a later
approved context slice. They must be visible, inspectable, compact, and
non-secret.

## Tool Boundary

The first provider slice must send:

```text
allowed_tools: []
```

Rules:

- The provider cannot call tools.
- The provider cannot execute widget capabilities.
- The provider cannot create Queue tasks or Notes directly.
- The provider cannot run Terminal commands.
- The provider cannot mutate Git.
- The provider cannot execute or explain live JDBC results by querying a
  database.
- The provider cannot launch Agent Executor or Agent Queue execution.
- Tool access must not be inferred from provider features, prompt text,
  available frontend widgets, or previously approved proposals.

Provider output is not execution authority. Any proposed action must still pass
through a visible proposal card, operator review, operator approval, and a
separate explicit execution/handoff action when that action is implemented and
allowed by the relevant widget contract.

## Proposal Output Contract

A provider response may contain assistant text and optional proposal drafts.
The conceptual response shape is:

```text
assistant_text: string
proposal_drafts?: [
  {
    proposal_type:
      "create-agent-queue-task"
      | "create-note"
      | "prepare-jdbc-query-suggestion"
    title: string
    target_widget: string
    target_capability: string
    intent: string
    visible_inputs: [{ label: string, value: string }]
    visible_risk_notes: string[]
    expected_result: string
    confidence?: "low" | "medium" | "high"
    needs_review?: boolean
  }
]
safety_flags:
  allowed_tools_empty: true
  no_tools_executed: true
  no_hidden_context_used: true
```

This shape is contract-only. It does not define a storage schema, Rust type,
TypeScript type, API DTO, Tauri command, provider SDK request, or parser
implementation.

Parser and validation rules:

- Accept only the current safe proposal types: create Agent Queue task, create
  Note, and prepare JDBC query suggestion text without execution.
- Reject or downgrade unsupported proposal types to plain assistant text or a
  visibly rejected draft.
- Validate target widget and capability against the current static proposal
  registry or a later explicit capability descriptor.
- Require all visible inputs before rendering an actionable review card.
- Cap assistant text, proposal fields, SQL text, risk notes, and expected result
  length before rendering.
- Preserve visible risk notes; if the provider omits them, add conservative
  local safety notes.
- Treat provider confidence as advisory only. It must not bypass review.
- Mark parse failures, malformed payloads, unsupported proposals, or unsafe
  proposal drafts visibly and non-silently.

Invalid or unsafe output must never trigger fallback execution.

## Approval And Execution Boundary

Provider-backed proposals use the same boundary as local proposals:

- Approve is review acceptance only; it is not execution.
- Queue task creation requires approval plus a separate explicit
  `Create Queue task` action.
- Created Queue tasks are draft/manual tasks and must not be assigned,
  dispatched, run, or handed to Agent Executor automatically.
- Note creation requires approval plus a separate explicit `Create Note`
  action.
- Creating a Note writes only visible approved title/body/pinned fields and
  does not read existing Notes content.
- JDBC proposals remain non-executing SQL suggestions with review/copy actions
  only.
- Terminal, Git, Agent Executor launch, Queue auto-dispatch, JDBC SQL
  execution, file mutation, and hidden context compilation are unsupported in
  the first provider slice.

Approval of one proposal does not approve future proposals, hidden context
access, provider tool use, or any different action.

## Context And Secrets Boundary

Coordinator provider requests must not compile hidden context.

Rules:

- No automatic Workspace scan.
- No automatic widget state read.
- No automatic summarization of widget outputs.
- No automatic Notes, Terminal, Git, JDBC, Runbook, Queue, or Agent Executor
  context inclusion.
- No filesystem scanning.
- No environment variable inclusion.
- No secrets in prompts, logs, artifacts, raw provider metadata, or frontend
  payloads.
- No medical or healthcare workflow scope.
- Evidence/Sources may later provide approved context packs, but that trust
  layer remains deferred and must not be simulated through hidden prompt
  assembly.

If a later context pack exists, the operator must see what is included, why it
is included, estimated size where practical, and whether it will be sent to the
provider.

## Provider Runtime Ownership

Provider adapter work must be explicit and observable.

Runtime expectations for future implementation:

- Provider calls are initiated only by visible operator action in Coordinator
  Chat.
- No background provider calls occur without visible user action.
- Widget changes must not automatically trigger provider calls.
- Provider calls should cross a backend/runtime boundary rather than calling
  provider APIs directly from frontend code.
- Provider configuration and secrets must be backend-owned and must not appear
  in prompts, logs, proposal cards, stored artifacts, or frontend state.
- Missing external provider configuration must surface as a visible
  not-configured state. Unsupported provider kinds must surface as visible
  unsupported state. The first configured external provider path is a
  backend-owned HTTP JSON adapter for an explicit `http://` endpoint; direct
  HTTPS/vendor SDK integration remains future work.
- Request payloads should include an explicit `allowed_tools: []` field or an
  equivalent provider-specific no-tools configuration.
- Provider errors, parse failures, timeouts, cancellation, and unsupported
  configuration must be visible in Coordinator Chat.
- Provider calls should be cancellable when the runtime supports cancellation.
- The current blocking HTTP JSON adapter does not yet support provider
  cancellation. Timeout and visible error reporting are the current hardening
  boundary.
- Provider results should be traceable to the triggering visible chat message.
- Safe operational metadata may be stored later, but raw provider metadata must
  not include secrets, headers, credentials, environment values, or unsafe
  payloads.

## UI Contract For Provider-Backed Coordinator

Provider-backed Coordinator UI must stay honest:

- Show whether a response is local deterministic, mock/local provider, or real
  provider-backed.
- Show provider errors as visible errors, not silent local fallbacks that look
  successful.
- Keep proposal cards attached to the message that produced them.
- Show all proposal inputs before approval.
- Keep edit, reject, approve, copy, and separate create actions visible and
  understandable.
- Do not show fake tool availability, hidden workspace inspection, Terminal
  control, Git mutation, JDBC execution, Agent Executor launch, or Queue
  dispatch.
- Raw provider/debug payloads, if added later, belong behind an explicit
  details view and must be redacted.

## Relationship To Existing Compatibility Paths

The codebase may retain older Agent Chat AI proposal compatibility paths for
stored artifacts, tests, or migration safety. Those paths do not define the
current Coordinator provider product surface.

Future Coordinator provider work may reuse small safe infrastructure only if it
preserves:

- `allowed_tools: []`
- explicit visible context only
- backend/runtime provider boundary
- no provider secrets in artifacts or logs
- no direct widget mutation by provider response
- visible proposal review before any allowed action handoff

Do not expose old Agent Chat or Agent Monitoring provider flows as current
product surfaces unless a later block explicitly scopes that compatibility UI.

## Staged Implementation Plan

Recommended next implementation slices:

1. Provider result/error/cancellation hardening with visible status and no
   hidden fallback execution.
2. Structured draft UX hardening after provider responses are stable.
3. Controlled capability bridge hardening after proposal review/approval
   remains stable.
4. Future Evidence/Sources approved context packs before any broader context
   sharing.

Each slice must state whether it changes frontend UI, backend/runtime code,
Tauri commands, storage/schema, provider configuration, prompt assembly,
proposal parsing, or widget handoff behavior.

## Explicit Non-Goals For First Provider Work

Do not implement:

- tool execution
- provider tool calling
- hidden context access
- hidden Workspace or widget scans
- Terminal control
- Git mutation
- JDBC SQL execution or `EXPLAIN`
- database connector reads or secret access
- Agent Executor launch
- Queue auto-dispatch or scheduler behavior
- direct provider calls from frontend code
- Evidence/Sources storage/API
- storage/schema changes unless a later block explicitly scopes observable
  provider artifacts
- medical or healthcare workflows
