# Knowledge Catalog Contract

## Purpose

This contract defines the full Knowledge Catalog model for dynamic global and
workspace-local project knowledge.

The Knowledge Catalog is explicit project memory. It is not hidden AI memory,
not automatic prompt augmentation, not a background ingestion system, and not a
replacement for operator review.

This is primarily a docs/type-design contract. It also records the current
partial catalog-shaped Knowledge Document fields so future work does not treat
that partial implementation as either absent or complete.

This document does not add storage, schema, frontend UI, backend/Tauri
commands, provider behavior, Queue behavior, Workspace Agent behavior,
automatic ingestion, or runtime execution.

## Status

The full Knowledge Catalog is not implemented in the current product surface.

The current Knowledge / Skills implementation has a partial catalog-shaped
Knowledge Document model. Knowledge Documents can carry a catalog item type,
quick summary, lifecycle/status, source kind/source ref, source label, scope,
enabled flag, tags, and content. This is not a standalone Knowledge Catalog
store and does not implement the full item model in this contract.

The current implemented Knowledge / Skills MVP remains limited to scoped
plain-text/Markdown Knowledge Documents and Skills as described in
`docs/CURRENT_WIDGET_SURFACE.md` and
`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md`.

This contract defines the intended product model for a later explicit full
Knowledge Catalog slice.

## Product Definition

Knowledge Catalog is an operator-visible catalog of reusable project knowledge.
It helps operators and future agent surfaces find, review, maintain, and apply
known information about a project or Workspace.

Every Knowledge Catalog item is:

- explicit and reviewable;
- scoped as global or workspace-local;
- attributable to a source;
- lifecycle-managed;
- safe to inspect before use;
- never injected into Agent, Queue, provider, or executor context invisibly.

Knowledge Catalog is dynamic in the sense that items can be created, edited,
refreshed, split, merged, marked stale, archived, rejected, or deleted as the
project changes. Dynamic does not mean automatic hidden mutation or hidden
context sharing.

## Item Types

Knowledge Catalog items must use one of these item types:

- `codebase_knowledge` - reusable understanding about repository structure,
  modules, ownership, patterns, contracts, or important implementation details.
- `documentation_knowledge` - reusable understanding derived from project
  documentation, manuals, specifications, or external docs.
- `architecture_decision` - a durable decision, tradeoff, constraint, or
  accepted direction.
- `runbook` - a visible ordered workflow or procedure reference. A catalog
  runbook item is knowledge about a procedure; it does not execute steps.
- `skill` - actionable reusable know-how or work instructions.
- `prompt_template` - a reusable prompt/request pattern for an operator or
  approved future agent flow.
- `validation_rule` - a rule, command expectation, smoke check, acceptance
  check, or validation constraint.
- `known_issue` - a known bug, limitation, drift, risk, or unresolved problem.
- `workflow` - a recurring human or agent-assisted work pattern.
- `command_history_summary` - a reviewed summary of relevant command usage,
  validation history, or local execution observations.
- `investigation_summary` - a reviewed summary of findings from a focused
  investigation, debugging session, audit, or research task.
- `external_reference` - a reviewed pointer to external documentation,
  tickets, issues, articles, specifications, or other external sources.

Future item types require a contract update before implementation.

## Required Fields

Every Knowledge Catalog item must include:

- `title` - short human-readable name.
- `quickSummary` - one to three lines that capture the practical point of the
  item.
- `fullContent` - the reviewed source text or detailed explanation.
- `type` - one of the item types defined in this contract.
- `scope` - `global` or `workspace-local`.
- `source` - where the item came from, such as operator-authored text, file,
  doc path, external URL, task, run, command summary, decision, or generated
  draft.
- `tags` - operator-visible classification labels.
- `status` - one of the lifecycle statuses defined in this contract.
- `lastUpdated` - timestamp for the last meaningful content or lifecycle
  change.
- `relatedFiles` - explicit file paths or file refs when relevant.
- `relatedTasks` - explicit task ids, Queue item ids, issue ids, or task refs
  when relevant.
- `relatedCommits` - explicit commit hashes or refs when relevant.
- `createdByTaskId` - required when the item was generated from a task,
  Queue item, executor run, investigation, or other task-like workflow.

Related file, task, and commit fields may be empty when not applicable, but
the fields must exist in the item model so provenance can be represented
consistently.

Current partial implementation note: Knowledge Documents already support a
compatible subset of these fields for review and scan surfaces, including
`quickSummary`, item type, lifecycle/status, scope, source label/kind/ref,
tags, enabled state, and content. First-class `relatedFiles`, `relatedTasks`,
`relatedCommits`, and `createdByTaskId` fields are not implemented as durable
required Catalog fields. Prompt-text source refs, draft source refs, and source
labels provide partial provenance only.

## Quick Knowledge

Every item has quick knowledge through `quickSummary`.

`quickSummary` must be one to three lines. It is for fast scanning,
selection, previews, and review cards. It must not replace `fullContent`, hide
important caveats, or strip attribution.

Agent, Queue, and future context-selection surfaces may show `quickSummary`
as a visible preview, but use of the underlying item still requires visible
selection or review under the active context-sharing rules.

## Scopes

Knowledge Catalog supports two scopes:

- `global` - local-user/global project knowledge available across Workspaces
  where it explicitly applies.
- `workspace-local` - knowledge owned by one Workspace and relevant only inside
  that Workspace boundary.

Workspace-local items override global items when both apply to the same
question, workflow, file, task, decision, validation rule, or known issue.

Override does not delete or mutate the global item. It means the local item is
shown and considered first, with the global item remaining visible as a broader
reference or fallback.

Global items are not team/server knowledge unless a later server/RBAC contract
explicitly adds that mode. Workspace boundaries remain the isolation boundary
for unrelated problems.

## Lifecycle

Knowledge Catalog item lifecycle statuses are:

- `draft` - captured or proposed but not yet accepted as reliable project
  knowledge.
- `active` - reviewed and currently applicable.
- `stale` - likely outdated or needing refresh, but retained for traceability.
- `archived` - no longer active but retained for history.
- `rejected` - reviewed and rejected as incorrect, unsafe, irrelevant, or not
  useful.

Only `active` items are eligible for normal use. `draft`, `stale`,
`archived`, and `rejected` items may be shown for review, audit, or history,
but must not be treated as active guidance without operator action.

## Operations

Knowledge Catalog must support these explicit operations when implemented:

- `create` - create a new item from operator input or an approved visible
  generated draft.
- `edit` - manually change fields or content.
- `update` - apply a content, metadata, relationship, scope, or status change.
- `refresh` - re-check or revise an item against its source or current project
  state.
- `mark stale` - mark an item as outdated or suspect while preserving it.
- `archive` - remove an item from active use while retaining history.
- `delete` - remove an item when retention is not needed or allowed.
- `merge` - combine multiple reviewed items into one item while preserving
  source/relationship attribution.
- `split` - divide one item into multiple narrower items while preserving
  source/relationship attribution.

All operations are explicit and operator-visible. Generated drafts may suggest
changes, but generation does not create active project memory by itself.

Current partial implementation note: Knowledge Documents support explicit
create, edit/update, lifecycle/status changes, delete, import, Notes
promotion, draft acceptance, and source-backed refresh Queue task creation in
the Knowledge / Skills UI. Those operations remain Knowledge Document
operations; they do not complete the full Knowledge Catalog operation set,
merge/split model, relationship model, or standalone Catalog store.

## Agent And Queue Context Rules

Every use of Knowledge Catalog content in Workspace Agent, Agent Queue, Agent
Executor, provider, Context Pack, Runbook, validation, or future agent context
must be visible to the operator.

Knowledge Catalog content must not be silently injected into prompts, Queue
tasks, executor prompts, provider calls, validation commands, Terminal input,
JDBC queries, Git operations, or hidden tool context.

Future Agent or Queue use must show at least:

- item title;
- item type;
- scope label;
- lifecycle status;
- quickSummary;
- source or provenance;
- the reason the item is being included.

The operator must be able to review, remove, or reject selected Knowledge
Catalog context before it affects an agent, Queue item, provider request, or
execution path.

## Relationship To Knowledge / Skills / Evidence

The full Knowledge Catalog is a future product model that may organize
Knowledge Documents, Skills, runbooks, validation rules, known issues,
decisions, and other reviewed project memory under a single explicit catalog.

Current Knowledge Documents intentionally use some Catalog-compatible fields so
they can be reviewed, summarized, sourced, scoped, searched, attached to Queue
tasks, materialized for explicit Queue runs, or promoted from Notes without
becoming hidden memory or a complete Catalog item store.

It does not replace the current Knowledge / Skills MVP and does not make
existing Knowledge Documents, Skills, Notes, artifacts, evidence refs, Queue
tasks, Executor output, Terminal output, Git diffs, SQL results, provider text,
or files into catalog items automatically.

Notes are not Knowledge Catalog items by default. The current Notes surface can
explicitly promote a saved selected Note into a separate Knowledge Document
after operator action; the original Note remains unchanged.

Artifacts are not Knowledge Catalog items by default.

Evidence is not Knowledge Catalog content by default.

Queue tasks and Executor runs are not Knowledge Catalog items by default.

Promotion into Knowledge Catalog requires an explicit create or update
operation and visible operator review.

## Safety And Non-Goals

Knowledge Catalog must preserve Hobit's Workbench-first, widget-first,
approval-aware model.

This contract does not add:

- hidden AI memory;
- hidden prompt augmentation;
- hidden Workspace scanning;
- hidden filesystem scanning;
- automatic Notes, artifact, log, result, Git, JDBC, Terminal, Queue, Executor,
  provider, or file ingestion;
- hidden or unapproved Queue task creation;
- automatic execution;
- tool permission grants;
- provider tool calls;
- schema changes;
- Tauri commands;
- frontend widget behavior;
- backend storage behavior;
- server/team/RBAC behavior;
- embeddings or vector search;
- binary document parsing;
- folder watchers;
- full Knowledge Catalog implementation.
