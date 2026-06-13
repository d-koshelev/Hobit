# Queue Enable Action Wiring Fix Status

## Status

Manual smoke blocker recorded. QueueV2 can identify that Queue enablement is
the next action, but the visible disabled state does not expose an operator
click target to perform that action.

## Observed Failure

- Smoke task `001` is queued and blocked because Queue is disabled.
- Task details show `Next available action: Enable Queue`.
- The `Queue Disabled` tile is not clickable, and no separate `Enable Queue`
  action is available from the disabled state.
- Because the enable action is only described, task `001` cannot progress from
  the operator path.

## Expected Fixed Behavior

- Queue disabled state exposes an explicit typed `Enable Queue` action, or a
  clear disabled reason when enablement is not currently possible.
- Missing executor or Codex configuration is shown as a separate blocker when
  applicable, not conflated with Queue enablement.
- Enabling Queue remains an explicit operator action and uses the typed Queue
  control service/action path.
- Task `002` remains dependency-blocked while task `001` becomes eligible to
  progress.

## Rerun Instructions

1. Restart Hobit.
2. Import the smoke prompt pack.
3. Create Queue items from the imported prompts.
4. Queue task `001`.
5. Click `Enable Queue`.
6. Verify task `001` progresses.
7. Verify task `002` remains blocked by its dependency.

## Non-Goals

- No Queue runtime, scheduler, Autorun, dependency execution, Executor,
  Terminal, Git, storage, schema, or provider behavior changes are implied by
  this note.
- This note does not implement the fix.
