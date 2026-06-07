# Widget Runtime Context Design

## Purpose

This document designs a staged migration away from broad
`widgetHostRenderProps` / `WidgetHost` prop coupling toward a narrower
`WidgetRuntimeContext` model.

This is docs-only design. It does not add frontend behavior, backend/Tauri
commands, storage/schema changes, widget migrations, new widget insertion
behavior, new runtime execution behavior, or tests.

## Problem

Current widget rendering keeps too much cross-domain wiring in shared host
files:

- `WidgetHost.tsx` resolves registry/component mapping, frame behavior, title
  normalization, logs, and render-prop assembly.
- `widgetHostRenderProps.ts` multiplexes domain-specific props for Workspace
  Agent, Queue, Executor, Knowledge / Skills, Terminal, Finder, Notes, JDBC,
  Git, Agent Activity, and shared actions.
- `WidgetRenderProps` acts as a large implicit frontend Widget API rather than
  a set of narrow widget-owned capabilities.
- Cross-widget handoffs are passed as direct callbacks or controller objects,
  which makes shared shell files participate in domain workflows.

The target is not to remove `WidgetHost`. `WidgetHost` remains the mapping
layer from persisted widget instances to registered React components. The
target is to stop making the host assemble every domain capability directly.

## WidgetRuntimeContext Concept

`WidgetRuntimeContext` is the per-widget runtime object supplied beside the
existing props during migration. It is scoped to one widget instance inside one
Workspace and exposes narrow, explicit APIs that a widget may use.

The context should be constructed by a Workbench runtime/provider layer near
the current host/canvas boundary, then consumed by widget bodies or
widget-specific compatibility adapters.

Conceptual shape:

```ts
type WidgetRuntimeContext = {
  identity: WidgetRuntimeIdentity;
  logs: WidgetLogsRuntimeApi;
  popup: WidgetPopupRuntimeApi;
  focus: WidgetFocusRuntimeApi;
  settings: WidgetSettingsRuntimeApi;
  router: WidgetEventHandoffRouter;
  capabilities: WidgetDomainCapabilities;
};
```

This shape is illustrative only. Implementation should start smaller than this
full type and add members only when a widget migration needs them.

### Widget Identity

Identity is always available and should remain cheap, serializable, and
non-domain-specific:

- `widgetInstanceId`
- `widgetDefinitionId`
- `workbenchId`
- `workspaceId`
- compatibility component key, when still needed by adapters

Identity must not imply hidden access to Workspace data. It only identifies the
current widget runtime owner.

### Logs API

The logs API owns widget-local log access currently spread through frame props:

- load current widget logs;
- refresh logs after explicit widget actions;
- append local session-only notices when a frontend-only adapter needs a
  visible status;
- expose loading/error state for the frame Logs panel.

It must preserve the current boundary: Terminal PTY output is session-only and
not widget logs, while Terminal one-shot fallback and Direct Work runs can use
persisted widget logs where already implemented.

### Popup API

The popup API centralizes shell-level popup affordances without taking over
domain policy:

- open anchored or floating shared popups through existing popup primitives;
- return focus to the trigger on close;
- close on Escape/outside pointer where appropriate;
- expose `alertdialog` only through a separate explicit destructive-confirm
  wrapper when designed.

It must not make popups responsible for command execution, hidden reads,
destructive action policy, or domain-specific validation. Widget-owned
content, such as Queue task forms or Terminal settings, remains domain-owned.

### Focus And Z-Order API

The focus/z-order API owns presentation requests that are currently close to
`WorkbenchCanvas` state:

- focus this widget;
- bring this widget to front in frontend-only floating mode;
- request opening a widget-owned floating/popup presentation;
- dock back or restore focus through existing presentation state.

It must not add real external OS/Tauri popout windows, Dock behavior,
Compact/Indicator modes, snapping, collision detection, or persisted presence
zones.

### Settings API

The settings API provides a narrow place for widget settings persistence and
session settings access when a widget has an explicit current contract for
those settings.

Initial use should be conservative:

- widget-local display/session settings that already exist in frontend state;
- persisted widget state writes already available through current workspace
  widget update APIs;
- no secrets;
- no environment variables;
- no hidden runtime configuration discovery.

Terminal shell executable/argv/working directory settings, Workspace Agent
working-directory/thread state, and Finder root approval should remain governed
by their current domain contracts. The settings API should adapt existing
state paths, not expand them.

### Event And Handoff Router

The event/handoff router replaces direct cross-widget callback threading with
typed visible requests:

- Queue task open request;
- Queue-to-Executor run handoff;
- Executor result metadata attach request;
- Workspace Agent visible composer-context attach request;
- Queue report card handoff to Workspace Agent;
- Git review handoff where retained compatibility paths still need it.

Router events must be explicit, typed, bounded, and current-session-only unless
an existing domain contract says otherwise. The router is not an automation
bus, backend scheduler, hidden queue dispatcher, provider tool layer, or
cross-widget mutation shortcut.

Each event should carry:

- source widget identity;
- target widget identity or target surface kind, when explicit;
- safe payload summary;
- correlation id for UI status and tests;
- no raw logs, full stdout/stderr, full file contents, secrets, provider
  credentials, hidden Workspace state, or unapproved context.

### Narrow Domain Capability APIs

Domain APIs should be optional and scoped. A widget receives only the
capabilities it needs, preferably through a domain adapter rather than the full
composed Workspace API.

Candidate capability groups:

- `queue`: task CRUD, assignment, explicit start, run-link refresh, Knowledge
  context attach/detach/materialization where current contracts allow it.
- `knowledge`: Skill CRUD, Knowledge Document CRUD/search/import, selected
  Skill/Document attach flows, draft review acceptance/rejection where current.
- `workspaceAgent`: provider request path, visible context attachment, proposal
  draft validation, approved visible proposal create actions for current safe
  types.
- `terminal`: PTY session lifecycle and legacy one-shot fallback actions
  already exposed to Terminal only.
- `finder`: approved-root session, bounded listing/preview/edit, Finder Git
  plugin actions already implemented.

Narrow domain APIs must not expose broad hidden Workspace reads, direct
Terminal control from Workspace Agent, hidden Queue dispatch, hidden file
access, Git mutation outside current Finder/compatibility commit/push paths,
JDBC execution outside the current widget-owned preview path, or provider
tools.

## Candidate Migration Domains

### Queue

Queue is a high-value domain because it currently depends on task APIs,
assignment, execution handoff, autorun/session state, Knowledge context, run
links, and report handoffs.

Do not start with Queue as the first runtime-context migration. First extract
or design the router and a small non-runtime capability adapter elsewhere.
When Queue is migrated, use compatibility wrappers so existing controller tests
continue to exercise the same behavior.

### Knowledge / Skills

Knowledge / Skills is a good early candidate for a small slice:

- info/help popup can move toward the shared popup API;
- Skill and Knowledge Document actions can be grouped behind a narrow
  `knowledge` capability;
- selected Skill/Document attach requests can route through the handoff router.

This domain is lower risk than Queue, Workspace Agent, Terminal, or Finder if
the first slice avoids draft review, Queue context, and provider paths.

### Workspace Agent

Workspace Agent is a major coupling hotspot and should migrate in staged
internal adapters:

- visible context adapter;
- provider request adapter;
- proposal validation/state adapter;
- create Queue task / create Note / create Knowledge / create Skill action
  adapters;
- Direct Work panel adapter;
- event router adapter for visible attachments and report cards.

No migration may add hidden context access, provider tools, direct widget
execution, automatic Queue creation, Terminal control, Git mutation, JDBC
execution, or Agent Executor launch outside current explicit paths.

### Terminal

Terminal should receive a Terminal-only capability surface:

- PTY create/read/write/resize/stop/kill/close;
- explicit working directory and shell settings already visible in the UI;
- legacy one-shot fallback actions behind the collapsed compatibility path.

Terminal migration must preserve the PTY/session-only output boundary and must
not persist PTY transcripts, route PTY output to Workspace Agent/Queue, add
tabs/splits/history, or turn Terminal into Script Runner behavior.

### Finder

Finder should receive a Finder-only capability surface:

- approved root state;
- bounded directory listing;
- bounded preview/edit/save/cancel;
- Finder Git status/diff/history/manual commit/manual push actions already
  current.

Finder migration must not add root persistence, recursive scanning, broad IDE
search/indexing, hidden Workspace Agent attachment, Terminal launch, Queue
creation, unsupported Git operations, or hidden file reads.

## Migration Plan

The migration must be staged. No big-bang rewrite is allowed.

### Stage 0: Freeze The Boundary

- Keep `WidgetHost`, `WidgetFrame`, `WorkbenchCanvas`, widget registry, and
  current props working.
- Document which props are shell props, domain props, and cross-widget handoff
  props before each implementation slice.
- Do not rename compatibility widget ids or component keys.
- Do not change current widget behavior while introducing context plumbing.

### Stage 1: Add Context Alongside Existing Props

- Introduce a minimal `WidgetRuntimeContext` provider/constructor.
- Pass the context beside existing `WidgetRenderProps`.
- Add no required consumers at first.
- Keep existing tests passing through the old prop path.
- Prefer a tiny first context shape: identity plus one shell-level API.

### Stage 2: Compatibility Wrappers

- Create per-widget compatibility adapters that map context members back into
  the existing props expected by the widget.
- Keep adapters close to the widget or in a small `widgetProps/` domain module.
- Avoid making `widgetHostRenderProps.ts` grow while migrating; new domain
  prop assembly should move into the adapter for the specific widget.

### Stage 3: Migrate One Widget At A Time

- Pick one low-risk widget or one low-risk capability inside a widget.
- Replace direct prop use with context or a domain capability hook.
- Keep behavior and visible UI unchanged.
- Keep semantic tests focused on the migrated capability.
- Do not migrate Queue, Workspace Agent, Terminal, and Finder in the same
  block.

### Stage 4: Extract Router From Direct Handoffs

- Move direct cross-widget callbacks into a typed event/handoff router.
- Start with current-session UI handoffs only.
- Keep payloads bounded and visible.
- Preserve existing Queue-to-Executor, Executor-to-Agent, Agent-to-Queue, and
  report-card behaviors exactly.

### Stage 5: Retire Migrated Prop Paths

- Remove old props only after all consumers for that domain have moved to the
  context/capability adapter.
- Delete compatibility wrappers in separate cleanup blocks after tests prove
  no widget depends on the old shape.
- Keep `WidgetRenderProps` shell-facing props small and stable.

## What Remains In WidgetHost

`WidgetHost` remains responsible for:

- resolving widget definition and component key through the registry;
- choosing the registered React component;
- rendering through the shared widget frame path;
- passing shell/frame props;
- compatibility title normalization for retained ids/components such as
  `interactive-agent`, `agent-run`, and `skill-library`;
- widget-local logs button/panel integration until logs move behind a proven
  context wrapper;
- defensive unsupported/unknown widget rendering.

`WidgetHost` should stay a host and adapter, not a domain workflow coordinator.

## What Moves Out

The following should migrate away from `WidgetHost` and
`widgetHostRenderProps.ts` over staged blocks:

- domain-specific create callbacks such as create Queue task, create Note,
  create Knowledge Document, and create Skill;
- direct cross-widget handoffs between Queue, Executor, Workspace Agent,
  Knowledge, Finder, and Git compatibility surfaces;
- large prop assembly blocks that know about unrelated widget domains;
- domain controller objects passed through the host only because the host is
  the common meeting point;
- settings and popup glue that can be supplied by a shared runtime context or
  a widget-local adapter;
- direct imports or switch branches that encode domain behavior rather than
  component lookup.

## Test Strategy

Testing should scale with migration risk.

For each implementation slice:

- Keep existing widget behavior tests passing before removing old props.
- Add focused unit tests for the new context constructor or adapter.
- Add router tests for event shape, bounded payloads, target selection, and
  ignored invalid events.
- Add regression tests proving no hidden side effects were introduced, such as
  no automatic Queue execution, no Terminal launch, no hidden Workspace Agent
  context read, and no unapproved Git/JDBC/file mutation.
- For shell APIs, test focus return, popup close behavior, log refresh, and
  z-order/focus requests without requiring domain widgets.
- For domain capability APIs, test through fake narrow APIs rather than the
  full Workspace API where possible.

Recommended validation by slice:

- docs-only design: `git status --short --branch`, `git diff --stat`,
  `git diff --check`;
- first frontend context plumbing: frontend typecheck plus targeted
  `widgetHostRenderProps` / `WidgetHost` tests;
- popup/log/focus shell slices: design-system and WidgetFrame tests;
- domain slices: affected widget tests plus typecheck;
- router extraction: handoff hook tests, affected Queue/Executor/Workspace
  Agent tests, and typecheck.

## Risks

- Context becoming another global bag. Mitigation: start with identity plus one
  narrow API and require domain capabilities to be optional.
- Hidden automation through router events. Mitigation: router events are
  requests for visible current-session handoffs, not execution commands.
- Compatibility wrappers living forever. Mitigation: each migrated domain gets
  a removal checklist and tests before old props are deleted.
- Queue and Workspace Agent changing behavior accidentally. Mitigation: avoid
  them as first pilots and preserve current visible proposal/Queue execution
  boundaries.
- Popup/settings abstraction overreach. Mitigation: shared shell APIs own
  presentation mechanics only; domain policy stays in domain widgets.
- Workspace API split churn. Mitigation: the runtime context can accept narrow
  views over the existing composed API before the underlying API file is split.
- Parallel conflicts. Mitigation: do not combine WorkbenchCanvas handoff
  extraction, WidgetHost render-prop cleanup, and major Queue/Workspace Agent
  work in one block.

## Blocked Files For First Implementation Slices

The following files are intentionally blocked for the first small migration
slice unless a future task explicitly scopes them:

- `apps/desktop/frontend/src/workbench/WorkbenchCanvas.tsx`
- `apps/desktop/frontend/src/workbench/WidgetHost.tsx`
- `apps/desktop/frontend/src/workbench/widgetHostRenderProps.ts`
- `apps/desktop/frontend/src/workbench/widgetRenderProps.ts`
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx`
- `apps/desktop/frontend/src/workbench/FinderWidget.tsx`
- `apps/desktop/frontend/src/workbench/TerminalPtyPanePanel.tsx`
- `apps/desktop/frontend/src/workbench/JdbcConnectorWidget.tsx`
- broad edits to `apps/desktop/frontend/src/styles/components.css`

Small implementation pilots should start below those hotspots where possible,
for example a leaf popup wrapper, a logs adapter, or one narrow domain
capability adapter with compatibility props preserved.

## Explicit Non-Goals

- No WidgetHost rewrite.
- No WorkbenchCanvas rewrite.
- No Workspace API split in this design block.
- No frontend behavior change.
- No backend/Tauri command change.
- No storage/schema change.
- No runtime execution behavior.
- No new widget implementation.
- No new widget catalog exposure.
- No Dock, external popout, view mode, snapping, auto-reflow, or persistence
  behavior.
- No hidden context access, hidden mutation, hidden execution, or automatic
  Queue creation.
