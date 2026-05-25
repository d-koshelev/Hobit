# Workspace Capability Boundary Contract

## Purpose

This contract defines Hobit's Workspace Capability Boundary v0 vocabulary.

It is contract and type scaffolding only. It does not implement capability
execution, permission checks, enterprise/RBAC behavior, server runtime, audit
persistence, audit emission, storage schema changes, frontend behavior, Tauri
commands, DTO changes, widget behavior, scheduling, or auto-dispatch.

## Current Scope

The current Rust type model lives in `crates/hobit-app/src/capabilities/`.

The v0 model can describe future capability boundaries with:

- Workspace ref;
- Workbench ref when widget-scoped;
- Widget instance ref;
- Widget definition ref;
- Capability id;
- optional future actor/operator ref;
- capability kind;
- risk level;
- approval requirement;
- execution mode;
- mutation scope;
- external access;
- secret exposure;
- context exposure;
- artifact policy;
- safe summary wrapper.

These types are vocabulary only. Creating a capability boundary value does not
register a capability, execute a capability, persist a record, enforce a
 permission, emit an audit event, or expose a tool to Coordinator.

The target product model treats Coordinator as the primary foreground AI agent
inside a Workspace. Capability boundaries are how Coordinator may eventually
use Workspace functionality without becoming a hidden filesystem scanner,
command runner, database client, Git mutator, or background scheduler.
Executor remains the async/background worker for bounded Queue tasks; Executor
ownership of queued logs/results/history does not limit Coordinator's future
foreground capability set.

## Boundary Rules

Capabilities are scoped to explicit Workspace, Workbench, Widget, and
capability refs. A widget capability belongs to the widget that exposes it.
Coordinator or provider output must not bypass the owning widget boundary.

Widgets are UI surfaces plus capability providers. Examples include Database /
JDBC for database capabilities, Terminal / SSH for command and remote
execution capabilities, Git for status/diff/commit capabilities, Skill Library
/ Knowledge for selected Skill and knowledge context, Notes for workspace
notes, Queue for task creation/status/delegation, Agent Executor for
run/review/result capabilities, run history for safe run references, and
future Artifacts/Evidence for source-backed context.

Approval, proposal, and execution are separate concepts:

- A proposal is an inert request for review.
- Approval records or exposes accepted intent only.
- A separate explicit operator action is required for execution or mutation.
- Display-only and proposal-only capability modes do not imply runtime
  execution.

## Action, Approval, Causation, And Correlation Conventions

Capability Action v0 is type and convention scaffolding only. It does not add
capability execution, approval UI, approval workflow persistence, audit event
emission, audit persistence, permission checks, RBAC, server runtime, storage
schema, DTO, Tauri command, frontend, Queue, Direct Work, Terminal, Git, JDBC,
Coordinator, Notes, or Runbook behavior.

The v0 action model exists to connect future records by reference:

- a capability ref identifies what Workspace or widget ability was requested;
- a capability action id is a stable reference only, not a persisted action
  record;
- an approval id links an approval decision to the action it approved or
  rejected;
- a causation id links a child event or action to the event or action that
  caused it;
- a correlation id groups related events or actions across a visible workflow;
- a future `AuditEventEnvelope` may carry the action id, capability ref,
  approval ref, causation id, and correlation id for the same workflow without
  implying audit emission or persistence exists.

The concepts stay separate:

- proposal creation is not approval;
- approval is not execution;
- an action request is not a runtime start;
- a runtime start request is not a runtime start;
- a runtime start is not completion;
- artifact production is a separate lifecycle observation.

Defaults are conservative. Unknown action kinds and lifecycle statuses must
not be treated as approved, safe, started, completed, or executable. A
capability policy that requires approval does not create approval records by
itself. Approval metadata does not imply execution happened.

Causation and correlation are different identifiers and must not be collapsed:
causation explains why one event or action exists; correlation groups related
work.

The default posture is conservative:

- unknown risk is not safe;
- unsupported approval and execution modes are explicit;
- AI-context sharing is false by default;
- hidden context sharing is false by default;
- produced artifacts are not AI-context-eligible by default;
- produced artifacts are not evidence-eligible by default.

## Coordinator Modes And Action Levels

Future Coordinator capability use should identify the active mode:

- Chat / Reasoning mode.
- Workspace Read mode.
- Workspace Action mode.
- Command / Validation mode.
- Async Delegation mode through Queue/Executor.

Future capability action levels:

- Safe read.
- Sensitive read.
- Mutation.
- Remote/database action.
- Async execution.

These are vocabulary only in this contract. They do not create a registry,
grant permissions, execute tools, start Queue/Executor work, or emit audit
records.

## Context, Artifacts, And Summaries

Capability summaries are safe metadata only. They must not store raw prompts,
stdout, stderr, SQL, diffs, Terminal output, Note bodies, provider text, local
paths, secrets, or raw artifact payloads.

Capabilities may later produce artifact refs, but refs are references only.
Artifact eligibility for AI context and evidence must be explicit and
reviewable. Caps and truncation are not redaction.

Artifact Reference / Ownership v0 is defined in
`docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md`. That vocabulary is
metadata-only and does not add artifact persistence, artifact resolution,
capability execution, audit emission, evidence store, or knowledge store.

## Relationship To Audit

`AuditEventEnvelope` v0 may reference capability ids later. This contract
provides capability boundary vocabulary for that future mapping, but it does
not wire audit emission, audit persistence, or event streaming.

Future audit work should keep capability request, approval, execution,
artifact creation, and result observation as separate lifecycle concepts.

## Current Desktop Limitations

Hobit remains desktop-first and Tauri-hosted today. No server host exists. No
organization, tenant, user, group, role, enterprise permission, or RBAC layer
exists today.

Current Queue, Direct Work, Terminal, Git, JDBC, Coordinator, Notes, and
Runbook behavior is unchanged by this contract. Coordinator may be the central
operator work surface and target foreground AI agent, but this vocabulary does
not give it hidden context, file access, command execution, SSH, JDBC
execution, Git mutation, permission enforcement, audit emission, or a path
around widget-owned approval/execution boundaries.

## Non-Goals

This contract does not add:

- capability registry;
- capability execution;
- Coordinator tool execution;
- permission checks;
- server runtime;
- organization, tenant, user, role, or RBAC behavior;
- audit persistence or emission;
- storage tables, columns, or migrations;
- frontend UI;
- Tauri commands or DTOs;
- runtime wiring;
- scheduler or auto-dispatch behavior;
- changes to existing widgets.
