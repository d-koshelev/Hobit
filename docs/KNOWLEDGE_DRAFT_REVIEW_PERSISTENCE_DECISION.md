# Knowledge Draft Review Persistence Decision

## Purpose

This decision resolves whether Knowledge generation draft review decisions are
local review-only choices or durable records.

This is a docs-only architecture decision. It does not add storage, schema,
frontend UI, backend/Tauri commands, provider behavior, Queue execution,
Workspace Agent behavior, Agent Executor prompt behavior, Evidence storage,
audit persistence, or automatic Knowledge activation.

## Current Problem

Queue-based Knowledge generation can surface draft Knowledge packs for
operator review. The operator can accept or reject draft items in the current
review surface, but the product model needs a clear boundary for what becomes
durable in Stable v0.1.

The unclear cases are:

- whether accepting a draft stores a durable review decision or only creates a
  durable Knowledge Document;
- whether rejecting a draft must create a durable rejected item record;
- how accepted/rejected drafts relate to the source Queue task;
- whether draft review decisions are audit records or Evidence;
- what Stable v0.1 may claim without adding storage/API/runtime behavior.

## Options Evaluated

### Option A: Review-Local Decisions For Stable v0.1

Keep draft review decisions local to the current review surface, except for
the durable Knowledge record created by explicit acceptance and existing Queue
task/run metadata.

Benefits:

- Preserves the current implementation boundary.
- Avoids unplanned schema/API work.
- Avoids creating a partial rejected-item store without lifecycle, retention,
  source versioning, or review-owner policy.
- Keeps rejected drafts from becoming hidden Knowledge or Evidence.
- Allows accepted Knowledge to remain durable through the existing Knowledge /
  Skills document path.

Costs:

- Rejected draft decisions may be lost after reload unless the operator
  records them in existing Queue task fields or another explicit current
  surface.
- Stable v0.1 cannot claim durable rejection history or full draft-review
  audit.
- Source Queue task linkage for accepted drafts is partial when represented
  only through existing source labels/refs and prompt/report text.

### Option B: Durable Accepted And Rejected Draft Records Now

Persist every draft review disposition as durable records tied to Queue task
ids, draft item ids, source refs, reviewer identity, timestamps, and reasons.

Benefits:

- Clear replay and review history.
- Rejected draft rationale survives reload.
- Better preparation for future audit and Evidence relationships.

Costs:

- Requires storage/API/schema work outside this docs-only block.
- Requires a durable draft-pack identity model that does not exist yet.
- Requires retention, deletion, source-version, reviewer, and stale-source
  policy before rejected records are trustworthy.
- Risks making rejected drafts look like Knowledge Catalog `rejected` items
  before the full Catalog store exists.
- Risks confusing draft review history with Evidence or audit records.

### Option C: Hybrid Lightweight Rejection Notes

Persist only rejection reasons or review summaries in existing Queue task
fields while accepted drafts create Knowledge Documents.

Benefits:

- Gives some operator-visible continuity.
- Avoids a full rejected-item store.

Costs:

- Existing Queue fields are not a structured draft-review ledger.
- Partial notes cannot reliably support replay, audit, source versioning, or
  reviewer attribution.
- It can imply durable review evidence without the necessary model.

## Decision

Stable v0.1 uses Option A.

Accepted draft behavior:

- An accepted draft may create or update a durable Knowledge / Skills
  Knowledge Document through the existing explicit acceptance path.
- The durable Knowledge record should preserve the best available provenance
  supported by the current model: source label, source kind/ref, scope, type,
  tags, lifecycle/status, enabled state, content, quick summary, and any
  visible generated-from Queue task reference available at acceptance time.
- Acceptance is the durable product outcome. Stable v0.1 does not require a
  separate durable draft-review decision ledger.
- Acceptance does not grant provider context permission, Queue execution
  permission, Evidence approval, or automatic activation beyond the explicit
  Knowledge document status/enabled choice the operator makes.

Rejected draft behavior:

- Rejection is review-local for Stable v0.1.
- Rejecting a draft must not create active Knowledge, enable Knowledge,
  approve Evidence, mutate Queue execution state invisibly, or preserve hidden
  prompt/context memory.
- A rejected draft reason may remain visible only within the current review
  session or within existing operator-edited Queue task/report/status text if
  the current UI/API already supports that explicit edit.
- Stable v0.1 must not claim durable rejected-draft history, rejected Catalog
  item storage, or complete review replay.

## Source Queue Task Relationship

Knowledge generation draft packs should be related to their source Queue task
when the task created or carried the generation work.

Stable v0.1 requirements:

- A draft pack should show the source Queue task identity when it is available
  from the current report/review surface.
- Accepted Knowledge should record the source Queue task as best-effort
  provenance through existing source fields or visible content; this is partial
  provenance, not a full durable `createdByTaskId` Catalog field.
- Rejected drafts do not require a durable Queue task relation in Stable v0.1.
- Queue task completion should not imply Knowledge acceptance unless the
  operator explicitly accepted the draft.

Future durable requirements:

- Durable draft-pack review storage must preserve Queue task id, draft pack id,
  draft item id, source refs, review action, reviewer, timestamp, reason,
  accepted Knowledge item/document id when applicable, and source version or
  snapshot references where available.
- Historical review records must not be silently rewritten when Knowledge,
  source refs, Queue prompts, reports, or generated text change later.

## Audit And Evidence Status

Stable v0.1 draft review decisions are not audit records and are not Evidence.

Accepted Knowledge is a durable Knowledge Document with provenance metadata.
It may later be used under the active Knowledge / Skills context rules, but it
is not Evidence and does not prove that its sources were independently
verified.

Rejected draft decisions are not durable audit events, Evidence records, or
Knowledge Catalog `rejected` items in Stable v0.1.

Future durable draft-review implementation may emit or store audit-ready
events and may link to future Evidence records, but only after explicit
contracts define storage, source versioning, reviewer attribution, retention,
redaction, and AI-context approval semantics.

## Stable v0.1 Acceptable Behavior

Stable v0.1 may claim:

- explicit operator review is required before generated drafts become
  Knowledge;
- accepted drafts can create durable Knowledge Documents through the existing
  Knowledge / Skills path;
- accepted records carry partial provenance through current Knowledge Document
  fields;
- rejected drafts do not become Knowledge or active context;
- Queue task completion is separate from Knowledge acceptance.

Stable v0.1 must not claim:

- durable rejected-draft history;
- complete draft-review audit trails;
- full Knowledge Catalog lifecycle records for generated drafts;
- durable source-ref snapshots for every draft;
- Evidence capture or Evidence approval from draft review;
- automatic Knowledge activation, automatic Queue completion, or automatic AI
  context permission from generation output.

## UI Wording

Use wording such as:

- "accept to Knowledge";
- "accepted as a Knowledge Document";
- "source task";
- "partial provenance";
- "rejected for this review";
- "not saved as Knowledge".

Avoid wording such as:

- "audit log";
- "evidence";
- "saved rejection history";
- "rejected Knowledge item";
- "replayable draft decision";
- "verified source evidence";
- "automatic activation".

## Future Migration Shape

A future durable draft-review slice should be explicit and focused.

Recommended future shape:

- Add durable draft-pack and draft-item identities.
- Store review dispositions for accept, reject, edit-then-accept, split,
  merge, follow-up, and blocked decisions.
- Link accepted dispositions to the created or updated Knowledge record id.
- Link all dispositions to Queue task id and selected source refs.
- Preserve reviewer, timestamp, reason, operator edits, source versions or
  snapshots, and generated text hash where applicable.
- Keep rejected draft records out of active Knowledge context unless the
  operator explicitly reviews them under a future Catalog/history surface.
- Add audit-ready event emission only after the audit/event storage contract is
  implemented.
- Link to Evidence only after the Evidence store and approval workflow exist.

No backfill is required for Stable v0.1 review-local rejected drafts. Existing
accepted Knowledge Documents may keep their partial source metadata without
inventing missing draft ids, source snapshots, reviewer ids, or rejection
records.

## Storage And API Non-Goals

This decision does not add:

- draft review storage fields;
- rejected draft storage;
- Queue task schema changes;
- Knowledge schema changes;
- SQLite migrations;
- Tauri commands;
- frontend DTOs or UI behavior;
- draft-pack parser/runtime changes;
- audit event persistence or emission;
- Evidence storage;
- Context Pack storage;
- automatic Knowledge activation;
- automatic Queue task status changes;
- automatic AI context inclusion;
- provider/tool behavior;
- Workspace Agent, Agent Executor, or Queue runtime changes.

## Contract Updates

`docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md` remains the semantic contract
for Queue-based Knowledge generation and draft review.

Future work that changes draft review persistence, rejected draft handling,
accepted draft provenance, Queue task review linkage, audit readiness, or
Evidence linkage must read this decision first.
