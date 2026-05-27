# Current Widget Surface

## Purpose

This document is the source of truth for current implemented Hobit widget
behavior during Phase 1 stabilization.

It is an inventory and boundary document only. It does not add runtime
behavior, backend commands, storage, schema, queue execution, Git mutation,
widget renames, persistence migrations, or new widgets.

Contract-reading navigation is defined in
`docs/ACTIVE_CONTRACT_INDEX.md`.
Host/deployment architecture guardrails are defined in
`docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md`; this widget
inventory does not add server, enterprise, or shared knowledge runtime
behavior.
Knowledge, Skills, Evidence, and Context Pack boundaries are defined in
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`; current Knowledge / Skills
behavior is limited to the MVP described below.

## Status Model

- Current: implemented behavior that exists in the shipped codebase and is safe
  to rely on.
- Preview: implemented behavior that is visible, intentionally limited, and not
  yet a complete product surface.
- Planned: approved next-step behavior, but not necessarily implemented.
- Deferred: future behavior that must not be implemented unless explicitly
  requested.
- Compatibility: legacy names, persistence IDs, old component names, old state
  shapes, or old code paths that still exist but are not preferred
  product/domain names.
- Deprecated: old behavior or terminology that should not be used for new work.

If this document conflicts with broader or older contracts, this document and
`docs/ACTIVE_CONTRACT_INDEX.md` are authoritative for current implemented
widget behavior.

## Current User-Facing Catalog

Current Ready / MVP catalog surfaces:

- Workspace Agent
- Agent Activity
- Agent Executor
- Git
- Terminal
- Notes
- Knowledge / Skills

Current preview surfaces:

- Agent Queue
- Database / JDBC
- Runbook

The current catalog uses these preferred user-facing names. Compatibility IDs
and component keys may still appear in code and persistence.

## Current Default Workspace

New Workspaces use the default name `Untitled` and open into the
Workspace Agent MVP surface: Workspace Agent plus Notes. Agent Activity,
Agent Queue, Agent Executor, Git, Terminal, Database / JDBC, Knowledge / Skills, and Runbook
remain optional widgets added when needed.

An opened Workspace can be closed from the Workbench top bar to return to the
Workspace Start Screen. Close is navigation only: it does not delete the
Workspace, remove widgets, clear persisted notes/tasks/runs/results, or change
Workspace deletion semantics. The Start Screen recent Workspace list shows
created and last-opened metadata plus compact safe counts such as widgets,
Workspace Agents, notes, skills/documents, and Queue tasks, and it is the
primary Start Screen panel when recent Workspaces exist. New Workspace remains
available as a secondary creation panel, while an empty recent list keeps
creation central. The Start Screen does not expose raw logs, prompts, result
payloads, or Executor output.

The frontend supports local interface theme presets from the Start Screen and
Workbench top bar, including Dark / Default, Light, Midnight, Discord Dark,
Graphite, and Forest. Discord Dark uses a Discord-like layered gray palette
with a restrained blurple accent. The current theme choice is a local UI
preference persisted in browser/desktop local storage under a stable frontend
key. The custom theme option is intentionally small: it edits accent,
background, surface, raised surface, text, muted text, and border colors only.
The same Appearance UI also supports local UI scale presets: 90%, 100%, 110%,
125%, and 150%, with 100% as the default. UI scale is a frontend-local
preference persisted in local storage, applies through CSS variables for text,
controls, and widget chrome, and remains separate from workbench grid size,
widget coordinates, and layout persistence. Theme and UI scale preferences are
not Workspace data, are not synced across users or teams, and do not add
backend, storage, widget, Queue, Executor, Knowledge, or runtime behavior.

Workbench widgets are movable and resizable by default after a Workspace opens.
The optional top-bar layout lock freezes docked widget movement and resize
handles when the operator wants to avoid accidental rearrangement. Widget
removal remains explicit and confirmation-gated; arranging widgets does not
make deletion a one-click action.

Empty Workbench remains available as an advanced/manual start mode. Existing
empty Workspaces show a recovery action to add Workspace Agent plus Notes
without running agents, creating Queue tasks, reading hidden context, or
changing runtime behavior.

## Workspace Agent Target Architecture Note

Current behavior in this document remains authoritative for what is implemented
today. Target architecture now treats Workspace Agent as a foreground
interactive AI agent widget for Workspace work. Multiple Workspace Agent
widgets can exist in one Workspace, and each agent has independent
current-session context, conversation/thread state, and working directory.
Chat is the interaction model, not the capability limit. Coordinator was the
previous name for this Workspace Agent surface and remains only a legacy term
for compatibility IDs, command names, and older contract filenames.

Future Workspace Agent capabilities may include approved Workspace reads, coding
and code review, file edits with diff preview, command and validation actions,
Terminal/SSH, Git, JDBC/database work, Notes, Knowledge / Skills, Queue,
Agent Executor, run history, and future Artifacts/Evidence. Those capabilities
are not implemented by this inventory unless explicitly listed as current
behavior below.

Queue is the async task pipeline for promoted, larger, delayed, or overnight
work. Agent Executor is a background worker for queued tasks and owns queued
run detail/logs/results. Executor is not the only agent that can do work;
Workspace Agent is the foreground interactive agent surface.

## Current Ready Surfaces

### Agent Activity

- Current frontend MVP observability widget for human-readable agent execution
  timelines.
- Uses the `agent-activity` widget definition id.
- Shows current-session readable activity events published by Workspace Agent
  Codex runs and Agent Executor streaming Direct Work runs while Hobit remains
  open.
- Timeline events include run start, thread start, turn start, command start,
  command finish/failure, response preparation, and run completion/failure when
  those events are present in the existing stream.
- Raw event previews and technical details are collapsed per event by default.
- It does not persist activity, read stored Executor detail automatically,
  expose full stdout/stderr/JSON in the normal view, create Queue tasks,
  execute work, change Codex execution semantics, or change Queue/Executor
  runtime behavior.

### Agent Executor

- Current explicit Codex Direct Work execution surface and runtime slot.
- Uses the existing `agent-run` widget definition id for persistence
  compatibility.
- Starts one operator-provided task from visible inputs: prompt, execution
  workspace path, sandbox, approval policy, and Codex executable options.
- The shared Codex launch helper is platform-aware. On Windows, the default
  path keeps `codex.cmd` support and launches `.cmd`/`.bat` shims through
  `cmd.exe /D /C` while keeping `exec` and the remaining Codex arguments
  separate. On Unix/Linux, the default executable is `codex`, explicit paths
  such as `/usr/local/bin/codex` run directly, and no `cmd.exe` wrapper is
  used.
- Shows run state, live logs/streaming where available, stop/cancel/force-kill
  controls, final result output, changed-files summary, Git read-only handoff,
  validation capture, and read-only run/detail/history views.
- Owns run detail, live logs, cancellation controls, final responses,
  validation capture, changed-file visibility, and run history.
- Run history and selected run detail can attach safe run metadata to
  Workspace Agent as visible current-session composer context. Selected run
  detail can also attach an explicit bounded excerpt from text the operator has
  selected inside the visible Executor-owned detail panel, or explicitly attach
  bounded visible preview sections such as final response, stdout, stderr,
  validation output, and error summary previews. Attach does not copy raw logs,
  full stdout/stderr, full final responses, diffs, prompts, repo paths,
  secrets, or raw payloads automatically, and it does not send automatically.
  Raw Executor detail remains Agent Executor-owned.
- Provides read-only backend/Tauri APIs for stored Direct Work runs,
  validation runs, and explicit diff summaries.
- Queue tasks can be assigned to visible Executor slots and explicitly started
  through the Agent Queue preview path.
- Does not auto-dispatch Queue items, auto-commit, auto-push, mutate Git, run
  hidden background work, provide a shell mode, or become a general agent
  runtime.

### Git

- Current desktop Git review/control widget for an explicit operator-provided
  repository root.
- Reads a manual read-only status snapshot, grouped changed-file data,
  selected-file diff, and recent Git history in the Tauri desktop shell.
- The compact widget surface is organized as Changes, Diff, History, and
  Commit sections. Selecting a changed file opens its read-only diff review.
- Supports explicit selected-file local commit with an operator-provided
  message and operator confirmation.
- Browser/Vite fallback keeps the widget insertable but cannot perform real
  Git reads.
- Does not persist repository roots, poll, watch, fetch, push, reset, clean,
  stash, checkout/switch branches, revert files, auto-commit Agent Executor
  output, or mutate Git outside the explicit local commit path.

### Terminal

- Current desktop-only Terminal widget with a classic terminal-first PTY
  surface plus collapsed Terminal settings for advanced PTY configuration and
  the legacy one-shot command fallback.
- PTY UI accepts an explicit shell executable, optional shell argv, explicit
  working directory, cols/rows, stdin sends, manual refresh/polling, resize,
  Stop, Kill with confirmation, and Close.
- The normal visible Terminal UI shows compact status, working directory,
  shell, a large monospace output buffer, and a prompt-style command input.
  Shell executable, shell args, cols/rows, output cap bytes, runtime-only
  buffer details, and the compatibility fallback are accessible from Terminal
  settings and are collapsed by default.
- PTY output is a bounded session-only buffer. It is not persisted as widget
  logs/results and is not sent to Workspace Agent, Queue, Agent Executor,
  Git, Notes, JDBC, or Evidence/Sources.
- PTY session support is currently Windows-only in shipped backend code.
  Non-Windows desktop builds compile but live PTY creation returns an
  unsupported-platform error. Treat non-Windows live PTY sessions as
  unsupported until platform support or catalog gating is implemented.
- Browser/Vite fallback cannot run local processes.
- The legacy one-shot fallback is a Compatibility path. It remains available
  only behind the collapsed fallback UI, uses explicit program, argv, working
  directory, timeout, and output caps, creates widget run/log/result records,
  and shows final stdout/stderr output.
- Terminal does not implement tabs, split panes, persistent command history,
  persistent transcripts, shell profiles, environment/secrets support,
  Agent-triggered execution, Queue-triggered execution, Workspace Agent control, or
  Script Runner behavior.

### Notes

- Current workspace-local Notes widget supports list, filter, create, select,
  edit, explicit save, and pin flows through workspace Notes APIs when
  available.
- Desktop/Tauri persists Notes through local SQLite-backed Workspace Notes
  APIs. Browser/Vite development mode uses a frontend-only, non-persistent
  in-memory Notes API for create/list/read/update UI iteration. Non-dev
  browser fallback keeps visible unsupported-runtime errors for Notes
  persistence reads and writes.
- `docs/NOTES_DEV_MEMORY_API_DECISION.md` documents the implemented Phase 2
  dev-only in-memory browser fallback boundary. It is not production browser
  persistence.
- Notes stores source text fields as plain title/body/pinned data. It does not
  render a Notebook document model.
- `docs/NOTES_WIDGET_CONTRACT.md` is authoritative for the current Notes widget
  boundary. `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md` is authoritative for Notes
  product planning and next-slice boundaries.
- Workspace Agent can create a new workspace-local Note only from an approved
  visible create-Note proposal and a separate explicit Create Note action.
  Existing Notes content is not read, searched, summarized, or sent to agents.
- The older widget-local draft state shaped as `{ "body": "..." }` may still be
  relevant for Compatibility/Deprecated persisted data, but it is not the
  preferred current product model for new work.
- Full Notebook behavior is Deferred: tabs, Markdown rendering, Mermaid or
  diagram rendering, checklists/todos, snippets, review notes, rich formatting,
  autosave, sync/import/export, archive/delete UI, tags, AI-in-Notes, and
  hidden agent access are not implemented.

## Current Preview Surfaces

### Agent Queue

- Current preview async task organization and execution-support surface.
- Uses the `agent-queue` widget definition id.
- Intended for promoted/larger work blocks that need async organization,
  assignment, sequencing, or later review. It is not the default destination
  for every Workspace Agent idea, small decision, or quick operator action.
- Provides workspace-local task create, list, read, update, delete, filter,
  select, and explicit save flows for title, description, prompt, status, and
  priority.
- Task deletion is explicit and confirmation-gated, blocks running/current
  active runner tasks, and removes only the Queue task row. It does not delete
  Agent Executor runs, logs, results, artifacts, or Direct Work history.
- Supports visible manual assignment/clear of a task to an Agent Executor slot
  when assignment APIs are available.
- Supports explicit start of an assigned task in its assigned Agent Executor
  with an operator-provided execution workspace path.
- Queue-to-Executor handoff and final-status auto-refresh are current-session
  frontend behavior. Agent Executor owns live logs and final results.
- Selected task details show the latest durable Queue task to Agent Executor
  run-link metadata when available: safe link id/run id references, source,
  status, timestamps, review status, and an Open Executor action that
  opens/focuses the owning Agent Executor and passes only the safe run id for
  Executor-owned run detail selection. Selected task details also show a
  compact recent run-history summary from the same safe run-link metadata,
  capped to a small list with a count. Latest-run and recent run-history rows
  can attach this same safe metadata to Workspace Agent as visible
  current-session composer context; attach is operator-controlled, does not
  send automatically, and does not copy raw Executor payloads.
  Queue does not copy or render raw prompts, stdout/stderr, logs, final
  responses, diffs, repo paths, secrets, or raw JSON payloads from Agent
  Executor.
- Queue task persistence includes `executionPolicy` model/DTO support with a
  `manual` default, and the Queue editor exposes a policy control for
  `manual`, `auto`, and `after_previous_success`.
- Provides a visible frontend-driven Sequential Queue Runner MVP. The operator
  selects one Agent Executor, configures execution workspace/repo root, Codex
  executable, sandbox, and approval policy once, then starts the runner from
  Queue. The runner scans the current ordered Queue task list, assigns
  unassigned runnable tasks to the selected Executor, starts each task through
  the existing assigned-task Queue-to-Executor handoff path, waits for an
  Executor final state, and then evaluates the next task.
- Sequential Queue Runner policy behavior is current for `manual`, `auto`, and
  `after_previous_success`: `manual` stops for operator action, `auto` may run
  when runnable and configured, and `after_previous_success` runs only after a
  previous task in the current runner pass completed successfully.
- The Sequential Queue Runner is current-session frontend behavior only. It is
  not durable background scheduling and stops if the Workbench UI closes or
  reloads.
- Provides a visible Queue Autorun panel that can arm, stop, and refresh
  desktop-local runner session state. Queue Autorun can start one eligible
  assigned `auto` task through the existing Queue-to-Executor path after the
  operator clicks Start Autorun. Refresh can observe that run's final status
  and, after success, continue to exactly one next eligible assigned `auto` or
  `after_previous_success` task per refresh. A desktop-local current-session
  tick runs the same reconciliation path while Hobit remains open and the
  machine remains awake. It is still not a backend scheduler or durable runner.
- Existing duplicate persisted Queue widgets are not deleted or migrated.
- Does not provide a backend scheduler, durable runner persistence,
  multi-executor parallel scheduling, retries, dependency graph execution,
  automatic acceptance, response capture outside Direct Work artifacts,
  response validation, Workspace Agent automation, Notes mutation, Terminal launch,
  or Git mutation.

### Workspace Agent

- Current preview foreground interactive AI agent widget shown as Workspace
  Agent and compatibility foundation for the target foreground agent surface.
- It is chat-based, but not merely a chat widget: the operator uses it for
  planning, reasoning, task drafting, outcome review, and deciding what should
  become Queue or Executor work.
- Multiple Workspace Agent widgets can exist in one Workspace. Each widget
  instance owns its current-session visible chat, proposal card state, Codex
  thread id, and working directory independently.
- Codex thread state is current-session only and scoped to the active
  Workspace Agent widget, workspace, and working directory. New Workspaces and
  new Workspace Agent widgets start with no active thread and do not reuse
  Codex threads from other Workspaces or agents.
- Uses the existing `interactive-agent` widget definition id/component key for
  compatibility. Do not rename this id without an explicit migration.
- Keeps chat messages and proposal card state in local React state for the
  current widget session.
- Shows local planning-oriented response cards for explicit planning prompts:
  compact plan title, goal, steps, risks/notes, and suggested next actions.
  These cards are UI-only and do not create tasks, run tools, or persist plan
  state.
- Shows local outcome-review cards when the operator explicitly pastes Queue,
  Executor, or validation results into visible chat. Review cards summarize the
  visible pasted text, classify the likely status as success, failure, unclear,
  or needs review, and suggest next actions.
- Can receive explicitly attached visible run metadata from Queue latest-run,
  Queue run-history, and Agent Executor run-history/detail controls. It can
  also receive an operator-selected bounded excerpt from visible Agent
  Executor-owned run detail, and bounded Executor run-detail preview sections
  explicitly attached by the operator. Knowledge / Skills can explicitly attach the
  selected Skill's visible title, when-to-use, prerequisites, steps,
  validation, risks, tags, and review status. Attached context is
  current-session UI state inserted into the visible composer and can be edited
  or removed before Send. Only visible attached context is sent; Attach does
  not auto-send, search Skills, read Queue history, read Executor logs, or copy
  raw stdout/stderr, full final responses, diffs, prompts, repo paths, secrets,
  hidden metadata, or raw payloads automatically.
- Can generate deterministic local proposal cards for safe preview types:
  create Agent Queue task, create Note, create Knowledge Document, create
  Skill, and prepare JDBC query suggestion text.
  Explicit planning prompts can draft one or more visible Queue task proposals
  from the typed chat text. Draft Queue task cards show title, prompt,
  priority, execution policy, and draft/proposed status. Multi-draft review can
  approve all drafts locally, but each Queue task creation remains a separate
  explicit Create Queue task action.
- Can draft visible Knowledge / Skills catalog proposal cards from
  explicit operator text or safe `hobit-catalog-action` fenced JSON blocks in
  visible assistant/Codex text. Knowledge Document drafts show title, source
  label, content, tags, and enabled state. Skill drafts show title, when to
  use, prerequisites, steps, validation, risks, tags, and review status.
  Creating either record requires approval plus a separate explicit Create
  Document or Create Skill action, uses only visible conversation content, and
  writes only workspace-local Knowledge / Skills records.
- Outcome review may draft follow-up Queue task proposal cards from the pasted
  visible result text. Queue task creation remains explicit and creates a draft
  task only; it does not assign, start, run, or arm Queue Autorun.
- In the Tauri desktop shell, explicit sends can use a backend-owned
  Workspace Agent provider response path. Mock/local is the default provider; a
  configured HTTP JSON provider can be selected by backend environment
  variables. Requests include visible current-session chat, visible proposal
  draft summaries, compact safety instructions, and `allowed_tools: []`.
- Provider credentials stay backend-only. Browser/Vite fallback does not call a
  provider directly.
- Presents Codex as the current foreground Workspace Agent when the desktop
  Codex bridge is available. The primary composer action is Run with Codex and
  sends the current composer message to a foreground Workspace Agent-owned Codex
  Direct Work run instead of generating a mock/local assistant response. Direct
  Work remains the implementation/execution path, not the primary UI concept.
  The working directory field defaults to `~`, and resolves `~` in the
  Tauri/backend path to the current user's home directory before launching
  Codex. Workspace Agent-owned Direct Work runs pass Codex `--skip-git-repo-check`
  so the default home-directory mode can start from a non-Git directory; Agent
  Executor and Queue Direct Work do not skip that check by default. The
  operator can replace `~` with a project or repo folder.
  On Windows, the default Codex launch path uses `codex.cmd` through the
  shared Direct Work launch helper. On Unix/Linux, the default Codex launch
  path uses `codex` directly. Missing home-directory resolution for `~`
  returns a visible launch error instead of silently using the repository.
  Workspace Agent-owned Codex runs stream visible
  status/log/final-result summaries in Workspace Agent, shows a compact
  one-line live activity summary such as the current command or response
  preparation step while a run is active, captures the Codex
  `thread.started` `thread_id` when emitted, and keeps that explicit Codex
  thread id in current-session Workspace Agent widget state. Follow-up Run with
  Codex actions resume that explicit thread id and send only the latest
  composer message; they do not use `--last` and do not resend the visible
  transcript as the prompt. The operator can use the visible New thread action
  to clear the current thread id and visible carried context without clearing
  visible chat. Changing the Codex working directory clears the current thread
  id and starts a new thread on the next run. Explicit visible context transfer
  must remain visible and removable before Run with Codex. Thread state is
  current-session only unless a later persistence slice explicitly adds
  storage. Normal chat transcript shows
  operator prompts and Codex final responses; Direct Work lifecycle details and
  raw technical data stay available in the collapsed Direct Work details/status
  area. Workspace Agent also publishes current-session readable activity events
  to the Agent Activity widget without inserting those events into chat. Agent
  Activity keeps raw event previews collapsed by default. Workspace Agent shows
  compact helper copy that `~` resolves to the current user's
  home directory and suggests choosing a project folder or scratch workspace if
  access is denied. Access-denied command failures inside Codex are surfaced as
  working-directory warnings while preserving any final Codex agent message as
  the visible assistant response. Workspace Agent Codex runs support Stop when
  the Direct Work cancellation path is available and does not create Queue
  tasks.
- Provider/local drafts are validated before rendering. Queue task creation and
  Note creation require approval plus a separate explicit create action.
  Knowledge Document and Skill creation require approval plus separate explicit
  catalog create actions. Queue task creation creates a draft/manual Queue
  record only; execution remains Queue/Executor controlled. JDBC suggestions
  remain review/copy text only and do not execute SQL.
- Mock/local remains an explicit fallback when Codex is unavailable or the
  fallback chat path is used. The UI must not present mock/local fallback as
  connected AI.
- Workspace Agent does not persist chat sessions, read hidden Workspace
  context, inspect widget state, read Notes, read Terminal output, read Git
  diffs, read JDBC metadata, fetch Queue run history, read Executor logs or
  artifacts, launch Agent Executor, auto-dispatch Queue items, create Queue
  tasks automatically, start Queue Autorun, run validation, use SSH, mutate
  Git, run SQL, call JDBC connectors, run Terminal commands, emit/persist audit
  events, or execute broad widget capability tools. Workspace Agent-owned Codex runs may
  let Codex read files, write code, and run commands inside the explicit
  operator-provided working directory, but Hobit still performs no automatic
  commit, push, reset, clean, stash, or Queue/Executor handoff.

### Database / JDBC

- Current preview Database / JDBC widget.
- Provides workspace-local connector metadata create, list, read, update, and
  selection flows.
- Connector metadata is non-secret: display name, database kind, driver kind,
  masked JDBC URL metadata, environment, read-only default, status, and notes.
- A read-only SQL validation/execution UI is shipped and wired through
  frontend, Tauri command, backend adapter, and tests.
- The current product execution path is bounded mock/safe execution: it
  validates conservative read-only SQL, applies row/timeout caps, and renders
  deterministic bounded mock results or sanitized validation/runtime errors.
- A backend adapter boundary, runtime config loader, Java sidecar scaffold, and
  JDK-gated tests exist for future opt-in sidecar work. The default product
  runtime remains mock-only.
- The current widget does not collect credentials, store passwords or tokens,
  test real database connections, run SQL against external systems, run
  `EXPLAIN`, format SQL, provide AI query assistance, expose a Workspace Agent
  JDBC execution tool, launch Terminal, mutate Git, or affect Agent Queue or
  Agent Executor behavior.
- This bounded mock/safe read-only path is accepted as Current Preview
  behavior. Production JDBC execution, credential expansion, write SQL,
  `EXPLAIN` workflows, broad database automation, production sidecar runtime,
  and hidden Workspace Agent-triggered SQL execution remain Deferred.

### Knowledge / Skills

- Current Ready / MVP Knowledge / Skills widget. It uses the
  existing `skill-library` widget identity for persistence compatibility and
  provides Skills plus a Documents tab.
- Provides explicit operator-authored Skill record create, list, read, update,
  delete, review-status, and tags flows through workspace Skill APIs.
- Provides explicit Knowledge Document create, list, read, update, delete, and
  search flows through separate Knowledge Document APIs. Knowledge Documents
  can be workspace-local or local-global.
- Provides explicit operator-triggered import of one plain text or Markdown
  file (`.txt`, `.md`, `.markdown`) into a workspace-local or local-global
  Knowledge Document.
  Imported content is stored through the same Knowledge Document create path as
  manually authored documents.
- Workspace Agent can create new workspace-local Knowledge Documents and Skills
  only from approved visible catalog proposal drafts plus a separate explicit
  create action. Drafts use visible conversation/assistant text only and do not
  read Notes, files, logs, Queue/Executor output, Git/JDBC/Terminal state,
  Evidence, Context Packs, team/server knowledge, or hidden Workspace context.
- Desktop/Tauri persists Skills through local SQLite-backed workspace Skill
  APIs. Browser/Vite development mode uses a frontend-only, non-persistent
  in-memory Skill API for create/list/read/update/delete UI iteration.
- Desktop/Tauri persists Knowledge Documents through local SQLite-backed
  workspace Knowledge Document APIs. Browser/Vite development mode uses a
  frontend-only, non-persistent in-memory Knowledge Document API for UI
  iteration.
- Skill records are text fields for reusable work instructions: title, when to
  use, prerequisites, steps, validation, risks, tags, and review status.
- Review statuses are `draft`, `needs_review`, `reviewed`, and `deprecated`.
- Knowledge Documents are plain-text/Markdown reference records with title,
  source label, content, tags, enabled flag, scope, and deterministic text
  chunks. Workspace-scoped documents belong only to one Workspace. Global
  documents are local-user/global records available across Workspaces in this
  desktop database. Import is limited to explicit single-file plain
  text/Markdown reads.
  No PDF/DOCX parsing, binary parsing, folder scan, watcher, hidden ingestion,
  embeddings, vector database, Evidence store, Context Pack builder,
  team/server sharing, server runtime, or RBAC is implemented.
- Knowledge / Skills is operator-authored. It is not Evidence,
  not a Context Pack, not a Runbook executor, not hidden AI memory, and not
  sent to Workspace Agent or provider prompts automatically.
- Can explicitly attach the selected Skill to Workspace Agent as visible
  current-session composer context. The attachment includes only title, when to
  use, prerequisites, steps, validation, risks, tags, and review status. It is
  editable/removable before Send and does not send automatically.
- Knowledge / Skills does not auto-search Skills for Workspace Agent, does not silently
  include Skills in provider prompts, and does not create hidden provider
  context.
- Workspace Agent-owned Codex runs automatically check enabled workspace-local
  Knowledge Documents plus enabled local-global Knowledge Documents before Run
  with Codex using the latest composer message as the search query. Matching
  snippets are capped, included visibly in the Direct Work details with
  Workspace/Global scope labels, and added to the Codex prompt only for that
  run. No disabled documents, Skills, Notes, files, logs, or hidden Workspace
  context are searched by this path.
- Knowledge / Skills does not implement Knowledge Items, Evidence links,
  Context Pack links, Artifact links, Notes-to-Knowledge promotion, Runbook
  execution, tool execution, team/server sharing, RBAC, embeddings/vector DB,
  PDF/DOCX parsing, folder scanning, filesystem watchers, hidden ingestion, or
  server runtime behavior.

### Runbook

- Current preview local/manual procedural step widget.
- Provides a built-in local sample runbook, selectable step details, step
  states, and local notes/evidence text for the current widget session.
- Step states are `pending`, `running`, `done`, `failed`, `skipped`, and
  `blocked`.
- Does not persist runbooks, edit/build templates, execute steps, launch Agent
  Executor, create Queue items, integrate with Workspace Agent, execute
  Terminal commands, mutate files, or mutate Git.

## Compatibility / Deprecated Surfaces

- `agent-run` remains the internal Agent Executor definition id for persisted
  compatibility. Do not rename it in cleanup tasks.
- `interactive-agent` remains the internal Workspace Agent definition id and
  component key for persisted compatibility. Coordinator Chat was the previous
  user-facing name for this surface. Do not rename the id in cleanup tasks.
- `skill-library` remains the internal Knowledge / Skills definition id and
  component key for persisted compatibility. Skill Library was the earlier
  user-facing title for this surface. Do not rename the id in cleanup tasks.
- Placeholder-named components such as `AgentRunPlaceholderWidget`,
  `AgentQueuePlaceholderWidget`, `InteractiveAgentPlaceholderWidget`, and
  `NotesPlaceholderWidget` may contain current product UI. The names are
  Compatibility implementation details, not preferred product names.
- Retired persisted widget ids are filtered from the current canvas render path
  when they are not in the user-facing widget registry. This cleanup does not
  migrate, delete, or rewrite retired widget data.
- Legacy Agent Executor titles such as Agent Run, Agent Monitoring, and Direct
  Work / Codex may be normalized in the visible frame title, but the preferred
  current product name is Agent Executor.
- Agent Chat, Agent Monitoring, and proposal-era backend/frontend APIs are not
  preferred current user-facing widgets. Some commands and frontend API modules
  remain wired as Compatibility or pending-retirement code paths, including
  proposal persistence, proposal generation, monitoring snapshots, and
  proposal-to-Queue-item creation. See
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` for the compatibility
  boundary and cleanup options.
- The Terminal one-shot command runner is a Compatibility fallback, not the
  normal Terminal surface and not Script Runner.
- The older Notes widget-local `{ "body": "..." }` state is
  Compatibility/Deprecated for new product work.

## Deferred / Future Surfaces

These surfaces are not current user-facing widgets and must not be implemented
or surfaced unless explicitly requested by a future task:

- Agent Chat as a separate preferred widget
- Agent Monitoring as a separate preferred widget
- Template Library
- Dock
- Agent CLI
- Script Runner
- JIRA
- Confluence
- Image Edit
- separate legacy Coordinator preview surface
- Knowledge Catalog
- Stages
- full Notebook
- real Runbook engine
- real JDBC connector runtime with credentials or external database execution
- real Workspace Agent widget capability execution
- Terminal catalog gating on unsupported platforms
- Linux/macOS Terminal PTY support
- Evidence/Sources capture and AI context packs
- true external OS/Tauri widget popout windows
- Dock rails, Compact/Indicator modes, presence-zone persistence, snapping,
  collision detection, auto-reflow, and preset editing

## Dev / Smoke Entry Points

Smoke HTML files under `apps/desktop/frontend/smoke/dev/` are
development/smoke entry points, not current product surfaces, user-facing
widgets, production routes, or catalog entries.

Known smoke entry points include:

- `apps/desktop/frontend/smoke/dev/coordinator-provider-product-smoke.html`
- `apps/desktop/frontend/smoke/dev/jdbc-read-only-ui-smoke.html`
- `apps/desktop/frontend/smoke/dev/queue-executor-ui-smoke.html`

Use them through Vite dev URLs under `/smoke/dev/`.

## Known Drift / Follow-Up Decisions

- Agent Chat / Agent Monitoring / proposal-era commands and frontend APIs:
  compatibility alignment is documented in
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md`; future cleanup should
  either retire/delete the old paths or keep narrowed compatibility APIs.
- JDBC read-only execution: completed for Phase 1 docs. The shipped bounded
  mock/safe read-only query UI is Current Preview; production JDBC execution
  and hidden Workspace Agent-triggered SQL remain Deferred.
- Terminal platform support: completed for Phase 1 docs. Live PTY support is
  Windows-only in shipped backend code; non-Windows live PTY creation is
  unsupported. Catalog gating and Linux/macOS PTY support remain Deferred.
- Smoke HTML root cleanup: completed. The remaining smoke follow-ups are
  checklist discipline, current behavior smoke checklists, and optional e2e
  automation later.
- Remaining legacy Coordinator compatibility names in code and filenames are
  retained until an explicit migration/refactor block.
