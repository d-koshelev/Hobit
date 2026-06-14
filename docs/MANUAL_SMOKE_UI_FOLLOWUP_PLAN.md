# Manual Smoke UI Follow-Up Plan

## Purpose

This document records the current manual smoke UI and behavior follow-up
direction for the next focused implementation blocks.

It is a docs-only checkpoint. It does not implement frontend behavior, CSS,
runtime behavior, backend commands, Tauri commands, storage/schema changes,
widget behavior, Queue execution, Agent Executor behavior, Git behavior,
Terminal behavior, provider behavior, or new widgets.

Future implementation blocks must still read the active UI/product contracts
and the affected widget/domain contract before coding.

## Shared UI Direction

- Keep the default product UI polished, necessary, and operator-facing.
- Use `Title + InfoTip` for short explanatory context instead of persistent
  title-plus-subtitle explanations.
- Status badges must represent meaningful current state only. Do not add
  duplicate, static, or mode-label badges.
- Debug, runtime, provider, callback, raw payload, and internal details belong
  behind `Debug`, `More`, or `InfoTip` surfaces, not primary UI.
- Prefer shared primitives before local UI: widget shells, toolbar/action
  groups, badges/status, empty states, and bounded draggable/resizable popup
  shells.
- Preserve IDs, IPC contracts, persisted state, and runtime semantics unless a
  later prompt explicitly scopes behavior changes.

## Follow-Up Targets

### QueueV2 / Agent Queue

- Replace any duplicate/static Queue header badge with a meaningful current
  Queue state badge.
- Make the `Enable Queue` action visible when it is the next relevant operator
  action.
- Move the New task popup onto the shared draggable/resizable popup shell.

### Workspace Agent

- Keep the UI provider-neutral while exposing Codex, Claude, and Amp as
  selectable provider/model options where that selection is already allowed by
  the implementation block.
- Show the selected model and reasoning depth in a status/config panel.
- Keep provider/runtime details out of the primary chat and action surface
  unless they are direct operator configuration.

### Knowledge / Skills

- Remove inner Knowledge Catalog card-in-card nesting from the default surface.
- Organize the toolbar as:
  - `List` / `Cards` segmented view control.
  - `New` and `Import` grouped as primary creation actions.
  - `More` for secondary actions.
  - `Debug` as secondary/developer-only, hidden from the primary workflow.

### Notes

- Replace the thick nonfunctional rail with a thin draggable split divider.
- Keep Markdown and simple syntax support staged separately. Do not fold
  Markdown rendering, Notebook behavior, formatting tools, or syntax features
  into the rail cleanup block.

### Terminal

- Reduce pane chrome that reads as heavy or debug-like.
- Make the layout responsive at normal and constrained widget sizes.
- Widget deletion for live PTY sessions/panes needs an explicit Force Kill path
  so removal does not hide or orphan live local processes.

### Coordinator / Agents

- Route worker-stuck reports to a queue coordinator decision rather than
  treating them as hidden automation.
- Allowed coordinator decisions are: fail, block, retry, retry with modified
  request, rollback attempt, and request human input.
- These decisions must remain explicit and reviewable; they do not imply
  automatic Queue execution, hidden mutation, Terminal launch, Git mutation, or
  provider tool execution.

### Finder

- Finder is explicitly out of scope for this manual smoke follow-up plan.
- Do not spend cleanup or polish effort on Finder in the next UI follow-up
  blocks unless a later prompt explicitly scopes Finder work.

## Validation Policy

For this follow-up track, the file-size check is warning-only by default:

```sh
python scripts/hobit/check-file-sizes.py --changed-only
```

Do not use `--fail-on-warning` unless a later prompt explicitly requests it.

## Non-Goals

This follow-up plan does not implement:

- Finder cleanup or polish.
- New product/runtime/frontend behavior.
- New widget insertion behavior.
- New provider calls, provider tools, or hidden execution.
- New Terminal runtime behavior beyond explicitly scoped future work.
- Queue auto-dispatch, hidden scheduling, or automatic coordinator decisions.
- Git mutation, storage/schema changes, or IPC contract changes.
