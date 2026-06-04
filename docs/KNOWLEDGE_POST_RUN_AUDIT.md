# Knowledge Post-Run Audit

Audit date: 2026-06-04

Mode: docs-producing inspect-only audit.

## 1. Executive summary

- Knowledge readiness: almost ready.
- Main remaining blockers: docs drift still says Knowledge Catalog, Queue context, and Notes-to-Knowledge are not implemented; Queue task Knowledge/Skill context is frontend-local rather than durable Queue-owned storage/API state; quick summaries are modeled but not required non-empty; file-size validation reports hard ratchet/new-oversized blockers.
- Stable v0.1 decision: keep Knowledge / Skills in Stable v0.1 as implemented MVP plus focused Queue-context extensions, but do not call the full Knowledge Catalog complete until docs and durable context ownership are reconciled.
- Recommended next step: run a focused Knowledge docs/code drift cleanup block, then split the oversized Knowledge/Queue/Finder implementation files before more feature work.

## 2. Implemented capability matrix

| Capability | Expected behavior | Current implementation | Status | Evidence files | Risk |
| --- | --- | --- | --- | --- | --- |
| Knowledge Catalog | Typed items with summary, content, source, scope, lifecycle, relations, and explicit use. | Knowledge Documents now carry catalog item type, quick summary, lifecycle, source kind/ref, scope, and content. No standalone Catalog item store or first-class related files/tasks/commits/created-by-task fields. | Partial | `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`, `crates/hobit-app/src/workspace_service/knowledge_documents.rs` | Full Catalog contract overclaim if docs are not updated. |
| global/local scopes | Workspace-local and local-global Knowledge must be distinct and visible. | `workspace` and `global` scopes exist; global docs store `workspace_id = NULL`, list/search includes globals across Workspaces. UI uses scope labels. | Pass | `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`, `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts` | Scope naming differs from contract text: `workspace` vs `workspace-local`. |
| quick summaries | Every item should have a quick summary or equivalent. | Field exists and is capped to three lines in service. Draft acceptance and Notes promotion populate it. Manual/import paths can still create empty summaries. | Partial | `crates/hobit-app/src/workspace_service/knowledge_documents.rs`, `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`, `apps/desktop/frontend/src/workbench/notes/useWorkspaceNotesController.ts` | Empty summaries reduce attach/review quality. |
| lifecycle states | Draft, active, stale, archived, rejected must behave consistently. | Knowledge lifecycle values are validated and persisted; search uses active+enabled only; attach blocks disabled/rejected and warns for stale/draft/archived. | Mostly pass | `crates/hobit-app/src/workspace_service/knowledge_documents.rs`, `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`, `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts` | Draft/archived attach is warning-only, not blocked. This is allowed by the future contract policy range but should be documented. |
| generation from codebase | Workspace Agent should create visible Queue task drafts using selected codebase refs only. | Queue command parser creates manual Knowledge-generation Queue tasks with selected codebase area prompts and no execution/activation. | Pass for task creation | `apps/desktop/frontend/src/workbench/workspaceAgentQueuePromptTemplates.ts`, `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts` | Actual analysis still depends on explicit Queue/Executor run and returned report. |
| generation from docs | Docs-to-Knowledge should use selected docs only and return drafts. | Local proposal flow creates a manual draft Queue task from explicit docs/path text; tests assert no scanning or activation. | Pass for task creation | `apps/desktop/frontend/src/workbench/coordinatorLocalProposalGeneration.ts`, `apps/desktop/frontend/src/workbench/coordinatorLocalProposalGeneration.test.ts` | The docs contract still says this workflow is planned only. |
| generation from history | Coordinator/command/run history must be selected, not hidden. | History prompt templates require explicit source refs, forbid hidden transcripts/logs/raw output, and create manual Queue tasks. | Pass for task creation | `apps/desktop/frontend/src/workbench/workspaceAgentQueuePromptTemplates.ts`, `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts` | Source refs are prompt text, not structured persisted refs. |
| draft review | Generated packs must be reviewed before becoming Knowledge. | Worker report text can expose draft packs; Knowledge / Skills parses draft JSON and requires explicit Accept or Reject/archive per item. | Pass | `apps/desktop/frontend/src/workbench/knowledgeDraftPacks.ts`, `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`, `apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.result-evidence.test.tsx` | Reject is a local review disposition, not a durable rejected Knowledge record. |
| attach to Workspace Agent | Attach must be visible and explicit. | Selected Skills attach as visible editable Workspace Agent context. Knowledge Document retrieval for Codex runs is enabled-only, capped, and visible. | Pass for Stable scope | `apps/desktop/frontend/src/workbench/SkillLibrarySkillsPanel.tsx`, `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts` | Selected Knowledge Document full-body attach to Workspace Agent remains intentionally out of scope. |
| attach to Queue task | Knowledge/Skills should attach as task-owned safe refs/summaries. | Selected saved Knowledge Documents and Skills attach to the selected Queue task as refs plus bounded snapshots. Attach does not start work. | Partial | `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts`, `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`, `apps/desktop/frontend/src/workbench/SkillLibraryWidget.knowledge-attachments.test.tsx` | Attachment is frontend-local task state, not durable backend Queue task context. |
| prompt materialization | Attached context must be visible before execution. | Manual and sequential Queue runs pass a materialized prompt that prepends visible bounded context plus evidence section before the task prompt. | Pass, frontend runtime | `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts`, `apps/desktop/frontend/src/workbench/queue/useAgentQueueRunActions.ts`, `apps/desktop/frontend/src/workbench/queue/useAgentQueueSequentialRunner.ts` | Durable run evidence is indirect through the materialized prompt, not a separate evidence record. |
| update/refresh | Source-backed Knowledge should refresh through draft review, not mutate directly. | Source-backed docs can create a manual Queue refresh task; prompt says current item remains unchanged until operator accepts update. | Pass for task creation | `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`, `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx` | No automatic source re-check or durable refresh workflow state. |
| stale/archive/delete | Operators should mark stale/archive/delete explicitly. | Document lifecycle actions exist; delete exists; search blocks non-active documents; stale attach confirms and carries warning. | Mostly pass | `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`, `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs` | Current docs still describe no archive/delete UI in some places. |
| Finder source integration | Finder must create explicit Knowledge task from selected source only. | Finder shows a Knowledge source panel and creates manual Queue tasks for selected file/folder refs without activation. | Pass | `apps/desktop/frontend/src/workbench/FinderWidget.tsx`, `apps/desktop/frontend/src/workbench/FinderWidget.test.tsx` | Finder file is oversized and ratcheted. |
| Notes promotion | Notes should promote only by explicit operator action. | Saved selected note opens a promotion panel; Create document writes a separate Knowledge Document with source kind/ref and leaves the note unchanged. | Pass | `apps/desktop/frontend/src/workbench/notes/useWorkspaceNotesController.ts`, `apps/desktop/frontend/src/workbench/notes/NotesEditor.tsx`, `apps/desktop/frontend/src/workbench/NotesPlaceholderWidget.test.tsx` | Default promotion status constant is `active`, though UI allows draft/status choice and enabled depends on active. |
| relations | Knowledge should preserve lightweight relations. | Source label/kind/ref and draft source refs exist; refresh prompts include document id/source ref; no first-class related files/tasks/commits fields. | Partial | `apps/desktop/frontend/src/workbench/knowledgeDraftPacks.ts`, `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx` | Provenance is text-based, not structured enough for full Catalog. |
| tests/safety | Focused automated coverage should prove safety boundaries. | Focused tests cover generation prompts, draft review, attach/materialization, disabled/rejected blocking, stale warnings, Finder and Notes integrations. | Pass for focused scope | `docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md` plus listed test files | Full suites were not rerun in this inspect-only block. |

## 3. Contract alignment

- Knowledge Catalog contract: partially aligned in implemented fields and lifecycle, but the contract still says Catalog is not implemented. Current code does not satisfy the full required model because related files/tasks/commits and created-by-task are not first-class required fields, and there is no standalone Catalog item store.
- Knowledge generation contract: aligned for visible Queue task creation and draft-pack review boundaries. Current implementation is prompt/task based, not structured sourceRef storage or a generation runtime.
- Knowledge Queue context contract: aligned for safe refs, warnings, bounded snapshots, right-rail visibility, and materialized prompt evidence. Not fully aligned on durable Queue ownership because context is frontend-local task state.
- Stable v0.1 contract: aligned with Knowledge / Skills as explicit reusable context and with no hidden memory, no vector search, no folder scan, no provider tools, and no automatic activation.
- Product UI design contract: mostly aligned. Context and draft packs appear in explicit secondary/review surfaces. Risk: large embedded panels and oversized files are maintainability/UI-complexity pressure.
- Universal widget shell contract: mostly aligned with widget-owned surfaces and app-native callbacks. Risk: Queue context attach currently crosses through widget render props/local state rather than a durable Workspace API action.

## 4. Safety audit

- Hidden memory: not found.
- Hidden context injection: not found. Workspace Agent provider paths still keep `allowed_tools: []`; Knowledge snippets are enabled-only, capped, scope-labeled, and visible for explicit Codex runs.
- Background indexing: not found.
- Auto-ingest: not found. Import, Notes promotion, Finder task creation, and draft acceptance are explicit.
- Vector search: not found; search remains lexical/chunk based.
- Raw full document body copied into Queue task by default: not in refs, but bounded document excerpts are stored in frontend snapshots and can enter the materialized prompt. This is visible and capped, but not durable-policy-backed.
- Direct Queue execution from Knowledge attach: not found. Attach returns visible message and does not materialize/start work.
- Disabled/stale/rejected usage: disabled and rejected Knowledge are blocked on attach; stale is warning-bearing with confirmation; draft/archived are warning-bearing; search only returns active+enabled.

## 5. File-size / maintainability risks

Hard blockers from `python scripts/hobit/check-file-sizes.py`:

- New oversized source file: `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx` at 1269 lines.
- Ratchet violations: `FinderWidget.tsx`, `coordinatorLocalProposalGeneration.ts`, `queue/useAgentQueueController.ts`, `workspaceAgentQueueCommandHandler.test.ts`, `TerminalPtySessionPanel.tsx`, `queue/useAgentQueueAutonomousRunner.ts`, `workspace/tauriAgentQueueApi.ts`, and `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`.
- New oversized warnings: `SkillLibraryWidget.test.tsx` and `skillLibraryModel.ts`.

Advisory risk:

- Knowledge, Queue, Finder, and proposal parsing logic are concentrated in already-large files. Future changes should start with extraction/refactor blocks, not more feature accretion.

## 6. Stale docs / code drift

- `docs/KNOWLEDGE_CATALOG_CONTRACT.md` still says Knowledge Catalog is not implemented and is docs/type-design only, while code now implements a partial catalog-shaped Knowledge Document model.
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` still says the workflow is planned only, while Workspace Agent/Finder can now create Knowledge-generation Queue task prompts and draft-pack review exists.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` still says Queue task context semantics are planned only, while frontend Queue context attach/materialization is implemented.
- `docs/CURRENT_WIDGET_SURFACE.md` still says Knowledge / Skills does not implement Knowledge Items, Notes-to-Knowledge promotion, and Knowledge Catalog, while code now implements partial catalog fields and explicit Notes promotion.
- `docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md` is the closest current status record, but it does not override stale contract text.

## 7. Recommended next blocks

1. Knowledge Docs Drift Cleanup
   - Objective: reconcile `CURRENT_WIDGET_SURFACE`, Knowledge contracts, and Stable status with implemented partial Catalog/Queue-context behavior.
   - Acceptance: docs distinguish implemented partial model, planned full Catalog, and durable-context gaps without contradictions.

2. Durable Queue Context Contract Delta
   - Objective: decide whether Queue context remains frontend-local for Stable v0.1 or gets persisted as Queue-owned state.
   - Acceptance: contract names the current behavior, storage/API non-goals, and future migration shape.

3. Skill Library Documents Split
   - Objective: split `SkillLibraryDocumentsPanel.tsx` into editor, draft review, catalog list, attach controls, and refresh-task helpers.
   - Acceptance: file-size check no longer reports this file as new oversized; behavior/tests unchanged.

4. Queue Context API Hardening
   - Objective: add or explicitly defer app-native attach/detach/materialize actions for Queue task context.
   - Acceptance: either durable API exists with tests, or docs state frontend-local current-session behavior clearly.

5. Quick Summary Required UX
   - Objective: make quick summary non-empty for create/import/manual edit, or show an explicit missing-summary warning.
   - Acceptance: every active Knowledge Document has a useful summary or an operator-visible warning before attach/search/review.

6. Structured Source Refs
   - Objective: replace prompt-text-only generation source refs with structured refs where feasible.
   - Acceptance: codebase/docs/history generation tasks preserve kind, label, selector, reason, and caps in typed task metadata or an accepted non-storage equivalent.

7. Draft Review Persistence Decision
   - Objective: decide whether rejected/accepted draft decisions should be durable.
   - Acceptance: rejected draft handling is either documented as local review-only or persisted with a clear lifecycle/status.

8. File-Size Ratchet Remediation
   - Objective: reduce current Knowledge/Queue/Finder oversized and ratcheted files before new feature work.
   - Acceptance: Toolbelt file-size check passes or reports only unchanged legacy debt.
