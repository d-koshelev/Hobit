# Knowledge Post-Cleanup Audit

Audit date: 2026-06-04

Mode: docs-producing inspect-only audit.

## 1. Executive Summary

Knowledge / Skills is Stable v0.1 ready for its current product scope, with
two important qualifications:

- Final Stable v0.1 acceptance still requires manual smoke. This docs-only
  audit cannot close the Stable gate.
- Repository file-size validation still fails due to ratchet/new-oversized
  issues. The prior `SkillLibraryDocumentsPanel.tsx` oversized blocker appears
  remediated, but file-size cleanup remains a repo acceptance blocker unless a
  later contract explicitly accepts it out of scope.

No further Knowledge feature implementation is required before Stable v0.1 if
Stable language stays within the current boundary:

- partial catalog-shaped Knowledge Documents, not a full Knowledge Catalog;
- quick summaries as preview/review vocabulary, with missing-summary warnings
  rather than a non-empty hard requirement;
- Queue Knowledge / Skill context as frontend-local/current-session state;
- accepted generated drafts persisted only through explicit Knowledge
  Document or Skill creation;
- rejected generated drafts remaining review-local;
- explicit but partial source refs rather than durable structured `sourceRefs`
  or `createdByTaskId` Catalog provenance.

## 2. Docs / Code Alignment

Current active docs now align with the implemented post-cleanup boundary.

- `docs/CURRENT_WIDGET_SURFACE.md` describes Knowledge / Skills as Ready / MVP
  with Skills, scoped Knowledge Documents, partial catalog fields, Notes
  promotion, Queue generation task drafts, draft review, and frontend-local
  Queue context attach/materialization.
- `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` matches the implemented MVP:
  explicit Skill CRUD, Knowledge Document CRUD/search/import, enabled-only
  Workspace Agent retrieval, selected Skill attach, explicit Notes promotion,
  no hidden memory, and no Evidence/Context Pack/team/server/runtime behavior.
- `docs/KNOWLEDGE_CATALOG_CONTRACT.md` correctly treats the full Knowledge
  Catalog as future while recording the current partial catalog-shaped
  Knowledge Document fields.
- `docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` records the current partial
  Queue-generation workflow and keeps durable source refs/generation runtime
  future.
- `docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md` and
  `docs/QUEUE_KNOWLEDGE_CONTEXT_DURABILITY_DECISION.md` resolve the two main
  overclaim risks for Stable v0.1.
- `docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md` is consistent with the
  current implementation and remains the closest Knowledge-specific acceptance
  status record.

Targeted code inspection supports that alignment:

- `crates/hobit-app/src/workspace_service/knowledge_documents.rs` normalizes
  partial catalog fields and caps supplied quick summaries to three non-empty
  lines.
- `apps/desktop/frontend/src/workbench/agentQueueKnowledgeContext.ts` creates
  visible Queue refs, bounded snapshots, warnings, token estimates, and
  materialized run prompts.
- `apps/desktop/frontend/src/workbench/knowledgeDraftPacks.ts` parses draft
  packs from visible report text and preserves best-effort queue/source refs.
- `apps/desktop/frontend/src/workbench/useSkillLibraryDraftReview.ts` persists
  accepted drafts through explicit Skill or Knowledge Document creation and
  keeps rejection as local review state.
- `apps/desktop/frontend/src/workbench/workspaceAgentDirectWorkKnowledge.ts`
  prepends capped, scope-labeled snippets only for explicit Workspace Agent
  Codex runs.

Residual wording risk: Stable v0.1 docs must continue to avoid saying "full
Knowledge Catalog", "durable Queue context", "replayable draft review", or
"durable sourceRefs" for current behavior.

## 3. File-Size State

Current full Toolbelt file-size check fails:

- scanned 756 source files;
- 31 unchanged/improved legacy oversized files;
- 6 ratchet violations;
- 2 new oversized files/warnings.

Current failing ratchets:

- `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueAutonomousRunner.ts`
- `apps/desktop/frontend/src/workbench/queue/useAgentQueueController.ts`
- `apps/desktop/frontend/src/workbench/workspaceAgentQueueCommandHandler.test.ts`
- `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`
- `apps/desktop/src-tauri/src/agent_queue_runner_commands.rs`

Knowledge-related warnings remain:

- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx`
- `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`

The prior new oversized `SkillLibraryDocumentsPanel.tsx` blocker is no longer
reported. File-size state is therefore improved but not acceptable for a final
repo-wide Stable gate.

## 4. Quick Summary Policy

Current policy is acceptable for Stable v0.1 with explicit limitation wording.

- `quickSummary` exists in the Knowledge Document DTO/storage/service model.
- Supplied summaries are normalized and capped to one to three non-empty lines.
- Draft acceptance and Notes promotion populate summaries where possible.
- Manual create/import/update paths may still leave summaries empty.
- Empty summaries are visible quality warnings, not proof of full Catalog
  implementation failure.
- Queue context uses `Summary missing.` and warning records when attached
  Knowledge lacks a quick summary.

More implementation is not required before Stable v0.1 unless the product wants
to require every active Knowledge Document to have a non-empty summary. That
would be a new UX/service policy slice.

## 5. Queue Context Visibility And Durability

Current Queue context behavior is ready for Stable v0.1 only as
frontend-local/current-session context.

Pass:

- Selected Knowledge Documents and Skills attach only through explicit operator
  action.
- Attach creates safe refs, bounded snapshots, warnings, token estimates, and a
  visible right-rail context section.
- Disabled/rejected Knowledge is blocked; stale/draft/archived Knowledge is
  warning-bearing; deprecated Skills are blocked.
- Queue execution paths materialize attached context before the task prompt and
  include a visible handoff section stating that context is current-session UI
  state and not saved as Queue task context.
- Tests explicitly cover dropping attached context after remount.

Limit:

- Queue does not own durable context refs, snapshots, warning
  acknowledgements, token budget state, or execution evidence records.
- Materialized run prompts may preserve what was included for a run, but that
  is not structured durable Queue context or Evidence.

No more implementation is required for Stable v0.1 if docs and UI keep this
session-local wording.

## 6. Hidden Memory / Hidden Context Risks

No hidden memory or hidden context path was found in the targeted audit.

Current safe boundaries:

- No background indexing, vector search, folder watching, PDF/DOCX/binary
  parsing, team/server knowledge, Evidence store, or Context Pack runtime.
- Import is explicit single-file plain text/Markdown.
- Notes promotion is explicit from a saved selected Note and leaves the Note
  unchanged.
- Workspace Agent proposal creation uses visible text/proposal drafts and
  still requires approval plus a separate create action.
- Workspace Agent Codex retrieval searches only enabled workspace-local and
  enabled local-global Knowledge Documents, caps results, shows scope labels,
  and applies only to the explicit run.
- Skills are not auto-searched or silently injected.
- Queue attach does not create, start, or auto-dispatch tasks.

Main residual risk is wording/product expectation, not an observed hidden
runtime path: durable Queue context and full Catalog provenance are not
implemented and must not be implied.

## 7. Draft Review State

Draft review is Stable v0.1 ready within the decided review-local boundary.

Pass:

- Draft packs can be parsed from visible Queue/worker report text.
- Proposed items require explicit operator Accept or Reject / archive.
- Accepted document drafts create durable Knowledge Documents with active
  status, enabled state, best-effort source label/ref, quick summary, content,
  type, scope, and tags.
- Accepted skill drafts create Skills with reviewed status.
- Rejected drafts are marked only in local review state and do not become
  Knowledge, Evidence, audit records, or hidden memory.

Limit:

- There is no durable draft-pack identity ledger, rejection history, review
  replay, reviewer identity, source version snapshot, audit event, Evidence
  link, or first-class `createdByTaskId`.

This matches the current persistence decision and does not need more
implementation before Stable v0.1.

## 8. Source Refs State

Source refs are explicit enough for Stable v0.1 partial provenance, but not
complete Catalog provenance.

Current state:

- Knowledge Documents persist `sourceLabel`, `sourceKind`, and `sourceRef`.
- Notes promotion records note-derived source metadata.
- Draft acceptance uses `queue_draft` plus best-effort draft/source refs.
- Workspace Agent and Finder Knowledge-generation task prompts include
  selected source refs and explicit "use only selected refs" instructions.
- Prompt templates explicitly state that the current Queue task API has no
  durable `sourceRefs` field and embeds structured refs in prompt text only.

Limit:

- No durable structured Queue `sourceRefs` field.
- No durable source snapshots or provenance replay.
- No first-class related files/tasks/commits fields.
- No `createdByTaskId` Catalog field.

This is acceptable for Stable v0.1 only if described as partial provenance.

## 9. Remaining Manual Smoke

Manual Knowledge smoke remains required before final Stable v0.1 acceptance:

- create, edit, save, and delete a Skill;
- verify Skill fields and review status;
- attach a saved Skill to Workspace Agent and verify visible editable/removable
  context before Send;
- create workspace-local and local-global Knowledge Documents;
- import one explicit `.txt`, `.md`, or `.markdown` file;
- search/list Knowledge Documents;
- verify enabled-only Workspace/Global snippets are visible and capped in a
  Workspace Agent Codex run;
- verify disabled documents and Skills are not silently injected;
- create a Knowledge-generation Queue task and verify it remains draft/manual
  until explicitly started;
- review a draft Knowledge pack and accept/reject through explicit actions;
- attach Knowledge and Skill context to a Queue task and verify blocked/warning
  behavior;
- start an assigned Queue task with attached context and verify visible
  materialized context before the task prompt;
- verify no hidden Notes, files, logs, Queue/Executor output, Git/JDBC/Terminal
  state, Evidence, Context Packs, team/server knowledge, secrets, or raw
  payloads are sent automatically.

## 10. Stable v0.1 Readiness Decision

Decision: Knowledge / Skills is ready for Stable v0.1 as the current MVP plus
the implemented session-local Queue context extension.

More Knowledge feature implementation is not required before Stable v0.1.

Still required before final Stable acceptance:

- run and record manual Knowledge smoke;
- address or explicitly accept the remaining file-size validation blockers;
- keep Stable wording within current boundaries.

Future optional implementation slices, not Stable v0.1 blockers:

- require or auto-suggest non-empty quick summaries for all active documents;
- durable Queue-owned Knowledge context storage/API;
- durable draft-review ledger and rejected-draft history;
- structured durable Queue `sourceRefs`;
- first-class Catalog relationships and `createdByTaskId`;
- full Knowledge Catalog, Evidence store, or Context Pack runtime.

## 11. Intentionally Not Assessed

This audit did not inspect unrelated widgets/modules, run broad test suites,
perform manual UI smoke, modify source code, change tests, update contracts
outside this report, create commits, or implement any new behavior.
