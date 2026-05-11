# Agent Operating Model

## Purpose

This contract defines Hobit's agent operating model for coordinated project work.

Hobit remains operator-controlled. Agents may help coordinate, implement, audit, validate, and report work, but they must do so through explicit roles, scoped requests, visible outputs, and approval-aware actions.

This is a documentation and product/domain contract only. It does not implement agent runtime behavior, storage, UI, template editing, or automatic execution.

## Current Status

The current repository has no implemented agent runtime, no automatic agent execution, no template editor, and no response validation engine.

The frontend Template Library placeholder may show a static planned Coordinator Workflow preview, but it does not implement coordinator UI, executor thread/task integration, request generation, response capture, response validation, Git-response association, or agent execution.

`docs/AGENT_QUEUE_CONTRACT.md` defines the future Agent Queue as an operator-controlled agent command queue, command history, and review inbox. The frontend has a static Agent Queue placeholder preview, but queue storage, real queue item state, background execution, response capture, response validation, and executor integration are not implemented yet.

The project workflow currently uses numbered blocks, focused executor tasks, validation, one commit or one no-commit audit, and a final response governed by `docs/AGENT_RESPONSE_CONTRACT.md`. This contract documents that operating model so future Hobit product and agent work can model it explicitly.

Future agent/task execution observability is defined in `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`. The frontend has a static Agent Monitoring placeholder previewing Raw Log, Overview Log, and Result Report sections, but real run start, runtime logs, response parsing, response validation, overview summarization, and executor integration are not implemented yet.

Future Workspace-aware Coordinator Agent behavior is defined in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`. Agent Chat / Coordinator may later read explicitly approved Workspace or widget context and propose previewed actions, but no context access, proposal engine, action approval flow, or cross-widget mutation is implemented yet.

## Core Rule

Coordinator agents and executor agents are separate roles.

The coordinator may be long-lived and context-rich. Executor agents must be short-lived and scoped to one concrete block.

Strict workflow:

- New block means a new executor thread/task.
- One executor thread/task means one block.
- One block means one focused commit or one no-commit audit.
- Executor prompts must be generated from Request Templates.
- Executor responses must follow Response Templates.
- The coordinator may be long-lived.
- Executor threads should be short-lived and disposable.
- Strategic planning belongs to the coordinator unless a block is explicitly a plan-only executor block.
- The executor should inspect current code before editing.
- The executor should not invent scope beyond the concrete request.
- The executor should report skipped or failed validation honestly.
- After a commit or no-commit audit is complete, the next block must start a new executor thread/task.

## Coordinator Agent

A Coordinator Agent is the long-lived coordination role for a Workspace or Project.

The coordinator may:

- keep Workspace and Project context
- maintain task history and next-step plans
- break work into numbered blocks
- choose the Request Template for a block
- choose the Response Template for a block
- fill Request Template variables
- generate the concrete executor prompt
- preview and revise generated requests with the operator
- send or copy the request to an executor
- capture executor final responses
- validate response structure against the selected Response Template
- decide accept, fix, rerun, or next block with operator control
- keep the block queue, completed block history, and follow-up plan coherent
- summarize Workspace/Project context for future executor tasks

The coordinator must not:

- read widget or Workspace context that was not explicitly approved
- hide material request instructions from the operator
- silently mutate generated prompts after operator review
- directly mutate widgets or Workspace state without a previewed and approved proposal
- bypass approval requirements
- treat strategic discussion as executor implementation context unless the generated block explicitly includes that context
- treat executor output as accepted until validation and operator review allow it
- do broad implementation work directly unless explicitly acting as the executor for a focused block

## Executor Agent

An Executor Agent is the short-lived implementation, audit, documentation, validation, or repair role for one block.

The executor receives one concrete request generated from a Request Template and executes only that focused block.

The executor must:

- start from a fresh thread/task for each new block
- treat the concrete request as the authoritative scope
- avoid strategic discussion outside the block
- avoid broad refactors unless explicitly requested
- inspect current code and relevant contracts before editing
- preserve existing contracts and product boundaries
- run requested validation
- report skipped or failed validation honestly
- create one focused commit when the block changes files
- perform one no-commit audit when the block is audit-only and needs no changes
- return the final response using `docs/AGENT_RESPONSE_CONTRACT.md` and the selected Response Template

The executor must not:

- reuse a long strategic conversation as implicit scope
- add unrelated features
- expand into adjacent blocks without explicit request
- skip required validation silently
- claim success when required validation, implementation, or commit steps failed
- bypass operator approval for tools, actions, external effects, or protected operations

## Why This Rule Exists

Separating coordinator and executor roles exists to:

- reduce token usage in executor tasks
- reduce stale context and misleading carryover
- reduce accidental scope creep
- keep strategic planning separate from implementation execution
- improve validation and final-report consistency
- make each block easier to review, replay, rerun, or audit
- keep Workspace and task history clean
- make commits focused and easier to revert or inspect
- make agent work structured, repeatable, safe, observable, and fast

## Allowed Exceptions

The same executor thread/task may continue only when the block is still unfinished.

Allowed continuations:

- fix validation errors discovered before completing the same block
- rerun requested validation for the same block
- make a tiny correction before commit for the same block
- answer a narrow clarification required to finish the same block
- answer a clarification about its just-produced diff
- amend the same block's final response when the coordinator requests a formatting fix before acceptance

Not allowed:

- starting the next numbered block in the same executor thread/task
- adding strategic planning to an implementation block after completion
- reusing the executor thread after a commit or no-commit audit is complete
- treating follow-up ideas as permission to expand the committed block

## Relation To Templates

Request Templates structure executor prompts.

Response Templates structure executor reports.

The coordinator selects and applies both templates for a block. Applying a Request Template creates a concrete Request Snapshot for that executor task. Applying a Response Template creates the expected response/report contract for that block.

The executor receives the concrete Request Snapshot, not an evolving template. Executor final responses are checked against the selected Response Template when future response validation exists. Future edits to the source Request Template or Response Template must not silently mutate the active executor request, captured response, or historical block record.

For template asset rules, see `docs/TEMPLATE_CONTRACT.md`.

## Relation To Agent Run Observability

Future executor runs should expose observability as defined in `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

Expected mapping:

- executor runtime events and tool output feed Raw Log
- operator-readable execution progress feeds Overview Log
- executor final response feeds Result Report
- coordinator response validation checks the Result Report against the selected Response Template

Overview Log and Result Report must not hide failed raw execution, skipped validation, or blocked states.

## Relation To Workspaces

The coordinator role is associated with the durable Workspace or Project context.

Workspace is the isolation boundary for agent work. Different problems must use different Workspaces; additional Workbenches are only additional surfaces for the same Workspace problem. The coordinator must not mix Queue Items, Agent Runs, request/response snapshots, Git review, notes, artifacts, decisions, or approved context across unrelated Workspaces.

Future Workspace history should be able to show:

- block queue
- generated Request Snapshots
- selected Request Template and revision
- selected Response Template and revision
- executor response captures
- validation checklist state
- validation command results
- Git commits linked to the block
- widget logs
- produced artifacts
- commit or no-commit audit result
- follow-up blocks
- coordinator accept, fix, rerun, or next-block decisions

The coordinator uses Workspace context to generate precise executor requests. The executor should receive only the minimal context needed for the block.

The future Workspace-aware Coordinator context and cross-widget proposal model is defined in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

This does not require implementation in the current block.

For the multi-Workspace and multi-Workbench boundary, see `docs/WORKSPACE_CONTRACT.md`.

## Relation To Agent Queue

Future Agent Queue behavior is defined in `docs/AGENT_QUEUE_CONTRACT.md`.

The Agent Queue should hold concrete coordinator-created Queue Items for planned, queued, running, completed, failed, blocked, accepted, and review-needed agent commands or blocks. It should link applied request snapshots, selected Response Templates, Agent Run observability, validation results, Git review state, artifacts, Notes/Notebook context, and operator decisions without automatically accepting or mutating work.

## Relation To Git Widget

After executor code work, the future Git Widget can surface repository review as defined in `docs/GIT_WIDGET_CONTRACT.md`.

The coordinator may use Git Widget state, executor final response content, validation results, and commit metadata to decide accept, fix, push, revert, or follow-up.

Git review remains operator-controlled. The operating model must not introduce hidden commit, push, reset, clean, or discard behavior.

## Future UI Behavior

Future Hobit UI may support:

- Coordinator workspace view
- block queue
- Request Template picker
- Response Template picker
- generated request preview
- variable filling and required-context checks
- copy/send to executor controls
- executor response capture
- response validation checklist
- missing-section and warning display
- accept, fix, rerun, and next-block controls
- Git review companion after code blocks
- task history that links applied templates, requests, responses, validations, commits, logs, artifacts, and decisions
- Raw Log, Overview Log, and Result Report views for agent/task runs

Future UI rules:

- The human remains the operator.
- Generated requests must be visible before use.
- Response validation must be visible and explain missing or malformed sections.
- Sending a request to an executor must not silently execute tools or external actions.
- Fix/rerun controls must preserve block identity unless the operator explicitly starts a new block.

## Non-Goals

This contract does not implement:

- agent runtime behavior
- storage schema or migrations
- Rust domain types
- TypeScript types
- React UI
- Tauri commands
- coordinator UI
- Agent Queue behavior beyond the static placeholder preview
- Agent Queue storage
- template editor UI
- response validation engine
- automatic agent execution
- hidden prompt mutation
- secret injection
- approval bypasses
- background automation
- runtime/tool execution changes
- new widgets
- product behavior changes

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- The Workbench remains the product center.
- Agents do not own the UI.
- Coordinator and executor activity must be visible through Workbench surfaces when implemented.
- Tool and file-changing actions must remain explicit, visible, and approval-aware.
- Templates guide requests and responses; they do not create an implicit execution path.
