# Architecture Milestone Status

## Purpose

This checkpoint summarizes the architecture foundation refactor series and the
first Minimal Skill Library product slice.

It is a status note. It does not add behavior beyond the implemented Minimal
Skill Library MVP, audit emission, server runtime, enterprise/RBAC, scheduler
behavior, or Coordinator context wiring.

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
- Minimal Skill Library MVP exists as workspace-local operator-authored Skill
  CRUD with local SQLite storage, narrow Tauri APIs, and a preview widget.
- Knowledge / Evidence core refs v0 exist as type-only Rust refs.
- Context Pack refs v0 exist as type-only Rust refs.
- Coordinator context boundary inspection confirmed current provider requests
  remain visible-context-only with `allowed_tools: []`.
- Coordinator product positioning is central-work-surface first: planning,
  reasoning, task drafting, outcome review, and promotion decisions happen in
  Coordinator, while Queue and Agent Executor remain supporting execution
  surfaces.
- Coordinator Chat now has a frontend-only planning UI layer for explicit
  visible chat prompts: compact plan cards, visible Queue task draft proposal
  cards, and local-only multi-draft review controls. Queue task creation
  remains explicit draft creation only, and execution remains Queue/Executor
  controlled.
- Coordinator Chat can locally review explicitly pasted Queue, Executor, or
  validation result text in visible chat. Outcome-review cards use only the
  pasted text, may draft follow-up Queue task proposals, and do not fetch
  Executor logs, Queue run history, artifacts, files, Context Packs, or hidden
  widget state. Follow-up Queue tasks remain explicit draft creation only.
- Queue latest-run/history rows and Agent Executor run-history/detail controls
  can attach safe run metadata to Coordinator Chat as visible current-session
  composer context. Attach is operator-controlled, editable/removable before
  Send, and does not copy raw logs, stdout/stderr, final responses, diffs,
  prompts, repo paths, secrets, artifacts, or raw payloads.
- Agent Executor run detail can attach an explicit bounded excerpt selected by
  the operator from visible Executor-owned detail text. The excerpt appears as
  visible editable Coordinator composer context and is sent only if the
  operator presses Send. Coordinator still does not automatically read Executor
  logs or take ownership of raw Executor detail.
- Agent Executor run detail can also attach explicit bounded visible preview
  sections for final response, stdout, stderr, validation output, and error
  summary previews. Each attach requires an operator click, lands as visible
  editable Coordinator composer context, and does not copy full raw Executor
  logs or transfer raw detail ownership to Coordinator.
- Skill Library can explicitly attach the selected Skill to Coordinator Chat
  as visible editable composer context. The attachment includes only the
  selected Skill's title, when to use, prerequisites, steps, validation, risks,
  tags, and review status, and it is sent to the provider only if the operator
  presses Send.

## Still Type-Only Or Contract-Only

- Runtime artifact classification does not persist a separate artifact store.
- Audit Envelope v0 does not emit or persist audit events.
- Audit mapping is a plan, not a runtime.
- Capability Boundary v0 does not execute capabilities, enforce permissions,
  implement RBAC, or expose tools to Coordinator.
- Capability Action / Approval / Causation v0 does not create approval records
  or workflow state.
- `ArtifactRef` is metadata-only and unresolved by default.
- Knowledge and Evidence refs do not create a knowledge store, evidence store,
  resolver, ingestion path, or UI.
- Skill Library storage/API/UI does not create Knowledge Items, Evidence,
  Context Packs, Artifact links, Runbook execution, Coordinator context
  eligibility, provider prompt wiring, hidden memory, global/team sharing, or
  RBAC.
- Context Pack refs do not create Context Pack storage, selection UI,
  Coordinator context wiring, provider prompt wiring, or sharing behavior.

## Do Not Overclaim

The current desktop app remains the only real host/runtime path today.

Coordinator Chat is the central chat-based operator work surface, but it uses
explicit visible current-session chat/proposal context only. It must not
silently ingest Notes, artifacts, evidence, knowledge, Context Packs, runtime
logs, widget state, Git/JDBC/Terminal state, Queue state, files, environment
values, or secrets.
Planning cards, pasted-result review cards, and Queue task drafts do not
change this context boundary and do not wire Context Packs, artifacts, logs,
Queue state, Executor state, or widget data into provider prompts.
Explicit Attach to Coordinator sends only the visible attached composer text
after the operator presses Send; it is not hidden context compilation and does
not read Queue history, Executor logs, or Skill Library records automatically.
Executor selected excerpts are bounded visible text selected by the operator;
raw Executor detail remains Executor-owned. Executor preview-section attaches
are also bounded to visible previews and require explicit operator section
actions. Skill attaches are selected visible Skill fields only and do not wire
Skill search, Context Packs, Evidence, or hidden provider prompt injection.

Queue is a supporting async execution pipeline for promoted/larger work
blocks, not the default place for every idea or small task. Agent Executor is
the runtime owner for run detail, logs, final responses, and history.

Artifacts, Evidence, Knowledge, Skills, Context Packs, audit events,
capability actions, and approvals are separate concepts. A Skill record
existing does not mean it is evidence, AI context, a Runbook, executable, or
sent to a provider.

## Not Implemented

- artifact store;
- evidence store;
- knowledge store;
- Context Pack UI or storage;
- Context Pack provider wiring;
- hidden prompt augmentation;
- Coordinator hidden context access;
- automatic Skill search or hidden Skill prompt injection;
- audit emission or persistence;
- approval workflow persistence;
- capability execution;
- permission checks, enterprise/RBAC, or organization/user model;
- server runtime or Postgres migration;
- backend scheduler, durable Queue runner, reconnect/resume, server worker, or
  hidden/unarmed auto-dispatch.

## Recommended Next Roadmap

### A. Safe Next Docs/Type-Only Blocks

1. Context Pack audit/capability mapping plan, docs-only.
2. Knowledge / Skills UI design contract, docs-only.
3. Knowledge store storage design, docs-only and no implementation.
4. Evidence review workflow contract, docs-only.
5. Coordinator explicit context selection UX contract, docs-only.

### B. Safe Inspect-First Audits

1. Re-check Coordinator/provider request construction after any context UI
   design work.
2. Inspect Notes, widget logs/results, and runtime artifact surfaces before
   any Knowledge ingestion proposal.
3. Inspect Queue Sequential Queue Runner boundaries before any durable runner
   or scheduler discussion.
4. Inspect audit/event-like surfaces before any audit emission pilot.

### C. Future Implementation Candidates

Only after the docs and inspect-first blocks above:

1. Explicit Attach Knowledge to Coordinator design, with visible review and no
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
- Coordinator hidden context;
- Context Pack provider wiring;
- automatic Notes/artifact/log ingestion;
- hidden/unarmed auto-dispatch, durable Queue runner, reconnect/resume, or
  backend scheduler.
