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
permission, emit an audit event, or expose a tool to Coordinator Chat.

## Boundary Rules

Capabilities are scoped to explicit Workspace, Workbench, Widget, and
capability refs. A widget capability belongs to the widget that exposes it.
Coordinator or provider output must not bypass the owning widget boundary.

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

## Context, Artifacts, And Summaries

Capability summaries are safe metadata only. They must not store raw prompts,
stdout, stderr, SQL, diffs, Terminal output, Note bodies, provider text, local
paths, secrets, or raw artifact payloads.

Capabilities may later produce artifact refs, but refs are references only.
Artifact eligibility for AI context and evidence must be explicit and
reviewable. Caps and truncation are not redaction.

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
Runbook behavior is unchanged by this contract.

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
