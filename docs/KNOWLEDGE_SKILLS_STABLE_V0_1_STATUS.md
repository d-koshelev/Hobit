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

Current boundary: Knowledge Documents have partial catalog-shaped fields, but
the full Knowledge Catalog is not accepted as implemented. Queue context
attach/materialization is implemented as frontend-local/current-session
behavior unless already represented indirectly in an explicit materialized
prompt/run handoff; durable Queue-owned context storage/API state and a
separate Evidence/Context Pack store remain future.

## Refresh Notes

Implemented behavior after cleanup:

- Knowledge / Skills is Ready / MVP for Stable v0.1 as the `skill-library`
  compatibility widget identity with explicit Skill CRUD, workspace-local and
  local-global Knowledge Document CRUD/search/import, enabled-only Knowledge
  retrieval for Workspace Agent Codex runs, visible selected Skill attach,
  Notes promotion, Queue generation task drafts, draft-pack review, and
  frontend-local Queue context attach/materialization.
- Knowledge Documents now carry partial catalog-shaped fields: title, quick
  summary, item type, lifecycle/status, source label, source kind/ref, content,
  tags, enabled flag, scope, and deterministic chunks. This is not the full
  Knowledge Catalog because there is no standalone Catalog store, no
  first-class related files/tasks/commits, no durable created-by-task field,
  no graph relation model, and no Evidence or Context Pack store.
- Queue Knowledge / Skills context is frontend-local and current-session for
  Stable v0.1. It can be represented indirectly in an explicit materialized
  prompt or run handoff after the operator starts a task, but that artifact is
  not durable Queue-owned context state and not full execution evidence.

Current limitations and policies:

- `quickSummary` is the required preview vocabulary for review, scan,
  attachment, and materialized context surfaces. Services cap summaries to
  one to three lines where they are supplied, and draft acceptance plus Notes
  promotion populate them. Manual and import paths may still leave summaries
  empty, so Stable v0.1 must treat missing summaries as a quality gap rather
  than claiming every active document has a useful non-empty summary.
- Source refs are explicit and visible but partial in the current model.
  Generation tasks preserve source selection primarily through visible
  prompt/task text, safe refs, and existing Knowledge source label/kind/ref
  fields. Stable v0.1 must not claim durable structured `sourceRefs`, source
  snapshots, full provenance replay, or first-class `createdByTaskId`
  Catalog fields.
- Draft review persistence follows
  `docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md`: accepted drafts can
  become durable Knowledge Documents through explicit operator acceptance with
  best-effort current provenance fields; rejected drafts are review-local
  unless the operator records them through an existing explicit Queue
  surface. Rejection does not create rejected Knowledge, Evidence, audit, or
  hidden memory records.
- Queue context wording should describe "attached for this session",
  "prepared context", "materialized for this run", or "included in this run
  prompt". It must not describe current behavior as saved Queue task context,
  Queue memory, replayable context, durable evidence, or automatic Knowledge
  context.

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
| Notes promotion | Pass | A saved selected Note can be explicitly promoted into a separate Knowledge Document with source metadata. The Note remains unchanged and no Notes content is read or promoted automatically. |
| Attach to Queue task | Pass for current boundary | Selected saved Knowledge Documents and Skills can attach to the selected Queue task as frontend-local safe refs/summaries. Disabled or blocked Knowledge is rejected with visible feedback. Durable Queue-owned context storage/API state remains future. |
| Prompt materialization | Pass for current boundary | Queue execution can materialize visible attached Queue context before the task prompt with evidence-style refs, warnings, token estimate, and capped Knowledge excerpts. Workspace Agent Codex Knowledge snippets remain capped and scope-labeled. Separate durable Evidence/Context Pack records remain future. |
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

This manual smoke has not been rerun in this docs-only refresh block.

## File-Size / Maintainability Risks

Knowledge-related implementation remains under file-size pressure. The
current post-run audit records a new oversized Knowledge document panel,
new oversized warnings in Knowledge test/model files, and ratchet violations
in related Finder, Queue, Terminal, proposal-generation, frontend API, and
desktop runner files. Future Knowledge / Queue / Finder changes should start
with focused extraction or file-size remediation blocks before adding more
surface area.

## Intentionally Not Accepted

The following remain outside Stable v0.1 Knowledge / Skills acceptance:

- hidden AI memory or automatic prompt augmentation;
- automatic Skill search/injection;
- hidden or unapproved Queue task creation, execution, or acceptance;
- automatic Knowledge activation from generated drafts;
- selected-document full-body attach to Workspace Agent by default;
- folder scans, filesystem watchers, recursive ingestion, PDF/DOCX parsing, or
  binary parsing;
- embeddings, vector database, full Knowledge Catalog implementation, Evidence
  store, Context Pack runtime, durable Queue-owned context storage/API state,
  team/server sharing, RBAC, or provider tools.
