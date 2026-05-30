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
with `#1e2124`, `#282b30`, `#36393e`, `#424549`, and the `#7289da` accent.
The current theme choice is a local UI preference persisted in browser/desktop
local storage under a stable frontend key. The custom theme option is
intentionally small: it edits accent, background, surface, raised surface,
text, muted text, and border colors with a color picker plus HEX input for
each editable color. The same Appearance UI also supports local UI scale
presets: 90%, 100%, 110%, 125%, and 150%, with 100% as the default. UI scale
is a frontend-local
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
Widgets added from the catalog use widget-specific default docked sizes so the
new surface is usable immediately. The defaults are persisted only for newly
inserted widgets and default-preset setup; existing saved widget positions and
sizes are not rewritten. Widget minimum-size metadata is used by the current
frontend resize clamp, and UI scale remains separate from grid/widget geometry
and layout persistence.

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
- Renders events as a compact readable timeline by default: each row shows a
  semantic status dot, short title, optional short summary, lifecycle status,
  and timestamp.
- Auto-follows the newest activity while the operator is at the bottom of the
  timeline, and pauses follow behavior when the operator scrolls away.
- Timeline events include run start, thread start, turn start, command start,
  command finish/failure, response preparation, and run completion/failure when
  those events are present in the existing stream.
- Rows expand on click for command, summary, details, raw preview, output
  preview, and run/source metadata when present.
- Raw event previews and technical details remain collapsed per event by
  default.
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
- The normal visible Terminal UI shows compact shell and working-directory
  context, an xterm-based interactive terminal surface, and explicit
  Start/Stop controls. Where the backend PTY is supported, xterm handles raw
  keyboard input, ANSI/control-sequence rendering, cursor movement, alternate
  screen behavior, and interactive programs such as `vi`, `less`, `nano`, and
  `top`. The editable working directory defaults to
  `~`, is available in collapsed Terminal settings, and resolves to the
  current user's home directory before the desktop PTY create request reaches
  the backend. Shell executable, shell args, cols/rows, output cap bytes,
  runtime-only buffer details, and the compatibility fallback are also
  accessible from Terminal settings and are collapsed by default.
- PTY output is written raw from the session-only backend buffer into xterm so
  xterm can render ANSI colors, cursor controls, and terminal screen updates.
  The raw session-only backend buffer remains unchanged.
- PTY output is a bounded session-only buffer. It is not persisted as widget
  logs/results and is not sent to Workspace Agent, Queue, Agent Executor,
  Git, Notes, JDBC, or Evidence/Sources.
- PTY session support is currently implemented for Windows desktop through
  ConPTY and for Linux desktop through a native Unix PTY backend. Other
  desktop platforms compile but live PTY creation returns an
  unsupported-platform error until platform support or catalog gating is
  implemented.
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

### Workspace Agent

- Current Ready / MVP foreground interactive AI agent widget shown as
  Workspace Agent and compatibility foundation for the target foreground agent
  surface.
- It is chat-based, but not merely a chat widget: the operator uses it for
  planning, reasoning, coding/review prompts, task drafting, outcome review,
  and deciding what should become Queue or Executor work.
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
  visible result text. Queue task creation remains explicit and creates a
  draft task only; it does not assign, start, run, or arm Queue Autorun.
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
  operator can replace `~` by typing a project or repo folder or by using the
  Browse control to select one directory on supported desktop platforms. Browse
  opens a directory picker only. The working directory can still be typed
  manually when Browse is unavailable or canceled. Browse only returns the
  selected directory path for the working directory field; it does not scan the
  folder, persist it, or start a run.
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
  operator prompts and Codex final responses, with the composer directly below
  the transcript and no normal-view Agent details/provider diagnostics chrome.
  Direct Work lifecycle details and raw technical data stay available in the
  collapsed Direct Work details/status area below the composer controls.
  Workspace Agent also publishes current-session readable activity events
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

## Current Preview Surfaces

### Agent Queue

- Current preview Queue + Workers async task organization and
  execution-support surface.
- Uses the `agent-queue` widget definition id.
- Intended for promoted/larger work blocks that need async organization,
  assignment, sequencing, or later review. It is not the default destination
  for every Workspace Agent idea, small decision, or quick operator action.
- Provides workspace-local task create, list, read, update, delete, filter,
  select, and explicit edit/save/cancel flows for title, description, prompt,
  queue tag, item type, priority, execution policy, and validation status.
  Execution status is displayed for review and is not directly finalized from
  the edit form. The current frontend also has a
  model/UI foundation for queue tags, item type, separate validation status,
  worker scope, and coordinator-owned review state. These foundation fields
  default existing/basic persisted tasks to the `Default` queue tag,
  `implementation` item type, and `not_started` validation without a storage
  migration in this block.
- Queue tags are routing/dependency-affinity groups, not just visual labels.
  The current Queue sidebar has explicit local tag management: create an empty
  tag, rename a tag, pause/resume a tag, and delete an empty tag after
  confirmation. Tags show item count, running count, validation counts, and
  coordinator-review state. Because there is no separate persisted tag schema,
  empty tags are frontend model state, while renaming a tag with items updates
  those items through the existing Queue task update path and preserves the
  stable tag id. Deleting a non-empty tag is blocked with a "Reassign items
  before deleting" message; deleting a tag with running items is blocked and
  does not kill work. Full tag merge/reassign workflows, persisted tag records,
  dependency execution, and backend scheduler enforcement remain future work.
- Queue tasks may list other Queue task ids in a frontend/model-compatible
  `dependsOn` list. Existing/basic tasks default to no dependencies. The Queue
  UI derives dependency state as ready, blocked, or invalid, shows compact
  dependency badges and "Blocked by" summaries, and lets the operator add or
  remove dependencies in explicit item edit mode. Self-dependencies, missing
  dependency ids, and cycles are rejected. A dependency is treated as satisfied
  only when the prerequisite task is completed and coordinator-finalized in the
  current model; this is the conservative current approximation for completed,
  reviewed, and accepted work.
- Dependency edits use the same safe edit-save flow as other item edits:
  saving pauses the target queue tag for coordinator review, marks the item for
  review, and does not start workers, Executor work, Queue Autorun, or hidden
  scheduling. Deleting a prerequisite task is blocked while other tasks still
  depend on it so dependent tasks do not silently become ready.
- Dependency state gates readiness/eligibility only. It blocks selected-task
  manual run readiness, Queue Autorun arming, and frontend Sequential Queue
  Runner selection when dependencies are blocked or invalid. It does not add a
  backend dependency engine, scheduler claiming, automatic acceptance, worker
  finalization, rollback execution, Agent Executor runtime changes, or Codex
  Direct Work changes.
- Queue tasks use the existing numeric priority model (`0` through `5`, with
  existing/basic tasks defaulting to `0`) plus a frontend/model-compatible
  stable order inside each queue tag and priority band. The current visible
  order is deterministic by queue tag, priority, manual order/created order,
  and task id. Manual reorder controls and top/bottom task insertion are
  explicit UI actions; they update only Queue organization, pause the affected
  tag for review where applicable, and do not start work.
- Agent Worker configuration is persisted per Workspace through a narrow
  worker-config model. Worker records store durable configuration only:
  worker id, name, enabled/disabled flag, display order, and scope to all
  queues or one queue tag. The browser/Vite development fallback keeps safe
  in-memory worker config behavior.
- Visible Agent Executor slots can seed default Agent Worker configs for
  legacy Workspaces with no persisted workers. Worker config edits, including
  add, rename, enable/disable, remove, and scope changes, do not spawn a
  worker, start Codex, assign work, auto-run Queue items, or change Agent
  Executor runtime behavior. Live process state, current execution state,
  temporary failures, and live logs are not treated as durable Agent Worker
  truth.
- Scoped Agent Workers can be general-purpose or scoped to one queue tag. Tag
  rename keeps scoped worker display coherent through the stable tag id/name
  model. Deleting an empty scoped tag safely moves affected workers back to
  All queues; deleting non-empty/running tags remains blocked by the existing
  tag safety rules.
- Worker routing rules exist as a deterministic frontend/model and UI
  explanation foundation. A worker is eligible for an item only when the worker
  is enabled, the item is in a runnable execution state with a prompt, the item
  is not awaiting coordinator review or validation-in-progress, its queue tag
  is not paused, dependencies are satisfied and valid, worker scope matches the
  item queue tag, and any manual worker assignment matches that worker.
  Disabled/scoped workers, paused tags, dependency blockers, invalid
  dependency graphs, coordinator-review gates, and assignment mismatches are
  shown as stable human-readable blocked reasons. Priority/order choose only
  among otherwise eligible items by priority, order/created order, and task id.
  This routing foundation does not claim, schedule, start, or finalize work.
- A deterministic Queue scheduler eligibility engine exists as a dry-run model
  foundation. It aggregates the routing, dependency, tag pause, assignment,
  coordinator-review, validation-in-progress, prompt, priority, and global
  START / STOP / STOP + KILL RUNNING controls into an explainable plan. The
  plan shows global scheduling state, schedulable item counts, best next item
  per worker when START is active, blocked item summaries, top blocker labels,
  unassigned eligible items, and why a worker is idle or why no worker can take
  an item. It is explanation-only: it does not claim items, start workers,
  launch Agent Executor/Codex, persist live worker state, run a background
  scheduler, or finalize item status.
- The Queue widget has a Flow Map view alongside the existing table/list and
  selected-task detail controls. Flow Map is a visual overview of queue tags,
  dependency layers/barriers, the Agent Executor section, spare/working
  executor blocks, dry-run next/idle labels from the scheduler plan, and final
  result blocks grouped by tag. Work-item blocks can be clicked to select the
  existing task detail panel, but the view does not start work, claim items,
  schedule workers, launch Agent Executor, finalize status, persist live worker
  process state, or change Queue Autorun,
  Sequential Runner, Codex Direct Work, Agent Executor, or Workspace Agent
  runtime behavior. The table/list view and all existing edit, dependency,
  routing, worker assignment, tag pause/resume, priority/order, manual run,
  and Autorun controls remain available.
- Each queue task shows execution status separately from validation status.
  `validating` has a lightweight visual indicator meaning validation/review is
  happening, not worker execution.
- Supported task item types in the frontend model are `implementation`,
  `diff_review`, `follow_up`, and `validation`. Diff Review items are
  independent review work items; they do not modify code by default, and no
  automatic Git diff verification runtime is implemented in this block.
- The Queue + Workers sidebar has local START, STOP, and STOP + KILL RUNNING
  controls. START opens the local model for eligible worker scheduling but
  does not auto-run queue items or start real workers. STOP prevents new
  local worker scheduling. STOP + KILL RUNNING records a visible local intent;
  actual process termination, where supported, remains owned by Agent Executor
  controls and affected items require coordinator review.
- Editing a queue task locally pauses the target queue tag and marks the item
  for coordinator review in the frontend model with the message: "Editing
  paused this queue tag until coordinator review." If an edit moves the item to
  another tag, the target tag is paused and the previous tag is also marked for
  review locally. Scoped worker assignment is revalidated after a tag move.
  Resume tag is an explicit coordinator action; it clears the local tag
  pause/review gate but does not start workers, arm Autorun, run any item, or
  kill already running Executor work. Manually pausing/resuming a tag uses the
  same eligibility gate: paused tags block new manual run readiness, Queue
  Autorun arming, and Sequential Queue Runner selection, but pause/resume never
  starts or stops real execution by itself.
- Final item status is coordinator/workspace-owned in the model. Worker
  reports, validation results, and Diff Review reports are inputs for later
  coordinator decisions; workers must not directly finalize items as
  done/failure automatically.
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
  Queue. The runner scans the current ordered Queue task list after worker
  routing, dependency, tag, policy, prompt, and assignment gates; priority/order
  only choose among otherwise eligible items. The runner assigns
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

### Database / JDBC

- Current preview Database / JDBC widget.
- Provides workspace-local connector metadata create, list, read, update, and
  selection flows.
- Connector metadata is non-secret: display name, database kind, driver kind,
  masked JDBC URL metadata, environment, read-only default, status, and notes.
- Experimental JDBC connection profiles are implemented as workspace-local,
  non-secret desktop SQLite metadata for the sidecar runtime. They store
  profile id/name, explicit driver JAR path, driver class, JDBC URL only after
  rejecting obvious value-bearing password/token/secret/key parameters,
  optional username, password environment variable name, row limit, timeout,
  max result bytes, read-only flag, description, and timestamps. They never
  store password values, API tokens, Kerberos tickets, private keys, client
  certificates, or secret-bearing connection strings.
- A read-only SQL validation/execution UI is shipped and wired through
  frontend, Tauri command, backend adapter, and tests.
- The current product execution path is bounded mock/safe execution: it
  validates conservative read-only SQL, applies row/timeout caps, and renders
  deterministic bounded mock results or sanitized validation/runtime errors.
  The current validator recognizes `EXPLAIN` only as a mock-path wrapper around
  supported read-only SQL; no real database `EXPLAIN` or plan visualization
  exists.
- Current runtime status is mock-default. The active default product path uses
  `MockReadOnlyJdbcAdapter`.
- An Experimental real read-only Java sidecar prototype exists for one
  explicit operator-triggered Run from the JDBC widget. It is opt-in per run,
  requires explicit runtime-only Java/sidecar/driver/JDBC URL inputs, uses a
  password environment variable name rather than a password value, and persists
  only the non-secret profile metadata described above.
- The Experimental sidecar section includes a compact profile selector plus
  Save profile, Save as new profile, Delete profile, and unsaved-changes
  controls. Selecting a profile only fills visible runtime fields; it does not
  connect, probe, validate SQL, run SQL, or launch Workspace Agent, Queue, or
  Executor work.
- The Experimental sidecar section includes explicit Runtime diagnostics:
  Check sidecar and Probe driver. Check sidecar starts the explicit Java
  sidecar and requires a HealthCheck response. Probe driver loads only the
  explicit driver JAR/class. Diagnostics are manual operator actions, do not
  run automatically, do not execute SQL, do not connect to a database, do not
  persist runtime config, and show compact OK/Failed status with collapsed
  details.
- Experimental real sidecar execution is a Preview / happy-path prototype. It
  loads only an explicit driver JAR path, does not scan folders, does not
  download drivers or bundle proprietary drivers, applies row/time/result
  caps, asks JDBC for read-only mode where supported, and uses a stricter MVP
  SQL guard that allows only single-statement `SELECT` or `WITH`.
- The visible widget shows connector/profile status, read-only safety copy,
  the query editor, explicit `Run read-only query`, visible result/error
  panels, capped read-only result tables with row/column/duration/truncation
  summaries, visible row/timeout/result-byte caps, copy-visible-results
  controls, and collapsed runtime details. Missing or unsupported runtime
  paths are shown as compact redacted visible errors such as `not_configured`
  or `unsupported_driver`.
- The visible widget includes a frontend-only Boundary Finder preview section.
  It provides sample preset selection, preset description, generated typed
  filter inputs, numeric range min/max/precision inputs, a sample probe value
  input, safe rendered SQL preview, and visible validation errors. Boundary
  Finder execution/probing is not wired; it does not run JDBC queries, call the
  sidecar, persist presets, store credentials, create Queue/Executor work, or
  give Workspace Agent any JDBC execution path.
- A backend adapter boundary, runtime config loader, Java sidecar prototype,
  and JDK-gated tests exist for opt-in sidecar work. The default product
  runtime remains mock-only.
- Developer sidecar smoke is available through
  `node scripts/hobit/smoke-jdbc-sidecar.mjs`. It requires `java` and `javac`
  on `PATH`; without them it reports a clear skip. With no arguments it
  compiles the sidecar if needed and runs HealthCheck only. DriverProbe is
  optional and loads only an explicit driver JAR/class without connecting to a
  database. Optional real DB smoke requires explicit user-provided driver, JDBC
  URL, and SELECT/WITH query arguments, uses `--password-env` instead of a
  password value, rejects obvious secret-bearing JDBC URL parameters, and is
  not required by normal validation. Current local smoke status: HealthCheck
  passed after Java/JDK installation, and optional H2 in-memory `SELECT 1`
  passed with an operator-provided H2 2.4.240 driver JAR, `org.h2.Driver`,
  `jdbc:h2:mem:hobit_smoke;DB_CLOSE_DELAY=-1`, and one returned row. External
  DB smoke remains pending.
- Future real JDBC execution must use explicit operator Run or a later approved
  widget-owned proposal, runtime-only/approved secret handling, explicit
  user/admin driver JAR configuration, read-only SQL enforcement in both Rust
  and the sidecar, JDBC `setReadOnly(true)` when supported, row/time/result
  caps, redacted errors, visible results, and no hidden AI execution.
- The current widget does not collect password values, store passwords or
  tokens, run real database `EXPLAIN`, format SQL, provide AI query assistance, expose a
  Workspace Agent JDBC execution tool, let Workspace Agent run SQL
  automatically or hidden, ingest JDBC results/errors as AI context, launch
  Terminal, mutate Git, affect Agent Queue or Agent Executor behavior, or run
  Boundary Finder probes. Real DB smoke requires a user-provided driver and
  database.
- Future real connectors must keep secrets runtime-only or in a separately
  approved OS secret store/keychain integration, require explicit operator Run,
  enforce read-only SQL, row/time/result caps, sanitized visible errors, and
  visible result preview before any future AI context sharing.
- This bounded mock/safe read-only path plus the opt-in Experimental sidecar
  prototype are accepted as Current Preview behavior. Production JDBC
  execution, credential expansion, write SQL, `EXPLAIN` workflows, broad
  database automation, production sidecar runtime, and hidden Workspace
  Agent-triggered SQL execution remain Deferred.

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
- macOS Terminal PTY support
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
  implemented for Windows and Linux desktop builds. Other desktop platforms
  return an unsupported-platform error. Catalog gating and macOS PTY support
  remain Deferred.
- Smoke HTML root cleanup: completed. The remaining smoke follow-ups are
  checklist discipline, current behavior smoke checklists, and optional e2e
  automation later.
- Remaining legacy Coordinator compatibility names in code and filenames are
  retained until an explicit migration/refactor block.
