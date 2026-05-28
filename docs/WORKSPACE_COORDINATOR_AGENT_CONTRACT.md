# Workspace Agent Contract

## Purpose

This legacy-named contract defines the target Workspace Agent behavior for Hobit.
Coordinator was the previous user-facing name for the Workspace Agent surface.
The filename remains unchanged for compatibility with existing references.

This is a docs/product-architecture contract. It does not implement
Workspace Agent file access, tool execution, provider tool mode, storage/schema
changes, Tauri commands, queue behavior changes, server runtime, RBAC, or
runtime behavior. For current implemented Workspace Agent behavior, use
`docs/CURRENT_WIDGET_SURFACE.md`.

Workspace Agent is the foreground interactive AI agent widget inside a
Workspace. Multiple Workspace Agent widgets can exist in one Workspace; each
has independent current-session context/thread state and working directory.
New Workspaces and new Workspace Agent widgets start with no active Codex
thread and must not reuse threads from other Workspaces or agents. Codex thread
state is scoped to the current Workspace Agent widget, Workspace, and working
directory for the current frontend session only.
Chat is the interaction model, not the capability limit. The target Workspace
Agent can perform interactive work
inside the Workspace through controlled capabilities: filesystem and code
editing, code review, command and validation work, Terminal and SSH actions,
Git review/control, JDBC/database work, Notes, Skill Library/Knowledge,
Queue, Agent Executor, run history, and future Artifacts/Evidence.

This is primarily a documentation and product/domain contract. Older Agent Chat
/ Agent Monitoring proposal-era paths remain compatibility/reference only and
are not the current product direction. Current Workspace Agent behavior is
defined by `docs/CURRENT_WIDGET_SURFACE.md`: visible current-session chat and
proposal draft context only, `allowed_tools: []`, validated review cards, and
no hidden context access or widget tool execution. It does not implement agent
runtime behavior, persisted approved context models, executable action
proposals, action execution, proposal approval/apply behavior, or cross-widget
mutation.

## Current Status

Workspace Agent is currently the user-facing foreground chat-based agent
surface and compatibility foundation for the future foreground agent.
It reuses the existing `interactive-agent` id/component for compatibility,
keeps chat state in the current frontend session, can request backend-owned
mock/local or configured HTTP JSON provider responses from visible
chat/proposal context only, and keeps `allowed_tools: []`. Older Agent Chat
proposal persistence and Agent Monitoring paths are retained
compatibility/reference paths, not the preferred current surface.

The current Workspace Agent preview:

- summarizes the operator prompt locally
- can include visible current-session chat and visible proposal draft summaries
- can show local UI-only plan cards with goal, steps, risks/notes, and
  suggested next actions from explicit visible chat text
- can show local outcome-review cards from explicitly pasted Queue, Executor,
  or validation result text, with compact summary, success/failure/unclear/
  needs-review interpretation, risks/blockers, and next actions
- can receive explicitly attached, current-session visible run metadata from
  Queue latest-run/history rows and Agent Executor run-history/detail controls;
  the attachment appears in the Coordinator composer before Send and can be
  edited or removed
- can receive an explicit bounded excerpt selected by the operator from visible
  Agent Executor-owned run detail; raw Executor detail remains owned by Agent
  Executor and is not read automatically
- can receive explicitly attached bounded visible Agent Executor run-detail
  preview sections, including final response, stdout, stderr, validation
  output, and error summary previews, only after the operator clicks the
  section attach action; raw Executor detail remains Executor-owned and is not
  read automatically
- can receive an explicitly attached selected Skill from Skill Library as
  visible editable composer context containing only title, when to use,
  prerequisites, steps, validation, risks, tags, and review status
- can automatically search enabled workspace-local Knowledge Documents plus
  enabled local-global Knowledge Documents before an explicit Run with Codex.
  The latest composer message is the query; results are lexical, capped,
  visible in Direct Work details with Workspace/Global scope labels, and added
  only to that run's Codex prompt. This does not search Skills, Notes, hidden
  files, disabled documents, logs, Queue history, Executor artifacts,
  Evidence, Context Packs, team/server knowledge, or remote services.
- can draft one or more visible Queue task proposal cards from explicit
  planning text, with visible title, prompt, priority, execution policy, and
  draft/proposed status
- can draft follow-up Queue task proposal cards from explicitly pasted outcome
  text when the visible result suggests follow-up work; creation remains a
  separate explicit Create Queue task action
- can approve all visible Queue task drafts as local review state only
- can start an explicit local desktop Workspace Agent Codex run from the current
  composer message when the desktop Codex bridge is available and the operator
  clicks the Run with Codex primary composer action. Codex is presented as the
  foreground Workspace Agent. Direct Work remains the implementation/
  execution path: normal composer submission starts a foreground
  Workspace Agent-owned Codex Direct Work run and does not generate a mock/local
  assistant response for the same prompt. The working directory field defaults
  to `~`, the Tauri/backend path resolves `~` to the current user's home
  directory before launching Codex, and Workspace Agent-owned Direct Work runs pass
  Codex `--skip-git-repo-check` so the default home-directory mode can start
  from a non-Git directory. Agent Executor and Queue Direct Work do not skip
  that check by default. The operator can replace `~` with a project or repo
  folder by typing the path or using Browse to select one directory on
  supported desktop platforms where a directory dialog backend is available.
  The working directory can still be typed manually when Browse is unavailable
  or canceled. Browse updates only the visible working directory field; it
  does not scan folders, persist the path, or start Codex. The current bundled
  desktop directory picker remains the Windows native picker; non-Windows
  builds report a clear unsupported Browse error until the official Tauri
  dialog plugin or another supported backend is available.
  The first successful Codex stream captures the explicit
  `thread.started` `thread_id` when Codex emits it, stores it as
  current-session Workspace Agent widget state, and later Codex runs send resume
  requests for that explicit thread id. Resume requests do not use `--last`
  and send only the latest composer message rather than the full visible
  transcript. The operator can visibly start a new thread / reset the thread
  id, which clears the active thread and carried context unless the operator
  explicitly selects visible context transfer again before Run with Codex.
  Changing the working directory clears the current thread id so the next run
  starts fresh. Thread state is current-session only unless persistence is
  added later. Normal transcript entries show user prompts and Codex final
  responses, and the composer sits directly below the transcript without
  normal-view Agent details/provider diagnostics chrome. Workspace Agent shows
  one compact live activity line during Codex runs, such as the current
  command, file-read phase, or response preparation step; completed and failed
  runs keep that summary compact. Direct Work lifecycle details and raw
  technical data remain available in the collapsed Direct Work details/status
  area below the composer controls. Workspace Agent publishes current-session
  readable timeline events to the Agent Activity widget without inserting those
  events into chat. Agent Activity keeps raw event previews collapsed by
  default. Status, recent logs, Stop/cancel state when available, final result
  summary, and failures stay visible in Workspace Agent.
- shows proposed next steps, required context, tool/action proposal notes, and safety notes
- marks proposed tool/actions as not executed
- does not read Notes body, Git status, Terminal output, widget logs, Queue
  details or run history, Executor logs/results/artifacts, Skill Library
  Skill records, disabled Knowledge Documents, files, environment variables,
  secrets, Context Packs, or hidden context; Attach to Workspace Agent sends
  only the visible metadata, selected excerpt, selected Skill fields, or
  bounded visible preview section the
  operator attached, not raw payloads, full Executor logs, hidden Skill
  metadata, or unrelated Workspace state
- does not persist chat messages, persist reusable context snapshots, create
  Queue items without a separate approved proposal handoff, start Queue
  Autorun, launch Agent Executor, or run hidden actions. Coordinator-owned
  Codex runs are the explicit foreground exception: they can let Codex read
  files, write code, and run commands inside the operator-provided working
  directory without creating Queue tasks or using Agent Executor.

There is no implemented:

- direct Workspace Agent filesystem read/write capability outside explicit
  Workspace Agent-owned Codex runs
- direct command or SSH execution from Workspace Agent outside explicit
  Workspace Agent-owned Codex runs
- direct JDBC capability execution from Workspace Agent
- direct Git mutation from Workspace Agent
- unified permission or policy UI
- full provider tool mode
- audit emission or persistence
- foreground agent runtime beyond the current chat/proposal/attachment preview
- executable chat response or streaming
- persisted approved context models
- cross-widget context access beyond visible current-session chat/proposal context
- executable action proposal engine
- cross-widget action system
- response parser or validator
- automatic execution
- coordinator UI beyond the current chat/proposal/attachment preview

Current Workspace Agent can create a Queue task only from an approved visible
create-Queue-task proposal and a separate explicit Create Queue task action.
Creating a Queue task is draft task creation only; it does not assign, run,
start Queue Autorun, launch Agent Executor, or execute the task.
Workspace Agent-owned Codex runs do not create Queue tasks, do not start Queue
Autorun, and do not change Agent Executor repo-root/task configuration
behavior.
Mock/local is an explicit local fallback, not connected AI, and remains
available when Codex is unavailable or the fallback chat path is used.
Older Agent Monitoring proposal-to-Queue behavior remains compatibility only;
it is not the preferred current Queue creation path and does not approve,
apply, execute, or mutate the source proposal.

The current Queue/Executor async execution path exists independently of
Workspace Agent direct capability execution: Queue tasks can be assigned to a
visible Agent Executor and explicitly started, and Queue Autorun can be
explicitly armed from Queue under its current-session limits.

This contract describes target behavior only beyond the current preview.

The first real AI/provider slice is further bounded by
`docs/AI_INTEGRATION_READINESS_CONTRACT.md`. That contract defines the
proposal-only request artifact, approved context snapshot, relevant contract
pack, response artifact, provider boundary, and `allowed_tools: []` rule for the
first AI integration.

## Role

The Workspace-aware Coordinator Agent is the foreground interactive agent for
one active Workspace.

It may eventually:

- read explicitly approved Workspace and widget context
- read selected Workspace files and project state within an approved boundary
- propose and apply approved file edits with diff preview
- perform code review over approved files, diffs, validation output, and run
  results
- run approved commands, validation, Terminal, or SSH actions through explicit
  capability boundaries
- use approved JDBC/database capabilities through the Database / JDBC widget
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

## Coordinator Versus Executor

Coordinator is the foreground interactive agent. It works with the operator in
the active Workspace, can eventually use all approved Workspace capabilities,
and decides when a piece of work should remain interactive or be delegated.

Agent Executor is the async/background worker for bounded Queue task prompts.
It owns queued execution logs, results, run history, cancellation, and review
visibility for Executor runs. Executor is not the only agent that can do work
and must not be treated as the capability ceiling for Coordinator.

Agent Queue is for promoted, larger, delayed, long-running, or overnight work.
Creating a Queue Item does not launch execution, accept work, mutate Git,
write files, or apply changes automatically.

## Coordinator Modes

Target Coordinator modes:

- Chat / Reasoning mode: conversation, clarification, planning, result review,
  and decision support.
- Workspace Read mode: approved reads of selected files, Notes, Git summaries,
  JDBC connector/result context, Queue tasks, Executor run summaries, Skills,
  Knowledge, Artifacts, Evidence, or widget state.
- Workspace Action mode: approved local mutations such as file edits, Notes
  updates, Queue task changes, Git local actions, or artifact/evidence updates.
- Command / Validation mode: approved command, validation, Terminal, SSH, or
  tool actions with explicit target, working directory or remote scope, caps,
  and visible logs/results.
- Async Delegation mode: promotion of larger or long-running work through
  Queue and Agent Executor.

Current Workspace Agent implements only chat/reasoning, proposal drafts,
visible attachments, Skill attach, Queue/Executor metadata attach, selected
Executor excerpt / preview attach, pasted result review, and explicit
proposal handoff for the supported safe proposal types.

## Safety And Action Levels

Future capability use must classify every Coordinator action:

- Safe read: bounded metadata, selected summaries, selected visible text, or
  capped previews with no secrets or sensitive raw payloads.
- Sensitive read: selected source files, raw logs, raw outputs, database rows,
  large Notes, diffs, credentials-adjacent metadata, or other material that
  requires explicit inclusion, capping, and redaction rules.
- Mutation: local changes such as file edits, Notes updates, Queue task
  changes, Git local commits, or artifact/evidence updates.
- Remote/database action: JDBC queries, SSH commands, remote commands,
  external API calls, or other external-system effects.
- Async execution: Queue/Executor delegation or future durable runner starts.

The Workspace/project boundary is required. Actions must be visible,
attributable, logged or log-ready, and tied to the owning capability. Dangerous
actions require confirmation or an explicit future policy. There must be no
silent unbounded scanning, silent mutation, silent remote or database
execution, secret leakage into provider prompts, or hidden Queue/Autorun
starts.

## Near-Term Roadmap

1. Coordinator capability registry.
2. Coordinator read selected Workspace files.
3. Coordinator propose/apply file edits with diff preview.
4. Coordinator command/validation action.
5. Coordinator JDBC widget capability.
6. Coordinator SSH/Terminal capability.
7. Policy/approval model.
8. Background delegation through Queue/Executor.

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
- selected Workspace files or directories within an approved project boundary
- selected Notebook tab or selected Notebook content
- Agent Queue summary or selected queue item
- Agent Run Result Report, Overview Log, or approved Raw Log summary
- Git Widget status summary and changed-file summary
- JDBC connector metadata, query text, or capped results approved for context
- Skill Library selected Skill records
- Template Library selected templates
- Workspace Activity summary
- widget state, results, or logs explicitly selected by the operator
- future Artifacts/Evidence explicitly approved as AI-readable context

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

- Filesystem/code may expose selected files, bounded directory listings,
  proposed diffs, and approved apply-edit operations.
- Notebook may expose selected text, the active tab, or selected tab text.
- Git Widget may expose repository status summary and changed files, not raw repository contents by default.
- Agent Queue may expose queue item metadata, request summaries, decisions, and result summaries.
- Agent Run may expose Result Report, Overview Log, and Raw Log only when approved. Raw Log should not be included by default.
- Template Library may expose selected template definitions, selected previews, or applied template snapshots.
- Terminal output may expose run summaries or selected logs only with explicit approval when a real Terminal runtime exists.
- SSH may expose selected connection targets, command previews, and capped
  output only with explicit approval and secret-safe handling when SSH exists.
- JDBC may expose selected connector metadata, query previews, capped results,
  and explain output only through the JDBC widget capability boundary.
- Skill Library may expose selected Skill guidance only after operator attach
  or approved context selection.
- Script Runner output may expose configured run summaries or selected logs only with explicit approval when Script Runner exists.
- Workspace Activity may expose high-level events, not hidden full context from every widget.

Cross-widget use of context must be visible and operator-controlled. A widget may contribute context through Workbench state and events, but it must not directly couple itself to Workspace Agent or another widget.

## Proposed Action Model

The Coordinator must not silently or unilaterally mutate widgets or Workspace
state.

It creates proposed actions or approved capability action requests. Approved
mutations are applied through the owning component, service, or widget path.

Future conceptual action examples include:

- `readSelectedWorkspaceFiles`
- `proposeFileEdit`
- `applyApprovedFileEdit`
- `runValidationCommand`
- `runTerminalCommand`
- `runSshCommand`
- `runApprovedJdbcQuery`
- `readSkill`
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

## Relationship To Agent Executor

Agent Executor is the background/async worker for Queue-owned execution. It
receives bounded Queue task prompts, runs them through the explicit Executor
runtime path, and owns queued execution logs, results, review state, and run
history.

Workspace Agent may review approved Executor metadata, selected excerpts, preview
sections, Result Reports, Overview Logs, and Raw Log excerpts when the operator
selects or approves them. Workspace Agent may delegate larger work to Queue and
Executor, but Executor ownership of async runs does not limit Workspace Agent's
foreground Workspace capability set.

Current Workspace Agent-owned Codex runs reuse the Codex Direct Work runtime as a
foreground Workspace Agent-owned run. Direct Work remains the execution path, not
the primary UI concept. This does not require a visible Agent Executor widget,
does not change Agent Executor's explicit repo-root/task configuration
behavior, and does not create Queue tasks or start Queue Autorun.
Queue and Agent Executor remain the async/background path for promoted or
larger work; Workspace Agent Codex is the foreground brain/work action.

## Relationship To Notebook

Notebook can be a source of tasks, notes, review comments, snippets, JSON, diagrams, and follow-up ideas.

Workspace Agent may help transform Notebook content into proposed Queue Items, summaries, follow-up blocks, review notes, or approved Notebook edits.

Rules:

- Notebook content must not be read by default.
- Selected Notebook context must be visible or reviewable.
- Workspace Agent must not rewrite Notebook content without approval.
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

Future Coordinator UI should show:

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

The UI must avoid making Coordinator look like an unrestricted command channel.

It must also avoid making Coordinator look like a passive chat box. The target
surface should show the current Coordinator mode, approved context set,
available capability providers, pending approvals, action status, and links to
the owning widgets for logs/results.

## Future Permission Model

Future permissions may include:

- read selected Workspace file
- read selected Workspace directory summary
- propose file edit
- apply approved file edit
- run approved validation command
- run approved Terminal command
- run approved SSH command
- run approved JDBC query
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
- No silent unbounded filesystem scanning.
- No silent remote, SSH, Terminal, command, or database execution.
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
- executable Coordinator runtime
- agent runtime
- hidden, automatic, or tool-enabled LLM calls outside the explicit proposal-only Coordinator provider boundary
- direct Coordinator filesystem read/write capability outside explicit
  local desktop Coordinator-owned Codex runs
- direct Coordinator command, Terminal, SSH, JDBC, Git, Queue, Executor, or
  artifact capability execution outside explicit local desktop
  Coordinator-owned Codex runs
- chat message persistence
- persisted or cross-widget context access implementation beyond selected current-view metadata
- context permission UI
- unified policy/approval UI
- audit emission or persistence
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
