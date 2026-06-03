# Agent Work Efficiency Contract

## Purpose

This contract makes small, focused, efficient agent work a first-class Hobit principle.

Hobit should help operators, coordinators, executors, reviewers, and future queue surfaces avoid over-broad tasks that run for 20+ minutes, touch too many layers at once, or hide scope growth until validation is expensive.

This is a documentation and product/domain contract only. It does not implement runtime behavior, UI, Tauri commands, storage, schema, Agent execution, Queue execution, Tool execution, or validation script behavior.

## Core Principle

Small focused blocks are the default.

One block should usually touch one primary layer:

- docs/contracts
- storage/schema
- app service
- Tauri/API
- frontend UI
- tests/hardening

Limited cross-layer integration can be acceptable for a medium block, but broad full-stack work should be decomposed before implementation.

## Task Size Guidance

Suggested task sizes:

- Small: 5-10 minutes, one primary layer, narrow validation.
- Medium: 10-15 minutes, limited cross-layer integration with clear boundaries.
- Large: must be split before implementation.

Large work is not forbidden. It must be represented as multiple small or medium blocks with explicit handoff points.

## Required Task Fields

Every agent task should include:

- scope
- non-goals
- execution budget
- validation profile plan
- stop/split rule
- expected changed layers

If a task does not include those fields, the Coordinator or operator should add them before execution when practical.

## Expected Changed Layers

The task should name the layers it expects to touch.

Examples:

- docs/contracts only
- storage/schema only
- app service only
- Tauri/API only
- frontend UI only
- tests/hardening only
- app service + focused Rust tests
- Tauri/API + frontend API types

If implementation needs unexpected layers, the executor should stop and propose a split unless the added layer is tiny, clearly required, and still inside budget.

## Stop And Split Conditions

An executor should stop and report a split plan when:

- the task touches schema, service, Tauri, and frontend at once
- the task needs new runtime behavior not requested in the prompt
- validation scope expands unexpectedly
- file-size warnings worsen or a large file needs more unrelated code
- implementation exceeds the execution budget
- requirements conflict with product, architecture, queue, template, tool, workspace, widget, or code organization contracts
- the work becomes hard to review as one commit
- a new dependency, storage model, backend command, runtime path, or broad abstraction becomes necessary

Stopping is not failure. It preserves reviewability and operator control.

## Validation Policy

Validation should match the size and risk of the block:

- Use `scripts/hobit/validate.ps1 -Profile fast` during iteration.
- Use `scripts/hobit/validate.ps1 -Profile changed` after focused edits.
- Use `scripts/hobit/validate.ps1 -Profile full` only when needed to prove
  cross-cutting architecture, Rust workspace-wide API, build configuration,
  validation tooling, or broad runtime/product-risk changes.

Do not duplicate full validation with repeated individual commands when the `full` profile already covers them, unless the prompt explicitly requests the duplicate commands or a failure needs focused diagnosis.

Fast validation is for iteration, not final acceptance.

For the permanent development-wide rule, see
`docs/DEVELOPMENT_EFFICIENCY_RULE.md`.

## Relationship To Toolbelt

The Hobit Toolbelt supports efficient agent work through:

- fast, changed, and full validation profiles
- changed-file summaries
- file-size checks
- module maps

Agents should use approved Toolbelt scripts instead of ad-hoc inspection scripts when the Toolbelt covers the need.

If a repeated inspection need is missing, propose a small deterministic Toolbelt addition instead of leaving temporary helpers in the repository.

## Coordinator, Executor, Reviewer Roles

The Coordinator decomposes broad work into small queueable blocks.

The Executor handles one focused implementation, audit, docs, validation, or hardening block.

The Reviewer validates the result, checks scope and contract compliance, and decides whether the next block should proceed, split, fix, rerun, or stop.

Coordinator and executor separation is part of efficiency. The executor should not inherit broad strategic discussion as implicit scope.

## Relationship To Agent Queue

Agent Queue items should carry efficiency metadata when broader queue support exists:

- task size: small, medium, or split-required
- scope summary
- expected changed layers
- execution budget
- validation profile plan
- stop/split rule
- non-goals
- reviewer notes about whether scope and budget were respected

Over-broad queue items should be split before execution. Queue execution, if implemented later, must not turn one large item into hidden multi-layer automation.

## Relationship To Template Library

Request Templates should include sections for:

- task size
- scope
- non-goals
- execution budget
- expected changed layers
- validation profile plan
- stop/split rule

Response Templates should report:

- whether scope was respected
- whether the budget was respected
- which validation profile was used
- whether stop/split conditions were encountered
- which follow-up split blocks are recommended

Templates must make efficient execution visible before work starts and reviewable after work completes.

## Relationship To Workspace Coordinator Agent

Future Workspace-aware Coordinator behavior should:

- identify over-broad operator requests
- suggest smaller blocks before execution
- choose or suggest a Request Template with budget and validation fields
- prepare queue items that are small enough to review
- flag conflicting requirements before execution begins
- recommend stop/split when a proposal crosses too many layers

The Coordinator should optimize for reviewable progress, not maximum scope per run.

## Relationship To Future UI

Future Hobit UI should surface:

- task size
- active execution budget
- expected changed layers
- validation profile plan
- stop/split rule
- split suggestions when work is broad

Future Agent Monitoring should flag over-broad work, budget overruns, unexpected validation expansion, and scope growth.

Future Agent Queue should make split-required items visually distinct from ready-to-execute small items.

## Safety And Product Boundaries

Efficient work supports safety:

- small diffs are easier to review
- focused validation is faster to run during iteration
- full validation remains available before commit
- stop/split behavior prevents hidden scope creep
- queue and template metadata keeps operator expectations visible

Efficiency must not be used to skip required validation, bypass approval, hide failures, or weaken product contracts.

## Non-Goals

This contract does not implement:

- frontend UI
- runtime behavior
- Tauri commands
- storage or schema changes
- Agent execution
- Queue execution
- Tool execution
- LLM calls
- validation script changes
- response validation
- queue metadata persistence
- template storage or editing
- background automation
- broad workflow engine

## Architecture Boundary

Future implementation must preserve:

- Workbench as the product center
- Agent proposes, operator controls
- focused queue items rather than hidden automation
- Request Templates and Response Templates as visible structures
- Toolbelt as the approved validation and inspection surface
- Code Organization rules for small focused modules
