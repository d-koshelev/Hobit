# Knowledge / Skills Stable v0.1 Status

Status record date: 2026-06-04

## Purpose

This is a docs-only Stable v0.1 acceptance status record for Knowledge /
Skills after focused implementation and automated test coverage.

It does not add product behavior, storage, schema, provider tools, Queue
execution behavior, Workspace Agent hidden context access, or new widget
surface area. Current behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`.

## Summary

Automated Knowledge / Skills status: pass for the implemented Stable v0.1
MVP and the focused Queue-context extensions listed below.

Stable v0.1 final acceptance status: manual smoke still required before the
overall Stable gate can be closed.

## Acceptance Status

| Area | Automated status | Acceptance note |
| --- | --- | --- |
| Skill CRUD | Pass | Covered for create, list/read, edit/save, delete, review status, tags, and saved-only attach behavior. |
| Skill attach | Pass | Selected saved Skills attach to Workspace Agent as visible editable context, and selected saved Skills can attach to the selected Queue task as safe refs/summaries. |
| Document CRUD/import/search | Pass | Covered for workspace/global Knowledge Document create, list/read, update, delete, explicit text/Markdown import, enabled-only search/retrieval, scope labels, and snippet caps. |
| Quick summary support | Pass | Knowledge Documents and catalog/draft items carry `quickSummary`; Queue context refs and snapshots preserve bounded summaries for review and scan surfaces. |
| Knowledge generation via Queue task | Pass for current boundary | Workspace Agent/Finder-style generation prompts create visible manual Queue task drafts for docs/codebase/history-to-Knowledge workflows. Creating the task does not execute analysis or activate Knowledge. |
| Draft review | Pass | Queue worker report output can expose draft Knowledge packs; Knowledge / Skills can review imported draft items before accept/reject. Accepted records still require explicit operator action. |
| Attach to Workspace Agent | Pass for current Stable scope | Selected Skills attach to Workspace Agent as visible editable context. Knowledge Documents are not silently attached; enabled document snippets may be visibly materialized for explicit Workspace Agent Codex runs. |
| Attach to Queue task | Pass | Selected saved Knowledge Documents and Skills can attach to the selected Queue task as task-owned safe refs/summaries. Disabled or blocked Knowledge is rejected with visible feedback. |
| Prompt materialization | Pass | Queue execution can materialize visible attached Queue context before the task prompt with evidence refs, warnings, token estimate, and capped Knowledge excerpts. Workspace Agent Codex Knowledge snippets remain capped and scope-labeled. |
| Safety/non-goals | Pass | No hidden memory, folder scan, binary parsing, embeddings/vector DB, Evidence store, Context Pack runtime, team/server sharing, auto-activation, auto-execution, provider tools, or automatic Skill injection is accepted. |

## Automated Evidence

Focused automated coverage exists in:

- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx`
- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.knowledge-attachments.test.tsx`
- `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.test.ts`
- `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.test.ts`
- `apps/desktop/frontend/src/workbench/coordinatorLocalProposalGeneration.test.ts`
- `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.taskActions.test.tsx`
- `apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.result-evidence.test.tsx`

This status block did not rerun the automated suite; it records the acceptance
state from the implemented focused coverage and performs docs-only validation.

## Remaining Manual Smoke Required

Manual smoke remains required for final Stable v0.1 acceptance:

- Create, edit, save, and delete a Skill in the desktop UI.
- Attach a saved Skill to Workspace Agent and verify the visible context can be
  edited or removed before Send.
- Create workspace-local and local-global Knowledge Documents.
- Import one explicit `.txt`, `.md`, or `.markdown` file.
- Search/list Knowledge Documents and verify disabled documents are not used.
- Run Workspace Agent Codex with enabled matching Knowledge Documents and
  verify capped visible snippets with Workspace/Global labels.
- Create a Knowledge-generation Queue task and verify it remains draft/manual
  until explicitly started.
- Review a draft Knowledge pack and accept/reject items through explicit
  operator actions.
- Attach selected Knowledge and selected Skill context to a Queue task, then
  verify disabled/rejected context is blocked and enabled context is visible.
- Start an assigned Queue task with attached context and verify materialized
  context appears before the task prompt with evidence refs.
- Verify no hidden Notes, files, logs, Queue/Executor output, Git/JDBC/Terminal
  state, Evidence, Context Packs, team/server knowledge, secrets, or raw
  payloads are sent automatically.

## Intentionally Not Accepted

The following remain outside Stable v0.1 Knowledge / Skills acceptance:

- hidden AI memory or automatic prompt augmentation;
- automatic Skill search/injection;
- automatic Queue task creation, execution, or acceptance;
- automatic Knowledge activation from generated drafts;
- selected-document full-body attach to Workspace Agent by default;
- folder scans, filesystem watchers, recursive ingestion, PDF/DOCX parsing, or
  binary parsing;
- embeddings, vector database, Knowledge Catalog implementation, Evidence
  store, Context Pack runtime, team/server sharing, RBAC, or provider tools.
