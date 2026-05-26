# Knowledge / Skills / Evidence Contract

## Purpose

This contract defines Hobit's Knowledge, Skills, Evidence, Context Pack, and
Runbook boundaries.

It is primarily an architecture contract. The current implemented product
slice is the Minimal Skill Library MVP plus scoped plain-text Knowledge
Documents described here. This contract does not implement an
Evidence store, Context Pack runtime, audit emission, server runtime,
enterprise/RBAC behavior, permissions, or broad runtime behavior changes.

## Current Status

Hobit currently has workspace-local and local-global Knowledge Documents for
plain-text or Markdown reference material explicitly added through the Skill
Library / Knowledge widget. Workspace documents belong to one Workspace only.
Global documents are local-user/global records available across Workspaces in
this desktop database. The widget supports manual document authoring and
explicit single-file import for `.txt`, `.md`, and `.markdown` files.
Documents are chunked deterministically and searched with bounded lexical
search only. This is not a Knowledge Item/Evidence/Context Pack store and is
not team/server knowledge.

Hobit currently has no implemented evidence store.

Hobit currently has a Minimal Skill Library / Knowledge widget for
workspace-local operator-authored Skill records and scoped Knowledge Documents. It
supports explicit create/list/read/update/delete of simple text Skill records
with review status and tags, and explicit create/list/read/update/delete/search
of Knowledge Documents with title, source label, content, tags, enabled flag,
scope, and chunks. Explicit text/Markdown import creates Knowledge Documents
through the same document create path. The operator can explicitly attach the
selected Skill to Workspace Agent as visible current-session composer context.
Workspace Agent can also draft visible catalog creation proposals from explicit
visible conversation content or safe `hobit-catalog-action` fenced JSON in
visible assistant/Codex text. Creating the proposed Knowledge Document or Skill
requires operator approval plus a separate explicit create action, defaults to
workspace-local catalog records, and does not read hidden Workspace data.

The Skill Library / Knowledge MVP is not an Evidence store, Context Pack
builder, Runbook executor, hidden AI memory layer, team/server knowledge
system, or hidden Workspace Agent context provider. Skills are not searched,
selected, or sent to Workspace Agent or a provider unless the operator uses the
explicit visible attach action and then sends visible Workspace Agent text.
Enabled workspace-local and enabled local-global Knowledge Documents may be
automatically searched by Workspace Agent before an explicit Run with Codex.
Retrieved snippets are capped, visible in the Direct Work details with
Workspace/Global scope labels, and added only to that run's Codex prompt.

The current Rust reference vocabulary lives in
`crates/hobit-app/src/knowledge/`. It is mostly type-only scaffolding for
Knowledge, Skill, Runbook, Evidence, Evidence Source, and Knowledge/Evidence
links. The implemented Skill Library storage/API/UI is separate workspace-local
MVP behavior, and Knowledge Documents are separate scoped plain-text records.
These refs do not implement Knowledge Item storage, Evidence storage,
Context Pack storage, a resolver, Workspace Agent capability wiring, or broad
runtime behavior.

The current Context Pack Rust reference vocabulary lives in
`crates/hobit-app/src/context_packs/`. It is type-only scaffolding for explicit
context selections and does not implement Context Pack storage, Coordinator
context wiring, provider prompt changes, UI, schema changes, or runtime
behavior.

Notes exist as workspace-local human-authored text records, but Notes are not
Knowledge Documents. A Note does not become reusable Knowledge by default, and
existing Notes content is not silently read, summarized, indexed, or sent to
Workspace Agent.

Artifacts currently exist as reference vocabulary only through
`docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md`. Artifact refs do not create an
artifact store, evidence store, knowledge store, resolver, or AI-readable
context pipeline.

Workspace Agent does not silently ingest Skills, Notes, artifacts, logs,
runtime output, Git diffs, SQL, Terminal output, files, or provider text. Skill
attachments are visible editable composer text only and include only the
selected Skill's title, when-to-use, prerequisites, steps, validation, risks,
tags, and review status. Knowledge Document retrieval checks enabled documents
for the active Workspace plus enabled local-global documents; it is capped,
visible, lexical, and labels each used snippet as Workspace or Global. It does
not search hidden filesystem content, Notes, disabled documents, Skills,
team/server knowledge, Evidence, or Context Packs. Current provider requests
use visible current-session chat context and `allowed_tools: []`.
Catalog proposal drafting uses only visible conversation text or visible
assistant/Codex fenced catalog action blocks. It does not scan the filesystem,
auto-ingest Notes, Executor logs, Git/JDBC/Terminal/Queue data, team/server
knowledge, Evidence, Context Packs, embeddings, or binary documents.

## Core Concepts

Note: local human-authored Workspace text. Current Notes are plain title, body,
and pinned records. Notes may become inputs to future Knowledge workflows only
through explicit review and selection.

Artifact: a metadata-only reference to a work input, output, log, result,
generated response, validation output, external reference, or future artifact
record. Artifact refs must not copy raw payloads.

Evidence: a source-backed observation or reference with provenance and review
status. Evidence should point to `ArtifactRef` or an external reference rather
than copying raw payloads by default.

Evidence Source: the attributable origin for Evidence, such as a reviewed
artifact ref, external document, system record, operator-attested observation,
or future integration source.

Knowledge Item: a reusable, reviewed, attributable unit of product knowledge.
A Knowledge Item is not created merely because text exists in a Note, log,
artifact, provider response, or run result.

Skill: an actionable, reusable knowledge unit that helps an operator or agent
perform a known kind of work under explicit constraints.

Runbook: a concrete ordered workflow for a specific operational procedure. A
Runbook may use Skills, artifacts, evidence, and operator approvals.

Context Pack: an explicit, reviewable selection of Knowledge, Evidence, and
Artifact refs shared with Coordinator, an agent, or a provider for a specific
purpose.

## Clear Distinctions

Note is not a Knowledge Item by default.

Artifact is not Evidence by default.

Artifact is not AI context by default.

Evidence is not raw log output, raw runtime output, raw provider text, raw SQL,
raw diffs, or raw Terminal output.

Skill is not a Runbook. A Skill is reusable know-how; a Runbook is an ordered
procedure for a concrete workflow.

Runbook is not free-form AI execution. Future Runbooks must preserve visible
steps, operator control, and approval-aware actions.

Context Pack is not hidden global memory. It is an explicit selection for a
specific task, workflow, provider request, or review.

## Skill Definition

A Skill is an actionable, reusable knowledge unit with:

- when to use;
- prerequisites;
- inputs;
- steps;
- commands, queries, or templates when applicable;
- validation;
- risks;
- rollback or cleanup;
- related evidence or artifacts;
- owner, version, and tags;
- review status.

Skills may guide future Coordinator, Agent Executor, Queue, Runbook, or
operator workflows, but a Skill does not execute itself and does not grant
permission to run tools or mutate state.

## Runbook Definition

A Runbook is a concrete ordered workflow. It may reference Skills, artifacts,
evidence, templates, widget capabilities, and operator approvals.

A Runbook is not required for every small operation. Simple explicit operator
actions can remain direct widget actions, Queue tasks, or Agent Executor work
without being wrapped in a Runbook.

Future Runbooks must keep steps visible and reviewable. They must not become
hidden automation, free-form prompt execution, automatic Queue dispatch,
Terminal automation, Git mutation, JDBC execution, or Coordinator tool
execution unless a future explicit contract and implementation block allows
that behavior.

## Evidence Definition

Evidence is a source-backed observation or reference. It must be attributable,
reviewable, and permission-ready.

Evidence should point to `ArtifactRef` or external references by default. It
should not copy raw payloads unless a future evidence storage contract defines
safe storage, redaction, review, and permission behavior.

Evidence has review status. An artifact classified as an evidence candidate is
not Evidence until reviewed under an explicit future evidence workflow.

The Rust v0 `EvidenceRef` model may link to `ArtifactRef` metadata, but it does
not resolve artifacts, read widget runs/results/logs, or copy artifact
payloads.

## Context Pack Definition

A Context Pack is an explicit, reviewable selection of Knowledge, Evidence,
Artifact refs, and safe metadata shared with Coordinator, an agent, or a
provider.

A Context Pack must include:

- selected refs or safe metadata;
- selection reason;
- target use or workflow;
- visibility;
- review status;
- attribution or source refs where possible.

A Context Pack is not automatic hidden context, global memory, background
Workspace scanning, or prompt augmentation. Creating or using a Context Pack
must be visible and approval-aware.

The Rust v0 `ContextPackRef` model contains refs and metadata only. It does not
mean Coordinator, an agent, or a provider has received the context, and it does
not imply approval, evidence eligibility, AI-context sharing, or execution.

## AI Context Rules

Nothing becomes AI context silently.

AI-context eligibility defaults false.

Evidence eligibility defaults false.

The operator must be able to review selected context before it is shared with
Coordinator, an agent, or a provider.

Context must be attributable. Future Context Packs should preserve source refs,
owner refs, review status, and visibility metadata.

Raw prompts, stdout, stderr, SQL, diffs, Terminal output, Note bodies,
provider text, file contents, local paths, credentials, tokens, and secrets
must not be shared by default.

Caps, truncation, and summaries are not redaction and do not make raw content
safe for AI context.

## Ownership Rules

Knowledge, Evidence, artifacts, Skills, Runbooks, and Context Packs must have
owner or source refs where possible.

Desktop MVP may use local/null actors while no user identity model exists, but
contracts and future data shapes must not erase future ownership,
attribution, and permission needs.

Future company or self-hosted modes will need users, groups, roles,
permissions, review ownership, and audit-ready attribution. This contract does
not implement those models now.

Workspace boundaries still matter: unrelated problems should not share hidden
Knowledge, Evidence, artifacts, queues, runs, Notes, or Context Packs.

## Relationship To Existing Contracts

`docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md` defines metadata-only artifact
refs and ownership. Knowledge and Evidence should reference artifacts
explicitly instead of copying raw payloads by default.

`docs/EVENT_AUDIT_ENVELOPE_CONTRACT.md` defines future audit envelope
vocabulary. Knowledge, Evidence, Skill, Runbook, and Context Pack lifecycle
events may later use audit envelopes, but this contract adds no audit
emission.

`docs/AUDIT_EVENT_MAPPING_PLAN.md` maps current event-like surfaces to future
audit readiness. Existing widget logs, results, runs, Notes, proposals, and
runtime outputs are not audit records or Knowledge records today.

`docs/WORKSPACE_CAPABILITY_BOUNDARY_CONTRACT.md` defines future capability
boundary vocabulary. Knowledge, Skills, Evidence, and Context Packs may guide
future capability proposals, but they do not execute capabilities.

`docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md` defines the
desktop-first, server-ready architecture guardrails and the need to keep
Knowledge, Skills, Evidence, and artifacts distinct.

`docs/CURRENT_WIDGET_SURFACE.md` remains the source of truth for current
implemented widget behavior, including the Minimal Skill Library widget. This
contract does not add current Knowledge Item, Evidence, Context Pack, or
Runbook engine behavior beyond that Skill Library MVP.

## Explicit Non-Goals

This contract does not add:

- full Knowledge Item store beyond scoped plain-text Knowledge Documents;
- embeddings/vector database;
- PDF/DOCX parsing or binary ingestion;
- folder scanning, recursive ingestion, filesystem watchers, or hidden file
  ingestion;
- evidence store;
- full Knowledge/Skills system beyond the Minimal Skill Library MVP;
- Context Pack UI or runtime;
- automatic context ingestion;
- hidden prompt augmentation;
- hidden Workspace scanning;
- automatic Notes, artifact, log, result, provider, Git, SQL, or Terminal
  ingestion;
- hidden Workspace Agent context wiring;
- capability execution;
- approval workflow;
- audit persistence or emission;
- server runtime;
- enterprise/RBAC behavior;
- permissions;
- schema changes beyond Skill Library MVP storage;
- frontend behavior changes beyond Skill Library / Knowledge MVP UI,
  scoped document search, and explicit selected Skill attach to
  Workspace Agent;
- Tauri commands or DTO changes beyond Skill Library MVP CRUD;
- Queue, Direct Work, Terminal, Git, JDBC, Workspace Agent, Notes, or Runbook
  behavior changes.
