# Queue v2 Visual Status

## Purpose

This document records the implementation status after the Queue v2 visual
implementation block.

It is a docs-only status record. It does not add frontend behavior,
backend/runtime behavior, tests, storage/schema changes, scheduling, dependency
execution, Agent Executor changes, Git mutation, Terminal launch, or hidden
automation.

## Status

Queue v2 now has an experimental frontend visual scaffold and board-first
surface over the existing Queue v2 read/view model.

The implementation is visual and conservative. It organizes current Queue task
data into a V2 presentation model without making Queue v2 the default Queue,
without changing Agent Queue v1 behavior, and without adding new runtime,
scheduler, backend, storage, Rust, or Tauri behavior.

## Visual Target Contract

The active visual target remains:

- `docs/QUEUE_V2_PRODUCT_CONTRACT.md`
- `docs/QUEUE_V2_VISUAL_TARGET.md`
- `docs/QUEUE_V2_STATE_MODEL.md`

The target is a board-first operating console for promoted Workspace tasks:

- top command bar for global status, counts, capacity, search/filter
  placeholders, and explicit armed/off state;
- left rail for scope, tags/groups, workers, capacity, and counts;
- main board lanes as the primary operating surface;
- collapsed bottom activity/history stream;
- task details popup/drawer for selected-task decision work;
- compact cards with one concrete next action and no raw prompt/report/log
  bodies;
- no run, accept, commit, push, finalize, destructive action, Terminal launch,
  or hidden execution from card click or visual lane placement.

## Implemented Visual Surface

### QueueV2 manifest and scaffold

- A `queue-v2` Widget V2 manifest/scaffold exists as an experimental frontend
  surface.
- The scaffold renders through Widget V2 shell primitives and labels itself as
  a frontend-only Queue v2 board.
- The scaffold states that no task mutation or execution actions are wired.
- Queue v2 remains experimental and is not promoted to the normal product
  catalog or default Workspace surface by this status record.

### Board lanes and cards

- Queue v2 renders the required board lanes from the view model:
  `Intake / Draft`, `Ready`, `Running`, `Review`, `Blocked`, and `Closed`.
- Cards are compact and use derived lane, lifecycle, next action, blocker,
  worker/run, attachment/context, and selected-state data.
- Card selection and details opening are review/navigation gestures only.
- Card details controls are visually secondary and appear through hover,
  focus, or selected state.
- Cards avoid raw prompt bodies, full reports, full logs, large developer
  payloads, and complete validation output.

### Tag color and group identity

- Queue v2 uses tag/group identity as restrained card and rail identity.
- Tag colors are represented through compact stripes, dots, or swatches.
- Color is not used as noisy status decoration.
- Stronger emphasis remains reserved for blocked, review-required, or
  action-required states.

### Worker grouped running lane

- The Running lane groups active task cards by worker/provider identity.
- Worker groups show capacity-oriented summaries and active cards without
  implying that Queue v2 owns live execution.
- Worker and capacity presentation remains descriptive unless a future explicit
  runtime/intents block wires real actions.

### Closed collapsed

- Closed work is shown as collapsed/history-oriented by default.
- Closed remains separate from Review so report-ready work is not treated as
  accepted or finalized without an explicit closure outcome.

### Task details popup

- Queue v2 includes a selected-task details popup surface.
- The popup uses the expected tabs: Overview, Prompt, Result, Agent Log,
  Context, Files / Validation, and Developer.
- The popup shows one primary next action from the view model, with lower-level
  technical detail kept in the Developer-oriented surfaces.
- The current popup is a visual/details surface only. Real action wiring,
  confirmation flows, mutation intents, and durable review/finalization remain
  future blocks.
- Move and resize behavior should be improved if the shared popup shell does
  not yet provide the intended movable/resizable details experience.

### Top bar, left rail, and activity surfaces

- The Queue v2 top command bar shows queue state, ready/running/review/blocked
  counts, capacity summary, explicit armed/off state, and disabled
  placeholder controls for search/filter/import-style affordances.
- The left rail shows scoped summary information such as tag/group identity,
  worker/provider capacity, ready/review counts, and armed/off state without
  duplicating full task detail.
- The activity/history surface is collapsed by default and presents grouped
  high-level activity/history rather than becoming the normal operating view.
- Raw logs, raw event payloads, IDs, and developer diagnostics remain
  Developer-detail content, not board/card defaults.

## Safety Status

Queue v2 visual implementation preserves the current operator-control
boundary:

- Agent Queue v1 behavior is unchanged.
- Queue v2 is not the default Queue.
- Queue v2 is not exposed in the normal Widget Catalog by this block.
- No runtime, scheduler, backend, storage, Rust, or Tauri API changes were
  introduced by this visual status record.
- No hidden execution was added.
- No hidden auto-run or unarmed dispatch was added.
- No automatic acceptance or finalization was added.
- No Git commit, push, reset, clean, stash, or other Git mutation was added.
- No Terminal launch or command execution path was added.
- No Agent Executor runtime behavior was changed.
- Card click, selection, details opening, lane rendering, capacity display, and
  next-action labels remain visual/read-model behavior only.

## Remaining Blocks

Recommended next work should remain explicit and focused:

- Experimental mount path: add or verify a clearly dev/experimental-only mount
  path if a safe one is not already present. Do not make Queue v2 default and
  do not expose it in the normal Widget Catalog without a separate request.
- Real action wiring behind explicit intents: wire actions only through
  explicit operator intents, confirmation-aware UI, and the approved Widget V2
  runtime-intent boundary. Do not wire run, commit, push, finalize,
  destructive, or Terminal actions directly from cards.
- Details popup improvements: add shared movable/resizable behavior if missing,
  preserve the 55-65 percent target width, and keep details secondary to the
  board.
- Capacity and parallel visualization refinements: improve worker/provider
  capacity snapshots, paused/unavailable explanation, eligible-now counts, and
  parallel dry-run grouping as view-only planner output.
- Review and closure hardening: keep report-ready distinct from accepted,
  rejected, request-changes, follow-up-created, and finalized closure states.
- Dependency visualization: add dependency refs, blocker summaries, and graph
  validity only after a focused dependency data/API contract.
- Runtime/scheduler blocks: implement parallel dispatch, dependency-aware
  execution, durable scheduler behavior, response parsing/validation,
  backend workers, reconnect/resume, or server runtime only after explicit
  contracts and prompts.

## Manual Smoke Checklist

Use this checklist for the current experimental Queue v2 surface after the
normal app can be opened in a development build:

- Open a Workspace without changing the default Workspace surface.
- Confirm Agent Queue v1 remains available and behaves as before.
- Reach Queue v2 only through the intended experimental/dev path, not through
  the normal Widget Catalog unless a later block explicitly changes that.
- Confirm the Queue v2 surface renders a top command bar, left rail, main
  board, collapsed activity/history area, and task details popup path.
- Confirm lanes render as Intake / Draft, Ready, Running, Review, Blocked, and
  Closed.
- Confirm Closed is collapsed/history-oriented by default.
- Confirm Running groups active task cards by worker/provider.
- Confirm task cards are compact and show tag/group identity, next action, and
  lane-relevant summary only.
- Confirm tag color is a stripe/dot/swatch identity marker, not broad status
  coloring.
- Confirm clicking or selecting a card opens/selects/reviews only and does not
  start work.
- Confirm the task details popup opens from a selected card and includes
  Overview, Prompt, Result, Agent Log, Context, Files / Validation, and
  Developer tabs.
- Confirm raw logs/payloads are not visible on cards or in the default board
  scan.
- Confirm the top bar and left rail show counts/capacity/armed state without
  claiming scheduling or hidden execution.
- Confirm disabled placeholder controls do not mutate tasks.
- Confirm Autorun remains explicit armed/off state only and is not armed or
  started by Queue v2 visuals.
- Confirm no task run, Agent Executor launch, Terminal launch, commit, push,
  finalization, destructive action, backend call, storage write, or scheduler
  behavior occurs from visual Queue v2 interactions.

## Contract Notes

This status record does not make planned Queue v2 behavior current. It records
the visual implementation status and preserves the existing Agent Queue v1
runtime and product boundaries.
