# Workspace Agent V2 Direct Run Implementation Audit

Status: docs-only audit.

This audit inspects the current Codex Direct Work / Direct Run integration
surface and recommends the safe integration path for Workspace Agent V2 Direct
Run. It does not add frontend behavior, backend commands, storage/schema,
Queue runtime behavior, provider adapters, Git mutation, Terminal execution, or
Workspace Agent V1 replacement.

## Scope

Audited areas:

- Frontend Direct Work / Codex APIs, stream session helpers, Workspace Agent V1
  Direct Work controller, Agent Executor action wiring, AgentRuntime V2 types,
  and WorkspaceAgentV2 scaffold.
- Tauri command DTOs and command registration for Direct Work start, stream,
  cancellation, validation, history, and diff.
- `hobit-app` Direct Work, streaming, cancellation, Agent Executor history, and
  diff service boundaries.
- `hobit-tools` Codex runner ownership by reference through the app service
  wrappers.

Out of scope:

- Source implementation.
- Tests.
- Queue scheduler / Autorun changes.
- Workspace Agent V1 replacement.
- Claude, Amp, or additional provider implementation.
- New CLI runner or duplicate execution path.

## Existing Frontend Integration Points

### Tauri Direct Work API

`apps/desktop/frontend/src/workspace/tauriCodexDirectWorkApi.ts` is the lowest
frontend Tauri API wrapper for current Codex Direct Work.

Available operations:

- `runCodexDirectWork(request)` invokes `run_codex_direct_work`.
- `startCodexDirectWorkStream(request)` invokes
  `start_codex_direct_work_stream`.
- `listenToDirectWorkStreamEvents(onEvent)` listens to
  `direct-work://event`.
- `cancelCodexDirectWorkRun(request)` invokes `cancel_codex_direct_work_run`.
- `forceKillCodexDirectWorkRun(request)` invokes
  `force_kill_codex_direct_work_run`.
- `runDirectWorkValidation(request)` invokes `run_direct_work_validation`.

The request includes:

- `workspaceId`
- `workbenchId`
- `widgetInstanceId`
- `codexExecutable`
- `repoRoot`
- `operatorPrompt`
- `codexThreadId`
- `sandbox`
- `approvalPolicy`
- `skipGitRepoCheck`
- optional timeout and output caps

The stream event model includes:

- `workspaceId`
- `workbenchId`
- `widgetInstanceId`
- `runId`
- `eventKind`
- stdout/stderr/text fields
- parsed Codex event type
- optional `codexThreadId`
- status/final status
- elapsed time
- error/stderr preview/exit code/failed stage

### Shared Stream Session Helper

`apps/desktop/frontend/src/workbench/directWorkStreamSessions.ts` wraps the
Tauri stream lifecycle for frontend callers.

It provides:

- `startDirectWorkStreamSession(...)`
- `attachDirectWorkStreamSession(...)`
- run-id matching after start
- queued event buffering while the run id is being returned
- abort-signal handling
- idempotent stream listener cleanup
- current-session activity start/finish/failure marks
- widget log refresh after final events

This is the strongest existing frontend service boundary for WorkspaceAgentV2
Direct Run because it already handles the race between listener setup and run
creation, which a thin Tauri wrapper would need to recreate.

### Agent Executor Action Facade

`apps/desktop/frontend/src/workbench/agentExecutorWidgetActions.ts` creates the
current action facade passed through `WidgetHost` render props.

It provides:

- `startCodexDirectWorkStream(widgetInstanceId, request, onEvent, signal)`
- `attachToCodexDirectWorkStream(widgetInstanceId, runId, onEvent, signal)`
- `cancelCodexDirectWorkRun(widgetInstanceId, runId)`
- `forceKillCodexDirectWorkRun(widgetInstanceId, runId)`
- `runCodexDirectWork(widgetInstanceId, request)`
- `runDirectWorkValidation(widgetInstanceId, request)`
- `listAgentExecutorRuns(widgetInstanceId, limit)`
- `getAgentExecutorRunDetail(widgetInstanceId, runId)`
- `getAgentExecutorDiffSummary(widgetInstanceId, repositoryRoot)`
- `listenToDirectWorkStreamEvents(onEvent)`

It also validates open Workbench and widget ownership before calling the
workspace API. Despite the file name, parts of this facade are already supplied
to Workspace Agent V1 through `workspaceAgentWidgetProps.ts`.

### Workspace Agent V1 Direct Work Controller

`apps/desktop/frontend/src/workbench/useWorkspaceAgentDirectWorkController.ts`
is the current foreground Workspace Agent Codex controller.

It adds product behavior on top of the Direct Work action facade:

- visible composer prompt becomes `operatorPrompt`;
- current working directory becomes `repoRoot`;
- default executable comes from `defaultCoordinatorCodexExecutable()`;
- approval policy is currently `never`;
- sandbox is controlled by the Workspace Agent Direct Mode UI;
- `skipGitRepoCheck` is true for Workspace Agent foreground runs;
- each Workspace Agent widget owns independent current-session thread state;
- `codexThreadId` is resumed only for the same workspace, widget instance, and
  working directory;
- final agent messages are appended to the Workspace Agent transcript;
- Direct Work events are converted into Agent Activity events with source
  `workspace-agent`;
- local failures are surfaced in transcript/status state;
- cancellation calls the existing Direct Work cancel API.

This controller is V1-shaped and tightly coupled to V1 transcript state, but it
already proves that the current Direct Work API can safely run from an
`interactive-agent` owner without replacing Workspace Agent V1.

### AgentRuntime V2 Types

`apps/desktop/frontend/src/workbench/agentRuntime/agentRuntimeTypes.ts` defines
provider-neutral V2 vocabulary:

- `AgentProviderCapabilities`
- `AgentRunRequest`
- `AgentRunEvent`
- `AgentRunResult`
- `AgentRunMetadata`
- sandbox/tool/approval policy types
- token usage, validation suggestion, and file-change summary shapes

These are type foundations only. There is no extracted Codex provider adapter
yet.

### WorkspaceAgentV2 Scaffold

`apps/desktop/frontend/src/workbench/widgetV2/workspaceAgentV2/` contains the
experimental WorkspaceAgentV2 surface.

Current state:

- `WorkspaceAgentV2Composer.tsx` exposes prompt, new-thread checkbox, provider
  placeholder, Direct Run button, and Queue Run button.
- `WorkspaceAgentV2Widget.tsx` composes top bar, context strip, composer,
  transcript, and activity pane.
- Direct Run and Queue Run controls are inert unless callbacks are supplied.
- No real runtime adapter is wired.
- No V1 replacement is implemented.

## Existing Backend / Tauri Integration Points

### Tauri Command Surface

`apps/desktop/src-tauri/src/lib.rs` registers the existing Direct Work commands:

- `run_codex_direct_work`
- `start_codex_direct_work_stream`
- `cancel_codex_direct_work_run`
- `force_kill_codex_direct_work_run`
- `run_direct_work_validation`
- `list_agent_executor_runs`
- `get_agent_executor_run_detail`
- `get_agent_executor_diff_summary`

`apps/desktop/src-tauri/src/codex_direct_work_dto.rs` defines DTOs for:

- one-shot run request/response;
- streaming start request/response;
- stream event payload;
- validation run request/response;
- cancel and force-kill request/response;
- `~` and `~/...` path resolution before service input creation.

`apps/desktop/src-tauri/src/workspace_commands.rs` owns command handlers and
spawns the streaming background task after creating the run.

### App Service Direct Work Ownership

`crates/hobit-app/src/workspace_service/direct_work.rs` owns one-shot Direct
Work run creation and completion.

Important current behavior:

- validates Workspace, Workbench, and widget ownership;
- normalizes non-empty `repo_root`, executable, prompt, sandbox, approval
  policy, timeout, and output caps;
- constructs Codex runner requests behind the app/tooling boundary;
- persists widget runs, logs, and result payloads;
- records `no_auto_commit: true`, `no_auto_push: true`, and
  `git_mutations_performed_by_hobit: false`;
- supports `codex_thread_id`;
- accepts Direct Work initiation for widget definitions:
  - `agent-run`
  - `agent-queue`
  - `interactive-agent`

That means the backend already permits Workspace Agent V1 ownership through
the `interactive-agent` compatibility id.

### Streaming Service

`crates/hobit-app/src/workspace_service/direct_work_stream.rs` owns streaming
Direct Work run persistence and event normalization.

It provides:

- `start_codex_direct_work_stream(input)` to create the run immediately;
- `run_codex_direct_work_stream_with_cancellation(...)` to run Codex with a
  cancellation token;
- per-event persisted widget logs;
- normalized stream event summaries with parsed Codex event type and thread id;
- final run/result persistence for completed, failed, timed-out, cancelled,
  and force-killed outcomes.

### Cancellation

`crates/hobit-app/src/workspace_service/direct_work_cancellation.rs` validates
run ownership, records cancel / force-kill requests, and preserves no-Git
mutation flags.

The Tauri command layer also tracks active streaming runs in desktop runtime
state, so cancellation can signal the active Codex process when the run is
still active in the current desktop process.

### Result / History / Diff

`crates/hobit-app/src/workspace_service/agent_executor_history.rs` supports
read-only Direct Work and validation run history/detail, but only fully for
Agent Executor history listing:

- `list_agent_executor_runs(...)` currently requires the widget definition to
  be `agent-run`.
- `get_agent_executor_run_detail(...)` allows `agent-run` and `agent-queue`
  Direct Work owners, but not `interactive-agent`.

`crates/hobit-app/src/workspace_service/agent_executor_diff.rs` provides a
read-only Git diff summary for explicit roots, but currently requires the
widget definition to be `agent-run`.

This is the main mismatch for WorkspaceAgentV2 Direct Run review: starting a
run can be owned by Workspace Agent, but the existing history/detail/diff
read APIs are still named and scoped around Agent Executor.

## Available API Capability Matrix

| Capability | Existing API | Current owner scope | Notes |
| --- | --- | --- | --- |
| Start one-shot Codex run | `runCodexDirectWork` / `run_codex_direct_work` | `agent-run`, `agent-queue`, `interactive-agent` | One-shot path exists but streaming is preferred for Direct Run UX. |
| Start streaming Codex run | `startCodexDirectWorkStream` / `start_codex_direct_work_stream` | `agent-run`, `agent-queue`, `interactive-agent` | Best start path for V2 Direct Run. |
| Subscribe to events | `listenToDirectWorkStreamEvents` / `direct-work://event` | event payload has workspace/workbench/widget/run ids | Shared listener; callers must filter by owner and run id. |
| Attach to stream | `attachDirectWorkStreamSession` | frontend helper only | Works for current-session events; not durable reconnect. |
| Cancel run | `cancelCodexDirectWorkRun` / `cancel_codex_direct_work_run` | service accepts Direct Work-capable owners | Active process cancellation depends on current desktop active-run state. |
| Force kill run | `forceKillCodexDirectWorkRun` / `force_kill_codex_direct_work_run` | service accepts Direct Work-capable owners | Powerful control; V2 should expose only with explicit warning if added. |
| Final result | final stream event plus persisted widget result | start owner receives final event; stored result exists | V2 can use event final message immediately; persisted read API needs scope work for `interactive-agent`. |
| Run history list | `listAgentExecutorRuns` / `list_agent_executor_runs` | `agent-run` only | Blocker for Workspace Agent-owned persisted history listing. |
| Run detail | `getAgentExecutorRunDetail` / `get_agent_executor_run_detail` | `agent-run`, `agent-queue` | Blocker for Workspace Agent-owned run detail. |
| File changes / diff | `getAgentExecutorDiffSummary` / `get_agent_executor_diff_summary` | `agent-run` only | Blocker for Workspace Agent-owned diff review unless V2 uses a separate explicit Git/Finder API. |
| Validation run | `runDirectWorkValidation` / `run_direct_work_validation` | likely Direct Work owner validation path | Existing frontend route is Agent Executor action-shaped; V2 validation UI is not yet defined. |
| Model selection | none in Direct Work request | current Codex executable only | No model/reasoning/profile fields are exposed by current API. |
| Sandbox | `sandbox` field | `read_only`, `workspace_write`, `danger_full_access` | V2 must keep dangerous access non-default and explicit. |
| Approval policy | `approvalPolicy` field | `never`, `on_request`, `untrusted` | V1 uses `never`; V2 preflight must show selected value. |
| Thread resume | `codexThreadId` field and parsed stream `codexThreadId` | caller-managed | V1 has safe scope helper; V2 needs equivalent state. |
| Tool policy | no Direct Work API field | Codex CLI behavior only | V2 AgentRuntime `toolPolicy` is conceptual; no `allowed_tools` enforcement exists in Direct Work. |

## Recommended Adapter Path

Recommended path: **frontend WorkspaceAgentV2 provider adapter wraps the
existing Direct Work service/session layer**, not a second CLI runner and not a
raw one-off Tauri command wrapper.

The adapter should sit between WorkspaceAgentV2 UI state and the existing
frontend Direct Work action/session APIs:

```text
WorkspaceAgentV2
  -> WorkspaceAgentV2 Codex provider adapter
  -> startDirectWorkStreamSession / cancelCodexDirectWorkRun
  -> tauriCodexDirectWorkApi
  -> existing Tauri commands
  -> hobit-app Direct Work service
  -> hobit-tools Codex runner
```

Why this is preferred:

- It reuses the current backend/runtime command construction and avoids a
  second CLI runner.
- It reuses the existing stream listener race handling and final-event cleanup.
- It can map current `DirectWorkStreamEvent` values into `AgentRunEvent`
  without changing backend DTOs in the first slice.
- It preserves Workspace Agent V1 because V2 can use its own adapter/controller
  while leaving V1 `useWorkspaceAgentDirectWorkController` untouched.
- It matches `docs/AGENT_RUNTIME_PROVIDER_CONTRACT.md`, which says the Codex
  adapter may wrap the existing Direct Work foundation while keeping CLI
  command construction behind the backend/runtime boundary.
- It keeps Direct Run visible and operator-controlled through V2 preflight,
  rather than hiding execution behind Queue, Terminal, or a generic runner.

The adapter should not call `invoke("start_codex_direct_work_stream")`
directly unless the shared session helper cannot be reused. A thin Tauri
wrapper is the fallback, not the preferred design, because it would duplicate
listener setup, run-id filtering, abort handling, final event cleanup, and
activity/log refresh behavior.

## Suggested V2 Adapter Shape

Smallest safe first slice:

- Add a V2-local Codex adapter/controller that accepts:
  - Workspace id;
  - Workbench id;
  - V2 widget instance id;
  - visible prompt;
  - explicit working directory;
  - explicit sandbox;
  - explicit approval policy;
  - optional current-session Codex thread id;
  - optional timeout/output caps if surfaced.
- Use `startDirectWorkStreamSession` for launch.
- Use `cancelCodexDirectWorkRun` for Stop.
- Map stream events to `AgentRunEvent` / V2 activity pane events.
- Map final stream event to `AgentRunResult` and transcript result message.
- Keep thread state scoped by workspace id, widget instance id, and working
  directory, matching the V1 safety model.
- Show missing persisted history/diff support honestly instead of pretending
  full review is available.

## Required Blockers / Gaps Before Full Safe Direct Run

Current APIs can support a real foreground WorkspaceAgentV2 Codex Direct Run
start/cancel/event/final-result path, with these blockers for a complete safe
review surface:

1. **No extracted WorkspaceAgentV2 Codex adapter exists.**
   `agentRuntimeTypes.ts` is type-only; there is no implementation that maps
   Direct Work requests/events/results to V2 `AgentRun*` types.

2. **WorkspaceAgentV2 has no run state controller.**
   The scaffold has prompt/new-thread/callback props, but no equivalent of the
   V1 Direct Work controller for preflight, lifecycle, transcript result,
   activity, errors, cancellation, or thread scope.

3. **Persisted run history listing is Agent Executor-only.**
   `list_agent_executor_runs` rejects non-`agent-run` owners. WorkspaceAgentV2
   can start and observe current-session runs, but cannot safely list its own
   persisted run history through this API if it owns runs as
   `interactive-agent` or a future V2 widget id.

4. **Persisted run detail excludes Workspace Agent owners.**
   `get_agent_executor_run_detail` accepts `agent-run` and `agent-queue`, but
   not `interactive-agent`. V2-owned Direct Run persisted detail would need a
   renamed/generalized read API or owner-scope expansion.

5. **Diff summary is Agent Executor-only.**
   `get_agent_executor_diff_summary` requires an `agent-run` widget. V2 Direct
   Run can use the final event and separate visible Git/Finder review, but a
   V2-owned direct file-change/diff panel needs a generalized read-only diff
   API or explicit Finder/Workspace Git integration.

6. **No model/reasoning fields exist in current Direct Work API.**
   Current request chooses a Codex executable, sandbox, approval policy, prompt,
   working directory, thread id, timeout, and caps. It does not expose model,
   reasoning effort, or provider-profile fields. V2 preflight must show those
   as unavailable or defer them until backend/runtime support exists.

7. **Tool policy is not represented in Direct Work requests.**
   V2 `AgentToolPolicy` is conceptual, but current Codex Direct Work does not
   accept an `allowed_tools` field. Any V2 UI must not claim provider tool
   enforcement beyond the explicit sandbox/approval policy already supported.

8. **Attach/reconnect is current-session only.**
   `attachDirectWorkStreamSession` can subscribe to live events for a known run
   in the current desktop process. It is not durable reconnect/resume after app
   restart.

9. **Validation is available but not V2-designed.**
   `runDirectWorkValidation` exists, but V2 has no contract-specific validation
   UI or result mapping. It should remain out of the first Direct Run launch
   slice unless explicitly scoped.

10. **Dangerous sandbox is technically accepted.**
    Current types include `danger_full_access`. V2 must keep it non-default,
    visibly high-risk, and confirmation-gated if exposed at all.

## Rejected Path

Reject: **second CLI runner or duplicate execution path**.

WorkspaceAgentV2 must not shell out to Codex from frontend code, add a separate
Tauri command that reconstructs Codex CLI invocation, or bypass the
`hobit-app` Direct Work service. That would duplicate command construction,
stream parsing, cancellation, persistence, no-auto-commit/no-auto-push flags,
and ownership checks, and it would increase the risk of hidden execution or
contract drift.

## Fallback Path

Fallback: **thin frontend wrapper around existing Tauri command**.

Use this only if the shared frontend session helper cannot be reused by V2.
The wrapper must still call the existing Tauri commands and must duplicate the
same safety behaviors:

- subscribe before start;
- filter by workspace/workbench/widget/run id;
- handle abort/listener cleanup;
- call existing cancel command;
- surface final status honestly;
- never construct Codex CLI syntax in frontend code.

## Final Recommendation

Proceed with a focused WorkspaceAgentV2 Codex provider adapter that wraps the
existing frontend Direct Work session/action layer.

First implementation block should be limited to current-session Direct Run:

- explicit preflight;
- explicit launch;
- stream events into V2 activity;
- final result into V2 transcript;
- Stop via existing cancellation;
- no Queue run creation;
- no persisted history/diff claims unless the owner-scope blockers are fixed;
- no model/reasoning/tool-policy claims beyond what current API supports;
- no new backend command and no duplicate Codex runner.

