# Widget V2 Platform Status

## Purpose

This document records the status of the Widget V2 platform foundation and the
safe next implementation blocks.

It is a docs-only status record. It does not add frontend behavior, backend or
Rust behavior, tests, storage/schema changes, runtime execution, Workspace API
changes, WidgetHost rewrites, WorkbenchCanvas rewrites, catalog insertion, or
current widget migration.

## Status

Widget V2 is a Planned platform architecture for future ideal Hobit widgets.

The platform foundation now has contracts, frontend folder/type scaffolding,
shared shell/layout primitives, a V2 manifest/registry model, and a runtime
intents contract. These pieces establish vocabulary and guardrails for later
focused V2 widgets. They do not make existing widgets V2.

Existing V1 widgets remain compatibility surfaces governed by
`docs/CURRENT_WIDGET_SURFACE.md` and their active domain contracts. No V2
widgets are exposed as standalone V2 product widgets through the V2 registry or
catalog yet. No runtime behavior changed as part of the platform foundation.

## Foundation Summary

### Widget V2 Platform Contract

`docs/WIDGET_V2_PLATFORM_CONTRACT.md` defines Widget V2 as a clean new
architecture for future widgets, not a broad migration of current widgets.

The contract establishes:

- `WidgetV2Manifest` as the static product contract for a future V2 widget.
- `WidgetV2RuntimeContext` as a scoped host-provided context, not a global
  Workspace API bag.
- `WidgetV2Shell`, header, toolbar, primary surface, optional rails,
  inspector, drawer, and popup/overlay vocabulary.
- A strict responsibility split: widget renders state and sends explicit typed
  actions; domain services own behavior, validation, persistence orchestration,
  allowed runtime calls, and state transitions.
- Initial V2 target domains: QueueV2, KnowledgeV2, WorkspaceAgentV2,
  TerminalV2, and FinderV2.

The contract explicitly keeps V2 from granting hidden context access, hidden
execution, direct Git mutation, Terminal launch, Queue dispatch, JDBC
execution, provider tool execution, or cross-widget mutation.

### Folder And Types Foundation

The frontend foundation lives under
`apps/desktop/frontend/src/workbench/widgetV2/`.

The current type layer defines:

- V2 ids and widget kinds.
- V2 capabilities.
- display/layout levels.
- manifest status values.
- product owner domains.
- panel slots.
- action intent descriptors.
- runtime context value shape.
- status summaries.
- `WidgetV2Manifest`.

This is frontend/platform scaffolding only. It does not change persisted widget
ids, V1 component keys, widget state shapes, storage records, or domain
runtime behavior.

### Shell And Layout Primitives

`WidgetV2Shell.tsx` provides shared React primitives for a continuous V2 widget
surface:

- `WidgetV2Shell`
- `WidgetV2Header`
- `WidgetV2Toolbar`
- `WidgetV2PanelLayout`
- `WidgetV2LeftRail`
- `WidgetV2RightInspector`
- `WidgetV2BottomDrawer`

`apps/desktop/frontend/src/styles/widget-v2.css` provides the shared visual
classes for these primitives.

These primitives are presentation structure only. They do not own domain
behavior, storage, runtime calls, hidden reads, hidden mutations, or Workbench
hosting changes.

### V2 Registry And Manifest Model

`widgetV2Registry.ts` defines a manifest list and registry helpers for planned
V2 widget kinds.

Current manifest status:

- `QueueV2` is `experimental`.
- `KnowledgeV2` is `planned`.
- `WorkspaceAgentV2` is `planned`.
- `TerminalV2` is `planned`.
- `FinderV2` is `planned`.
- `NotesV2` is `planned` as a future note/notebook-oriented manifest entry.

The registry validates manifest shape and uniqueness and exposes helpers for
lookup by kind or status. `getAvailableWidgetV2Manifests()` returns no
available V2 widgets today, so the registry does not expose a V2 catalog or
standalone V2 product widget surface.

### Runtime Intents Contract

`docs/WIDGET_V2_RUNTIME_INTENTS_CONTRACT.md` defines Widget V2 action intents
as the future typed boundary between V2 UI surfaces and domain services.

The contract defines intent categories for:

- opening and closing widget-owned popups;
- focusing an explicit widget instance;
- selecting visible domain items;
- requesting domain-owned actions;
- opening inspectors;
- opening drawers.

It also defines service boundaries for QueueService, KnowledgeService,
WorkspaceAgentService, TerminalService, FinderService, and later internal
WorkspaceGitService.

The intent model is not a broad action bus. It does not split WorkspaceApi by
itself, does not give widgets hidden permissions, and does not let components
execute provider calls, Terminal commands, Queue dispatch, Git operations,
JDBC queries, filesystem mutation, or cross-widget mutation directly.

## Current Compatibility Boundary

- Existing widgets remain V1 / compatibility surfaces.
- Existing widget ids and component keys remain unchanged.
- Existing WidgetHost and WorkbenchCanvas behavior remain unchanged.
- Existing WorkspaceApi shape remains unchanged.
- Existing storage and schema remain unchanged.
- Existing runtime paths remain unchanged.
- No V2 widget is currently exposed as an available standalone V2 widget.
- No V2 registry entry grants runtime capability by itself.

Queue V2-named board/read-model foundation may exist inside current Queue work,
but it remains a focused frontend foundation over existing Agent Queue data and
does not convert the current Agent Queue widget into a fully migrated V2
widget.

## Recommended Next Blocks

### QueueV2 Implementation Block 001

Start from the current Queue V2 foundation and Queue contracts. Complete the
first focused V2 operating-console slice around a clear board, selected-task
inspector, visible next action, and bounded activity/detail surface.

This block must not add hidden dispatch, backend scheduling, automatic
acceptance, Git mutation, Terminal launch, provider tool execution, storage
schema changes, or broad Queue migration.

### KnowledgeV2 Implementation Block 001

Define and implement the first KnowledgeV2 catalog slice around explicit
operator-authored or operator-approved records, provenance/lifecycle review,
enablement, search, and attach affordances where current contracts already
allow them.

This block must preserve no hidden memory, no automatic ingestion, no folder
watching, no embeddings/vector search, no team/server sharing, and no automatic
prompt injection.

### WorkspaceAgentV2 Provider/Runtime Block

Plan and implement a focused WorkspaceAgentV2 provider/runtime slice only after
the visible-context, proposal-card, and domain service boundary are explicit.

The block must keep provider requests based on visible or explicitly approved
context only, preserve `allowed_tools: []` unless a later contract explicitly
changes that, and avoid hidden widget reads, hidden mutation, automatic Queue
creation, Terminal control, Git mutation, JDBC execution, and Agent Executor
launch outside an approved contract.

### TerminalV2 Shell Block

Plan TerminalV2 as a manual shell surface over the current Terminal contract.
The first block should focus on V2 shell anatomy, explicit session status,
manual controls, and bounded visible runtime state.

It must not add Script Runner behavior, Queue-triggered commands,
WorkspaceAgent-triggered commands, hidden command execution, persistent PTY
transcripts, or new backend runtime behavior.

### FinderV2 File-Browser Block

Plan FinderV2 as an explicit-root file browser with bounded navigation,
preview, and approved file operations where current Finder contracts allow
them.

It must not add hidden workspace scanning, broad indexing, automatic context
ingestion, Terminal launch, Queue creation, root persistence, unsupported Git
mutation, or IDE replacement behavior.

## Must Not Happen

- No broad migration of current widgets to Widget V2.
- No silent reinterpretation of V1 widgets as V2 widgets.
- No WidgetHost rewrite before a V2 adapter is explicitly designed.
- No WorkbenchCanvas rewrite as part of the platform status or first V2 blocks.
- No WorkspaceApi split unless separately contracted.
- No storage/schema changes unless separately contracted.
- No new runtime behavior unless separately contracted.
- No new widget catalog insertion behavior unless separately contracted.
- No V1 compatibility id renames without explicit migration planning.

## Active References

- `docs/WIDGET_V2_PLATFORM_CONTRACT.md`
- `docs/WIDGET_V2_RUNTIME_INTENTS_CONTRACT.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/QUEUE_V2_FOUNDATION_STATUS.md`
