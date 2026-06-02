# Workspace Widget API Contract

## Purpose

This contract defines the target Workspace Widget API model for Hobit.

Widgets are not isolated UI panels. A widget is a Workbench surface and a
Workspace capability provider. The Workspace Widget API is the app-native
boundary that lets Workspace, Workspace Agent Coordinator, tests, and future
automation reason about widgets through typed state, capabilities, actions,
events, evidence, logs, and safety policy.

This document is docs-only architecture. It does not implement frontend UI,
backend or Tauri commands, Rust or TypeScript types, storage/schema changes,
provider tools, widget action execution, shell execution, filesystem
mutation, Git behavior, Notes behavior, Queue behavior, Finder behavior, or
test automation.

For current implemented widget behavior, use
`docs/CURRENT_WIDGET_SURFACE.md`. For widget capability policy, use
`docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`. For Workspace Agent target behavior,
use `docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md`,
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`, and
`docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

## Product Model

Workspace is the control plane.

Widget APIs are the app-native control and observation boundary.

Workspace Agent Coordinator is the primary coordination surface that can later
analyze, test, and control widgets through those APIs when the operator or a
future explicit policy allows it.

The Coordinator must not reach around widgets through shell commands,
filesystem edits, ad hoc database writes, DOM scraping, hidden localStorage
mutation, or direct implementation imports. It uses Workspace-owned APIs and
widget-owned capability boundaries.

## Widget As Capability Provider

A widget may provide:

- a visible UI surface for the operator;
- state snapshots that describe current widget state safely;
- capabilities that describe what the widget can do;
- app-native actions that request those capabilities;
- events that describe state and lifecycle changes;
- evidence and logs that support review;
- test hooks for semantic widget validation;
- safety policy that classifies reads, mutations, execution, and external
  effects.

The widget owns its internal state, policy, validation, output classification,
logs, and failure display. The Workspace can route requests to the widget, but
the Workspace Agent Coordinator does not own widget internals.

## Workspace As Control Plane

Workspace owns the durable context and routes app-native widget interactions.

The Workspace control plane should eventually provide:

- widget registration and instance identity;
- safe widget summaries for the active Workspace;
- capability discovery from known widget providers;
- action routing to the owning widget or Workspace service;
- event publication and observation;
- evidence/log reference lookup;
- semantic test execution surfaces;
- policy and approval checks before risky actions.

This control plane must preserve Workspace isolation. Widget APIs for one
Workspace must not read or mutate widgets, Queue tasks, notes, Git state, logs,
artifacts, or decisions from another Workspace unless a future explicit
cross-Workspace copy/link flow is approved.

## Workspace Agent As Coordinator

Workspace Agent Coordinator may use Widget APIs to:

- inspect safe state snapshots;
- compare visible state against expected behavior;
- propose widget actions;
- create, update, or delete Queue tasks through Queue APIs when allowed;
- read selected widget evidence or logs when approved;
- run semantic widget tests through test hooks;
- summarize results and produce reports.

Workspace Agent Coordinator must not:

- silently read all widget state;
- bypass widget safety policy;
- mutate widget state through shell commands or filesystem/database hacks;
- create hidden Queue work;
- start Executor, Queue Autorun, Terminal, Git, JDBC, or filesystem actions
  without an explicit approved action or future explicit policy;
- treat raw logs, hidden state, credentials, or large outputs as default AI
  context.

## Required Widget API Shape

Every Workspace-facing widget API should be expressible with the following
shape. The field names are conceptual and may be refined by implementation,
but the responsibilities must remain.

### Identity

Identity identifies the provider and target.

Required concepts:

- `workspaceId`
- `workbenchId` when the action targets a visible surface
- `widgetDefinitionId`
- `widgetInstanceId`
- stable user-facing `title`
- compatibility ids or aliases when retained for persistence
- provider status such as `available`, `unsupported`, `disabled`, or
  `requires_configuration`

Identity is not permission. A known widget instance does not grant access to
hidden state or actions.

### State Snapshot

A state snapshot is a safe, bounded description of current widget state.

It should include:

- version or revision;
- lifecycle status;
- selected safe fields;
- current focus or selection when relevant;
- visible errors or unsupported-runtime state;
- compact counts and summaries;
- explicit redaction or capping notes.

A state snapshot must not include secrets, raw large logs, full database rows,
full diffs, full terminal transcripts, raw Executor payloads, or hidden notes
unless the widget has a separate approved context/evidence flow for that
specific data.

### Capabilities

Capabilities describe what the widget can do.

Each capability should define:

- `capabilityId`
- display name and description
- input and output shape
- risk level
- action level
- supported autonomy modes
- confirmation requirement
- selected-context requirement
- secrets policy
- result visibility
- audit/evidence expectations
- enabled state and unsupported reason

Capabilities are descriptive until an action request is made and approved.

### Actions

Actions are app-native requests to use a widget capability.

An action should include:

- `actionId`
- target widget identity
- target capability
- typed input
- purpose/intent
- requester identity such as operator, Coordinator, or test harness
- approval or policy reference when required
- idempotency key where retries are possible
- expected state/event result
- output cap and visibility rules

Actions must be routed through Workspace and the owning widget/provider. They
must not be implemented as arbitrary shell strings, filesystem mutations,
localStorage edits, direct SQLite updates, DOM events, or direct imports into a
widget component.

### Events

Events describe observable widget changes.

Events should include:

- `eventId`
- `workspaceId`
- `widgetInstanceId`
- event kind
- previous and next lifecycle state when useful
- action id or cause when known
- timestamp
- compact summary
- evidence/log references when relevant

Events are the basis for semantic observation. Tests and Coordinator should
prefer events and state snapshots over implementation-specific internals.

### Evidence And Logs

Evidence and logs support review without dumping raw internals into AI
context.

Widget APIs should expose:

- safe evidence references;
- bounded log summaries;
- selected excerpts when explicitly approved;
- result summaries;
- validation/test reports;
- redaction and truncation metadata.

Raw logs, full stdout/stderr, full diffs, full SQL results, Terminal buffers,
and hidden widget state are not default evidence. They require explicit
selection, capping, redaction, and approval under their owning contracts.

### Test Hooks

Test hooks are app-native semantic checks, not implementation shortcuts.

They may include:

- create deterministic fixture state;
- call a widget action with typed inputs;
- wait for expected events;
- read a safe state snapshot;
- assert state, event, result, and evidence behavior;
- reset only test-owned fixture state where supported.

Test hooks must preserve the same safety and ownership rules as normal
actions. A test hook must not become a hidden production mutation path.

### Safety Policy

Each widget API should declare safety policy for:

- safe reads;
- sensitive reads;
- local mutations;
- external/database actions;
- command or Terminal actions;
- async Queue/Executor actions;
- destructive actions;
- secrets and credential-adjacent data;
- AI-readable context rules;
- confirmation and approval requirements.

Safety policy travels with the capability and action. The Coordinator cannot
weaken it by changing prompts or calling a lower-level implementation path.

## App-Native Actions Only

Widget CRUD, widget state updates, Queue task changes, Notes changes, Git
actions, Finder operations, and future widget actions must use app-native
Workspace and widget APIs.

Forbidden as Widget API substitutes:

- shell commands that edit widget state files;
- ad hoc SQLite updates outside app services;
- filesystem mutation to create, delete, or change widget records;
- localStorage or browser storage edits as a control API;
- DOM scraping or synthetic UI clicks as normal action execution;
- frontend component imports that bypass Workspace routing;
- provider tool calls that bypass widget capability policy.

The shell and filesystem may still be used by development agents for normal
repository work when the user asks Codex to edit the Hobit codebase. They must
not be used as the product/runtime mechanism for Workspace Agent Coordinator
to control Hobit widgets.

## Semantic Widget Testing Model

Widget testing should validate behavior through the same conceptual boundary
the product uses.

Required sequence:

1. Call an app-native widget action with typed inputs.
2. Observe resulting event(s) and/or safe state snapshot(s).
3. Assert expected behavior, lifecycle state, output, and safety metadata.
4. Produce evidence/report with action id, observed events, state summary,
   assertion results, failures, and redaction/truncation notes.

Examples:

- Create a Queue task through the Queue action API, observe a task-created
  event, read Queue snapshot, assert the new task is draft/queued as expected,
  and emit a test report.
- Select a Finder directory through a Finder action API, observe selection
  event, read bounded listing snapshot, assert visible entries and caps, and
  emit a report.
- Save a Note through the Notes action API, observe note-updated event, read
  selected note snapshot, assert title/body/pinned fields, and emit evidence.

Tests must not assert behavior by inspecting private React state, mutating
SQLite rows directly, parsing raw shell output, or rewriting files that happen
to back a widget.

## Example API: Agent Queue

Status: target Widget API shape. Current Queue behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and Queue-specific contracts.

Identity:

```text
widgetDefinitionId: agent-queue
widgetInstanceId: <workspace queue widget view id>
workspaceScopedResource: canonical-agent-queue
singleton: true
```

State snapshot:

- queue revision;
- task counts by status;
- selected task id;
- visible assignment summary;
- global execution/runner state when available;
- safe latest-run references;
- unsupported or stopped state.

Capabilities:

- `queue.task.create`
- `queue.task.list`
- `queue.task.read`
- `queue.task.update`
- `queue.task.delete`
- `queue.task.assign_executor`
- `queue.task.clear_assignment`
- `queue.task.start_assigned`
- `queue.autorun.start_when_explicitly_requested`
- `queue.autorun.stop`

Actions:

- create task with title, prompt, priority, status, execution policy, tags, and
  source;
- update task fields with expected revision;
- delete stale task with confirmation;
- create follow-up task from explicit evidence;
- start assigned task only through explicit operator action or a future
  explicit autonomy policy.

Events:

- task created;
- task updated;
- task deleted;
- assignment changed;
- assigned task start requested;
- run link attached;
- autorun armed/stopped.

Evidence/logs:

- task summaries;
- safe run-link metadata;
- latest status transition;
- selected evidence/report references;
- no raw Executor logs or payloads by default.

Test hooks:

- create test task;
- update test task;
- observe task event;
- assert queue revision and task status;
- clean up only test-owned tasks when supported.

Safety policy:

- task create/update/delete are local mutations;
- assigned task start is async execution and requires explicit approval or a
  future explicit policy;
- Queue Autorun remains operator-explicit;
- Queue must not mutate Git, Notes, Terminal, files, or Executor internals
  outside its own app-native boundaries.

## Example API: Finder

Status: future/reference capability example. Finder is not a current catalog
widget in `docs/CURRENT_WIDGET_SURFACE.md`.

Finder represents a future app-native Workspace/project navigation and
selection provider. It is not a shell, hidden filesystem scanner, or arbitrary
file mutation path.

Identity:

```text
widgetDefinitionId: finder
widgetInstanceId: <finder widget view id>
scope: workspace-approved-root-or-project
```

State snapshot:

- approved root label and safe path display;
- current directory or selection;
- bounded entry list;
- filters/search query;
- selected file or folder;
- unsupported-runtime state;
- redaction and cap metadata.

Capabilities:

- `finder.root.select`
- `finder.directory.list`
- `finder.item.select`
- `finder.item.reveal_in_workspace`
- `finder.file.read_selected_preview`
- `finder.search.bounded`

Actions:

- select an approved root;
- list a bounded directory;
- select a file/folder;
- request a capped preview of selected text file content;
- search within an approved root with caps and ignore rules.

Events:

- root selected;
- directory listed;
- item selected;
- preview loaded;
- search completed or capped.

Evidence/logs:

- selected path references;
- bounded previews;
- search result summaries;
- no secret files, unbounded recursive scans, or hidden content by default.

Test hooks:

- use a test fixture root;
- list fixture directory;
- select fixture file;
- assert bounded listing and preview behavior;
- report caps and redactions.

Safety policy:

- listing and selection are safe reads only inside approved scope;
- file preview can become sensitive read and requires explicit selection;
- mutations such as create, rename, delete, move, or write are out of this
  example and require separate file/code capability policy;
- no shell commands are used for Finder CRUD or selection.

## Example API: Future Git Widget

Status: future Widget API shape. Current Git behavior remains limited to
manual explicit-root status/diff/history review and selected-file local commit
as defined in `docs/CURRENT_WIDGET_SURFACE.md` and
`docs/GIT_WIDGET_CONTRACT.md`.

Identity:

```text
widgetDefinitionId: git
widgetInstanceId: <git widget id>
repositoryRoot: operator-approved-transient-or-future-approved-root
```

State snapshot:

- repository root display label;
- branch summary;
- clean/dirty state;
- grouped changed-file counts;
- selected file;
- recent history summary;
- unsupported/browser fallback state.

Capabilities:

- `git.status.read`
- `git.diff.read_selected`
- `git.history.read_recent`
- `git.commit.selected_file`
- future `git.commit_message.suggest`

Actions:

- refresh status for explicit root;
- load bounded selected-file diff;
- load recent history;
- create local selected-file commit after explicit confirmation.

Events:

- status refreshed;
- diff loaded;
- history loaded;
- commit requested;
- commit completed or failed.

Evidence/logs:

- status summary;
- selected-file diff reference or bounded excerpt;
- commit result summary;
- no push, reset, clean, checkout, restore, or hidden repo scan.

Safety policy:

- status/history reads are safe reads when root is explicit;
- diffs may be sensitive reads and must be capped;
- local commit is local write and confirmation-gated;
- Workspace Agent Coordinator must not mutate Git directly.

## Example API: Future Notes Widget

Status: future Widget API shape. Current Notes behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and `docs/NOTES_WIDGET_CONTRACT.md`.

Identity:

```text
widgetDefinitionId: notes
widgetInstanceId: <notes widget id>
scope: workspace-local-notes
```

State snapshot:

- selected note id;
- filtered list summary;
- draft dirty/saved state;
- pinned count;
- visible unsupported-runtime state;
- selected note safe metadata.

Capabilities:

- `notes.note.create`
- `notes.note.list`
- `notes.note.read_selected`
- `notes.note.update_selected`
- `notes.note.pin`
- future `notes.summary.save`

Actions:

- create note from approved visible text;
- list note metadata;
- read selected note after explicit selection;
- update selected note with explicit save;
- pin or unpin selected note.

Events:

- note created;
- note selected;
- note updated;
- note pinned/unpinned;
- save failed.

Evidence/logs:

- note metadata;
- selected note text only when explicitly approved;
- save result summaries;
- no hidden note collection reads.

Safety policy:

- list metadata is a safe read when bounded;
- reading body text is selected context and may be sensitive;
- create/update/pin are local mutations;
- Notes are not hidden AI memory.

## Relationship To Existing Contracts

This contract extends the widget-first model without changing current
implementation status.

- `docs/CURRENT_WIDGET_SURFACE.md` remains authoritative for current behavior.
- `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md` defines capability risk,
  confirmation, context, secrets, and audit expectations.
- `docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md` defines the single-coordinator
  MVP model and future multi-coordinator compatibility.
- `docs/WORKSPACE_CONTRACT.md` defines Workspace isolation and ownership.
- Widget-specific contracts remain authoritative for domain details.

## Non-Goals

This contract does not implement:

- Workspace Widget API runtime;
- capability registry;
- Coordinator tool execution;
- frontend UI;
- backend or Tauri commands;
- Rust or TypeScript types;
- storage/schema changes;
- Finder widget;
- Git, Notes, Queue, JDBC, Terminal, or Executor behavior changes;
- semantic test runner;
- shell or filesystem control paths;
- provider tool mode;
- autonomous Coordinator behavior.
