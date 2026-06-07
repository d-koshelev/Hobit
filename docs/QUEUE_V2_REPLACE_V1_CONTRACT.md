# Queue V2 Replaces Agent Queue V1 Contract

## Purpose

This contract records the product decision that the old Agent Queue V1 visual
surface is no longer needed. QueueV2 becomes the Agent Queue widget
implementation.

This document is docs-only. It does not add frontend behavior, backend/runtime
behavior, storage/schema changes, scheduling, dependency execution, Agent
Executor changes, Knowledge changes, Git mutation, Terminal launch, hidden
automation, or widget insertion behavior.

## Product Decision

The old Agent Queue V1 visual surface can be removed. The Agent Queue widget
should render QueueV2 as its normal implementation.

QueueV2 is not a separate product widget, alternate catalog item, or
experimental mode. It is the replacement visual implementation for the
existing Agent Queue widget.

The QueueV2 replacement must preserve the existing Agent Queue component
identity needed by saved Workspaces and layouts. Existing saved Agent Queue
widgets must open QueueV2, not disappear, not be filtered out, and not require
a manual migration by the operator.

## Compatibility Requirements

Replacement must preserve:

- the existing Agent Queue widget definition id and component key where needed
  for saved layout compatibility;
- existing saved Workspace and Workbench widget instances;
- Queue domain API behavior;
- Queue task storage behavior;
- Queue runtime, scheduler, and Autorun semantics;
- explicit assigned-task start behavior;
- selected-task Executor run-link history behavior;
- Knowledge / Skills context attach, detach, materialization, warning, and
  prompt-preparation semantics;
- all existing explicit operator action boundaries.

QueueV2 replacement must not introduce a new widget id for Agent Queue unless a
separate explicit migration contract also preserves existing saved widgets.

## Deproductized UI

The normal Agent Queue UI should no longer include:

- a Board v2 versus Flow Map toggle;
- the old V1 Flow Map as a normal operator-facing view;
- the old dense sidebar/right-rail layout as the default or normal Queue
  surface;
- duplicate V1/V2 product modes that make QueueV2 appear optional or
  experimental.

Compatibility-only code may remain temporarily during the replacement sequence
when needed for audit, parity checks, or safe cleanup, but it must not remain a
normal product path after replacement acceptance.

## Preserved Safety Boundaries

QueueV2 replacement is a render-path and visual-surface decision only.

It must preserve:

- manual Queue mutations as explicit operator actions;
- explicit assigned-task start;
- explicitly armed desktop-local/current-session Autorun behavior where
  currently implemented;
- no hidden auto-run;
- no unarmed scheduler behavior;
- no auto-commit;
- no auto-push;
- no auto-finalize;
- no Git mutation from Queue;
- no Terminal launch from Queue;
- no hidden Workspace Agent, Knowledge, file, Git, JDBC, Terminal, Notes,
  Executor, or Runbook context access.

Critical Queue actions such as create, edit/save, status changes, assignment,
clear assignment, run assigned task, attach/detach Knowledge or Skills, review
materialized context, and Autorun arm/stop must remain explicit.

## Implementation Sequence

Future implementation should proceed in focused blocks:

1. Parity audit: compare the old V1 visual surface, current QueueV2 surface,
   and required Queue actions, including Knowledge context attach/materialize
   paths and Executor run-link visibility.
2. Action parity: close any QueueV2 gaps for critical explicit actions without
   changing backend/runtime/storage semantics.
3. Replacement render path: route the existing Agent Queue widget id/component
   to QueueV2 so saved Agent Queue widgets open QueueV2.
4. Cleanup, tests, and docs: remove or deproductize V1 Flow Map, the
   Board-v2/Flow-Map toggle, and dense right-rail/sidebar paths after parity is
   proven; update tests and docs to describe QueueV2 as Agent Queue.

Each implementation block must state whether it is docs-only, frontend-only,
API/storage, runtime, or validation work. Backend/runtime/storage/API changes
require a separate explicit prompt and contract update.

## Acceptance Criteria

Replacement acceptance requires:

- Agent Queue renders QueueV2 through the existing saved-widget-compatible
  Agent Queue identity.
- Existing saved Agent Queue widgets still load and show QueueV2.
- The V1 Flow Map is absent from the normal Agent Queue UI.
- The Board v2 versus Flow Map toggle is absent from the normal Agent Queue UI.
- The old dense sidebar/right-rail UI is removed or deproductized from normal
  operation.
- Critical Queue actions remain visible and explicit.
- Knowledge context attach/materialization behavior remains preserved.
- Queue domain API, storage, runtime/scheduler/Autorun semantics, Agent
  Executor run-link behavior, and component id/key compatibility are unchanged.
- No backend, runtime, scheduler, storage, schema, Git, Terminal, Workspace
  Agent, or Knowledge behavior changes are introduced by the replacement block.

## Relationship To Existing Contracts

`docs/QUEUE_V2_PRODUCT_CONTRACT.md`, `docs/QUEUE_V2_VISUAL_TARGET.md`, and
`docs/QUEUE_V2_STATE_MODEL.md` remain the QueueV2 product, visual, and state
model contracts.

`docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md` remains the Queue product model
and safety boundary for task organization, assignment, explicit run, and
non-hidden execution behavior.

`docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` remains the source of truth for
Queue task Knowledge / Skills attach and materialization semantics.

This contract supersedes any remaining assumption that QueueV2 is merely an
optional alternate visual mode beside Agent Queue V1.

## Non-Goals

This contract does not add:

- source code changes;
- frontend behavior changes by itself;
- backend/Tauri commands;
- storage/schema changes;
- Queue API changes;
- runtime or scheduler changes;
- dependency execution;
- automatic assignment;
- automatic acceptance or finalization;
- response parsing or validation engines;
- Git commit, push, or mutation behavior;
- Terminal execution;
- Workspace Agent hidden context access;
- Knowledge hidden memory or automatic attachment;
- Agent Executor runtime changes;
- new widget insertion behavior;
- a second Queue widget.
