# Knowledge Production Smoke Checklist

Status record date: 2026-06-07

## Purpose

Record the manual and automated smoke checklist for production Knowledge
readiness.

This is a docs-only checklist. It does not add frontend behavior, backend APIs,
storage, schema, Queue execution behavior, Workspace Agent provider behavior,
test automation, vector search, embeddings, server/team memory, RBAC, graph
behavior, background ingestion, or hidden context injection.

Manual desktop smoke was not run in this block.

## Scope

Use this checklist to verify the current Stable v0.1 Knowledge / Skills MVP and
to expose the remaining production gaps recorded in
`docs/KNOWLEDGE_PRODUCTION_STATUS.md`.

Expected result labels:

- Pass: implemented behavior works as expected.
- Partial: current Stable v0.1 behavior works, but production durability or
  provenance is not implemented.
- Fail: implemented behavior does not match the current contract.
- Not run: smoke was not attempted in the checked build.
- Future: production behavior is intentionally not implemented yet.

## Automated Checks

Run targeted automated checks when validating a candidate:

- Knowledge / Skills widget tests for Skill CRUD, Knowledge Document CRUD,
  import/search, draft review, and attachments.
- Queue Knowledge context tests for safe refs, warnings, token estimates, and
  prompt materialization.
- Workspace Agent Knowledge prompt tests for enabled-only, capped,
  scope-labeled snippets.
- Storage/service/Tauri tests for Knowledge Document and Skill APIs.

Record exact commands and results in the release or block report. This
checklist does not claim those tests were run.

## Manual Smoke Steps

### Create, Import, Search, And Edit Knowledge

1. Open a desktop Workspace and add or open Knowledge / Skills.
2. Create a workspace-local Knowledge Document with title, quick summary,
   content, tags, source label/kind/ref, structured source refs, structured
   relations, active lifecycle, enabled state, and searchable state.
3. Create a local-global Knowledge Document and confirm scope labeling.
4. Import one explicit `.txt`, `.md`, or `.markdown` file.
5. Search for text that appears in an enabled active document.
6. Confirm results are bounded and scope-labeled.
7. Disable a matching document and confirm normal search/retrieval excludes it.
8. Edit and save a document, then confirm the updated content appears after
   reload.
9. Confirm version metadata increments after edit and the current record still
   shows coherent source refs/relations and review/task/run metadata where
   supplied.

Expected current result: Pass for durable MVP/production-pack fields and
searchable filtering. Partial for production if immutable version row ids are
not visible in every search/materialized-context surface or if the production
secret warning policy remains warning-only.

### Create, Edit, Import, And Attach Skill

1. Create a Skill with title, when-to-use, prerequisites, steps, validation,
   risks, tags, and review status.
2. Edit and save the Skill.
3. Delete a throwaway Skill and confirm it is removed.
4. Attach a saved Skill to Workspace Agent.
5. Confirm the attachment is visible, editable/removable before Send, and does
   not send automatically.

Expected current result: Pass for MVP behavior; Partial for production because
Skills do not yet share the production lifecycle/version/source-ref model.

### Generate From Docs, Code, And History

1. From Workspace Agent or Finder-style selected refs, create a visible
   Knowledge-generation Queue task for selected documentation.
2. Repeat for selected codebase refs.
3. Repeat for selected visible conversation, Queue, run, activity, or command
   history summaries.
4. Confirm each task shows explicit source refs or safe source text in the
   visible task/prompt.
5. Confirm creating the task does not execute analysis, scan the repository,
   activate Knowledge, or grant tools.

Expected current result: Partial. Current behavior supports visible/manual task
drafts, selected refs, and structured Knowledge Document source refs after
acceptance where supplied. A dedicated generation runtime and guaranteed
durable typed source metadata for every generation task/source path remain
future.

### Review Accept Or Reject

1. Produce or load a Queue worker report that contains a draft Knowledge pack.
2. Open draft review in Knowledge / Skills.
3. Accept one draft as a Knowledge Document.
4. Reject one draft.
5. Confirm accepted content becomes durable Knowledge only through explicit
   accept.
6. Confirm rejected content is not searchable, attachable, materialized, or
   treated as Knowledge after rejection.
7. Refresh or reopen the app and confirm accepted/rejected draft review
   decisions remain listed with Queue/run/source fingerprint metadata where
   supplied.

Expected current result: Partial. Accepted drafts can become durable Knowledge
Documents and accepted/rejected decisions are durable ledger records. Full
production review vocabulary such as split, merged, and blocked, plus accepted
version-row links, remains future.

### Version And Provenance Display

1. Inspect Knowledge Document detail and search result surfaces.
2. Confirm visible title, scope, source label/kind/ref, lifecycle/status,
   enabled state, quick summary, tags, and updated timestamp where shown.
3. Confirm Queue materialization shows source labels, scopes, warnings, token
   estimates, bounded context, materialized-at metadata, and a `Context used`
   section.

Expected current result: Partial. Current provenance includes durable
structured Knowledge Document refs/relations and task/run/review metadata where
supplied. Replayable provenance, immutable Evidence records, and visible
version-row ids in every consuming surface remain future.

### Attach To Workspace Agent

1. Attach a saved Skill to Workspace Agent and verify visible composer context.
2. Run Workspace Agent Codex with an enabled matching Knowledge Document.
3. Confirm Knowledge snippets are visible in Direct Work details, capped,
   scope-labeled, and included only for that explicit run.
4. Confirm disabled documents, Skills, Notes, files, logs, Git/JDBC/Terminal
   state, and hidden Workspace context are not searched or sent by this path.

Expected current result: Pass for current boundary; Partial for production
because context-used evidence remains prompt/report text unless a future
durable Evidence/run metadata table is added.

### Attach To Queue And Persist Across Refresh

1. Attach a saved Knowledge Document and saved Skill to the selected Queue task.
2. Confirm attached context is visible as Queue-owned prepared context with
   refs, bounded snapshots, warnings, token budget, and materialized timestamp
   after materialization.
3. Refresh or reopen the app.
4. Confirm the Queue task still has its attached Knowledge and Skill context,
   bounded snapshots, warnings, token budget, and materialized timestamp.
5. Detach the Knowledge Document and Skill through the typed UI/API path,
   refresh again, and confirm the detached context stays removed.

Expected current result: Pass for durable Queue-owned context attach/detach
persistence through typed app/Tauri paths. Partial for production because this
is not a Context Pack or separate Evidence store.

### Materialize Context Into Queue Run

1. Attach Knowledge and Skill context to a runnable assigned Queue task.
2. Review warnings, token estimates, and bounded prompt context before run.
3. Start the explicit Queue run.
4. Confirm materialized context appears before the task prompt or visible run
   handoff.
5. Confirm raw full document bodies are not copied by default.
6. Confirm the prompt includes a `Context used` section listing Queue task id,
   refs/snapshots, warning ids, token estimate, scopes, sources, and
   materialized-at metadata where available.

Expected current result: Partial. Backend materialization exists and should be
the source of truth after prompt hardening, but context-used evidence remains
prompt/report text rather than a separate immutable Evidence table or run
metadata table.

### Disabled, Rejected, And Stale Behavior

1. Try to attach disabled Knowledge.
2. Try to attach rejected Knowledge.
3. Try to use stale, draft, archived, needs-review, or missing-summary content.
4. Confirm blocked states block normal use and warning states are visible before
   run/materialization.
5. Confirm rejected content cannot be reached indirectly through Queue
   snapshots, Workspace Agent attachments, draft packs, prompts, or evidence
   placeholders.

Expected current result: Pass for implemented Queue attach/materialization
guards; Partial for production because durable warning acknowledgement and
cross-surface policy records are future.

### Caps And Secret Warnings

1. Verify search snippets and materialized snapshots are bounded.
2. Verify over-cap or truncation states are visible where available.
3. Try content containing obvious credentials, tokens, passwords, private keys,
   certificates, environment dumps, or secret-bearing JDBC URLs.
4. Confirm the candidate either warns, blocks, or records the current production
   gap honestly.

Expected current result: Partial. Caps exist for search and materialization
paths. A production secret warning/redaction policy before acceptance, attach,
and materialization remains future.

### No Hidden Context

1. Create Knowledge and Skills but do not attach or explicitly run retrieval.
2. Send a normal Workspace Agent message and confirm no automatic Skill prompt
   injection occurs.
3. Confirm Queue task creation does not automatically attach Knowledge.
4. Confirm no Notes bodies, unselected files, raw Terminal transcripts, raw
   Executor logs/results, Git diffs, JDBC rows, provider memory, or hidden
   widget state are ingested automatically.
5. Confirm no background repository scan, folder watch, vector index, or
   embedding index starts.

Expected current result: Pass. Any hidden context injection is a contract
violation.

## Production Acceptance Gate

Knowledge can be called production-ready only after these Future/Partial areas
are implemented and validated:

- backend-owned Queue context materialization is the sole execution path after
  prompt 001 / Queue run hardening;
- complete draft-review vocabulary and accepted version-row links;
- materialized context execution evidence beyond prompt/report text;
- consistent structured source-ref and provenance display across every
  generation/source path;
- consistent stale/draft/archive/rejected policy;
- secret warning/redaction policy;
- automated and manual smoke evidence for no hidden context.

## Intentionally Not Covered

- No code changes.
- No backend, Tauri, storage, schema, or runtime behavior changes.
- No e2e setup.
- No vector search, embeddings, graph canvas, server/team memory, RBAC,
  background scanning, auto-ingest, or hidden provider memory.
