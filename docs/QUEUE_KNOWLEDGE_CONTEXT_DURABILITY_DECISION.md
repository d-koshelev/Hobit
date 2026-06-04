# Queue Knowledge Context Durability Decision

## Purpose

This decision resolves whether Knowledge / Skills context attached to Agent
Queue tasks remains frontend-local for Stable v0.1 or becomes durable
Queue-owned state now.

This is a docs-only architecture decision. It does not add storage, schema,
frontend UI, backend/Tauri commands, provider behavior, Queue execution,
Workspace Agent behavior, Agent Executor prompt behavior, Context Pack
runtime, evidence storage, or automatic context injection.

## Current Behavior

The current Knowledge / Skills and Queue integration allows the operator to
explicitly attach selected saved Knowledge Documents and Skills to a selected
Queue task. The attachment surface uses safe refs, bounded summaries or
snapshots, warnings, token estimates, and visible prompt materialization before
an explicit Queue execution path consumes the prepared prompt.

That attachment/materialization state is frontend-local and current-session
only unless it is represented indirectly in an explicit materialized prompt or
run handoff. It is not durable Queue-owned storage/API state, not a backend
scheduler input, not a Context Pack, and not an Evidence store.

## Options Evaluated

### Option A: Keep Frontend-Local For Stable v0.1

Keep the current explicit attach/materialize behavior as current-session UI
state. Durable persistence is limited to existing Queue tasks and any existing
explicit materialized prompt/run artifacts created by the execution handoff.

Benefits:

- Preserves the current implementation boundary.
- Avoids unplanned Queue schema/API work.
- Avoids implying resumable task memory or replay evidence that does not
  exist.
- Keeps attached context visible and immediately tied to the operator's
  current review.
- Reduces hidden-context risk for Queue Autorun and assigned-task execution.

Costs:

- Reloading Hobit loses the prepared context selection unless it was already
  included in a visible materialized prompt/run handoff.
- Queue task replay cannot reconstruct selected Knowledge / Skill refs from
  durable Queue records.
- Stable v0.1 cannot claim durable context evidence for Queue tasks.

### Option B: Durable Queue-Owned Context Now

Add task-owned durable context refs, snapshots, warnings, token budget, and
materialization metadata to Queue storage/API now.

Benefits:

- Queue tasks could preserve context selections across reloads.
- Future execution evidence and replay would have a clearer task-owned record.
- The ownership model would match the desired long-term contract earlier.

Costs:

- Requires storage/API/schema work outside this docs-only block and outside
  the current Stable v0.1 implementation boundary.
- Requires source versioning, staleness checks, warning acknowledgement, and
  right-rail review semantics to avoid stale or hidden context.
- Risks creating durable hidden memory if saved context survives reload and is
  consumed without an explicit fresh review.
- Risks confusing Queue-owned context, Context Packs, Evidence, and Knowledge
  source ownership before those future stores are implemented.

### Option C: Hybrid

Persist only lightweight refs now while keeping materialized snapshots
frontend-local, or persist materialized prompt text without a full task context
model.

Benefits:

- Gives partial reload continuity.
- Defers some snapshot/evidence complexity.

Costs:

- Creates ambiguous ownership: Queue would appear to own context without owning
  durable warnings, snapshots, source-version drift, token budget, or evidence.
- Partial refs can become stale or blocked without a durable policy record.
- Persisted prompt text alone is not structured context evidence and can blur
  source attribution.
- Increases hidden-context risk while still not satisfying replay or audit
  requirements.

## Decision

Stable v0.1 keeps Queue Knowledge / Skills context frontend-local and
current-session.

Durable Queue-owned Knowledge context is deferred until a focused future
storage/API slice implements the full task-owned context model described in
`docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md`: attached refs, bounded snapshots,
warnings, token budget, materialization metadata, and execution evidence
references.

The only acceptable v0.1 persistence side effect is the existing explicit
materialized prompt/run handoff when the operator starts a Queue task. That
handoff may show what text was included in that run, but it must not be
described as durable Queue-owned context state or full execution evidence.

## Evidence And Replay Implications

Stable v0.1 Queue task records do not provide durable context replay. After a
reload, Hobit may show the task and any persisted run links already supported
by Queue/Executor, but it cannot reconstruct unsaved frontend-local Knowledge /
Skill attachments from Queue storage.

If an explicit run prompt or Agent Executor run detail contains materialized
context, that artifact can help explain what was sent for that run. It is still
not a structured evidence record with source ref versions, snapshot ids,
warning acknowledgements, or token budget state.

Future durable implementation must record context evidence at execution time:

- Queue task id;
- run id or Agent Executor run link;
- attached Knowledge and Skill ref ids plus versions used;
- task-owned snapshot ids and materialization time;
- token estimate and over-budget state;
- warning ids and acknowledgements present at execution time;
- scope and provenance labels.

Historical evidence must not be silently rewritten when Knowledge Documents,
Skills, Queue task prompts, or attachments change later.

## Hidden Context Risk

Durable context now would make it easy for old attachments to survive reload
and become invisible stale prompt input, especially around assigned-task runs
or operator-armed Queue Autorun. That would conflict with the no-hidden-memory
rule and the requirement that operators can review context before it affects a
Queue task, executor prompt, provider call, or tool.

For Stable v0.1, losing unsaved prepared context on reload is preferable to
persisting context without the durable warning, staleness, acknowledgement, and
evidence model needed to keep it visible and trustworthy.

## UI Wording

Stable v0.1 UI and docs should avoid language that implies durable Queue task
memory.

Use wording such as:

- "attached for this session";
- "prepared context";
- "materialized for this run";
- "will be included in the run prompt";
- "not saved as Queue task context".

Avoid wording such as:

- "saved task context";
- "Queue memory";
- "persistent context";
- "evidence";
- "replayable context";
- "automatic Knowledge context".

When materialized context is included in an explicit run prompt, wording may
say it was "included in this run prompt" or "visible in the run handoff", but
must not claim full durable context evidence.

## Future Migration Shape

Future durable Queue-owned context should be added in one focused slice after a
contract update or implementation plan defines storage/API details.

Migration shape:

- Add a task-owned `QueueTaskContext` storage/API shape with attached refs,
  bounded snapshots, warnings, token budget, and materialization metadata.
- Keep Knowledge / Skills as the source owner. Queue stores refs and bounded
  task snapshots, not source record ownership.
- Store source versions or content hashes so Queue can detect stale or missing
  sources.
- Keep materialized snapshots immutable for historical runs.
- Require right-rail visibility before execution consumes durable context.
- Add explicit refresh, detach, re-materialize, and warning acknowledgement
  actions only when the durable model exists.
- Add execution evidence references that tie Queue task context to Agent
  Executor run links without copying raw full Knowledge or Skill bodies by
  default.

No backfill is required for Stable v0.1 frontend-local attachments. Existing
materialized run prompts may remain historical run artifacts, but they should
not be automatically parsed into structured context refs because that would
invent provenance and acknowledgement data.

## Storage And API Non-Goals

This decision does not add:

- Queue task context storage fields;
- SQLite migrations;
- Queue context Tauri commands;
- frontend API DTOs;
- backend context resolver behavior;
- durable warning or acknowledgement records;
- execution evidence storage;
- Context Pack storage or runtime;
- Knowledge storage changes;
- Agent Executor prompt changes;
- Workspace Agent provider changes;
- Queue execution changes;
- Queue Autorun changes;
- hidden context injection;
- automatic Knowledge search for Queue tasks;
- automatic attachment;
- automatic task creation.

## Contract Updates

`docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` remains the semantic contract for
current frontend-local behavior and future durable Queue-owned context.

`docs/ACTIVE_CONTRACT_INDEX.md` should list this decision near
`docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` so future Queue Knowledge context
work reads the durability decision before proposing storage/API changes.
