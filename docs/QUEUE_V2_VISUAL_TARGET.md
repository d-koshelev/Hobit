# Queue v2 Visual Target

## Purpose

This document captures the accepted Queue v2 visual target before
implementation.

It is docs-only. It does not add frontend behavior, backend/runtime behavior,
storage/schema changes, scheduling, dependency execution, Agent Executor
changes, Git mutation, Terminal launch, or hidden automation.

Queue v2 preserves Agent Queue v1 behavior until a later explicit
implementation block changes the UI.

## Product posture

Queue v2 is a board-first operating console for promoted Workspace tasks.

The board is the primary operating surface. Task details are secondary and open
in a movable/resizable popup or drawer, not a permanent right inspector. The
details surface supports focused decision work without shrinking the board by
default.

Card selection and card click are navigation/review gestures only. A card click
must never run a task, accept a result, commit, push, finalize, or perform a
destructive action.

## Layout

Queue v2 uses one continuous widget surface with these zones:

- Top command bar: queue title, create/import controls, search, global filters,
  capacity summary, explicit Autorun armed/off state, and compact queue actions.
- Left rail: filters, tags/groups, workers/providers, ready/review counts,
  capacity summary, and explicit armed/off state. The rail scopes the board; it
  does not duplicate task details.
- Main board lanes: the primary operating surface for task scan, triage,
  assignment, running visibility, review, blockers, and closure.
- Collapsed bottom activity stream/history: high-level recent activity and
  history by default, expandable for lower-level details when needed.
- Task details popup/drawer: the selected task decision surface, opened from
  a card or explicit details action.

The board must remain useful when the left rail, bottom stream, or task
details surface are closed. Details are not required for normal scan and triage.

## Board lanes

Queue v2 board lanes are:

- Intake: draft, imported, proposed, or incomplete tasks that are not ready to
  run.
- Ready: tasks with enough information and no unsatisfied dependencies.
- Running: active tasks grouped by worker/provider. Each worker group shows its
  own active task cards and capacity state.
- Review: tasks with report output, validation output, or proposed completion
  that needs explicit operator review.
- Blocked: tasks waiting on dependencies, missing inputs, unavailable capacity,
  failed prerequisites, or operator decisions.
- Closed: accepted, cancelled, archived, or intentionally abandoned tasks.
  Closed is collapsed/history by default.

Lane placement is the visible lifecycle truth. Status text and chips should not
repeat obvious lane meaning unless they clarify an exceptional state.

## Task card rules

Task cards are compact, uniform, and optimized for board scan density.

Each card may show:

- title;
- tag/group identity;
- state when useful beyond the lane;
- one concrete next action;
- worker/provider and progress when running or recently run;
- dependency, blocker, review, or action-required signal when applicable;
- attachment/context count when useful.

Tag color is group identity, not noisy status coloring. Show it as a restrained
left stripe, dot, or similar compact marker. Status chips are muted by default
and should use stronger emphasis only for blocked, review-required, or
action-required states.

Card menus are hidden until hover, focus, or selected state. Card menu actions
must be explicit and must not be the only way to discover the primary next
action.

Cards must not show raw prompts, full reports, raw logs, developer payloads,
large timestamps, full dependency lists, or complete validation output. Those
belong in the task details surface or Developer tab.

## Task details popup/drawer

Task details open as a popup or drawer rather than a permanent right inspector.
The default width should be around 55-65 percent of the Queue widget. If the
shared popup shell supports movement and resizing, Queue details should use
that behavior.

The details surface is the task decision surface and must provide one primary
next action for the selected task. Secondary actions are grouped under More so
they do not compete with the primary decision.

Required tabs:

- Overview: title, objective, lane/status, priority, blocker/dependency
  summary, assignment, latest run/report summary, and primary next action.
- Prompt: operator-provided prompt and task instructions.
- Result: final report, review summary, acceptance/reopen controls, and
  result-specific warnings.
- Agent Log: high-level readable execution timeline and worker messages.
- Context: attached Knowledge / Skills, source refs, visible context, warnings,
  and token/materialization summaries.
- Files / Validation: changed-file summary, validation commands/results, and
  links to owning review surfaces where applicable.
- Developer: raw run links, raw logs/previews, bounded stdout/stderr or JSON
  event previews, IDs, payload metadata, and diagnostic detail.

Agent Log is high-level by default. Raw logs and raw event payloads are
Developer-tab content only.

## Safety boundaries

Queue v2 must preserve existing operator-control boundaries:

- no hidden auto-run;
- no run on card click;
- no auto-commit;
- no auto-push;
- no auto-finalize;
- no hidden destructive actions;
- no unarmed scheduler behavior;
- no runtime/scheduler changes in visual implementation blocks;
- no Terminal launch from Queue;
- no Git mutation from Queue;
- no Agent Executor runtime behavior change;
- no automatic acceptance based only on run success.

Manual run remains explicit. Autorun, where present, remains explicitly armed,
desktop-local, current-session-only, and bounded by the current Agent Queue
contract until a separate runtime contract changes it.

## Implementation acceptance checklist

Future Queue v2 implementation blocks should pass this checklist:

- Board is the primary operating surface and remains usable without details
  open.
- Top command bar, left rail, board lanes, collapsed bottom activity/history,
  and task details popup/drawer are present or intentionally staged by block.
- Lanes include Intake, Ready, Running grouped by worker, Review, Blocked, and
  Closed collapsed by default.
- Task details are not implemented as a permanent right inspector.
- Default details width is around 55-65 percent of the Queue widget.
- Details tabs include Overview, Prompt, Result, Agent Log, Context, Files /
  Validation, and Developer.
- Each selected task has one primary next action; secondary actions are grouped
  in More.
- Card click opens/selects/reviews only and never runs a task.
- Cards are compact and exclude raw prompt, report, and log bodies.
- Tag color represents group identity through a stripe/dot, not status noise.
- Status chips are muted except blocked, review-required, and action-required
  states.
- Card menus appear only on hover, focus, or selected state.
- Running lane groups active tasks by worker/provider.
- Closed lane is collapsed/history by default.
- Bottom activity/history is collapsed by default and high-level.
- Raw logs and developer payloads appear only in Developer detail surfaces.
- No source, runtime, scheduler, storage, backend, Rust, Tauri, Git, Terminal,
  commit, push, finalize, or destructive behavior is changed by visual blocks.
