# Hobit Stable v0.1 Contract

## Purpose

This is the canonical product and architecture contract for Hobit Stable v0.1.

Stable v0.1 is the first accepted AI Workbench loop for dogfooding Hobit with
agent-assisted work. It defines the product surface that may be called Stable,
the responsibilities of each included capability, the state and API semantics
that must hold, the UI rules that protect operator control, and the blockers
that must be cleared before Stable v0.1 acceptance.

This document is docs-only. It does not implement frontend behavior, backend
behavior, Tauri commands, storage/schema changes, runtime execution, provider
tools, Queue scheduling, Finder behavior, Git mutation, Terminal behavior, JDBC
production execution, or new widgets.

## Source Of Truth

Use this contract together with:

- `docs/ACTIVE_CONTRACT_INDEX.md` for contract navigation and authority.
- `docs/CURRENT_WIDGET_SURFACE.md` for current implemented behavior.
- `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md` for the Stable v0.1 acceptance gate.
- Task-specific contracts when a future block changes one Stable v0.1 surface.

If this document conflicts with `docs/CURRENT_WIDGET_SURFACE.md` about what is
implemented today, `docs/CURRENT_WIDGET_SURFACE.md` wins for current behavior.
If this document conflicts with a future accepted task-specific contract, the
future contract must explicitly update this document or state that Stable v0.1
is no longer the active target.

## Stable v0.1 Definition

Stable v0.1 is an operator-controlled AI Workbench for planning, preparing,
executing, observing, reviewing, and continuing AI-assisted work inside an
isolated Workspace.

The Stable v0.1 core dogfooding loop is:

1. Workspace Agent helps the operator understand, plan, draft, review, and
   decide what should happen next.
2. Agent Queue organizes promoted, larger, delayed, or follow-up work.
3. Agent Executor provides supporting Direct Work runtime/detail for explicit
   Queue or operator-started execution.
4. Agent Activity shows readable current-session activity.
5. Notes and Knowledge / Skills preserve explicit operator-authored context.
6. Terminal, Database / JDBC Preview, and Runbook Preview remain bounded
   widgets, not hidden automation paths.
7. Finder remains the required Stable v0.1 file/project navigation gap.

Stable v0.1 must feel like Hobit: a modular AI Workbench. It must not become a
script executor, terminal wrapper, IDE clone, runbook runner, knowledge
manager, generic chatbot, hidden automation shell, or generic agent-runner
system.

## Product Surface

Stable v0.1 product-facing Workbench surfaces are:

- Workspace Agent.
- Agent Queue.
- Terminal.
- Agent Activity.
- Notes.
- Knowledge / Skills.
- Database / JDBC Preview.
- Runbook Preview.

Required Stable v0.1 product gap:

- Finder, for explicit file/project navigation and future Finder-owned Git
  review/control.

Stable v0.1 supporting / compatibility surfaces are:

- Agent Executor, for Direct Work runtime detail, run history, logs, results,
  cancellation, validation capture, and Queue task execution support.
- Git, as deprecated/internal compatibility only. Stable v0.1 product Git
  functionality belongs to the future Workspace Git API and Finder Git plugin.

Stable v0.1 must not present these as current product surfaces:

- separate Agent Chat.
- Agent Monitoring.
- Template Library.
- Dock.
- Agent CLI.
- Script Runner.
- JIRA.
- Confluence.
- Image Edit.
- separate legacy Coordinator preview surfaces.
- Knowledge Catalog.
- Stages.

Compatibility ids may remain for persistence:

- Workspace Agent may continue to use `interactive-agent`.
- Agent Executor may continue to use `agent-run`.
- Knowledge / Skills may continue to use `skill-library`.

Compatibility ids are not preferred user-facing product names.

## Stable Roles

### Workspace

Workspace is the isolation boundary for one problem or effort. Stable v0.1
must preserve this rule:

- Different problem = different Workspace.
- Different surface for the same problem = additional Workbench or widget
  surface in that Workspace.

Workspace state must not mix unrelated notes, queue tasks, runs, Git roots,
Terminal sessions, JDBC connectors, Knowledge documents, logs, artifacts, or
decisions.

### Workbench

Workbench is the product center. Widgets are capabilities inside the Workbench.

Workbench owns:

- visible composition of widgets;
- widget add/remove/layout flows;
- widget-local logs panel access;
- activity entry points;
- layout lock and movable/resizable widget presentation;
- local UI preferences such as theme and UI scale.

Workbench must not hardcode widget components directly into the canvas. Widget
rendering remains registry-driven through the Widget Registry and WidgetHost.

### Widget

Every visible UI block is a widget unless a contract explicitly defines it as
Workbench chrome.

A Stable v0.1 widget has:

- definition/template identity;
- instance identity;
- configuration/state;
- input data or input command/action where relevant;
- loading/run state where relevant;
- widget-local logs or console;
- structured output/result where relevant;
- layout state;
- docked/floating presentation state.

Moving, resizing, floating, docking back, or future presence changes must not
create a new widget instance. These are presentation/layout changes.

### Workspace Agent

Workspace Agent is the primary foreground AI surface.

It is responsible for:

- conversation and planning;
- visible-context reasoning;
- drafting safe proposal cards;
- reviewing pasted or explicitly attached visible results;
- deciding with the operator what should become Queue or Executor work;
- foreground Codex Direct Work where current behavior explicitly supports it.

Workspace Agent must:

- use only visible or explicitly attached context;
- keep provider requests visible and user-triggered;
- keep provider tool lists empty for Stable v0.1 (`allowed_tools: []`);
- render provider proposal drafts as inert review cards;
- require separate explicit actions for creating Queue tasks, Notes, Knowledge
  Documents, or Skills;
- keep each Workspace Agent widget's current-session chat, thread id, and
  working directory independent.

Workspace Agent must not:

- silently read Notes, Queue, Executor, Terminal, Git, JDBC, files, logs,
  Skills, Knowledge Documents, Evidence, Artifacts, or hidden Workspace state;
- launch Terminal;
- mutate Git;
- run SQL;
- assign or start Queue tasks without an explicit operator action;
- arm or start Queue Autorun;
- auto-create Queue tasks;
- execute provider tools;
- hide credentials, secrets, raw logs, raw stdout/stderr, diffs, prompts, repo
  paths, or raw payloads in provider context.

### Agent Queue

Agent Queue is the Stable v0.1 task organization and execution-follow-up
surface for promoted async work.

It is responsible for:

- workspace-scoped task create/list/read/update/delete;
- selected-task review;
- status, priority, prompt, assignment, and execution policy editing where
  current APIs support them;
- visible assignment to Agent Executor slots;
- explicit assigned-task start;
- safe selected-task Executor run-link visibility;
- current-session handoff and final-status refresh;
- operator-armed Queue Autorun where implemented.

Agent Queue must not:

- become the default destination for every Workspace Agent idea;
- silently dispatch tasks;
- run a durable backend scheduler;
- accept work automatically;
- parse or validate final agent responses as acceptance;
- mutate Notes, Git, Terminal, files, JDBC, or Knowledge directly;
- copy raw Executor logs, stdout/stderr, prompts, diffs, repo paths, secrets,
  or raw payloads into Queue state.
- auto-commit, auto-accept, or auto-finalize work.

Stable v0.1 closure outcomes are explicit coordinator/operator decisions:

- commit created;
- no-change accepted;
- follow-up created;
- closure blocked / commit required.

Report ready is review evidence, not final closure.

### Agent Executor

Agent Executor is supporting runtime/detail infrastructure, not a Stable v0.1
product widget.

It is responsible for:

- explicit Direct Work execution from operator-provided inputs;
- execution workspace path;
- prompt;
- Codex executable;
- sandbox and approval policy;
- run state;
- live logs/streaming where available;
- stop/cancel/kill controls;
- final response/result;
- validation capture;
- changed-file summary where available;
- run detail/history owned by Executor.

Agent Executor must not:

- auto-commit;
- auto-push;
- mutate Git outside explicit future contracts;
- become a shell mode or PTY;
- become a hidden background agent runtime;
- auto-dispatch Queue work;
- make successful execution equal operator acceptance.

### Agent Activity

Agent Activity is the current-session readable activity timeline.

It is responsible for:

- human-readable run activity from Workspace Agent and Agent Executor streams;
- compact status rows;
- expandable raw/detail previews where present;
- current-session visibility while Hobit remains open.

It must not:

- persist timeline history unless a future contract implements that behavior;
- execute work;
- alter Queue/Executor behavior;
- expose raw logs by default.

### Notes

Notes is the workspace-local note surface.

It is responsible for:

- list/filter/create/select/read/update/pin flows;
- explicit save;
- plain title/body/pinned source text;
- desktop persistence through Workspace Notes APIs where available;
- dev/browser in-memory fallback where current contracts allow it.

Notes must not implement Stable v0.1 hidden AI access, full Notebook behavior,
Markdown rendering, Mermaid rendering, rich formatting, autosave, snippets,
todos/checklists, AI-in-Notes, hidden ingestion, or hidden provider context.

### Knowledge / Skills

Knowledge / Skills is the operator-authored reusable context surface.

It is responsible for:

- workspace-local Skills CRUD;
- workspace-local and local-global Knowledge Document CRUD/search/import;
- explicit single-file plain text/Markdown import;
- enabled-only visible retrieval snippets for Workspace Agent Codex runs where
  current behavior supports it;
- selected Skill attach into visible Workspace Agent composer context.

Knowledge / Skills must not:

- act as hidden AI memory;
- auto-inject Skills into prompts;
- scan folders;
- parse binary documents;
- use embeddings/vector DB;
- share team/server knowledge;
- implement Evidence or Context Packs;
- ingest files without explicit operator action.

### Terminal

Terminal is the explicit operator command surface.

It is responsible for:

- desktop-only PTY-first manual shell sessions where supported;
- explicit shell executable, argv, and working directory;
- bounded session-only output;
- stdin, resize, Stop, Kill, and Close;
- collapsed legacy one-shot command fallback for persisted Terminal widgets.

Terminal must not:

- be controlled by Workspace Agent, Queue, or Executor;
- persist PTY transcripts;
- expose environment/secrets support;
- implement tabs, split panes, shell profiles, or persistent command history;
- become Script Runner.

### Git

Git is deprecated/internal compatibility implementation, not a Stable v0.1
product widget.

It is responsible for:

- explicit transient repository-root input;
- manual read-only status refresh;
- grouped changed files;
- selected-file bounded diff;
- recent history;
- explicit selected-file local commit with message and confirmation.

Git must not:

- persist repository roots;
- scan Workspace parents;
- fetch, push, reset, clean, stash, checkout, switch branches, or watch/poll
  through the standalone compatibility widget;
- auto-commit Agent Executor output;
- mutate Git outside the explicit local commit path.

Stable v0.1 product Git review/control belongs in future Finder through the
Finder Git plugin and Workspace Git API. Finder Git may show status
badges/changed files, selected-file diff preview, Git history, explicit manual
local commit, and explicit manual push once implemented. Manual push is
user-triggered only: no force push, no push-all, no hidden push, no automatic
push after commit or Executor completion, no reset/clean/stash, and no branch
management unless a later contract implements it.

### Database / JDBC

Database / JDBC is a Stable v0.1 product-facing Preview surface.

It is responsible for:

- workspace-local connector metadata;
- non-secret profile/connector fields;
- read-only SQL validation;
- bounded mock/safe execution and deterministic visible results;
- opt-in experimental sidecar diagnostics and prototype paths only where
  current contracts allow them.

Database / JDBC must not:

- store password values, tokens, private keys, certificates, or secret-bearing
  connection strings;
- run production external database queries as a Stable v0.1 default;
- expose Workspace Agent SQL execution;
- run write SQL;
- run real `EXPLAIN`;
- launch Terminal, Queue, Executor, or Git work.

### Runbook

Runbook is a Stable v0.1 product-facing Preview surface.

It is responsible for:

- local/manual procedural step viewing;
- step states;
- local notes/evidence text for the current widget session.

Runbook must not:

- execute steps;
- persist runbooks;
- edit/build templates;
- integrate with Queue, Executor, Workspace Agent, Terminal, or Git;
- become the product center.

### Finder Required Gap

Finder is the required Stable v0.1 operator-controlled file/project navigation
gap, not current implemented behavior.

The future Finder surface is responsible for:

- explicit root selection before file or Git reads;
- column-based navigation with previous folders visible as columns;
- bounded file content preview;
- a floating preview pane with minimize/maximize presentation behavior;
- edit-in-place with Save / Cancel for supported uncapped text files;
- selected-file Git status badges/changed-file state;
- selected-file diff preview, Git history, manual local commit, and manual
  push through the Finder Git plugin.

Finder must not be presented as implemented until a future implementation block
explicitly lands it. It must not become a broad IDE clone, hidden Workspace
scanner, Terminal launcher, arbitrary command prompt, broad context ingestion
path, hidden Workspace Agent file tool, or unsupported Git control surface.

## API Semantics

Stable v0.1 APIs must be app-native and ownership-preserving.

Required API principles:

- Workspace APIs are scoped to one Workspace.
- Widget APIs are scoped to one owning widget instance unless the action is
  explicitly Workspace-scoped.
- Safe state snapshots are bounded and redacted.
- Actions are explicit typed requests, not shell shortcuts, direct SQLite
  edits, localStorage edits, DOM scraping, or direct component calls.
- Events describe state and lifecycle changes where current implementation
  supports them.
- Logs/results remain owned by their widget unless explicitly attached or
  exposed through a safe metadata link.
- Current-session runtime state is not durable unless a specific storage API
  persists it.
- Compatibility DTO fields may remain, but new product language must use the
  preferred names in this contract.

Stable v0.1 accepted API families are limited to the currently contracted
surface:

- workspace lifecycle/state loading;
- widget add/state/layout/log operations;
- Notes workspace APIs;
- Knowledge / Skills workspace APIs;
- Agent Queue task and run-link APIs;
- Agent Executor / Direct Work APIs;
- Agent Activity stream consumption;
- Terminal PTY and collapsed one-shot fallback APIs;
- deprecated/internal Git explicit-root status/diff/history/local commit APIs
  where retained for compatibility;
- JDBC metadata and bounded read-only mock/safe query APIs;
- Workspace Agent visible-context provider/proposal APIs with
  `allowed_tools: []`.

No Stable v0.1 API may add hidden Workspace Agent capability execution,
unplanned schema changes, hidden execution, broad filesystem access, server
runtime, RBAC, enterprise sharing, hidden scheduler behavior, or new widget
insertion behavior without an explicit future contract update.

## State Semantics

Stable v0.1 must distinguish durable state, current-session state, compatibility
state, and local UI preferences.

Durable Workspace state may include:

- Workspace records and sessions;
- Workbench/preset/widget instance records;
- widget layout and widget state where implemented;
- widget-local logs where implemented;
- Notes;
- Queue tasks and safe run-link metadata where implemented;
- Knowledge / Skills records;
- JDBC non-secret metadata;
- Direct Work run/log/result artifacts where implemented.

Current-session state includes:

- Workspace Agent chat and proposal card UI state;
- Workspace Agent thread state unless explicitly persisted by a future
  contract;
- Agent Activity timeline;
- Terminal PTY sessions and PTY output buffers;
- Git selected repository root/status/diff/history UI state;
- Runbook current local step state;
- Queue-to-Executor frontend handoff and current-session runner state where
  current contracts define it.

Local UI preferences include:

- theme preset/custom theme values;
- UI scale.

Local UI preferences are not Workspace data and must not be treated as shared,
server, or team state.

Compatibility state includes:

- legacy widget ids;
- legacy DTO field names;
- deprecated old widget-local Notes draft shapes.

Compatibility state may be read or preserved where needed, but new product
work must not expand deprecated shapes.

## UI Rules

Stable v0.1 UI must preserve the locked product language:

- Workbench is the visual center.
- Every visible capability surface is a widget.
- Widget header is the top meta zone of one continuous widget surface.
- No box-inside-box composition.
- No clutter and no duplicated information.
- One visible UI block has one responsibility.
- No gradients.
- No raw colors outside the dedicated theme/design-system files.
- No one-off widget visual languages.
- Preview surfaces must honestly look limited and must not imply unimplemented
  behavior.
- Operator must always understand the current Workspace, what they are working
  on, what the agent is doing, and what needs approval.
- Actions that mutate state, execute work, expose context, or touch external
  systems must be visible, attributable, bounded, and approval-aware.
- Approval is not execution unless the contract explicitly says so; execution
  is not acceptance.

## Dogfooding Flow

The accepted Stable v0.1 dogfooding flow is:

1. Operator creates or opens a Workspace.
2. Workspace opens into the default Workspace Agent plus Notes surface, or an
   advanced/manual empty Workbench mode where current behavior supports it.
3. Operator uses Workspace Agent to plan, reason, draft tasks, review visible
   results, and choose next actions.
4. Larger or delayed work is promoted into Agent Queue through explicit Queue
   task creation.
5. Operator assigns a Queue task to a visible Agent Executor slot.
6. Operator starts assigned execution or explicitly arms/starts current-session
   Queue Autorun where implemented.
7. Agent Executor owns live execution detail, cancellation, logs, final result,
   validation capture, and changed-file visibility.
8. Agent Activity shows readable current-session events.
9. Operator reviews safe Queue run metadata, Executor detail, Git review, and
   validation output.
10. Operator decides whether work is accepted, needs follow-up, or becomes a
    new Queue task.
11. Operator preserves explicit knowledge or notes through Notes and Knowledge
    / Skills when useful.

This loop must not hide context access, dispatch, execution, acceptance, Git
mutation, Terminal launch, JDBC execution, Notes mutation, or file mutation.

## Blockers

Stable v0.1 acceptance is blocked until:

- Workspace Agent, Agent Queue, Agent Executor support, Agent Activity, Notes,
  Knowledge / Skills, Terminal, Database / JDBC Preview, and Runbook Preview
  pass the acceptance checks in
  `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md`.
- The required Finder gap is either implemented and passes its acceptance
  checks, or Stable v0.1 acceptance remains blocked.
- The Widget Catalog exposes only the accepted Stable v0.1 product-facing
  surfaces plus allowed supporting/compatibility surfaces.
- Safety checks prove no hidden Workspace Agent context, provider tools,
  hidden Queue dispatch, automatic acceptance, Terminal control, Git mutation,
  JDBC execution, or hidden file access is presented as current behavior.
- Required desktop/manual smoke blockers are reported with exact environment
  limitations.
- Stale user-facing naming that conflicts with Workspace Agent as the preferred
  product name is either cleaned up or clearly contained as compatibility
  wording.

## Non-Goals

Stable v0.1 does not include:

- server runtime;
- RBAC;
- enterprise/team knowledge sharing;
- hidden AI memory;
- provider tool execution;
- automatic Queue scheduling;
- durable Queue runner reconnect/resume;
- automatic acceptance;
- automatic Git commit/push;
- force push, push-all, hidden push, or branch management;
- Git fetch/reset/clean/stash/checkout/watch/poll;
- Terminal tabs/splits/history/transcripts/profiles;
- Script Runner;
- production JDBC execution or credentials;
- full Notebook;
- Runbook execution engine;
- Dock;
- Template Library;
- Evidence store;
- Context Packs;
- Artifacts;
- Finder hidden ingestion;
- arbitrary filesystem scanning;
- broad widget capability runtime;
- new dependencies, schemas, or Tauri commands outside explicit future blocks.
