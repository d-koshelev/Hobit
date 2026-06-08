# Workspace Agent v2 Foundation Status

## Purpose

This document records the completed Workspace Agent v2 foundation scaffold from
Foundation Block 001 prompts 001-005.

Status: docs-only foundation status record.

This document does not implement frontend UI, backend or Tauri commands,
provider adapters, Direct Run, Queue Run, storage/schema changes, Agent
Executor behavior, Git behavior, Terminal control, Knowledge ingestion, or new
runtime behavior. Current implemented Workspace Agent behavior remains governed
by `docs/CURRENT_WIDGET_SURFACE.md` until an explicit replacement block updates
the product surface and implementation.

## Completed Foundation Commits

- `3ebd1fd` - AgentRuntime provider types foundation.
- `22c03c8` - WorkspaceAgentV2 manifest/shell.
- `a29abb4` - transcript/composer scaffold.
- `6c3f6be` - activity pane scaffold.
- `394c711` - context strip scaffold.

## Foundation Summary

The completed scaffold adds a provider-neutral AgentRuntime type foundation,
including the early vocabulary needed for future provider capabilities,
lifecycle/status, events, results, warnings, and policy-shaped execution
surfaces without adding provider runtime behavior.

The WorkspaceAgentV2 manifest and shell establish an experimental V2 surface
shape while keeping it outside the current product-facing Workspace Agent V1
replacement path. The scaffold exists as a foundation for future implementation
blocks, not as a current product-surface migration.

The transcript and composer scaffold define the visible conversation/run setup
area. The current scaffold can render message roles and metadata, and exposes
Direct Run and Queue Run controls as visible UI structure, but those controls
do not launch runtime behavior.

The activity pane scaffold defines grouped, collapsible run activity display
for future provider and run events. It is a readable status surface foundation,
not a runtime event source, persisted run history reader, or executor launcher.

The context strip scaffold defines typed visible context chips/cards and
warnings so future runs can show what context is included or blocked before
execution. It does not read hidden Workspace context, auto-search Knowledge,
scan files, or inject context into provider prompts.

## Current Limits

- No real Direct Run is implemented in WorkspaceAgentV2.
- No Queue Run creation is implemented in WorkspaceAgentV2.
- No Codex provider adapter has been extracted for WorkspaceAgentV2.
- No Claude CLI provider adapter is implemented.
- No Amp CLI provider adapter is implemented.
- WorkspaceAgentV2 has not replaced the existing Workspace Agent V1
  `interactive-agent` compatibility surface.
- WorkspaceAgentV2 is an experimental scaffold and is not the authoritative
  current Workspace Agent product surface.

## Safety Record

The foundation scaffold preserves the required safety boundaries:

- no hidden execution
- no automatic Queue task creation or dispatch
- no auto-commit, auto-push, or automatic finalization
- no hidden Terminal use
- no hidden Git reads or mutations
- no hidden Knowledge reads, ingestion, memory, or prompt injection
- no hidden Workspace scans or widget state reads
- no provider access to secrets
- no provider tool use or capability execution

Visible controls and scaffolded panes are structural only until later explicit
implementation blocks wire them to approved runtime or Queue-owned APIs.

## Recommended Next Implementation Blocks

1. Codex provider adapter extraction.
   Wrap the existing explicit Codex Direct Work behavior behind the
   provider-neutral AgentRuntime boundary while preserving visible prompt,
   working directory, sandbox, approval policy, streaming/log/result
   visibility, cancellation honesty where available, no hidden context, no
   auto-commit, and no auto-push.

2. Direct Run implementation.
   Implement the first WorkspaceAgentV2 Direct Run path after the Codex
   provider adapter boundary exists. Include preflight review, explicit launch,
   visible lifecycle, final result review, change summary where available,
   validation visibility where available, and no automatic follow-up actions.

3. Queue Run integration.
   Implement visible create-Queue-task flow from WorkspaceAgentV2 through
   Queue-owned APIs. Preserve included prompt, selected visible context,
   provider/runtime preferences, safety notes, and expected outcome. Do not
   auto-run after task creation.

4. Claude CLI audit.
   Produce an inspect-only local CLI capability report covering command shape,
   auth/status safety, headless behavior, machine-readable output, streaming,
   tools, sandboxing, cancellation, resume, and usage metadata. Do not add an
   adapter or execution path during the audit.

5. Amp CLI audit.
   Produce an inspect-only local CLI capability report with the same safety and
   runtime questions as the Claude audit. Treat review mode as unproven until
   the audit establishes a safe first slice.

6. WorkspaceAgentV2 visual polish/status.
   Refine the scaffolded surface for readability, empty states, status honesty,
   compact layout behavior, and experimental exposure checks without adding
   runtime behavior.

## Manual Visual Smoke Checklist

- WorkspaceAgentV2 shell renders when exposed through an experimental path.
- Direct Run and Queue Run buttons are visible but inert.
- Transcript renders role and metadata information without fabricated token
  counts or fake provider usage.
- Activity pane groups runs and remains collapsible.
- Context strip shows typed context chips and warnings.
- Workspace Agent V1 still works through the existing `interactive-agent`
  compatibility surface.

