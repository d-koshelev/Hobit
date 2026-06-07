# Knowledge Production Status

Status record date: 2026-06-07

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

Production Knowledge status: production-pack mostly implemented, with hardening
gaps.

Knowledge / Skills remains Ready / MVP for the current Stable v0.1 scope and
now includes the production-pack foundations for durable Knowledge Document
fields, immutable/version metadata, structured source refs and relations,
durable draft review decisions, and durable Queue-owned context. It is still
not the full production Knowledge Catalog architecture. The most important
safety rule is preserved: Knowledge is explicit operator-controlled project
memory, not hidden provider memory.

The remaining hardening gaps are backend-owned Queue prompt materialization on
every execution path, complete draft-review disposition vocabulary, Skill model
alignment with production Knowledge items, durable execution Evidence records,
and source-ref runtime hardening where prompt/report text is still used as a
fallback.

## Implemented Production-Relevant Fields And APIs

Current Knowledge Documents implement a partial catalog-shaped model:

- title;
- quick summary;
- catalog item type;
- lifecycle/status;
- source label;
- source kind/ref;
- structured source refs;
- structured relations;
- content;
- tags;
- enabled flag;
- searchable flag;
- workspace-local or local-global scope;
- deterministic text chunks;
- immutable version number and version snapshots;
- reviewed-at timestamp where supplied;
- created-by Queue task id where supplied;
- created-from run id where supplied;
- created and updated timestamps.

Current Knowledge Document APIs support explicit operator-driven create, list,
read, update, delete, import, and lexical search. Search is bounded,
deterministic, workspace-aware, global-aware, and limited to active, enabled,
searchable documents.

Current Skills implement explicit workspace-local Skill records with title,
when-to-use, prerequisites, steps, validation, risks, tags, review status, and
created/updated timestamps. Skill APIs support create, list, read, update, and
delete.

Production gaps and caveats:

- Skills do not yet share the production Knowledge lifecycle model;
- no production activation policy API.
- Knowledge Document version rows exist, but Queue context snapshots may expose
  updated timestamp/version labels rather than a first-class immutable version
  row id.
- Not every source path guarantees structured durable task/source metadata
  before acceptance; prompt/report text may still be the context used when no
  durable evidence/source table exists.

## Durable Draft Ledger Status

Current status: partially implemented.

Stable v0.1 has a durable draft review ledger for explicit accept/reject
decisions. Accepted drafts can create durable Knowledge Documents through the
explicit Knowledge / Skills acceptance path. Rejected drafts are recorded as
review decisions but do not become Knowledge, Evidence records, active Catalog
items, searchable content, or attachable context.

Implemented ledger fields include draft pack/item/source fingerprint metadata,
Queue task/run links, review action, review timestamp, accepted Knowledge or
Skill id where applicable, and rejection reason where supplied.

Remaining production gaps:

- the service action vocabulary currently covers accepted,
  edited-before-accept, and rejected paths, not the full split/merged/blocked
  production vocabulary;
- accepted ledger records do not yet link to immutable Knowledge version row
  ids;
- there is no separate Evidence or audit-event store for draft decisions.

## Durable Queue Context Status

Current status: durable Queue-owned context is implemented, with execution
hardening caveats.

Selected saved Knowledge Documents and Skills attach to the selected Queue
task as durable task-owned safe refs, bounded snapshots, warnings, token
budget data, and materialization metadata. Typed attach/detach APIs mutate the
Queue task context; generic Queue create/update APIs do not expose arbitrary
context JSON as a normal app/Tauri path.

Implemented Queue context includes:

- attached Knowledge and Skill refs;
- bounded snapshots;
- warning records;
- token budget and overflow state;
- materialized-at metadata;
- backend prompt materialization that prepends Knowledge / Skills context and
  appends a `Context used` section.

Remaining production gaps:

- execution evidence is still prompt/report text, not a separate immutable
  Evidence table or run metadata table;
- one Queue start path can still accept caller-supplied materialized prompt
  text, so backend materialization is not yet the sole source of truth for
  every execution path;
- low-level storage still contains raw context JSON plumbing, though app/Tauri
  APIs use typed attach/detach flows.

## Generation Source Refs Status

Current status: explicit but partial.

Generation from docs, codebase, and history can be represented through visible
Queue task text, selected safe refs, source label/kind/ref fields, and draft
review/report text. Creating a generation task does not run analysis, scan the
repository, activate Knowledge, or grant provider/tool permissions.

Current implemented behavior and gaps:

- Knowledge Documents can persist structured `sourceRefs[]` and
  `relations[]`, and draft acceptance maps pack refs into Knowledge refs;
- generation Queue task refs may still fall back to visible prompt/task/report
  text where durable typed source metadata is unavailable;
- no complete source selector, hash, timestamp, selected-at/captured-at, cap
  note, or redaction-note record for every source path;
- no durable source snapshot/version replay;
- no first-class graph runtime, even though structured relations can be stored.

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

- no immutable version id in search results or materialized context;
- no durable stale-warning acknowledgement policy;
- no production secret warning/redaction policy before acceptance, attach, or
  materialization;
- no durable evidence record for which context was used in a run.

## Current Limitations

- Knowledge / Skills is an MVP, not a full Knowledge Catalog.
- Queue context is durable through typed attach/detach APIs, but execution
  evidence is not a separate durable Evidence record.
- Rejected draft review decisions are durable ledger entries, but rejected
  content is not Knowledge and is not searchable or attachable.
- Source refs are structured for Knowledge Documents where supplied, but some
  generation/runtime paths still rely on visible prompt/report text.
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
