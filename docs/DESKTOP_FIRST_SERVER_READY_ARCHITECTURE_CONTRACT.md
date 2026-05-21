# Desktop-First Server-Ready Architecture Contract

## Purpose

This contract defines Hobit's architecture guardrails for remaining
desktop-first today while avoiding choices that would block a future
server-hosted, company self-hosted, enterprise knowledge, or thin-client
deployment model.

It is a contract-only document. It does not implement a server runtime,
enterprise permissions, storage migration, new clients, microservices, schema
changes, runtime behavior, or frontend behavior.

## Current Status

Hobit is currently a desktop-first Tauri application.

Current implemented host and runtime shape:

- React/Vite frontend.
- Frontend `WorkspaceApi` boundary.
- Tauri command bridge.
- Rust application services.
- Local SQLite persistence.
- Local runtime and tool helpers for explicit desktop actions.
- Browser/Vite development fallback that is in-memory or unsupported for most
  runtime paths.

Desktop/Tauri is the only real persisted and runtime path today. No server host
exists today. No company self-hosted runtime exists today. No enterprise
permission or RBAC layer exists today. No implemented Knowledge, Evidence, or
shared company context runtime exists today.

Current widget/runtime truth:

- Coordinator Chat is a proposal/text surface. It uses visible current-session
  chat context and `allowed_tools: []`; it does not execute tools or read
  hidden context.
- Agent Queue includes current frontend `executionPolicy` and Sequential Queue
  Runner behavior, but the runner is current-session frontend behavior only,
  not a durable backend scheduler.
- Notes supports current workspace-local list, filter, create, select, edit,
  explicit save, and pin flows. It is not a full Notebook, document model, or
  knowledge system.
- Database / JDBC supports conservative read-only SQL validation plus bounded
  mock/safe execution. It does not connect to real external databases and does
  not collect or handle credentials.
- Terminal is a manual PTY-first desktop surface. Live PTY support is currently
  Windows-only, and the legacy one-shot command runner is a collapsed
  compatibility fallback.
- Git supports explicit-root status/diff review and selected-file local commit
  only. It is not full repository management or broad automation.

## Architecture Principle

Desktop is Hobit's current deployment and host mode. Desktop must not become
the conceptual owner of product logic.

Product logic should live behind reusable core, application service, runtime
adapter, storage adapter, widget capability, artifact, and event boundaries.
Tauri should be treated as the current host and transport bridge, not as the
long-term product boundary.

The near-term product target remains the desktop app only. Future readiness
means preserving clear boundaries and vocabulary now, not implementing future
server or enterprise modes early.

## Required Future-Safe Boundaries

### UI / WorkspaceApi Boundary

Frontend code should talk to a typed `WorkspaceApi` shape instead of assuming a
specific host transport. The current implementation may call Tauri or
browser/dev fallbacks behind that boundary, but product UI should not embed
Tauri-only assumptions when a reusable API boundary is practical.

### Tauri Command Bridge Boundary

Tauri commands are the current desktop transport. They should validate request
DTOs, map host errors into visible product errors, and delegate product logic
to application services or runtime adapters. They should not become the
permanent owner of Workspace, widget, runtime, or capability semantics.

### Rust Application Service Boundary

Application services should own durable product vocabulary for Workspace,
Workbench, WidgetInstance, task, run, artifact, approval, and event concepts.
They should coordinate storage and runtime adapters through explicit typed
requests and responses.

### Storage Adapter Boundary

Local SQLite is the current persistence adapter. Storage code should preserve
clear repository/service boundaries so a future server or different database
can map the same product concepts without changing UI semantics.

This does not authorize Postgres work, migrations, multi-user storage, sync, or
server persistence now.

### Runtime Adapter Boundary

Local process, Codex, Terminal, Git, JDBC, and future tool runtimes should be
represented as adapters with typed request/response contracts, explicit
ownership, caps, cancellation behavior, and classified outputs.

Current code has a minimal shared runtime boundary vocabulary in
`crates/hobit-app/src/runtime_adapters/`. It is type-only scaffolding and does
not change current desktop runtime behavior.

Desktop process memory is acceptable for current MVP session state such as
live PTY handles and frontend runner state, but that state must be named as
non-durable.

### Widget Capability Boundary

Widgets may expose future capabilities, but capability use must remain
explicit, visible, risk-labeled, and approval-aware. Coordinator or provider
output must not bypass operator approval or invoke widget capabilities
silently.

The current codebase has a Workspace Capability Boundary v0 type-only model in
`crates/hobit-app/src/capabilities/`, further described by
`docs/WORKSPACE_CAPABILITY_BOUNDARY_CONTRACT.md`. Those types do not register
capabilities, execute capabilities, enforce permissions, emit audit events, or
change current desktop behavior.

### Artifact / Event / Audit Boundary

Inputs, outputs, logs, errors, decisions, approvals, and evidence candidates
should be modeled so future audit and enterprise review can be added without
reclassifying unsafe raw text as safe product text.

The current implementation has limited Workspace events, widget logs, and
runtime result artifacts. It does not implement a full audit runtime.

The current codebase also has Artifact Reference / Ownership v0 type-only
vocabulary in `crates/hobit-app/src/artifacts/`, further described by
`docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md`. Those types are
metadata-only refs. They do not add an artifact store, artifact persistence,
artifact resolution, schema changes, audit emission, evidence store,
knowledge store, or current desktop behavior changes.

Future Knowledge, Skills, Evidence, Context Pack, and Runbook boundaries are
defined in `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`. That contract is
backed by type-only Rust refs in `crates/hobit-app/src/knowledge/` and
`crates/hobit-app/src/context_packs/` and does not add a knowledge store,
evidence store, Context Pack store, Skills widget, context ingestion,
Coordinator/provider context wiring, prompt changes, runtime behavior, schema
changes, server runtime, or RBAC.

## Runtime Adapter Rules

Runtime adapters must use typed request and response boundaries. Raw command
strings, SQL, prompts, local paths, stdout, stderr, and provider output must
not be treated as unclassified ordinary text.

Runtime output must be capped and classified. Caps limit size and blast radius;
caps are not redaction and do not make content safe.

Secrets must not enter prompts, logs, history, proposal cards, provider
requests, runtime output summaries, or durable artifacts unless an explicit
future secret-safe storage contract permits it. Secret-like input and output
must be treated as `secret_candidate` until proven otherwise.

Cancellation, stop, kill, timeout, and cleanup behavior must be explicit in
the runtime request or action model. A visible stop or kill control must not be
confused with hidden background automation.

Desktop-only process state may be held in memory for current MVP behavior. It
must be documented as session-only and non-durable when it is not persisted
through Workspace storage.

## Run And Task Lifecycle Rules

Frontend may trigger actions and display live state, but durable lifecycle
vocabulary should belong to application services and product contracts.

Current Agent Queue Sequential Queue Runner behavior is frontend-driven and
current-session-only. It stops if the Workbench UI closes or reloads. It is not
a durable scheduler, background daemon, or enterprise task runner.

Approval and execution must remain separate:

- Approving a proposal records or exposes the approved intent.
- A separate explicit action is required to create, apply, run, commit, or
  otherwise mutate state.
- Proposal approval must not imply hidden execution.
- Provider drafts must not execute tools by themselves.

Agent Executor runs remain explicit operator-controlled Direct Work runs.
Queue assignment is not execution. Coordinator proposal review is not
execution.

## Event And Audit Envelope Readiness

Future event and audit records should be able to carry these conceptual fields
when implemented:

- `event_id`
- `schema_version`
- `occurred_at`
- `actor_kind`
- `actor_id`
- `organization_id`, nullable for desktop-only local use
- `workspace_id`
- `workbench_id`
- `widget_instance_id`
- `widget_definition_id`
- `capability_id`
- `event_kind`
- `task_id`
- `run_id`
- `action_id`
- `causation_id`
- `correlation_id`
- `approval_id`
- `approval_status`
- `risk_level`
- `input_artifact_refs`
- `output_artifact_refs`
- `redaction_status`
- `summary`
- `error_class`

This is an envelope readiness contract only. It does not add storage columns,
schemas, APIs, audit services, organizations, users, permissions, or event
streaming.

The current codebase has a v0 type-only envelope model in
`crates/hobit-app/src/audit_events/`, further described by
`docs/EVENT_AUDIT_ENVELOPE_CONTRACT.md`. Those types do not persist records,
emit events from existing runtime paths, create organization/RBAC behavior, or
change current desktop behavior.

Current surface-to-envelope readiness is mapped in
`docs/AUDIT_EVENT_MAPPING_PLAN.md`; it is a docs-only future implementation
plan and does not add audit persistence or emission.

## Secrets And Artifact Classification

Hobit should use explicit classification vocabulary for inputs, outputs, and
artifacts:

- `operator_text`: text intentionally typed by the operator for the visible
  current action.
- `command_payload`: structured runtime command input, including argv,
  working directory, options, or task prompt fields.
- `raw_tool_output`: untrusted stdout, stderr, JSON event payloads, process
  output, tool output, or provider output before classification.
- `runtime_error`: runtime failure text, exit status, timeout, cancellation,
  transport failure, validation failure, or adapter error detail.
- `local_path`: local filesystem or repository path.
- `sql_text`: SQL text, SQL fragment, or query-shaped input/output.
- `generated_response`: AI/provider/model-generated text or structured draft.
- `evidence_candidate`: source-backed observation or artifact that may become
  evidence after review.
- `secret_candidate`: any value that may contain credentials, tokens, private
  keys, passwords, connection secrets, or sensitive internal data.
- `safe_metadata`: bounded metadata intentionally normalized for display,
  indexing, or summaries.

Rules:

- Caps are not redaction.
- Raw stdout, stderr, commands, prompts, paths, SQL, and errors must not be
  treated as ordinary safe text.
- AI context eligibility must be explicit and reviewable.
- Evidence eligibility must be explicit and reviewable.
- Generated summaries do not make raw source content safe.
- `safe_metadata` must be produced through an intentional normalization path,
  not by truncating arbitrary raw content.

## Knowledge, Skills, Evidence, And Artifact Boundary

Hobit must distinguish local notes, reusable knowledge, workflows, evidence,
and work artifacts.

Detailed definitions and non-goals are maintained in
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`.

Definitions:

- Note: local human-authored Workspace text. Current Notes are plain
  title/body/pinned records, not a full knowledge system.
- Skill: reusable actionable knowledge unit with when-to-use guidance,
  prerequisites, inputs, steps, validation, risks, rollback or cleanup,
  owner, version, and tags.
- Runbook: concrete ordered workflow for a specific operational procedure.
- Evidence: source-backed observation or artifact with provenance and review
  status.
- Artifact: persisted input or output from work, such as prompts, runtime
  results, logs, generated responses, validation outputs, or review material.

Rules:

- Nothing becomes AI context silently.
- Knowledge must be explicit, reviewable, attributable, and permission-ready.
- Evidence must be source-backed and reviewable before it is treated as an
  evidence record.
- Artifact refs are metadata-only pointers, not evidence records, knowledge
  records, AI context, or raw payload containers.
- Artifacts must preserve classification and provenance sufficient for future
  audit and permission checks.
- Current Hobit does not provide a full Knowledge, Skills, Evidence, or shared
  company context runtime.

## Explicit Non-Goals

This contract does not implement or authorize:

- server runtime now
- company self-hosted runtime now
- enterprise permissions, users, groups, RBAC, or organizations now
- Postgres or storage migration now
- microservices now
- web or mobile clients now
- replacing Tauri now
- hidden autonomous tool execution
- hidden context ingestion
- Coordinator tool execution
- durable Agent Queue scheduling
- real external JDBC execution or credential handling
- broad Git repository automation
- cross-platform Terminal runtime guarantees beyond current implementation
- Knowledge, Skills, Evidence, or shared company context runtime now
- raw secret persistence
- schema changes
- runtime behavior changes
