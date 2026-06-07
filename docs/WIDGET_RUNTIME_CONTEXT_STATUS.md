# Widget Runtime Context Status

## Purpose

This document records the status after the Block 003
`WidgetRuntimeContext` pilot.

It is a docs-only status record. It does not add frontend behavior,
backend/Tauri commands, storage/schema changes, runtime behavior, widget
migrations, WidgetHost rewrites, WorkbenchCanvas rewrites, WorkspaceApi splits,
new widget insertion behavior, or tests.

Authoritative implementation boundaries remain in
`docs/CURRENT_WIDGET_SURFACE.md`,
`docs/WIDGET_UNIFICATION_CONTRACT.md`,
`docs/WIDGET_RUNTIME_CONTEXT_DESIGN.md`, and
`docs/WIDGET_RUNTIME_CONTEXT_PILOT_AUDIT.md`.

## Block 003 Status

Status: completed as a narrow foundation and Knowledge / Skills pilot.

The pilot established a minimal `WidgetRuntimeContext` path beside existing
widget props. It did not remove broad host props, split WorkspaceApi, change
WorkbenchCanvas handoffs, or migrate widget domain behavior into a shared
runtime object.

## Minimal Foundation

The implemented foundation is intentionally small:

- `WidgetHost` constructs and provides a per-widget runtime context while
  remaining the registry-to-component mapping and compatibility adapter.
- `WidgetRuntimeContext` carries shell-level widget identity and widget-local
  logs access.
- The context is supplied alongside existing render props so widgets can adopt
  it gradually.
- Direct-prop fallback remains available for compatibility and tests.
- The context does not own domain actions, hidden context reads, execution,
  mutation, provider tools, routing, storage, or Workspace API implementation.

This proves the context can reduce shell-level prop pressure without becoming
a broad global action bag.

## Knowledge Pilot

The Knowledge / Skills pilot proved one low-risk consumer:

- Knowledge / Skills can read widget-local logs through
  `WidgetRuntimeContext.logs`.
- Existing direct-prop logs fallback remains intact.
- Knowledge / Skills domain workflows remain owned by the widget and Workspace
  APIs: Skill CRUD, Knowledge Document CRUD/search/import, draft review,
  Queue-context attachment, and Workspace Agent attachment were not moved into
  runtime context.
- The pilot preserved the `skill-library` compatibility identity and current
  Knowledge / Skills MVP behavior.

The pilot is a shell/runtime plumbing proof, not a Knowledge product expansion.

## Compatibility Status

Compatibility remains intentionally preserved:

- `WidgetHost` still imports and muxes all widget components.
- `widgetHostRenderProps` remains the central prop hub for broad widget-domain
  wiring.
- Existing widget props remain supported while context adoption is staged.
- Compatibility widget ids and component keys remain unchanged, including
  `interactive-agent`, `agent-run`, and `skill-library`.
- No persisted widget state, layout, logs, Queue tasks, Knowledge records,
  Notes records, Git roots, Terminal sessions, or runtime artifacts were
  migrated.

The pilot reduces future migration risk but does not claim unification is
complete.

## Tests

Focused frontend tests exist for the foundation and pilot:

- `widgetRuntimeContext.test.tsx` covers context creation, provider fallback,
  identity, and logs access behavior.
- `SkillLibraryWidget.runtime-context.test.tsx` covers Knowledge / Skills using
  runtime-context logs while preserving direct-prop fallback.
- Existing `widgetHostRenderProps` and Knowledge / Skills tests continue to
  cover the compatibility prop path.

This status record adds no new tests and changes no test expectations.

## Remaining Risks

### WidgetHost

`WidgetHost` still imports and multiplexes all widget components, normalizes
compatibility titles, assembles frame props, supplies broad render props, and
now provides runtime context. It remains a hotspot.

Risk control: keep `WidgetHost` as the mapping layer and migrate one
shell-level or domain-adapter concern at a time. Do not rewrite it broadly.

### widgetHostRenderProps

`widgetHostRenderProps` is still the central prop hub for cross-domain widget
wiring. It remains necessary compatibility infrastructure until individual
widgets prove narrower adapters.

Risk control: shrink one proven prop group only after an equivalent
runtime-context or widget-local adapter has focused test coverage.

### WorkbenchCanvas

`WorkbenchCanvas` still owns layout rendering, resize handles, floating
presentation, ghost placeholders, z-order/focus behavior, and cross-widget
handoffs. It remains too broad for a runtime-context cleanup block.

Risk control: do not combine runtime-context adoption with canvas layout,
floating, resize, or handoff-router extraction.

### WorkspaceApi

`WorkspaceApi` remains monolithic across Workspace lifecycle, widgets, Notes,
Queue, Knowledge / Skills, Git, Terminal fallback, JDBC, and other current
paths.

Risk control: create narrow adapters over the existing API first. Split one
domain at a time only after browser fallback, Tauri adapter, tests, and
unsupported-runtime behavior are understood.

## Recommended Next Block

Recommended next block: Queue v2 runtime-context pilot for board-shell
identity/logs only.

Rationale:

- Queue v2 already has a conservative view-model and board-shell foundation
  over existing Queue data.
- A board-shell pilot can consume `WidgetRuntimeContext` for identity/logs
  without moving Queue runtime actions.
- It exercises a higher-value widget surface while staying below the unsafe
  boundaries of execution, Autorun, run-link history, Knowledge
  materialization, report cards, and worker actions.

Expected scope:

- read `WidgetRuntimeContext` in the Queue v2 board-shell path for identity
  and/or widget-local logs where useful;
- keep Queue task CRUD, assignment, execution, Autorun, workers, run links,
  Knowledge context, report review, and handoffs on the existing Queue
  controller/props;
- preserve current Queue tests and add only focused context coverage;
- do not remove existing Queue props in the pilot.

Alternative next block: WidgetInfo migration batch.

Use this alternative if the next block must remain lower-risk presentation
work. It should migrate two or three simple informational surfaces to the
shared `WidgetInfoPopover` pattern without touching runtime context, host
props, domain APIs, or behavior.

## Explicit Non-Goals

This status record does not implement or authorize:

- code changes;
- frontend behavior changes;
- backend/Rust/Tauri changes;
- storage/schema changes;
- runtime execution behavior changes;
- WidgetHost rewrite;
- WorkbenchCanvas rewrite;
- WorkspaceApi split;
- broad `widgetHostRenderProps` rewrite;
- Queue execution, Autorun, scheduler, acceptance, or report behavior changes;
- hidden context access, hidden mutation, hidden execution, or automatic Queue
  creation.
