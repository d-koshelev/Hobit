# Widget Unification Contract

## Purpose

This contract defines the shared widget shell and layout contract for Hobit
before broad WidgetHost, WorkbenchCanvas, or per-widget UI refactor work begins.

It is a docs-only contract. It does not implement frontend components, backend
or Tauri commands, storage/schema changes, runtime behavior, WidgetHost
rewrites, Workspace API splits, or visual redesigns.

For current implemented behavior, use `docs/CURRENT_WIDGET_SURFACE.md`. For
widget identity, lifecycle, view modes, and presence zones, use
`docs/WIDGET_CONTRACT.md`. For shell and pane vocabulary, use
`docs/UNIVERSAL_WIDGET_SHELL_CONTRACT.md`.

## Core Rule

Every widget should render inside one shared WidgetFrame and use shared layout
zones before adding widget-specific chrome.

Widget-specific UI belongs in the widget's content zones. Cross-widget
behavior such as title, compact status, logs, settings, removal, focus,
z-order, resize, and informational help belongs in shared primitives.

## WidgetFrame Contract

WidgetFrame is the shared outer surface for one WidgetInstance.

WidgetFrame owns:

- widget title using the preferred product-facing name while preserving
  compatibility ids internally;
- compact status showing the most important current state, count, warning, or
  unsupported-runtime marker;
- an info icon that opens WidgetInfo;
- widget-local logs access;
- widget settings access when the widget has configurable operator-visible
  settings;
- explicit remove action with the existing confirmation and ownership rules;
- focus and z-order affordances for docked and floating presentation;
- move and resize handles where current Workbench layout rules allow them;
- layout lock compliance;
- floating/dock-back affordances where current presentation behavior supports
  them;
- visible error or unsupported state summary when the widget cannot perform
  its normal current behavior.

WidgetFrame does not own:

- domain behavior;
- hidden reads of widget state;
- hidden mutation;
- runtime execution;
- cross-widget direct calls;
- Workspace API implementation;
- widget-specific persistent data models.

The widget header is the top meta zone of one continuous widget surface. It
must not become a detached card or separate visual object.

## Resize And Focus Behavior

Resize and movement are Workbench presentation behavior, not widget behavior.

Rules:

- resizing preserves the same WidgetInstance identity;
- resizing must respect current minimum-size metadata and layout lock rules;
- resizing must not trigger hidden refresh, execution, or mutation;
- focus changes may update visual stacking or active-widget state, but must not
  grant additional context access or start work;
- z-order changes must remain presentation-only;
- floating and docking preserve widget state, logs, inputs, results,
  Workspace scope, and approval boundaries.

## Widget Layout Zones

Widgets should compose their content through a small set of shared zones.

### Header

The Header is WidgetFrame-owned. It contains title, compact status, info,
logs, settings, remove, focus, and presentation controls.

It should not contain widget-specific workflows except for short status and
globally shared frame actions.

### Toolbar / Command Row

The toolbar or command row contains the primary explicit controls for the
widget's current display level.

Examples include create, save, refresh, run, stop, filter, attach, assign, or
review controls where the owning widget contract already allows them.

Rules:

- commands must be explicit and visible;
- risky actions must preserve existing approval or confirmation rules;
- disabled or unsupported actions should explain status through WidgetInfo,
  settings, inline errors, or a popup, not persistent help banners;
- the command row must not become a dumping ground for debug controls.

### Primary Surface

The primary surface is the main work area for the widget.

Examples include a conversation, Queue board, task list, terminal pane, notes
editor, Finder columns, Knowledge document list, SQL result preview, or Runbook
step detail.

Rules:

- render the smallest useful current surface first;
- keep raw/debug detail collapsed or moved into a popup/drawer unless raw
  output is the widget's primary purpose;
- preserve caps, redactions, and unsupported states visibly;
- avoid decorative box-inside-box composition.

### Optional Left Rail

The left rail is for navigation, scoped lists, filters, lanes, folders, or
categories when they are central to the widget workflow.

It is optional and should not be added to widgets that only need one primary
surface.

### Optional Right Inspector

The right inspector is for selected item details, review metadata, safe run
links, properties, or decision context.

It must remain tied to explicit selection and must not read hidden context from
other widgets.

### Optional Bottom Drawer

The bottom drawer is for secondary detail that benefits from horizontal space,
including logs, activity, validation output, selected result details, import
status, or developer detail.

The drawer should be collapsible, bounded, and scrollable.

### Popups / Overlays

Popups and overlays are for focused secondary tasks that should not permanently
consume widget space.

They must be explicitly opened, bounded in size, closable with Escape, and
return focus to the invoking control where practical.

## WidgetInfo Pattern

WidgetInfo is the shared help and explanation pattern for widgets.

Explanatory text belongs behind the info icon. Widgets must not keep
persistent banners, large help cards, or repeated instructional copy visible
by default unless the message is a current error, warning, unsupported-runtime
state, required approval, or destructive-action confirmation.

WidgetInfo may include:

- what this widget is for;
- what the current display level supports;
- current limitations and deferred behavior;
- safety boundaries;
- what data the widget can read or mutate;
- where logs, settings, examples, or developer details can be opened.

WidgetInfo must not:

- hide material errors;
- replace inline validation near the relevant input;
- imply planned or deferred behavior is implemented;
- expose secrets, raw logs, or hidden context.

## WidgetPopupShell Pattern

WidgetPopupShell is the shared shell for widget-scoped secondary surfaces.

Use WidgetPopupShell for:

- logs;
- settings;
- examples;
- developer details;
- import flows;
- draft review;
- bounded run/result details;
- selected item details that do not fit the main layout;
- confirmation flows that need more context than a small dialog.

Rules:

- opened only by explicit operator action;
- visually scoped to the owning widget;
- movable or draggable where practical, especially for detail surfaces the
  operator may compare with the primary widget;
- Escape closes unless closing would discard unsaved edits or interrupt a
  required confirmation;
- focus returns to the invoking control where practical;
- size is bounded relative to the Workbench viewport;
- content scrolls inside the shell instead of expanding unbounded;
- raw logs, stdout/stderr, SQL results, diffs, provider payloads, and import
  previews remain capped and redacted according to their owning contract;
- popup opening must not trigger hidden execution, refresh, ingestion,
  context sharing, or mutation.

WidgetPopupShell is not a new widget instance, Dock item, external window, or
new persistence scope.

## Widget Responsibility Model

Widgets render state and send explicit actions.

Domain services and Workspace APIs own behavior.

Widgets may:

- render safe state snapshots;
- collect typed user input;
- show validation, caps, redactions, and status;
- request explicit app-native actions;
- show action results, logs, and structured output;
- expose review and approval controls defined by the owning contract.

Widgets must not:

- execute hidden runtime behavior;
- bypass Workspace APIs with direct storage, filesystem, shell, provider, or
  cross-widget calls;
- read hidden context from other widgets;
- mutate other widgets directly;
- create Queue work automatically;
- launch Terminal, Agent Executor, JDBC, Git, or provider work unless the
  owning contract explicitly allows an operator-controlled action path;
- treat popup visibility, focus, resize, or z-order changes as permission to
  refresh, execute, mutate, or expose additional context.

The same rule applies during migration: extracting shared frame or popup code
must not move domain behavior into the shared shell.

## Migration Order

Migration should proceed in small, focused slices.

1. Shared primitives first:
   define and implement WidgetFrame, WidgetInfo, WidgetPopupShell, and shared
   layout-zone vocabulary without changing widget domain behavior.
2. Queue v2 first consumer:
   use Agent Queue as the first consumer because Queue has the clearest need
   for board/list, inspector, activity, settings, and review surfaces.
3. Knowledge second:
   migrate Knowledge / Skills after Queue to reuse popup and inspector
   patterns for import, draft review, examples, and developer details.
4. Workspace Agent third:
   migrate Workspace Agent after Queue and Knowledge so proposal review,
   attachments, provider status, and current-session conversation state use
   settled primitives.
5. Terminal and Finder later:
   defer Terminal and Finder until the shared shell has proven stable because
   they have specialized primary surfaces, bounded output, file preview, PTY,
   Git, and editing constraints.

Each migration slice must preserve the owning widget contract and should avoid
mixing Minimal, Operational, and Full / Expert complexity in one block.

## Non-Goals

This contract does not implement or authorize:

- a full WidgetHost rewrite;
- a WorkbenchCanvas rewrite;
- a WorkspaceApi split;
- runtime behavior changes;
- visual redesign of every widget;
- new widget insertion behavior;
- new widgets;
- storage or schema changes;
- backend, Rust, or Tauri changes;
- tests or validation automation changes;
- Dock, Compact, Indicator, presence-zone persistence, external windows, or
  new drag-and-drop behavior;
- Terminal tabs, split panes, command history, or persistent transcripts;
- Finder hidden scans, root persistence, broad indexing, or hidden context
  attachment;
- Workspace Agent hidden context access, provider tools, hidden mutation, or
  automatic Queue creation;
- Queue hidden dispatch, hidden execution, or automatic acceptance;
- Knowledge hidden ingestion, embeddings, team/server sharing, or automatic
  prompt injection.

## Acceptance For Future Implementation Blocks

Future implementation blocks that consume this contract should state:

- which shared primitive is being introduced or consumed;
- which widget is the target consumer;
- which layout zones are in scope;
- which domain behavior is intentionally unchanged;
- which validation profile proves the slice;
- which planned or deferred behavior remains out of scope.
