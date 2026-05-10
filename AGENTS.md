# AGENTS.md

## Purpose

This file gives Codex mandatory project instructions for working on Hobit.

Hobit is a modular AI Workbench. The Workbench is the product surface. Widgets, presets, tools, knowledge, stages, runbooks, terminal, database, image editing, and agent interaction are capabilities inside the Workbench.

Codex must not treat Hobit as a script executor, terminal wrapper, IDE clone, runbook runner, knowledge manager, or chat app.

## Mandatory contract reading

Before making changes, Codex must read the relevant project contracts.

Always read:
- README.md
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

## Current product direction

Current foundation target:
- Empty AI Workbench shell first.
- The default Workbench is the Empty Workbench with zero real widget instances.
- Workspace Start Screen exists and can create or open a Workspace.
- In the Tauri desktop shell, workspace lifecycle/state loading uses the Tauri workspace API bridge and local SQLite storage.
- In browser/Vite development, workspace lifecycle/state loading uses an in-memory workspace API fallback.
- Add Widget opens the Widget Catalog drawer. The Notes placeholder template can be inserted as a persisted WidgetInstance; other catalog items remain planned/display-only.
- The Notes placeholder persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notes document model is not implemented yet.
- Docked widget size presets update persisted layout. Drag/drop, resize handles, popout UI, and preset editing are not implemented yet.
- Widget frames include a widget-local Logs panel backed by persisted widget logs. Existing widget add/state/layout mutations emit basic logs; runtime logging, streaming, and polling are not implemented.
- Widgets are first-class entities, not just React components.
- Existing Widget Registry, Preset model, and WidgetHost architecture must be preserved.

Terminal and Agent CLI widgets may exist later, but they must not be shown by default or implemented unless explicitly requested.

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
- docked/popped-out presentation state

Every widget must support:
- widget-local console/logs
- resize/reposition inside Workbench
- pop-out/detach
- ghost placeholder when detached
- return/dock behavior
- optional always-on-top in pop-out mode

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
- Do not add widget insertion behavior beyond the existing Notes placeholder catalog path unless explicitly requested.
- Do not add UI frameworks or icon libraries unless explicitly requested.
- Do not add drag-and-drop until explicitly requested.
- Do not add layout persistence editing beyond the existing docked size presets, preset editing, or new persistence flows unless explicitly requested.

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
- new Tauri bridge capabilities beyond existing workspace lifecycle/state loading
- database/JDBC implementation
- Git integration
- Knowledge Catalog implementation
- Stages implementation
- Runbook engine
- Image Edit implementation
- real widget implementation
- non-Notes widget insertion behavior
- drag-and-drop layout editor
- layout persistence editing beyond the existing docked size presets or preset editor behavior
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

At the end of every task, report:
- files changed
- what changed
- validation commands and results
- commit hash
- what was intentionally not implemented
