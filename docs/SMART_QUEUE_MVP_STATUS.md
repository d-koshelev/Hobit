# Smart Queue MVP Status

## Purpose

This document records the current Smart Queue MVP foundation status after the
frontend smoke coverage block. It is a status artifact, not a new runtime
contract.

## Contract References

- `docs/QUEUE_SINGLETON_CONTRACT.md`
- `docs/SMART_QUEUE_WORKFLOW_CONTRACT.md`
- `docs/QUEUE_DEPENDENCY_STATE_CONTRACT.md`
- `docs/QUEUE_COORDINATOR_CONTRACT.md`
- `docs/QUEUE_ASSISTANCE_PROTOCOL_CONTRACT.md`
- `docs/CURRENT_WIDGET_SURFACE.md`

## Implemented Foundation

- The product Queue surface is the saved-compatible `agent-queue` widget.
- The strict Workspace Queue singleton is represented by registry metadata and
  frontend repair/add-path coverage; `queue-v2` is not a separate insertable
  Queue widget.
- Prompt-pack import preview/materialization can create Queue task drafts,
  dependency edges, visible settings summaries, import warnings, and validation
  issues for a singleton Workspace Queue target.
- Prompt-pack materialization records whether the Queue is Paused or Active,
  but it does not start workers by itself.
- Frontend eligibility models distinguish Ready, Waiting dependency, Blocked,
  Failed, Closed, Review, Needs decision, Cancelled, dependency gates, and
  dependency-derived blockers.
- Dependency smoke coverage now verifies a linear `001 -> 002 -> 003` pack:
  Paused Queue materializes tasks without auto-run eligibility; Active Queue
  makes `001` eligible while `002` and `003` wait; closing `001` makes `002`
  eligible; failing `002` makes `003` blocked by dependency failure.
- Queue Coordinator decision modeling can classify validation failure as
  `needs_decision` with blocker kind `validation_requires_decision`.
- Workspace Agent assistance request/response types exist as bounded frontend
  vocabulary and require a later coordinator or human decision before lifecycle
  state changes.

## Strict Queue Singleton Status

Current status: implemented for frontend identity and UI-surface rules.

- Canonical widget definition id: `agent-queue`.
- Singleton scope: Workspace.
- Singleton key: `workspace-queue`.
- Prompt-pack import targets the singleton Queue and must not create another
  Queue widget or view.
- Duplicate Queue view repair is presentation-only and must not delete Queue
  tasks, run links, worker config, reports, tags, context attachments, or other
  Queue-owned domain data.

## Known Limitations

- Smart Queue scheduler behavior remains planned. There is no new backend
  scheduler, durable worker, reconnect/resume loop, server worker, or hidden
  auto-dispatch added by this foundation.
- Queue Active eligibility is modeled in frontend smoke coverage, but task
  starts still require the existing explicit operator-controlled Queue/Executor
  paths described in `docs/CURRENT_WIDGET_SURFACE.md`.
- Prompt-pack import does not arm execution, launch Agent Executor, mutate Git,
  launch Terminal, or run validation.
- Rollback is not fully implemented as an automated Queue lifecycle behavior.
  Existing rollback-required states and coordinator options are visible model
  vocabulary, not a complete rollback engine.
- Dependency override policy, durable dependency graph migration, automatic
  downstream mutation, and production scheduler gating remain future work.
- Workspace Agent assistance is protocol/type vocabulary plus explicit request
  boundaries. Workspace Agent does not own Queue lifecycle, create hidden Queue
  tasks, start workers, mark tasks closed/failed, mutate Git, launch Terminal,
  read Finder state, or call provider tools for Queue execution.

## Future Work

- Durable Smart Queue domain records for batches, dependencies, coordinator
  decisions, assistance requests, and assistance responses.
- UI review flows for coordinator decisions, assistance responses, dependency
  blockers, and human/operator approval.
- Scheduler/runtime design that remains operator-controlled, visible, and
  bounded by the Queue contracts.
- Explicit rollback design before any rollback execution behavior is claimed.
- Additional smoke coverage for UI rendering of Smart Queue statuses once the
  visible product surface exposes the full planned workflow.
