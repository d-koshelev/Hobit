# Architecture

This document describes the current repository structure and intended future architecture for Hobit.

The current repository contains a root Rust workspace that includes the core crates and the Tauri desktop shell, a Vite/React frontend, a minimal Tauri workspace bridge, and a SQLite workspace persistence foundation. The current user-facing widget set is Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes. Agent Executor reuses the existing `agent-run` widget identity for persistence compatibility, shows each widget instance as a visible execution slot, and keeps the current Codex CLI Direct Work behavior: explicit Workspace, Workbench, owning widget instance, executable, repository root, operator prompt, sandbox, approval policy, timeout, and output caps; on Windows, resolving `codex` also tries `codex.exe`, `codex.cmd`, and `codex.bat` from PATH without invoking a shell. Terminal has a bounded one-shot command path for persisted Terminal widget instances only. Git has a narrow manual desktop-only read-only status refresh path. Agent Queue is a preview manual task queue surface backed by Workspace-scoped task storage/API, with no execution or dispatch. Interactive Agent has a local chat MVP, and Runbook has a local/manual steps MVP. There is no Agent Chat proposal surface, Agent Monitoring surface, Template Library, Dock, Agent CLI runtime, Script Runner, Database/JDBC, JIRA, Confluence, Image Edit, shell mode, interactive terminal, frontend live streaming UI, PTY, Terminal cancellation, command history, executable chat runtime, Agent Queue execution/runtime, Git mutations/diff/log/show, hidden context access, provider settings UI, secrets UI, HTTPS provider adapter, or broad tool execution in the current user-facing workbench surface.

## Documentation Contracts

`PRODUCT_POSITIONING.md` defines Hobit's core positioning as an operator-controlled AI Workbench for precise, fast, and efficient work with AI agents. Future architecture must not drift toward a generic hidden automation or agent-runner system.

`DESIGN_SYSTEM_CONTRACT.md` defines the base visual language for future frontend and widget work.

`PRODUCT_UI_VISUAL_CONTRACT.md` defines the target product visual direction for
UI polish blocks: dark dotted canvas, grid-aware widget geometry direction,
thin top bar, shared dark/glass widget cards, compact controls, status chips,
clean tables, preview honesty, and prohibited UI overclaims.

`TERMINAL_PTY_WIDGET_CONTRACT.md` defines the future Terminal transition from
the current bounded one-shot command runner to a manual operator-controlled
interactive PTY shell surface with sessions, tabs, and later split panes. PTY
runtime, tabs UI, split panes, storage/schema changes, and new Tauri commands
are not implemented.

`WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` defines Minimal, Operational, and Full / Expert widget display levels. Future widget architecture and UI blocks should start from the smallest useful surface, avoid raw/debug defaults, and add deeper complexity only through explicit later slices.

`CURRENT_WIDGET_SURFACE.md` captures the current post-cleanup user-facing widget inventory and implementation boundaries.

`AGENT_SURFACE_MODEL.md` defines the near-term agent/work surface model: Agent Executor, Agent Queue, Interactive Agent, and Runbook stay separate; Agent Executor is the current user-facing name for the `agent-run`/Codex Direct Work implementation and each Agent Executor widget instance is a future execution slot; Coordinator is deferred.

`AGENT_OPERATING_MODEL.md` defines the future coordinator/executor operating model for agent-assisted block work. It is a contract only; no automatic execution, Queue execution, response validation engine, or required Coordinator product surface is implemented yet.

`AGENT_WORK_EFFICIENCY_CONTRACT.md` defines small focused blocks, execution budgets, validation profile plans, and stop/split rules for efficient agent work. It is docs-only and does not implement runtime behavior, UI, storage, Tauri commands, queue execution, or validation script behavior.

`AI_INTEGRATION_READINESS_CONTRACT.md` defines the final pre-AI readiness gate and first real AI slice boundary: proposal-only Agent Chat, explicitly approved context, backend/provider boundary, persisted observable artifacts, and `allowed_tools: []`.

`DIRECT_MODE_AGENT_CONTRACT.md` defines the current Agent Executor path for small approved work. It keeps the model agent-agnostic, names Codex CLI as the first executor kind, and requires explicit repository root, prompt, sandbox/mode, visible run status, raw log/final response capture, changed-file review, no hidden background execution, no queue execution in the MVP, and no auto-commit or auto-push. Backend/tooling Codex CLI foundations now exist in `hobit-tools`: an availability/version probe for `codex --version` or `<explicit-program> --version`, a one-shot Direct Work runner that resolves the requested executable without shell invocation, builds `codex exec` with fixed argv for an explicit repo root and operator prompt, captures stdout/stderr/final message, applies caps and timeout, and returns a structured result, plus a streaming `codex exec --json` runner that emits stdout/stderr/JSON/final events to a callback. The app/Tauri boundary exposes `run_codex_direct_work` for explicit Workspace, Workbench, owning `agent-run` widget instance, Codex executable, repository root, operator prompt, sandbox, approval policy, timeout, and output caps; it persists widget run/log/result artifacts and stores no-auto-commit/no-auto-push safety flags. The app/Tauri boundary also exposes `start_codex_direct_work_stream`, which creates the run immediately, starts the streaming runner in the background, emits `direct-work://event` payloads, appends widget logs during the run, and stores the final widget result. The frontend surfaces this path as Agent Executor. No Agent Queue execution, Git mutation, auto-commit, auto-push, embedded PTY, or interactive Codex session is implemented yet.

`DEMO_FLOW_CHECKLIST.md` defines the earlier manual pre-AI demo verification scope. It does not define the current user-facing widget set.

`WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` defines the deferred future Workspace-aware Coordinator Agent model for explicitly approved context reading and previewed cross-widget action proposals. It is contract-first and not a current user-facing surface.

`WORKSPACE_CONTRACT.md` defines Workspace as the durable isolation boundary for distinct problems and Workbench as a surface inside a Workspace. Future multi-open Workspace UI, Workspace tabs/sidebar/windows, and multiple Workbenches per Workspace must follow the rule: different problem = different Workspace; different surface for the same problem = additional Workbench.

`AGENT_QUEUE_CONTRACT.md` defines Agent Queue as an operator-controlled agent command queue, command history, and review inbox. The frontend currently exposes Agent Queue as a manual task queue UI with retained proposal-review compatibility paths; no queue execution, dispatch, approval/apply behavior, background execution, response capture/parser/validator, executor integration, or automatic acceptance is implemented yet.

`AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` defines the future Agent Queue task
model: workspace singleton queue items, statuses, dependencies, Agent Executor
capacity slots, and manual assignment direction. A manual task storage/API
foundation now exists for create, list, read, and update operations, and the
frontend consumes it through a manual task product UI; queue execution,
scheduler behavior, dependencies, assignment, and Agent Executor runtime
changes are not implemented.

`QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md` defines the future manual assignment
boundary between Agent Queue tasks and visible Agent Executor slots. Assignment
is not execution, dispatch, scheduling, dependency resolution, Terminal launch,
Git mutation, or Agent Executor auto-start.

`INTERACTIVE_AGENT_WIDGET_CONTRACT.md` defines Interactive Agent as a separate manual long-chat work surface for exploratory agent conversation. It is not Agent Queue, Agent Executor, Runbook, Coordinator, queue dispatch, approval/apply behavior, or a hidden mutation path.

`RUNBOOK_WIDGET_CONTRACT.md` defines Runbook as a separate step-based procedural work surface. It is not Agent Queue, Agent Executor, Interactive Agent, Coordinator, automatic scheduling, tool execution, Terminal automation, Git mutation, or an approval/apply workflow.

`AGENT_RUN_OBSERVABILITY_CONTRACT.md` defines future Raw Log, Overview Log, and Result Report views for agent/task execution. The frontend has an insertable Agent Executor surface backed by Codex Direct Work artifacts. Full frontend runtime log viewing, Terminal result monitoring, arbitrary widget result monitoring, overview summarizers, response validation, broader executor integration, and real agent runtime UI are not implemented yet.

`SCRIPT_RUNNER_WIDGET_CONTRACT.md` defines the future Script Runner Widget as an explicit operator-controlled configured local script action with visible script path, argv arguments, working directory, timeout, output caps, logs, results, and safety boundaries. Script Runner is not part of the current Widget Catalog, and no Script Runner UI, widget insertion, backend execution, Tauri command, storage, or runtime behavior is implemented.

`GIT_WIDGET_CONTRACT.md` defines the future Git Widget / Git Plugin as a visual, approval-aware review/control surface for repository state after agent-assisted code work. An insertable frontend placeholder exists with a transient explicit repository-root input, manual desktop-only read-only status refresh, a visual status card, and grouped changed-files summary. Repository root/status persistence, polling, watching, diff/log/show, validation association, Git-response association, and mutating Git behavior are not implemented. Future Git reads must use an explicit operator-approved repository root; hidden parent traversal, Workspace-wide repository scanning, and network fetch during read-only status collection are forbidden by that contract.

`TEMPLATE_CONTRACT.md` defines the future product/domain contract for reusable Request Templates and Response Templates. Templates are not implemented yet; they are future Workspace/Project assets for creating concrete request snapshots and validating response shape. Template Library is not part of the current Widget Catalog, and no template storage, editing, request generation, response capture, response parsing, response validation, executor integration, Git-response association, or agent execution behavior is implemented.

`NOTES_WIDGET_CONTRACT.md` defines the future Notebook/Notes widget direction: legacy single-body Notes compatibility, multiple text tabs/documents inside one widget, Markdown source text, rendered Markdown and Mermaid fenced-block preview direction, explicit user-triggered text formatting actions, and operator-approved AI-assisted editing. The current frontend Notes widget still only persists the minimal `{ "body": "..." }` Notes draft state.

`NOTES_WIDGET_PRODUCT_CONTRACT.md` defines the near-term product direction for
evolving Notes into a workspace-local multi-note widget with storage/API first,
then note list, search, selected note editor, pinning, and save/autosave state
when implemented.
The workspace-local notes storage/API foundation now exists for create, list,
read, and update operations; the product UI is still pending.

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

The frontend includes a Widget Catalog drawer opened from Add Widget controls. The current user-facing catalog exposes Ready templates for Agent Executor, Git, Terminal, and Notes, plus Preview templates for Agent Queue, Interactive Agent, and Runbook. Agent Executor reuses the existing `agent-run` definition id for persistence compatibility. Retired surfaces such as Agent Chat, Agent Monitoring, Template Library, Dock, Agent CLI, Script Runner, Database/JDBC, JIRA, Confluence, Image Edit, and Coordinator previews are not shown in the current catalog or workbench surface.

There is no shell execution, script execution, executable chat runtime, Workspace-aware Coordinator surface, executable proposal behavior, Agent Queue runner/real command queue/execution history, Terminal result monitoring, arbitrary widget result monitoring, Template Library runtime, template storage/editing/request generation/response validation, Git behavior beyond manual desktop-only read-only status refresh for an explicit transient repository root, real capability widget insertion beyond Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zones beyond current canvas/floating presentation, preset editor, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or full Notebook/Notes document model yet.

## Current Desktop Shell Milestone

`apps/desktop/src-tauri` now contains a minimal Tauri 2 desktop shell for Hobit.

The shell loads the frontend dev server at `http://127.0.0.1:5173` during development and uses `apps/desktop/frontend/dist` for production frontend assets.

This milestone hosts the existing frontend and allows it to call the workspace lifecycle commands when running inside Tauri.

## Current Tauri Workspace Bridge Milestone

The Tauri shell initializes a local SQLite database at `hobit.sqlite3` in the Tauri app data directory.

On startup, the shell creates the app data directory if needed and runs the idempotent SQLite schema initialization.

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
- `generate_agent_chat_ai_proposal`
- `persist_agent_chat_proposal`
- `get_agent_monitoring_snapshot`
- `create_agent_queue_item_from_proposal`
- `get_agent_queue_snapshot`
- `create_agent_queue_task`
- `list_agent_queue_tasks`
- `get_agent_queue_task`
- `update_agent_queue_task`
- `get_git_repository_status`

The current Tauri bridge source keeps app state and SQLite initialization in `app_state.rs`, Workspace command handlers in `workspace_commands.rs`, Agent Queue task command handlers in `agent_queue_task_commands.rs`, and command DTO mapping in focused DTO modules.

The React frontend calls the workspace lifecycle, widget mutation/log read, workspace-local notes create/list/read/update API, Agent Queue task create/list/read/update API, Agent Executor history reads, Git status, Terminal one-shot command, Agent Chat backend AI proposal generation, Agent Chat proposal persistence, Agent Monitoring proposal artifact read, Agent Queue proposal-review item paths, and the typed Direct Work API facade through the workspace API facade when running inside Tauri. The browser/Vite path uses the same facade with an in-memory implementation; browser fallback throws a visible unsupported state for real Git status reads, Terminal command execution, workspace-local notes persistence, Agent Queue task persistence, Codex Direct Work execution, Agent Executor persisted history/detail reads, backend AI provider calls, Agent Chat proposal persistence, Agent Monitoring persisted artifact reads, and Agent Queue persistence. The `run_terminal_command` Tauri command is called only from the Terminal widget UI and remains limited to persisted Terminal widget instances. The `run_codex_direct_work` Tauri command is called only from the Direct Work / Codex panel; it validates an explicit Workspace/Workbench/widget owner, currently allows only the `agent-run` widget definition to own Direct Work artifacts, resolves the requested Codex executable, runs the `hobit-tools` Codex runner outside storage transactions, and persists run/log/result artifacts without Git mutation or auto-commit/push. The `start_codex_direct_work_stream` Tauri command creates a Direct Work widget run immediately, returns a started run id, runs the `hobit-tools` streaming runner in a background blocking task, emits `direct-work://event` payloads, appends persisted widget logs during the stream, and stores the final result without schema changes or Git mutation. The read-only `list_agent_executor_runs` and `get_agent_executor_run_detail` commands expose stored Direct Work and Direct Work validation run/result/log summaries for the owning `agent-run` widget only; they do not rerun, delete, mutate Git, compute diffs, or execute Queue items. The Agent Executor frontend consumes those history APIs in a compact read-only history/detail panel, while the Direct Work stream is still not consumed in UI yet. The `generate_agent_chat_ai_proposal` Tauri command is called only from the Agent Chat widget UI, validates the target Agent Chat widget, builds a proposal-only AI request artifact from the operator prompt and approved context snapshot, calls the explicit environment-configured provider only from the backend, normalizes the response, and persists a proposal-only run/log/result artifact. The `persist_agent_chat_proposal` Tauri command remains available for local/mock fallback artifacts. The `get_agent_monitoring_snapshot` Tauri command is read-only, filters to Agent Chat proposal-only results in the current Workspace Workbench, and does not expose Terminal results, Direct Work results, or arbitrary widget results. The `create_agent_queue_item_from_proposal` command creates only a review item from a valid local mock proposal result in the same Workspace Workbench; `get_agent_queue_snapshot` lists those review items. The Agent Queue task commands create, list, read, and update stored Workspace-scoped task records only; they do not dispatch, schedule, start Agent Executor, launch Terminal commands, mutate files, or mutate Git. There is no shell mode, interactive terminal, frontend live log panel, PTY, cancellation, command history, executable chat runtime, Agent Run runtime beyond persisted Direct Work artifacts, Agent Queue execution/runtime, Template Library runtime, Git runtime beyond the narrow read-only status path, workspace restore runtime, log polling, provider settings UI, secrets UI, or HTTPS provider adapter in this milestone.

## Current Workbench State Command Milestone

`hobit-app` can now return a canonical Workspace Workbench state summary for a Workspace. The summary includes the Workspace, current Workbench, persisted widget instance summaries, shared state object summaries, and stored Workbench event summaries.

The Tauri shell exposes this through `get_workspace_workbench_state`, backed by the existing local SQLite store and `WorkspaceService`.

The frontend consumes this command through its workspace API boundary and adapts the response into `WorkbenchViewState` before rendering the Workbench. There is still no event replay, runtime reconstruction, widget execution beyond the bounded Terminal one-shot command path, interactive terminal execution, or agent call behavior.

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

This milestone uses Tauri workspace commands in desktop mode and an in-memory frontend fallback in browser mode. It loads persisted Workbench summary state before entering the Workbench, but it does not implement runtime restoration, widget runtime reconstruction, real capability widget insertion beyond Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes, or persisted browser fallback state.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and new Workspaces currently start with no visible widget instances.

`WidgetHost` remains the mapping layer from persisted widget instances to React components. The current frontend registry contains Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes renderers.

The Widget Catalog has frontend-local template metadata for current surfaces. Ready templates are Agent Executor, Git, Terminal, and Notes. Preview templates are Agent Queue, Interactive Agent, and Runbook. There is no Planned section in the current user-facing catalog, no runtime widget loading, and no real capability widget insertion beyond those available templates/placeholders through the Tauri bridge yet.

The Workbench top bar includes a compact global activity/idle indicator. It is current-session frontend state only: it shows `Idle - No active local runs` by default, switches to a running Terminal status while a Terminal one-shot command started from the current UI session is awaiting its backend response, and can show attention for failed or timed-out Terminal command requests. It does not poll SQLite run state, observe background work, monitor external processes, implement approvals, or imply that Agent Queue or Agent runtime execution exists.

The Notes placeholder persists a minimal draft through widget state using the shape `{ "body": "..." }`. A separate workspace-local notes storage/API foundation exists for create/list/read/update operations, but no product UI consumes it yet. This is not the full Notebook/Notes document model, multi-tab state, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, text formatting tool surface, autosave flow, folder system, or AI-in-Notes implementation.

The Terminal widget accepts one explicit program, one argument per textarea line, an explicit working directory, timeout, and stdout/stderr caps. In the Tauri desktop path it calls `run_terminal_command`, creates widget run/log/result records through the backend, and renders the final stdout/stderr result. Browser/Vite fallback reports that local process execution is unsupported. It does not implement shell mode, interactive stdin, streaming, PTY, cancellation, command history, saved profiles, environment/secrets support, Agent-triggered execution, or Script Runner behavior.

The Agent Executor widget reuses the existing `agent-run` definition id for persistence compatibility. It keeps the Codex CLI Direct Work launch panel and does not include the retired Agent Monitoring proposal viewer. It accepts explicit Workspace, Workbench, owning widget instance, executable, repository root, operator prompt, sandbox, approval policy, timeout, and output caps, and it persists widget run/log/result artifacts without Git mutation, auto-commit, auto-push, or Queue execution.

The Agent Queue widget is a preview manual task queue surface. Existing proposal-review compatibility paths remain available when review records exist, and the frontend product UI consumes the manual Workspace-scoped task API for create, list, select, edit, status, priority, and explicit save. Execution dispatch is not implemented. It does not execute queue items, approve or apply proposals, launch agents, run a background queue, capture responses, parse or validate responses, associate Git review, automatically accept work, mutate Notes/Git/files, or write task edits outside the explicit save action.

Interactive Agent is a local chat MVP for manual long-running agent chat/work. Its contract is defined in `docs/INTERACTIVE_AGENT_WIDGET_CONTRACT.md`. It has no provider connection, no Queue integration, no Agent Executor integration, no Runbook integration, no monitoring integration, no tool execution, no file mutation, no Git mutation, and no Terminal execution. Runbook is a local/manual procedural steps MVP with states such as pending, running, done, failed, skipped, and blocked, plus local notes/evidence. It has no persistence, step execution, edit mode, builder, Queue integration, or agent-assisted steps.

The Git placeholder has a transient explicit repository-root input. In the Tauri desktop path, it manually refreshes a read-only status snapshot through `get_git_repository_status`, backed by `hobit-tools`, and renders branch/clean-dirty/count/ahead-behind/warning/last-commit data plus grouped changed files. The repository root and refreshed status are local React state only. Browser/Vite fallback cannot read Git status. Repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This floating widget mode is not a separate OS window and is not persisted as external window geometry. There is no real Dock parking, Compact view rendering, Dock-to-Canvas movement, persisted presence zone model, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or preset editor.

Widget frames include a widget-local Logs panel. It loads persisted widget-local logs through `list_widget_logs`, and open panels refresh after successful widget state/layout actions and Terminal one-shot command responses. Existing widget add/state/layout mutations emit basic persisted logs: `Widget added`, `Widget state saved`, and `Widget layout updated`. Terminal command runs emit bounded lifecycle logs. The Direct Work streaming Tauri bridge can append persisted widget logs while a Codex stream is running, but no frontend live log panel consumes the Tauri stream yet. There is no polling, interactive terminal log stream, or full agent run Raw Log/Overview Log/Result Report model yet.

The Workbench canvas includes a compact Recent activity surface backed by workspace-scoped events from `get_workspace_workbench_state`. This is not a runtime log console.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are pure domain contracts only. Persistence, frontend integration, and Tauri integration live outside `hobit-core`.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is wired through `hobit-app` and the Tauri workspace bridge for Workspace lifecycle, Workbench state loading, current widget insertion, Notes placeholder state, workspace-local notes create/list/read/update operations, manual Agent Queue task create/list/read/update operations, persisted widget layout fields, workspace activity events, widget-local logs, Terminal one-shot run/result persistence, Codex Direct Work run/result persistence for the `agent-run` owner, retained proposal/review artifact paths, and Git placeholder reads. Git status refresh is read-only and does not write repository root/status into storage. The storage layer is not wired to interactive terminal sessions, executable chat runtime, Agent Queue execution/runtime, Template Library runtime, Git runtime beyond the narrow status read path, runtime streaming UI, Terminal result monitoring, or arbitrary widget result monitoring.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, returns simple Workspace and WorkspaceSession summaries, and supports the current widget foundation mutations for adding a WidgetInstance, updating widget state, updating widget layout, and listing widget-local logs.

This application layer is wired to the Tauri workspace bridge. It includes a bounded one-shot Terminal command orchestration path for persisted Terminal widget instances only, creating widget run/log/result records around the shared process adapter. It also includes one-shot and streaming Codex Direct Work orchestration paths for an allowed `agent-run` widget owner, creating widget run/log/result records around the `hobit-tools` Codex runners outside storage transactions and emitting Tauri stream events for the streaming path. It also includes a proposal-only Agent Chat AI request artifact builder, mockable provider boundary, provider response normalizer, AI proposal artifact persistence path, local/mock proposal persistence path, a proposal-review Agent Queue path that validates a stored local mock proposal result before creating a read-only queue item, and manual Agent Queue task create/list/read/update service methods. It does not restore runtime state, provide Agent Monitoring persisted Direct Work reads, provide shell mode, provide a frontend live log panel, execute queue items, dispatch tasks, approve/apply proposals, or add automatic agent behavior.

## Workspace Model Boundary

The current Workspace model foundation supports persisted Workspace records, WorkspaceSession records, Workbench records, widget instance summaries, widget state/layout fields, shared state summaries, widget-local logs, and Workbench event summaries.

The Workspace is the context-isolation boundary. Unrelated work such as Hobit development, a Vertica incident, VICO review, and personal planning should be separate Workspaces. Multiple Workbenches inside one Workspace are future surfaces for the same problem, not a way to mix unrelated contexts.

Full runtime restore is not implemented yet. There is no event replay, widget runtime reconstruction, preset editor, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zone model, full drag/drop layout editor, real capability widget insertion beyond Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes, shell or interactive terminal execution, executable chat runtime, Agent Queue execution/real command queue/history beyond review/history records, Template Library execution, Git behavior beyond manual read-only status refresh, or automatic agent runtime behavior.

## Planned Notes Model

Future notes work will support a workspace-local multi-note Notes product slice
before visual overclaims: storage/API foundation first, then note list, selected
note editor, search, pinning, and save/autosave state. Future Notebook may also
support Markdown documents organized in folders with global and workspace-local
scopes and render Markdown-adjacent fenced blocks such as Mermaid diagrams, but
source text remains the source of truth and rendering must not execute commands,
load remote assets by default, or mutate note content.

The current app has a Notes placeholder widget that saves and restores one widget-state draft shaped as `{ "body": "..." }`, plus Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, and Terminal widgets. Agent Executor keeps backend/Tauri Codex Direct Work run/result persistence for the existing `agent-run` owner. Agent Queue has a preview manual task product UI backed by manual task storage/API only. Interactive Agent has local current-session chat state only, and Runbook has local current-session step state plus notes/evidence only. The Git placeholder supports only manual desktop read-only status refresh for a transient explicit repository root. Terminal supports only an explicit desktop one-shot command form, not shell mode or interactive terminal behavior. Workspace-local notes storage/API exists, but there is no Notes product UI, Notebook tab model, text formatting tool surface, folder UI, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, autosave, sync, Knowledge ingestion flow, AI-in-Notes behavior, Agent Queue execution/response capture/validation, Template Library runtime, template storage/editing/request generation/response validation, Git mutations/diff/log/show, or executable agent chat runtime in the current repository.

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

The current repository state is documentation, repository hygiene, a root Rust workspace including the Tauri shell, core Rust domain/storage/application crates, a frontend Workspace Start Screen and Empty Workbench shell, a Widget Catalog with Agent Executor, Agent Queue, Interactive Agent, Runbook, Git, Terminal, and Notes, a minimal Tauri desktop host, SQLite-backed workspace/workbench state, widget state/layout, workspace event, widget-local log foundations in desktop mode, Terminal one-shot run/result persistence, Codex Direct Work run/result persistence for the `agent-run` owner, retained backend proposal/review artifact paths that are not exposed as current catalog surfaces, and a narrow manual desktop-only read-only Git status path for the Git widget. Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/` are ignored.

Future feature implementation must preserve the Workbench-first, widget-first, approval-aware contracts while adding real widgets, runtime behavior, and editing capabilities intentionally.
