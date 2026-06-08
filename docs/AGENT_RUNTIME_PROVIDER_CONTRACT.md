# Agent Runtime Provider Contract

## Purpose

This contract defines the future provider boundary for agent runtimes in Hobit.
It is a docs-only contract for a provider abstraction; it does not add
frontend UI, backend/Tauri commands, storage/schema changes, provider adapters,
new execution behavior, Queue automation, Git mutation, file mutation, or tool
calling.

The goal is to keep Hobit's Agent Executor and future agent runtime work
provider-agnostic while preserving the product rule:

- the operator chooses the run boundary and approves powerful behavior;
- Hobit owns visibility, status, warnings, logs, and review;
- provider-specific CLI syntax stays behind runtime adapters;
- unsupported capabilities are surfaced honestly and never silently faked.

Codex is the first adapter target because it is the current implemented Direct
Work runtime. Claude Code and Amp may be considered later only after a focused
audit of their CLI/runtime behavior, capability model, output shape,
cancellation behavior, security posture, and review semantics.

## Status

Status: Planned / contract-only.

This document does not make multi-provider execution current behavior. Current
implemented behavior remains governed by `docs/CURRENT_WIDGET_SURFACE.md`,
`docs/DIRECT_MODE_AGENT_CONTRACT.md`, and
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`.

## AgentRuntimeProvider Interface

`AgentRuntimeProvider` is the conceptual app/runtime boundary for launching and
observing one explicit agent run.

Conceptual interface:

```text
AgentRuntimeProvider {
  startRun(request: AgentRunRequest): AgentRunHandle
  sendInput(run_id: string, input: AgentRunInput): AgentRunInputResult
  cancelRun(run_id: string, reason?: string): AgentRunCancelResult
  status(run_id: string): AgentRunStatus
  events(run_id: string, cursor?: string): AgentRunEventBatch
}
```

Method expectations:

- `startRun` starts exactly one operator-approved run from an explicit request.
- `sendInput` sends follow-up stdin/review/input only when the provider and the
  approved run mode support it.
- `cancelRun` requests cancellation only for a known run owned by this provider.
- `status` returns a normalized provider-independent status snapshot.
- `events` returns normalized, bounded events suitable for Agent Activity,
  Agent Executor detail, logs, and review surfaces.

This interface is conceptual only. It does not define Rust traits, TypeScript
interfaces, API DTOs, Tauri commands, storage schemas, or frontend props.

## AgentRunRequest

`AgentRunRequest` describes one explicit run request after the operator has
chosen the execution boundary.

Conceptual fields:

```text
AgentRunRequest {
  request_id
  provider_id
  workspace_id
  workbench_id
  source_widget_instance_id
  source_queue_item_id?
  execution_workspace
  prompt
  mode
  sandbox
  approval_policy
  review_mode
  allowed_tools
  provider_options
  output_caps
  timeout_ms
  resume_from_run_id?
  expected_capabilities
}
```

Rules:

- `execution_workspace` must be explicit and operator-approved.
- `prompt` must be visible operator input or visible approved task text.
- `allowed_tools` defaults to empty unless a later contract explicitly enables
  a tool-capable mode.
- `provider_options` may hold adapter-specific configuration, but UI must not
  build command lines or hardcode provider CLI syntax from these values.
- `expected_capabilities` is used to compare requested behavior against the
  selected provider's advertised capabilities before launch.

## AgentRunEvent

`AgentRunEvent` is the normalized observable stream for a run.

Conceptual fields:

```text
AgentRunEvent {
  event_id
  run_id
  provider_id
  sequence
  timestamp
  kind
  level
  title
  summary?
  text?
  structured_payload?
  token_usage_delta?
  file_change_delta?
  review_item?
  warning?
  cursor?
}
```

Conceptual event kinds include:

- `run_started`
- `status_changed`
- `stdout`
- `stderr`
- `message`
- `tool_call_requested`
- `tool_call_result`
- `review_requested`
- `input_requested`
- `file_changed`
- `token_usage`
- `warning`
- `error`
- `run_completed`

Rules:

- Raw provider output must be bounded and redacted before reaching normal UI.
- Provider-specific event payloads may be retained only behind explicit details
  views and must not leak credentials or hidden context.
- Unsupported or unsafe event kinds must be surfaced as warnings or normalized
  errors, not ignored.

## AgentRunResult

`AgentRunResult` is the normalized final outcome for one run.

Conceptual fields:

```text
AgentRunResult {
  run_id
  provider_id
  status
  started_at
  completed_at?
  duration_ms?
  final_message?
  exit_code?
  error_code?
  error_summary?
  warnings
  token_usage?
  changed_files?
  review_items?
  validation_summary?
  provider_metadata?
}
```

Conceptual statuses include:

- `queued`
- `starting`
- `running`
- `waiting_for_input`
- `waiting_for_review`
- `completed`
- `failed`
- `cancelled`
- `timed_out`
- `unsupported`

Rules:

- `completed` means the provider finished; it does not mean the operator has
  accepted changes, committed, pushed, or approved follow-up actions.
- `changed_files` is review metadata only. It must not imply automatic Git
  staging, commit, push, reset, clean, or restore behavior.
- `provider_metadata` must be safe, bounded, and non-secret.

## ProviderCapabilities

Every provider adapter must advertise capabilities before launch. Capability
advertisement is descriptive and must be checked against the requested run.

Conceptual capabilities:

```text
ProviderCapabilities {
  streaming
  json
  tools
  sandbox
  resume
  cancel
  review_mode
  worktree
  token_usage
  file_changes
}
```

Capability meanings:

- `streaming`: provider can emit events during the run.
- `json`: provider can produce machine-readable structured events or results.
- `tools`: provider can request or call tools in an approved tool-capable mode.
- `sandbox`: provider supports a selectable sandbox or equivalent restriction.
- `resume`: provider can resume an existing run/thread/session.
- `cancel`: provider supports cooperative or forceful cancellation.
- `review_mode`: provider can pause for review or expose review items.
- `worktree`: provider can operate against an explicit filesystem worktree.
- `token_usage`: provider can report prompt/output/total token usage.
- `file_changes`: provider can report changed files or file-change deltas.

Rules:

- Missing capabilities must be visible before or during launch as warnings.
- Hobit must not silently replace unsupported behavior with a different mode.
- A provider without `cancel` must not show cancellation as guaranteed.
- A provider without `file_changes` may still run, but the UI must show that
  changed-file reporting is unavailable and rely only on separate explicit Git
  review where available.
- A provider without `json` requires conservative parsing and visible reduced
  observability.
- A provider with `tools` does not grant tool permission. Tool access remains
  controlled by separate Hobit contracts and operator approval.

## Adapter Model

Provider adapters translate the normalized Hobit request/status/event/result
model to provider-specific runtime details.

Adapter rules:

- UI must not hardcode provider CLI syntax, argument order, environment
  variable names, output parsing rules, or cancellation mechanics.
- Provider-specific command construction belongs behind the backend/runtime
  adapter boundary.
- Adapters must return normalized capability warnings and errors.
- Adapters must preserve explicit execution workspace, prompt, sandbox,
  approval, output cap, timeout, and review boundaries where supported.
- Adapters must refuse or warn on unsupported requested behavior rather than
  silently weakening the run.
- Adapters must not introduce hidden context reads, hidden execution, automatic
  Queue dispatch, automatic Git mutation, frontend-direct provider calls, or
  provider credentials in UI state.

## Codex Adapter First

Codex is the first adapter target.

The Codex adapter may wrap the existing Codex Direct Work foundation while
preserving current Direct Work rules:

- explicit execution workspace;
- explicit operator prompt;
- explicit sandbox and approval policy;
- observable run events/logs/results;
- no auto-commit;
- no auto-push;
- no hidden background execution;
- no Terminal disguise;
- no automatic Queue dispatch beyond explicitly approved current Queue start
  paths governed by existing contracts.

The Codex adapter must keep Codex CLI command construction behind the
runtime/backend boundary. Frontend components may select provider identity and
approved options, but they must not assemble `codex` command syntax.

## Later Adapters After Audit

Claude Code and Amp are later candidates only after audit.

Each audit must document at least:

- local CLI invocation and argument model;
- working-directory/worktree behavior;
- sandbox or permission controls;
- structured output support;
- streaming support;
- cancellation behavior;
- resume/session behavior;
- review mode semantics;
- tool-calling behavior and disablement options;
- file-change reporting;
- token-usage reporting;
- secret/config handling;
- failure modes and output caps;
- compatibility with Hobit's explicit operator-control model.

No adapter may be added solely because a provider CLI exists locally.

## UI Contract

Runtime-provider UI must stay provider-agnostic and honest.

Rules:

- UI may show provider name, status, selected mode, requested capabilities, and
  capability warnings.
- UI must not hardcode provider CLI syntax.
- UI must not expose raw command templates as the normal operator model.
- UI must show unsupported capabilities as warnings or blocked launch states.
- UI must not silently fall back to a different provider, different sandbox,
  non-streaming mode, no-review mode, or no-file-change mode without visible
  operator-facing warning.
- Provider-specific debug details, if present, belong behind explicit details
  panels and must be redacted.

## Unsupported Capability Handling

Unsupported behavior must be explicit.

Required handling:

- If a required capability is missing, block launch or require explicit
  operator confirmation with a warning.
- If an optional capability is missing, allow launch only with visible reduced
  capability status.
- If a provider reports support but fails at runtime, emit a warning or error
  event and reflect it in `AgentRunResult`.
- If output cannot be parsed safely, degrade to bounded text output with a
  visible parse warning.
- Never silently retry through another provider.
- Never silently switch to a broader sandbox or weaker approval mode.
- Never hide missing cancellation, missing JSON, missing review mode, missing
  token usage, or missing changed-file reporting.

## Non-Goals

This contract does not implement:

- new source code;
- new tests;
- new storage or schema;
- new Tauri commands;
- new frontend UI;
- provider settings UI;
- Claude Code or Amp adapters;
- provider tool calling;
- hidden context access;
- automatic Queue dispatch;
- Git mutation;
- Terminal control;
- JDBC execution;
- file mutation outside an explicit approved agent run;
- auto-commit or auto-push;
- secret storage or credential UI.
