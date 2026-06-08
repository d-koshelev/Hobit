# Workspace Agent V2 Direct Run Status

## Purpose

This document records the implementation status after WorkspaceAgentV2 Direct
Run Block 001.

Status: docs-only status record.

This document does not add frontend behavior, backend or Tauri commands,
storage/schema changes, Queue runtime behavior, provider adapters, Git
mutation, Terminal execution, Knowledge access, or Workspace Agent V1
replacement. Current implemented Workspace Agent V1 behavior remains governed
by `docs/CURRENT_WIDGET_SURFACE.md` until an explicit replacement block updates
the product surface and implementation.

## Implemented In Block 001

### Direct Run Audit

`docs/WORKSPACE_AGENT_V2_DIRECT_RUN_IMPLEMENTATION_AUDIT.md` records the
inspect-only audit of the existing Codex Direct Work path and identifies the
safe integration route for WorkspaceAgentV2 Direct Run:

- reuse the existing Direct Work stream/session path;
- keep Codex CLI command construction behind the existing backend/runtime
  boundary;
- map existing Direct Work events into V2 AgentRuntime events;
- keep the first slice current-session only;
- avoid Queue task creation, Workspace Agent V1 replacement, and duplicate CLI
  runners.

### Codex Provider Adapter

`apps/desktop/frontend/src/workbench/agentRuntime/codexProviderAdapter.ts`
implements the first Codex provider adapter over existing Direct Work stream
actions.

Real behavior when host actions are supplied:

- maps a V2 `AgentRunRequest` to the existing Codex Direct Work request shape;
- starts through the supplied `startCodexDirectWorkStream` action;
- maps Direct Work stream events into V2 `AgentRunEvent` records;
- maps final Direct Work events into V2 `AgentRunResult` records;
- advertises Codex capabilities and warnings honestly, including no Hobit
  tools, reduced file-change reporting, and token usage only when emitted.

The adapter does not construct Codex CLI syntax in frontend code and does not
add a new backend command.

### Direct Run Controller

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/useWorkspaceAgentV2DirectRun.ts`
implements a current-session V2 Direct Run controller.

Real behavior:

- builds one explicit run from the visible prompt and configured working
  directory;
- records user prompt and result messages in the V2 transcript;
- emits context-materialized, lifecycle, and result events into the V2 activity
  pane;
- prevents duplicate starts while a run is preparing, materializing context, or
  running;
- requests cancellation only when the adapter advertises cancellation support.

Remaining limits:

- no durable V2 run history or reconnect/resume;
- no V2 validation execution flow;
- no generalized persisted detail/diff reader for Workspace Agent-owned runs.

### UI Wiring

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/WorkspaceAgentV2Widget.tsx`
wires the V2 shell to the Codex adapter/controller.

Real behavior:

- Direct Run can start only when an adapter or host stream action is supplied;
- Direct Run launch remains a separate explicit operator action;
- preflight rows show provider, mode, working directory, sandbox, tool policy,
  approval policy, visible-context count, and adapter support;
- missing adapter support and empty prompt block launch with visible reasons;
- warnings show unavailable cancellation, unavailable file-change summaries,
  missing visible context, and no Hobit tool access.

Queue Run remains visible but disabled with an explicit message that no Queue
task will be created in this block.

### Result Review Cards

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/WorkspaceAgentV2ResultCard.tsx`
renders completed, failed, cancelled, and reduced-capability Direct Run results
as review cards in the V2 transcript.

Real behavior:

- shows run id, provider, lifecycle, duration when available, response/error
  text, warnings, and file-change/validation sections when supplied;
- honestly displays no file-change summary when the adapter does not report
  one;
- keeps Queue follow-up disabled.

The result card is a review surface only. It does not accept changes, finalize
work, create Queue tasks, run validation, stage, commit, or push.

### Experimental Access / Smoke Path

`apps/desktop/frontend/smoke/dev/workspace-agent-v2-direct-run-smoke.html` and
`apps/desktop/frontend/src/smoke/workspaceAgentV2DirectRunSmokeApp.tsx` expose a
dev-only smoke entry point for the experimental V2 Direct Run surface.

The smoke path uses a fake in-memory adapter to prove the V2 transcript,
activity, preflight, and result review wiring. It does not run real Codex,
read files, create Queue tasks, or mutate workspace state.

## Real Versus Inert

- Direct Run is real for Codex when WorkspaceAgentV2 is supplied with the
  existing Codex Direct Work stream action or an equivalent adapter that wraps
  that action.
- Direct Run is unsupported/inert in hosts that do not supply the adapter or
  stream action.
- Queue Run remains inert and not implemented in WorkspaceAgentV2; it must not
  create, assign, run, or auto-dispatch Queue tasks in this block.
- Claude Code is not implemented.
- Amp is not implemented.
- Workspace Agent V1 is not replaced. The existing `interactive-agent`
  compatibility surface remains the current product Workspace Agent unless a
  later explicit replacement block changes that.

## Safety Record

The implemented V2 Direct Run slice preserves the required safety boundaries:

- explicit Direct Run start only;
- no automatic run after prompt entry;
- no automatic Queue task creation;
- no Queue auto-run, scheduler change, or Autorun behavior change;
- no auto-commit, auto-push, auto-finalize, or automatic result acceptance;
- no hidden Terminal use;
- no hidden Git reads or mutations;
- no hidden Knowledge reads, ingestion, memory, or prompt injection;
- no hidden Workspace scans, file reads, or widget state reads;
- no frontend-direct provider calls;
- no provider tool calls through Hobit; the adapter advertises `allowedTools:
  []`.

The only real execution path is the existing explicit Codex Direct Work stream
path when it is deliberately supplied to WorkspaceAgentV2.

## Manual Smoke Checklist

Use the dev smoke entry point for UI wiring and the desktop host path for real
Codex execution.

1. Open the WorkspaceAgentV2 experimental surface.
   - Dev smoke route:
     `/smoke/dev/workspace-agent-v2-direct-run-smoke.html`
   - Confirm the surface says Workspace Agent v2, Codex Direct Run only, and
     Queue Run remains disabled.

2. Run a read-only prompt.
   - Use a prompt such as `Summarize the current working directory contract
     boundaries without changing files.`
   - Use a safe explicit working directory.
   - Prefer read-only sandbox where the host exposes it.

3. Verify transcript, activity, and result.
   - The prompt appears in the transcript.
   - Activity shows context materialization and provider/run events.
   - A Direct Run result review card appears with completion or honest failure
     status.
   - File-change summary is absent or explicitly shown as not reported unless a
     later adapter adds it.

4. Verify no Queue task was created.
   - Queue Run button remains disabled.
   - Agent Queue task list is unchanged.
   - No Queue assignment, execution, or Autorun starts from the V2 surface.

5. Verify Workspace Agent V1 remains unchanged.
   - Existing Workspace Agent V1 still loads through the `interactive-agent`
     compatibility surface.
   - V1 Direct Work behavior and current-session state are not replaced by the
     V2 experimental path.

## Remaining Gaps

- Queue Run integration through Queue-owned APIs.
- Direct Run hardening for cancellation UI, durable resume/reconnect, run
  history, and persisted detail ownership.
- File-change and diff review deepening if WorkspaceAgentV2 needs direct
  review instead of separate explicit Git/Finder review.
- V2 validation design and explicit validation execution/result mapping.
- Model/reasoning/profile support only after backend/runtime support exists.
- Claude Code CLI audit before any Claude adapter.
- Amp CLI audit before any Amp adapter.

## Recommended Next Blocks

1. Queue Run integration.
   Implement explicit Queue task creation from WorkspaceAgentV2 through
   Queue-owned APIs, preserving visible prompt/context and no auto-run.

2. Direct Run hardening/cancel/resume.
   Add honest cancellation controls, current-session stop behavior, and a
   design for durable run detail/reconnect before claiming full run history.

3. File-change/diff deepening.
   Generalize read-only run detail and diff review only if WorkspaceAgentV2
   should own direct result review instead of handing off to Finder/Git.

4. Claude Code CLI audit.
   Produce an inspect-only CLI capability and safety audit before any adapter
   or UI option.

5. Amp CLI audit.
   Produce an inspect-only CLI capability and safety audit before any adapter
   or UI option.
