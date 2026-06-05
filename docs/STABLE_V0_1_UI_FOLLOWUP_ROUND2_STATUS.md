# Stable v0.1 UI Follow-Up Round 2 Status

Status record date: 2026-06-05

## Purpose

Record round 2 Stable v0.1 UI follow-up implementation status and the
remaining manual smoke checklist.

This is a docs-only status record. It does not add product behavior, frontend
behavior, backend APIs, storage, runtime execution, validation requirements, or
Stable v0.1 acceptance status. Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and task-specific contracts.

Manual desktop smoke was not run in this block. All `implemented` entries below
mean source-level UI work exists and is ready for manual smoke.

## Source Inputs

- `docs/STABLE_V0_1_UI_FOLLOWUP_STATUS.md`
- `docs/STABLE_V0_1_UI_SMOKE_BACKLOG.md`
- Targeted source/test inspection for Finder, Terminal, Knowledge / Skills,
  Workspace Agent, Queue, Notes, and theme/UI scale surfaces.
- Recent source-level follow-up commits:
  - `d011934` - Finder home and narrow layout
  - `178d324` - Terminal compact pane controls and cwd resolution
  - `988e141` - Knowledge catalog flow unification
  - `3712f0d` - Workspace Agent activity UI cleanup
  - `ab22d98` - Agent Queue panel refinements
  - `9626d33` - Notes layout and formatting controls
  - `03d6d5c` - app density and Industrial Cockpit colors-only theme

Status values:

- `implemented`: source-level follow-up exists and is ready for manual smoke.
- `manual-smoke-pending`: no passing desktop manual smoke result is recorded in
  this status document.
- `contract-follow-up`: source-level work should be reconciled with
  authoritative contracts before final Stable v0.1 acceptance language changes.

## Round 2 Status

| Area | Status | Recorded source-level result | Remaining manual smoke |
| --- | --- | --- | --- |
| Finder home/icons/rails/panels | implemented, manual-smoke-pending, contract-follow-up | Finder has source/test coverage for opening the user home path as the default root when no explicit root is selected, file/folder entry icon styling, narrow layout behavior, and Finder Git/Commit/History panel presentation states. | Smoke Home/default orientation, explicit root approval, root unsupported honesty, column navigation, entry icon readability, narrow layout rails/panels, preview minimize/maximize/close, edit save/cancel dirty-state blocking, Git status/diff/history/commit/push guardrails, and no hidden scanning or Workspace Agent context attach. |
| Terminal compact/settings/cwd/tabs/splits | implemented, manual-smoke-pending, contract-follow-up | Terminal has source/test coverage for collapsed settings by default, compact pane controls, visible cwd handling, home-relative cwd resolution for desktop PTY requests, tab creation, split panes up to the bounded limit, and active-pane input routing. Current contracts still contain no-tabs/no-splits language, so final acceptance language needs reconciliation. | Smoke autostart/start after close, collapsed settings, cwd display and edited cwd restart, tab create/close isolation, split right/down behavior and limits, active-pane input routing, Stop/Kill/Close scoping, PTY output/ANSI/resize, one-shot fallback, session-only buffers, and no Workspace Agent/Queue control. |
| Knowledge IA/import/info | implemented, manual-smoke-pending | Knowledge / Skills has source-level IA unification across Skills, Documents, catalog list/detail/preview, utility panels, document import controls, scope/source/summary fields, draft review, and visible attachment surfaces. | Smoke Skill CRUD/attach, Document CRUD/import/search, info popover, scope filters, quick summaries and missing-summary warnings, source labels, Notes promotion, Queue draft accept/reject, Queue context attach/materialization, and no full Knowledge Catalog, hidden memory, or automatic activation claim. |
| Workspace Agent metadata/activity/primary cleanup | implemented, manual-smoke-pending | Workspace Agent has source-level cleanup for primary action focus, run metadata rendering in assistant messages, activity line styling, status/examples header controls, visible context display, and report/review cards without hidden execution. | Smoke examples, composer primary action, visible context attach/remove, Codex run metadata, activity line states, working indicator, thread state/new-thread behavior, Queue/Note/Knowledge/JDBC proposal review, separate explicit create actions, and `allowed_tools: []` / visible-context boundaries. |
| Queue panels/flow/tags | implemented, manual-smoke-pending | Queue has source-level panel refinement for left rail/sidebar, flow map, detail/right rail, workers, scoped worker routing, tag creation/rename/delete/pause/resume/color controls, report/evidence sections, and no-run management messages. | Smoke task create/select/edit/delete, sidebar scanning, flow map selection, detail/right rail sections, worker scope mismatch warnings, tag create/rename/delete/pause/resume/color behavior, assignment, explicit start, Autorun arming, run links, report/closure actions, and no execution from list/flow/tag management clicks alone. |
| Notes layout/prettify | implemented, manual-smoke-pending | Notes has source/test coverage for collapsible list rail, two-pane layout, editor-only Ctrl+S/Cmd+S save, formatting controls, JSON pretty/minify, CSV/text normalization, save/pin/filter, and Knowledge promotion controls. | Smoke rail collapse/expand, list/editor usability at narrow sizes, create/select/edit/save/pin/filter, editor-only keyboard save, formatting success/error states, desktop persistence, explicit Knowledge promotion, and no Notebook/rich-rendering or hidden Workspace Agent read. |
| Global density and colors-only theme | implemented, manual-smoke-pending | App theme source/tests cover UI scale persistence/root variable application and the Industrial Cockpit colors-only dark palette. Shared CSS continues to rely on theme variables for product colors. | Smoke UI scale at 90%, 100%, 110%, 125%, and 150%; verify dense widgets remain readable, controls do not overlap, Industrial Cockpit applies as a colors-only theme, custom theme HEX/color inputs stay synchronized, and no raw-color or gradient visual drift is introduced in the checked surfaces. |

## Remaining Manual Smoke Checklist

Run one consolidated desktop smoke pass on the candidate commit with an
isolated database and record date, tester, OS/platform, launch method,
database path, and commit under test.

1. Start/reopen a Workspace and confirm default Workspace Agent plus Notes,
   recent Workspace recovery, safe recent summaries, Workspace isolation, and
   View controls.
2. Smoke Finder home/icons/rails/panels including explicit root approval,
   columns, narrow layout, floating preview states, edit save/cancel,
   capped/binary/permission states, Finder Git status/diff/history,
   selected-file commit, manual push guardrails, and no hidden scanner/context
   attach.
3. Smoke Terminal compact/settings/cwd/tabs/splits including autostart,
   settings, cwd restart, tabs, split panes, active-pane input, Stop/Kill/Close,
   one-shot fallback, unsupported platform honesty, session-only buffers, and
   no agent/Queue control.
4. Smoke Knowledge / Skills IA/import/info including Skill CRUD/attach,
   Document CRUD/import/search, info popover, quick summaries, scope/source
   labels, Notes promotion, Queue draft review, Queue context
   attach/materialization, and no hidden memory.
5. Smoke Workspace Agent metadata/activity/primary cleanup including examples,
   composer primary action, visible context, run metadata, activity line,
   thread controls, proposal review, explicit create actions, and no hidden
   execution.
6. Smoke Queue panels/flow/tags including task CRUD, sidebar/details scanning,
   Flow Map, tag lifecycle/color/pause behavior, scoped workers, assignment,
   explicit start, Autorun arming, run links, reports, closure decisions, and
   no auto-finalization.
7. Smoke Notes layout/prettify including rail collapse, list/editor usability,
   keyboard save, formatting actions, save/pin/filter, desktop persistence,
   Knowledge promotion, and no hidden agent read.
8. Smoke global density and colors-only theme including all UI scale presets,
   Industrial Cockpit, custom HEX/color inputs, no text/control overlap, and
   no gradient/raw-color visual drift in the checked surfaces.

## Intentionally Not Changed

- No frontend behavior changes.
- No backend, Tauri, storage, or schema changes.
- No runtime execution changes.
- No Stable v0.1 acceptance result change.
- No contract reconciliation beyond this status record.
