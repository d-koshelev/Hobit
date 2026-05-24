# Artifact Reference / Ownership Contract

## Purpose

This contract defines Hobit's Artifact Reference / Ownership v0 vocabulary.

It is contract and type scaffolding only. It does not implement an artifact
store, artifact persistence, schema migration, audit emission, evidence store,
knowledge store, server runtime, enterprise/RBAC behavior, frontend behavior,
Tauri commands, DTO changes, runtime behavior, or widget behavior changes.

## Current Scope

The current Rust type model lives in `crates/hobit-app/src/artifacts/`.

The v0 model can describe metadata-only references to current and future
artifact-like records with:

- artifact id;
- source ref;
- owner ref and owner kind;
- origin;
- storage kind;
- visibility;
- retention hint;
- resolution status;
- runtime content class;
- redaction status;
- sensitivity;
- AI-context eligibility;
- evidence eligibility;
- safe summary wrapper.

Artifact refs are references only. They do not resolve today unless a future
feature explicitly adds a resolver, and a stable ref does not mean the content
is safe to share.

## Referenceable Sources

Artifact Reference v0 can point at existing or future sources without changing
their storage:

- widget run rows;
- widget result rows;
- widget log rows;
- Queue task refs;
- Direct Work run refs;
- Terminal run or session refs;
- Git status, diff, or commit refs;
- JDBC query or result refs;
- Note refs;
- Coordinator proposal refs;
- future artifact records;
- external references;
- ephemeral-only session refs.

Existing widget logs, widget runs, widget results, Queue tasks, Notes, and
proposal records remain their current storage-backed product records. They are
not converted into audit records or artifact-store records by this contract.

## Safety Rules

Artifact refs and summaries must not copy raw:

- operator prompts;
- stdout or stderr;
- SQL;
- diffs, patches, or file contents;
- Terminal output or stdin;
- Note bodies;
- provider text;
- local filesystem paths;
- secrets, credentials, tokens, or raw payloads.

Caps, truncation, and bounded buffers are separate from redaction. Redaction
status must remain explicit metadata.

Defaults are conservative:

- AI-context eligibility is false by default;
- evidence eligibility is false by default;
- unknown sensitivity is not safe;
- unknown storage is not known-resolvable storage;
- unknown visibility is not safe to share.

## Boundaries

Artifact is not evidence. Evidence requires a separate source-backed review
and evidence status.

Artifact is not knowledge. Knowledge must be explicit, reviewable, and
attributable before it becomes reusable product context.

Artifact is not AI context. AI-context eligibility must be explicit and
reviewable; ownership alone does not allow sharing with an AI provider or
Coordinator runtime.

Artifact ownership is separate from evidence status and AI-context
eligibility. A Workspace, widget, Queue task, runtime run, capability action,
Note, or Coordinator proposal can own or originate a ref without making that
ref evidence or AI-readable context.

Future Knowledge, Skills, Evidence, and Context Pack boundaries are defined in
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`. That contract keeps Artifact,
Evidence, Knowledge, and AI context separate and does not add stores, ingestion,
or runtime wiring.

The current Knowledge / Evidence Rust refs may point to `ArtifactRef`
metadata. They must not resolve artifacts or copy raw artifact payloads.
Context Pack refs may include `ArtifactRef` metadata as selected items, but
membership does not turn an artifact into Evidence or AI context.

## Relationship To Audit And Capabilities

Future `AuditEventEnvelope` values should reference artifact refs or
`AuditArtifactRef` metadata instead of copying raw payloads. This contract does
not emit audit events, persist audit events, or add audit tables.

Future capability actions may list input or output artifact refs. This
contract does not implement capability execution, approval behavior, artifact
production, artifact resolution, or runtime wiring.

## Current Desktop Limitations

Hobit remains desktop-first and Tauri-hosted today. No artifact store exists.
No server host, organization, tenant, user, group, role, permission, or RBAC
layer exists today.

Current Queue, Direct Work, Terminal, Git, JDBC, Coordinator, Notes, Runbook,
widget run/result/log storage, frontend behavior, Tauri commands, and DTO
compatibility are unchanged by this contract.

Queue task run-history visibility is defined in
`docs/QUEUE_RUN_HISTORY_VISIBILITY_CONTRACT.md`. The current Queue surface uses
safe metadata-only run-link references to Executor-owned run/result artifacts
for selected-task latest run and compact history visibility. It must not
duplicate raw prompts, stdout, stderr, final responses, diffs, logs, or result
payloads in Queue.

## Non-Goals

This contract does not add:

- artifact persistence;
- artifact tables, columns, migrations, or schema changes;
- artifact resolver APIs;
- audit persistence or emission;
- evidence store;
- knowledge store;
- server runtime;
- enterprise/RBAC behavior;
- frontend UI;
- Tauri commands or DTOs;
- runtime wiring;
- changes to existing widget run/result/log storage;
- changes to existing widgets.
