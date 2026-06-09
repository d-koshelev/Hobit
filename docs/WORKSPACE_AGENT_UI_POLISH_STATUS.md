# Workspace Agent UI Polish Status

## Purpose

This document records completed UI polish status for Workspace Agent-adjacent
operator surfaces: movable popups, Agent Activity alignment, and the compact
Workspace Agent Direct Run summary panel.

It is a docs-only status record. It does not add frontend behavior, backend
behavior, Tauri commands, storage/schema changes, runtime execution behavior,
Queue scheduling behavior, Git behavior, or Workspace Agent provider behavior.

## Status

Completed polish has been recorded for:

- Shared draggable/movable popup behavior.
- Agent Activity top-aligned event list behavior.
- Workspace Agent bottom Direct Run panel compact summary behavior without
  inline logs.

## Shared Movable Popup Behavior

Workspace Agent popups such as Examples, Run details, Developer details, and
Logs use a shared draggable popup shell pattern. The popup can be repositioned
by dragging its header/top area while preserving normal close and keyboard
dismissal behavior.

QueueV2 task details uses the same shared draggable popup shell direction for
operator-controlled task inspection. Moving the popup is presentation-only and
does not create a new widget, mutate task data, start execution, or change
Queue runtime behavior.

## Agent Activity Alignment

Agent Activity renders its current-session activity rows from the top of the
widget body. Empty space remains below the list when there are only a few
events, instead of vertically centering or bottom-floating the events.

This preserves Agent Activity as a readable timeline and does not change event
publication, persistence, replay, execution, Queue behavior, or Executor
runtime behavior.

## Compact Workspace Agent Run Summary

The Workspace Agent bottom Direct Run panel presents a compact run summary
rather than inline full logs. The panel is intended to show concise run state,
final status, and review entry points without turning the bottom region into a
raw log console.

Full logs and technical detail remain accessible through the appropriate run
details / developer details / logs popup. This keeps normal Workspace Agent
review compact while preserving explicit operator access to details.

## Manual Smoke Checklist

Manual smoke remains pending unless explicitly reported in a later run.

- Open Workspace Agent.
- Open the Examples popup and drag it.
- Open the Run details popup and drag it.
- Open the Developer details popup and drag it.
- Open the Logs popup and drag it.
- Open the QueueV2 task details popup and drag it.
- Verify Escape still closes/dismisses movable popups where supported.
- Verify explicit Close still closes movable popups.
- Verify Agent Activity events start at the top of the widget body.
- Run a safe Direct Run and verify the bottom panel is compact summary only,
  without inline full logs.
- Verify full logs remain accessible through the details/logs popup.

## Non-Goals

- No runtime changes.
- No backend changes.
- No Tauri command changes.
- No storage or schema changes.
- No Queue runtime, scheduler, or Autorun behavior changes.
- No automatic execution.
- No hidden execution.
- No Git mutations.
- No provider/tool capability expansion.

## Follow-Ups

If future inspection finds any remaining custom popup in Workspace Agent,
Agent Activity, QueueV2, or adjacent run/detail surfaces that does not use the
shared draggable popup shell, migrate it in a focused frontend-only UI polish
block.

That follow-up should preserve existing close, Escape, focus, and presentation
semantics, and it must not change runtime behavior, backend behavior, Queue
execution semantics, Autorun behavior, or Git behavior.
