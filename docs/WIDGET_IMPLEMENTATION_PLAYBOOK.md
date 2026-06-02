# Widget Implementation Playbook

## Purpose

This playbook defines the contract-first development workflow for new Hobit
widgets and major widget changes.

It exists to prevent feature-first implementation from growing into oversized
mixed-responsibility files, unclear state semantics, UI-driven behavior, and
manual-only validation. Future widget work must plan the product scenario,
Widget API, state machine, UI sections, semantic tests, and file boundaries
before implementation starts.

This is a docs-only architecture/process contract. It does not implement
frontend UI, backend or Tauri commands, Rust or TypeScript types, storage or
schema changes, runtime behavior, Agent Queue execution, Workspace Agent
capabilities, Finder, or test automation.

## Core Principle

Contracts come before implementation.

For new widgets and major widget changes:

- define the product scenario before the UI;
- define the Widget API before UI complexity;
- define the state machine before stateful UI;
- define semantic tests before manual UI checking;
- define file and component budgets before files become too large.

## 1. Contract-First Rule

Before any new widget or major widget change, write and approve a widget
contract packet.

The packet must include:

- product scenario;
- widget API contract;
- state machine contract;
- UI composition contract;
- action/event contract;
- semantic test contract;
- file/component budget;
- out-of-scope list.

Approval means the operator or reviewer can see what user problem is being
solved, what state and actions exist, what UI sections will be built, what
tests will prove the behavior, and what will intentionally not be implemented.

Implementation must not begin from a large component sketch, broad mock UI, or
runtime shortcut when the contract packet is missing.

Use `docs/WIDGET_CONTRACT_TEMPLATE.md` for the reusable contract shape.

## 2. Definition Of Ready

Implementation may start only when these items are clear:

- primary user and happy path;
- widget API actions and events;
- state transitions;
- UI sections;
- acceptance criteria;
- semantic tests;
- file boundaries.

If any required item is missing, the next block should be docs/planning only or
a narrow discovery block. Do not compensate for unclear contracts by adding
extra UI state, extra debug panels, hidden execution, or broad helper modules.

## 3. Definition Of Done

A widget implementation block is complete only when:

- behavior matches the approved contract;
- requested validation passes or failures are reported honestly;
- semantic tests pass or are explicitly deferred in the contract/report;
- file-size budget is respected;
- docs/contracts are updated if behavior changed;
- no unrelated behavior is changed.

Done means the implemented behavior is reviewable against the contract. It does
not mean every planned future capability was built.

## 4. Widget Architecture Rule

Widgets are API-backed capabilities, not isolated UI panels.

Each widget should expose or be contractually ready to expose:

- identity;
- state snapshot;
- capabilities;
- actions;
- events;
- evidence/logs;
- semantic test hooks;
- safety policy.

The visible React component is one presentation of the widget. It must not be
the only owner of product semantics, state transitions, action definitions, or
testability.

Widget APIs should be app-native Workspace/widget APIs. They are not shell
commands, DOM events, direct storage edits, localStorage mutations, or private
React state access.

## 5. Workspace Agent Rule

Workspace Agent is the coordinator.

Future Workspace Agent coordination must interact with widgets through
app-native APIs and approved capability boundaries.

Workspace Agent must not use these as product/runtime control paths:

- shell commands;
- DOM clicks or scraping;
- direct SQLite or storage edits;
- filesystem hacks;
- localStorage or browser storage mutation;
- frontend component imports that bypass Workspace routing.

The development agent may still use normal repository tools to edit Hobit when
the operator asks for code changes. That is separate from Hobit's product
runtime model.

## 6. Queue Rule

Agent Queue is singleton per Workspace.

Queue is the shared task ledger for a Workspace:

- one canonical Queue state per Workspace;
- multiple Workbenches or future views must point to the same Queue;
- Queue views must not fork task state, assignment, run links, history, or
  review decisions;
- existing duplicate persisted Queue widgets are compatibility concerns, not
  multiple canonical queues.

Future multi-coordinator support should be considered in Queue and Widget API
contracts. MVP coordination has one primary Workspace Agent Coordinator for
Queue and Widget API coordination.

## 7. State Machine Rule

State semantics must be defined before UI implementation.

For a stateful widget, the contract must document:

- allowed states;
- meaning of each state;
- allowed transitions;
- transition causes;
- who or what may request each transition;
- events emitted on transitions;
- invalid transitions;
- review/finalization semantics;
- failure and blocked semantics.

Queue planning examples:

- `Draft`: task exists but is not ready to run.
- `Queued`: task is accepted into the Queue ledger.
- `Running`: execution has started through an approved Executor path.
- `Execution complete`: the Executor finished producing output.
- `Report ready`: a bounded result/report exists for review.
- `Awaiting coordinator review`: the Coordinator should inspect outcome,
  evidence, validation, or follow-up needs.
- `Finalized`: the operator or approved policy has accepted the task outcome
  and no further Queue action is required.
- `Failed`: execution or validation failed.
- `Blocked`: visible dependency, missing input, policy, environment, or review
  condition prevents progress.

Important Queue semantics:

- Execution complete is not Accepted.
- Report ready is not Finalized.
- Awaiting coordinator review is not Done.

State labels may be mapped to implementation-specific enum names, but the
product semantics must remain explicit. A successful run must not silently
become operator acceptance.

## 8. UI Composition Rule

Large UI surfaces must be split into named sections before implementation.

Each section should have one responsibility, its own data needs, and clear
ownership. Section names should appear in the contract before the component
tree grows.

Example Queue right rail sections:

- Overview
- Prompt
- Agent activity / Result
- Coordinator decision
- Timeline
- Developer details

Large components should be extracted by durable section responsibility, not by
incidental helper type. UI sections must preserve the WidgetHost/registry
model and must not couple widgets directly to each other.

## 9. File/Component Budget

Budgets apply before implementation starts.

Default budgets:

| Surface | Target | Warning | Hard stop |
| --- | --- | --- | --- |
| React component | 300-500 lines | 700 lines | 1000 lines |
| View-model/helper | 400-600 lines | project-specific | project-specific |
| Test file | project-specific | 900 lines | project-specific |
| CSS surface | project-specific | 600 lines | project-specific |

Rules:

- If a file crosses a warning threshold, the next block should be a
  refactor/split unless explicitly justified.
- If a React component crosses the hard stop, feature work must stop until it
  is split.
- New feature code should not be added to files already over warning threshold
  unless the block is explicitly a contained completion or split plan.
- File splitting must preserve behavior unless the block explicitly says it is
  changing behavior.

Use the Hobit Toolbelt file-size checks before adding code to known large
surfaces.

## 10. Semantic Testing Rule

Workspace Agent and future test harnesses should test widgets through semantic
APIs.

Preferred semantic test model:

- create task;
- run task;
- read report;
- assert state;
- apply coordinator decision.

Tests should call app-native widget actions, observe events and safe state
snapshots, assert state/output/safety metadata, and emit a compact report.

Manual UI clicking is useful for smoke checks, but it must not be the primary
test model for widget semantics. Tests should not depend on private React
state, DOM scraping, direct SQLite mutation, shell output parsing, or hidden
filesystem rewrites as substitutes for Widget APIs.

## 11. Block Hygiene

Each implementation block must declare:

- mode;
- objective;
- allowed changes;
- forbidden changes;
- validation commands;
- expected report;
- commit boundary.

For widget work, the block should also declare:

- target display level: Minimal, Operational, or Full / Expert;
- expected changed layers;
- semantic tests in scope;
- file/component budget;
- stop/split rule.

One block should usually touch one primary layer. If implementation needs
unexpected layers, runtime behavior, schema changes, new dependencies, or broad
cross-widget coupling, stop and propose a split.

## 12. Refactor Policy

Refactor blocks must be behavior-preserving unless explicitly marked
otherwise.

Do not mix feature changes with file splitting.

A refactor/split block should:

- preserve public behavior and existing tests;
- keep imports and ownership boundaries clear;
- move code by responsibility;
- leave unrelated product behavior unchanged;
- avoid new abstractions that are not needed for the split;
- run validation appropriate to the touched layer.

If a bug is discovered during a refactor, report it and split the fix into a
separate behavior-changing block unless the operator explicitly expands scope.

## Relationship To Existing Contracts

This playbook complements these contracts:

- `docs/WORKSPACE_WIDGET_API_CONTRACT.md` for Widget API shape and semantic
  testing model.
- `docs/WORKSPACE_AGENT_COORDINATOR_MODEL.md` for the MVP Coordinator and
  Queue singleton model.
- `docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md` for Minimal, Operational,
  and Full / Expert display levels.
- `docs/AGENT_WORK_EFFICIENCY_CONTRACT.md` for small focused blocks and
  stop/split rules.
- `docs/CODE_ORGANIZATION_CONTRACT.md` for module and file organization.
- Widget-specific contracts for domain behavior.

`docs/CURRENT_WIDGET_SURFACE.md` remains authoritative for current implemented
widget behavior.

## Non-Goals

This playbook does not implement:

- new widgets;
- Finder;
- Widget API runtime;
- semantic test runner;
- frontend UI;
- backend or Tauri commands;
- Rust or TypeScript types;
- storage or schema changes;
- Queue runtime behavior;
- Workspace Agent tool execution;
- provider tools;
- autonomous Coordinator behavior;
- hidden execution or hidden mutation.
