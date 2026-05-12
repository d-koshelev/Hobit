# Architecture

This document describes the current repository structure and intended future architecture for Hobit.

The current repository contains a root Rust workspace that includes the core crates and the Tauri desktop shell, a Vite/React frontend, a minimal Tauri workspace bridge, and a SQLite workspace persistence foundation. Persisted Notes, a desktop-only one-shot Terminal command widget, backend/Tauri Codex Direct Work run artifact persistence, Agent Chat proposal-only placeholder with explicit current-session approved context selection, a first backend AI proposal provider boundary, local/mock fallback, and proposal-only run/result persistence, Agent Monitoring read-only proposal artifact viewer with explicit review-item creation for existing local mock artifacts, Agent Queue proposal-review inbox, Git placeholder, and static Template Library placeholder widgets exist as catalog insertion paths. The Git placeholder has a narrow manual desktop-only read-only status refresh path. The Terminal widget has a bounded one-shot command path for persisted Terminal widget instances only. Codex Direct Work has a one-shot Tauri command for explicit Workspace, Workbench, owning Agent Monitoring widget instance, repository root, operator prompt, sandbox, approval policy, timeout, and output caps; no frontend UI calls it yet. Agent Chat can include selected safe current-view metadata only, request a backend AI proposal through the Tauri bridge when an explicit `http://` provider endpoint is configured, or use local/mock fallback. The generated proposal is stored as a structured proposal-only widget run/log/result artifact in desktop mode. Agent Monitoring can read only those stored proposal artifacts for the current Workspace Workbench, and Agent Queue can store/read review-only items created from valid local mock proposal artifacts. There is no Direct Work UI, Agent Monitoring Direct Work display, shell mode, interactive terminal, streaming, PTY, cancellation, command history, Agent CLI runtime, executable chat runtime, Agent Run runtime beyond persisted Direct Work artifacts, Terminal result monitoring, arbitrary widget result monitoring, Agent Queue execution/runtime, Template Library runtime, Git mutations/diff/log/show, hidden context access, persisted context models outside the proposal result snapshot, provider settings UI, secrets UI, HTTPS provider adapter, or broad tool execution yet.

## Documentation Contracts

`PRODUCT_POSITIONING.md` defines Hobit's core positioning as an operator-controlled AI Workbench for precise, fast, and efficient work with AI agents. Future architecture must not drift toward a generic hidden automation or agent-runner system.

`DESIGN_SYSTEM_CONTRACT.md` defines the base visual language for future frontend and widget work.

`WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` defines Minimal, Operational, and Full / Expert widget display levels. Future widget architecture and UI blocks should start from the smallest useful surface, avoid raw/debug defaults, and add deeper complexity only through explicit later slices.

`AGENT_OPERATING_MODEL.md` defines the future coordinator/executor operating model for agent-assisted block work. It is a contract only; no frontend Direct Work UI, automatic execution, or response validation engine is implemented yet.

`AGENT_WORK_EFFICIENCY_CONTRACT.md` defines small focused blocks, execution budgets, validation profile plans, and stop/split rules for efficient agent work. It is docs-only and does not implement runtime behavior, UI, storage, Tauri commands, queue execution, or validation script behavior.

`AI_INTEGRATION_READINESS_CONTRACT.md` defines the final pre-AI readiness gate and first real AI slice boundary: proposal-only Agent Chat, explicitly approved context, backend/provider boundary, persisted observable artifacts, and `allowed_tools: []`.

`DIRECT_MODE_AGENT_CONTRACT.md` defines the future Direct Mode executor path for small approved work. It keeps the model agent-agnostic, names Codex CLI as the first planned executor kind, and requires explicit repository root, prompt, sandbox/mode, visible run status, raw log/final response capture, changed-file review, no hidden background execution, no queue execution in the MVP, and no auto-commit or auto-push. Backend/tooling Codex CLI foundations now exist in `hobit-tools`: an availability/version probe for `codex --version` or `<explicit-program> --version`, plus a one-shot Direct Work runner that builds `codex exec` with fixed argv for an explicit repo root and operator prompt, captures stdout/stderr/final message, applies caps and timeout, and returns a structured result. The app/Tauri boundary now exposes `run_codex_direct_work` for explicit Workspace, Workbench, owning widget instance, repository root, operator prompt, sandbox, approval policy, timeout, and output caps; it persists widget run/log/result artifacts for an allowed Agent Monitoring (`agent-run`) widget instance and stores no-auto-commit/no-auto-push safety flags. No Direct Work frontend UI, Agent Monitoring Direct Work display, Agent Queue execution, Git Widget integration, changed-file capture, validation capture, Git mutation, auto-commit, auto-push, embedded PTY, or interactive Codex session is implemented yet.

`DEMO_FLOW_CHECKLIST.md` defines the manual pre-AI demo verification scope for the Terminal one-shot path, Agent Chat proposal artifacts, Agent Monitoring details, and the optional Agent Queue review inbox.

`WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` defines the future Workspace-aware Coordinator Agent model for explicitly approved context reading and previewed cross-widget action proposals. It is contract-first; Agent Chat currently supports only selected current-view metadata snapshots plus proposal-only result persistence and does not read hidden Workspace context, propose executable actions, mutate widgets, edit Notebook content, or execute actions. The only current queue write path is Agent Monitoring's explicit review-item creation from a valid stored local mock proposal result.

`WORKSPACE_CONTRACT.md` defines Workspace as the durable isolation boundary for distinct problems and Workbench as a surface inside a Workspace. Future multi-open Workspace UI, Workspace tabs/sidebar/windows, and multiple Workbenches per Workspace must follow the rule: different problem = different Workspace; different surface for the same problem = additional Workbench.

`AGENT_QUEUE_CONTRACT.md` defines Agent Queue as an operator-controlled agent command queue, command history, and review inbox. The frontend has a narrow persisted Agent Queue review inbox for proposal-only Agent Chat local mock proposal results, with static preview content only as empty/demo copy; no queue execution, approval/apply behavior, background execution, response capture/parser/validator, executor integration, or automatic acceptance is implemented yet.

`AGENT_RUN_OBSERVABILITY_CONTRACT.md` defines future Raw Log, Overview Log, and Result Report views for agent/task execution. The frontend has an insertable Agent Monitoring widget that displays read-only Overview, Result, and Raw sections for stored Agent Chat proposal-only artifacts, and Agent Chat can persist those proposal-only run/result artifacts. Direct Work artifacts can be persisted at the backend/Tauri boundary, but Agent Monitoring does not display them yet. Agent Monitoring is not a full Agent Run runtime; runtime log streaming, Terminal result monitoring, arbitrary widget result monitoring, overview summarizers, response validation, broader executor integration, and real agent runtime UI are not implemented yet.

`SCRIPT_RUNNER_WIDGET_CONTRACT.md` defines the future Script Runner Widget as an explicit operator-controlled configured local script action with visible script path, argv arguments, working directory, timeout, output caps, logs, results, and safety boundaries. Script Runner may appear as planned/display-only Widget Catalog metadata, but no Script Runner UI, widget insertion, backend execution, Tauri command, storage, or runtime behavior is implemented.

`GIT_WIDGET_CONTRACT.md` defines the future Git Widget / Git Plugin as a visual, approval-aware review/control surface for repository state after agent-assisted code work. An insertable frontend placeholder exists with a transient explicit repository-root input, manual desktop-only read-only status refresh, a visual status card, and grouped changed-files summary. Repository root/status persistence, polling, watching, diff/log/show, validation association, Git-response association, and mutating Git behavior are not implemented. Future Git reads must use an explicit operator-approved repository root; hidden parent traversal, Workspace-wide repository scanning, and network fetch during read-only status collection are forbidden by that contract.

`TEMPLATE_CONTRACT.md` defines the future product/domain contract for reusable Request Templates and Response Templates. Templates are not implemented yet; they are future Workspace/Project assets for creating concrete request snapshots and validating response shape. The frontend has a static insertable Template Library placeholder with Request Template, Response Template, and Coordinator Workflow previews, but no template storage, editing, request generation, response capture, response parsing, response validation, executor integration, Git-response association, or agent execution behavior is implemented.

`NOTES_WIDGET_CONTRACT.md` defines the future Notebook/Notes widget direction: legacy single-body Notes compatibility, multiple text tabs/documents inside one widget, Markdown source text, rendered Markdown and Mermaid fenced-block preview direction, explicit user-triggered text formatting actions, and operator-approved AI-assisted editing. The current frontend still only persists the minimal `{ "body": "..." }` Notes draft state.

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

The frontend includes a Widget Catalog drawer opened from Add Widget controls. The Notes, Terminal, Agent Chat placeholder, Agent Monitoring proposal viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates can be inserted through the workspace API as persisted WidgetInstances and rendered through `WidgetHost`. Script Runner and other future catalog templates remain planned/display-only metadata and are not registered widget definitions.

There is no shell execution, script execution, Script Runner widget beyond planned/display-only catalog metadata, Direct Work UI, Agent Monitoring Direct Work display, executable chat runtime, Workspace-aware Coordinator approved context access beyond selected current-view metadata, persisted context models outside Agent Chat proposal result snapshots, executable proposal behavior, Agent Queue behavior beyond explicit review-only items created from persisted local mock proposal results, Agent Queue runner/real command queue/execution history, real agent run Raw Log/Overview Log/Result Report behavior beyond Agent Monitoring's read-only stored Agent Chat proposal artifact viewer, Terminal result monitoring, arbitrary widget result monitoring, Template Library runtime, template storage/editing/request generation/response validation, Git behavior beyond manual desktop-only read-only status refresh for an explicit transient repository root, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat proposal-only placeholder, Agent Monitoring proposal artifact viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zones beyond current canvas/floating presentation, preset editor, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or full Notebook/Notes document model yet.

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
- `run_terminal_command`
- `generate_agent_chat_ai_proposal`
- `persist_agent_chat_proposal`
- `get_agent_monitoring_snapshot`
- `create_agent_queue_item_from_proposal`
- `get_agent_queue_snapshot`
- `get_git_repository_status`

The current Tauri bridge source keeps app state and SQLite initialization in `app_state.rs`, Workspace command handlers in `workspace_commands.rs`, and command DTO mapping in `workspace_dto.rs`.

The React frontend calls the workspace lifecycle, widget mutation/log read, Git status, Terminal one-shot command, Agent Chat backend AI proposal generation, Agent Chat proposal persistence, Agent Monitoring proposal artifact read, Agent Queue proposal-review item paths, and the typed Direct Work API facade through the workspace API facade when running inside Tauri. The browser/Vite path uses the same facade with an in-memory implementation; browser fallback throws a visible unsupported state for real Git status reads, Terminal command execution, Codex Direct Work execution, backend AI provider calls, Agent Chat proposal persistence, Agent Monitoring persisted artifact reads, and Agent Queue persistence. The `run_terminal_command` Tauri command is called only from the Terminal widget UI and remains limited to persisted Terminal widget instances. The `run_codex_direct_work` Tauri command is not called from UI yet; it validates an explicit Workspace/Workbench/widget owner, currently allows only the Agent Monitoring (`agent-run`) widget definition to own Direct Work artifacts, runs the `hobit-tools` Codex runner outside storage transactions, and persists run/log/result artifacts without Git mutation or auto-commit/push. The `generate_agent_chat_ai_proposal` Tauri command is called only from the Agent Chat widget UI, validates the target Agent Chat widget, builds a proposal-only AI request artifact from the operator prompt and approved context snapshot, calls the explicit environment-configured provider only from the backend, normalizes the response, and persists a proposal-only run/log/result artifact. The `persist_agent_chat_proposal` Tauri command remains available for local/mock fallback artifacts. The `get_agent_monitoring_snapshot` Tauri command is read-only, filters to Agent Chat proposal-only results in the current Workspace Workbench, and does not expose Terminal results, Direct Work results, or arbitrary widget results. The `create_agent_queue_item_from_proposal` command creates only a review item from a valid local mock proposal result in the same Workspace Workbench; `get_agent_queue_snapshot` lists those review items. There is no shell mode, interactive terminal, streaming, PTY, cancellation, command history, executable chat runtime, Agent Run runtime beyond persisted Direct Work artifacts, Agent Queue execution/runtime, Template Library runtime, Git runtime beyond the narrow read-only status path, workspace restore runtime, log streaming/polling, provider settings UI, secrets UI, or HTTPS provider adapter in this milestone.

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

This milestone uses Tauri workspace commands in desktop mode and an in-memory frontend fallback in browser mode. It loads persisted Workbench summary state before entering the Workbench, but it does not implement runtime restoration, widget runtime reconstruction, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat proposal-only placeholder, Agent Monitoring proposal artifact viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder, or persisted browser fallback state.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and new Workspaces currently start with no visible widget instances.

`WidgetHost` remains the mapping layer from persisted widget instances to React components. The current frontend registry contains the Notes, Terminal, Agent Chat placeholder, Agent Monitoring proposal artifact viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder renderers.

The Widget Catalog has frontend-local template metadata for future capabilities. Only the Notes, Terminal, Agent Chat placeholder, Agent Monitoring proposal artifact viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates are currently available for insertion. Script Runner and all other future catalog templates remain planned/display-only. There is no runtime widget loading or real capability widget insertion beyond those available templates/placeholders through the Tauri bridge yet.

The Workbench top bar includes a compact global activity/idle indicator. It is current-session frontend state only: it shows `Idle - No active local runs` by default, switches to a running Terminal status while a Terminal one-shot command started from the current UI session is awaiting its backend response, and can show attention for failed or timed-out Terminal command requests. It does not poll SQLite run state, observe background work, monitor external processes, implement approvals, or imply that Agent Queue or Agent runtime execution exists.

The Notes placeholder persists a minimal draft through widget state using the shape `{ "body": "..." }`. This is not the full Notebook/Notes document model, multi-tab state, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, text formatting tool surface, autosave flow, folder system, or AI-in-Notes implementation.

The Terminal widget accepts one explicit program, one argument per textarea line, an explicit working directory, timeout, and stdout/stderr caps. In the Tauri desktop path it calls `run_terminal_command`, creates widget run/log/result records through the backend, and renders the final stdout/stderr result. Browser/Vite fallback reports that local process execution is unsupported. It does not implement shell mode, interactive stdin, streaming, PTY, cancellation, command history, saved profiles, environment/secrets support, Agent-triggered execution, or Script Runner behavior.

The Agent Chat placeholder accepts an operator prompt, lets the operator explicitly select safe current-session context metadata, and generates a structured proposal preview. In the Tauri desktop path, generating a proposal first attempts the backend AI proposal boundary. When `HOBIT_AI_PROVIDER_ENDPOINT` and `HOBIT_AI_PROVIDER_MODEL` configure an explicit `http://` JSON chat-compatible provider endpoint, the backend sends only the operator prompt, approved context snapshot, concise contract pack summary, `allowed_tools: []`, safety constraints, expected response format, and validation plan. If the provider is not configured, unavailable, or the browser/Vite fallback is used, local/mock fallback remains available. Persisted proposal artifacts contain the operator prompt, approved context snapshot used, proposal sections, proposed tool/action items marked not executed, safety notes, provider status where applicable, and proposal-only safety flags. Selectable context is limited to Workspace/workbench identity, widget inventory metadata, and current global activity status. Browser/Vite fallback reports provider calls and proposal persistence as unsupported while keeping the local preview visible. Agent Chat does not execute agents, read hidden Workspace context, read Notes body, read Git status, read Terminal output, read widget logs, read files, execute tools, run Terminal commands, create Queue items by itself, stream responses, persist chat messages, persist reusable context snapshots, or write widget state or Workspace content.

The Agent Monitoring widget reads persisted Agent Chat proposal-only results for the current Workspace Workbench, renders recent proposal runs plus read-only Overview, Result, and Raw sections for the selected artifact, and can explicitly create a review-only Agent Queue item from a selected valid local mock proposal result. It keeps the existing `agent-run` definition id for persistence compatibility and does not start runs, stream logs, monitor Terminal results, read arbitrary widget results, parse responses, validate results, summarize runtime events, integrate executor tasks, call agents, execute terminal commands, execute Queue items, apply proposals, or write widget state.

The Agent Queue placeholder now has a narrow persisted review inbox for proposal-only Agent Chat local mock proposal results. It lists `needs_review` / `pending_review` review items scoped to the current Workspace Workbench, shows read-only details with source proposal, plan, proposed actions marked not executed, and safety flags, and keeps static preview content only as empty/demo copy when no persisted items exist. It does not execute queue items, approve or apply proposals, launch agents, run a background queue, capture responses, parse or validate responses, associate Git review, automatically accept work, mutate Notes/Git/files, or write widget state.

The Git placeholder has a transient explicit repository-root input. In the Tauri desktop path, it manually refreshes a read-only status snapshot through `get_git_repository_status`, backed by `hobit-tools`, and renders branch/clean-dirty/count/ahead-behind/warning/last-commit data plus grouped changed files. The repository root and refreshed status are local React state only. Browser/Vite fallback cannot read Git status. Repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented.

The Template Library placeholder is static and shows Request Template, Response Template, and Coordinator Workflow previews. It does not persist template data, edit templates, generate requests, capture responses, parse or validate responses, launch or integrate executor tasks, associate Git review with responses, call agents, or write widget state.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This floating widget mode is not a separate OS window and is not persisted as external window geometry. The Workbench also includes a static frontend-only Dock placeholder preview with local rail toggles. There is no real Dock parking, Compact view rendering, Dock-to-Canvas movement, persisted presence zone model, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or preset editor.

Widget frames include a widget-local Logs panel. It loads persisted widget-local logs through `list_widget_logs`, and open panels refresh after successful widget state/layout actions, Terminal one-shot command responses, and Agent Chat proposal persistence. Existing widget add/state/layout mutations emit basic persisted logs: `Widget added`, `Widget state saved`, and `Widget layout updated`. Terminal command runs and Agent Chat proposal persistence emit bounded lifecycle logs. There is no runtime log streaming, polling, interactive terminal log stream, or real agent run Raw Log/Overview Log/Result Report model beyond the Agent Monitoring read-only proposal artifact viewer.

The Workbench canvas includes a compact Recent activity surface backed by workspace-scoped events from `get_workspace_workbench_state`. This is not a runtime log console.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are pure domain contracts only. Persistence, frontend integration, and Tauri integration live outside `hobit-core`.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is wired through `hobit-app` and the Tauri workspace bridge for Workspace lifecycle, Workbench state loading, Notes, Terminal placeholder, Agent Chat placeholder insertion and proposal-only run/result persistence, Agent Monitoring read-only proposal artifact viewing and explicit review-item creation, Agent Queue proposal-review item persistence, Git placeholder, and Template Library placeholder insertion, Notes placeholder state, persisted widget layout fields, workspace activity events, widget-local logs, Terminal one-shot run/result persistence, Codex Direct Work run/result persistence, and Agent Chat proposal-only run/result persistence. Git status refresh is read-only and does not write repository root/status into storage. The Agent Chat approved context selector remains frontend-local; the generated proposal result snapshot is stored when the operator generates a proposal in desktop mode. The storage layer is not wired to interactive terminal sessions, executable chat runtime, persisted context models outside Agent Chat proposal result snapshots, Agent Monitoring Direct Work display, Agent Queue execution/runtime, Template Library runtime, Git runtime beyond the narrow status read path, real capability widgets beyond placeholders, runtime streaming, Terminal result monitoring, or arbitrary widget result monitoring.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, returns simple Workspace and WorkspaceSession summaries, and supports the current widget foundation mutations for adding a WidgetInstance, updating widget state, updating widget layout, and listing widget-local logs.

This application layer is wired to the Tauri workspace bridge. It includes a bounded one-shot Terminal command orchestration path for persisted Terminal widget instances only, creating widget run/log/result records around the shared process adapter. It also includes a one-shot Codex Direct Work orchestration path for an allowed Agent Monitoring widget owner, creating widget run/log/result records around the `hobit-tools` Codex runner outside storage transactions. It also includes a proposal-only Agent Chat AI request artifact builder, mockable provider boundary, provider response normalizer, AI proposal artifact persistence path, local/mock proposal persistence path, and a proposal-review Agent Queue path that validates a stored local mock proposal result before creating a read-only queue item. It does not restore runtime state, provide Direct Work UI, provide shell mode, stream logs, execute queue items, approve/apply proposals, or add automatic agent behavior.

## Workspace Model Boundary

The current Workspace model foundation supports persisted Workspace records, WorkspaceSession records, Workbench records, widget instance summaries, widget state/layout fields, shared state summaries, widget-local logs, and Workbench event summaries.

The Workspace is the context-isolation boundary. Unrelated work such as Hobit development, a Vertica incident, VICO review, and personal planning should be separate Workspaces. Multiple Workbenches inside one Workspace are future surfaces for the same problem, not a way to mix unrelated contexts.

Full runtime restore is not implemented yet. There is no event replay, widget runtime reconstruction, preset editor, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zone model, full drag/drop layout editor, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat proposal-only placeholder, Agent Monitoring proposal artifact viewer, Agent Queue placeholder, Git placeholder, and Template Library placeholder, shell or interactive terminal execution, Direct Work UI, executable chat runtime, persisted approved context models outside Agent Chat proposal result snapshots, Agent Queue execution/real command queue/history beyond proposal-review items, Agent Monitoring Direct Work display, Template Library execution, Git behavior beyond manual read-only status refresh, or automatic agent runtime behavior.

## Planned Notes Model

Future notes work will support Markdown documents organized in folders with global and workspace-local scopes. Future Notebook may also render Markdown-adjacent fenced blocks such as Mermaid diagrams, but source text remains the source of truth and rendering must not execute commands, load remote assets by default, or mutate note content.

The current app has a Notes placeholder widget that saves and restores one widget-state draft shaped as `{ "body": "..." }`, plus a Terminal one-shot command widget, backend/Tauri Codex Direct Work run/result persistence, Agent Chat proposal-only placeholder with backend AI provider boundary, local/mock fallback, and proposal-only run/result persistence, Agent Monitoring read-only proposal artifact viewer with explicit review-item creation for local mock proposal artifacts, Agent Queue proposal-review inbox, Git placeholder, and Template Library placeholder widgets. Agent Chat can generate a structured proposal preview from the prompt and selected safe current-view metadata and can store that generated proposal as a proposal-only widget run/log/result artifact in desktop mode without hidden context reads, Notes body reads, Git status reads, Terminal output reads, log reads, file reads, tool execution, Queue creation by Agent Chat, reusable context snapshot persistence, or Workspace content mutation. Agent Monitoring can read only those persisted proposal-only Agent Chat artifacts for the current Workspace Workbench and can explicitly create a review-only Agent Queue item from a valid selected local mock proposal result; it does not display Direct Work artifacts, monitor Terminal results, read arbitrary widget results, execute tools, execute queue items, or apply proposals. Agent Queue shows only review-only persisted proposal items plus static empty/demo preview content, and the Template Library placeholder only shows static previews. The Git placeholder supports only manual desktop read-only status refresh for a transient explicit repository root. Terminal supports only an explicit desktop one-shot command form, not shell mode or interactive terminal behavior. There is no notes document storage, Notebook tab model, text formatting tool surface, folder UI, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, autosave, sync, Knowledge ingestion flow, AI-in-Notes behavior, Direct Work UI, Agent Monitoring Direct Work display, Agent Queue execution/response capture/validation, Template Library runtime, template storage/editing/request generation/response validation, Git mutations/diff/log/show, or executable agent chat runtime in the current repository.

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

The current repository state is documentation, repository hygiene, a root Rust workspace including the Tauri shell, core Rust domain/storage/application crates, a frontend Workspace Start Screen and Empty Workbench shell, a Widget Catalog with persisted Notes, Terminal one-shot command widget, Agent Chat proposal-only mock placeholder, Agent Monitoring read-only proposal artifact viewer, Agent Queue proposal-review inbox, Git placeholder, and Template Library placeholder insertion paths, a minimal Tauri desktop host, SQLite-backed workspace/workbench state, widget state/layout, workspace event, widget-local log foundations in desktop mode, Terminal one-shot run/result persistence, Agent Chat proposal-only run/result persistence, Agent Monitoring read-only proposal artifact reads, explicit Agent Queue review-item creation from valid proposal results, and a narrow manual desktop-only read-only Git status path for the Git placeholder. Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/` are ignored.

Future feature implementation must preserve the Workbench-first, widget-first, approval-aware contracts while adding real widgets, runtime behavior, and editing capabilities intentionally.
