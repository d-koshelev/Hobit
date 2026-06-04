# Knowledge / Skills Widget Audit

## 1. Executive summary

- Current state: Knowledge / Skills is real implemented MVP functionality, not only docs and not only a placeholder. It uses the retained `skill-library` widget id/component for compatibility and currently exposes Skills plus scoped Knowledge Documents.
- Stable v0.1 decision: include as a Stable v0.1 MVP widget, with a narrow scope: operator-authored Skills, workspace-local and local-global plain-text/Markdown Knowledge Documents, explicit single-file import, visible Workspace Agent Skill attach, and enabled-only visible Knowledge Document retrieval for Workspace Agent Codex runs.
- Main blockers: no blocker found that requires demoting the current implementation to preview-only. The main gaps are next-slice gaps: no formal Knowledge Workspace Widget API snapshot/capability contract, no manual document search UI inside the widget, no selected Knowledge Document attach, no attach-to-Queue-task flow, no Knowledge Item taxonomy, and no Context Pack/Evidence/Artifact linkage.
- Recommended next step: keep Knowledge / Skills in Stable v0.1 as MVP, then implement `KNOWLEDGE-MVP-QUEUE-ATTACH-01` only after a small docs-first API contract block clarifies selected context, Queue task context ownership, and visible review rules.

## 2. Existing code and docs

### Product and contract docs

- `AGENTS.md`: treats Knowledge / Skills as a current product-facing Widget Catalog surface and describes the current MVP boundary: workspace-local Skills, workspace/local-global Knowledge Documents, explicit import, enabled-only visible retrieval, selected Skill attach, and no hidden memory, embeddings, folder scans, or Context Packs.
- `docs/ACTIVE_CONTRACT_INDEX.md`: points future agents to `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` for Knowledge, Skills, Evidence, Context Pack, and Runbook boundaries.
- `docs/CURRENT_WIDGET_SURFACE.md`: source-of-truth current inventory. It describes Knowledge / Skills as Current Ready / MVP and details Skills CRUD, Knowledge Document CRUD/search/import, local/global scope, Workspace Agent proposal creation, selected Skill attach, and Codex run retrieval.
- `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`: active Knowledge boundary contract. It confirms the current MVP and distinguishes Knowledge Documents and Skills from future Knowledge Items, Evidence, Context Packs, Runbooks, hidden memory, and team/server knowledge.
- `docs/HOBIT_STABLE_V0_1_CONTRACT.md`: includes Knowledge / Skills in the Stable v0.1 product surface and defines it as the operator-authored reusable context surface.
- `docs/HOBIT_STABLE_V0_1_ACCEPTANCE.md`: has acceptance checks for Skill CRUD, Skill attach, Knowledge Document create/import/search/list, visible capped snippets, disabled document behavior, and no hidden ingestion.
- `docs/ARCHITECTURE.md`: summarizes implemented architecture and current widget inventory, including Knowledge / Skills storage/API/UI and Workspace Agent retrieval boundaries.
- `docs/ARCHITECTURE_MILESTONE_STATUS.md`: checkpoint note stating the Knowledge / Skills MVP exists and that Knowledge/Evidence/Context Pack refs are type-only beyond the current MVP.
- `docs/WORKSPACE_CONTRACT.md`: records workspace isolation and compact Start Screen counts for skills/documents.
- `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`: documents selected Skill attach and enabled Knowledge Document retrieval as current Workspace Agent-compatible behavior.
- `docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`: include Skill Library / Knowledge capability direction, mostly as capability/reference architecture.
- `docs/DESKTOP_FIRST_SERVER_READY_ARCHITECTURE_CONTRACT.md`: keeps Knowledge, Skills, Evidence, Artifact, and Context Pack boundaries separate and server-ready.
- `docs/MVP_ACCEPTANCE_WALKTHROUGH.md`: includes manual Knowledge / Skills walkthrough checks.
- `docs/STABLE_V0_1_POST_RUN_AUDIT.md`: notes Knowledge / Skills as part of the current Stable v0.1 surface.
- `README.md` and `apps/desktop/frontend/README.md`: mention current Knowledge / Skills behavior and catalog presence.
- `ROADMAP.md`, `docs/GLOSSARY.md`, `docs/NOTES_WIDGET_CONTRACT.md`, and `decisions/ADR-0007-notes-widget-global-and-workspace-scopes.md`: contain older or boundary language where Knowledge Catalog remains deferred or distinct from Notes.

### Frontend widget and Workbench code

- `apps/desktop/frontend/src/workbench/widgetRegistry.ts`: defines `skill-library` and presents it as `Knowledge / Skills` with default layout metadata.
- `apps/desktop/frontend/src/workbench/catalogTemplates.ts`: includes Knowledge / Skills as a `ready` catalog template under the Knowledge category.
- `apps/desktop/frontend/src/workbench/WidgetHost.tsx`: maps `skill-library-widget` to `SkillLibraryWidget` and normalizes legacy `Skill Library` titles to `Knowledge / Skills`.
- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.tsx`: widget shell with Skills/Documents tabs, top-level safety summary, widget frame/log integration, and tab-specific New actions.
- `apps/desktop/frontend/src/workbench/SkillLibrarySkillsPanel.tsx`: Skills list, select, create, edit, save, delete, review status, tags, and explicit attach to Workspace Agent.
- `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`: Knowledge Document list, scope filter, create, edit, save, delete, enabled flag, and explicit `.txt`/`.md`/`.markdown` import path flow.
- `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`: UI draft shape, dirty checks, review status labels, and visible Skill context formatting.
- `apps/desktop/frontend/src/workbench/widgetProps/knowledgeSkillsWidgetProps.ts`: passes Knowledge / Skills action callbacks into the widget.
- `apps/desktop/frontend/src/workbench/workspaceSkillWidgetActions.ts`: adapts open Workspace state to Skill and Knowledge Document Workspace API calls.
- `apps/desktop/frontend/src/styles/skills.css`: Knowledge / Skills widget styling.

### Frontend Workspace APIs

- `apps/desktop/frontend/src/workspace/types/skills.ts`: Skill DTO/request types.
- `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`: Knowledge Document and search DTO/request types.
- `apps/desktop/frontend/src/workspace/workspaceApiSkills.ts`: Skill API facade over the current Workspace API runtime.
- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDocuments.ts`: Knowledge Document API facade, including search.
- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDocumentImport.ts`: desktop-only import-file API facade.
- `apps/desktop/frontend/src/workspace/memoryWorkspaceSkillsApi.ts`: dev/browser in-memory Skill CRUD.
- `apps/desktop/frontend/src/workspace/memoryWorkspaceKnowledgeDocumentsApi.ts`: dev/browser in-memory Knowledge Document CRUD/search with enabled-only lexical search.
- `apps/desktop/frontend/src/workspace/memoryWorkspaceApi.ts`: wires dev memory APIs in Vite development and unsupported fallbacks outside dev.
- `apps/desktop/frontend/src/workspace/memoryUnsupportedWorkspaceApi.ts`: honest unsupported-runtime errors for non-dev browser fallback.
- `apps/desktop/frontend/src/workspace/tauriWorkspaceSkillsApi.ts`: frontend Tauri Skill command adapter.
- `apps/desktop/frontend/src/workspace/tauriWorkspaceKnowledgeDocumentsApi.ts`: frontend Tauri Knowledge Document command adapter.
- `apps/desktop/frontend/src/workspace/tauriKnowledgeDocumentImportApi.ts`: frontend Tauri import command adapter.
- `apps/desktop/frontend/src/workspace/tauriWorkspaceApi.ts`: includes Knowledge / Skills APIs in the desktop Workspace API and maps compact workspace counts.

### Workspace Agent integration

- `apps/desktop/frontend/src/workbench/workspaceAgentVisibleContext.ts`: formats visible attached context and remove behavior.
- `apps/desktop/frontend/src/workbench/WorkspaceAgentVisibleContextPanel.tsx`: displays attached context in the Workspace Agent composer with Remove and edit-before-send copy.
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx`: receives Skill attach requests, appends visible context into the composer, handles Knowledge Document and Skill proposal creation actions, and passes Knowledge search into Direct Work.
- `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts`: formats Knowledge lookup status, log text, scope labels, and Codex prompt augmentation for matched snippets.
- `apps/desktop/frontend/src/workbench/useWorkspaceAgentDirectWorkController.ts`: searches Knowledge Documents before explicit Run with Codex and only augments the Codex prompt when matches exist.
- `apps/desktop/frontend/src/workbench/WorkspaceAgentDirectModePanel.tsx`: shows Knowledge lookup state and matched snippets in collapsed Direct Work details.
- `apps/desktop/frontend/src/workbench/coordinatorActionProposalRegistry.ts`: defines inert proposal types for creating Knowledge Documents and Skills from visible text.
- `apps/desktop/frontend/src/workbench/coordinatorCatalogActionDrafts.ts`: parses visible chat/fenced `hobit-catalog-action` blocks into Knowledge Document and Skill draft proposal cards.
- `apps/desktop/frontend/src/workbench/coordinatorProviderDraftProposals.ts`: validates provider draft proposals for Knowledge Document and Skill creation.
- `apps/desktop/frontend/src/workbench/workspaceAgentProposalCreationActions.ts`: applies approved Knowledge Document and Skill proposal cards through explicit create actions.
- `apps/desktop/frontend/src/workbench/coordinatorProposalHandoffs.ts`: converts approved proposal fields into existing create request shapes.

### Rust app service and storage

- `crates/hobit-app/src/workspace_service/skills.rs`: WorkspaceService Skill CRUD, workspace ownership checks, tag normalization, and review status validation.
- `crates/hobit-app/src/workspace_service/skills_tests.rs`: service tests for CRUD, unknown workspace rejection, cross-workspace rejection, absent records, and review status limits.
- `crates/hobit-app/src/workspace_service/knowledge_documents.rs`: WorkspaceService Knowledge Document CRUD/search, global/workspace access checks, tag/source/scope normalization, and enabled-only search through storage.
- `crates/hobit-app/src/workspace_service/knowledge_document_search.rs`: search limit and snippet cap helpers.
- `crates/hobit-app/src/workspace_service/knowledge_documents_tests.rs`: service tests for CRUD/search, workspace scope, global visibility, snippet caps, cross-workspace rejection, and empty search.
- `crates/hobit-storage-sqlite/src/schema.rs`: SQLite tables and indexes for `skills`, `knowledge_documents`, and `knowledge_document_chunks`.
- `crates/hobit-storage-sqlite/src/store/skills.rs`: SQLite Skill CRUD.
- `crates/hobit-storage-sqlite/src/store/skills_tests.rs`: storage tests for workspace scoping, CRUD, and workspace deletion cleanup.
- `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`: SQLite Knowledge Document CRUD, chunk replacement, global/workspace visibility, and lexical search.
- `crates/hobit-storage-sqlite/src/store/knowledge_search.rs`: deterministic chunking, lexical term extraction, scoring, sorting, and search limit capping.
- `crates/hobit-storage-sqlite/src/store/knowledge_documents_tests.rs`: storage tests for chunks, disabled/deleted docs, global docs, workspace scoping, scoring, caps, and cleanup.
- `crates/hobit-storage-sqlite/src/inputs.rs`, `rows.rs`, and `mappers.rs`: input/row/mapping types for Skills and Knowledge Documents.
- `crates/hobit-app/src/knowledge/`: Rust reference vocabulary for Knowledge, Skill, Runbook, Evidence, owners, review statuses, and links. It is type scaffolding, not the implemented document store.
- `crates/hobit-app/src/context_packs/mod.rs`: Context Pack reference vocabulary only; no storage/UI/runtime.

### Tauri commands and DTOs

- `apps/desktop/src-tauri/src/skills_commands.rs`: Tauri commands for Skill CRUD through WorkspaceService.
- `apps/desktop/src-tauri/src/skills_dto.rs`: Skill request/response DTOs and service conversions.
- `apps/desktop/src-tauri/src/skills_commands/tests.rs`: command-helper tests for CRUD, unknown workspace, and cross-workspace access.
- `apps/desktop/src-tauri/src/skills_dto_tests.rs`: DTO shape tests.
- `apps/desktop/src-tauri/src/knowledge_documents_commands.rs`: Tauri commands for Knowledge Document CRUD/search through WorkspaceService.
- `apps/desktop/src-tauri/src/knowledge_documents_dto.rs`: Knowledge Document request/response/search DTOs and service conversions.
- `apps/desktop/src-tauri/src/knowledge_documents_commands/tests.rs`: command-helper tests for CRUD/search, unknown workspace, and global scope.
- `apps/desktop/src-tauri/src/knowledge_documents_dto_tests.rs`: DTO shape tests.
- `apps/desktop/src-tauri/src/knowledge_document_import_commands.rs`: explicit local file import read for `.txt`, `.md`, `.markdown`, valid UTF-8, file-only, max 1 MB.
- `apps/desktop/src-tauri/src/knowledge_document_import_dto.rs`: import request/response DTOs.
- `apps/desktop/src-tauri/src/knowledge_document_import_commands/tests.rs`: import tests for Markdown, Unix paths, unsupported extension, large file, and non-UTF-8 content.
- `apps/desktop/src-tauri/src/lib.rs`: registers the Skill, Knowledge Document, search, and import commands.

### Tests

- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx`: widget behavior tests for empty state, Skill attach safety, absence of attach without Workspace Agent, saved-only attach, Skill CRUD, Document CRUD, import, global documents, and tab continuity.
- `apps/desktop/frontend/src/workbench/widgetHostRenderProps.test.ts`: verifies Knowledge / Skills props and Workspace Agent Knowledge callbacks are wired only to the correct widgets.
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.codex-routing.test.tsx`: tests visible Knowledge retrieval, scope labeling, no-match behavior, and cross-workspace thread safety.
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.transcript-action-cards.test.tsx`: tests Skill visible attach and Knowledge Document/Skill creation from visible conversation text.
- `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkModel.test.ts`: tests Knowledge lookup summaries and Codex prompt formatting.
- `apps/desktop/frontend/src/workbench/workspaceAgentProposalCreationActions.test.ts`: tests approved proposal create actions for Knowledge Documents and Skills.
- `apps/desktop/frontend/src/workbench/WorkspaceAgentProposalList.test.tsx`, `workspaceAgentProposalDisplayState.test.ts`, and `workspaceAgentProposalState.test.ts`: proposal card state and labels for Knowledge Document and Skill drafts.
- `apps/desktop/frontend/src/workspace/memoryWorkspaceApi.test.ts`: tests dev memory Knowledge Document global/workspace scope and enabled search behavior.
- `apps/desktop/frontend/src/workspace/tauriWorkspaceApi.test.ts`: tests Tauri Knowledge Document create/update/search scope mapping.
- `apps/desktop/frontend/src/workbench/WidgetCatalogShell.test.tsx` and `WorkbenchShell.test.tsx`: verify catalog and layout presence for Knowledge / Skills.

## 3. Current functionality

What actually works today:

- UI: a product-facing `Knowledge / Skills` widget is present in the widget registry and catalog. It has Skills and Documents tabs. Skills support list/select/create/edit/save/delete, tags, review status, dirty-state blocking, and explicit selected-Skill attach. Documents support list/select/create/edit/save/delete, workspace/global scope, enabled flag, scope filter, and explicit import from one text/Markdown path in Tauri desktop.
- API/service: frontend calls route through Workspace API facades, Tauri adapters in desktop, and WorkspaceService methods in Rust. Browser/Vite dev mode has in-memory Skill and Knowledge Document APIs. Non-dev browser fallback reports unsupported persistence/search/import honestly.
- Storage: desktop stores Skills, Knowledge Documents, and Knowledge Document chunks in SQLite. Skills are workspace-scoped. Knowledge Documents can be workspace-local or local-global. Search uses deterministic chunks, lexical scoring, enabled-only filtering, scope filtering, capped result count, and capped snippets.
- Workspace Agent integration: selected saved Skills can be attached to Workspace Agent as visible editable composer context. Workspace Agent can create workspace-local Knowledge Documents and Skills only through approved visible proposal cards plus separate explicit create actions. Workspace Agent Codex Direct Work searches enabled workspace-local and local-global Knowledge Documents before explicit Run with Codex and shows lookup status/snippets in Direct Work details.
- Queue/context integration: no direct attach-to-Queue-task behavior exists. Queue tasks do not own selected Knowledge/Skill refs, and Knowledge / Skills does not create or mutate Queue tasks.
- Tests: focused frontend, app service, storage, Tauri command, DTO, memory fallback, and Workspace Agent integration tests exist. This audit did not run them because the block is inspect-only and validation was explicitly limited.

Current functionality classification:

- Real: widget UI, Workspace API facade, desktop Tauri commands, app service, SQLite storage, dev memory fallback, Knowledge Document search, text/Markdown import, Skill attach to Workspace Agent, Workspace Agent proposal creation, and Codex-run retrieval.
- Mock/dev-only: browser/Vite memory APIs for UI iteration.
- Placeholder/type-only: `crates/hobit-app/src/knowledge/` Knowledge/Evidence/Runbook refs and `crates/hobit-app/src/context_packs/` Context Pack refs.
- Stale/deferred: Knowledge Catalog, full Knowledge Items, Evidence store, Context Pack builder/runtime, semantic/vector search, folder scanning, team/server knowledge, RBAC, and prompt templates as product assets.

## 4. Contract alignment

### Stable v0.1 contract

Aligned enough for Stable v0.1 MVP inclusion:

- Knowledge / Skills is product-facing and catalog-visible as an optional Workbench widget.
- It preserves `skill-library` as compatibility id while presenting `Knowledge / Skills` as the user-facing name.
- It supports workspace-local Skill CRUD and workspace/local-global Knowledge Document CRUD/search/import.
- It does not act as hidden AI memory, auto-inject Skills, scan folders, parse binary documents, use embeddings/vector DB, share team/server knowledge, implement Evidence/Context Packs, or ingest without explicit operator action.
- Workspace Agent creation proposals are inert review cards until approval plus separate create action.

Gaps:

- Stable acceptance says "Search/list Knowledge Documents"; the search API exists and Workspace Agent uses it, but the widget itself has scope filter rather than a manual search box.
- Queue attach is not part of the existing Stable contract text, but it is a product-model gap for the requested context surface direction.

### Universal Widget Shell contract

Mostly aligned:

- Widget shell is a presentation surface over Workspace APIs, not the durable store.
- Durable Skills/Documents live in WorkspaceService/SQLite or dev memory APIs, not only React state.
- Widget-local React state is limited to UI selection, drafts, dirty state, loading/error/message state, and tab/filter state.
- WidgetFrame preserves standard widget shell/logs/move behavior.

Gap:

- Knowledge / Skills does not yet have a formal pane/snapshot/capability model. It is currently prop-wired through WidgetHost rather than a declared Knowledge Widget API provider.

### Product UI design contract

Mostly aligned:

- Primary UI uses product language: Skills, Documents, Workspace, Global, Reviewed, Needs review, Searchable by Workspace Agent.
- Default UI does not expose raw JSON, IDs, stack traces, Tauri command names, storage rows, or raw debug payloads.
- Unsupported runtime states are visible in product copy.
- Mutating actions are explicit. Delete actions confirm with the operator.
- Skill attach makes context visible, editable/removable before send, and does not auto-send.

Gaps:

- Some runtime copy still says `Skill Library API` because of retained compatibility language.
- The widget is still close to a two-tab record editor. It does not yet visualize Knowledge as typed reusable context for contracts, decisions, validation rules, dogfooding workflows, prompt templates, or Queue tasks.

### Workspace Widget API contract

Partially aligned:

- Current actions are app-native Workspace API calls, not shell commands, direct SQLite edits, DOM scraping, localStorage mutation, or provider tool calls.
- State is scoped to the active Workspace; global documents are local-user/global records in the desktop database and are explicitly labeled as Global.
- Search returns bounded safe snippets and scope labels.
- Workspace Agent uses visible context and `allowed_tools: []`; Knowledge Document retrieval is a bounded app-native API lookup, not provider tool execution.

Gap:

- There is no formal `knowledge.getSnapshot`, `knowledge.document.create`, `knowledge.skill.attach`, or `knowledge.search` Widget API contract with safe snapshots, capabilities, events, evidence/log references, or semantic test hooks. The implementation has the service/actions, but not the target Widget API abstraction.

### Workspace Agent coordinator model

Aligned with current Coordinator boundaries:

- Workspace Agent does not silently read Skills. Selected Skill attach is operator-triggered and visible.
- Knowledge Document retrieval is limited to enabled workspace-local and local-global documents, scoped by Workspace, capped, visible, and tied to explicit Run with Codex.
- Knowledge Document and Skill proposal creation uses visible conversation/provider text only and requires separate explicit create actions.
- No hidden Queue dispatch, Terminal launch, Git mutation, JDBC execution, file reads, Evidence, Context Pack, or provider tool mode is introduced.

Gap:

- There is no Queue task context ledger or selected Knowledge/Skill attachment model for Queue tasks, so Coordinator/Queue cannot yet preserve reusable context per task through app-native refs.

## 5. Product model recommendation

Knowledge / Skills should be the Workbench surface for explicit reusable context, not a generic document manager and not another chat.

Recommended model:

- Knowledge item types: `contract`, `decision`, `runbook_reference`, `prompt_template`, `response_template`, `validation_rule`, `dogfooding_workflow`, `technical_note`, `incident_note`, `external_reference`, and `skill_reference`. Current MVP can keep these as tags or optional type metadata until a formal Knowledge Item store exists.
- Skill shape: keep the current fields as the Stable MVP shape: title, when to use, prerequisites, steps, validation, risks, tags, review status. Future fields can add owner, version, rollback/cleanup, inputs, commands/templates, source refs, and related evidence/artifact refs.
- Collections/views: current Skills and Documents tabs are acceptable for MVP. Next views should be filtered saved context views: Contracts, Decisions, Validation, Workflows, Templates, Runbooks, and Deprecated/Needs Review.
- Relations: future records should link by refs, not copy raw payloads: related Skills, Knowledge Documents, Queue tasks, Notes promotions, Runbook refs, Evidence refs, Artifact refs, and Context Pack refs.
- Attach to Workspace Agent: preserve visible selected context review. Add selected Knowledge Document attach as a separate explicit action, with title/source/scope/snippet or selected text only, not full hidden document bodies by default.
- Attach to Queue task: add an explicit Queue task context attachment flow using safe refs and bounded selected excerpts. Queue should store safe references and short summaries, not raw document bodies or hidden search results.

## 6. MVP scope

Smallest useful MVP for Stable v0.1 inclusion:

- List/search/filter knowledge records: current implementation lists and filters Knowledge Documents by scope, and search exists through Workspace API/Workspace Agent retrieval. A manual widget search box is the main missing UI slice.
- Preview/edit knowledge record: current implementation selects and edits full plain-text/Markdown Knowledge Documents. It does not yet provide a read-only preview mode separate from edit.
- Create/edit skill: implemented.
- Attach selected knowledge/skill to Workspace Agent: selected Skill attach is implemented. Selected Knowledge Document attach is not implemented; current Knowledge Documents are searched automatically only for explicit Codex runs.
- Attach selected knowledge/skill to Queue task: not implemented.

Stable v0.1 accepted MVP should therefore be:

- Keep current Skills and Documents UI.
- Keep current desktop SQLite persistence, dev memory fallback, and unsupported-runtime honesty.
- Keep current selected Skill attach to Workspace Agent.
- Keep current enabled-only Workspace Agent Codex retrieval.
- Add no Evidence, Context Pack, Knowledge Catalog, vector search, or hidden memory.

Recommended Stable v0.1 follow-up before final acceptance, if time permits:

- Add manual document search/filter UI to the Documents tab using the existing search API.
- Add selected Knowledge Document attach to Workspace Agent with visible bounded excerpt review.
- Add Queue task attachment contract before implementation; do not add direct Queue mutation from the widget without an app-native Queue context model.

## 7. What not to build yet

Explicit non-goals:

- Semantic vector search.
- Background indexing.
- Enterprise knowledge base.
- Auto-ingest whole repo.
- Knowledge graph canvas.
- Multi-user permissions.
- Evidence store.
- Context Pack builder/runtime.
- Knowledge Catalog.
- Hidden AI memory.
- Automatic Skill prompt injection.
- Folder scans, watchers, recursive ingestion, PDF/DOCX parsing, or binary parsing.
- Notes-to-Knowledge promotion without an explicit review flow.
- Queue mutation from Knowledge / Skills without a Queue-owned context attachment API.
- Provider tools or frontend-direct provider calls.
- Server runtime, RBAC, team sharing, or enterprise permissions.

## 8. Recommended next blocks

1. `KNOWLEDGE-API-CONTRACT-01`
   Objective: define the Knowledge / Skills Workspace Widget API shape for safe snapshots, actions, capabilities, events, selected context, and semantic tests.
   Acceptance: docs-only contract states current Skill and Knowledge Document actions, safe state snapshot fields, unsupported states, context attach rules, non-goals, and no schema/runtime changes.

2. `KNOWLEDGE-UI-SEARCH-01`
   Objective: add manual search/filter for Knowledge Documents inside the Documents tab using the existing search API.
   Acceptance: operator can search saved documents, results show title/source/scope/snippet, disabled documents are excluded from search results, no hidden filesystem reads occur, and existing CRUD still works.

3. `KNOWLEDGE-AGENT-ATTACH-DOC-01`
   Objective: allow selected Knowledge Document or selected document excerpt to attach to Workspace Agent as visible editable context.
   Acceptance: attach is operator-triggered, bounded, removable/editable before Send, source/scope labels are visible, and no disabled/hidden documents are sent automatically.

4. `KNOWLEDGE-QUEUE-CONTEXT-CONTRACT-01`
   Objective: define Queue task context attachment semantics for Knowledge/Skill refs and bounded excerpts.
   Acceptance: docs-only contract states Queue-owned storage shape or non-storage approach, safe refs, review UI, no raw body copying by default, and no automatic execution or dispatch.

5. `KNOWLEDGE-QUEUE-ATTACH-01`
   Objective: implement explicit attach selected Skill/Knowledge summary to a selected Queue task after the Queue context contract is accepted.
   Acceptance: selected Queue task shows attached context summary/ref, attachment requires operator action, raw document bodies are not copied by default, and Queue execution behavior is unchanged.

6. `KNOWLEDGE-TYPE-FILTERS-01`
   Objective: introduce lightweight item-type tagging for contracts, decisions, validation rules, prompt templates, dogfooding workflows, and runbook references without a full Knowledge Item store.
   Acceptance: current documents can be filtered by type-like metadata, existing tags remain supported, and no schema migration occurs unless separately approved.

7. `KNOWLEDGE-PROPOSAL-HARDENING-01`
   Objective: harden Workspace Agent proposal card language for Knowledge Document and Skill creation.
   Acceptance: proposal cards clearly state visible-source-only creation, workspace-local default, no global writes from proposals, and separate create action semantics.

8. `KNOWLEDGE-ACCEPTANCE-SMOKE-01`
   Objective: run the Stable v0.1 Knowledge / Skills acceptance checklist and record exact pass/partial/fail evidence.
   Acceptance: manual results cover Skill CRUD/attach, Document CRUD/import/search, disabled behavior, visible Codex retrieval, and no hidden Knowledge/Evidence/Context Pack behavior.
