# Knowledge Generation Workflow Contract

Contract status: docs/type-design plus implemented partial workflow record.

This contract defines how Workspace Agent, Finder, and Queue may support
operator-reviewed draft Knowledge generation from explicitly selected codebase,
documentation, and coordinator/command history sources.

This document does not add frontend UI, backend/Tauri commands,
storage/schema changes, provider tools, Agent Executor behavior, Queue
execution behavior, full Knowledge Catalog behavior, vector search, filesystem
scanning, or automatic ingestion.

## Purpose

Knowledge generation is an operator-reviewed workflow for turning selected
Workspace sources into draft reusable Knowledge.

The workflow exists to help the operator capture durable project understanding
without turning Hobit into hidden memory, background indexing, or automatic
prompt augmentation.

## Product Model

Workspace Agent is the foreground surface that helps the operator decide what
Knowledge should be generated.

Agent Queue is the visible task ledger for generation work that is larger,
delayed, repeatable, or useful to review separately from the current
conversation.

A Knowledge generation task analyzes only the selected source refs recorded on
the Queue task and returns one or more draft Knowledge packs. Draft packs are
not active Knowledge. The operator must review, edit, accept, reject, split, or
send them back for follow-up.

The Knowledge / Skills widget or future Knowledge Catalog remains the owner of
accepted Knowledge records. Queue owns the generation task and review handoff;
Workspace Agent owns conversation, proposal, and interpretation.

## Status And Current Boundary

This is a partially implemented workflow contract.

Current implemented behavior remains limited to the Knowledge / Skills MVP and
focused Queue-generation extensions in `docs/CURRENT_WIDGET_SURFACE.md`,
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`, and
`docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md`.

Current implemented behavior includes visible/manual Knowledge-generation
Queue task creation from Workspace Agent/Finder-style prompts for selected
codebase, docs, and history refs; draft Knowledge pack parsing/review from
worker report output; and explicit accept/reject actions in Knowledge /
Skills. Creating a task does not execute analysis, activate Knowledge, read
hidden context, or create durable provider/tool permissions.

Still future: structured durable `sourceRefs` on Queue tasks, a dedicated
generation runtime, automatic source analysis, full Knowledge Catalog item
creation, durable draft-review disposition records, durable rejected-draft
history, vector search, folder watching, background indexing, and automatic
activation.

Draft review persistence is governed by
`docs/KNOWLEDGE_DRAFT_REVIEW_PERSISTENCE_DECISION.md`. Stable v0.1 may persist
accepted drafts as Knowledge / Skills Knowledge Documents through the explicit
acceptance path, but rejected draft decisions remain review-local unless the
operator records them through an existing explicit Queue task/report/status
surface.

## Source Selection Rules

Knowledge generation starts with explicit source selection.

Allowed source categories:

- `codebase`: selected files, directories, diffs, module maps, symbols, or
  bounded repository summaries that the operator approved for this task.
- `docs`: selected project documentation, contracts, decisions, runbooks,
  README files, imported docs, or external references approved for this task.
- `coordinator_history`: selected visible Workspace Agent conversation
  excerpts, proposal cards, Queue task summaries, review decisions, or
  operator-written summaries.
- `command_history`: selected validation summaries, command summaries,
  Terminal excerpts, Agent Executor run summaries, Agent Activity summaries, or
  other command observations that the operator explicitly selected or approved.

Source refs must be explicit and reviewable. A source ref should preserve:

```text
sourceRefId
kind: codebase | docs | coordinator_history | command_history
label
origin
selector
selectedBy
selectedAt
reason
caps
redaction
visibility
```

Current implementation note: current generation tasks preserve source
selection primarily in visible prompt/task text and safe refs rather than a
durable structured `sourceRefs` storage model. Future API/storage work should
use the shape above without expanding source access beyond explicit operator
selection.

Examples:

- `codebase` source: repository root label plus selected relative file paths,
  line ranges, or bounded module-map output.
- `docs` source: document path, decision id, external URL, or imported
  document id.
- `coordinator_history` source: visible Workspace Agent message ids, proposal
  ids, Queue task ids, or explicit operator summaries.
- `command_history` source: validation command summary, safe run-link
  metadata, selected visible output excerpt, or Agent Activity event summary.

Source refs must not silently include:

- unselected files or folders;
- hidden widget state;
- Notes bodies;
- raw Terminal transcripts;
- raw Agent Executor stdout/stderr/logs/final responses;
- Git diffs or file contents not explicitly selected;
- JDBC rows, schemas, connector secrets, or query results not explicitly
  selected;
- environment variables, credentials, tokens, private keys, or secrets.

Caps and summaries do not make sensitive content safe by themselves. If raw or
sensitive content is needed, the operator must explicitly select it and the
generation task must record why it is included.

## Workspace Agent To Queue Flow

Workspace Agent may help create a Knowledge generation Queue task through a
visible proposal flow.

Required flow:

1. The operator asks Workspace Agent to generate Knowledge or accepts a visible
   Workspace Agent suggestion.
2. Workspace Agent lists the proposed source refs, purpose, expected output,
   risk notes, and draft Knowledge target.
3. The operator approves, edits, or rejects the proposal.
4. Only after approval, Workspace Agent creates a Queue task through the
   app-native Queue create path.
5. Creating the Queue task does not run it, activate Knowledge, search hidden
   context, mutate files, mutate Git, or change provider/tool permissions.

The Queue task should include:

```text
title
description
prompt
itemType: knowledge_generation
queueTag
priority
executionPolicy
sourceRefs
generationGoal
requestedDraftTypes
targetScope
reviewRequirements
blockers
createdBy
```

`executionPolicy` should default to `manual` unless a later explicit Queue
policy allows another value and the operator chooses it.

The prompt must instruct the worker to use only the listed source refs and to
return a draft pack rather than creating or activating Knowledge directly.

## Generation Workflows

### Create Knowledge From Codebase

Purpose: capture reusable understanding about repository structure, modules,
interfaces, conventions, validation, known risks, or implementation details.

Typical selected sources:

- explicit files or folders;
- selected diffs;
- module-map output;
- code comments or type definitions;
- test files relevant to the selected component;
- focused validation summaries.

Expected draft item types:

- `codebase_knowledge`;
- `architecture_decision`;
- `validation_rule`;
- `known_issue`;
- `workflow`;
- `skill` when the output is actionable work guidance.

The task must not recursively scan the repository, infer hidden ownership, read
unselected files, watch folders, or create a broad code index.

### Create Knowledge From Docs

Purpose: turn selected documentation into concise, reusable Knowledge that can
be reviewed and maintained.

Typical selected sources:

- active contracts;
- decisions;
- README or manual sections;
- runbook references;
- external documentation approved by the operator;
- explicit imported Markdown/text documents.

Expected draft item types:

- `documentation_knowledge`;
- `architecture_decision`;
- `runbook`;
- `prompt_template`;
- `validation_rule`;
- `workflow`;
- `external_reference`.

The task must preserve source attribution and must distinguish current,
planned, deferred, compatibility, deprecated, and superseded language when the
source uses those statuses.

### Create Knowledge From Coordinator Or Command History

Purpose: preserve reusable lessons from visible work history without treating
raw history as hidden memory.

Typical selected sources:

- selected Workspace Agent conversation excerpts;
- approved proposal cards;
- Queue task summaries and review decisions;
- Agent Activity summaries;
- safe Agent Executor run-link metadata or operator-selected excerpts;
- validation summaries;
- selected command summaries or bounded visible excerpts.

Expected draft item types:

- `command_history_summary`;
- `investigation_summary`;
- `known_issue`;
- `validation_rule`;
- `workflow`;
- `skill`.

The task must summarize what was learned, what remains uncertain, and which
source refs support the conclusion. It must not copy full logs, prompts,
stdout/stderr, diffs, repo paths, secrets, raw provider responses, or Terminal
transcripts into Knowledge by default.

## Draft Knowledge Pack Shape

A Knowledge generation task returns one or more draft packs.

Current implementation note: draft packs can be exposed from Queue worker
report text and parsed for review in Knowledge / Skills. This is a review
surface over returned report content, not an automatic generation runtime or
automatic Knowledge activation path.

Conceptual shape:

```text
draftPackId
queueItemId
packTitle
generationGoal
sourceRefs
proposedItems
overallConfidence
blockers
reviewActions
createdAt
```

Each proposed item should include:

```text
draftItemId
title
quickSummary
fullContent
suggestedType
suggestedTags
suggestedScope
sourceRefs
confidence
blockers
reviewNotes
relatedFiles
relatedTasks
relatedCommits
activationRecommendation
```

Field rules:

- `packTitle`: short human-readable title for the draft pack.
- `sourceRefs`: explicit refs used to generate the pack; no hidden sources.
- `proposedItems`: one or more candidate Knowledge records.
- `quickSummary`: one to three lines for review and scan surfaces.
- `fullContent`: the detailed draft content the operator may edit before
  acceptance.
- `suggestedType`: one Knowledge Catalog item type or current compatible
  Knowledge / Skills target type.
- `suggestedTags`: operator-visible tags; never hidden routing metadata.
- `suggestedScope`: `workspace-local` or `global`; default
  `workspace-local` unless the operator chose another target.
- `confidence`: low, medium, high, or a future structured equivalent with a
  short rationale.
- `blockers`: missing source, conflicting source, stale source, insufficient
  evidence, sensitive content omitted, or operator decision needed.
- `reviewActions`: allowed next actions for the operator.
- `activationRecommendation`: whether the item should remain draft/disabled,
  be accepted as active, be split, be merged, or be rejected.

Draft pack output must be bounded and safe for review. Large content should be
split into multiple proposed items rather than hidden behind oversized raw
payloads.

## Review And Acceptance Flow

Generated packs require operator review before they become Knowledge.

Allowed review actions:

- `accept_as_draft`: create a draft Knowledge record for later editing.
- `accept_as_active`: create an active/enabled record only after explicit
  operator acceptance.
- `edit_then_accept`: edit title, summary, content, tags, type, scope, and
  source refs before acceptance.
- `split`: split one proposed item into several smaller items.
- `merge`: merge proposed items while preserving source refs.
- `reject`: mark the proposal rejected with a reason.
- `needs_follow_up`: create a follow-up Queue task for missing or conflicting
  source review.
- `mark_blocked`: leave the pack blocked because the source, confidence, or
  safety state is insufficient.

Acceptance must preserve:

- source refs;
- generated-from Queue item id;
- review decision;
- operator edits;
- accepted scope;
- accepted type/tags;
- status or enabled flag appropriate to the target Knowledge surface.

Current implementation note: Stable v0.1 acceptance preserves only the
provenance and review metadata supported by the current Knowledge Document
model and visible source/report text. It does not require a separate durable
draft-review ledger, first-class `createdByTaskId` Catalog field, audit event,
or Evidence record.

Acceptance does not grant provider context permission. Accepted Knowledge may
be eligible for later explicit retrieval or selection only under the active
Knowledge / Skills and future Knowledge Catalog context rules.

Rejection is review-local for Stable v0.1. Rejecting a draft must not create
active Knowledge, enable Knowledge, approve Evidence, mutate Queue execution
state invisibly, or preserve hidden prompt/context memory. Durable
rejected-draft history is deferred until a focused future storage/API slice
defines draft-pack identity, review disposition records, source versioning,
retention, audit readiness, and Evidence linkage.

## Queue State And Reporting

A Knowledge generation Queue task should use normal Queue lifecycle and review
semantics.

Expected conceptual states:

- `draft`: proposal exists but source refs or instructions need review.
- `queued`: approved generation task is ready for explicit execution.
- `running`: the assigned execution path is working on the draft pack.
- `review_needed`: draft pack exists and needs operator review.
- `blocked`: source refs, permissions, confidence, or safety constraints are
  insufficient.
- `completed`: operator has reviewed the pack and recorded a decision.
- `failed` or `cancelled`: generation did not produce reviewable output.

Execution completion is not Knowledge acceptance. Draft pack ready is not
active Knowledge. Queue completion should reflect review disposition, not just
worker success.

Queue reports should include safe summaries and refs, not raw logs. Agent
Executor or the future worker owns raw execution details.

Current implementation note: current Queue task creation is manual/draft, and
any analysis depends on an explicit Queue/Executor run. Review-ready draft pack
content is surfaced from the visible worker report; raw Executor logs and
payloads are not copied into Knowledge by default.

Queue task completion, worker success, and draft-pack availability do not imply
Knowledge acceptance. Accepted Knowledge should record the source Queue task as
best-effort provenance through existing source fields or visible content when
available; rejected drafts do not require a durable Queue relation in Stable
v0.1.

## Safety Rules

Knowledge generation must preserve these rules:

- Workspace Agent proposes; operator controls.
- Source selection is explicit and visible.
- Queue tasks are visible and reviewable.
- Generation uses only selected source refs.
- Generated output is draft until reviewed.
- Acceptance is separate from generation.
- Knowledge activation is separate from Queue execution.
- Provider/tool access remains disabled unless a later explicit contract adds
  it.
- Secrets and sensitive raw payloads are excluded unless separately selected,
  capped, redacted, and approved under an explicit future policy.
- Workspace boundaries remain intact.

## Non-Goals

This contract does not add:

- background auto-ingest;
- hidden memory;
- hidden prompt augmentation;
- vector search;
- embeddings;
- folder scans;
- recursive repository scanning;
- filesystem watchers;
- automatic activation;
- hidden or unapproved Queue task creation;
- automatic Queue execution;
- automatic acceptance;
- automatic full Knowledge Catalog implementation;
- automatic Notes, logs, results, Git, JDBC, Terminal, provider, Queue, or
  Executor ingestion;
- broad source discovery;
- provider tool calls;
- schema changes;
- Tauri commands;
- frontend UI;
- backend runtime;
- server/team/RBAC behavior.

## Acceptance Criteria

This contract is complete when:

- the Queue-based Knowledge generation role is explicit;
- codebase, docs, and coordinator/command history workflows are defined;
- source refs are explicit and bounded;
- Workspace Agent creates Queue tasks only through visible approval;
- Queue tasks return draft packs rather than active Knowledge;
- draft pack shape includes title, source refs, proposed items, quick
  summaries, full content, suggested type/tags/scope, confidence/blockers, and
  review actions;
- operator review and acceptance are separate from generation;
- Stable v0.1 draft-review persistence boundaries are explicit;
- non-goals rule out background ingestion, hidden memory, vector search, folder
  watch, and automatic activation;
- no implementation behavior is added by this document.
