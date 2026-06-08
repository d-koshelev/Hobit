# Queue V2 Replaces Agent Queue V1 Status

## Purpose

This document records the docs-only status that QueueV2 has replaced the old
Agent Queue V1 visual UI as the Agent Queue widget implementation.

This status record does not add frontend behavior, backend/runtime behavior,
storage/schema changes, Queue API changes, scheduling, dependency execution,
Agent Executor changes, Knowledge changes, Git mutation, Terminal launch,
hidden automation, or widget insertion behavior.

## Status

QueueV2 is now the Agent Queue surface.

The existing Agent Queue widget identity remains the compatibility boundary for
saved Workspaces and layouts. Saved Agent Queue widgets still load through the
existing widget definition id/component path and render the QueueV2 surface.
QueueV2 is not a separate catalog widget, alternate product mode, or optional
experimental view.

The V1 Flow Map toggle has been removed from the normal Agent Queue UI. The
old V1 visual shell, dense sidebar/right-rail layout, and old Flow Map product
path are removed or deproductized from normal operator flow.

Runtime, backend, storage, Queue API, Agent Executor, Knowledge / Skills
context, and Autorun semantics are unchanged by this replacement status.

## Preserved Behavior

QueueV2 replacement preserves these existing Agent Queue behaviors:

- explicit selected-task run actions through the existing Queue-to-Executor
  handoff where available;
- explicit review and finalization actions, including accept/no-change,
  needs-changes, follow-up, blocked, failed/rejected, and rollback-required
  markers where currently wired;
- explicit Knowledge / Skills context attach, detach, materialization, warning,
  and prompt-preparation behavior;
- selected-task run-link history and Executor-owned run detail boundaries;
- Queue logs and readable activity/detail surfaces where currently available;
- new task creation and manual refresh flows;
- explicit edit/save/cancel, assignment, clear assignment, dependency, tag,
  priority/order, report review, follow-up, and deletion actions where
  currently wired;
- saved Workspace compatibility through the existing Agent Queue widget
  identity.

All Queue mutations remain explicit operator actions. Card click, lane
placement, popup opening, details review, visual counts, capacity summaries,
and activity display do not start work or finalize work by themselves.

## Removed Or Deferred

The following are no longer normal Agent Queue product paths:

- the old Agent Queue V1 visual shell;
- the old dense task-list/sidebar/right-rail Queue UI;
- the Board v2 / Flow Map toggle as normal UI;
- the old Flow Map product path as a normal operator-facing mode.

Compatibility-only remnants may remain temporarily only for audit, fallback,
or safe cleanup. They must not be treated as the current Agent Queue product
surface.

Deferred behavior remains deferred:

- backend scheduler, durable reconnect/resume, server worker, dependency
  execution, hidden auto-dispatch, hidden auto-run, automatic acceptance,
  automatic finalization, response parser/validator, Git mutation, Terminal
  launch, and Workspace Agent hidden context access.

## Safety Boundary

QueueV2 replacement is a visual implementation replacement only. It preserves:

- no hidden auto-run;
- no unarmed scheduler behavior;
- no auto-commit;
- no auto-push;
- no auto-finalize;
- no Git mutation from Queue;
- no Terminal launch from Queue;
- no hidden Workspace Agent, Knowledge, file, Git, JDBC, Terminal, Notes,
  Executor, or Runbook context access;
- no runtime/backend/storage/API behavior change.

## Manual Smoke Checklist

Use this checklist after opening the app manually:

- Load an existing Workspace that already has an Agent Queue widget.
- Confirm the saved Agent Queue widget opens and renders QueueV2 rather than
  disappearing or requiring migration.
- Create a new Agent Queue widget if the current Widget Catalog supports it.
- Select a Queue task.
- Open the selected-task popup/details surface.
- Run the selected task explicitly through the visible Queue-to-Executor action
  where the task is assigned and the required execution inputs are present.
- Review a completed/report-ready task explicitly.
- Accept or mark no-change explicitly where available.
- Verify no task starts from card selection, lane rendering, popup opening,
  refresh, or visual status changes.
- Verify Queue Autorun is not armed or started unless the operator explicitly
  arms/starts it through the existing controls.
- Verify the old Board v2 / Flow Map toggle is absent from the normal Agent
  Queue UI.
- Verify the old V1 Flow Map is absent from the normal Agent Queue UI.
- Verify Knowledge context attach/materialization, logs/activity, new task, and
  refresh flows remain available where currently wired.

## Relationship To Contracts

`docs/QUEUE_V2_REPLACE_V1_CONTRACT.md` remains the replacement contract.
`docs/QUEUE_V2_PRODUCT_CONTRACT.md`, `docs/QUEUE_V2_VISUAL_TARGET.md`, and
`docs/QUEUE_V2_STATE_MODEL.md` remain the QueueV2 product, visual, and state
model references. `docs/CURRENT_WIDGET_SURFACE.md` remains the source of truth
for current implemented widget behavior.
