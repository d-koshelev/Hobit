# Architecture Milestone Status

## Purpose

This checkpoint summarizes the architecture foundation refactor series and the
first Minimal Skill Library product slice.

It is a status note. It does not add behavior beyond the implemented Minimal
Skill Library MVP, audit emission, server runtime, enterprise/RBAC, scheduler
behavior, or Workspace Agent context wiring.

## Completed Foundation

- Desktop-first/server-ready guardrails are documented in
  `docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md`.
- Runtime adapter boundary types exist for future host/runtime separation.
- Runtime artifact classification exists for JDBC, Terminal, Direct Work /
  Agent Executor, and Git. These classifications are internal metadata today,
  not a new artifact store.
- Queue lifecycle/status vocabulary exists. The visible Sequential Queue
  Runner remains current-session frontend behavior, and Queue Autorun now has
  an explicit operator-armed desktop-local preview with a current-session tick.
  Queue still has no backend scheduler, durable runner, reconnect/resume, or
  server worker.
- `AuditEventEnvelope` v0 exists as type and contract vocabulary.
- `docs/AUDIT_EVENT_MAPPING_PLAN.md` maps current event-like surfaces to
  future audit readiness.
- Workspace Capability Boundary v0 exists as type and contract vocabulary.
- Capability Action / Approval / Causation v0 conventions exist as type-only
  vocabulary.
- Artifact Reference / Ownership v0 exists as metadata-only refs.
- Knowledge / Skills / Evidence / Context Pack product boundaries are
  documented.
- Minimal Skill Library / Knowledge MVP exists as workspace-local
  operator-authored Skill CRUD plus scoped plain-text/Markdown Knowledge
  Document CRUD/search with local SQLite storage, deterministic chunks, narrow
  Tauri APIs, and a preview widget. Knowledge Documents can be workspace-local
  or local-global within this desktop database.
- Knowledge / Evidence core refs v0 exist as type-only Rust refs.
- Context Pack refs v0 exist as type-only Rust refs.
- Workspace Agent context boundary inspection confirmed current provider requests
  remain visible-context-only with `allowed_tools: []`.
- Workspace Agent product positioning is foreground-agent first: planning,
  reasoning, task drafting, outcome review, and promotion decisions happen in
  Workspace Agent, while Queue and Agent Executor remain async/background
  execution surfaces.
- Multiple Workspace Agent widgets can exist in one Workspace. Each owns its
  own visible context/thread/working-directory state.
- The default new Workspace now starts as an `Untitled` Workspace Agent Workspace
  with Workspace Agent and Notes. Empty Workbench remains available as an
  advanced/manual mode, and existing empty Workspaces can add Workspace Agent
  plus Notes through an explicit recovery action.
- The Workbench top bar can close the current Workspace view and return to the
  Workspace Start Screen without deleting data. Recent Workspace summaries now
  include created/last-opened metadata and compact safe counts for widgets,
  Workspace Agents, notes, skills/documents, and Queue tasks; summaries do not
  include raw logs, prompts, Executor output, provider payloads, or result
  payloads. The Start Screen prioritizes recent Workspaces as the primary
  continuation panel when they exist, keeps New Workspace as a secondary
  creation panel, and the desktop default window size is larger for the MVP
  workbench/start layout.
- The frontend has local interface theme support with built-in presets and a
  small custom theme option. Theme application writes existing CSS token
  variables in the browser, persists as a local UI preference, and is not
  Workspace-scoped, server-synced, team-shared, or connected to backend/runtime
  behavior.
- Workspace Agent now has a frontend-only planning UI layer for explicit
  visible chat prompts: compact plan cards, visible Queue task draft proposal
  cards, and local-only multi-draft review controls. Queue task creation
  remains explicit draft creation only, and execution remains Queue/Executor
  controlled.
- Workspace Agent can locally review explicitly pasted Queue, Executor, or
  validation result text in visible chat. Outcome-review cards use only the
  pasted text, may draft follow-up Queue task proposals, and do not fetch
  Executor logs, Queue run history, artifacts, files, Context Packs, or hidden
  widget state. Follow-up Queue tasks remain explicit draft creation only.
- Queue latest-run/history rows and Agent Executor run-history/detail controls
  can attach safe run metadata to Workspace Agent as visible current-session
  composer context. Attach is operator-controlled, editable/removable before
  Send, and does not copy raw logs, stdout/stderr, final responses, diffs,
  prompts, repo paths, secrets, artifacts, or raw payloads.
- Agent Executor run detail can attach an explicit bounded excerpt selected by
  the operator from visible Executor-owned detail text. The excerpt appears as
  visible editable Workspace Agent composer context and is sent only if the
  operator presses Send. Workspace Agent still does not automatically read Executor
  logs or take ownership of raw Executor detail.
- Agent Executor run detail can also attach explicit bounded visible preview
  sections for final response, stdout, stderr, validation output, and error
  summary previews. Each attach requires an operator click, lands as visible
  editable Workspace Agent composer context, and does not copy full raw Executor
  logs or transfer raw detail ownership to Workspace Agent.
- Skill Library can explicitly attach the selected Skill to Workspace Agent
  as visible editable composer context. The attachment includes only the
  selected Skill's title, when to use, prerequisites, steps, validation, risks,
  tags, and review status, and it is sent to the provider only if the operator
  presses Send.
- Workspace Agent can draft visible Knowledge Document and Skill creation
  proposals from visible conversation content or visible `hobit-catalog-action`
  fenced JSON blocks in assistant/Codex text. Creation remains a separate
  operator action after approval, defaults to workspace-local Skill Library /
  Knowledge records, and does not scan or ingest Notes, files, Executor logs,
  Queue history, Git/JDBC/Terminal state, Evidence, Context Packs, team/server
  knowledge, embeddings, or binary documents.
- Workspace Agent-owned Codex runs automatically check enabled workspace-local
  Knowledge Documents plus enabled local-global Knowledge Documents before Run
  with Codex. Retrieval uses the latest composer message as the lexical query,
  returns capped snippets, shows the used knowledge/no-match state in Direct
  Work details with Workspace/Global scope labels, and adds matching snippets
  only to that run's Codex prompt.
- Workspace Agent Direct Mode v0 exists as a local desktop foreground Codex Direct
  Work path owned by Workspace Agent. It is off by default, uses the current
  composer message only after the operator enables Direct Mode and clicks the
  Run with Codex primary composer action, defaults its working directory input
  to `~`, resolves `~` to the current user's home directory in the
  Tauri/backend path before launch, and shows visible status, recent logs,
  Stop/cancel state when available, final result summary, and failures in
  Workspace Agent. Direct Mode composer submission starts a foreground
  Workspace Agent-owned Codex Direct Work run instead of producing a mock/local
  assistant response for that prompt. The operator can replace `~` with a
  project or repo folder. Workspace Agent Direct Mode captures Codex
  `thread.started` `thread_id` events, keeps the current thread id in
  current-session Workspace Agent widget state, resumes that explicit thread id for
  follow-up Run with Codex actions, and never uses `--last`. Resume sends only
  the latest composer message, not the full visible chat transcript. The
  visible New Codex thread action clears the thread id, and changing the
  working directory also clears it so the next run starts a new thread. Queue
  and Agent Executor Direct Work behavior remains unchanged.

## Still Type-Only Or Contract-Only

- Runtime artifact classification does not persist a separate artifact store.
- Audit Envelope v0 does not emit or persist audit events.
- Audit mapping is a plan, not a runtime.
- Capability Boundary v0 does not execute capabilities, enforce permissions,
  implement RBAC, or expose tools to Workspace Agent.
- Capability Action / Approval / Causation v0 does not create approval records
  or workflow state.
- `ArtifactRef` is metadata-only and unresolved by default.
- Knowledge and Evidence refs do not create Knowledge Item storage, evidence
  storage, resolver, ingestion path, or UI.
- Skill Library / Knowledge storage/API/UI does not create Knowledge Items,
  Evidence, Context Packs, Artifact links, Runbook execution, hidden memory,
  team/server sharing, embeddings/vector DB, PDF/DOCX parsing, or RBAC.
- Context Pack refs do not create Context Pack storage, selection UI,
  Workspace Agent context wiring, provider prompt wiring, or sharing behavior.

## Do Not Overclaim

The current desktop app remains the only real host/runtime path today.

Workspace Agent is a foreground chat-based agent work surface, but it uses
explicit visible current-session chat/proposal context only. It must not
silently ingest Notes, artifacts, evidence, knowledge, Context Packs, runtime
logs, widget state, Git/JDBC/Terminal state, Queue state, files, environment
values, or secrets.
Planning cards, pasted-result review cards, and Queue task drafts do not
change this context boundary and do not wire Context Packs, artifacts, logs,
Queue state, Executor state, or widget data into provider prompts.
Explicit Attach to Workspace Agent sends only the visible attached composer text
after the operator presses Send; it is not hidden context compilation and does
not read Queue history, Executor logs, or Skill Library records automatically.
Executor selected excerpts are bounded visible text selected by the operator;
raw Executor detail remains Executor-owned. Executor preview-section attaches
are also bounded to visible previews and require explicit operator section
actions. Skill attaches are selected visible Skill fields only and do not wire
Skill search, Context Packs, Evidence, or hidden provider prompt injection.

Queue is a supporting async execution pipeline for promoted/larger work
blocks, not the default place for every idea or small task. Agent Executor is
the async/background runtime owner for queued run detail, logs, final
responses, and history. Workspace Agent Direct Mode is a foreground agent
run path and does not create Queue tasks, start Queue Autorun, require an
Agent Executor widget, change Executor repo-root/task configuration behavior,
resume Queue/Executor Codex threads, or auto-commit, push, reset, clean, or
stash Git changes. Its Codex thread state is current-session Workspace Agent
widget state only, not global hidden memory.
Mock/local remains a visible fallback when Direct Mode is off or Codex is
unavailable, and must not be presented as connected AI.

Artifacts, Evidence, Knowledge, Skills, Context Packs, audit events,
capability actions, and approvals are separate concepts. A Skill record
existing does not mean it is evidence, AI context, a Runbook, executable, or
sent to a provider.

## Not Implemented

- artifact store;
- evidence store;
- full Knowledge Item store beyond scoped plain-text Knowledge Documents;
- Context Pack UI or storage;
- Context Pack provider wiring;
- hidden prompt augmentation;
- Workspace Agent hidden context access;
- hidden Workspace Agent Direct Mode starts;
- automatic Skill search or hidden Skill prompt injection;
- embeddings/vector DB;
- PDF/DOCX parsing or binary document ingestion;
- audit emission or persistence;
- approval workflow persistence;
- capability execution;
- permission checks, enterprise/RBAC, or organization/user model;
- server runtime or Postgres migration;
- backend scheduler, durable Queue runner, reconnect/resume, server worker, or
  hidden/unarmed auto-dispatch.
- Workspace Agent Direct Mode triggered Queue Autorun, Queue task creation, Agent
  Executor launch, server runtime, RBAC, or automatic Git mutation.

## Recommended Next Roadmap

### A. Safe Next Docs/Type-Only Blocks

1. Context Pack audit/capability mapping plan, docs-only.
2. Knowledge / Skills UI design contract, docs-only.
3. Knowledge store storage design, docs-only and no implementation.
4. Evidence review workflow contract, docs-only.
5. Workspace Agent explicit context selection UX contract, docs-only.

### B. Safe Inspect-First Audits

1. Re-check Workspace Agent/provider request construction after any context UI
   design work.
2. Inspect Notes, widget logs/results, and runtime artifact surfaces before
   any Knowledge ingestion proposal.
3. Inspect Queue Sequential Queue Runner boundaries before any durable runner
   or scheduler discussion.
4. Inspect audit/event-like surfaces before any audit emission pilot.

### C. Future Implementation Candidates

Only after the docs and inspect-first blocks above:

1. Explicit Attach Knowledge to Workspace Agent design, with visible review and no
   hidden provider send. The Skill attach MVP already exists for selected
   Skill fields only.
2. Explicit operator-selected Context Pack preview UI with no provider send.
3. Narrow metadata-only Knowledge item draft flow.
4. Narrow Evidence review draft flow that references `ArtifactRef` without
   copying raw payloads.

### D. Explicitly Deferred

- server runtime;
- enterprise/RBAC;
- Postgres migration;
- audit persistence;
- artifact store;
- evidence store;
- knowledge store;
- full Knowledge/Skills system beyond Minimal Skill Library MVP;
- Workspace Agent hidden context;
- Context Pack provider wiring;
- automatic Notes/artifact/log ingestion;
- hidden/unarmed auto-dispatch, durable Queue runner, reconnect/resume, or
  backend scheduler.
