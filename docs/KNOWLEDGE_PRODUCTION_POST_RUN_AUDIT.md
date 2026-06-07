# Knowledge Production Post-Run Audit

Audit date: 2026-06-07

Mode: docs-producing inspect-only audit.

## 1. Executive summary

- Readiness: almost ready.
- Main blockers: Queue run start still accepts caller-supplied `materializedOperatorPrompt`, so backend durable-context materialization is not the sole execution path; draft review ledger actions do not cover the full production vocabulary; Skills do not yet share the production item/version/source-ref model; production status/smoke docs still describe several now-implemented features as gaps.
- Stable/product decision: Knowledge / Skills can remain Stable v0.1 as explicit operator-controlled project memory with durable Knowledge Documents, durable draft-review records, and durable Queue task context, but it should not be called fully production-ready until backend-owned prompt materialization and doc drift are closed.
- Recommended next step: harden Queue execution to materialize durable context server-side for every run path and remove or tightly validate the prompt override, then update stale Knowledge production docs.

## 2. Capability matrix

| Capability | Expected | Current implementation | Status | Evidence files | Risk |
| --- | --- | --- | --- | --- | --- |
| typed Knowledge model | Production item fields: type, title, summary, full content, scope, lifecycle, enabled/searchable, source refs, relations, version, review/task/run metadata. | Knowledge Documents expose typed create/update/list DTOs and service inputs for catalog type, quick summary, lifecycle, source refs, relations, searchable, version, reviewed-at, created-by task, and created-from run. | Mostly pass | `crates/hobit-app/src/workspace_service/knowledge_document_types.rs`, `apps/desktop/src-tauri/src/knowledge_documents_dto.rs`, `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts` | Skills remain separate review-status records, not production Knowledge items with source refs/version lifecycle. |
| storage/schema/version metadata | Durable schema with production fields and immutable versions/snapshots. | SQLite has Knowledge fields plus `knowledge_document_versions`; create/update increments `version` and inserts version rows. | Mostly pass | `crates/hobit-storage-sqlite/src/schema.rs`, `crates/hobit-storage-sqlite/src/store/knowledge_document_schema.rs`, `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs` | Version rows store full content and refs, but Queue snapshots use `updated_at` as visible version rather than immutable version id. |
| draft ledger | Durable ledger for accepted, rejected, edited, split, merged, blocked decisions with queue/run links and resulting ids/versions. | Durable `knowledge_draft_review_ledger` exists with pack/item/source fingerprint, queue/run links, action, review timestamp, accepted Knowledge/Skill id, and rejection reason. | Partial | `crates/hobit-storage-sqlite/src/store/knowledge_draft_review_ledger.rs`, `crates/hobit-app/src/workspace_service/knowledge_draft_review_ledger.rs`, `apps/desktop/src-tauri/src/knowledge_draft_review_dto.rs` | Service only accepts `accepted`, `edited_before_accept`, and `rejected`; no split/merged/blocked and no resulting version ids. |
| durable Queue context | Queue task owns durable attached refs, bounded snapshots, warnings, token budget, and materialized prompt context. | `agent_queue_tasks.context_json` persists refs, snapshots, warnings, token budget, and materialized timestamp; attach/detach updates it transactionally. | Mostly pass | `crates/hobit-app/src/workspace_service/agent_queue_context.rs`, `crates/hobit-storage-sqlite/src/store/agent_queue_tasks.rs`, `crates/hobit-app/src/workspace_service/agent_queue_context_tests.rs` | Generic storage still has raw `context_json`; app/Tauri create/update hide it, but storage tests prove arbitrary low-level storage values can round-trip. |
| typed attach/detach APIs | Queue context mutation through typed, validated Knowledge/Skill attach/detach APIs. | Tauri and app service expose typed attach/detach requests for Knowledge and Skills; generic task create/update inputs do not include `context_json`. | Pass | `apps/desktop/src-tauri/src/agent_queue_task_dto.rs`, `apps/desktop/src-tauri/src/agent_queue_task_commands.rs`, `crates/hobit-app/src/workspace_service/agent_queue_task_types.rs` | Frontend still parses returned `context_json`; malformed persisted context can surface as unsupported/empty depending adapter path. |
| context materialization | Runner materializes durable Queue context into bounded prompt before execution. | Backend materializer prepends Knowledge / Skills context and appends `Context used`; backend runner continuation calls it. Frontend manual/sequential/autorun also pre-materialize from parsed task context. | Partial | `crates/hobit-app/src/workspace_service/agent_queue_context/prompt.rs`, `crates/hobit-app/src/workspace_service/agent_queue_execution.rs`, `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`, `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts` | `StartAssignedAgentQueueTaskInput.materialized_operator_prompt` can bypass backend materialization with arbitrary prompt text. |
| context-used evidence | Visible record of context used in prompt/evidence/report metadata. | Materialized prompt includes `Context used` with queue task id, storage note, snapshot ids, Knowledge/Skill refs, materialized-at, token estimate, warning ids, scopes, and sources. | Mostly pass | `crates/hobit-app/src/workspace_service/agent_queue_context/prompt.rs`, `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts`, `crates/hobit-app/src/workspace_service/agent_queue_context_tests.rs` | This is prompt/report text, not a separate immutable Evidence store or run metadata table. |
| structured source refs | Source refs are structured and preserved from generation/import/Notes/Finder/manual sources. | Rust and TS define structured `KnowledgeSourceRef`; DTOs accept/persist JSON `source_refs`; draft acceptance maps pack refs into Knowledge refs; legacy fields are backfilled from first source ref. | Mostly pass | `crates/hobit-app/src/knowledge/production.rs`, `apps/desktop/frontend/src/workbench/knowledgeSourceRefs.ts`, `apps/desktop/frontend/src/workbench/knowledgeDraftAcceptance.ts`, `apps/desktop/src-tauri/src/knowledge_documents_dto.rs` | Generation Queue task refs still have a prompt fallback; not every source path guarantees durable structured task metadata before acceptance. |
| catalog UI | Production catalog UI for fields, status, refs, review, and attach surfaces. | Knowledge / Skills has catalog list/detail utility panels, document fields, quick-summary warning, draft review, and Queue attach flows. | Mostly pass | `apps/desktop/frontend/src/workbench/SkillLibraryCatalogPreview.tsx`, `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`, `apps/desktop/frontend/src/workbench/SkillLibraryDraftReviewPanel.tsx` | Large components make future policy changes expensive. |
| search/safety/caps | Search/materialization capped; active+enabled+searchable only; disabled/rejected blocked; stale/draft/archive warning-bearing or blocked. | Search filters `enabled = 1`, `searchable = 1`, `lifecycle_status = 'active'`; Queue attach blocks disabled, non-searchable, rejected Knowledge and deprecated Skills; stale/draft/archived warn; excerpts and prompt chars are capped; possible-secret warnings exist. | Mostly pass | `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`, `crates/hobit-app/src/workspace_service/agent_queue_context.rs`, `crates/hobit-app/src/workspace_service/agent_queue_context/safety.rs`, `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts` | Secret policy warns but does not block; Workspace Agent retrieval lacks source/version metadata in its prompt evidence beyond scope/title/chunk. |
| Agent/Queue integration | Workspace Agent and Queue use Knowledge visibly, explicitly, and without hidden memory. | Workspace Agent Codex lookup uses enabled Knowledge snippets with caps/scope labels; Skills attach visibly; Queue attach/detach/materialization is explicit and durable. | Mostly pass | `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts`, `apps/desktop/frontend/src/workbench/WorkspaceAgentDirectModePanel.tsx`, `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts` | Workspace Agent auto-retrieval is explicit to Codex run UI but not operator-selected per document; still bounded and enabled-only. |

## 3. Safety audit

- Hidden memory: not found.
- Hidden context injection: no hidden sources found, but Queue start prompt override is a control weakness because caller-provided prompt text can replace backend materialization.
- Arbitrary `context_json` injection: app/Tauri generic create/update cannot inject it; storage-level `NewAgentQueueTask`/`AgentQueueTaskUpdate` still can, which is acceptable only as internal storage plumbing.
- Background indexing: not found.
- Auto-ingest: not found; import, Notes promotion, Finder/generation task creation, draft acceptance, and Queue attach are explicit.
- Vector search: not found; search remains lexical/chunk based.
- Full raw body prompt injection: Queue snapshots include bounded excerpts, not full bodies by default; Workspace Agent uses capped snippets.
- Disabled/rejected/stale behavior: search blocks disabled/non-searchable/non-active; Queue attach blocks disabled/non-searchable/rejected Knowledge and deprecated Skills; stale/draft/archived are warning-bearing, not hard-blocked.

## 4. Docs/code drift

- `docs/KNOWLEDGE_PRODUCTION_STATUS.md` is stale: it says no `searchable`, no immutable version table, no structured `sourceRefs[]`/`relations[]`, no `reviewedAt`/task/run fields, no draft ledger, and no durable Queue context.
- `docs/KNOWLEDGE_PRODUCTION_SMOKE_CHECKLIST.md` is stale: several expected results still describe those same features as future/current-session only.
- `docs/CURRENT_WIDGET_SURFACE.md` still partially underclaims current production-pack behavior by saying durable structured `sourceRefs`, created-by task provenance, and durable Queue-owned context remain future.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` still says durable Queue-owned context is deferred/current-session only, conflicting with `agent_queue_tasks.context_json` durable attach state.
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` is still mostly accurate for generation runtime limits, but underclaims draft-review durability after the ledger addition.

## 5. Maintainability risks

- Large Knowledge/Queue files are now policy-heavy: `SkillLibraryWidget.test.tsx` 936 lines, `useAgentQueueTaskActions.ts` 900, `useAgentQueueController.ts` 882, `agent_queue_context.rs` 644, `SkillLibraryDocumentsPanel.tsx` 644, `knowledge_documents.rs` 612 app / 569 storage.
- Queue context policy is duplicated between backend `agent_queue_context.rs` and frontend `agentQueueKnowledgeContext.ts`.
- Production Knowledge fields exist in Knowledge Documents but not Skills, so future “Knowledge item” operations risk divergent lifecycle and provenance rules.

## 6. Required manual smoke

1. Create workspace-local and global Knowledge Documents with quick summary, source refs, relations, active lifecycle, enabled/searchable true; reload app and confirm fields persist.
2. Update a Knowledge Document twice; confirm `version` increments, version summary/source refs remain visible in current record, and search returns only the active searchable enabled version.
3. Disable one matching document, mark one rejected, mark one stale, and mark one archived; confirm search excludes all but active enabled searchable, Queue attach blocks disabled/rejected and warns for stale/archived.
4. Accept and reject generated draft pack items; reload app and confirm draft review decisions remain listed with queue/run/source fingerprint and accepted item ids, while rejected content is not searchable or attachable.
5. Attach a Knowledge Document and Skill to a Queue task; reload app and confirm task context refs, snapshots, warnings, token budget, and materialized timestamp persist.
6. Start a manual assigned Queue run with attached context; confirm the run prompt includes `Knowledge / Skills context` and `Context used` with snapshot/ref ids before the task prompt.
7. Start Queue Autorun/runner continuation with attached context; confirm backend materialized context is used and no frontend-only context disappears after reload.
8. Try large and obvious-secret content; confirm bounded excerpt, capped marker, token estimate, and `possible_secret` warning are visible before execution.
9. Run Workspace Agent Codex with matching Knowledge; confirm snippets are capped, scope-labeled, visible in Direct Work details, and no disabled documents, Skills, Notes, files, logs, Git/JDBC/Terminal state, or hidden context are searched.
10. Create Knowledge from import, Notes promotion, Finder selection, and manual draft acceptance; confirm structured source refs survive create/read/update and legacy source label/kind/ref remain coherent.

## 7. Recommended next blocks

1. Queue Context Run Hardening: remove or constrain `materializedOperatorPrompt` override so backend materializes durable Queue context for every start path.
2. Knowledge Production Docs Refresh: update production status, smoke checklist, current surface, and Queue context contract to reflect implemented durable fields/ledger/context.
3. Draft Ledger Vocabulary Completion: support `edited`, `split`, `merged`, and `blocked`, and link accepted records to immutable Knowledge versions.
4. Skill Production Model Alignment: decide whether Skills become production Knowledge items or retain a separate MVP model with explicit documented gaps.
5. Context Evidence Persistence Decision: decide whether `Context used` remains prompt text or gets a durable run evidence/ref table.
6. Source Ref Runtime Hardening: remove prompt-only source-ref fallback where Queue task/source metadata can now be typed.
7. Knowledge/Queue Policy Deduplication: consolidate duplicated frontend/backend context capping and warning logic.
8. File-Size Remediation: split the largest Knowledge/Queue files before more production behavior is added.
