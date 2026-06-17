# Module Shell/Header Migration Plan

## Executive summary

This is an audit and migration plan only. It does not create `ModuleShell`,
does not create `ModuleHeader`, does not migrate any module, and does not
change UI or runtime behavior.

The current active outer shell is `WidgetFrame`. It is created through
`WidgetHost`, wraps the active widget component, owns widget logs access, hosts
the frame title/status/actions, and participates in the current docked and
in-app floating presentation flows. `WidgetV2Shell` is a second shell path used
inside the Knowledge / Skills route and should not become the new active
outer shell.

The recommended future direction is:

- Keep `WidgetFrame` as the single active outer shell during migration.
- Add a presentational `ModuleShell` / `ModuleHeader` primitive in the shared
  design-system widget area.
- Have `WidgetFrame` consume that primitive when modules are migrated, instead
  of asking each module to create its own outer shell.
- Reduce `WidgetV2Shell` to a compatibility/layout wrapper or remove it from
  active product routes after Knowledge / Skills has migrated.
- Pilot the visual shell migration with Agent Activity first, then Notes.

The main risk is not raw color drift. The main risk is shell competition:
`WidgetFrame`, `WidgetV2Shell`, and local module header/body wrappers can all
try to own the same visual boundary. The migration should therefore avoid
direct module-level adoption until `WidgetFrame` exposes a safe compatibility
path.

## Recommended integration point

### Source location

Place the future shared presentational component with the existing shared widget
chrome:

- `apps/desktop/frontend/src/design-system/widget/ModuleShell.tsx`

That file should export the presentational pieces needed by `WidgetFrame`:

- `ModuleShell`
- `ModuleHeader`
- `ModuleHeaderGroup`
- `ModuleHeaderState`
- small presentational helper types, if needed

Do not place the component under `apps/desktop/frontend/src/workbench/`. The
workbench layer owns widget registry, placement, layout, persistence, and
host-level coordination. The shell/header primitive must not know about widget
IDs, Queue, Workspace Agent, Terminal, Knowledge, scheduler state, Codex runs,
Tauri commands, or task-specific behavior.

Do not place the component under `apps/desktop/frontend/src/workbench/widgetV2/`.
That would preserve `WidgetV2Shell` as a competing shell family and make
Knowledge / Skills migration harder.

Do not create a module-local shell under an individual module folder. That
would repeat the current local wrapper drift.

### Exports and imports

Expose the future component through the design-system barrel:

- `apps/desktop/frontend/src/design-system/index.ts`

Expected future export:

```ts
export * from "./widget/ModuleShell";
```

The existing `apps/desktop/frontend/src/design-system/WidgetFrame.tsx` facade is
a compatibility export for `WidgetFrame`. A matching root facade for
`ModuleShell` is optional, but new code should prefer the design-system barrel
or the shared widget path. Modules should not import `ModuleShell` directly
until the migration strategy explicitly calls for it.

### CSS and tokens

Define semantic shell/header tokens in:

- `apps/desktop/frontend/src/styles/tokens.css`

Define shared module shell/header selectors in:

- `apps/desktop/frontend/src/styles/ui/widget.css`

`styles/ui/widget.css` is already part of the shared UI CSS namespace through
`styles/ui/index.css`, and `styles/ui/index.css` is imported by
`styles/layout.css`. It is the right home for reusable shared widget chrome.

Do not add new shell/header tokens to module-local files such as:

- `styles/agent-queue.css`
- `styles/notes.css`
- `styles/terminal.css`
- `styles/widget-v2-knowledge.css`
- `styles/widget-v2-workspace-agent.css`

`styles/widget-frame.css` can be adjusted later so `WidgetFrame` maps its
existing classes onto module shell/header variables, but token ownership should
remain in `tokens.css`.

## Relationship to `WidgetFrame` and `WidgetV2Shell`

### `WidgetFrame`

`WidgetFrame` should remain the single active outer shell during migration.

The future `ModuleShell` should not replace `WidgetFrame` as the public wrapper
used by modules. Instead, it should become a presentational primitive consumed
by `WidgetFrame` or by a tightly controlled `WidgetFrame` opt-in path.

`WidgetFrame` currently owns or coordinates behavior that the presentational
component should not own:

- widget title normalization through `WidgetHost`
- widget-local logs button and logs panel
- move handle behavior
- host actions such as floating, docking, and remove
- persisted layout size passed as frame style
- fallback rendering for missing widget definitions/components

Those responsibilities should remain outside `ModuleShell`.

### `WidgetV2Shell`

`WidgetV2Shell` currently creates an inner shell path, most visibly in
Knowledge / Skills. It has its own header, status, actions, border, body, and
layout rails/drawer concepts. That makes Knowledge / Skills a double-shell
module when it is already wrapped by `WidgetFrame`.

The long-term target is:

- active product surfaces use `WidgetFrame` as the outer shell;
- `WidgetFrame` uses `ModuleShell` / `ModuleHeader` for visual chrome;
- `WidgetV2Shell` is either removed from active routes or reduced to a
  compatibility/layout wrapper that no longer draws another outer shell/header.

Do not migrate modules by importing `WidgetV2Shell` more broadly.

### Safe migration seam

The safest seam is inside `WidgetFrame`, with an opt-in visual path or internal
composition change that lets a pilot module use the new shell/header without
creating a third public shell family.

Unsafe seams:

- module components directly wrapping themselves in `ModuleShell` while still
  being wrapped by `WidgetFrame`;
- `WidgetHost` bypassing `WidgetFrame` for selected modules;
- adding another workbench-level shell under `workbench/`;
- expanding `WidgetV2Shell` to cover more modules.

### Compatibility constraints

Persisted widget/module identity must not change as part of this work.

Important current IDs and compatibility names include:

- `interactive-agent` for Workspace Agent compatibility;
- `skill-library` for Knowledge / Skills compatibility;
- `agent-run` for Agent Executor compatibility;
- `agent-queue` for Agent Queue;
- `terminal`, `notes`, `agent-activity`, `finder`, `database-jdbc`,
  `runbook`, and `git` where currently available.

The registry and host mapping remain the compatibility boundary:

- `apps/desktop/frontend/src/workbench/widgetRegistry.ts`
- `apps/desktop/frontend/src/workbench/widgetHostComponents.ts`
- `apps/desktop/frontend/src/workbench/WidgetHost.tsx`

No migration phase should rename widget IDs, component keys, persisted layout
records, widget state shapes, or workspace storage fields.

## Proposed future component boundary

`ModuleShell` and `ModuleHeader` should be presentational only.

They may know how to render:

- a continuous module surface;
- one header;
- one full-width horizontal separator between header and body;
- a body slot;
- optional footer slot;
- left and right header groups;
- a compact state badge/segment;
- a body collapse affordance supplied by the caller.

They must not know how to:

- start or stop Queue execution;
- run Workspace Agent or Codex work;
- read or write Knowledge records;
- start, stop, kill, or configure Terminal sessions;
- read Git status or commit files;
- call Tauri commands;
- load widget logs;
- mutate workspace/widget storage;
- inspect widget definitions or component keys.

The target visual contract is:

- module = clean canvas plus one top header plus body;
- header/body split = exactly one thin horizontal line spanning full module
  width;
- header container has no padding;
- header corner radius is minimal, around `2px`;
- left header group is flush to the left edge;
- right header group is flush to the right edge;
- space between groups is empty flexible space;
- elements inside each group touch edge-to-edge with no gap;
- minimize lives in the right group and collapses only the body.

## Proposed future component API shape

This is pseudocode only. It is not an implementation contract.

```tsx
type ModuleShellProps = {
  className?: string;
  style?: React.CSSProperties;
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyCollapsed?: boolean;
  bodyId?: string;
};

type ModuleHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  state?: React.ReactNode;
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  bodyCollapsed?: boolean;
  onBodyCollapsedChange?: (collapsed: boolean) => void;
  collapseLabel?: string;
  expandLabel?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
};

type ModuleHeaderStateProps = {
  tone:
    | "idle"
    | "active"
    | "running"
    | "completed"
    | "blocked"
    | "error"
    | "draft"
    | "disabled";
  children: React.ReactNode;
};

function WidgetFrame(props: WidgetFrameProps) {
  return (
    <ModuleShell
      bodyCollapsed={props.bodyCollapsed}
      header={
        <ModuleHeader
          title={props.title}
          subtitle={props.subtitle}
          state={props.status}
          leftActions={props.leftHeaderActions}
          rightActions={props.actions}
          bodyCollapsed={props.bodyCollapsed}
          onBodyCollapsedChange={props.onBodyCollapsedChange}
          dragHandleProps={props.moveHandleProps}
        />
      }
      footer={props.footer}
    >
      {props.children}
    </ModuleShell>
  );
}
```

Important API rules:

- `ModuleShell` receives slots; it does not fetch or compute domain state.
- `ModuleHeader` receives already prepared title, state, and actions.
- `WidgetFrame` remains responsible for adapting current widget props to the
  presentational shell.
- Module-specific actions should not gain direct access to shell internals.

## Collapse/minimize ownership recommendation

### Current audit

There is no shared module-body collapse implementation in `WidgetFrame`.

Current related behavior is scattered:

- `WidgetLayoutMode` includes `"minimized"` in
  `apps/desktop/frontend/src/workbench/types.ts`, but the active presentation
  path primarily distinguishes docked and in-app popped-out widgets.
- `WidgetHost` and `WorkbenchCanvas` manage docked versus in-app floating
  presentation, ghost placeholders, and dock-back/pop-out actions.
- Notes has local list collapse and list resizing.
- Workspace Agent has a local activity pane collapse.
- Queue V2 has local lane collapse.
- Finder has local pane and preview minimized/maximized states.
- Terminal has local session/pane/detail controls, but not shared module-body
  collapse.
- Git compatibility UI has local panel collapse behavior.

These local collapses are body workflow controls, not shell-level module
minimize.

### Recommendation

Future body collapse should be owned by `WidgetFrame` or a host-level
presentation adapter and passed into `ModuleShell` as props.

`ModuleShell` should render the collapsed or expanded body based on:

- `bodyCollapsed`;
- `onBodyCollapsedChange`;
- a header action supplied by `WidgetFrame`.

`ModuleShell` should not keep hidden internal state that modules cannot observe.

For the first implementation block, keep body collapse frontend-local and
session-local. Do not persist it, do not repurpose `WidgetLayoutMode:
"minimized"`, and do not introduce workspace schema changes. Persisted minimize
or Dock/presence-zone behavior should remain a later explicit product decision.

When collapsed:

- the header remains visible;
- the minimize/expand control remains in the right header group;
- logs and host actions remain reachable;
- only the module body content is hidden;
- module-local body collapses, such as Notes list collapse or Queue lane
  collapse, remain independent.

Migration risk exists where modules already use "collapse" for a body region.
Those controls must keep their existing meaning and should not be renamed or
merged into shell minimize during the shell migration.

## Header action ownership rules

Use the module shell header only for module-level state and module-level
commands. Keep body workflows in the body.

General rules:

- Header left group: module title, compact subtitle if needed, compact module
  state.
- Header right group: module-level actions, logs, host actions, and body
  minimize.
- Body: item workflows, editors, filters, search, selected-item controls,
  run/session details, board controls, and task review controls.
- Details/dev UI: diagnostics, self-tests, raw payloads, bridge details,
  provider/runtime details, and developer-only controls.
- Never place row-level, task-level, note-level, file-level, terminal-pane, or
  proposal-card actions in the module shell header.

### Workspace Agent

Header candidates:

- compact agent state such as idle, running, blocked, or error;
- logs, body minimize, and host actions;
- possibly a compact provider/model indicator if it is treated as state, not
  configuration.

Body actions:

- chat composer controls;
- visible context controls;
- Direct Work prompt/run controls;
- activity pane toggle;
- prompt examples;
- prompt pack import;
- proposal review cards.

Details/dev UI:

- Run Agent Self-Test;
- provider/runtime diagnostics;
- raw proposal/debug details;
- run configuration details that do not need to be visible at all times.

Do not put proposal approval, Queue creation, Note creation, or validation-card
actions in the shell header.

### Agent Activity

Header candidates:

- event count;
- current activity state if introduced later;
- logs, body minimize, and host actions.

Body actions:

- event row expansion;
- event details/raw views;
- follow-latest behavior if it remains a timeline workflow.

Agent Activity is the safest pilot because its current local body header mostly
duplicates state and count rather than owning runtime behavior.

### Agent Queue / QueueV2

Header candidates:

- compact queue state;
- running/review/blocked count summary;
- refresh and new task only if treated as module-level actions;
- logs, body minimize, and host actions.

Body actions:

- Queue Board command row;
- Enable Queue / Autorun controls until an explicit header policy is approved;
- Codex executable setup;
- lane collapse/expand;
- task selection;
- task details;
- validation and review controls;
- run-link history;
- create/edit/delete task flows.

Details/dev UI:

- broker evidence;
- executor assignment diagnostics;
- worker/runtime internals;
- raw metadata.

Queue execution and scheduler behavior must not change during shell migration.

### Knowledge / Skills

Header candidates:

- data-source/readiness state;
- compact document/skill count;
- New, Import, or Manage actions only after the double-shell issue is resolved;
- logs, body minimize, and host actions.

Body actions:

- view mode;
- search/filter;
- selected document/skill actions;
- attach selected skill;
- draft review;
- legacy compatibility flows while they still exist.

Details/dev UI:

- Knowledge diagnostics;
- data bridge details;
- raw import/status details.

Knowledge / Skills must not be the first pilot because it currently has
`WidgetFrame` plus `WidgetV2Shell`.

### Notes

Header candidates:

- Saved, Unsaved, Loading, or Error state;
- New note;
- Refresh;
- logs, body minimize, and host actions.

Body actions:

- list filter/search;
- list collapse and resize;
- note title/body editing;
- edit/preview mode;
- formatting tools;
- Save;
- Promote to Knowledge;
- pin behavior.

Notes is a good second pilot because it uses `WidgetFrame` directly, but its
editor and workspace Notes API flows make it slightly riskier than Agent
Activity.

### Terminal

Header candidates:

- compact active session state;
- logs, body minimize, and host actions.

Body actions:

- Start, Restart, Stop, Kill, Close;
- Copy, Clear, Refresh;
- shell and working-directory settings;
- pane/tab/split controls that exist in the current UI;
- legacy one-shot fallback controls.

Details/dev UI:

- PTY backend diagnostics;
- session buffer details;
- legacy fallback diagnostics.

Terminal should not be an early pilot because its current header-like controls
are tightly coupled to the active pane/session workflow.

### Agent Executor compatibility surface

Header candidates:

- compact run state;
- logs, body minimize, and host actions.

Body actions:

- prompt, repository root, sandbox, approval policy, executable, and start run;
- run result/log review.

Do not expand Agent Executor product visibility as part of module shell work.

### Database / JDBC Preview

Header candidates:

- connector/readiness state;
- Refresh and New connector if treated as module-level actions;
- logs, body minimize, and host actions.

Body actions:

- connector editing;
- validation;
- read-only SQL validation/execution preview;
- result review;
- boundary finder.

No JDBC runtime behavior, credentials behavior, or schema behavior should change.

### Runbook Preview

Header candidates:

- compact preview/manual state;
- logs, body minimize, and host actions.

Body actions:

- step selection;
- local procedural notes;
- preview/manual step controls.

Do not add a runbook engine or execution path.

### Finder

Finder is lower priority for this migration because it has its own pane and
preview presentation controls.

Header candidates:

- root/status summary;
- logs, body minimize, and host actions.

Body actions:

- root approval;
- file navigation;
- preview edit/save;
- pane minimize/maximize;
- Finder Git review actions.

Do not add hidden scanning, Terminal launching, or broader Git mutation.

## Token/config plan

### Reusable existing variables

Reuse these existing variables where possible:

- surfaces: `--color-widget-surface`, `--color-widget-surface-raised`,
  `--color-nested-surface`, `--color-io-surface`, `--color-overlay-surface`;
- borders: `--color-border-subtle`, `--color-border`,
  `--color-border-strong`;
- text: `--color-text-primary`, `--color-text-secondary`,
  `--color-text-muted`, `--color-text-disabled`;
- semantic tones: `--color-primary`, `--color-primary-soft`,
  `--color-primary-quiet`, `--color-success`, `--color-success-soft`,
  `--color-warning`, `--color-warning-soft`, `--color-error`,
  `--color-error-soft`, `--color-info`, `--color-info-soft`,
  `--color-neutral`, `--color-neutral-soft`;
- spacing: `--space-2xs`, `--space-xs`, `--space-sm`, `--space-md`,
  `--space-lg`, `--space-xl`, `--scaled-space-xs`, `--scaled-space-sm`,
  `--scaled-space-md`;
- control sizing: `--control-height-sm`, `--control-height-md`,
  `--badge-height`;
- focus/shadow: `--focus-ring`, `--shadow-widget`;
- existing widget spacing while migrating: `--widget-header-padding-x`,
  `--widget-header-padding-y`, `--panel-padding`.

### New tokens needed

Add semantic module shell tokens in `styles/tokens.css` during Phase 1.

Recommended token shape:

```css
:root {
  --module-shell-radius: 2px;
  --module-header-radius: 2px;
  --module-header-height: var(--control-height-sm);
  --module-header-padding-x: 0;
  --module-header-padding-y: 0;
  --module-header-gap: 0;
  --module-header-separator-width: 1px;
  --module-header-separator-color: var(--color-border-subtle);
  --module-header-background: var(--color-widget-surface);
  --module-body-background: var(--color-widget-surface);
  --module-header-segment-background: transparent;
  --module-header-segment-hover-background: var(--color-widget-surface-raised);
  --module-header-segment-active-background: var(--color-primary-soft);
  --module-header-segment-disabled-background: transparent;
  --module-header-segment-disabled-color: var(--color-text-disabled);
}
```

State tone tokens should be semantic aliases, not raw colors:

```css
:root {
  --module-state-idle-color: var(--color-text-muted);
  --module-state-idle-background: var(--color-neutral-soft);
  --module-state-active-color: var(--color-primary);
  --module-state-active-background: var(--color-primary-soft);
  --module-state-running-color: var(--color-info);
  --module-state-running-background: var(--color-info-soft);
  --module-state-completed-color: var(--color-success);
  --module-state-completed-background: var(--color-success-soft);
  --module-state-blocked-color: var(--color-warning);
  --module-state-blocked-background: var(--color-warning-soft);
  --module-state-error-color: var(--color-error);
  --module-state-error-background: var(--color-error-soft);
  --module-state-draft-color: var(--color-neutral);
  --module-state-draft-background: var(--color-neutral-soft);
  --module-state-disabled-color: var(--color-text-disabled);
  --module-state-disabled-background: var(--color-widget-surface-raised);
}
```

If a reusable `2px` radius token is preferred, add a base token such as
`--radius-2xs: 2px` and set module shell/header radius from it. Do not replace
all existing radius values in one broad cleanup.

### Hardcoded values to migrate first

Migrate these first when Phase 1 and the pilot begin:

- `WidgetFrame` header padding/gap/radius assumptions;
- `WidgetFrame` content padding where it conflicts with module body ownership;
- `WidgetV2Shell` header separator and shell radius;
- Agent Activity local header spacing and repeated count/status treatment;
- Notes frame toolbar/status placement in the header compatibility path.

Do not migrate these until the owning module is actively being migrated:

- Queue board lane/card spacing and lane collapse visuals;
- Workspace Agent transcript/composer/activity pane layout;
- Terminal output/session/pane controls and xterm geometry;
- Knowledge catalog card/table layout;
- Finder pane and preview geometry;
- JDBC result table/editor layout;
- Runbook step detail spacing.

### Values that should remain local during migration

Keep module workflow geometry local until each module migration explicitly
touches it:

- split-pane widths;
- resizer sizes;
- terminal output area height;
- board lane min/max widths;
- editor text area sizing;
- data table density;
- popup/drawer dimensions;
- row/card internal spacing.

## Migration phases

### Phase 0: audit/docs only

Target files/modules:

- `docs/MODULE_SHELL_HEADER_MIGRATION_PLAN.md`

Expected code changes:

- None.

Risks:

- Missing a module-specific local header/collapse behavior.
- Over-scoping the future component before pilot validation.

Required tests:

- `git status --short --branch`
- inspect relevant frontend files;
- inspect `docs/FRONTEND_DESIGN_AUDIT.md`;
- `git diff --check`

Acceptance criteria:

- The migration plan exists.
- No frontend, backend, runtime, storage, CSS, or schema files changed.
- The plan identifies integration point, shell relationship, collapse
  ownership, header action ownership, tokens, phases, risks, and first pilot.

Rollback strategy:

- Revert or delete this document only.

Must not change:

- React components;
- CSS;
- Tauri/backend/storage;
- widget registry;
- runtime behavior;
- Queue scheduler/execution behavior;
- Workspace Agent execution behavior;
- Knowledge storage/API behavior.

### Phase 1: tokens and shared presentational component foundation

Target files/modules:

- `apps/desktop/frontend/src/styles/tokens.css`
- `apps/desktop/frontend/src/styles/ui/widget.css`
- `apps/desktop/frontend/src/design-system/widget/ModuleShell.tsx`
- `apps/desktop/frontend/src/design-system/index.ts`
- optional design-system tests near existing `WidgetFrame` tests

Expected code changes:

- Add module shell/header tokens.
- Add presentational shell/header component.
- Export it from the shared design system.
- Add unit tests for header grouping, body collapse rendering, state tone class
  selection, and no domain behavior.
- Do not adopt it in product modules yet unless the implementation prompt
  explicitly includes a controlled `WidgetFrame` internal compatibility path.

Risks:

- Accidentally creating a third public shell path.
- Encoding module-specific logic in the shared component.
- Introducing visual tokens that duplicate existing theme tokens.

Required tests:

- design-system component tests;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- `git diff --check`;
- changed-profile Toolbelt validation if code changes remain focused.

Acceptance criteria:

- `ModuleShell` and `ModuleHeader` are presentational and domain-free.
- No active module behavior changes.
- No widget IDs, registry entries, storage fields, or runtime paths change.
- Header groups can be rendered flush left/right with zero internal gap.
- The body can be hidden by prop while the header remains visible.

Rollback strategy:

- Remove the new component, export, tests, and tokens.
- Since no module should depend on it yet, rollback should not affect product
  widgets.

Must not change:

- module implementations;
- `WidgetHost` mapping;
- Queue execution;
- Workspace Agent execution;
- Terminal session behavior;
- Knowledge APIs/storage;
- backend/Tauri/schema.

### Phase 2: lowest-risk pilot module

Recommended pilot:

- Agent Activity.

Target files/modules:

- `apps/desktop/frontend/src/workbench/AgentActivityWidget.tsx`
- `apps/desktop/frontend/src/workbench/agents/AgentActivityPanel.tsx`, only if
  a body-local duplicate header must be removed or simplified;
- `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx`, only for a
  controlled opt-in or internal composition path;
- relevant CSS in shared widget chrome and Agent Activity CSS.

Expected code changes:

- Route Agent Activity through the `WidgetFrame` compatibility path that uses
  the new module header.
- Move the event count/status into the module header state area.
- Keep timeline rows and details in the body.
- Add the shell body collapse affordance if Phase 1 includes the opt-in state.

Risks:

- Body title/count duplication.
- Minor visual spacing drift.
- Header action order drift in tests.

Required tests:

- Agent Activity widget tests if present;
- `WidgetFrame`/design-system tests;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- focused visual/manual smoke at narrow and normal widget sizes;
- changed-profile Toolbelt validation.

Acceptance criteria:

- Agent Activity has one visible module header.
- Header/body split uses one separator line.
- Header groups are flush to left/right.
- Body collapse hides timeline content only.
- Event expansion and readable timeline behavior are unchanged.

Rollback strategy:

- Remove Agent Activity opt-in and restore its previous body header.
- Keep Phase 1 shared component if unused elsewhere.

Must not change:

- activity event source;
- executor/agent runtime;
- persisted activity history behavior;
- widget registry IDs.

### Phase 3: second pilot / validation

Recommended second pilot:

- Notes.

Target files/modules:

- `apps/desktop/frontend/src/workbench/NotesPlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/notes/NotesToolbar.tsx`
- `apps/desktop/frontend/src/workbench/notes/NotesStatusMessage.tsx`
- `apps/desktop/frontend/src/styles/notes.css`, only for shell overlap cleanup

Expected code changes:

- Put Refresh, New, status, logs, host actions, and body minimize in the module
  header path.
- Keep list filter/search, list collapse/resize, editor mode, formatting, Save,
  Promote to Knowledge, and pin behavior in the body.
- Preserve current workspace Notes API fallback behavior.

Risks:

- Confusing shell body minimize with Notes list collapse.
- Moving Save or Promote to the shell header by mistake.
- Creating extra internal boxes around list/editor.

Required tests:

- Notes widget tests for list, create, select, edit, save, pin, and promote
  flows where available;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- manual smoke for list collapse and body collapse independently;
- changed-profile Toolbelt validation.

Acceptance criteria:

- Notes still supports list, filter, create, select, edit, explicit save, and
  pin flows.
- Shell minimize collapses only the module body.
- Notes list collapse remains body-local.
- Save and Promote remain selected-note body actions.

Rollback strategy:

- Revert Notes to the prior `WidgetFrame` action/status setup.
- Leave Agent Activity and Phase 1 foundation intact if they remain valid.

Must not change:

- Notes storage/API behavior;
- Knowledge promotion behavior;
- Notebook/future Notes scope;
- backend/Tauri/schema.

### Phase 4: medium-risk modules

Recommended targets:

- Runbook Preview;
- Database / JDBC Preview;
- Finder only if the migration explicitly handles its pane presentation;
- Agent Executor compatibility only if explicitly requested as supporting
  surface cleanup.

Expected code changes:

- Convert frame header state/actions to the module header path.
- Keep preview/manual workflows in body content.
- Keep Finder pane minimize/maximize, file preview, and Git review actions in
  the Finder body.
- Keep JDBC connector edit and read-only SQL preview controls in the JDBC body.

Risks:

- Finder already has its own pane minimize/maximize vocabulary.
- JDBC header actions can be confused with query-level actions.
- Agent Executor should not become a Stable v0.1 product widget through visual
  cleanup.

Required tests:

- module-specific tests for current visible workflows;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- `npm.cmd run build --prefix apps/desktop/frontend` if frontend code changed
  broadly;
- changed-profile Toolbelt validation.

Acceptance criteria:

- One active shell/header per migrated module.
- No runtime behavior, API behavior, Git behavior, JDBC behavior, or execution
  behavior changes.
- Module-local pane/task/item actions remain in body.

Rollback strategy:

- Revert individual module migration commits independently.
- Keep shared component and earlier pilots.

Must not change:

- JDBC production behavior or sidecar behavior;
- Finder root approval model;
- Git mutation scope;
- Agent Executor visibility/product status;
- Runbook execution behavior.

### Phase 5: high-risk modules

Recommended targets:

- Knowledge / Skills;
- Terminal;
- Agent Queue / QueueV2;
- Workspace Agent.

Suggested order:

1. Knowledge / Skills, to remove the `WidgetFrame` plus `WidgetV2Shell` double
   shell.
2. Workspace Agent, to split overloaded config/debug/body controls out of the
   header.
3. Agent Queue / QueueV2, to separate module state from board/task/review
   workflows.
4. Terminal, to preserve session/pane controls while simplifying chrome.

Expected code changes:

- Knowledge: remove or neutralize inner `WidgetV2Shell` chrome on the active
  route while preserving compatibility IDs and Knowledge APIs.
- Workspace Agent: keep compact run state in header; move self-test,
  examples/import, provider/debug/config, and activity toggle decisions to
  body or details/dev UI.
- Queue: keep compact queue state/counts in header; keep board commands,
  task actions, review, validation, assignment, and autorun controls in body.
- Terminal: keep compact session state in header; keep per-session and
  per-pane controls in body.

Risks:

- Workspace Agent tests may currently expect overloaded header controls.
- Queue header actions are coupled to execution-sensitive state.
- Knowledge migration can accidentally preserve two visible shells or remove
  useful V2 layout affordances too early.
- Terminal output geometry and session lifecycle controls are sensitive to
  layout changes.

Required tests:

- module-specific unit/integration tests;
- Workspace Agent Direct Work and proposal rendering tests where affected;
- Queue autorun/execution/review tests where affected;
- Terminal PTY UI tests and manual desktop smoke where affected;
- Knowledge import/retrieval/skill attach tests where affected;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- frontend build attempt;
- full Toolbelt validation before acceptance.

Acceptance criteria:

- Each migrated module has one active shell/header.
- Header contains only compact module state and module-level actions.
- Task/item/session/proposal/document actions remain in body.
- No scheduler, execution, storage, API, or Tauri behavior changes.
- No persisted widget IDs or state shapes change.

Rollback strategy:

- Split each high-risk module into its own focused commit.
- Revert only the affected module migration.
- Keep shared component and lower-risk migrations.

Must not change:

- Queue scheduler/execution/autorun behavior;
- Workspace Agent execution/provider behavior;
- Knowledge storage/API behavior;
- Terminal PTY backend behavior;
- backend/Tauri/schema;
- widget registry/catalog eligibility.

### Phase 6: cleanup/removal of old shell paths

Target files/modules:

- `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx`
- `apps/desktop/frontend/src/styles/widget-v2.css`
- module-local header CSS that has become unused;
- tests that referenced old shell-specific class names;
- docs that describe obsolete active shell paths.

Expected code changes:

- Remove unused shell/header wrappers.
- Reduce `WidgetV2Shell` to a compatibility-only layout helper or delete it
  if no active route imports it.
- Remove unused CSS selectors.
- Update design-system and UI primitive docs to identify the single active
  shell/header path.

Risks:

- Removing CSS still used by compatibility or smoke-test routes.
- Breaking older tests that intentionally exercise compatibility surfaces.
- Accidentally changing catalog visibility while cleaning imports.

Required tests:

- `rg` for old shell class/import references;
- frontend typecheck and build;
- full Toolbelt validation;
- manual smoke for all Stable v0.1 product-facing widgets.

Acceptance criteria:

- `WidgetFrame` plus `ModuleShell` is the only active product shell path.
- `WidgetV2Shell` is not drawing a second product shell/header.
- No module has nested outer shell boxes.
- No widget IDs, registry entries, storage fields, or runtime behavior changed.

Rollback strategy:

- Restore the removed compatibility wrapper/CSS if an active route or test
  still depends on it.
- Keep module migrations that do not depend on the removed path.

Must not change:

- product-facing widget set;
- catalog visibility rules;
- storage/schema;
- runtime/execution behavior;
- backend/Tauri behavior.

## Module-by-module migration risk table

| Module | Current shell/header owner | Nesting severity | Behavior coupling risk | Visual migration risk | Recommended migration phase | Notes/blockers |
| --- | --- | --- | --- | --- | --- | --- |
| Agent Activity | `WidgetFrame`; local body header in `AgentActivityWidget` | Low | Low | Low | Phase 2 | Best first pilot. Body header mostly duplicates title/count state. |
| Notes | `WidgetFrame`; `NotesToolbar`; editor/list body controls | Medium | Medium | Medium | Phase 3 | Good second pilot. Keep list collapse and Save/Promote body-local. |
| Runbook Preview | `WidgetFrame`; local step/detail body | Low | Low | Low/Medium | Phase 4 | Preview/manual only. Do not add execution behavior. |
| Database / JDBC Preview | `WidgetFrame`; connector/query body sections | Medium | Medium | Medium | Phase 4 | Keep SQL validate/run preview and connector editing in body. |
| Finder | `WidgetFrame`; body pane headers and floating preview controls | Medium | Medium | Medium/High | Phase 4 or later | Low priority. Existing pane minimize/maximize vocabulary can conflict with shell minimize. |
| Agent Executor compatibility | `WidgetFrame`; run form/result body | Medium | Medium/High | Medium | Phase 4 only if explicitly requested | Supporting runtime/detail surface, not Stable v0.1 product widget. |
| Knowledge / Skills | Outer `WidgetFrame` plus inner `WidgetV2Shell` and Knowledge actions | Very high | High | High | Phase 5 | Double-shell offender. Must preserve `skill-library` compatibility and Knowledge APIs. |
| Terminal | `WidgetFrame`; Terminal session/pane controls inside body | High | High | High | Phase 5 | PTY/session/pane controls are workflow controls, not shell actions. Preserve output geometry. |
| Agent Queue / QueueV2 | `WidgetFrame`; Queue V2 command bar, lanes, details/drawers | High | Very high | High | Phase 5 | Execution/autorun/review state is sensitive. Keep task/item actions in body. |
| Workspace Agent | `WidgetFrame`; overloaded `WorkspaceAgentHeaderStatus` | High | Very high | High | Phase 5 | Header includes config/debug/body actions today. Must not change provider/Direct Work behavior. |
| Git compatibility surface | `WidgetFrame`; Git body review/commit controls | Medium | High | Medium | Phase 6 or explicit task | Supporting/compatibility surface. Do not broaden Git mutation scope. |

## First implementation prompt recommendation

The first implementation prompt should be Phase 1 only. It should not migrate a
module yet.

Recommended prompt:

```text
Implement Phase 1 of docs/MODULE_SHELL_HEADER_MIGRATION_PLAN.md only.

Add semantic module shell/header tokens in styles/tokens.css, shared
presentational CSS in styles/ui/widget.css, and a domain-free
design-system/widget/ModuleShell.tsx exporting ModuleShell, ModuleHeader, and
small presentational helpers. Export the component from design-system/index.ts.

Do not wire the component into product modules yet. Do not migrate any module.
Do not change WidgetHost, widget registry/catalog entries, runtime behavior,
storage/schema, Queue execution, Workspace Agent execution, Knowledge APIs, or
Terminal behavior. Add focused design-system tests for header grouping, state
tones, and body collapse rendering.
```

The first migration prompt after Phase 1 should target Agent Activity:

```text
Migrate Agent Activity only to the ModuleShell/Header path through WidgetFrame,
following Phase 2 of docs/MODULE_SHELL_HEADER_MIGRATION_PLAN.md. Preserve event
source behavior, row expansion, readable timeline behavior, widget IDs, logs,
and host actions. Keep the change visual/presentational only.
```

## Explicit non-goals

This migration plan does not authorize:

- creating `ModuleShell` or `ModuleHeader` in this audit task;
- migrating any module in this audit task;
- changing runtime behavior;
- changing Queue scheduler, execution, autorun, review, or assignment behavior;
- changing Workspace Agent provider, proposal, Direct Work, or execution
  behavior;
- changing Knowledge storage/API/import/retrieval behavior;
- changing Terminal PTY backend or session behavior;
- changing backend, Tauri commands, schemas, or storage;
- changing widget IDs, component keys, registry entries, or catalog visibility;
- adding natural-language routing;
- adding a new workbench shell path;
- expanding `WidgetV2Shell`;
- adding a Dock, view-mode persistence, external popout behavior, snapping, or
  layout editor behavior;
- moving task/item/session/proposal actions into the module shell header;
- adding new dependencies.
