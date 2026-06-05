# Universal Widget Shell Contract

## Purpose

This contract defines the universal widget shell and pane layout model for
Hobit.

The model separates three responsibilities:

- Widget shell: the Workbench-owned container for one WidgetInstance.
- Workspace API: the app-native owner of widget logic, state, actions, events,
  evidence, and safety policy.
- Pane: a visualization of safe Workspace API state, selected evidence, logs,
  or action inputs inside the widget shell.

This is a docs/type-design contract only. It does not implement frontend UI,
backend or Tauri commands, Rust or TypeScript types, storage/schema changes,
Finder, Dock, pane layout persistence, Terminal split panes, Workspace Agent
tools, provider tool mode, runtime execution, or widget behavior changes.

For current implemented behavior, use `docs/CURRENT_WIDGET_SURFACE.md`. For
Workspace Widget API semantics, use `docs/WORKSPACE_WIDGET_API_CONTRACT.md`.
For widget identity, lifecycle, view modes, and presence zones, use
`docs/WIDGET_CONTRACT.md`.

## Core Rule

Widgets are visual shells over Workspace APIs.

A widget must not become the private owner of product logic simply because it
renders a complex UI. The WidgetInstance owns identity and presentation. The
Workspace API owns durable state, capability policy, action routing, events,
evidence, and logs. Panes render and interact with that API through bounded,
typed, app-native calls.

Universal responsibility split:

- Widget = shell/container for one WidgetInstance in a Workbench.
- Workspace API = logic, durable state, capability policy, actions, events,
  evidence, logs, and semantic test hooks.
- Pane = visualization and input surface over safe Workspace API state,
  selected evidence, bounded logs, or typed action forms.

```text
Workspace API
  -> safe state snapshot / evidence / logs / action forms
  -> Widget shell
  -> Pane visualizations
  -> app-native action requests back to Workspace API
```

Panes must not use shell commands, direct SQLite writes, filesystem mutation,
DOM scraping, localStorage mutation, direct React state imports, or provider
tool calls as substitutes for Workspace APIs.

## Universal Widget Shell

The widget shell is the outer container for one WidgetInstance.

It owns:

- widget instance identity;
- title and compact status;
- Workbench position, size, floating state, and future presence-zone state;
- the widget header/meta zone;
- pane layout composition inside the widget;
- widget-local logs access;
- visible unsupported/error state;
- action affordances that route to the owning Workspace API;
- presentation state such as selected pane, pane sizes, and pane visibility.

It does not own:

- domain logic;
- durable resource state such as Queue tasks, notes, Finder selections, Git
  status, Terminal sessions, or Agent conversations;
- hidden AI-readable context;
- execution or mutation bypasses;
- cross-widget direct calls.

The shell remains one WidgetInstance when panes are rearranged, minimized,
maximized, collapsed, hidden, floated, docked, or moved in a future presence
zone.

Shell state is presentation state. It may remember which pane is selected,
collapsed, minimized, maximized, hidden, or resized, but it must not become the
source of truth for Queue tasks, Finder selections, Terminal sessions,
Workspace Agent conversations, Git status, Notes, Knowledge records, JDBC
connectors, or any other domain resource.

## Workspace API Ownership

The Workspace API is the logic/state/action boundary behind a widget shell.

It owns:

- identity and capability discovery;
- safe state snapshots;
- action validation and routing;
- local mutation rules;
- execution and external-effect policy;
- events;
- evidence and log references;
- selected-context and AI-readable context rules;
- semantic test hooks where defined.

Pane controls are UI affordances for Workspace API actions. They are not a
separate control plane. A pane can request a list refresh, selection, save,
start, stop, preview, or run only when the corresponding Workspace API action
exists and the operator or future explicit policy is allowed to request it.

## Pane Model

A pane is a named visualization inside a widget shell.

Conceptual pane fields:

```text
WidgetPane:
  paneId
  title
  type
  state
  role
  displayLevel
  source
  selectionOrFocus
  capsAndRedactions
  actionAffordances
```

These fields are conceptual only. They do not define storage schema, DTOs,
Rust structs, TypeScript interfaces, frontend components, or current behavior.

Pane responsibilities:

- render safe Workspace API state;
- render selected evidence or bounded log summaries;
- collect typed action input where appropriate;
- expose clear selection and focus;
- show caps, redactions, unsupported runtime states, and errors visibly;
- preserve WidgetInstance identity and Workspace scope.

Pane non-responsibilities:

- owning durable domain state;
- reaching into other widgets;
- executing hidden actions;
- creating Queue tasks automatically;
- reading hidden context;
- storing secrets;
- rendering raw unbounded logs, diffs, Terminal buffers, SQL results, or
  Executor payloads by default.

## Pane States

Pane state is presentation state inside one widget shell. It is distinct from
widget lifecycle state, WidgetRun status, widget view mode, presence zone, and
domain state.

Allowed pane states:

- `normal`: the pane is visible and participates in the current shell layout.
- `minimized`: the pane is reduced to a compact tab, strip, or header inside
  the shell. Its selection and safe state are preserved.
- `maximized`: the pane takes the primary area inside the same widget shell for
  focused work. It does not become a new widget instance, full-screen app, Dock
  item, or external window by itself.
- `collapsed`: the pane header or summary remains visible, while the pane body
  is hidden. Collapsed panes may show compact counts, status, or warnings.
- `hidden`: the pane is not rendered in the current composition because it is
  not relevant, not configured, unsupported, or intentionally hidden by the
  operator. Hidden does not delete state or grant hidden execution.

Pane state examples:

- A Queue task details pane can be collapsed while task data remains owned by
  the Queue Workspace API.
- A Finder preview pane can be hidden before a file is selected without
  clearing the Finder selection.
- A Terminal settings pane can be minimized while the PTY pane remains normal.
- A Workspace Agent proposal/details pane can be maximized for review without
  granting extra tool access or hidden context.

Rules:

- Pane state changes must not create or delete WidgetInstances.
- Pane state changes must not mutate Workspace API domain state unless an
  explicit Workspace API action is invoked.
- Hidden and collapsed panes must not silently refresh, execute, run agents, or
  mutate data.
- Maximizing a pane is focus within the widget shell, not permission to expose
  raw or sensitive data.
- Material risk, failure, blocked, or unsupported states must remain visible
  through the shell or another visible pane summary when a detailed pane is
  collapsed, minimized, or hidden.

## Pane Types

Pane type describes the primary visualization pattern, not a widget definition.
One widget may combine several pane types, and the same pane type may appear in
many widgets.

- `list`: flat collection of records, tasks, messages, runs, notes, files, or
  results.
- `tree`: hierarchical navigation such as directories, grouped resources, or
  nested work items.
- `columns`: multi-column navigation where selection in one column scopes the
  next.
- `preview`: bounded preview of selected content, output, file text, SQL
  result, artifact, or message.
- `details`: selected item metadata, editable fields, decision context, or
  status.
- `diff`: bounded comparison view for file, text, config, or future proposal
  changes.
- `history`: ordered durable or session-scoped records such as runs, commits,
  prior selections, or task transitions.
- `terminal`: interactive terminal/session visualization owned by a Terminal
  Workspace API. This pane type does not imply Terminal split panes, tabs,
  persistent transcripts, or agent-controlled Terminal execution.
- `logs`: bounded widget-local logs, lifecycle traces, validation output, or
  run summaries.
- `timeline`: chronological activity or event stream, usually compact and
  expandable.
- `form`: typed inputs for an app-native action request, configuration, filter,
  or explicit operator command.

Pane type must not weaken the owning widget contract. For example, a `terminal`
pane inside Terminal remains governed by the Terminal PTY contract, and a
`diff` pane inside Git remains bounded by the Git contract.

Pane types are intentionally generic. A `list` pane in Queue, a `list` pane in
Notes, and a `list` pane in Finder can share presentation vocabulary while
still using different Workspace APIs, safety policy, actions, events, and
domain contracts.

## Layout Composition

Pane layout should be described as composition inside the widget shell.

Common compositions:

- single primary pane;
- navigation plus details;
- list plus preview;
- tree plus columns plus preview;
- form plus result preview;
- timeline plus details;
- terminal plus logs or session details.

Layout rules:

- Each pane should have one responsibility.
- The shell should avoid decorative box-inside-box composition.
- Pane labels should be short and stable.
- Panes should expose only what the operator needs for the current display
  level.
- Raw/debug panes belong in Full / Expert surfaces unless raw output is the
  widget's primary purpose.
- Pane composition must preserve WidgetHost/registry rendering and must not
  hardcode widgets directly into WorkbenchCanvas.

## Relationship To View Modes And Presence Zones

Pane state is not the same as widget view mode.

- Widget view mode controls rendered density of the whole WidgetInstance:
  Full, Compact, or Indicator.
- Presence zone controls where the WidgetInstance appears: canvas, floating,
  future Dock, or future external window.
- Pane state controls visualization inside the widget shell: normal,
  minimized, maximized, collapsed, or hidden.

Changing any of these presentation properties must preserve widget identity,
state, configuration, inputs, logs, results, Workspace ownership, and approval
rules.

## Examples

These examples describe shell/pane composition. They do not implement new UI,
APIs, storage, runtime behavior, or widget behavior changes.

### Finder

Status: future Stable v0.1 gap example. Finder is not an implemented current
widget. Future Finder behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`, `docs/FINDER_WIDGET_API_CONTRACT.md`, and
`docs/FINDER_UX_CONTRACT.md`.

Shell:

- `finder` WidgetInstance for one approved Workspace/project scope.
- Header shows approved root label, current selection status, and unsupported
  runtime state when applicable.

Workspace API:

- owns approved root selection, bounded listing, item selection, file preview,
  edit draft/save/cancel state, Finder Git status/diff/history/manual
  commit/manual push actions, caps, redaction, and events.

Pane composition:

- `tree` for approved root/directory hierarchy;
- `columns` or `list` for bounded entries;
- `preview` for selected text/file preview with caps;
- `diff` for selected-file Finder Git diff preview;
- `history` for bounded Git history when loaded;
- `details` for selected item metadata;

Safety:

- no hidden filesystem scan;
- no shell-backed file operations;
- no automatic Workspace Agent context ingestion;
- file preview and diff preview are selected and capped;
- manual push is explicit only, with no force push, push-all, hidden push,
  automatic push, reset, clean, stash, or branch management.

### Agent Queue

Shell:

- one visible Queue widget view over the canonical Workspace Queue ledger.
- Header shows task counts, selected task status, runner/autorun status where
  current contracts allow it, and blocked/error summary.

Workspace API:

- owns task create/list/read/update/delete, assignment, safe run-link metadata,
  runner/autorun actions where implemented, events, and safety policy.

Pane composition:

- `list` for tasks;
- `details` for selected task fields and review state;
- `history` for selected task run-link history;
- `timeline` for selected task status transitions or activity;
- `form` for explicit create/update/assignment actions;
- `logs` only for bounded Queue-owned summaries, not raw Executor payloads.

Safety:

- Queue panes do not read raw Executor logs by default;
- selected task details do not start execution without an explicit allowed
  action;
- no hidden dispatch or automatic acceptance is created by pane layout.

### Workspace Agent

Shell:

- Workspace Agent WidgetInstance using the existing `interactive-agent`
  compatibility identity until explicit migration work.
- Header shows agent/session status, selected working directory where current
  behavior allows it, and proposal/review state.

Workspace API:

- owns visible chat/proposal context, provider request boundary, allowed tools
  policy, safe proposal validation, visible attachments, and action handoffs
  that current contracts permit.

Pane composition:

- `timeline` or `list` for visible conversation messages;
- `form` for composer input and explicit provider/send controls;
- `details` for proposal cards, visible attachments, or outcome review;
- `history` for current-session thread/run references where implemented;
- `logs` for bounded run/provider status summaries when available.

Safety:

- panes do not read hidden Workspace state;
- panes do not create Queue tasks, Notes, Skills, or Knowledge Documents
  without approved visible proposal flow plus explicit create action;
- provider calls keep `allowed_tools: []` unless a later approved contract
  changes that boundary.

### Terminal

Shell:

- Terminal WidgetInstance for an explicit operator-controlled command surface.
- Header shows session status, shell/working-directory summary, and
  unsupported platform state when applicable.

Workspace API:

- owns PTY session creation, stdin send, resize, stop, kill, close, and
  session-only buffer rules where current Terminal contracts implement them.

Pane composition:

- `terminal` for the xterm/PTY visualization;
- `form` for collapsed or visible session settings and explicit start inputs;
- `logs` for bounded lifecycle summaries or the collapsed one-shot fallback
  records where current behavior allows them;
- `details` for session status, platform errors, caps, and safety copy.

Safety:

- the `terminal` pane is not a general script runner;
- pane layout does not add tabs, split panes, persistent transcripts, command
  history, Workspace Agent control, Queue-triggered execution, or hidden
  execution;
- PTY output remains session-only and is not AI context by default.

## Semantic Testing Implication

Semantic tests should target Workspace API behavior, then assert pane-visible
state through safe snapshots or documented UI semantics.

Preferred test shape:

1. Arrange fixture state through an app-native Workspace/widget test hook where
   one exists.
2. Call a Workspace API action with typed input.
3. Observe events and safe state snapshots.
4. Assert that the shell/pane model can represent the resulting state, caps,
   redactions, errors, and available actions.

Tests must not prove widget behavior by scraping private pane implementation
details, mutating DOM-only state, or relying on shell commands as product
control paths.

## Non-Goals

This contract does not implement:

- frontend pane components;
- pane layout persistence;
- pane drag-and-drop;
- split panes for Terminal;
- Dock, Compact, or Indicator behavior;
- true external popout windows;
- new Workspace APIs;
- backend or Tauri commands;
- Rust or TypeScript type definitions;
- storage/schema changes;
- Finder behavior changes;
- Queue runtime changes;
- Workspace Agent tool execution;
- provider tools;
- Git, JDBC, Notes, Terminal, Agent Executor, Agent Activity, or Runbook
  behavior changes;
- hidden context access;
- hidden execution;
- hidden mutation.
