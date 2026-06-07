# Widget V2 Runtime Intents Contract

## Purpose

This contract defines how future Widget V2 widgets express operator actions
without owning domain behavior.

It is docs-only. It does not add frontend behavior, backend/Tauri commands,
storage/schema changes, runtime execution, Workspace API changes, WidgetHost
rewrites, WorkbenchCanvas rewrites, widget migrations, new widget catalog
entries, or tests.

Widget V2 remains Planned architecture. Current widgets remain V1 /
compatibility surfaces governed by `docs/CURRENT_WIDGET_SURFACE.md` and their
task-specific contracts.

## Product Rule

Widget V2 widgets render state and send typed action intents.

Domain services own validation, persistence orchestration, runtime calls where
an existing domain contract allows them, and state transitions.

An intent is a structured request from a widget instance to the Workbench
runtime or an owning domain service. It is not a direct command executor, hidden
permission grant, cross-widget mutation shortcut, provider tool call, Terminal
command, Git operation, filesystem scanner, or Queue scheduler.

## WidgetV2ActionIntent

`WidgetV2ActionIntent` is the typed boundary between a Widget V2 surface and
the Workbench/domain service layer.

Conceptual shape:

```ts
type WidgetV2ActionIntent =
  | OpenPopupIntent
  | ClosePopupIntent
  | FocusWidgetIntent
  | SelectItemIntent
  | RequestDomainActionIntent
  | OpenInspectorIntent
  | OpenDrawerIntent;

type WidgetV2IntentEnvelope = {
  intent: WidgetV2ActionIntent;
  source: {
    workspaceId: string;
    workbenchId: string;
    widgetInstanceId: string;
    widgetKind: string;
  };
  correlationId: string;
  createdAt: string;
};
```

The exact implementation type may be narrower, but every intent must preserve
the same product boundary: explicit source identity, typed intent kind, bounded
payload, and visible handling.

### Open Popup

`openPopup` requests a widget-owned temporary popup or overlay.

Required fields:

- `popupId`: stable widget-local popup id.
- `popupKind`: selection, preview, confirmation, editor, or another approved
  widget-local popup kind.
- `anchor`: optional trigger or region reference.
- `payload`: bounded widget-local data needed to render the popup.

Rules:

- Opening a popup must not create a new widget instance.
- Opening a popup must not read hidden Workspace context.
- Popup content remains owned by the widget/domain service boundary.
- Confirmation popups may collect approval, but the approved domain action is a
  separate intent.

### Close Popup

`closePopup` requests closing a widget-owned popup.

Required fields:

- `popupId`: widget-local popup id.
- `reason`: user, escape, outside-click, completed, cancelled, or rejected.

Rules:

- Closing a popup is presentation state only.
- Closing a popup must not imply accepting a destructive or runtime action.
- Focus should return to the originating widget control when practical.

### Focus Widget

`focusWidget` requests Workbench presentation focus for a widget instance.

Required fields:

- `targetWidgetInstanceId`: explicit target widget instance id.
- `reason`: selection-change, handoff-preview, operator-request, or another
  bounded reason.

Rules:

- Focus is presentation state only.
- Focus must not create widgets, read target widget state, run commands, or
  mutate domain records.
- Cross-widget focus requires an explicit target; no broad Workspace search is
  implied.

### Select Item

`selectItem` requests selection of a domain item inside the source widget.

Required fields:

- `collection`: domain collection name, such as queue-task, knowledge-document,
  terminal-session, finder-entry, or agent-thread.
- `itemId`: stable id or approved root-relative path where the owning domain
  contract allows paths.
- `selectionMode`: single, multi, range, preview, or clear.

Rules:

- Selection is visible widget state.
- Selection must not automatically attach context to Workspace Agent, execute a
  Queue task, open Terminal, import a file, mutate Git, or read hidden content.
- If selection needs fresh domain data, the domain service validates and
  performs the read through its approved boundary.

### Request Domain Action

`requestDomainAction` sends an operator action request to the owning domain
service.

Required fields:

- `service`: one of the approved domain service names.
- `action`: service-owned action name.
- `input`: bounded structured input.
- `approval`: none, requested, approved, or rejected.
- `risk`: none, low, medium, or high.

Rules:

- Domain actions are not executed by the widget component.
- The domain service may reject missing approval, missing runtime support,
  invalid input, unsafe context, unsupported platform state, or contract
  violations.
- Runtime actions must remain explicit and visible in the owning surface.
- A domain action may produce visible state updates, logs, reports, or errors,
  but must not silently fall back to hidden behavior.

### Open Inspector

`openInspector` requests a widget-owned inspector for the current or supplied
selection.

Required fields:

- `inspectorId`: widget-local inspector id.
- `subject`: selected item, domain action, validation warning, run summary, or
  another approved subject.
- `mode`: read, review, edit, approval, or diagnostics.

Rules:

- Inspector state is presentation and review state.
- Inspector content may show bounded domain data supplied by the owning service.
- Opening an inspector must not approve, execute, dispatch, import, commit,
  push, or mutate by itself.

### Open Drawer

`openDrawer` requests a widget-owned drawer for secondary activity, logs,
history, diagnostics, or output summaries.

Required fields:

- `drawerId`: widget-local drawer id.
- `drawerKind`: activity, logs, history, diagnostics, output, or another
  approved drawer kind.
- `initialFilter`: optional bounded filter.

Rules:

- Drawers must not hide required approvals.
- Drawers must not become automatic execution consoles.
- Raw output, logs, file contents, prompts, provider traffic, or secrets must
  remain capped, redacted, and domain-owned.

## Domain Service Boundaries

Domain services are application/service boundaries, not React component
helpers. A Widget V2 component sends intents; the service validates and performs
the allowed operation.

Services may be implemented over existing Workspace APIs during migration. This
contract does not require a Workspace API split.

### QueueService

`QueueService` owns Agent Queue task state and Queue-owned workflow actions.

Owns:

- task create/list/read/update/delete where current Queue contracts allow it;
- assignment and explicit assigned-task start where current contracts allow it;
- selected-task run-link history and visible status refresh;
- Queue-owned Knowledge / Skills context refs and materialized prompt previews
  where current Knowledge Queue contracts allow it;
- Queue V2 board, inspector, capacity, dependency, and activity state when
  later implemented.

Does not own:

- hidden dispatch;
- backend scheduling;
- automatic acceptance;
- Terminal launch;
- Git mutation;
- provider tool execution;
- hidden Workspace context reads.

### KnowledgeService

`KnowledgeService` owns Knowledge / Skills records and review workflows.

Owns:

- Skill CRUD and review status;
- Knowledge Document CRUD/search/import for explicit supported files;
- selected Skill/Document attach requests where current contracts allow them;
- draft review accept/reject where current Knowledge contracts allow it;
- provenance, source metadata, lifecycle, enablement, and bounded summaries.

Does not own:

- hidden memory;
- automatic ingestion;
- folder scans or watchers;
- embeddings/vector search;
- team/server knowledge;
- automatic provider prompt injection;
- hidden Notes, file, Queue, Terminal, Git, or Executor reads.

### WorkspaceAgentService

`WorkspaceAgentService` owns Workspace Agent conversation/provider boundaries.

Owns:

- visible current-session conversation state;
- visible context attachment review;
- provider request preparation where current provider contracts allow it;
- safe proposal draft validation and review cards;
- explicit promotion requests to Queue, Notes, Knowledge, or other approved
  surfaces where current contracts allow them.

Does not own:

- hidden context reads;
- hidden widget state reads;
- provider tools;
- automatic Queue creation;
- Terminal control;
- Git mutation;
- JDBC execution;
- Agent Executor launch outside an explicit future contract.

### TerminalService

`TerminalService` owns Terminal-only shell/session behavior.

Owns:

- explicit Terminal PTY session lifecycle where current platform contracts
  allow it;
- stdin send, resize, Stop, Kill, and Close for the owning Terminal widget;
- explicit shell executable, argv, working directory, and session settings;
- collapsed legacy one-shot fallback where current compatibility contracts
  allow it.

Does not own:

- Script Runner behavior;
- Queue-triggered commands;
- Workspace Agent-triggered commands;
- hidden command execution;
- persistent PTY transcripts;
- Terminal output as hidden context for other widgets.

### FinderService

`FinderService` owns explicit file/project navigation.

Owns:

- explicit root approval;
- bounded non-recursive listing and column navigation;
- bounded file preview;
- explicit edit/save/cancel where current Finder contracts allow it;
- selected item state and Finder-owned preview presentation;
- Finder Git plugin reads and explicit manual Git actions where current Finder
  Git contracts allow them.

Does not own:

- hidden Workspace scanning;
- broad IDE indexing;
- root persistence unless later contracted;
- automatic context ingestion;
- Terminal launch;
- Queue creation;
- hidden Git operations;
- unsupported Git mutation.

### WorkspaceGitService

`WorkspaceGitService` is later and internal only.

It may become the internal service boundary behind Finder Git affordances or a
future approved Git product surface. It is not a Widget V2 product widget by
itself.

Owns later, only after explicit contract work:

- explicit-root Git status/diff/history review;
- Finder-owned Git plugin data;
- explicit manual local commit and push flows where approved.

Does not own now:

- standalone Git Widget V2 catalog insertion;
- hidden repository discovery;
- Workspace-wide scanning;
- polling or watching;
- fetch during read-only status collection;
- branch switching, reset, clean, stash, force push, auto-commit, or auto-push;
- direct Git mutation from Widget V2 UI outside an approved service action and
  operator confirmation.

## Action Examples

These examples define intent flow shape only. They do not implement behavior.

### QueueV2 Run Selected Task

The operator selects a Queue task and presses Run in QueueV2.

Intent sequence:

1. `selectItem` with `collection: "queue-task"` and the selected task id.
2. `openInspector` with `mode: "approval"` if the task requires review.
3. `requestDomainAction` with `service: "QueueService"`,
   `action: "startAssignedTask"`, selected task id, explicit assigned Executor
   reference where current contracts require it, and `approval: "approved"`.

Boundary:

- QueueService validates assignment, eligibility, current-session runtime
  support, and approval.
- QueueV2 does not call Agent Executor directly.
- QueueV2 does not launch Terminal, mutate Git, or auto-dispatch other tasks.

### QueueV2 Attach Knowledge

The operator attaches a selected Knowledge item to a Queue task.

Intent sequence:

1. `openPopup` or `openInspector` for visible Knowledge selection/review.
2. `requestDomainAction` with `service: "QueueService"`,
   `action: "attachKnowledgeContext"`, task id, Knowledge ref id, bounded
   summary/snapshot metadata, and `approval: "approved"`.

Boundary:

- QueueService owns durable task-context refs and materialized prompt preview
  where current contracts allow it.
- KnowledgeService may supply bounded visible metadata for selection.
- No hidden Knowledge search or automatic prompt injection occurs.

### KnowledgeV2 Import File

The operator chooses Import in KnowledgeV2 and selects one supported file.

Intent sequence:

1. `openPopup` for import source and scope review.
2. `requestDomainAction` with `service: "KnowledgeService"`,
   `action: "importFile"`, explicit file handle/path token where the platform
   allows it, desired scope, metadata, and `approval: "approved"`.

Boundary:

- KnowledgeService validates file type, size/caps, scope, and provenance.
- Import is one explicit plain text/Markdown file unless later contracts expand
  it.
- No folder scan, watcher, binary parsing, hidden ingestion, or automatic
  enablement beyond the explicit import choice occurs.

### WorkspaceAgentV2 Run Provider

The operator sends a Workspace Agent message through a configured provider path.

Intent sequence:

1. `openInspector` for visible context review if attachments or proposal drafts
   are present.
2. `requestDomainAction` with `service: "WorkspaceAgentService"`,
   `action: "runProvider"`, visible message/thread state, explicit visible
   attachments, `allowedTools: []`, and `approval` according to the provider
   contract.

Boundary:

- WorkspaceAgentService builds the provider request from visible approved
  context only.
- Provider output may render text and safe proposal drafts for review.
- Provider output does not execute actions, read hidden widgets, launch
  Terminal, mutate Git, dispatch Queue tasks, or run JDBC.

### TerminalV2 Start Shell

The operator presses Start in TerminalV2.

Intent sequence:

1. `openInspector` or `openPopup` for shell executable, argv, working directory,
   caps, and platform warning review when needed.
2. `requestDomainAction` with `service: "TerminalService"`,
   `action: "startShell"`, explicit shell config, terminal dimensions, and
   `approval: "approved"`.

Boundary:

- TerminalService validates the owning Terminal widget, platform support,
  working directory, caps, and shell config.
- TerminalV2 is the only initiating surface.
- QueueV2 and WorkspaceAgentV2 cannot start Terminal commands without a future
  explicit contract.

### FinderV2 Open Root

The operator approves a root in FinderV2.

Intent sequence:

1. `openPopup` for platform root picker or explicit approval review.
2. `requestDomainAction` with `service: "FinderService"`,
   `action: "openRoot"`, approved root handle/token, display label, and
   `approval: "approved"`.
3. `selectItem` for the opened root if the service returns an approved root
   session.

Boundary:

- FinderService owns approved-root session state.
- Opening a root does not persist the root unless a later contract allows it.
- Opening a root does not recursively scan, attach context, launch Terminal, or
  create Queue tasks.

## Safety Rules

Widget V2 runtime intents must preserve Hobit's operator-controlled Workbench
model.

- No hidden execution: intents never secretly run providers, Queue tasks,
  Agent Executor runs, Terminal commands, scripts, JDBC queries, Git commands,
  filesystem mutations, or network operations.
- No direct Git mutation from widget UI: Widget V2 components do not call Git
  mutation APIs directly. Future Git mutations must pass through an approved
  service action with explicit root, bounded target, visible review, and
  operator confirmation.
- No Terminal command from Queue or Agent without explicit future contract:
  QueueV2 and WorkspaceAgentV2 may not launch Terminal commands or write stdin
  through intents unless a later contract defines the visible approval-aware
  path.
- No hidden context: intents carry only explicit visible or approved context.
  They must not cause hidden reads from Notes, Knowledge, Finder, Terminal,
  Git, JDBC, Queue, Executor, logs, files, provider config, environment
  variables, secrets, or other widget state.
- No broad action bus: intent dispatch is not a general automation router.
  Each `requestDomainAction` names one owning service and one service-owned
  action.
- No fallback expansion: service rejection must be visible. Rejected or
  unsupported actions must not silently fall back to another runtime path.
- No capability laundering: one service must not perform another service's
  high-trust behavior unless an explicit current contract defines that
  delegation.

## Relationship To Current WidgetRuntimeContext

The current implemented `WidgetRuntimeContext` is a minimal V1-compatible
foundation. It carries shell-level widget identity and widget-local logs access
beside existing props. It does not own domain actions, hidden context reads,
execution, mutation, provider tools, routing, storage, or Workspace API
implementation.

Widget V2 runtime intents are the planned next vocabulary for typed action
dispatch. They should relate to the current context this way:

- Current `WidgetRuntimeContext` remains narrow and compatible.
- A future V2 context may expose `dispatchActionIntent(intent)` as a shell-level
  dispatcher, but the dispatcher must only route to Workbench presentation
  handlers or approved domain services.
- Domain services should be supplied through narrow adapters over existing
  Workspace APIs during migration, not by expanding the context into a global
  Workspace API bag.
- Existing V1 widget props and behavior remain unchanged until a future task
  explicitly migrates one widget or one capability.
- QueueV2, KnowledgeV2, WorkspaceAgentV2, TerminalV2, and FinderV2 should adopt
  intents only after their product contract, domain service boundary, visible
  state model, and validation plan are defined.

This contract extends the Widget V2 planning vocabulary. It does not authorize
current widget migration, source-code changes, runtime behavior, or new
capabilities by itself.
