# Architecture

This document is structural guidance for Hobit's repository layout, layering,
bridge boundaries, and verified current architecture shape. It is not the final
source of truth for current widget behavior or domain-specific widget details.

For current implemented widget behavior, defer to
`docs/CURRENT_WIDGET_SURFACE.md`. For Notes behavior, defer to
`docs/NOTES_WIDGET_CONTRACT.md` and
`docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`. For active/stale document priority,
defer to `docs/ACTIVE_CONTRACT_INDEX.md`. For retained Agent Chat / Agent
Monitoring / proposal-era API compatibility status, defer to
`docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md`. If this document
conflicts with those sources, treat the conflicting Architecture section as
stale unless the current task explicitly says otherwise.

For desktop-first host boundaries and future server-ready guardrails, see
`docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md`. The current
implementation remains desktop/Tauri-hosted only; no server host, enterprise
permission layer, or shared knowledge runtime exists today.

For the current foundation-refactor checkpoint before Knowledge, Skills,
Evidence, Artifact, or Context Pack UI work, see
`docs/ARCHITECTURE_MILESTONE_STATUS.md`. That document is status/roadmap only
and does not add runtime behavior.

The current repository contains a root Rust workspace that includes the core
crates and the Tauri desktop shell, a Vite/React frontend, a minimal Tauri
workspace bridge, and a SQLite workspace persistence foundation. The current
user-facing widget set is Agent Executor, Agent Queue, Workspace Agent,
Database / JDBC, Skill Library, Runbook, Git, Terminal, and Notes. Workspace Agent reuses the
existing `interactive-agent` widget id/component for compatibility and is a
foreground chat-based AI agent widget for planning, reasoning, task drafting,
outcome review, visible attachment review, and deciding what should be
promoted to Queue or sent through an Executor path. The target architecture
treats Workspace Agent as the foreground AI agent surface for interactive
Workspace work through controlled capabilities; chat is the interaction model,
not the capability limit. Multiple Workspace Agent widgets can exist in one
Workspace, each with independent context, thread state, and working directory.
Coordinator was the previous user-facing name for this surface and remains a
legacy compatibility term. Agent Executor reuses the existing `agent-run`
widget identity for persistence compatibility, shows each widget instance as a
visible async/background execution slot for Queue/Executor work, owns run
detail/logs/final responses, and keeps the current Codex CLI Direct Work
behavior: explicit Workspace, Workbench, owning
widget instance, executable, execution workspace path, operator prompt,
sandbox, approval policy, timeout, and output caps. The
compatibility field remains `repo_root` and currently expects an existing
repository or local project folder; scratch execution workspace support is not
implemented and must not default to user home. The Codex launch helper is
platform-aware: Windows preserves `codex.cmd` as the default helper path and
wraps `.cmd`/`.bat` shims with `cmd.exe /D /C`, while Unix/Linux defaults to
`codex` and runs explicit executable paths directly without a shell wrapper.
Terminal has a visible desktop PTY session
surface for explicit Terminal widget owners, but shipped backend PTY session
support is currently Windows-only; non-Windows desktop builds return an
unsupported-platform error for live PTY creation until platform support or
catalog gating is added. Terminal preserves the bounded one-shot command path
as a demoted legacy fallback for persisted Terminal widget instances. Git has a narrow manual
desktop-only status/diff review surface plus explicit selected-file local
commit UI with operator confirmation. Agent Queue is a preview async
execution-support surface for promoted/larger work blocks backed by
Workspace-scoped task storage/API, assignment API/UI, explicit assigned-task
start, safe selected-task Executor run-link visibility, and an operator-armed
desktop-local Queue Autorun preview. Queue is not the default destination for
every Workspace Agent idea or small operator action and has no backend scheduler,
durable reconnect/resume, server worker, or hidden/unarmed auto-dispatch.
Database / JDBC is a Preview connector
metadata and mock read-only query surface backed by workspace-local JDBC
connector metadata storage/API plus widget-owned SQL validation and bounded
mock execution APIs; there is no credential storage, real database query
execution, production Java sidecar runtime, `EXPLAIN`, AI SQL assistance, or
Workspace Agent JDBC tool runtime. A backend adapter boundary now separates the
active `MockReadOnlyJdbcAdapter` from a future Java sidecar runtime; the
sidecar adapter is opt-in/test-only and does not load credentials, drivers, or
open database connections. A dependency-free Java sidecar scaffold exists under
`sidecars/jdbc-readonly-sidecar/` for the narrow stdin/stdout JSON protocol
smoke only. A backend-only JDBC runtime config loader can parse explicit
sidecar launch/runtime keys and select the sidecar adapter for tests/future
desktop wiring, but `WorkspaceService::new(...)` and current desktop commands
remain mock-default. The loader surfaces safe status only and does not expose
raw paths or credential values to frontend DTOs. A JDK-gated backend activation
test can compile and run the Java sidecar `mock_read_only` protocol through
explicit `JdbcRuntimeConfig`, and skips cleanly when a JDK is unavailable.
Workspace Agent product direction is represented today by Workspace Agent
as a foreground chat-based work surface, with frontend action proposal
cards, visible attachments, and a backend-owned provider response path for
explicit chat sends. The broader target Workspace Agent model is a foreground
agent capable of approved Workspace reads, coding/code review, file edits,
commands/validation, Terminal/SSH, Git, JDBC/database work, Notes, Skill
Library/Knowledge, Queue, Executor, run-history, and future
Artifacts/Evidence through capability providers. Mock/local is the default
provider. The current provider path uses visible current-session chat context
and `allowed_tools: []`; it can return validated safe structured proposal
drafts as review cards only. An explicitly configured
HTTP JSON provider can be selected from backend environment configuration and
can call a configured `http://` endpoint without exposing credential values to
frontend state, prompts, logs, proposal cards, or serialized responses. A
backend timeout, safe body-size caps, and normalized provider statuses surface
network failures, timeouts, invalid responses, provider error statuses, and
oversized traffic visibly. Provider cancellation is not implemented yet for
the blocking HTTP JSON adapter. A
deterministic frontend parser can generate the safe local proposal types from
explicit operator chat text only. An approved
create-Agent-Queue-task proposal can create a draft workspace-scoped Queue task
through the existing Queue task API only after a separate operator create
action; it does not assign, dispatch, run, or hand the task to Agent Executor.
An approved create-Note proposal can create a workspace-local Note through the
existing Notes create API using only visible title, body, and pinned inputs. No
hidden context access, hidden Notes reads, hidden widget reads, direct
Workspace Agent filesystem read/write, command or SSH execution, JDBC capability
execution, Git mutation, unified permission/policy UI, provider tool mode,
audit emission/persistence, or broad tool execution is implemented, and
unsupported or unsafe provider drafts are
rejected or degraded before rendering. Runbook has a local/manual steps MVP.
There is no
Agent Chat proposal surface, Agent Monitoring surface, Template Library, Dock, Agent CLI
runtime, Script Runner, JIRA, Confluence, Image Edit, Terminal tabs, Terminal
split panes, Terminal command history, executable chat runtime beyond the
manual Direct Work/Queue API paths, Git behavior beyond current status/diff
review and explicit local commit, hidden context access, provider settings UI,
secrets UI, direct HTTPS vendor adapter, Evidence/Sources capture or review, AI
context packs, or broad tool execution in the current user-facing workbench
surface.

## Documentation Contracts

`ACTIVE_CONTRACT_INDEX.md` is the compact navigation source for choosing which
contracts to read for a block. If older documentation conflicts with that
index, `CURRENT_WIDGET_SURFACE.md`, or
`COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`, treat the older text as stale and
update or report it.

`PRODUCT_POSITIONING.md` defines Hobit's core positioning as an
operator-controlled AI Workbench for precise, fast, and efficient work with AI
agents, with Workspace Agent as the foreground interactive agent surface. Future
architecture must not drift toward a generic hidden automation or agent-runner
system.

`DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md` defines Hobit's
desktop-first, server-ready architecture guardrails. It treats Tauri as the
current host/transport bridge, keeps product logic behind reusable application
service, adapter, capability, artifact, and event boundaries, and does not
implement a server runtime or enterprise layer.

`DESIGN_SYSTEM_CONTRACT.md` defines the base visual language for future frontend and widget work.

`PRODUCT_UI_VISUAL_CONTRACT.md` defines the target product visual direction for
UI polish blocks: dark dotted canvas, grid-aware widget geometry direction,
thin top bar, shared dark/glass widget cards, compact controls, status chips,
clean tables, preview honesty, and prohibited UI overclaims.

`TERMINAL_PTY_WIDGET_CONTRACT.md` defines Terminal PTY behavior, safety
boundaries, and current platform limitations. PTY runtime/Tauri command
foundations and the first visible frontend PTY session UI now exist for
explicit Terminal widget owners in the desktop shell, with shipped live PTY
backend support currently limited to Windows. Non-Windows desktop builds may
compile, but live PTY creation is unsupported until Deferred platform support
or catalog gating is implemented. Tabs UI, split panes, persistent
transcripts/history, event-stream bridge hardening, and storage/schema changes
are not implemented.

`WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` defines Minimal, Operational, and Full / Expert widget display levels. Future widget architecture and UI blocks should start from the smallest useful surface, avoid raw/debug defaults, and add deeper complexity only through explicit later slices.

`CURRENT_WIDGET_SURFACE.md` captures the current post-cleanup user-facing widget inventory and implementation boundaries.

`AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` defines the Compatibility /
pending-retirement status for retained Agent Chat, Agent Monitoring, and
proposal-era API paths. It does not define current preferred widget names,
current widget behavior, future Coordinator architecture, or product roadmap.

`COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` is the legacy-named active
product-model contract: Workspace Agent is a foreground interactive AI agent
widget; widgets expose controlled Workspace capabilities; Agent Queue
organizes promoted/larger async work blocks; Agent Executors run
queued/background tasks and provide execution visibility; the operator controls
context, autonomy, approvals, and acceptance.

`WIDGET_CAPABILITY_TOOL_CONTRACT.md` defines the product and technical boundary
for those widget capabilities: capability descriptors, risk levels, autonomy
and confirmation rules, context exposure, secrets policy, audit expectations,
and widget-specific capability examples. It is contract-only and does not
implement a capability registry, runtime, schema, Tauri commands, or widget
tools.

`EVIDENCE_SOURCES_CONTRACT.md` defines the future trust layer for sources,
captured evidence, AI interpretation, provenance, capping, redaction, and
explicit AI-context approval. It is contract-only and does not implement
frontend UI, backend or Tauri commands, storage/schema changes, Workspace Agent
runtime, AI provider integration, widget tool execution, or evidence capture.

`JDBC_WIDGET_CONTRACT.md` defines the Database/JDBC Current Preview behavior
and safety model: connector metadata boundaries, bounded mock/safe read-only
SQL validation/execution, query limits, secret isolation, production-runtime
deferrals, and Workspace Agent SQL execution boundaries. The current
implementation foundation adds workspace-local connector metadata storage/API,
a Preview connector metadata UI, and a widget-owned mock/safe read-only SQL
validation/execution path with bounded sample results; production database
execution, credentials, production sidecar runtime, `EXPLAIN`, and Workspace Agent
runtime remain Deferred.

`AGENT_SURFACE_MODEL.md` defines the near-term agent/work surface model:
Workspace Agent handles the implemented conversation/planning/review subset as
the foreground Workspace agent, Agent Queue organizes promoted async tasks and
executor history, Agent Executor runs queued/background tasks and shows
execution, and Runbook remains a deferred procedural surface.

`AGENT_OPERATING_MODEL.md` defines the future agent/executor operating model for agent-assisted block work. It is a contract only; no automatic execution, Queue execution, response validation engine, or required Workspace Agent product surface is implemented yet.

`AGENT_WORK_EFFICIENCY_CONTRACT.md` defines small focused blocks, execution budgets, validation profile plans, and stop/split rules for efficient agent work. It is docs-only and does not implement runtime behavior, UI, storage, Tauri commands, queue execution, or validation script behavior.

`AI_INTEGRATION_READINESS_CONTRACT.md` defines the current Workspace Agent
provider/runtime readiness boundary: explicit visible context only,
backend/runtime provider ownership, draft text and proposal output only,
validated proposal cards, and `allowed_tools: []`. Older Agent Chat provider
compatibility paths do not define the current Workspace Agent product surface.

`DIRECT_MODE_AGENT_CONTRACT.md` defines the current Agent Executor path for small approved work. It keeps the model agent-agnostic, names Codex CLI as the first executor kind, and requires an explicit execution workspace path, prompt, sandbox/mode, visible run status, raw log/final response capture, changed-file review when the path is a Git repository, no hidden background execution, and no auto-commit or auto-push. Backend/tooling Codex CLI foundations now exist in `hobit-tools`: an availability/version probe for `codex --version` or `<explicit-program> --version`, a one-shot Direct Work runner that resolves the requested executable without shell invocation, builds `codex exec` with fixed argv for an explicit execution workspace path and operator prompt, captures stdout/stderr/final message in the OS temp directory, applies caps and timeout, and returns a structured result, plus a streaming `codex exec --json` runner that emits stdout/stderr/JSON/final events to a callback. Windows keeps `codex.cmd` and `.cmd`/`.bat` wrapper support; Unix/Linux defaults to `codex` and does not use `cmd.exe`. The app/Tauri boundary exposes `run_codex_direct_work` for explicit Workspace, Workbench, owning `agent-run` widget instance, Codex executable, execution workspace path, operator prompt, sandbox, approval policy, timeout, and output caps; the compatibility DTO/storage field remains `repo_root`. It persists widget run/log/result artifacts and stores no-auto-commit/no-auto-push safety flags. The app/Tauri boundary also exposes `start_codex_direct_work_stream`, which creates the run immediately, starts the streaming runner in the background, emits `direct-work://event` payloads, appends widget logs during the run, and stores the final widget result. Agent Queue can manually start an assigned task through that same stream path via explicit frontend controls and backend/API, and operator-armed Queue Autorun can start eligible assigned tasks through that path one at a time while Hobit remains open. No hidden/unarmed Agent Queue dispatch, scratch execution workspace support, Git mutation, auto-commit, auto-push, embedded PTY, or interactive Codex session is implemented yet.

`DEMO_FLOW_CHECKLIST.md` defines the earlier manual pre-AI demo verification scope. It does not define the current user-facing widget set.

`WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` is the legacy-named target
Workspace-aware Workspace Agent contract for approved context
reading, approved action modes, widget capability use, safety/action levels,
and async delegation through Queue/Executor. It is contract-first and does not
add current runtime behavior.

`WORKSPACE_CONTRACT.md` defines Workspace as the durable isolation boundary for distinct problems and Workbench as a surface inside a Workspace. Future multi-open Workspace UI, Workspace tabs/sidebar/windows, and multiple Workbenches per Workspace must follow the rule: different problem = different Workspace; different surface for the same problem = additional Workbench.

`AGENT_QUEUE_CONTRACT.md` defines Agent Queue as an operator-controlled agent command queue, command history, and review inbox. The frontend currently exposes Agent Queue as a manual task queue UI with retained proposal-review compatibility paths; explicit frontend controls and a backend/API foundation can manually start an assigned task in its assigned Agent Executor, and operator-armed Queue Autorun can continue eligible assigned tasks one at a time in the current desktop session. No backend scheduler, durable reconnect/resume, hidden/unarmed dispatch, approval/apply behavior, response capture/parser/validator, automatic acceptance, or dependency behavior is implemented yet.

`AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` defines the future Agent Queue task
model: workspace singleton queue items, statuses, dependencies, Agent Executor
capacity slots, and manual assignment direction. A manual task storage/API
foundation now exists for create, list, read, update, assign, and clear
operations, and the frontend consumes those task and assignment paths through a
manual task product UI. A manual start API can route an assigned task into its
assigned Agent Executor, and the Queue Autorun preview can start eligible
assigned tasks after an explicit operator arm action in the current desktop
session. Scheduler behavior, dependencies, durable reconnect/resume,
hidden/unarmed dispatch, and automatic routing are not implemented.

`QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` defines the manual assignment
boundary between Agent Queue tasks and visible Agent Executor slots. The
storage/app/Tauri/frontend API foundation can persist and clear
`assigned_executor_widget_id`; assignment is not execution, dispatch,
scheduling, dependency resolution, Terminal launch, Git mutation, or Agent
Executor auto-start.

`QUEUE_ITEM_EXECUTION_CONTRACT.md` defines the manual run boundary for starting
an assigned Agent Queue task in its assigned Agent Executor. The current
implementation follows that boundary through explicit operator start, visible
execution workspace handling, and normal Agent Executor Direct Work ownership.
It does not add hidden/unarmed dispatch, a scheduler, Terminal launch,
auto-commit, push, or hidden execution.

`QUEUE_ITEM_EXECUTION_POLICY_CONTRACT.md` defines the Queue item
`executionPolicy` model and Sequential Queue Runner semantics. The current
implementation includes a visible frontend-driven, current-session-only
Sequential Queue Runner, not a durable backend scheduler, and it remains
bounded by `CURRENT_WIDGET_SURFACE.md`.

`INTERACTIVE_AGENT_WIDGET_CONTRACT.md` now remains compatibility context for
the existing Interactive Agent widget id and local chat foundation. Near-term
product work should reposition that surface as Workspace Agent instead of
adding a second separate chat concept.

`RUNBOOK_WIDGET_CONTRACT.md` defines Runbook as a separate step-based procedural work surface. It is not Agent Queue, Agent Executor, Workspace Agent, automatic scheduling, tool execution, Terminal automation, Git mutation, or an approval/apply workflow.

`AGENT_RUN_OBSERVABILITY_CONTRACT.md` defines future Raw Log, Overview Log, and Result Report views for agent/task execution. The frontend has an insertable Agent Executor surface backed by Codex Direct Work artifacts. Full frontend runtime log viewing, Terminal result monitoring, arbitrary widget result monitoring, overview summarizers, response validation, broader executor integration, and real agent runtime UI are not implemented yet.

`SCRIPT_RUNNER_WIDGET_CONTRACT.md` defines the future Script Runner Widget as an explicit operator-controlled configured local script action with visible script path, argv arguments, working directory, timeout, output caps, logs, results, and safety boundaries. Script Runner is not part of the current Widget Catalog, and no Script Runner UI, widget insertion, backend execution, Tauri command, storage, or runtime behavior is implemented.

`GIT_WIDGET_CONTRACT.md` defines the Git Widget / Git Plugin as a visual,
approval-aware review/control surface for repository state after
agent-assisted code work. An insertable frontend Git widget exists with a
transient explicit repository-root input, manual desktop-only read-only
status/diff review, grouped changed files, and explicit selected-file local
commit UI with operator confirmation. Repository root/status persistence,
polling, watching, fetch, log/show UI, validation association, Git-response
association, push, reset, clean, stash, and Agent Executor auto-commit are not
implemented. Git reads must use an explicit operator-approved repository root;
hidden parent traversal, Workspace-wide repository scanning, and network fetch
during read-only status collection are forbidden by that contract.

`TEMPLATE_CONTRACT.md` defines the future product/domain contract for reusable Request Templates and Response Templates. Templates are not implemented yet; they are future Workspace/Project assets for creating concrete request snapshots and validating response shape. Template Library is not part of the current Widget Catalog, and no template storage, editing, request generation, response capture, response parsing, response validation, executor integration, Git-response association, or agent execution behavior is implemented.

`NOTES_WIDGET_CONTRACT.md` defines the authoritative current Notes widget
boundary: workspace-local multi-note UI, desktop/Tauri SQLite-backed Workspace
Notes APIs, browser unsupported-runtime errors for Notes persistence, plain
title/body source text, and Compatibility/Deprecated handling for the older
widget-local `{ "body": "..." }` draft state. Full Notebook behavior,
Markdown/Mermaid rendering, rich formatting, autosave, archive/delete UI, tags,
AI-in-Notes, and hidden agent access are Deferred.

`NOTES_WIDGET_PRODUCT_CONTRACT.md` defines the near-term product direction for
stabilizing the shipped workspace-local multi-note Notes surface without adding
Notebook scope. Planned follow-ups include smoke coverage, UI/controller
refactor, dev-only browser Notes API decision, and explicit archive/delete and
autosave decisions.

`WIDGET_CONTRACT.md` defines future Dock and widget view mode rules. Dock is a Workspace-local perimeter surface for existing WidgetInstances in Indicator view. Clicking a Dock item should open future Compact view, while moving it to Canvas should open Full view. Real Dock behavior, Full/Compact/Indicator rendering behavior, persisted widget presence zones, and drag-and-drop between Canvas, Dock, Float, and future external windows are not implemented yet.

## Current Repository Skeleton

The implemented skeleton is:

```text
apps/
  desktop/
    README.md
    frontend/
      README.md
    src-tauri/
      README.md
      Cargo.toml
      tauri.conf.json

crates/
  hobit-core/
  hobit-storage-sqlite/
  hobit-agent/
  hobit-tools/
  hobit-app/
```

The root `Cargo.toml` defines a Rust workspace for `apps/desktop/src-tauri` and the five crates under `crates/`. Root workspace validation checks the Tauri desktop shell and the core crates together.

`hobit-core` contains minimal domain contract types.

`hobit-storage-sqlite` contains the initial idempotent SQLite schema and row-level storage primitives.

`hobit-agent` and `hobit-tools` are placeholder crates with package metadata and crate-level documentation. `hobit-app` contains the current Workspace application service foundation.

`apps/desktop/frontend` contains the current workspace/start screen and Empty Workbench frontend. `apps/desktop/src-tauri` contains a minimal Tauri 2 desktop shell that hosts the frontend and exposes workspace lifecycle/state commands.

## Current Frontend Milestone

A Vite, React, and TypeScript frontend scaffold exists under `apps/desktop/frontend`.

The current UI starts with a Workspace Start Screen shell. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands, loads the Workspace Workbench state through the workspace API facade, maps it into `WorkbenchViewState`, and then opens the Empty Workbench shell.

In plain browser/Vite development, the frontend uses an in-memory workspace API fallback so the start screen remains usable without Tauri. Browser fallback state is not persisted, and its Workbench state remains an in-memory empty surface.

The Empty Workbench shell intentionally renders no concrete widgets by default. New Workspaces still start with zero widget instances.

The frontend includes a Widget Catalog drawer opened from Add Widget controls.
The current user-facing catalog exposes Ready templates for Agent Executor,
Git, Terminal, and Notes, plus Preview templates for Workspace Agent, Agent
Queue, Database / JDBC, Skill Library, and Runbook. Workspace Agent uses the current
`interactive-agent` compatibility/local-chat placeholder as the central
operator work surface. Agent Executor reuses the existing `agent-run`
definition id for persistence compatibility.
Database / JDBC is a Preview connector metadata surface with shipped mock/safe
read-only SQL validation and bounded mock execution UI/API. Retired surfaces
such as
Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner,
JIRA, Confluence, Image Edit, and separate legacy Coordinator previews are not
shown in the current catalog or workbench surface.

There is no general shell execution outside the explicit Terminal PTY and
legacy one-shot fallback surfaces, script execution, executable Workspace Agent
runtime, Workspace-aware agent action runtime, executable proposal
behavior, Agent Queue scheduler/automatic dispatch/runtime, Terminal result
monitoring, arbitrary widget result monitoring, Template Library runtime, template
storage/editing/request generation/response validation, Git behavior beyond
manual desktop-only status/diff review and selected-file local commit for an
explicit transient repository root, real capability widget insertion beyond
Agent Executor, Agent Queue, Workspace Agent, Database / JDBC, Runbook, Git,
Terminal, and Notes, real Dock behavior, widget Full/Compact/Indicator view
mode behavior,
persisted presence zones beyond current canvas/floating presentation, preset
editor, full drag/drop layout editor, snapping, collision detection,
auto-reflow, floating overlay resize, true external Tauri/OS popout window
behavior, persisted external popout geometry, always-on-top behavior, or full
Notebook/Notes document model yet.

## Current Desktop Shell Milestone

`apps/desktop/src-tauri` now contains a minimal Tauri 2 desktop shell for Hobit.

The shell loads the frontend dev server at `http://127.0.0.1:5173` during development and uses `apps/desktop/frontend/dist` for production frontend assets.

This milestone hosts the existing frontend and allows it to call the workspace lifecycle commands when running inside Tauri.

## Current Tauri Workspace Bridge Milestone

The Tauri shell initializes a local SQLite database at `hobit.sqlite3` in the Tauri app data directory by default.

On startup, the shell creates the database parent directory if needed, checks that the database path or parent directory is writable, and runs the idempotent SQLite schema initialization. For development or constrained smoke environments, `HOBIT_DATABASE_PATH` may be set to an explicit writable SQLite file path; startup keeps the normal app-data location unless that override is present and reports the database path, parent directory, attempted operation, and remediation hint when the database cannot be written.

The shell exposes WorkspaceService lifecycle and widget foundation commands over the Tauri bridge:

- `create_workspace`
- `list_workspaces`
- `get_workspace_summary`
- `open_workspace`
- `get_workspace_workbench_state`
- `add_widget_instance_to_workbench`
- `update_widget_instance_state`
- `update_widget_instance_layout`
- `list_widget_logs`
- `list_agent_executor_runs`
- `get_agent_executor_run_detail`
- `run_terminal_command`
- `create_terminal_pty_session`
- `write_terminal_pty_session`
- `resize_terminal_pty_session`
- `stop_terminal_pty_session`
- `kill_terminal_pty_session`
- `close_terminal_pty_session`
- `get_terminal_pty_session`
- `list_terminal_pty_sessions`
- `generate_coordinator_provider_response`
- `generate_agent_chat_ai_proposal`
- `persist_agent_chat_proposal`
- `get_agent_monitoring_snapshot`
- `create_agent_queue_item_from_proposal`
- `get_agent_queue_snapshot`
- `create_agent_queue_task`
- `list_agent_queue_tasks`
- `get_agent_queue_task`
- `update_agent_queue_task`
- `assign_agent_queue_task_to_executor`
- `clear_agent_queue_task_assignment`
- `start_assigned_agent_queue_task`
- `get_git_repository_status`
- `create_git_commit`
- `create_jdbc_connector`
- `list_jdbc_connectors`
- `get_jdbc_connector`
- `update_jdbc_connector`
- `validate_jdbc_read_only_sql`
- `execute_jdbc_read_only_query`

The current Tauri bridge source keeps app state and SQLite initialization in `app_state.rs`, Workspace command handlers in `workspace_commands.rs`, Agent Queue task command handlers in `agent_queue_task_commands.rs`, JDBC connector command handlers in `jdbc_connector_commands.rs`, and command DTO mapping in focused DTO modules.

The React frontend calls the workspace lifecycle, widget mutation/log read,
workspace-local notes create/list/read/update API, workspace-local JDBC
connector metadata create/list/read/update API, Agent Queue task
create/list/read/update/assign/clear/start API, Agent Executor history reads,
Git status/local commit APIs, Terminal one-shot command, Terminal PTY session
API, Coordinator provider response API, Agent Chat backend AI
proposal generation, Agent Chat proposal persistence, Agent Monitoring
proposal artifact read, Agent Queue proposal-review item paths, and the typed
Direct Work API facade through the workspace API facade when running inside
Tauri. The browser/Vite path uses the same facade with an in-memory
implementation; browser fallback throws a visible unsupported state for real
Git status reads and local commit creation, Terminal command execution,
Terminal PTY sessions, workspace-local notes persistence, JDBC connector
metadata persistence, Agent Queue task persistence/assignment/execution
persistence, Codex Direct Work execution, Agent Executor persisted
history/detail reads, backend AI provider calls, Coordinator provider
calls, Agent Chat proposal persistence, Agent Monitoring persisted artifact
reads, and Agent Queue persistence. The JDBC connector metadata commands store
and return masked/non-secret connector descriptors only; they do not store
passwords, tokens, secret references, credentials, driver jars, query text, or
query results, and they do not test connections. Separate JDBC query commands
validate conservative read-only SQL and return bounded deterministic mock
results or sanitized validation/runtime errors; they do not execute SQL against
external systems.

The `generate_coordinator_provider_response` Tauri command is called only from
Workspace Agent after an explicit operator message. It validates
Workspace/Workbench/current `interactive-agent` widget ownership, builds a
request from visible current-session chat messages and visible local proposal
draft summaries only, sets `allowed_tools: []`, and uses a backend-selected
provider adapter. Mock/local is the default. External-provider selection can
use the configured HTTP JSON provider when endpoint and credential environment
values are present; missing configuration reports not-configured and unknown
provider kinds report unsupported. Provider credentials stay backend-only and
are not sent to the frontend or prompt, and provider output cannot execute
widget capabilities.

The `run_terminal_command` Tauri command is called only from the collapsed
Terminal legacy one-shot fallback and remains limited to persisted Terminal
widget instances. The desktop shell also exposes Terminal PTY commands for
explicit Terminal widget owners: create session, write stdin, resize, stop,
kill, close, get, and list session state. The frontend Terminal PTY surface
consumes create, write, resize, stop, kill, close, and get through scoped
widget actions. PTY output/history is session-only runtime state and is
refreshed from the bounded backend buffer; it is not persisted.

The `run_codex_direct_work` Tauri command is called only from the Direct Work /
Codex panel; it validates an explicit Workspace/Workbench/widget owner,
currently allows only the `agent-run` widget definition to own Direct Work
artifacts, resolves the requested Codex executable, runs the `hobit-tools`
Codex runner outside storage transactions, and persists run/log/result
artifacts without Git mutation or auto-commit/push. The compatibility
DTO/storage field remains `repo_root`, but the product boundary is the selected
execution workspace path. The `start_codex_direct_work_stream` Tauri command
creates a Direct Work widget run immediately, returns a started run id, runs
the `hobit-tools` streaming runner in a background blocking task, emits
`direct-work://event` payloads, appends persisted widget logs during the run,
and stores the final result without schema changes or Git mutation. The
`start_assigned_agent_queue_task` command validates an assigned runnable Queue
task, explicit execution workspace path, and idle assigned Agent Executor, then
starts the same Direct Work streaming path and updates Queue task status from
`running` to a final status when the stream completes.

The read-only `list_agent_executor_runs` and `get_agent_executor_run_detail`
commands expose stored Direct Work and Direct Work validation run/result/log
summaries for the owning `agent-run` widget only; they do not rerun, delete,
mutate Git, or compute diffs. The Agent Executor frontend consumes those
history APIs in a compact read-only history/detail panel. The
`create_git_commit` command is called only from the Git widget UI, validates
explicit Workspace/Workbench/Git-widget ownership, requires explicit selected
files, an operator-provided message, and confirmation, creates a local commit
only, and does not push, reset, clean, stash, fetch, poll, watch, or
auto-commit.

The `generate_agent_chat_ai_proposal` Tauri command remains a retained
compatibility path for older Agent Chat proposal artifacts; it validates the
target Agent Chat widget, builds a proposal-only AI request artifact from the
operator prompt and approved context snapshot, calls the explicit
environment-configured provider only from the backend, normalizes the response,
and persists a proposal-only run/log/result artifact. The
`persist_agent_chat_proposal` Tauri command remains available for local/mock
fallback artifacts. The `get_agent_monitoring_snapshot` Tauri command is
read-only, filters to Agent Chat proposal-only results in the current Workspace
Workbench, and does not expose Terminal results, Direct Work results, or
arbitrary widget results. The `create_agent_queue_item_from_proposal` command
creates only a review item from a valid local mock proposal result in the same
Workspace Workbench; `get_agent_queue_snapshot` lists those review items.

The Agent Queue task commands create, list, read, update, assign, clear, and
manually start stored Workspace-scoped task records only; they do not
automatically dispatch, schedule, launch Terminal commands, run validation
automatically, mutate Git, auto-commit, or auto-push. There is no Terminal tabs
UI, Terminal split panes, PTY command history, persistent PTY transcripts,
executable chat runtime beyond Direct Work artifacts, Template Library runtime,
Git runtime beyond the narrow status/diff/local commit path, real external JDBC
query execution, workspace restore runtime, log polling, provider settings UI,
secrets UI, scratch execution workspace support, or direct HTTPS vendor
provider adapter in this milestone.

## Current Workbench State Command Milestone

`hobit-app` can now return a canonical Workspace Workbench state summary for a Workspace. The summary includes the Workspace, current Workbench, persisted widget instance summaries, shared state object summaries, and stored Workbench event summaries.

The Tauri shell exposes this through `get_workspace_workbench_state`, backed by the existing local SQLite store and `WorkspaceService`.

The frontend consumes this command through its workspace API boundary and adapts
the response into `WorkbenchViewState` before rendering the Workbench. There is
still no event replay, runtime reconstruction, automatic widget runtime
restoration, Terminal event-stream bridge, or hidden agent call behavior.

## Current Workspace Flow

The implemented desktop flow is:

```text
Create or open Workspace
  -> WorkspaceService creates or opens a WorkspaceSession
  -> frontend requests get_workspace_workbench_state
  -> Tauri bridge returns persisted Workspace/Workbench summary state
  -> frontend workspace API adapts it into WorkbenchViewState
  -> Empty Workbench renders from that view state
```

The browser/Vite flow keeps the same frontend boundary but uses in-memory Workspace and Workbench state instead of the Tauri bridge and SQLite store.

## Current Frontend Workspace Shell Milestone

The Workspace Start Screen reflects the intended user flow: open Hobit, create a local Workspace shell, then enter the Empty Workbench for the selected preset.

This milestone uses Tauri workspace commands in desktop mode and an in-memory
frontend fallback in browser mode. It loads persisted Workbench summary state
before entering the Workbench, but it does not implement runtime restoration,
widget runtime reconstruction, real capability widget insertion beyond Agent
Executor, Agent Queue, Workspace Agent, Database / JDBC, Runbook, Git,
Terminal, and Notes, or persisted browser fallback state.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and new Workspaces currently start with no visible widget instances.

`WidgetHost` remains the mapping layer from persisted widget instances to React
components. The current frontend registry contains Agent Executor, Agent Queue,
Workspace Agent through the existing `interactive-agent` renderer,
Database / JDBC, Skill Library, Runbook, Git, Terminal, and Notes renderers.

The Widget Catalog has frontend-local template metadata for current surfaces.
Ready templates are Agent Executor, Git, Terminal, and Notes. Preview templates
are Agent Queue, Workspace Agent, Database / JDBC, Skill Library, and Runbook. There is no
Planned section in the current user-facing catalog, no runtime widget loading,
and no real capability widget insertion beyond those available
templates/placeholders through the Tauri bridge yet.

The Workbench top bar includes a compact global activity/idle indicator. It is current-session frontend state only: it shows `Idle - No active local runs` by default, switches to a running Terminal status while a Terminal one-shot fallback command started from the current UI session is awaiting its backend response, and can show attention for failed or timed-out Terminal command requests. It does not poll SQLite run state, observe background work, monitor external processes, implement approvals, or imply that Agent Queue or Agent runtime execution exists.

The Notes widget is a workspace-local multi-note UI. It supports list, filter,
create, select/read, edit title/body as plain source text, explicit save, and
pin/unpin through the workspace Notes API. Desktop/Tauri persists Notes through
local SQLite-backed Workspace Notes APIs. Browser/Vite fallback keeps Notes
insertable but returns visible unsupported-runtime errors for Notes persistence
reads and writes. The older widget-local `{ "body": "..." }` draft state is
Compatibility/Deprecated and is not the preferred product model for new work.
This is not the full Notebook document model, multi-tab state, Markdown editor,
Markdown renderer, Mermaid or diagram renderer, rendered block preview system,
text formatting tool surface, autosave flow, folder/tag system, archive/delete
UI, sync/import/export, or AI-in-Notes implementation.

The Terminal widget is PTY-first. Its normal visible surface starts a manual operator-controlled shell through the desktop PTY API with explicit shell executable, optional shell args, explicit execution workspace / working directory, bounded session-only output display, stdin send, manual refresh/polling, resize by columns/rows, Stop, Kill with confirmation, and Close. Live PTY backend support is currently Windows-only; non-Windows desktop live PTY creation returns an unsupported-platform error until platform support or catalog gating is added. A collapsed legacy one-shot fallback preserves the existing command runner with explicit program, one argument per textarea line, explicit working directory, timeout, stdout/stderr caps, widget run/log/result records, and final stdout/stderr result. Browser/Vite fallback reports Terminal PTY sessions and local command execution as unsupported. Terminal still does not implement tabs, split panes, persistent command history, persistent transcripts, shell profiles, environment/secrets support, Agent-triggered execution, Queue-triggered execution, Workspace Agent control, or Script Runner behavior.

The Agent Executor widget reuses the existing `agent-run` definition id for persistence compatibility. It is the runtime execution slot for Direct Work and Queue-started assigned tasks. It keeps the Codex CLI Direct Work launch panel and does not include the retired Agent Monitoring proposal viewer. It accepts explicit Workspace, Workbench, owning widget instance, executable, execution workspace path, operator prompt, sandbox, approval policy, timeout, and output caps, and it owns run detail, logs, final responses, history, and persisted widget run/log/result artifacts without Git mutation, auto-commit, auto-push, or automatic Queue dispatch. The compatibility field remains `repo_root` for current existing repository/local project execution workspaces.

The Agent Queue widget is a preview async task organization and execution-support surface for promoted/larger work blocks. It is not the default place for every Workspace Agent idea, small task, or quick operator action. Existing proposal-review compatibility paths remain available when review records exist, and the frontend product UI consumes the manual Workspace-scoped task API for create, list, select, edit, status, priority, explicit save, visible Executor assignment, and explicit assigned-task start. Automatic dispatch is not implemented. It does not auto-run queue items, approve or apply proposals, launch Terminal, run a background queue, capture responses outside normal Agent Executor artifacts, parse or validate responses, associate Git review, automatically accept work, mutate Notes/Git/files outside the selected Direct Work execution workspace, or write task edits outside explicit task save and assignment actions.

Workspace Agent is a foreground chat-based agent work surface using the
existing Interactive Agent compatibility component. It is where the operator
plans, reasons, drafts tasks, reviews outcomes, and decides what should become
Queue or Executor work. Its compatibility contract is defined in
`docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`. The current frontend shows
deterministic local action proposal cards attached to the initial Workspace Agent
message for safe preview types: create Agent Queue task, create Note, and
prepare JDBC query suggestion text without execution. A local deterministic
parser can also create those same proposal types from explicit operator chat
messages using only the typed message text. Explicit chat sends can request a
backend-owned provider response with visible current-session chat context,
visible local proposal draft summaries, and `allowed_tools: []`. Mock/local is
the default provider. A backend environment-selected HTTP JSON provider can
call a configured endpoint when endpoint and credential values exist; missing
config reports not-configured, unknown kinds report unsupported, and provider
failures surface visibly without frontend-visible credentials. Provider drafts
for the same safe
preview types are validated before rendering, and unsafe or unsupported drafts
are rejected or degraded before display. Browser fallback keeps the deterministic local
response path and does not call a provider directly. Proposal card controls Approve, Reject,
Edit, and Copy details update local proposal state or copy proposal details. Only approved
create-Agent-Queue-task proposals expose a separate Create Queue task action,
which uses the existing workspace-scoped Queue task API to create a draft task
and does not assign, dispatch, run, or hand it to Agent Executor. Only approved
create-Note proposals expose a separate Create Note action, which uses the
existing workspace-local Notes create API with visible title, body, and pinned
inputs and does not read, search, or summarize existing Notes. JDBC proposal
cards remain non-executing; they show the visible SQL suggestion in a monospace
review block and Copy SQL copies only that SQL text without connector access,
database calls, or `EXPLAIN`. The current implementation has no frontend or
prompt-visible provider credentials, no Agent Executor integration, no
Runbook integration, no monitoring integration, no broad tool execution, no
hidden context access, no hidden widget state reads, no file mutation, no Git
mutation, no JDBC SQL execution, and no Terminal execution. Runbook is a local/manual procedural
steps MVP with states such as pending, running, done, failed, skipped, and
blocked, plus local notes/evidence. It has no persistence, step execution, edit
mode, builder, Queue integration, or agent-assisted steps.

The Git widget has a transient explicit repository-root input. In the Tauri
desktop path, it manually refreshes a read-only status snapshot through
`get_git_repository_status`, backed by `hobit-tools`, and renders compact
branch/clean-dirty/count/ahead-behind data plus grouped changed files. It can
also load a bounded selected-file diff and recent Git history through
Git-widget-owned read-only Tauri commands. It exposes explicit selected-file
local commit UI with an operator-provided message and operator confirmation.
The repository root, refreshed status, selected diff, and recent history are
local React state only. Browser/Vite fallback cannot read Git status, diffs,
history, or create local commits. Repository root/status persistence, polling,
watching, fetch, validation association, push, checkout/switch branch,
revert/reset, clean, stash, Agent Executor auto-commit, and broader Git
mutations are not implemented.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This floating widget mode is not a separate OS window and is not persisted as external window geometry. There is no real Dock parking, Compact view rendering, Dock-to-Canvas movement, persisted presence zone model, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or preset editor.

Widget frames include a widget-local Logs panel. It loads persisted widget-local logs through `list_widget_logs`, and open panels refresh after successful widget state/layout actions and Terminal one-shot fallback command responses. Existing widget add/state/layout mutations emit basic persisted logs: `Widget added`, `Widget state saved`, and `Widget layout updated`. Terminal fallback command runs emit bounded lifecycle logs. The Direct Work streaming Tauri bridge can append persisted widget logs while a Codex stream is running, and Agent Executor consumes the Direct Work stream for live run status/logs. PTY output uses frontend polling of the bounded backend session buffer. There is no event-streamed Terminal log bridge, persistent PTY transcript, or full agent run Raw Log/Overview Log/Result Report model yet.

The Workbench shell includes a collapsible Recent Activity drawer backed by workspace-scoped events from `get_workspace_workbench_state`. It is opened from the compact top-bar activity control and is not a widget body, Queue-owned history list, or runtime log console.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are pure domain contracts only. Persistence, frontend integration, and Tauri integration live outside `hobit-core`.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is wired through `hobit-app` and the Tauri workspace bridge for Workspace lifecycle, Workbench state loading, current widget insertion, Compatibility/Deprecated widget-local Notes state where present, workspace-local notes create/list/read/update operations, workspace-local JDBC connector metadata create/list/read/update operations, manual Agent Queue task create/list/read/update/assign/clear/start operations, persisted widget layout fields, workspace activity events, widget-local logs, Terminal one-shot run/result persistence, Codex Direct Work run/result persistence for the `agent-run` owner, retained proposal/review artifact paths, Git status reads, and Git local commit commands. Git status refresh is read-only and does not write repository root/status into storage; local commit results are returned to the Git widget and are not persisted as Git action artifacts yet. JDBC connector metadata stores masked/non-secret descriptors only and is removed with its owning Workspace. The storage layer is not wired to interactive terminal sessions, executable chat runtime, automatic Agent Queue dispatch/runtime, Template Library runtime, Git runtime beyond the narrow status/diff/local commit path, real external JDBC SQL execution, Terminal result monitoring, or arbitrary widget result monitoring.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, returns simple Workspace and WorkspaceSession summaries, and supports the current widget foundation mutations for adding a WidgetInstance, updating widget state, updating widget layout, and listing widget-local logs.

This application layer is wired to the Tauri workspace bridge. It includes a
bounded one-shot Terminal command orchestration path for persisted Terminal
widget instances only, creating widget run/log/result records around the shared
process adapter. It also validates explicit Terminal widget ownership for the
desktop PTY session foundation; live PTY backend support is currently
Windows-only and non-Windows creation returns an unsupported-platform error.
PTY process handles and session buffers are owned by desktop runtime state, not storage. It also includes one-shot and
streaming Codex Direct Work orchestration paths for an allowed `agent-run`
widget owner, creating widget run/log/result records around the `hobit-tools`
Codex runners outside storage transactions and emitting Tauri stream events for
the streaming path. It includes a Workspace Agent provider adapter foundation
for current `interactive-agent` widgets: request DTOs, visible-context
validation, `allowed_tools: []`, response/proposal-draft normalization, safe
draft validation, and no storage persistence. The desktop runtime supplies the
mock/local provider by default and can select the configured HTTP JSON provider
from backend environment configuration. It also includes retained
proposal-only Agent Chat AI compatibility paths, a proposal-review Agent Queue
path that validates a stored local mock proposal result before creating a
read-only queue item, manual Agent Queue task create/list/read/update/assign/
clear/start service methods, and workspace-local JDBC connector metadata
create/list/read/update plus mock read-only SQL validation/execution service
methods. The JDBC service validates allowed kind/status values, rejects obvious
secret-bearing metadata, validates conservative read-only SQL, and returns only
bounded deterministic mock query results. It does not handle credentials,
connect to real databases, or execute SQL against external systems. It does not
restore runtime state, provide
Agent Monitoring persisted Direct Work reads, provide Terminal tabs/history,
automatically dispatch tasks, approve/apply proposals, execute real JDBC
queries, create scratch execution workspaces, make external Workspace Agent
provider network calls, or add automatic agent behavior.

## Workspace Model Boundary

The current Workspace model foundation supports persisted Workspace records, WorkspaceSession records, Workbench records, widget instance summaries, widget state/layout fields, shared state summaries, widget-local logs, and Workbench event summaries.

The Workspace is the context-isolation boundary. Unrelated work such as Hobit development, a Vertica incident, VICO review, and personal planning should be separate Workspaces. Multiple Workbenches inside one Workspace are future surfaces for the same problem, not a way to mix unrelated contexts.

Full runtime restore is not implemented yet. There is no event replay, widget
runtime reconstruction, preset editor, real Dock behavior, widget
Full/Compact/Indicator view mode behavior, persisted presence zone model, full
drag/drop layout editor, real capability widget insertion beyond Agent
Executor, Agent Queue, Workspace Agent, Database / JDBC, Runbook, Git,
Terminal, and Notes, Terminal tabs/splits/history, executable
Workspace Agent runtime, automatic Agent Queue dispatch or real scheduler behavior
beyond explicit assigned-task starts, Template Library execution, Git behavior
beyond manual status/diff review and selected-file local commit, or automatic
agent runtime behavior.

## Current Notes Model Boundary

Current Notes is a workspace-local multi-note widget surface. It uses
workspace-local note records and Workspace Notes APIs for list, filter, create,
select/read, edit title/body as plain source text, explicit save, and pin/unpin.
Desktop/Tauri persists Notes through local SQLite-backed Workspace Notes APIs.
Browser/Vite fallback keeps the widget insertable but reports unsupported
runtime errors for Notes persistence reads and writes. The older widget-local
draft state shaped as `{ "body": "..." }` is Compatibility/Deprecated for new
product work.

Future Notebook may support richer text/doc structures and rendering, but that
behavior is Deferred unless explicitly scoped. Source text must remain the
durable source of truth, and future rendering must not execute commands, load
remote assets by default, or mutate note content.

The current app has Agent Executor, Agent Queue, Workspace Agent, Database /
JDBC, Skill Library, Runbook, Git, Terminal, and Notes widgets.
Workspace Agent is the current foreground chat-based agent work surface and
compatibility foundation for the target foreground Workspace Agent. It has
local current-session chat state through the existing `interactive-agent`
compatibility component, deterministic local proposal generation from explicit
chat text, visible attachments, Skill attach, Queue/Executor result metadata
attach, Executor selected excerpt / preview attach, pasted result review, and
an explicit approved-proposal bridge for creating draft Queue tasks and
workspace-local Notes only. Agent Queue has a preview async task
product UI backed by manual task storage/API only for promoted/larger work
blocks. Agent Executor keeps backend/Tauri Codex Direct Work run/result
persistence for the existing `agent-run` owner, requires an explicit execution
workspace path, and owns run detail/logs/final responses. JDBC suggestions
remain non-executing
review/copy text, and Runbook has local current-session step state plus
notes/evidence only. Database / JDBC can manage non-secret connector metadata
and perform bounded mock/safe read-only SQL validation/execution preview only.
The Git widget supports manual desktop status/diff review and explicit
selected-file local commit with operator confirmation for a transient explicit
repository root. Terminal supports a visible desktop PTY session surface plus a
collapsed legacy one-shot command fallback in the current frontend, with live
PTY backend support currently Windows-only.
There is no Notebook tab model, text formatting tool surface, folder UI,
Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block
preview system, autosave, archive/delete UI, tags, sync, Knowledge ingestion
flow, AI-in-Notes behavior, Agent Queue automatic execution/response
capture/validation, real external JDBC SQL execution, Template Library runtime,
template storage/editing/request generation/response validation, Git behavior
beyond status/diff review and selected-file local commit, or executable
Workspace Agent runtime in the current repository.

## Intended Repository Layout

Future implementation may extend the skeleton into a structure similar to:

```text
apps/
  desktop/
    frontend/
      src/
        app/
        design-system/
        workbench/
        widgets/
        state/
    src-tauri/

crates/
  hobit-core/
  hobit-storage-sqlite/
  hobit-agent/
  hobit-tools/
  hobit-app/
```

## Intended Responsibilities

`apps/desktop` is intended to host the desktop shell when the app implementation begins.

`apps/desktop/frontend` is intended to hold the future frontend app, design system, workbench shell, widget UI, and frontend state coordination.

`apps/desktop/src-tauri` holds the current minimal Tauri desktop shell and future native bridge work.

`crates/hobit-core` is intended to hold core domain contracts and shared models.

`crates/hobit-storage-sqlite` owns the current local SQLite persistence foundation.

`crates/hobit-agent` is intended to hold agent runtime integration.

`crates/hobit-tools` is intended to hold structured tool capabilities and action execution boundaries.

`crates/hobit-app` is intended to hold application orchestration.

## Current Boundary

The current repository state is documentation, repository hygiene, a root Rust
workspace including the Tauri shell, core Rust domain/storage/application
crates, a frontend Workspace Start Screen and Empty Workbench shell, a Widget
Catalog with Agent Executor, Agent Queue, Workspace Agent, Database / JDBC,
Skill Library, Runbook, Git, Terminal, and Notes, a minimal Tauri desktop host, SQLite-backed
workspace/workbench state, widget state/layout, workspace event, widget-local
log foundations in desktop mode, Terminal one-shot run/result persistence,
Codex Direct Work run/result persistence for the `agent-run` owner,
workspace-local JDBC connector metadata storage/API, frontend metadata UI, and
mock read-only query UI/API without credentials or real database SQL execution,
with a future Java sidecar adapter boundary and dependency-free sidecar
scaffold that returns sanitized mock/not-configured/unsupported statuses only,
plus backend-only opt-in runtime config parsing that does not switch the
product default away from mock execution, retained backend proposal/review artifact
paths that are not exposed as current catalog surfaces, and a narrow manual
desktop-only Git status/diff and selected-file local commit path for the Git
widget. Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/`
are ignored.

Future feature implementation must preserve the Workbench-first, widget-first, approval-aware contracts while adding real widgets, runtime behavior, and editing capabilities intentionally.
