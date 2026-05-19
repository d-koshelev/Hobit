# Agent Queue Contract

## Purpose

This contract defines Hobit's future Agent Queue as an operator-controlled agent command queue, command history, and review inbox.

Current contract navigation is defined in `docs/ACTIVE_CONTRACT_INDEX.md`.
This document is retained for Queue domain and proposal-review compatibility
context. For the current Queue task, assignment, and explicit Executor run
surface, prefer `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`,
`docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`, and
`docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

The Agent Queue is a queue/review/history surface for structured agent work. It should track planned, queued, running, completed, failed, and accepted agent commands or blocks, and connect Request Templates, Response Templates, Agent Run observability, Git review, artifacts, Notes/Notebook context, and Workspace Activity without turning Hobit into hidden automation.

This is primarily a product/domain contract. The current implementation includes
retained proposal-review compatibility paths plus manual Queue task,
assignment, explicit assigned-task start, handoff, and final-status
auto-refresh foundations. It does not implement automatic execution,
scheduler behavior, response parsing, response validation, Git mutation,
approval/apply behavior, Terminal launch, or real Agent runtime behavior.

Near-term Agent Queue boundaries are further defined in `docs/AGENT_SURFACE_MODEL.md`: Agent Queue organizes tasks and executor history, remains one Queue per Workspace, and must not become a universal workflow engine or execute queue items until explicit queue execution work is approved.

The future task model, dependency model, executor capacity model, and manual assignment direction are defined in `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`. Detailed manual Queue-to-Executor assignment rules are defined in `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`. Manual execution of an assigned Queue task through Agent Executor is governed by `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`. The current task and assignment foundations add storage/API state and compact assignment UI only; they do not add queue execution, dispatch, scheduler behavior, or Agent Executor runtime changes.

## Current Status

Agent Queue currently exists as an insertable Workbench widget with manual task
organization, visible Executor assignment, explicit assigned-task start, and a
retained persisted review-item path for Agent Chat local mock proposal results.

The current repository has:

- an Agent Queue widget rendered through the Widget Catalog, WidgetHost, and WidgetFrame path
- a singleton insertion guard that prevents adding a new Agent Queue widget when one already exists in the Workspace
- SQLite storage for narrow `agent_queue_items` review records created from valid Agent Chat local mock proposal results
- SQLite storage plus app/Tauri/frontend API methods for manual Workspace-scoped
  queue task create/list/read/update operations
- a frontend product UI for manual queue task create, list, select, edit,
  status, priority, and explicit save, including `running` as data only
- backend/storage/Tauri/frontend API methods for manual Queue-to-Executor
  assignment and assignment clearing
- frontend controls for manually assigning or clearing a visible Agent Executor
  slot on the selected task
- backend/Tauri/frontend API foundation for manually starting an assigned task
  in its assigned Agent Executor with an explicit repository root
- explicit Agent Monitoring action to create a `needs_review` / `pending_review` queue item from the currently displayed proposal result
- persisted proposal-review item compatibility paths scoped to the current
  Workspace Workbench
- explicit frontend Run assigned task UI for assigned tasks
- no background queue runner
- no response capture, parser, or validator
- no automatic executor runtime integration beyond the manual assigned-task
  start API
- no queue-linked Git review state
- no queue-linked Notes/Notebook behavior

Current related foundations include the retained proposal review item path,
manual queue task storage/API and product UI foundation, manual
Queue-to-Executor assignment API/UI foundation, explicit assigned-task start UI,
Queue-to-Executor handoff and final-status auto-refresh, retained Agent
Chat/Agent Monitoring proposal artifact compatibility paths, Git widget
status/diff review and explicit selected-file local commit UI, Notes
placeholder, widget-local Logs panel, and Workspace Activity summaries
described in `docs/ARCHITECTURE.md`.

The current Agent Queue persisted item selection is frontend-local UI state only. Creating a review item is explicit, uses a validated stored proposal result, and creates only review metadata; it does not execute, approve, apply, or mutate the source proposal.

The singleton guard prevents new duplicate Agent Queue widgets. Existing persisted duplicates are not automatically removed, migrated, or altered.

## Definition

Agent Queue is a Workbench capability for planning, tracking, running-state visibility, history, and review of agent commands or work blocks.

It has three linked roles:

- Command queue: an operator-controlled list of planned, ready, queued, sent, or running agent commands or blocks.
- Command history: a durable record of completed, failed, blocked, accepted, rejected, rerun, or archived agent commands or blocks.
- Review inbox: a structured place to inspect completed, failed, blocked, or response-received agent work before accepting, fixing, rerunning, following up, or archiving it.

The Agent Queue must not be defined as:

- a simple to-do list only
- a raw prompt list only
- command history without review state
- hidden automation
- unattended acceptance
- auto-push or auto-merge workflow
- a way to bypass tool approval, Git review, validation, or operator control

Agent Queue is visible today as an insertable Workbench widget with a narrow proposal-review inbox slice. Future broader Agent Queue behavior must follow `docs/WIDGET_CONTRACT.md`; it is optional capability surface, not the product center.

## Core Purpose

Agent Queue helps the operator:

- plan agent blocks
- track queued commands
- monitor running command state
- prepare structured requests
- review completed, failed, accepted, and blocked command history
- inspect Result Reports, Overview Logs, and Raw Logs
- review validation results
- review Git state after code blocks
- inspect produced artifacts
- connect relevant Notes/Notebook context
- decide accept, needs fix, rerun, follow-up, reject/archive, or push/review
- keep Workspace history coherent

The queue may later recommend an operator decision, but the operator makes the final decision.

## Queue Item / Agent Command / Agent Block

A Queue Item represents one reviewable unit of agent work. It may be an agent command, handoff, generated executor request, or numbered Agent Block under `docs/AGENT_OPERATING_MODEL.md`.

A future Queue Item may include:

- block number
- title
- goal
- status
- priority
- target executor, agent, tool, or manual assignee
- task size and execution budget
- expected changed layers
- validation profile plan
- stop/split rule
- command text or command summary when relevant
- Request Template reference
- applied request snapshot
- selected Response Template reference
- captured executor response
- Agent Run reference
- validation results
- Git review reference
- artifacts
- related Notes/Notebook context
- recommended operator decision
- operator decision state
- created and updated timestamps

The Queue Item is not the same as a reusable template. It is a concrete command or block instance in a Workspace or Project history.

## Work Efficiency Metadata

Future Queue Items should follow `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md`.

Each implementation or audit item should carry enough metadata to keep work small and reviewable:

- task size: small, medium, or split-required
- scope summary and non-goals
- expected changed layers
- execution budget
- validation profile plan
- stop/split rule
- reviewer note about whether scope and budget were respected

Over-broad queue items should be split before execution. A Queue Item that would touch schema, app service, Tauri/API, and frontend UI together should normally become multiple smaller items unless the operator explicitly approves a high-risk integration block.

Agent Queue must not turn one broad item into hidden multi-layer automation.

## Workspace Scope

Agent Queue is Workspace-scoped.

Agent Queue is a singleton per Workspace. The add-widget path must reject a new Agent Queue widget when the Workspace already has one, even if future multiple Workbenches exist. Existing persisted duplicates are preserved as-is and are not a migration target for the current guard.

Queue Items belong to one Workspace. A Queue Item may be shown in multiple Workbenches of the same Workspace if useful, but it must not appear in unrelated Workspaces unless the operator explicitly copies or duplicates it as a new item.

Different problem = different Workspace. Different surface for the same problem = additional Workbench. For the full multi-Workspace and multi-Workbench boundary, see `docs/WORKSPACE_CONTRACT.md`.

## Coordinator Relationship

Coordinator Chat is the primary operator-facing AI surface concept under
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`.

Coordinator may later propose Agent Queue items from approved Notebook content,
Git summaries, Agent Run reports, Template workflows, Workspace Activity,
JDBC/query evidence, or operator chat. Agent Queue must receive those items
only after a previewed proposal is approved by the operator or allowed by a
future explicit autonomy policy. Coordinator-created Queue Items must not
automatically launch execution, accept work, mutate Git, or hide the source
context used.

Agent Queue is not Coordinator Chat. It is not the main chat, reasoning
surface, or global orchestrator.

For the approved-context and proposal flow, see
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md` and
`docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

## Status Model

Queue status names are conceptual for now. Future implementation may refine names, but it must preserve explicit review and acceptance.

Suggested statuses:

- `planned`: block exists as an idea or draft.
- `ready`: request context and templates are prepared for execution or handoff.
- `queued`: command or block is waiting to be sent, launched, or handed off.
- `sent`: request was sent, copied, exported, or handed to an executor.
- `running`: executor or run is in progress.
- `response_received`: executor response exists but has not been reviewed.
- `needs_review`: result, validation, Git state, or artifacts need operator review.
- `accepted`: operator explicitly accepted the work.
- `needs_fix`: operator decided that a fix block or correction is required.
- `rerun_requested`: operator requested rerun of the block.
- `follow_up_created`: follow-up block was created from the result.
- `blocked`: work cannot proceed without input, approval, context, or environment.
- `failed`: execution, validation, response capture, or required processing failed.
- `archived`: item is no longer active but remains part of history when future storage supports it.

Acceptance must be explicit. A successful executor response, clean Git status, or passing validation does not automatically accept a Queue Item.

## Decision Model

Decisions should be explicit and auditable when future storage exists.

Suggested decision values:

- `accepted`
- `accepted_with_follow_up`
- `needs_fix`
- `rerun`
- `rejected`
- `deferred`

Hobit may later recommend a decision based on validation, Git state, response structure, or queue policy, but recommendations must not auto-accept work or hide risk.

## Operator Review Flow

When the operator returns after agent work, the expected future review flow is:

1. Open Agent Queue.
2. See items grouped by review status.
3. Select a completed, failed, or blocked item.
4. Read the summary card.
5. Inspect the original request and applied request snapshot.
6. Inspect the selected Response Template expectation.
7. Open Agent Monitoring Overview Log for fast comprehension.
8. Open Result Report as the main acceptance artifact.
9. Open Raw Log for debugging or audit when needed.
10. Inspect validation results, including failed and skipped checks.
11. Inspect Git Widget review for code changes when relevant.
12. Read related Notes/Notebook context.
13. Inspect artifacts.
14. Decide accept, needs fix, rerun, create follow-up, reject/archive, or push/review when appropriate.

The review flow must make failed validation, skipped validation, dirty Git state, untracked files, blocked execution, and already accepted history visible.

## Relation To Template Library

Agent Queue works with Request Templates and Response Templates defined in `docs/TEMPLATE_CONTRACT.md`.

Rules:

- A Queue Item may be created from a Request Template.
- A Queue Item should store or link to an applied request snapshot.
- A Queue Item should reference the selected Response Template.
- A Queue Item can link back to template ids, revisions, and variables used.
- Template edits must not silently mutate existing Queue Item request snapshots or historical response expectations.
- Coordinator flows may use Template Library to prepare future executor prompts.
- Applying a template must not automatically execute a Queue Item.
- Generated requests must remain reviewable before use.

The Template Library prepares and previews template assets. Agent Queue tracks concrete command or block instances, command history, and review state.

## Relation To Agent Run / Agent Monitoring

Agent Queue should link each executable Queue Item to an Agent Run or equivalent future run record when one exists. Agent Monitoring is the user-facing surface for observing that run.

Agent Monitoring provides:

- Raw Log for exact traceability
- Overview Log for fast operator comprehension
- Result Report as the final acceptance artifact

Rules:

- Queue cards may show high-level run status and the latest Overview Log step.
- Queue item detail should expose Overview, Result, and Raw views or links.
- Result Report is the main review artifact, but it does not replace validation or Git review.
- Raw Log must remain available for debugging and audit.
- Overview Log must not invent success or hide raw failures.
- A Queue Item must not be accepted solely because an Agent Run completed.

For run observability rules, see `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

## Relation To Git Widget

Code-related Queue Items should link to Git review context when available.

The Git Widget can show:

- repository state
- changed files
- branch
- clean or dirty status
- commit hash and message when available
- ahead/behind counts
- push-needed state
- validation association when future support exists

A Queue Item may summarize:

- clean/dirty state
- changed file count
- staged, unstaged, untracked, conflicted, or unknown groups
- commit hash and message if available
- branch ahead/behind state
- push needed
- linked validation status

Rules:

- Git Widget does not replace Result Report.
- Agent Queue must not hide dirty Git state, untracked files, skipped validation, or failed validation.
- Agent Queue must not perform automatic Git mutations.
- Commit, push, restore, revert, reset, clean, stash, and other Git mutations require explicit operator approval in the relevant future Git surface.
- Generated commit messages must remain reviewable before commit.

For Git review rules, see `docs/GIT_WIDGET_CONTRACT.md`.

## Relation To Notes / Notebook

Queue Items may link to operator notes.

Future Notes/Notebook use may include:

- review notes
- assumptions
- follow-up ideas
- decision rationale
- context gathered before or during agent work
- manual validation observations

Rules:

- Queue should not silently modify notes.
- Promoting note content into a request, review, or follow-up must be visible to the operator.
- Future AI-assisted note editing must remain explicit and approval-aware under the Notes/Notebook contract.
- Notes/Notebook context may support review, but it must not replace the applied request snapshot, Result Report, validation results, or Git review.

## Relation To Workspace Activity

Workspace Activity is the broad timeline. Agent Queue is the dedicated review/control surface.

Future Workspace Activity may record events such as:

- queue item created
- request prepared
- command queued
- executor started
- response captured
- validation passed
- validation failed
- Git review opened
- operator accepted
- fix requested
- rerun requested
- follow-up created
- item archived

Rules:

- Workspace Activity may summarize lifecycle events.
- Agent Queue should hold the actionable review state.
- Activity summaries must not replace queue item detail, Result Report, Raw Log, validation output, or Git review.

## Main View UI Direction

Future Agent Queue UI should show Queue Item cards grouped by status.

Suggested groups:

- Needs review
- Running
- Queued / Ready
- Failed
- Blocked
- Accepted
- Planned

Each card should show:

- block number and title
- status
- priority when useful
- validation summary
- Git summary when relevant
- commit and push state when relevant
- latest run summary or Overview Log step
- recommended operator action
- quick open/review controls

The main view should optimize for returning to a Workspace and understanding what needs operator attention first.

## Queue Item Detail UI Direction

Queue item detail should show linked sections:

- Request
  - Request Template reference
  - generated prompt snapshot
  - scope summary
  - do-not-change summary
- Execution
  - Agent Monitoring Overview Log
  - Raw Log link or expandable view
  - runtime status
- Result
  - Result Report
  - selected Response Template
  - response template validation when future validation exists
- Git Review
  - repository state
  - changed files
  - commit/push status
  - validation association when available
- Artifacts
  - files, reports, outputs, or other produced artifacts
- Notes
  - operator review notes
  - linked Notebook context when available
- Decision
  - accept
  - accept with follow-up
  - needs fix
  - rerun
  - create follow-up
  - reject/archive
  - defer

Decision controls must be explicit and must explain consequences when they affect Workspace history, Git state, files, or external systems.

## Unattended Execution Boundary

Future Agent Queue may support unattended execution only after strict gates exist.

Required gates include:

- Request Templates are explicit.
- Response Templates are selected.
- generated requests are reviewable before use.
- execution context is approved.
- tool permissions and risks are visible.
- logs are captured.
- Result Reports are captured.
- Result Reports are validated when future validation exists.
- Git state is reviewable for code changes.
- destructive or mutating actions remain approval-gated.
- queue history is auditable.

Current boundary:

- no unattended execution
- no automatic launch
- no auto-run-next-block
- no automatic acceptance
- no automatic commit
- no automatic push
- no automatic merge
- no hidden context injection

Unattended execution, if ever implemented, must still return work to an explicit operator review and acceptance step.

## Safety Principles

- Operator-controlled review.
- No hidden prompt mutation.
- No hidden context injection.
- No secret injection.
- No hidden agent execution.
- No hidden Git mutation.
- No discarded logs.
- Failed validation must be visible.
- Skipped validation must be visible.
- Dirty Git state must be visible.
- Untracked files must be visible.
- Generated requests must be reviewable.
- Captured responses must be reviewable.
- Result Reports must not hide raw failures.
- Queue history should be auditable when implemented.
- Recommendations must not auto-accept work.
- Agent proposes; operator controls.

## Future Data Concepts

Future implementation may introduce concepts such as:

- `AgentQueue`
- `QueueItem`
- `AgentCommand`
- `QueueItemStatus`
- `QueueItemDecision`
- `AgentCommandHistory`
- `AppliedRequestSnapshot`
- `CapturedResponse`
- `AgentRunLink`
- `GitReviewLink`
- `QueueArtifact`
- `ReviewNote`
- `FollowUpBlock`

These are conceptual except for the current narrow proposal-review item slice and manual task storage/API foundation. This contract does not define queue execution, response-capture APIs, Git review links, notes links, or runtime dispatch.

## Non-Goals

This contract does not implement:

- Agent Queue behavior beyond explicit review-only items created from persisted Agent Chat local mock proposal results and manual stored task records
- migration, deletion, or cleanup of existing duplicate Agent Queue widgets
- executor dispatch storage or migrations
- run-from-assignment behavior
- runtime Rust domain types beyond the current proposal-review and manual task DTO/service models
- runtime TypeScript types beyond the current proposal-review and manual task API types
- Tauri commands beyond proposal-review item create/read and manual task create/list/read/update/assign/clear
- Workspace API changes beyond proposal-review item create/read and manual task create/list/read/update/assign/clear
- automatic execution
- executor integration
- response capture
- response parser
- response validator
- template storage or generation
- Agent Run runtime
- Git mutation
- push or merge automation
- background queue runner
- secret or context automation
- runtime/tool execution changes
- widget behavior changes beyond the Agent Monitoring create-review action,
  retained proposal-review compatibility paths, and manual Queue task UI
- product behavior changes

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- Workbench remains the product center.
- Agent Queue is an optional Workbench capability, not the whole product.
- Queue Items are concrete command or block instances, not reusable templates.
- Template Library owns template browsing/preparation direction; Agent Queue owns concrete command queue, command history, and review state.
- Agent Monitoring owns the user-facing observability views; Agent Queue links and summarizes the underlying Agent Run state.
- Git Widget owns Git review/control; Agent Queue links and summarizes Git state.
- Notes/Notebook owns operator-authored notes; Agent Queue links review context without silently mutating notes.
- Workspace Activity owns broad event history; Agent Queue owns actionable review state.
- Agent/runtime integration must not make queueing an implicit hidden execution path.
- Tool and Git actions must remain explicit, visible, and approval-aware.
