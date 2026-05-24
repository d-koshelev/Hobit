# Workspace Coordinator Agent Contract

## Purpose

This contract defines the future Workspace-aware Coordinator Agent behavior for Hobit.

This area is deferred/reference from the active roadmap. For current
Coordinator Chat direction, use `docs/ACTIVE_CONTRACT_INDEX.md`,
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`, and
`docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`. Do not use this document as
implementation guidance unless a block explicitly targets Workspace-aware
Coordinator Agent behavior.

The Coordinator Agent is a future extension of the Coordinator surface inside
a Workspace. The current product direction treats Coordinator as the central
chat-based operator work surface: the place for planning, reasoning, task
drafting, outcome review, and deciding what should be promoted to Queue or
sent through an Executor path. Future Workspace-aware behavior may help the
operator reason over approved Workspace context and propose controlled actions
across Hobit components.

This is primarily a documentation and product/domain contract. Older Agent Chat
/ Agent Monitoring proposal-era paths remain compatibility/reference only and
are not the current product direction. Current Coordinator Chat behavior is
defined by `docs/CURRENT_WIDGET_SURFACE.md`: visible current-session chat and
proposal draft context only, `allowed_tools: []`, validated review cards, and
no hidden context access or widget tool execution. It does not implement agent
runtime behavior, persisted approved context models, executable action
proposals, action execution, proposal approval/apply behavior, or cross-widget
mutation.

## Current Status

Coordinator Chat is currently the central user-facing chat-based work surface.
It reuses the existing `interactive-agent` id/component for compatibility,
keeps chat state in the current frontend session, can request backend-owned
mock/local or configured HTTP JSON provider responses from visible
chat/proposal context only, and keeps `allowed_tools: []`. Older Agent Chat
proposal persistence and Agent Monitoring paths are retained
compatibility/reference paths, not the preferred current surface.

The current Coordinator preview:

- summarizes the operator prompt locally
- can include visible current-session chat and visible proposal draft summaries
- can show local UI-only plan cards with goal, steps, risks/notes, and
  suggested next actions from explicit visible chat text
- can draft one or more visible Queue task proposal cards from explicit
  planning text
- shows proposed next steps, required context, tool/action proposal notes, and safety notes
- marks proposed tool/actions as not executed
- does not read Notes body, Git status, Terminal output, widget logs, Queue details, files, environment variables, secrets, or hidden context
- does not persist chat messages, persist reusable context snapshots, create Queue items without a separate approved proposal handoff, execute actions, or mutate Workspace content

There is no implemented:

- agent runtime
- executable chat response or streaming
- persisted approved context models
- cross-widget context access beyond visible current-session chat/proposal context
- executable action proposal engine
- cross-widget action system
- response parser or validator
- automatic execution
- coordinator UI beyond the proposal-only preview

Current Coordinator Chat can create a Queue task only from an approved visible
create-Queue-task proposal and a separate explicit Create Queue task action.
Creating a Queue task is draft task creation only; it does not assign, run,
start Queue Autorun, launch Agent Executor, or execute the task.
Older Agent Monitoring proposal-to-Queue behavior remains compatibility only;
it is not the preferred current Queue creation path and does not approve,
apply, execute, or mutate the source proposal.

This contract describes future behavior only.

The first real AI/provider slice is further bounded by
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`. That contract defines the
proposal-only request artifact, approved context snapshot, relevant contract
pack, response artifact, provider boundary, and `allowed_tools: []` rule for the
first AI integration.

## Role

The Workspace-aware Coordinator Agent is a future coordination extension for
one active Workspace.

It may eventually:

- read explicitly approved Workspace and widget context
- help the operator reason about the current work
- decompose broad requests into small efficient blocks
- draft tasks and decide which work is large enough to promote to Queue
- assign task size, expected changed layers, execution budget, validation plan, and stop/split rules
- transform approved context into proposed actions
- preview those proposed actions before they are applied
- route approved actions through the owning Hobit component
- record auditable activity after a decision or applied change

It is not:

- a hidden autonomous agent
- a direct mutation engine
- a background runner
- a secret or unrestricted context collector
- a replacement for operator approval
- a generic chatbot with unrestricted Workspace access
- a shortcut around widget, tool, Git, queue, template, note, or execution contracts

## Core Principle

The Coordinator may read only explicitly allowed context.

The Coordinator may propose actions.

Hobit previews proposed actions.

The operator approves or rejects.

Only then does Hobit apply approved changes through the relevant component.

Required future sequence:

1. Read approved context.
2. Generate proposal.
3. Preview proposal.
4. Operator approves or rejects.
5. Apply approved action.
6. Record audit and Workspace Activity.

Rejected proposals must not mutate Workspace or widget state.

## Approved Context Model

Future Coordinator context access must be scoped, visible, minimal, and operator-approved.

Possible approved context sources include:

- Workspace metadata
- selected Notebook tab or selected Notebook content
- Agent Queue summary or selected queue item
- Agent Run Result Report, Overview Log, or approved Raw Log summary
- Git Widget status summary and changed-file summary
- Template Library selected templates
- Workspace Activity summary
- widget state, results, or logs explicitly selected by the operator

Rules:

- No reading all widgets by default.
- No hidden Workspace-wide context injection.
- No secret injection.
- No raw logs or large data sent by default.
- Context used by the Coordinator must be visible or reviewable.
- Context should be minimal enough to explain why it was included.
- Context access should identify the owning Workspace and source widget when applicable.
- Global notes, shared templates, or cross-Workspace assets must not be included unless explicitly selected or attached under their own contracts.

## Widget Context Boundaries

Each widget should expose only intentional context surfaces. Widgets must not become private data stores that the Coordinator reads implicitly.

Examples:

- Notebook may expose selected text, the active tab, or selected tab text.
- Git Widget may expose repository status summary and changed files, not raw repository contents by default.
- Agent Queue may expose queue item metadata, request summaries, decisions, and result summaries.
- Agent Run may expose Result Report, Overview Log, and Raw Log only when approved. Raw Log should not be included by default.
- Template Library may expose selected template definitions, selected previews, or applied template snapshots.
- Terminal output may expose run summaries or selected logs only with explicit approval when a real Terminal runtime exists.
- Script Runner output may expose configured run summaries or selected logs only with explicit approval when Script Runner exists.
- Workspace Activity may expose high-level events, not hidden full context from every widget.

Cross-widget use of context must be visible and operator-controlled. A widget may contribute context through Workbench state and events, but it must not directly couple itself to Agent Chat or another widget.

## Proposed Action Model

The Coordinator must not directly mutate widgets or Workspace state.

It creates proposed actions. Approved proposals are later applied by the owning component, service, or widget path.

Future conceptual action examples include:

- `createAgentQueueItems`
- `updateNotebookTab`
- `appendNotebookNote`
- `createFollowUpBlock`
- `generateRequestFromTemplate`
- `summarizeGitChanges`
- `attachResultReport`
- `linkQueueItemToGitReview`
- `createReviewNote`
- `markQueueItemNeedsFix`
- `prepareScriptRunnerConfig`
- `openWidgetOnCanvas`
- `sendWidgetToDock`

These examples are conceptual only. They do not define TypeScript types, Rust types, API DTOs, database schema, or implemented behavior.

## Action Proposal Requirements

Every future proposed action should include:

- action type
- target widget or component
- source context used
- human-readable summary
- payload preview
- risk and safety notes
- expected changes
- whether the action is reversible
- required operator approval controls
- affected Workspace and related widgets

The preview must be specific enough for the operator to understand what will change before approval.

## Notebook Tasks To Agent Queue Example

Example future workflow:

1. Notebook contains a list of tasks.
2. Operator asks Coordinator: "Create tasks from this list and put them in Agent Queue."
3. Operator approves the specific Notebook tab or selected text as context.
4. Coordinator shows it is reading that approved Notebook context.
5. Coordinator extracts proposed queue items.
6. Hobit previews the proposed Agent Queue additions.
7. Operator approves or rejects.
8. Agent Queue receives new items only after approval.
9. Workspace Activity records the decision and applied change.

The proposal preview should show:

- extracted tasks
- proposed block or queue item titles
- request template choice if known
- response template choice if known
- what will be added to Agent Queue
- source Notebook context used
- expected result of applying the proposal

Future UI may allow operator edits before approval, but editing is not required by this contract and is not implemented.

## Approval Model

No cross-widget mutation may occur without explicit operator approval.

Rules:

- Approval must be visible and intentional.
- Rejected proposals must not mutate state.
- Approved proposals should produce Workspace Activity entries.
- Widget-local logs may record relevant widget-level changes.
- Potentially destructive actions require stronger confirmation.
- Future automation may be allowed only under explicit policy and must remain auditable.
- Approval for reading context is separate from approval for applying a mutation.
- Tool, Git, script, terminal, external-system, file, or database actions remain governed by their own approval contracts.

## Audit And Logging

Coordinator actions should be auditable.

Future audit records should capture:

- who or what proposed the action
- source context used
- proposal payload
- operator decision
- applied changes
- timestamp
- related Workspace
- related widgets
- related Queue Item when applicable
- result or error

Workspace Activity may record high-level events.

Widget-local logs may record relevant widget-level changes.

Agent Run observability may later capture Raw Log, Overview Log, and Result Report for Coordinator reasoning sessions or executor handoffs. Raw trace, failed validation, and rejected proposals must not be hidden by summaries.

## Relationship To Agent Queue

Agent Queue is the explicit async execution pipeline for promoted/larger
Coordinator-created work items. It is not the default destination for every
idea, quick decision, or small operation discussed in Coordinator.

The Coordinator may propose Queue Items from:

- Notebook tasks
- Git review findings
- failed validation
- Result Reports
- operator chat
- Workspace Activity follow-ups
- selected template workflows

Queue Items remain operator-controlled. Creating a Queue Item does not launch execution, accept work, mutate Git, or apply changes automatically.

Coordinator-created Queue Items should follow `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`. The Coordinator should split broad requests before execution, mark over-broad items as split-required, and include scope, non-goals, expected changed layers, execution budget, validation profile plan, and stop/split rules in generated work items.

No automatic execution.

No automatic acceptance.

No automatic push, merge, or Git mutation.

For Agent Queue rules, see `docs/AGENT_QUEUE_CONTRACT.md`.

## Relationship To Notebook

Notebook can be a source of tasks, notes, review comments, snippets, JSON, diagrams, and follow-up ideas.

The Coordinator may help transform Notebook content into proposed Queue Items, summaries, follow-up blocks, review notes, or approved Notebook edits.

Rules:

- Notebook content must not be read by default.
- Selected Notebook context must be visible or reviewable.
- Coordinator must not rewrite Notebook content without approval.
- AI-assisted Notebook edits must be previewed and approved.
- Notebook source text remains the source of truth.

For Notes and Notebook rules, see `docs/NOTES_WIDGET_CONTRACT.md`.

## Relationship To Template Library

The Coordinator may use Request Templates and Response Templates to shape proposed executor blocks.

It may later:

- suggest a Request Template
- suggest a Response Template
- fill template variables
- generate prompt previews
- create applied Request Snapshots after approval

Generated requests must be previewable before use. Template snapshots should be preserved when applied. Template use must not become hidden prompt mutation or automatic execution.

Request generation should include efficiency fields defined in `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`, especially budget, expected changed layers, validation profile plan, and stop/split behavior. The Coordinator should recommend splitting a generated request when those fields reveal a large or high-risk block.

For template rules, see `docs/TEMPLATE_CONTRACT.md`.

## Relationship To Git Widget

The Coordinator may use approved Git summaries to propose follow-up work, review notes, Queue Items, or operator decisions.

Rules:

- Git context must come from approved Git Widget summaries or approved Git review state.
- Coordinator must not perform Git mutations directly.
- Commit, push, restore, revert, reset, clean, stash, and similar actions remain separate approval-gated Git Widget actions.
- Dirty Git state and failed validation must remain visible.
- Generated Git review notes or commit-message suggestions must remain reviewable before use.

For Git review rules, see `docs/GIT_WIDGET_CONTRACT.md`.

## Relationship To Agent Run

The Coordinator may review approved Agent Run Overview Log, Result Report, and Raw Log context.

It may propose follow-up blocks based on completed, failed, blocked, or rejected runs.

Rules:

- Raw Log access must be explicit when raw trace is needed.
- Result Report must not hide failed validation or skipped validation.
- Coordinator summaries must not replace the original Raw Log, Overview Log, or Result Report.

For run observability rules, see `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

## Relationship To Dock

The Coordinator may later propose presentation actions such as opening a widget on the Canvas or sending a widget to Dock.

These are UI presentation actions, not data mutations or new widget instances.

Rules:

- Presentation changes must be operator-visible.
- Coordinator must not silently move, hide, park, or duplicate widgets.
- Dock proposals must preserve WidgetInstance identity and Workspace ownership.

For Dock and widget presence rules, see `docs/WIDGET_CONTRACT.md`.

## Relationship To Script Runner

The Coordinator may later propose a configured Script Runner action, such as preparing a script path, working directory, and argv preview.

Script Runner execution must remain explicit and approval-gated.

Rules:

- Coordinator must not silently run scripts.
- Coordinator must not inject hidden arguments.
- Coordinator must not turn chat into a command prompt or shell-string execution path.
- Script Runner configuration and output context must follow `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`.

## Future UI Direction

Future Agent Chat / Coordinator UI should show:

- active context set
- what the Coordinator can read
- proposed actions
- source context used for each proposal
- payload preview before apply
- approve and reject controls
- risk and expected-change notes
- audit trail
- links to affected widgets

Example UI flow:

1. Operator asks Coordinator to create tasks from Notebook.
2. Coordinator shows "Reading Notebook tab: Tasks".
3. Coordinator shows extracted task list.
4. Coordinator shows proposed Agent Queue items.
5. Operator approves.
6. Agent Queue receives items.
7. Workspace Activity records the event.

The UI must avoid making Agent Chat look like an unrestricted command channel.

## Future Permission Model

Future permissions may include:

- read selected widget state
- read selected Notebook tab
- read selected Notebook text
- read Agent Queue summary
- read selected Queue Item
- read Git status summary
- read Agent Run Result Report
- read Agent Run Overview Log
- read approved Raw Log excerpt or summary
- read selected Template definitions
- propose Queue Item creation
- propose Notebook edits
- propose Git review follow-up
- propose template-generated requests
- propose presentation actions
- apply approved action

Permissions should be scoped per Workspace, session, action, or selected source where practical.

Long-lived permissions must remain visible and revocable when implemented. One-time permissions should be preferred for sensitive context, raw logs, external-system data, secrets, or large source material.

## Safety Principles

- No hidden context access.
- No hidden mutation.
- No hidden execution.
- No secret injection.
- No automatic acceptance.
- No automatic Git mutation.
- No automatic script execution.
- No silent Notebook edits.
- No reading all widgets by default.
- No raw logs or large data by default.
- All proposed actions must be previewed before apply.
- All applied actions must be auditable.
- The operator remains the final decision maker.

## Non-Goals

This contract does not implement:

- React UI
- Rust domain types
- TypeScript types
- storage schema or migrations
- Tauri commands
- Workspace API changes
- executable Agent Chat runtime
- agent runtime
- hidden, automatic, or tool-enabled LLM calls outside the explicit proposal-only Agent Chat provider boundary
- chat message persistence
- persisted or cross-widget context access implementation beyond selected current-view metadata
- context permission UI
- executable action proposal engine
- action execution engine
- Coordinator-driven Agent Queue item creation beyond the explicit review-only item path from persisted local mock proposal results
- Notebook editing
- Template generation
- Git association
- Dock behavior
- Script Runner behavior
- backend behavior
- product behavior changes

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- Workbench remains the product center.
- Workspace remains the isolation boundary for context and history.
- Widgets remain first-class optional capabilities.
- Widgets communicate through Workbench state and events, not direct coupling.
- The Coordinator proposes; the operator controls.
- Tool actions remain explicit, visible, and approval-aware.
- Runtime execution, Git mutation, script execution, and external-system updates remain governed by their own contracts.
