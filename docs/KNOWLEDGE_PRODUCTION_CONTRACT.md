# Knowledge Production Contract (Production-Ready Readiness Tranche)

## Purpose

Define the production-ready Knowledge / Skills architecture boundary for explicit project memory before implementation. This contract is docs-only and does not add runtime, storage, or UI behavior.

## Scope

This document is the production boundary for explicit, operator-visible Knowledge memory only.
It applies to Knowledge Documents and Skills in the same project/product architecture and is authoritative for:

- Knowledge Catalog modeling and fields
- Draft lifecycle and review transitions
- Versioning and provenance
- Queue-owned task context ownership
- Draft acceptance/rejection accountability

## 1) Knowledge Catalog as Explicit Project Memory

Knowledge is **explicit project memory**, not hidden AI memory.

- Operator-visible records are authoritative within scope boundaries.
- Knowledge can be created, updated, retired, and reused only through explicit, operator-visible actions.
- Queue, Agent, Terminal, Git, JDBC, and Runbook flows may reference Knowledge only after explicit selection and visible approval.
- No hidden automatic knowledge ingestion or automatic prompt attachment.

## 2) Item Types

Production-ready Knowledge items must use one of these item types:

- `document`
- `skill`
- `workflow`
- `runbook`
- `decision`
- `validation_rule`
- `known_issue`
- `codebase_knowledge`
- `documentation_knowledge`
- `command_history_summary`
- `external_reference`

No additional item types are added in this tranche without a focused contract update.

## 3) Required Item Fields

Each Knowledge item record must include:

- `id`
- `type` (from section 2)
- `title`
- `quickSummary` (one to three lines)
- `fullContent`
- `scope` (`global` or `workspace-local`)
- `lifecycleStatus` (`draft`, `active`, `stale`, `archived`, `rejected`)
- `enabled` (boolean)
- `searchable` (boolean)
- `tags` (array)
- `sourceRefs` (array)
- `relations` (array)
- `version` (semantic/version-token or immutable revision id)
- `createdAt`
- `updatedAt`
- `reviewedAt`
- `createdByTaskId` (when generated from a Queue task)
- `createdFromRunId` (when generated from a run context)

Field rules:

- `quickSummary` is the default scan, review, search-result, attachment, and
  materialization preview. It must be bounded to one to three lines and must
  not replace `fullContent` as the durable source.
- `fullContent` is the reviewed body for the Knowledge item. It is not copied
  into prompts, Queue tasks, Executor runs, or provider requests by default.
- `scope` is either `global` or `workspace-local` for this tranche. `global`
  means local-user/global project memory in the local Hobit installation, not
  team/server memory.
- `enabled` controls whether an otherwise eligible item can be selected or
  materialized.
- `searchable` controls whether an otherwise eligible item appears in normal
  search/retrieval surfaces.
- `sourceRefs` must be explicit, reviewable refs to files, docs, URLs, Queue
  tasks, runs, command summaries, decisions, imported documents, or
  operator-authored sources. Source refs should carry label, kind/origin,
  selector, source version/hash/timestamp where available, selected-at or
  captured-at timestamp, and redaction/cap notes when relevant.
- `relations` must be explicit, reviewable links to other Knowledge items,
  Queue tasks, runs, decisions, validation rules, known issues, source docs, or
  artifacts. Relations are for navigation/provenance only in this tranche; they
  do not create a graph canvas, hidden traversal, or automatic context.
- `createdByTaskId` and `createdFromRunId` are required when available and
  must remain nullable/absent only when the item was not created from a task or
  run, or when the source predates this production model.

## 4) Search and Activation Rules

- A record is materializable for user-facing selection only when:
  - `lifecycleStatus = active`
  - `enabled = true`
  - `searchable = true`
- Disabled, rejected, stale, and archived items may be displayed only in review/history surfaces.
- Rejected items must not be attachable, searchable, or auto-materialized in any run path.
- Draft items are never auto-materialized; they require explicit acceptance flow.
- Stale items may appear in maintenance/review surfaces and may be attached
  only through a visible warning and acknowledgement policy defined by the
  consuming surface. They must not be silently used as current guidance.
- Archived items are retained for history and should be blocked for normal
  attach/materialization unless a future explicit recovery/reuse flow restores
  them to `active`.
- Search and activation state must be derived from the item record and current
  lifecycle policy, not from provider memory, local hidden caches, embeddings,
  background indexes, or previous prompt context.

## 5) Lifecycle

Valid lifecycle values:

- `draft`
- `active`
- `stale`
- `archived`
- `rejected`

Transitions are explicit and operator-visible.

Minimum lifecycle transition rules:

- `draft -> active`: allowed only after explicit operator review and accept.
- `draft -> rejected`: allowed after explicit operator reject; rejected content
  must not become active project memory.
- `active -> stale`: allowed when source drift, age, conflicting evidence, or
  operator judgment marks the item suspect.
- `stale -> active`: allowed only after refresh/review confirms the item is
  current.
- `active | stale | draft -> archived`: allowed as explicit retirement while
  preserving history.
- `rejected -> active`: blocked by default. A future explicit recovery flow
  must create a new reviewed version/snapshot rather than silently reusing the
  rejected record.

## 6) Versioning

- Versioning is immutable by default:
  - Record updates create a new version record or immutable snapshot.
  - A mutable record alias can remain as a pointer to the current active snapshot.
- Required version metadata:
  - `version` identifier
  - `createdAt` and `updatedAt`
  - `versionSource` (optional: run/task/ref or event basis)
- `sourceRefs` must include hashes/timestamps where available to support staleness checks.
- Historical Queue snapshots, draft review ledger records, and execution
  evidence must point to the exact Knowledge version/snapshot used at the time.
  Later edits must not rewrite those historical references.
- A current-record alias may expose the latest version for normal list/read
  flows, but production design must keep enough immutable version data to
  explain what was accepted, attached, materialized, or used in a run.

## 7) Durable Queue Context Ownership

Queue owns explicit, task-scoped Knowledge context at durable-task level.

Queue-owned task context must include at least:

- Attached refs (Knowledge and Skills)
- Materialized bounded snapshots (preview/excerpt)
- Staleness status and warning state at materialization
- Token budget and overflow flags
- Materialization and execution linkage:
  - `queueTaskId`
  - `runId`
  - `selectedKnowledgeVersionId`

Execution/hand-off must use materialized bounded context, not raw full bodies.

Durable Queue context rules:

- Queue context is visible task state before execution, not hidden executor or
  provider memory.
- Queue-owned refs/snapshots are tied to the Queue task and, when executed,
  the specific run. They must remain reviewable after Knowledge items change.
- Materialization must copy only bounded summaries/excerpts plus provenance,
  status, version, warnings, and token estimates. It must not copy raw full
  document bodies by default.
- Disabled, rejected, missing, or blocked source refs must block new
  materialization and execution until detached, replaced, or explicitly
  resolved under the relevant surface contract.
- Stale, draft, or archived source refs must produce visible warnings and may
  block depending on the consuming policy. They must never be silently treated
  as active Knowledge.

## 8) Draft Review Ledger

Draft review decisions must be recorded in a draft-review ledger for production-readiness:

- Draft decisions: `accepted`, `rejected`, `edited`, `split`, `merged`, `blocked`
- Record links:
  - decision source: `queueItemId` and/or `runId`
  - reviewer identity/model id when available
  - decision timestamp
  - reason and acceptance scope
  - resulting item ids and versions

Ledger records are the source of truth for auditability of review action.
Rejected draft content must not become active project memory.

Draft review ledger rules:

- The ledger records decisions about drafts; it is not itself active Knowledge
  context.
- Accepted decisions must link to the created or updated Knowledge item id and
  immutable version/snapshot.
- Rejected decisions may preserve bounded draft metadata, reason, source refs,
  and generated-text hash for accountability, but rejected content must not be
  searchable, attachable, materialized, or sent to providers/executors.
- Editing, splitting, and merging must preserve source run/task links and
  source refs for each resulting item/version.
- Ledger records should be audit-ready, but they do not become Evidence unless
  a future Evidence contract and storage slice explicitly links them.

## 9) Production Non-goals for This Tranche

- No vector search
- No embeddings
- No graph canvas
- No team/server R/W memory layer or RBAC
- No background ingestion
- No auto-ingest / hidden repository scanning / filesystem watchers
- No hidden context injection

## 10) Safety and Boundary Rules

- Knowledge is explicit, never hidden, and operator-controlled.
- No hidden context injection into Workspace Agent, Queue, Executor, or provider paths.
- No automatic auto-attach at queue/run creation time.
- No background tasking for import, refresh, or activation.
- Drafts require explicit operator accept/reject action.
- Disabled/rejected items are not attachable and not searchable/visible for normal selection.
- Stale/draft/archived behavior must warn, and where policy requires, block run/attach.
- Queue context must be review-visible before execution.
- Raw full bodies are never copied into provider prompts by default; bounded excerpts/summaries are used with explicit caps and visible provenance.
- Secret-bearing content must be redacted or excluded by policy before any attachment or run materialization.
- Caps are mandatory for search results, selected refs, materialized snapshots,
  prompt excerpts, draft packs, and review previews. Over-cap behavior must be
  visible as truncation, overflow, or blocked state; the system must not
  silently include omitted content.
- Secret warning policy must flag obvious credentials, tokens, private keys,
  passwords, environment dumps, secret-bearing JDBC URLs, API keys, certificates,
  and similar sensitive material before acceptance, attachment, or
  materialization. Warning does not make the content safe by itself; the
  operator must redact, exclude, or explicitly approve a future policy-defined
  bounded use path.
- Knowledge search, attach, and materialization must use operator-visible
  records and explicit source refs only. Provider memory, embeddings, local
  hidden indexes, raw logs, unselected files, hidden widget state, and
  background scans are not valid sources in this tranche.
- Disabled or rejected Knowledge must not be materialized through indirect
  paths such as Queue snapshots, Workspace Agent attachments, draft packs,
  generated prompts, Context Pack placeholders, or execution evidence.
- Automatic Knowledge creation, acceptance, refresh, stale marking, Queue task
  creation, context attachment, or prompt injection remains out of scope unless
  a later focused contract explicitly adds it.

## 11) Status and Compatibility

This is a docs-only production-readiness boundary. It supersedes legacy partial field assumptions for production design.
Current implementation remains governed by:

- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`
- `docs/KNOWLEDGE_CATALOG_CONTRACT.md`
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md`
- `docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md`
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md`
- `docs/QUEUE_KNOWLEDGE_CONTEXT_DURABILITY_DECISION.md`

## Acceptance Criteria for this Contract

- Production item model and lifecycle are explicit and complete.
- All required fields are defined.
- Queue context ownership and draft-review traceability are included.
- Safety boundaries are explicit and no automatic hidden memory behaviors.
- Existing implementation boundary is preserved until implementation blocks add schema/API/runtime.
