# AI Integration Readiness Contract

## Purpose

This contract defines the boundary for Hobit's first real AI integration slice.

The first AI slice must preserve Hobit's operator-controlled Workbench model:
the operator provides a prompt, explicitly approves context, receives a
proposal-only AI response, and can inspect the stored artifact. It must not turn
Agent Chat into hidden automation, a tool executor, a Terminal launcher, a file
reader, or an approval/apply path.

This started as a documentation and product/domain contract. The current
implementation now includes the first proposal-only Agent Chat AI slice:
Agent Chat can request a backend-generated proposal through the Tauri boundary
when an explicit HTTP provider endpoint is configured, normalize the provider
response, and persist the proposal artifact for Agent Monitoring. The slice
still does not implement tool execution, Terminal execution from AI, schema
changes, Agent Queue execution, file/Git/Notes mutations, approval/apply
workflows, provider settings UI, secrets UI, or frontend-direct provider calls.

## First AI Slice Summary

The first real AI integration must be proposal-only:

```text
Agent Chat
  -> operator prompt
  -> explicitly approved context snapshot
  -> LLM proposal response
  -> persisted response artifact
  -> Agent Monitoring/details
```

The AI response may summarize, reason, and propose next steps. It must not
execute actions or mutate Hobit state beyond the explicit persisted run/result
artifact for observability.

Current implementation note: real provider calls are available only through the
desktop backend command and require `HOBIT_AI_PROVIDER_ENDPOINT` plus
`HOBIT_AI_PROVIDER_MODEL`. `HOBIT_AI_PROVIDER_API_KEY` is optional and is never
stored in proposal artifacts or logs. The current adapter is intentionally
minimal and supports explicit `http://` JSON chat-compatible provider endpoints;
HTTPS provider support and provider configuration UI are future work.

Agent Queue remains optional for this milestone. Creating review items from
proposal artifacts is not part of the required first AI path.

## Explicit First-Slice Non-Goals

The first AI slice must not implement:

- Tool execution.
- Terminal command execution from AI.
- Git actions.
- Notes editing.
- Filesystem read/write.
- Agent Queue execution.
- Approval/apply workflow.
- Queue item execution.
- Hidden context access.
- Background automation.
- Script Runner execution.
- Automatic mutations.
- Provider calls from the frontend directly.

## Approved Context Rule

AI receives only explicitly approved context.

Default behavior should be prompt-only or minimal visible metadata. The operator
must be able to see what context will be included before the request is sent.

The first slice must not include these by default:

- Notes body.
- Git status.
- Terminal output.
- Widget logs.
- Files.
- Environment variables.
- Secrets.
- Hidden Workspace or widget context.

Those sources may become eligible only through separate future capabilities with
explicit approval, visible previews, and their own safety boundaries.

The approved context snapshot must be visible and auditable. It should identify
the Workspace/Workbench and source widgets when applicable, and it should be
stored with the proposal response artifact when persistence is available.

## Contract Pack / Request Artifact Model

Hobit should build AI requests from explicit request artifacts, not ad-hoc
hidden prompt strings.

A first-slice AI request should be assembled from:

- operator request
- selected request template
- approved context snapshot
- relevant contract pack
- current implementation status
- safety constraints
- validation plan
- expected response shape

Contract packs are selected summaries of project/product contracts. Hobit should
not send every docs file blindly. Contract packs should be prompt-safe, concise,
and relevant to the task.

Examples of relevant contract sources:

- `AGENT_OPERATING_MODEL`
- `WORKSPACE_COORDINATOR_AGENT_CONTRACT`
- `TOOL_ACTION_CONTRACT`
- `AGENT_WORK_EFFICIENCY_CONTRACT`
- `WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT`
- `AGENT_RESPONSE_CONTRACT`
- `PRODUCT_SIMPLIFICATION_AUDIT`

Contract pack content must not contain secrets, environment values, hidden
Workspace data, raw logs, or unapproved widget content.

## First AI Request Artifact Shape

A future first-slice AI request artifact should be shaped like:

```text
request_id
workspace_id
workbench_id
source_widget_instance_id
operator_prompt
approved_context_snapshot
contract_pack_summary
allowed_tools: []
safety_constraints
expected_response_format
validation_plan
created_at
```

This shape is contract-only. It does not define a database schema, Rust type,
TypeScript type, API DTO, or storage migration in this block.

## First AI Response Artifact Shape

A future first-slice AI response artifact should be shaped like:

```text
response_id
request_id
run_id
provider_status
response_text
structured_summary
proposed_plan
proposed_actions marked not executed
safety_flags
  no_tools_executed
  no_mutations_performed
  context_was_approved
raw_provider_metadata if safe
created_at
```

This shape is contract-only. It does not define a database schema, Rust type,
TypeScript type, API DTO, or storage migration in this block.

Raw provider metadata must be limited to safe operational metadata. It must not
store provider secrets, request credentials, environment values, or sensitive
headers.

## Provider Boundary

Provider calls must happen through a backend/runtime boundary, not directly from
the frontend.

Provider configuration and secrets must be explicit. They must not be stored in
prompt artifacts, response artifacts, raw logs, frontend state, or visible UI
payloads.

Provider failures must be captured as visible artifacts. A failed provider call
should produce inspectable status and error information without hiding the
approved context snapshot or safety constraints used for the attempt.

Provider responses are not execution authority. The provider may propose; it
may not apply changes, execute tools, launch Terminal commands, mutate Notes or
Git, write files, create hidden Queue items, or bypass operator approval.

## Observability Requirements

Every AI call must create a visible run/result artifact when persistence is
available.

Agent Monitoring should show:

- Overview for status, source widget, timestamps, and safety flags.
- Result for the operator prompt, context used, summary, plan, and proposed
  actions marked not executed.
- Raw for safe request/response payload inspection.

Raw views must not expose secrets, credentials, environment variables, or unsafe
provider metadata.

There must be no hidden provider calls. Failed calls should be inspectable and
should not appear as successful proposal artifacts.

## Tool/Action Boundary

The first AI slice has:

```text
allowed_tools: []
```

The AI cannot execute Terminal, Git, Notes, File, Script Runner, Agent Queue, or
external-system actions directly.

Future tool actions require:

1. AI or Coordinator proposal.
2. Visible payload preview.
3. Validation against the relevant widget/tool contract.
4. Explicit operator approval.
5. Execution by the owning component.
6. Auditable result artifact.

Tool access must not be inferred from provider capability, prompt text, or
available frontend widgets.

## Readiness Checklist Before Implementation

The first real AI integration must be gated by
`docs/DEMO_FLOW_CHECKLIST.md`.

Before implementation begins:

- Widget Catalog is understandable.
- Terminal manual smoke is verified on a real desktop environment.
- Agent Chat -> Agent Monitoring/details flow is manually verified.
- Approved context is visible and explicit.
- Proposal persistence works.
- Agent Queue remains optional, not mandatory.
- Docs do not imply hidden automation.

If any readiness item fails, fix the concrete issue in a focused follow-up block
before adding provider calls.

## First Implementation Block Outline

Implemented first integration block:

```text
Block 133 - First AI proposal-only integration
```

Implemented scope:

- Add a backend provider boundary or mockable provider interface.
- Agent Chat calls AI instead of the deterministic mock only where configured.
- Use only the approved context snapshot.
- Persist AI response as a proposal-only artifact.
- Agent Monitoring reads the stored artifact.
- Keep `allowed_tools: []`.
- Do not execute tools.
- Do not mutate Workspace content, Notes, Git, Queue, Terminal, files, or
  external systems.
- Do not add Queue execution.

The local/mock proposal fallback remains available when provider configuration
or the desktop backend path is unavailable.

## Non-Goals

This contract and current first slice do not implement:

- Tool execution.
- Multiple providers.
- Provider settings UI.
- Secrets UI.
- HTTPS provider adapter.
- Storage/schema changes.
- Agent Queue execution or approval/apply changes.
- Terminal changes.
- Approval/apply workflow.
- File, Git, Notes, Queue, Workspace, or external-system mutations.
- Broad runtime architecture.
