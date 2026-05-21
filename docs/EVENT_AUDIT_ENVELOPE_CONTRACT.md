# Event/Audit Envelope Contract

## Purpose

This contract defines Hobit's Event/Audit Envelope v0 vocabulary.

It is contract and type scaffolding only. It does not implement audit
persistence, event streaming, server runtime, organization behavior,
enterprise permissions, RBAC, storage schema changes, frontend behavior, or
runtime event emission.

## Current Scope

The current Rust type model lives in `crates/hobit-app/src/audit_events/`.

The v0 envelope can describe future audit records with:

- event id and schema version
- timestamp text supplied by the caller
- actor kind and optional actor id
- nullable organization id for desktop MVP
- optional Workspace, Workbench, Widget, capability, task, run, and action refs
- event kind
- causation and correlation ids
- optional approval metadata
- risk level
- input and output artifact refs
- redaction status
- safe summary wrapper
- error class wrapper

Artifact refs are references only. They must not carry raw prompts, command
payloads, stdout, stderr, diffs, SQL, provider output, local paths, or secret
values.

## Desktop MVP Rules

- Desktop may use `organization_id: None`.
- Local operator events may omit actor ids.
- Absence of organization, users, groups, roles, or permissions is explicit and
  must not imply enterprise behavior exists.
- Creating an envelope value does not persist it.
- Existing Workspace events, widget logs, runtime results, and frontend live
  state are not converted to audit records by this contract.

## Non-Goals

This contract does not add:

- audit tables or migrations
- durable audit log APIs
- event sourcing
- server runtime
- organization or tenant behavior
- enterprise/RBAC behavior
- new frontend UI
- new Tauri commands
- runtime behavior changes
