# Knowledge Production Status

Status record date: 2026-06-06

## Purpose

Record the production-readiness status for Knowledge / Skills after the
production contract and API audit.

This is a docs-only status record. It does not add product behavior, storage,
schema, frontend UI, backend APIs, Queue execution behavior, Workspace Agent
provider behavior, hidden context access, vector search, embeddings, server
runtime, team sharing, RBAC, or graph behavior.

Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`. Production target behavior remains governed
by `docs/KNOWLEDGE_PRODUCTION_CONTRACT.md`.

## Summary

Production Knowledge status: not production-ready yet.

Knowledge / Skills is Ready / MVP for the current Stable v0.1 scope, but it is
not the full production Knowledge Catalog architecture. It preserves the most
important safety rule: Knowledge is explicit operator-controlled project memory,
not hidden provider memory. The remaining production gaps are durable item
versioning/provenance, a draft-review ledger, durable Queue-owned context,
structured source refs, and a complete search/safety policy.

## Implemented Production-Relevant Fields And APIs

Current Knowledge Documents implement a partial catalog-shaped model:

- title;
- quick summary;
- catalog item type;
- lifecycle/status;
- source label;
- source kind/ref;
- content;
- tags;
- enabled flag;
- workspace-local or local-global scope;
- deterministic text chunks;
- created and updated timestamps.

Current Knowledge Document APIs support explicit operator-driven create, list,
read, update, delete, import, and lexical search. Search is bounded,
deterministic, workspace-aware, global-aware, and limited to enabled active
documents.

Current Skills implement explicit workspace-local Skill records with title,
when-to-use, prerequisites, steps, validation, risks, tags, review status, and
created/updated timestamps. Skill APIs support create, list, read, update, and
delete.

Production gaps:

- no `searchable` field separate from `enabled`;
- no immutable version/snapshot table;
- no structured `sourceRefs[]` or `relations[]`;
- no `reviewedAt`, first-class `createdByTaskId`, or `createdFromRunId`;
- Skills do not yet share the production Knowledge lifecycle model;
- no production activation policy API.

## Durable Draft Ledger Status

Current status: not implemented.

Stable v0.1 draft review is review-local except for accepted drafts. Accepted
drafts can create durable Knowledge Documents through the explicit Knowledge /
Skills acceptance path with best-effort current provenance fields. Rejected
drafts do not become Knowledge, Evidence, audit records, or durable rejected
Catalog records.

Production requirement:

- durable draft-pack and draft-item identities;
- accepted, rejected, edited, split, merged, and blocked dispositions;
- Queue task/run links;
- reviewer, timestamp, reason, source refs, generated-text hash where useful;
- links from accepted dispositions to resulting item ids and versions.

## Durable Queue Context Status

Current status: frontend-local/current-session only.

Selected saved Knowledge Documents and Skills can attach to the selected Queue
task as safe refs, bounded summaries/snapshots, warnings, token estimates, and
visible materialized prompt context. This prepared context is not durable
Queue-owned task state unless it is indirectly represented in an explicit
materialized prompt or run handoff.

Production requirement:

- Queue-owned task context storage/API;
- attached Knowledge and Skill refs;
- bounded immutable snapshots;
- warning and acknowledgement records;
- token budget and overflow state;
- materialized-at and run linkage;
- execution evidence refs that record which versions/snapshots were used.

## Generation Source Refs Status

Current status: explicit but partial.

Generation from docs, codebase, and history can be represented through visible
Queue task text, selected safe refs, source label/kind/ref fields, and draft
review/report text. Creating a generation task does not run analysis, scan the
repository, activate Knowledge, or grant provider/tool permissions.

Production gaps:

- no durable structured `sourceRefs[]`;
- no source selectors, hashes, timestamps, selected-at/captured-at fields, cap
  notes, or redaction notes as first-class records;
- no durable source snapshot/version replay;
- no first-class relation graph or `createdByTaskId` Catalog field.

## Search And Safety Status

Current search is lexical, chunk-based, bounded, deterministic, and limited to
enabled active Knowledge Documents. It does not use vectors, embeddings,
provider memory, hidden indexes, background scans, or unselected files.

Current safety status:

- disabled and rejected Knowledge are blocked from current Queue attach paths;
- deprecated Skills are blocked;
- stale, draft, archived, needs-review, and missing-summary states warn in
  current Queue context review paths;
- Workspace Agent Codex Knowledge snippets are visibly capped and scope-labeled;
- Queue materialization uses bounded visible snapshots/excerpts before the task
  prompt.

Production gaps:

- no separate `active + enabled + searchable` policy across every surface;
- no immutable version id in search results or materialized context;
- no durable stale-warning acknowledgement policy;
- no production secret warning/redaction policy before acceptance, attach, or
  materialization;
- no durable evidence record for which context was used in a run.

## Current Limitations

- Knowledge / Skills is an MVP, not a full Knowledge Catalog.
- Queue context is current-session only.
- Rejected draft review is not durable.
- Source refs are partial string fields plus visible prompt/report text.
- Full document bodies are stored as Knowledge source content, but raw full
  bodies are not copied into prompts by default.
- Manual/import paths may leave quick summaries empty.
- There is no Evidence store or Context Pack runtime.
- There is no automatic Knowledge refresh, stale marking, task creation,
  acceptance, or prompt injection.

## Future Exclusions

The following remain excluded from this production-readiness tranche:

- vector search;
- embeddings;
- graph canvas or automatic graph traversal;
- server/team/shared Knowledge memory;
- RBAC or enterprise permission layer;
- background repository scanning;
- folder watching;
- automatic ingestion;
- hidden provider memory;
- hidden context injection.

## Safety Boundaries Preserved

- Knowledge is explicit project memory, never hidden provider memory.
- No automatic context injection.
- No background repository scanning or auto-ingest.
- Drafts require explicit operator accept/reject before becoming Knowledge.
- Disabled/rejected Knowledge must not be searchable, attachable, or
  materialized.
- Stale/draft/archive usage must warn or block according to the consuming
  contract.
- Queue context must be visible before execution.
- Raw full document bodies must not be copied into prompts by default; bounded
  snapshots/excerpts are the expected materialization form.
