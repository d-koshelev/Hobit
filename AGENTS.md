# AGENTS.md

## Purpose

This file gives Codex mandatory project instructions for working on Hobit.

Hobit is a modular AI Workbench. The Workbench is the product surface. Widgets, presets, tools, knowledge, stages, runbooks, terminal, database, image editing, and agent interaction are capabilities inside the Workbench.

Codex must not treat Hobit as a script executor, terminal wrapper, IDE clone, runbook runner, knowledge manager, or chat app.

Future agent work must preserve `docs/PRODUCT_POSITIONING.md` and avoid implementing Hobit as a generic hidden automation or agent-runner system.

## Mandatory contract reading

Before making changes, Codex must read the relevant project contracts.

Always read:
- README.md
- docs/PRODUCT_POSITIONING.md
- ROADMAP.md
- docs/PRODUCT_CONTRACT.md
- docs/AI_WORKBENCH_CONTRACT.md
- docs/UI_CONTRACT.md
- docs/WIDGET_CONTRACT.md
- docs/PRESET_CONTRACT.md
- docs/DESIGN_SYSTEM_CONTRACT.md
- docs/ARCHITECTURE.md
- docs/GLOSSARY.md

For agent/runtime work, also read:
- docs/AGENT_OPERATING_MODEL.md
- docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md
- docs/AGENT_RUNTIME_CONTRACT.md
- docs/STATE_AND_EVENTS_CONTRACT.md
- docs/TOOL_ACTION_CONTRACT.md

For design/frontend/widget work, always read:
- docs/DESIGN_SYSTEM_CONTRACT.md
- docs/UI_CONTRACT.md
- docs/WIDGET_CONTRACT.md
- docs/PRESET_CONTRACT.md

For architectural decisions, inspect:
- decisions/

For request/response template work, also read:
- docs/AGENT_OPERATING_MODEL.md
- docs/TEMPLATE_CONTRACT.md
- docs/AGENT_RESPONSE_CONTRACT.md

Request Templates and Response Templates are future product assets, not only conversation prompt conventions.

Agent/executor work should follow `docs/AGENT_OPERATING_MODEL.md`; each new executor block should start from a fresh thread/task. Future agent/task execution observability should follow `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`. Final responses should follow `docs/AGENT_RESPONSE_CONTRACT.md`.

For Git widget/plugin work, also read `docs/GIT_WIDGET_CONTRACT.md`. Git must be a visual, approval-aware review/control surface, not only raw command output. Future Git reads must use an explicit operator-approved repository root; do not add hidden parent traversal, Workspace-wide repository scanning, network fetch during read-only status collection, or mutating Git behavior.

## Current product direction

Current foundation target:
- Empty AI Workbench shell first.
- The default Workbench is the Empty Workbench with zero real widget instances.
- Workspace Start Screen exists and can create or open a Workspace.
- In the Tauri desktop shell, workspace lifecycle/state loading, widget mutations/log reads, and explicit Git status reads use the Tauri workspace API bridge and local SQLite storage where applicable.
- In browser/Vite development, workspace lifecycle/state loading uses an in-memory workspace API fallback.
- Add Widget opens the Widget Catalog drawer. The Notes, Terminal placeholder, Agent Chat placeholder, Git placeholder, and Template Library placeholder templates can be inserted as persisted WidgetInstances; other catalog items remain planned/display-only.
- The Notes placeholder persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notebook/Notes document model, multi-tab state, formatting tools, and AI-in-Notes behavior are not implemented yet. Future Notes/Notebook work must preserve `docs/NOTES_WIDGET_CONTRACT.md`.
- The Terminal placeholder is static and does not implement command execution, command input, process lifecycle, stdout/stderr streaming, or terminal runtime behavior.
- The Agent Chat placeholder is static and does not implement chat input, agent execution, LLM calls, workspace-context access, action proposals, streaming, or chat message persistence.
- Agent run observability views are not implemented; future agent/task execution must expose Raw Log, Overview Log, and Result Report views according to `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.
- The Git widget placeholder has a transient explicit repository-root input and a manual desktop-only read-only status refresh backed by `get_git_repository_status`; it shows a visual status card and grouped changed files. Repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented.
- The Template Library placeholder is static and shows Request Template, Response Template, and Coordinator Workflow previews. It does not implement template storage, template editing, request generation, response capture, response validation, response parsing, executor launch/integration, Git-response association, or agent execution.
- The Workbench has a frontend-only layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles, with final docked position and size persisted through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top, and preset editing are not implemented yet. Widgets also have frontend-only floating widget mode with an in-app overlay, a ghost placeholder, and Dock back behavior.
- Widget frames include a widget-local Logs panel backed by persisted widget logs. Existing widget add/state/layout mutations emit basic logs; runtime logging, streaming, and polling are not implemented.
- Widgets are first-class entities, not just React components.
- Existing Widget Registry, Preset model, and WidgetHost architecture must be preserved.

Terminal runtime, real Agent Chat runtime, and Agent CLI widgets may exist later, but they must not be shown by default or implemented unless explicitly requested.

## Hard product rules

- Workbench is the product center.
- Every visible UI block is a widget.
- Widgets are optional capabilities.
- Presets compose widget instances and layouts.
- Knowledge is a widget/capability, not the product center.
- Stages are a widget/capability, not the product center.
- Runbooks are a widget/capability, not the product center.
- Tools/actions must be explicit, visible, and approval-aware.
- Agent proposes; operator controls.

## Widget contract summary

A widget is a first-class Workbench entity.

A widget has:
- definition/template
- instance/config
- input data
- input command/action
- run/loading state
- widget-local logs/console
- structured result output
- layout state
- docked/floating presentation state

Every widget must support:
- widget-local console/logs
- resize/reposition inside Workbench
- float in workspace / detach
- ghost placeholder when detached
- return/dock behavior
- optional always-on-top in future true external popout mode

Detaching a widget must not create a new widget instance. It is only a presentation/layout state change.

Widgets must communicate through Workbench state/events, not by directly coupling to each other.

## UI/design rules

- UI must be simple.
- No clutter.
- No duplicated information.
- Only show what is needed right now.
- Every UI block has one responsibility.
- The operator must always understand where they are, what they are working on, what the agent is doing, and what needs approval.
- Widget header is not a detached block. It is the top meta zone of one continuous widget surface.
- Avoid box-inside-box composition.
- Avoid unnecessary internal subdivision.
- Use the locked theme palette.
- No gradients.
- No raw colors outside the dedicated theme file.
- Do not create one-off visual language per widget.

## Frontend rules

- Preserve preset-driven rendering.
- Preserve widgetRegistry.
- Preserve WidgetHost as the mapping layer from widget instance to React component.
- Do not hardcode widget components directly into WorkbenchCanvas.
- Do not add new real widgets unless explicitly requested.
- Do not add widget insertion behavior beyond the existing Notes, Terminal placeholder, Agent Chat placeholder, Git placeholder, and Template Library placeholder catalog paths unless explicitly requested.
- Do not add UI frameworks or icon libraries unless explicitly requested.
- Do not add drag-and-drop until explicitly requested.
- Do not add snapping, collision detection, auto-reflow, floating overlay resize, true external popout behavior, preset editing, or new persistence flows unless explicitly requested.

## Rust/core rules

- hobit-core owns pure domain contracts and types.
- hobit-core must not depend on Tauri, React, SQLite, or frontend code.
- storage, agent, tools, and app orchestration must remain separate crates.
- The root Rust workspace includes `apps/desktop/src-tauri`; `cargo check --workspace` validates the Tauri desktop crate as well as the core crates.
- Do not over-model prematurely.
- Prefer small explicit types and clear contracts.

## Forbidden unless explicitly requested

Do not add:
- real terminal execution
- real agent calls
- new Tauri bridge capabilities beyond existing workspace lifecycle/state loading, widget mutation/log reads, and explicit read-only Git status reads
- database/JDBC implementation
- real Git integration
- Knowledge Catalog implementation
- Stages implementation
- Runbook engine
- Image Edit implementation
- real widget implementation
- additional widget insertion behavior beyond the existing Notes, Terminal placeholder, Agent Chat placeholder, Git placeholder, and Template Library placeholder paths
- full drag-and-drop layout editor
- snapping, collision detection, auto-reflow, floating overlay resize, true external popout behavior, or preset editor behavior
- unplanned SQLite schema changes
- new runtime execution behavior
- new dependencies

## Validation

For most changes, run:

- cargo fmt --all
- cargo check --workspace
- cargo test --workspace
- npm.cmd run typecheck --prefix apps/desktop/frontend

For frontend changes, also try:

- npm.cmd run build --prefix apps/desktop/frontend

If build fails due to environment-specific Vite/Rolldown spawn limitations, report it clearly.

Always run:

- git status --short --branch

## Commit discipline

Each task should create one focused commit.

Good commit examples:
- docs: add Codex project instructions
- frontend: show empty workbench surface
- frontend: fix responsive workbench topbar layout
- core: define widget runtime contract types

Bad commit examples:
- update UI
- add widgets and backend
- fix everything

## Final report format

Final responses must follow `docs/AGENT_RESPONSE_CONTRACT.md`.

At the end of every task, report:
- files changed
- what changed
- validation commands and results
- commit hash
- what was intentionally not implemented
