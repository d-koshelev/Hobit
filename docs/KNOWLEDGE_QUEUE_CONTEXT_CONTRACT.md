# Knowledge Queue Context Contract

## Purpose

This contract defines how Knowledge Documents and Skills may be attached to
Agent Queue tasks, including the current partial frontend-local behavior and
the future durable Queue-owned model.

This document does not add storage, schema, frontend UI, backend/Tauri
commands, provider behavior, Queue execution, Workspace Agent behavior,
Knowledge retrieval changes, Agent Executor prompt changes, audit emission, or
automatic ingestion.

Durability decision: `docs/QUEUE_KNOWLEDGE_CONTEXT_DURABILITY_DECISION.md`
keeps Stable v0.1 Queue Knowledge / Skills context frontend-local and
current-session. Durable Queue-owned context storage/API state is deferred
until a future focused storage/API slice implements the full task-owned context
model, warnings, token budget, materialized snapshots, and execution evidence
references.

## Status

Partially implemented contract for Queue task context semantics.

Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md`, `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`,
and `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`.

Current implemented behavior includes explicit operator attachment of saved
Knowledge Documents and Skills to the selected Queue task as safe refs,
bounded summaries/snapshots, warnings, token estimates, and visible
materialized context prepended before explicit Queue execution prompts. Attach
does not start work and does not create Queue tasks automatically.

Current limitation and Stable v0.1 decision: this context
attachment/materialization is frontend-local and current-session unless
already represented indirectly in an explicit materialized prompt/run handoff.
It is not durable Queue-owned storage/API state, not a backend scheduler input,
and not a Context Pack or Evidence store.

## Ownership Model

Queue task owns task context attachment state.

Knowledge / Skills owns source records:

- Knowledge Documents;
- future Knowledge Catalog items;
- Skills;
- document content, skill content, lifecycle status, scope, source, version,
  enabled state, and review state.

In the full future model, Agent Queue owns task-scoped context references and
task-scoped materialized snapshots:

- which Knowledge refs are attached to the Queue task;
- which Skill refs are attached to the Queue task;
- which bounded summaries or excerpts were materialized for a specific planned
  run;
- task-local context warnings and operator acknowledgements;
- context token budget state;
- execution evidence that records which context was used.

The Knowledge / Skills widget only sends explicit attach, detach, or replace
actions selected by the operator. The widget does not transfer ownership of
source records to Queue, does not create Queue tasks automatically, and does
not silently attach active Knowledge or Skills to existing tasks. In the
current implementation, those actions update frontend-local selected-task
context state rather than durable Queue task records.

Queue must not mutate Knowledge Documents or Skills when attaching, detaching,
materializing, running, completing, accepting, rejecting, or archiving a task.
Knowledge lifecycle changes may make existing Queue attachments stale, blocked,
or warning-bearing, but they do not silently rewrite historical task snapshots.

## Queue Task Context Shape

Future durable Queue task context state should be modeled as a task-owned
object:

```ts
type QueueTaskContext = {
  attachedKnowledgeRefs: AttachedKnowledgeRef[];
  attachedSkillRefs: AttachedSkillRef[];
  attachedKnowledgeSnapshots: AttachedKnowledgeSnapshot[];
  contextWarnings: ContextWarning[];
  contextTokenBudget: ContextTokenBudget;
  materializedAt: string | null;
};
```

This shape is vocabulary for future durable implementation. Current
frontend-local Queue context uses compatible refs, snapshots, warnings, token
estimates, and materialized prompt content where available, but field names and
persistence are not a stable backend API. Field names may be refined when API
and storage work starts, but the ownership and safety semantics in this
contract must be preserved.

## Attached Knowledge Refs

`attachedKnowledgeRefs` are task-owned references to Knowledge source records.
They are not raw content copies.

Each attached Knowledge ref must include:

- `id` - stable source record id.
- `title` - operator-visible title at attach time.
- `quickSummary` - one to three line preview or summary.
- `version` - source version, revision, content hash, or updated timestamp
  used to detect drift.
- `scope` - `workspace-local`, `global`, or future explicit scope label.
- `source` - operator-visible provenance, such as imported file, authored
  record, URL, task, run, or catalog item.
- `status` - source lifecycle or availability status at attach time.

Refs may include a `reason` or `attachedBy` field later, but source content
must not be copied into the ref by default.

## Attached Skill Refs

`attachedSkillRefs` are task-owned references to Skill source records. They are
not executable permissions and do not grant tools.

Each attached Skill ref must include:

- `id` - stable Skill id.
- `title` - operator-visible title at attach time.
- `quickSummary` - practical summary of what the Skill is for.
- `version` - source version, revision, content hash, or updated timestamp
  used to detect drift.
- `scope` - `workspace-local`, `global`, or future explicit scope label.
- `source` - operator-visible provenance.
- `status` - review or lifecycle status at attach time.

Skills attached to Queue tasks may guide task preparation or executor prompts
only through a visible context review step. A Skill attachment must not execute
commands, enable tools, mutate files, launch Terminal, mutate Git, run JDBC,
or bypass Agent Executor approval boundaries.

## Attached Knowledge Snapshots

`attachedKnowledgeSnapshots` are task-owned, bounded, pre-run materializations
of attached Knowledge or Skill refs.

Each snapshot must include:

- `id` - task-local snapshot id.
- `sourceRefId` - attached Knowledge or Skill ref id.
- `title` - source title used for review.
- `quickSummary` - bounded operator-visible summary.
- `version` - source version actually materialized.
- `scope` - scope label actually materialized.
- `source` - provenance shown to the operator.
- `status` - lifecycle or availability status at materialization time.
- `materializedAt` - timestamp when the bounded snapshot was created.
- `tokenEstimate` - estimated tokens consumed by this snapshot.
- `contentKind` - `summary`, `excerpt`, or future explicit bounded kind.

Snapshots must not contain raw full source bodies by default. They may contain
bounded summaries and bounded excerpts that are visible to the operator before
execution. Full raw bodies require a future explicit contract and operator
approval path, including caps, source labels, and redaction rules.

Materialized snapshots are immutable run-preparation evidence. If the source
Knowledge record changes after materialization, Queue should warn that the
attachment is stale rather than silently updating the historical snapshot.

## Context Warnings

`contextWarnings` are task-owned visible warnings that explain context risk or
unreadiness.

Warning examples:

- attached source no longer exists;
- attached source is disabled;
- attached source is stale;
- attached source is rejected;
- attached source version differs from the materialized snapshot;
- attached source scope does not match the task Workspace;
- token budget is exceeded;
- excerpt was truncated;
- source provenance is missing or weak;
- status is draft, archived, or otherwise not active;
- snapshot was materialized before the latest task prompt edit.

Each warning should include:

- `id`;
- `sourceRefId` when applicable;
- `severity` as `info`, `warning`, or `blocked`;
- `code`;
- `message`;
- `createdAt`;
- `acknowledgedAt` when a warning is explicitly acknowledged;
- `acknowledgedBy` when an actor model exists.

## Status Rules

Only active and enabled Knowledge or Skill records are eligible for normal
Queue task context use.

Minimum status handling:

- `active` and enabled: eligible for attachment and materialization.
- disabled: blocked until re-enabled or detached.
- `rejected`: blocked and must not be sent to an executor or provider.
- `stale`: warning-bearing; the operator must see the warning before run and
  either refresh, detach, or explicitly acknowledge use under a future
  approval rule.
- `draft`: warning-bearing or blocked depending on future task policy; it must
  never be treated as reviewed project knowledge.
- `archived`: warning-bearing or blocked depending on future task policy; it
  must never be treated as active guidance.
- missing/deleted source: blocked for new materialization; historical
  snapshots remain visible as evidence if they already exist.

Queue must block execution when any required context warning has `blocked`
severity. Queue may allow execution with warning-level context only after the
warning is visible in the Queue task review surface and the operator makes the
future required acknowledgement.

Current implementation note: disabled and rejected Knowledge are blocked on
attach, stale Knowledge is warning-bearing with visible confirmation, and
draft/archived Knowledge are warning-bearing. These warnings are part of the
frontend-local context state and materialized prompt review path, not durable
Queue-owned policy records.

## Token Budget

Queue task context must have an explicit token budget before execution context
is materialized.

Current implementation note: Queue context materialization computes and shows
bounded context, warnings, evidence refs, and token estimates before explicit
Queue execution. This is current-session frontend behavior and does not create
a durable Context Pack or evidence record.

`contextTokenBudget` should include:

- `maxTokens` - task context budget for attached Knowledge and Skills.
- `estimatedTokens` - current estimate across materialized snapshots.
- `reservedTokens` - optional reserved space for task prompt, run settings, or
  required system context.
- `overBudget` - whether the current materialized context exceeds the budget.
- `policy` - future policy such as `summaries-first`, `operator-selects`, or
  `block-when-over-budget`.

Token caps are safety and usability controls, not redaction. Exceeding the
budget must be visible before execution. Queue must not silently drop or
substitute context without showing the operator what changed.

## Queue Right Rail Visibility

Attached context must be visible from the selected Queue task right rail before
run.

The right rail should show, at minimum:

- attached Knowledge refs with title, scope, status, quick summary, source,
  and version;
- attached Skill refs with title, scope, status, quick summary, source, and
  version;
- materialized snapshot summaries or bounded excerpts;
- context warnings and blocked reasons;
- context token budget and over-budget state;
- last `materializedAt` timestamp;
- remove, refresh, or re-materialize actions only when those actions are
  explicitly implemented in a future block.

The right rail must not hide attached context inside executor logs, raw prompt
text, or provider payloads. Operators must be able to review what will be used
before any Queue task execution path consumes it.

## Execution Evidence

When a Queue task is executed with attached Knowledge or Skills, the resulting
execution evidence must record the context used.

Execution evidence should include:

- Queue task id;
- run id or Agent Executor run link;
- attached Knowledge ref ids and versions used;
- attached Skill ref ids and versions used;
- snapshot ids used;
- snapshot `materializedAt` timestamp;
- context token estimate;
- warning ids present at execution time;
- operator acknowledgement refs when warnings were allowed;
- source scope labels and provenance labels.

Execution evidence must not copy raw full Knowledge or Skill bodies by default.
It should point to task-owned snapshots and source refs so the operator can see
what was selected and what bounded material was sent or prepared.

Historical evidence must remain tied to the context used at the time of run.
Later edits to Knowledge Documents, Skills, Queue task prompt text, or context
attachments must not rewrite past execution evidence.

Current implementation note: durable execution evidence is not implemented as
a separate evidence store. The current run handoff can include visible
materialized context and safe evidence-style refs in the task prompt path, but
that does not satisfy the full future execution evidence model above.

## Safety Rules

- No raw full Knowledge or Skill bodies by default.
- No hidden context injection into Queue tasks, executor prompts, providers, or
  tools.
- No automatic Queue task creation from Knowledge / Skills.
- No automatic attachment of enabled Knowledge to Queue tasks.
- No automatic Skill prompt injection.
- No use of disabled, rejected, missing, or blocked context.
- No silent refresh of historical snapshots.
- No hidden Workspace scanning, filesystem scanning, Notes ingestion, logs
  ingestion, Git diff ingestion, SQL ingestion, Terminal ingestion, provider
  response ingestion, or artifact body ingestion.
- Bounded excerpts and summaries must be visible before run.
- Context warnings must be visible before run.
- Execution evidence must record context refs and snapshots used.
- Agent proposes; operator controls.

## Relationships To Existing Contracts

`docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` defines Queue as the
Workspace-level task and executor-history surface. This contract records
current frontend-local task-context behavior and defines future durable
task-context semantics for Knowledge and Skills.

`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` defines the current Knowledge /
Skills MVP, the no-hidden-memory rule, and the explicit AI context boundary.
This contract preserves those boundaries for Queue tasks.

`docs/KNOWLEDGE_CATALOG_CONTRACT.md` defines future Knowledge Catalog items,
including `quickSummary`, scope, source, and lifecycle status. This contract
uses those fields as the minimum visible context vocabulary for current
frontend-local Queue attachments and future durable Queue attachments.

`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md` governs explicit execution of assigned
Queue tasks. This contract does not add execution behavior; it only defines
what context metadata future durable execution evidence must record when that
evidence model is implemented.

## Non-Goals

This contract does not add:

- Queue storage fields;
- Knowledge storage fields;
- SQLite migrations;
- Tauri commands;
- new frontend UI beyond the current partial attach/materialization surface;
- Widget API methods;
- Workspace Agent provider changes;
- Agent Executor prompt changes;
- Queue execution changes;
- automatic dispatch;
- scheduler behavior;
- hidden memory;
- Context Pack storage or runtime;
- evidence store;
- embeddings or vector search;
- binary parsing;
- folder scanning;
- durable runtime context resolver;
- automatic Knowledge generation;
- automatic task creation;
- automatic attachment;
- tool permission grants;
- Git, Terminal, JDBC, Notes, Runbook, or artifact behavior changes.
