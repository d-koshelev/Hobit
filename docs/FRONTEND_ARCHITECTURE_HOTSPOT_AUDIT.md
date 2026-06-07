# Frontend Architecture Hotspot Audit

## 1. Executive summary

This inspect-only audit reviewed the requested frontend hotspots before Queue
v2, Knowledge production, Terminal production, and multi-provider Workspace
Agent work.

The main architecture risk is not one oversized file by itself. The risk is
that a small set of frontend files currently act as cross-widget routing,
runtime handoff, API, and rendering hubs:

- `WorkbenchCanvas.tsx` routes shell layout plus cross-widget handoffs for
  Workspace Agent, Queue, Agent Executor, Git review, and Agent Activity.
- `WidgetHost.tsx` imports every widget implementation and maps compatibility
  component keys to concrete React components.
- `widgetHostRenderProps.ts` centralizes widget-specific prop assembly and
  passes cross-widget controllers into individual widgets.
- `workspaceApiTypes.ts` is a single large API surface for Workspace lifecycle,
  Notes, Knowledge, JDBC, Queue, Git, Terminal, Executor, provider responses,
  and compatibility Agent Chat paths.
- `FinderWidget.tsx`, `InteractiveAgentPlaceholderWidget.tsx`, and the Queue
  controller layer mix UI rendering with current-session runtime/domain logic.
- `components.css` and `agent-queue.css` are large global styling surfaces that
  make widget-level visual changes difficult to isolate.

Before Queue v2 implementation, the highest-value cleanup is to split Queue
state/view/runtime boundaries and stop adding more Queue behavior through the
current controller and global CSS surfaces. Before Workspace Agent provider
abstraction, the highest-value cleanup is to extract provider conversation,
visible-context assembly, proposal validation, and Queue/Knowledge command
handling out of `InteractiveAgentPlaceholderWidget.tsx`.

## 2. Coupling map

Central coupling points:

- `apps/desktop/frontend/src/workbench/WorkbenchCanvas.tsx`
  - Owns canvas presentation, docked/floating state, layout width, popout drag,
    widget drag/resize entry points, Agent Executor run open requests, Queue
    item open requests, Workspace Agent context attach requests, Queue report
    cards, Agent Activity publication, Direct Work handoffs, Git review
    handoffs, and Queue API initialization.
  - Blocking risk: it is both Workbench shell and cross-widget event router.

- `apps/desktop/frontend/src/workbench/WidgetHost.tsx`
  - Imports all concrete widget components and keeps the component-key map.
  - Owns frame actions, presentation actions, title normalization for
    compatibility names, log loading, and render-prop creation.
  - Blocking risk: any new widget-level prop or shell affordance tends to touch
    the same file.

- `apps/desktop/frontend/src/workbench/widgetHostRenderProps.ts`
  - Central prop multiplexer for Workspace Agent, Queue, Terminal, Git, Notes,
    Knowledge / Skills, JDBC, Agent Activity, and shared widget actions.
  - Blocking risk: it becomes the implicit frontend Widget API instead of a
    typed per-widget adapter boundary.

- `apps/desktop/frontend/src/workspace/workspaceApiTypes.ts`
  - Monolithic `WorkspaceApi` type contains unrelated domains: Workspace,
    Workbench widgets/logs, Notes, Skills, Knowledge, JDBC, Queue, Executor,
    Git, Workspace Git, Terminal, Direct Work, provider, and compatibility
    Agent Chat APIs.
  - Blocking risk: every production domain change competes in one shared type.

- `apps/desktop/frontend/src/workbench/widgetRegistry.ts` and
  `apps/desktop/frontend/src/workbench/catalogTemplates.ts`
  - Registry includes Agent Activity, Agent Executor, Queue, Workspace Agent,
    Finder, Git compatibility, Terminal, Notes, Knowledge / Skills, JDBC, and
    Runbook. Catalog excludes Agent Executor and Git through template choice
    and registry user-facing filtering.
  - Product risk: Agent Activity remains user-facing in registry/catalog, while
    Agent Executor and Git are registry-visible compatibility definitions but
    filtered from normal catalog exposure.

## 3. Workbench shell risks

`WorkbenchCanvas.tsx` is a Workbench shell hotspot because it coordinates
layout and widget-to-widget routing in one component. The current responsibilities
include:

- docked widget filtering and layout edit behavior;
- floating overlay state and drag/clamp behavior;
- widget drag/resize entry points;
- Direct Work run handoff and Git review handoff state;
- Queue item open targeting;
- Workspace Agent visible-context attach targeting;
- Queue report card handoff to Workspace Agent;
- Agent Activity event filtering and publication;
- Queue API hook construction.

This is a parallel-work blocker because Queue v2, Agent Activity refinement,
Workspace Agent provider work, and widget shell/presentation work all have good
reasons to touch it. Future changes should move cross-widget requests into a
small Workbench event/router hook and keep `WorkbenchCanvas.tsx` focused on
canvas presentation.

## 4. Widget runtime risks

Files mixing visualization with runtime or domain logic:

- `FinderWidget.tsx`
  - Combines root selection, filesystem handle state, column navigation,
    preview state, edit/save/cancel flows, Finder Git status/diff/history,
    manual commit, manual push, and many subcomponents in one file.
  - This violates the desired direction that widgets/panes should primarily
    visualize state and call explicit APIs. The widget is currently also the
    Finder session/controller and Finder Git controller.

- `InteractiveAgentPlaceholderWidget.tsx`
  - Combines transcript state, local proposal generation, provider request
    handling, proposal state transitions, Queue commands, Knowledge commands,
    Direct Work controller wiring, visible attached context, activity pane
    filtering, Queue report cards, and creation actions for Queue/Notes/
    Knowledge/Skills.
  - This is the largest blocker for multi-provider Workspace Agent work.

- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts` and
  related hooks/actions
  - Combine load state, task mutation, assignment, run start, sequential runner,
    autorun, Knowledge context attach/materialization, report cards, worker
    actions, run metadata, and UI controller shape.
  - Queue has model files, but the controller surface remains a high-coupling
    integration point.

- `TerminalPtyPanePanel.tsx` and `TerminalRunCommandPanel.tsx`
  - Hold UI, input validation, runtime request construction, polling,
    lifecycle state, output copy/clear behavior, and fallback command behavior.
  - The xterm surface is better isolated, but PTY session orchestration remains
    inside the pane component.

## 5. Workspace API risks

`workspaceApiTypes.ts` should be split before major production work. Suggested
interfaces:

- `WorkspaceLifecycleApi`: workspace CRUD, open, directory selection, summary.
- `WorkbenchStateApi`: workbench state, widget add/update/layout/delete/logs.
- `NotesApi`.
- `KnowledgeSkillsApi`.
- `JdbcApi`.
- `AgentQueueApi`.
- `AgentExecutorApi`.
- `GitReviewApi` and `WorkspaceGitApi`.
- `TerminalApi`.
- `WorkspaceAgentProviderApi`.
- `CompatibilityAgentChatApi` for retained proposal-era paths.

The split does not require changing runtime behavior. It would reduce the
blast radius of Queue v2, Knowledge production, Terminal production, and
provider abstraction by allowing widgets/hooks to depend on narrow capability
interfaces.

## 6. Queue risks

Queue has already grown into several interdependent layers:

- controller/view model: `useAgentQueueController.ts`,
  `agentQueueControllerTypes.ts`, `agentQueueControllerViewModel.ts`,
  `agentQueueControllerDerivedState.ts`, `agentQueueControllerHelpers.ts`;
- task mutation hooks: `useAgentQueueTaskActions.ts`,
  `useAgentQueueWorkerActions.ts`, `useAgentQueueTagActions.ts`,
  `useAgentQueueRunActions.ts`;
- runtime/session models: `queueRunner.ts`,
  `useAgentQueueSequentialRunner.ts`,
  `useAgentQueueAutonomousRunner.ts`,
  `agentQueueAutonomousRunnerModel.ts`,
  `agentQueueSchedulerModel.ts`;
- board/flow planning models: `agentQueueFlowMapModel.ts`,
  `agentQueueExecutionPlanModel.ts`;
- Widget API models: `agentQueueWidgetApi.ts`,
  `agentQueueWidgetSnapshotModel.ts`;
- global styling: `agent-queue.css`.

What must be fixed before Queue v2:

- Define the Queue v2 view model as a pure snapshot/selector layer before
  adding board lanes, inspector state, capacity, dependencies, or activity
  drawer UI.
- Split controller actions into task CRUD, assignment, execution/run links,
  Knowledge context, workers/capacity, and report/review actions.
- Keep Queue v2 board rendering separate from current execution/autorun hooks.
- Move lane/inspector/activity CSS into smaller Queue-specific modules or at
  least structured sections with strict class ownership.
- Avoid adding new Queue v2 behavior through `WorkbenchCanvas.tsx` handoff
  state unless the handoff is first abstracted.

## 7. Finder risks

`FinderWidget.tsx` is a major hotspot. It currently contains the Finder UI,
session state, file preview/edit logic, Git plugin logic, commit UI, push UI,
history panel, helpers, and many nested components.

Risks:

- Finder production work, Finder Git work, and future Workspace Agent visible
  context work would all touch the same file.
- The widget owns too much runtime/session state for a visualization surface.
- Future safe attach/edit/Git plugin work could accidentally create hidden
  read or mutation paths if not isolated behind explicit Finder API adapters.

Recommended split:

- `useFinderSessionController` for root/columns/selection/preview/edit state.
- `useFinderGitController` for status/diff/history/commit/push state.
- `FinderColumns`, `FinderPreviewPane`, `FinderEditPane`,
  `FinderGitPanel`, `FinderGitCommitPanel`, and `FinderGitHistoryPanel`.
- Keep file helpers in `FinderWidget.helpers.ts` or a `finder/` folder.

## 8. Workspace Agent risks

`InteractiveAgentPlaceholderWidget.tsx` is not just a visual widget. It is the
current Workspace Agent session controller, proposal controller, provider
request coordinator, Queue command handler, Knowledge command handler, Direct
Work UI bridge, and report-card receiver.

What must be fixed before Workspace Agent provider abstraction:

- Extract provider request assembly and response normalization into a
  provider-facing controller/hook.
- Extract visible-context assembly into a small typed module that can be
  audited independently.
- Keep proposal validation and proposal state transitions outside the main
  component.
- Keep Queue command parsing/execution and Knowledge command handling behind
  narrow command adapters.
- Keep Direct Work state separate from provider state so adding providers does
  not create hidden execution or queue paths.

Agent Activity risk:

- Agent Activity is currently a product-facing registry/catalog surface and a
  readable current-session timeline. It is useful, but it can become a product
  ambiguity risk if future work turns it into a raw executor log browser,
  stored history surface, or control surface. Keep it visualization-only and
  current-session-only unless a future contract explicitly changes that.

## 9. Terminal risks

Terminal is better factored than Finder and Queue, but production hardening has
two hotspots:

- `TerminalPtyPanePanel.tsx`
  - Owns PTY session lifecycle, polling, settings drafts, validation, start,
    stdin, resize, stop, kill, close, refresh, copy, clear, auto-start, and
    fallback visibility state.
- `TerminalXtermSurface.tsx`
  - Handles xterm lifecycle, fit/resize, input forwarding, output chunk writes,
    visible text extraction, and theme extraction.

Output performance risk:

- PTY output is chunk-filtered and written into xterm, which is the right
  rendering boundary, but polling/session state still lives in the pane. Future
  production work should avoid persisting transcripts or routing output through
  widget logs unless explicitly contracted.

Recommended split:

- `useTerminalPtySessionController` for lifecycle/polling/actions.
- `terminalPtyInputModel.ts` for shell args, numeric validation, defaults.
- Keep xterm as a rendering adapter and avoid adding domain logic there.

## 10. CSS/design-system risks

`components.css` and `agent-queue.css` are large global surfaces:

- `components.css` is a broad shared component/style file, so unrelated widget
  changes can collide or create accidental visual drift.
- `agent-queue.css` is large enough that Queue v2 board, inspector, activity,
  worker, report, and execution styling could become difficult to maintain if
  new rules are appended without structure.

Risks:

- Parallel UI work will conflict frequently.
- Widget-specific class naming is the only practical isolation layer.
- Design-system changes are hard to audit because global CSS can affect many
  surfaces.

Recommended CSS blocks:

- Split Queue CSS by surface: board, inspector/details, workers/capacity,
  activity, reports/review, and shared Queue primitives.
- Move repeated widget primitives into design-system components only when they
  are genuinely shared.
- Keep Finder and Terminal production styling out of `components.css` unless
  it is a reusable primitive.

## 11. Recommended refactor blocks

1. Queue v2 readiness split
   - Target files: Queue controller/action/view-model files and
     `agent-queue.css`.
   - Outcome: pure Queue v2 snapshot/selectors, separated task/worker/run/
     context/report actions, no new runtime behavior.

2. Workspace API interface split
   - Target file: `workspaceApiTypes.ts`.
   - Outcome: narrow domain API interfaces plus a composed `WorkspaceApi`.
     This enables parallel Queue, Knowledge, Terminal, Git, and provider work.

3. Workbench handoff router extraction
   - Target files: `WorkbenchCanvas.tsx`, `WidgetHost.tsx`,
     `widgetHostRenderProps.ts`.
   - Outcome: shell presentation stays in canvas; cross-widget handoff requests
     move to a typed router/hook.

4. Workspace Agent provider-controller split
   - Target file: `InteractiveAgentPlaceholderWidget.tsx` and direct imports.
   - Outcome: provider request path, visible context, proposal state, Queue
     commands, Knowledge commands, and Direct Work wiring are separated.

5. Finder controller/component split
   - Target file: `FinderWidget.tsx`.
   - Outcome: Finder session controller, Finder Git controller, and focused
     visual components.

6. Terminal controller split
   - Target files: `TerminalPtyPanePanel.tsx`,
     `TerminalRunCommandPanel.tsx`, `TerminalXtermSurface.tsx`.
   - Outcome: PTY lifecycle/action state separated from rendering, xterm kept
     as the terminal rendering adapter.

7. Registry/catalog exposure audit
   - Target files: `widgetRegistry.ts`, `catalogTemplates.ts`,
     WidgetHost mapping.
   - Outcome: preserve compatibility definitions while making product catalog
     exposure explicit and easy to verify.

## 12. Safe parallelization map

Can proceed in parallel:

- Queue v2 model/selectors and Queue CSS partitioning, if no Queue runtime
  behavior is added.
- Workspace API type splitting, if runtime implementations continue satisfying
  the composed API.
- Finder component split, if no Finder API behavior changes.
- Terminal controller extraction, if PTY/session behavior and output semantics
  remain unchanged.
- Registry/catalog exposure audit, if it remains docs or product-surface
  verification only.

Should not proceed in parallel without coordination:

- Queue v2 implementation and Workspace Agent Queue command/provider work,
  because both touch Queue task shape, handoffs, and visible context.
- WorkbenchCanvas handoff extraction and WidgetHost render-prop changes,
  because both affect all widgets.
- Knowledge production and Queue context durability work, because current Queue
  Knowledge context is frontend-local/current-session in existing contracts.
- Terminal production output changes and Agent Activity changes, because both
  can blur runtime-output visualization boundaries.

Can wait:

- Full Finder production split, unless Finder is part of the immediate Queue v2
  or Knowledge source-ref implementation.
- Terminal production refactor beyond PTY controller extraction.
- Global CSS full redesign; do targeted CSS ownership splits first.
- Agent Activity product repositioning, as long as it stays current-session
  visualization-only and does not become stored execution history or controls.
- Agent Executor/Git compatibility cleanup, unless catalog exposure or Queue
  run-link behavior changes.
