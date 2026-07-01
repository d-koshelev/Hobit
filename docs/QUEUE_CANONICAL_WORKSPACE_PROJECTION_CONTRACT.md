# Queue Canonical Workspace Projection Contract

## Purpose

This contract defines the canonical Queue workspace projection used by
Workbench and recovery/open surfaces.

It does not add scheduler behavior, worker execution, storage schema, Queue
task mutation, run-link mutation, review/finalization behavior, `widget_runs`,
visualization, collaboration, marketplace, or direct database probing.

## Status

Current for Workspace Queue presence, task-count, running/stale indicator,
control-state, visible-view, and recovery/open affordance projection.

## Ownership

Queue state is canonical in backend/domain/storage.

UI surfaces are projections and explicit control affordances. They may render
the backend-owned projection, call existing widget open/restore actions, and
show current operator actions. They must not own Queue lifecycle truth, infer
Queue emptiness from mounted widgets, probe SQLite directly, or treat a hidden
or missing Queue view as empty Queue state.

A missing visible Queue module does not mean the Workspace Queue is empty.
Queue tasks, run links, workflow/action rows, worker evidence, review/final
decisions, control state, and prompt-pack materialized tasks remain Workspace
state even when no Agent Queue widget is mounted.

## Canonical Projection

The Workspace workbench-state API exposes one backend-owned Queue recovery
projection. Current field names are:

- `workspaceId`: Workspace that owns the projected Queue state.
- `queueTaskCount`: count of durable Workspace Queue task rows.
- `runningTaskCount`: count of durable Queue tasks currently marked running.
- `staleRunningCandidateCount`: indicator count for running Queue tasks with
  running backend-owned `queue_local` run links that may need review.
- `hasVisibleQueueView`: Workbench/widget presentation metadata only. It is
  not Queue domain truth.
- `canonicalQueueWidgetId`: the deterministic singleton Queue view id when one
  exists, otherwise `null`.
- `controlState`: backend-owned Queue control state when available, otherwise
  `null`.
- `recoveryAvailable`: true when saved Queue task state exists and no visible
  Queue view exists.
- `canRestoreQueueView`: true when the restore/open action has a safe target:
  either a hidden canonical Queue view exists or saved Queue task state exists
  and no visible view exists.
- `recoveryReason`: one of `no_queue_state`,
  `visible_queue_view_exists`, `hidden_queue_view_exists`,
  `queue_state_without_visible_view`, or `unknown`.

Rules:

- The projection is backend-owned.
- Frontend code may render the projection but must not recompute canonical
  Queue state from local widget arrays.
- `hasVisibleQueueView` is UI/workbench projection metadata, not Queue domain
  truth.
- `queueTaskCount > 0` is enough for the backend projection to make recovery
  available when no visible Queue view exists.
- `queueTaskCount == 0` does not require a saved-tasks recovery affordance.
- Running and stale-running counts are indicators only. They must not trigger
  automatic recovery, dispatch, worker start, retry, review, finalization, or
  task mutation.

## Restore / Open Semantics

The restore/open action must be singleton-aware:

- If a visible Queue view already exists, restore/open focuses or safely
  no-ops without creating a duplicate view.
- If a hidden canonical Queue widget exists, restore/open restores that widget
  instance.
- If no Queue widget exists but backend Queue task state exists, restore/open
  creates exactly one `agent-queue` singleton view.
- If no Queue state and no Queue view exists, the action is unavailable or
  fails safely with a clear reason.
- Restore/open must never create duplicate Queue views.
- Restore/open must never mutate Queue tasks, run links, evidence, review
  messages, completion/failure decisions, workers, control state, Terminal,
  Git, Agent Executor, or `widget_runs`.

## Prompt Pack / Dogfood Relationship

Prompt-pack materialization creates canonical Workspace Queue task rows. The
projection can reveal and recover/open that state even when no visible Queue
module is mounted. Recovery/open remains only a view affordance; it does not
resume, start, retry, dispatch, validate, accept, fail, or otherwise execute
dogfood work.

## Non-Goals

This contract does not add:

- scheduler, autodispatch, durable worker, or backend runner behavior;
- real worker execution, dogfood resume/start/retry, or provider diagnostics;
- `widget_runs` or synthetic widget runs;
- visualization, collaboration, marketplace, or server coordination UI;
- direct frontend/Node SQLite probing as a canonical API;
- frontend-owned Queue lifecycle or frontend-owned Queue truth;
- Queue task, run-link, evidence, review, decision, worker, Terminal, Git, or
  Executor mutation.
