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

`sourceRefs` and `relations` must be explicit and reviewable.

## 4) Search and Activation Rules

- A record is materializable for user-facing selection only when:
  - `lifecycleStatus = active`
  - `enabled = true`
  - `searchable = true`
- Disabled, rejected, stale, and archived items may be displayed only in review/history surfaces.
- Rejected items must not be attachable, searchable, or auto-materialized in any run path.
- Draft items are never auto-materialized; they require explicit acceptance flow.

## 5) Lifecycle

Valid lifecycle values:

- `draft`
- `active`
- `stale`
- `archived`
- `rejected`

Transitions are explicit and operator-visible.

## 6) Versioning

- Versioning is immutable by default:
  - Record updates create a new version record or immutable snapshot.
  - A mutable record alias can remain as a pointer to the current active snapshot.
- Required version metadata:
  - `version` identifier
  - `createdAt` and `updatedAt`
  - `versionSource` (optional: run/task/ref or event basis)
- `sourceRefs` must include hashes/timestamps where available to support staleness checks.

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
