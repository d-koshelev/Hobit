# Evidence/Sources Contract

## Purpose

This contract defines Hobit's future Evidence/Sources trust layer.

Evidence/Sources exists so Coordinator Chat, widgets, Agent Queue, and Agent
Executors can distinguish raw widget outputs, operator-approved evidence,
source metadata, and AI interpretation. It is not hidden context collection and
does not grant Coordinator access to all Workspace data.

This document is docs/contracts only. It does not implement frontend UI,
backend or Tauri commands, storage/schema changes, Coordinator runtime, AI
provider integration, widget tool execution, JDBC execution, result grids,
Queue or Executor behavior, Git mutation, Terminal or PTY work, Runbook
integration, or secrets storage.

## One-Sentence Rule

Evidence is explicit, reviewable, scoped, capped, redacted, and
operator-approved before AI can use it.

## Terms

### Source

A source is provenance metadata for where information came from.

Examples:

- a JDBC connector and query
- a Git repository root and diff/status read
- an Agent Executor run result
- a validation run
- a selected Note
- a Queue task
- a Terminal one-shot result
- a Runbook step note
- an external document or URL later

A source is not automatically AI-readable. Source metadata can be visible to
the operator without exposing full raw content to AI.

### Evidence

Evidence is a captured, bounded, operator-reviewable artifact derived from a
source.

Examples:

- a capped SQL result sample
- capped `EXPLAIN` output
- a Git diff summary
- a validation result summary
- a selected note excerpt
- an Agent Executor final result
- a Queue task status snapshot

Evidence must include provenance, capture time, ownership scope, content
limits, redaction state, and AI sharing approval state.

### AI Interpretation

AI interpretation is analysis, summary, explanation, or recommendation created
by an AI model.

AI interpretation is not evidence unless it is explicitly stored as an
interpretation artifact and labeled as such. AI interpretation must not be
presented as raw fact, source output, database truth, validation output, or Git
state.

## What Evidence/Sources Is

Evidence/Sources is:

- a future trust layer for grounded work
- a provenance model for widget outputs
- an approval gate for AI-readable context
- a way to separate captured evidence from AI interpretation
- a compact context source for Coordinator and future agent runs
- a review surface for what was shared, capped, redacted, and used

## What Evidence/Sources Is Not

Evidence/Sources is not:

- hidden Workspace-wide context access
- automatic ingestion of widget state, logs, notes, files, repositories, or SQL
  results
- a secret store
- a database crawler
- a runtime execution engine
- a replacement for widget ownership
- permission for Coordinator to bypass widget capability boundaries
- permission to send full raw outputs to AI

## Evidence Lifecycle

Future evidence items should follow this conceptual lifecycle:

1. A widget or operator identifies a source output as an evidence candidate.
2. The candidate is capped, redacted, summarized, or rejected according to the
   owning widget's policy.
3. The operator reviews the candidate and its provenance.
4. The operator approves it as evidence, rejects it, or keeps it local-only.
5. The operator separately approves whether the evidence may be included in AI
   context.
6. Coordinator or an Agent Executor may reference approved evidence by id,
   summary, or capped content according to policy.
7. Any AI interpretation created from evidence is labeled separately and links
   back to the evidence ids it used.

Capturing evidence and sharing evidence with AI are separate decisions.

## Minimal Future Evidence Item Model

A future evidence item should conceptually include:

- `evidence_id`
- `workspace_id`
- `workbench_id`
- `source_kind`
- `source_widget_instance_id` when widget-owned
- `source_record_id` when the source has a run, result, query, note, task, or
  equivalent record
- `title`
- `summary`
- `content_kind`
- `content_preview`
- `content_ref` or bounded stored payload when storage is implemented
- `captured_at`
- `captured_by`
- `source_timestamp` when different from capture time
- `redaction_status`
- `cap_status`
- `approval_status`
- `ai_context_status`
- `ai_context_approved_at`
- `ai_context_approved_by`
- `token_estimate`
- `sensitivity_level`
- `retention_policy`

This model is conceptual only. It does not define a Rust type, TypeScript type,
API DTO, Tauri command, table, migration, or storage schema in this block.

## Source Kinds

Initial source kinds should include:

- `jdbc_query_result`
- `jdbc_explain_output`
- `git_status`
- `git_diff_summary`
- `git_commit_result`
- `agent_executor_run_result`
- `agent_executor_validation_result`
- `agent_executor_diff_summary`
- `agent_queue_task`
- `note`
- `terminal_result`
- `runbook_step`
- `external_source_future`
- `ai_interpretation`

Each source kind must define ownership, provenance, capping, redaction, and AI
sharing rules before implementation.

## AI Context Approval Rules

Coordinator and future agent runs must not automatically receive evidence.

Rules:

- AI-readable context must be explicit and inspectable.
- The operator must be able to see what evidence is included.
- Evidence inclusion must show source, summary, token estimate, sensitivity,
  redaction status, and cap/truncation status.
- Evidence may be included by reference, compact summary, capped excerpt, or
  bounded structured payload.
- Full raw content requires explicit operator approval and must still obey
  caps and redaction.
- Evidence approved for one request must not imply blanket future approval.
- Evidence from one Workspace must not leak into another Workspace.
- Widget-local logs, full raw outputs, credentials, and hidden widget state are
  not AI context by default.

Future autonomy policy may allow low-risk evidence reuse only within explicit
Workspace, widget, source kind, sensitivity, token, and time bounds.

## Redaction, Secrets, And Capping

Secrets must never enter AI prompts.

Rules:

- Database passwords, tokens, provider keys, raw connection strings, and
  credential-bearing environment values must be rejected or redacted.
- JDBC connector evidence may include masked connector metadata, query text,
  schema, capped samples, and result summaries only when approved.
- Terminal output must be capped and treated as potentially secret-bearing.
- Git diffs and file content excerpts must be capped and may need redaction.
- Notes may contain secrets and must be selected and approved explicitly.
- Large SQL results, logs, diffs, transcripts, and note collections must be
  capped, summarized, or split before evidence approval.
- Truncation must be visible to the operator and to any AI context pack.
- If a source cannot be made safe through redaction and capping, it must be
  rejected for AI context.

## Widget Ownership Boundaries

Widgets own their source outputs and policies.

Rules:

- JDBC owns query results, `EXPLAIN` output, connector metadata, SQL approval,
  query limits, and secret isolation.
- Git owns repository status, diff summaries, and explicit local commit
  results.
- Agent Executor owns live logs, final results, diff summaries, validation,
  and history.
- Agent Queue owns task metadata, assignment state, run handoff state, and
  final-status snapshots.
- Notes owns selected note content and save state.
- Terminal owns one-shot command results and output caps.
- Runbook owns local procedural step state and local evidence notes until a
  future implementation connects it to this trust layer.

Coordinator may request or reference evidence only through approved widget
capability and evidence boundaries. Coordinator does not own widget internals.

## Coordinator Usage Boundaries

Coordinator may:

- ask the operator to approve evidence for context
- summarize approved evidence
- cite evidence ids or source summaries
- compare multiple approved evidence items
- propose follow-up widget actions based on evidence
- create Queue tasks that reference approved evidence summaries later

Coordinator must not:

- silently ingest all widget state
- silently read all notes, logs, SQL results, diffs, task records, or terminal
  output
- use secrets or credential-bearing content
- treat AI interpretation as source evidence
- claim an uncaptured source output was verified evidence
- use evidence from another Workspace
- mutate widgets or external systems through evidence references

Evidence makes Coordinator more grounded; it does not make Coordinator a hidden
automation or hidden data-access channel.

## Future UI Expectations

Future UI should make provenance and AI sharing visible.

Likely surfaces:

- evidence capture affordance on selected widget outputs
- evidence review drawer or panel
- source metadata and capture timestamp
- redaction/capping indicators
- AI context inclusion checkbox or approval action
- token estimate and sensitivity marker
- list of evidence used by a Coordinator response or agent run
- clear label for AI interpretation vs captured evidence
- copy/reference id for evidence citations

The first UI slice should be minimal and review-oriented. It should not add a
large knowledge-management surface, automatic source crawling, hidden context
packing, or broad search.

## Relationship To JDBC

JDBC results and `EXPLAIN` output are high-value evidence candidates.

JDBC evidence must preserve:

- connector identity using non-secret metadata
- environment
- SQL text or SQL hash according to policy
- row/result limits
- timeout
- result truncation state
- captured error or result summary
- whether data was shared with AI

No JDBC credential, raw connection string, full unbounded result, write SQL, or
schema crawl may enter evidence or AI context by default.

## Relationship To Agent Executor And Queue

Agent Executor results, validation output, and diff summaries can become
evidence candidates after a run finishes.

Queue tasks may reference evidence later, but Queue does not own live
execution logs. Agent Executor remains the source of execution visibility.
Queue-to-Executor handoff does not automatically approve Executor logs or
results as AI context.

## Relationship To Git

Git status, diff summaries, and commit results can become evidence candidates.

Git evidence must keep repository root explicit and operator-approved. Git
evidence does not permit auto-commit, push, reset, clean, checkout, restore, or
hidden repository scanning.

## Relationship To Notes

Selected Notes can become evidence candidates only after operator approval.

Notes are not hidden Coordinator memory. Full note collections must not be sent
to AI by default. AI-generated summaries saved as notes should remain labeled
as AI interpretation unless separately supported by captured source evidence.

## Recommended Implementation Slices

Recommended sequence:

1. Evidence/Sources storage/API foundation for Workspace-scoped evidence items
   with no AI provider integration.
2. Minimal evidence capture from selected widget outputs, starting with one
   low-risk source such as Agent Executor validation or Git diff summary.
3. Evidence review UI with provenance, caps, redaction status, and approval.
4. Coordinator context pack preview that can include approved evidence by
   summary/reference only.
5. JDBC result and `EXPLAIN` evidence capture after JDBC execution exists.
6. Evidence citations in Coordinator responses.
7. Token economy and context-budget integration.

Each slice must remain explicit, reviewable, capped, redacted, and
operator-approved.

## Non-Goals

This contract does not implement:

- frontend UI
- backend or Tauri commands
- storage/schema changes
- Coordinator runtime
- AI provider integration
- widget capability runtime
- JDBC SQL execution
- result grid
- SQL formatter
- `EXPLAIN`
- secrets storage
- automatic AI context inclusion
- hidden Workspace scanning
- hidden widget state access
- Queue or Executor behavior changes
- Git mutation
- Terminal PTY
- Runbook integration
- medical or healthcare scope
