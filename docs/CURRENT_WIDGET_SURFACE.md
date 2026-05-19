# Current Widget Surface

## Purpose

This document captures the current simplified Hobit widget surface after the
agent surface cleanup and first local MVP widget slices.

It is an inventory and boundary document only. It does not add runtime
behavior, backend commands, storage, schema, queue execution, Git mutation, or
new widgets.

Contract-reading navigation is defined in
`docs/ACTIVE_CONTRACT_INDEX.md`.

## Current User-Facing Widgets

Ready:

- Agent Executor
- Git
- Terminal
- Notes

Preview:

- Agent Queue
- Coordinator Chat
- Database / JDBC
- Runbook

Coordinator-centered direction is defined in
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`. Coordinator Chat currently
uses the existing `interactive-agent` widget id/component as a compatibility
local-chat foundation rather than adding a second separate chat surface.
Coordinator-visible widget capability boundaries are defined in
`docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`; the current UI does not implement a
runtime Coordinator capability registry or broad widget tool execution. The
current Coordinator UI can create a draft Agent Queue task or workspace-local
Note only after explicit proposal approval and a separate create action.
The first Coordinator provider/runtime boundary is defined in
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`: provider calls may draft text and
proposal cards only, with explicit visible context and
`allowed_tools: []`. The current implementation has a backend-owned
mock/local response path that can return text plus validated safe proposal
drafts for review cards, plus a backend-selected external-provider
configuration placeholder that can report not-configured/unsupported state
without exposing credentials. External LLM calls are not implemented.
Future Evidence/Sources trust boundaries are defined in
`docs/EVIDENCE_SOURCES_CONTRACT.md`; the current UI does not implement evidence
capture, evidence review, citations, or AI context packs.

Future product polish for these surfaces should follow
`docs/PRODUCT_UI_VISUAL_CONTRACT.md`: dark dotted Workbench canvas, grid-aware
widget placement direction, thin top bar, shared dark/glass widget card
language, compact controls, semantic status chips, and no overclaiming of
future widget capability.

## Current Widget Status

### Agent Executor

- Implemented Direct Work execution surface.
- Uses the Codex CLI Direct Work path.
- Reuses the internal `agent-run` widget id for persistence compatibility.
- Each Agent Executor widget instance is shown as an execution slot using a
  compact label derived from its stable widget instance id.
- Shows run state, live logs, stop run, result output, changed-files summary,
  Git read-only handoff, and validation capture.
- Provides a read-only backend/Tauri API for stored Direct Work and Direct Work
  validation run history, with a compact read-only frontend history/detail UI.
- Provides a read-only backend/Tauri diff summary API for an explicit repository
  root, with a compact read-only frontend diff summary UI.
- Current Direct Work requires an explicit execution workspace path. The
  compatibility API/storage field is `repo_root`, and today it expects an
  existing repository or local project folder.
- Does not auto-commit, auto-push, mutate Git, or run as a hidden background
  scheduler. Queue assignment can target Executor slots, and explicit
  Queue-started runs are governed by
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

### Git

- Read-only repository status and diff surface for an explicit transient
  repository root.
- Explicit local commit API/UI exists for Git Widget, with selected files,
  an operator-provided message, and operator confirmation.
- The Git Widget does not push, reset, clean, stash, fetch, poll, watch, or
  automatically commit repositories.
- Explicit local commit support is governed by
  `docs/GIT_COMMIT_SUPPORT_CONTRACT.md`; push, reset, clean, auto-commit, and
  Agent Executor auto-commit are not implemented.

### Terminal

- Desktop-only Terminal widget with a PTY-first manual shell surface.
- PTY session UI uses explicit shell executable, optional shell argv, explicit
  execution workspace / working directory, visible status, bounded
  session-only output buffer display, stdin send, manual refresh/polling,
  resize by columns/rows, Stop, Kill with confirmation, and Close.
- PTY output/history is not persisted to storage, does not create widget
  run/result records, and is not sent to AI, Queue, Git, Notes, Agent
  Executor, or Evidence/Sources.
- Browser/Vite fallback and unsupported platforms report unsupported state
  honestly.
- The legacy one-shot command runner is demoted from the normal Terminal
  surface into a collapsed fallback. It still uses explicit program, argv,
  working directory, timeout, and output caps, creates widget run/log/result
  records, and shows the final stdout/stderr result when explicitly opened.
- Terminal does not implement tabs, split panes, persistent command history,
  persistent transcripts, shell profiles, environment/secrets support,
  Agent-triggered execution, Queue-triggered execution, Coordinator control, or
  Script Runner behavior.
- Future interactive shell behavior is governed by
  `docs/TERMINAL_PTY_WIDGET_CONTRACT.md`.

### Notes

- Persists a minimal widget-state body draft shaped as `{ "body": "..." }`.
- Uses explicit save.
- Workspace-local Notes product UI exists for list, filter, create new, edit,
  save, and pin flows.
- Coordinator Chat can create a new workspace-local Note from an approved
  create-Note proposal using only visible title, body, and pinned fields.
- Future multi-note product direction is governed by
  `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.
- Does not implement the full Notebook model, tabs, Markdown rendering,
  diagrams, checklists, snippets, review notes, formatting tools, search UI,
  autosave, archive/delete UI, tags, or AI-in-Notes.

### Agent Queue

- Preview manual task queue surface.
- Singleton per Workspace for new Agent Queue widget insertion.
- Existing persisted duplicates are not deleted or migrated.
- Manual queue task backend/storage/Tauri/frontend API foundation exists for
  create, list, read, and update.
- Manual Queue-to-Executor assignment backend/storage/Tauri/frontend API
  foundation exists for assigning and clearing an Agent Executor slot.
- Manual Queue-to-Executor execution backend/Tauri/frontend API foundation
  exists for starting an assigned task in its assigned Agent Executor with an
  explicit execution workspace path.
- Queue-to-Executor handoff and final-status auto-refresh are frontend-owned
  current-session behavior. Agent Executor owns live logs and final results;
  Queue refreshes task status and does not duplicate execution output.
- Frontend product UI can create, list, select, edit, and explicitly save
  workspace queue tasks with title, description, prompt, status, and priority.
  It supports `running` as task status data, can manually assign or clear a
  visible Agent Executor slot when the task is not running, and can explicitly
  run an assigned task in its assigned Executor.
- Future task, dependency, and executor capacity model is governed by
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`. Manual assignment to Executor
  slots is governed by `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`.
  Manual run of an assigned task is governed by
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.
- Does not dispatch, schedule, approve/apply, automatically run assigned tasks,
  capture responses outside normal Direct Work artifacts, validate responses,
  mutate Notes, launch Terminal, or mutate Git.

### Coordinator Chat / Interactive Agent Compatibility

- Preview local chat MVP currently using the existing `interactive-agent`
  widget id/component for compatibility.
- Near-term direction is Coordinator Chat, not a separate freeform Interactive
  Agent plus Coordinator.
- Keeps messages in local React state for the current widget session.
- Shows local placeholder assistant responses.
- Shows deterministic local sample action proposal cards attached to the
  initial Coordinator message.
- Can generate deterministic local proposal cards from explicit operator chat
  messages for the same safe proposal types.
- Uses a frontend-only static proposal registry for safe preview types: create
  Agent Queue task, create Note, and prepare JDBC query suggestion text without
  execution.
- Proposal card controls Approve, Reject, Edit, and Copy update local proposal
  state or copy proposal details.
- Approved create-Agent-Queue-task proposals show a separate Create Queue task
  action that creates a workspace-scoped draft Queue task through the existing
  Agent Queue task API. The task is not assigned, dispatched, run, or handed to
  Agent Executor.
- Approved create-Note proposals show a separate Create Note action that
  creates a workspace-local Note from visible title, body, and pinned fields
  through the existing Notes API. Existing Notes content is not read, searched,
  or summarized.
- JDBC query suggestion proposal cards remain non-executing. They show the
  visible SQL suggestion in a reviewable monospace block and provide Copy SQL
  for copying only that SQL text.
- Local proposal generation uses only the explicit chat message. It does not
  read widget state, Notes, Terminal output, Git diffs, JDBC connector metadata,
  Agent Executor logs, filesystem data, or hidden Workspace context.
- Sends explicit operator chat messages through a backend-owned Coordinator
  provider response path in the Tauri desktop shell. Mock/local is the default
  provider. An explicit backend environment selection can choose an external
  provider placeholder, which reports not-configured or unsupported state
  without performing network calls. Requests include only the visible
  current-session chat transcript, visible local proposal draft summaries when
  present, compact safety instructions, and `allowed_tools: []`.
- The mock/local provider can return structured proposal drafts for create
  Agent Queue task, create Note, and JDBC SQL suggestion only. Drafts are
  validated before rendering; unsupported or unsafe drafts are rejected or
  degraded into visible assistant text and never execute.
- Browser/Vite fallback keeps the deterministic local response path and does
  not call a provider directly.
- Does not call an external LLM, send provider credentials to the frontend or
  prompt, execute broad tools, persist sessions, read hidden context, launch Agent Executor,
  integrate with Runbook, mutate files, mutate Git, run SQL, call JDBC
  connectors, or run Terminal commands.
- Provider-generated proposal cards use the same approval and handoff rules as
  local deterministic cards: Queue task creation and Note creation require a
  separate explicit create action after approval, while JDBC remains
  non-executing review/copy text only.

### Database / JDBC

- Preview connector metadata surface.
- Uses workspace-local JDBC connector metadata APIs for create, list, read, and
  update.
- Lets the operator create and edit non-secret connector descriptors:
  display name, database kind, driver kind, masked JDBC URL metadata,
  environment, read-only default, status, and notes.
- Shows a disabled future SQL workspace placeholder.
- Does not collect credentials, store passwords or tokens, test connections,
  run SQL, run `EXPLAIN`, format SQL, show real results, call AI, integrate
  with Coordinator Chat runtime, launch Terminal, mutate Git, or affect Agent
  Queue or Agent Executor behavior.

### Runbook

- Preview local/manual steps MVP for procedural work.
- Provides a built-in local sample runbook, selected step details, step states,
  and local notes/evidence.
- Step states are `pending`, `running`, `done`, `failed`, `skipped`, and
  `blocked`.
- Does not persist runbooks, edit/build templates, execute steps, launch Agent
  Executor, create queue items, integrate with Coordinator Chat, execute
  Terminal commands, mutate files, or mutate Git.

## Retired And Hidden Surfaces

These old or future surfaces are not visible in the current Widget Catalog or
current Workbench surface:

- Agent Chat
- Agent Monitoring
- Template Library
- Dock
- Agent CLI
- Script Runner
- JIRA
- Confluence
- Image Edit
- separate legacy Coordinator preview surface

Database/JDBC is now a current Preview catalog surface for connector metadata
only. The contract is defined in `docs/JDBC_WIDGET_CONTRACT.md`;
implementation must preserve read-only defaults, connector secret isolation,
explicit approval, capped results, and explicit AI context sharing.
Workspace-local JDBC connector metadata storage/API and frontend metadata UI
exist for create/list/read/update, but there is still no credential storage,
SQL execution, Java sidecar, `EXPLAIN`, AI assistance, or Coordinator tool
runtime.

## Compatibility Notes

- `agent-run` remains the internal Agent Executor id for persisted compatibility.
- Retired persisted widget ids are filtered from the current canvas render path.
- This cleanup does not migrate, delete, or rewrite retired widget data.
- Some backend proposal/review compatibility paths still exist, but they are not
  current catalog surfaces.

## Recommended Next Blocks

- Coordinator provider configuration / real provider preparation with tools
  disabled and explicit visible context only.
- Coordinator structured-draft UX smoke/hardening if provider drafts reveal UI
  issues.
- Later controlled widget capability bridge.
- Later Coordinator to JDBC read-only proposal flow after JDBC execution/result
  review exists.
- Evidence/Sources storage/API foundation.
- JDBC read-only query execution backend.
- JDBC query results UI.
- AI context/token economy contract.
- YouTube Analyst widget contract.
- Real desktop Queue-to-Executor smoke using `HOBIT_DATABASE_PATH`.
