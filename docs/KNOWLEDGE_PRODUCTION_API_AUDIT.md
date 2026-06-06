# Knowledge Production API Audit

## Status

Inspect-only audit for `KNOWLEDGE-PROD-API-AUDIT-01`.

Current Knowledge / Skills is a partial Stable v0.1 MVP, not production-ready
Knowledge Catalog architecture. It preserves the important safety boundary that
Knowledge is explicit operator-controlled project memory, but it lacks the
durable item model, provenance, draft-review ledger, and Queue-owned context
state required by `docs/KNOWLEDGE_PRODUCTION_CONTRACT.md`.

## Targeted Files Inspected

- Storage/schema: `crates/hobit-storage-sqlite/src/schema.rs`,
  `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`,
  `crates/hobit-storage-sqlite/src/store/skills.rs`.
- App service/types: `crates/hobit-app/src/workspace_service/knowledge_document_types.rs`,
  `crates/hobit-app/src/workspace_service/knowledge_documents.rs`,
  `crates/hobit-app/src/workspace_service/skills.rs`.
- Tauri/API: `apps/desktop/src-tauri/src/knowledge_documents_dto.rs`,
  `apps/desktop/src-tauri/src/knowledge_documents_commands.rs`,
  `apps/desktop/src-tauri/src/skills_dto.rs`,
  `apps/desktop/src-tauri/src/skills_commands.rs`.
- Frontend APIs/UI/helpers: `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`,
  `apps/desktop/frontend/src/workspace/types/skills.ts`,
  `apps/desktop/frontend/src/workspace/*KnowledgeDocumentsApi.ts`,
  `apps/desktop/frontend/src/workbench/SkillLibraryWidget.tsx`,
  `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.helpers.ts`,
  `apps/desktop/frontend/src/workbench/knowledgeDraft*.ts`,
  `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts`,
  `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts`.
- Direct tests: Knowledge document storage/service/Tauri tests, Queue context
  tests, Workspace Agent Knowledge prompt tests, and Knowledge / Queue
  attachment widget tests.

## 1. Current Fields And Storage Schema

Knowledge Documents persist in `knowledge_documents` plus deterministic
`knowledge_document_chunks`.

Current document fields:

- `knowledge_document_id`, nullable `workspace_id`, `scope`
  (`workspace` or `global`), `catalog_item_type`, `quick_summary`,
  `lifecycle_status`, `title`, `source_label`, `source_kind`, `source_ref`,
  `content`, `tags`, `enabled`, `created_at`, `updated_at`.

Current chunk fields:

- `chunk_id`, `knowledge_document_id`, nullable `workspace_id`, `scope`,
  `chunk_index`, `text`, `created_at`.

Skills persist in `skills`.

Current Skill fields:

- `skill_id`, `workspace_id`, `title`, `when_to_use`, `prerequisites`,
  `steps`, `validation`, `risks`, `tags`, `review_status`, `created_at`,
  `updated_at`.

Production gaps:

- No `searchable` field.
- No immutable `version` / revision table.
- No `reviewedAt`, `createdByTaskId`, `createdFromRunId`.
- No structured `sourceRefs[]` or `relations[]`.
- No durable draft-pack / draft-review ledger.
- Skills are workspace-local only and do not share the production lifecycle
  model; they use `review_status` instead.

## 2. Current APIs And Tauri Commands

Knowledge Document service/API supports:

- `create_knowledge_document`
- `list_knowledge_documents`
- `get_knowledge_document`
- `update_knowledge_document`
- `delete_knowledge_document`
- `search_knowledge_documents`

Skill service/API supports:

- `create_skill`
- `list_skills`
- `get_skill`
- `update_skill`
- `delete_skill`

Frontend wrappers mirror those commands through Tauri and dev-memory fallback
APIs. Tauri DTOs expose the same partial fields.

Production gaps:

- No Queue-owned Knowledge context CRUD/API.
- No draft review ledger commands.
- No source-ref relation APIs.
- No immutable version read/write APIs.
- No searchable toggle or production activation policy API.

## 3. Current Draft Review Behavior

Draft packs are parsed from visible JSON/report text in
`knowledgeDraftPacks.ts`. `useSkillLibraryDraftReview.ts` keeps review
decisions in React state only.

Accept behavior:

- Document drafts create active, enabled Knowledge Documents with
  `source_kind = "queue_draft"` and best-effort `source_label/source_ref`.
- Skill drafts create reviewed Skills.

Reject behavior:

- Rejection is local UI state only and displays as archived/rejected for the
  current review.
- No rejected Knowledge record, audit record, Evidence record, or durable
  decision ledger is created.

This matches the Stable v0.1 decision, but it is not production-ready under
the production contract.

## 4. Current Queue Context Behavior

Queue context is frontend-local/current-session in `AgentQueueTask.context`.
It supports attached Knowledge refs, Skill refs, bounded snapshots, warnings,
token estimates, and visible prompt materialization.

Current safety behavior:

- Disabled and rejected Knowledge are blocked on attach.
- Deprecated Skills are blocked.
- Stale, draft, archived, needs-review, and missing-summary states warn.
- Materialized prompts include visible bounded snapshots before the task prompt.
- Handoff text states that context is current-session and not saved as Queue
  task context.

Production gaps:

- Queue context is not persisted in Queue storage/API.
- No durable warning acknowledgements.
- No immutable context snapshots tied to run ids.
- No structured execution evidence beyond visible run handoff text.
- Current snapshots may include bounded excerpts from document bodies; raw full
  bodies are not copied by default, but there is no persisted source-version
  replay model.

## 5. Current Search Behavior

Search is lexical, chunk-based, bounded, and deterministic.

Implemented search rules:

- Empty queries return no results.
- Workspace-local documents are searched only in their workspace.
- Global documents are visible/searchable across workspaces.
- Search includes only `enabled = true` and `lifecycle_status = active`.
- Search scores title, tags, source label, and chunk text.
- Result count is capped from 1 to 20; snippets are bounded to 900 chars.

Production gaps:

- No separate `searchable` flag.
- No search-result lifecycle/provenance/version fields beyond current partial
  DTO fields.
- No secret warning/redaction policy before search/materialization.
- No immutable version id in results.
- No vector/embedding search, which is intentionally out of scope for this
  tranche.

## 6. Current Source Refs / Provenance

Current provenance is partial:

- `source_label`, `source_kind`, and `source_ref` are single string fields.
- Accepted draft Knowledge records use best-effort Queue/draft refs.
- Queue materialization uses ids, updated timestamps as versions, source labels,
  scopes, warning ids, and snapshot ids in visible handoff text.

Production gaps:

- No structured `sourceRefs[]` array with selector, origin, hash/timestamp,
  selected-at/captured-at, redaction, or cap notes.
- No `relations[]`.
- No first-class `createdByTaskId` or `createdFromRunId`.
- No source snapshot/version table.
- No durable replay of what source refs were accepted, rejected, attached, or
  materialized.

## 7. Gaps To Production-Ready

Required implementation gaps:

1. Add production item model fields or a dedicated Knowledge item/version model:
   `searchable`, immutable version, reviewed timestamp, created-by task/run,
   structured source refs, relations, and lifecycle policy.
2. Add durable draft-pack and draft-review ledger storage/API with accepted,
   rejected, edited, split, merged, and blocked dispositions.
3. Add Queue-owned task context storage/API with refs, bounded snapshots,
   warnings, token budget, materialized-at, warning acknowledgement, and
   run-link evidence refs.
4. Add production source-ref/provenance model and UI review support.
5. Add activation/search policy so only active + enabled + searchable records
   are normal search/attach/materialization candidates.
6. Add stale/draft/archived warning/ack/block policy consistently across
   Knowledge search, Queue attach, Workspace Agent retrieval, and draft review.
7. Add secret warning/redaction checks before acceptance, attach, and
   materialization.
8. Keep no vector search, no embeddings, no background scanning, no auto-ingest,
   and no hidden context injection.

## 8. Exact Implementation Blocks And Risky Files

Recommended focused blocks:

1. `KNOWLEDGE-PROD-MODEL-01`: schema/type design for production Knowledge item
   versions and `searchable/sourceRefs/relations` fields.
2. `KNOWLEDGE-PROD-SEARCH-01`: activation/search policy hardening and result
   provenance/version DTOs.
3. `KNOWLEDGE-DRAFT-LEDGER-01`: durable draft-pack/review disposition model.
4. `QUEUE-KNOWLEDGE-CONTEXT-API-01`: durable Queue-owned context refs,
   snapshots, warnings, token budget, and run evidence linkage.
5. `KNOWLEDGE-SAFETY-POLICY-01`: secret warning/redaction and stale/draft/
   archived acknowledgement policy.

Risky files:

- `crates/hobit-storage-sqlite/src/schema.rs`
- `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`
- `crates/hobit-app/src/workspace_service/knowledge_documents.rs`
- `apps/desktop/src-tauri/src/knowledge_documents_dto.rs`
- `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`
- `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`
- `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`
- `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts`
- `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts`

Safety boundaries preserved by this audit:

- No code, schema, runtime, frontend, or test behavior changed.
- No automatic context injection added.
- No background repository scanning or auto-ingest added.
- No vector search or embeddings added.
- No Queue context persistence added.
- No draft-review persistence added.
