# Smart Queue Manual Desktop Smoke Checklist

## Purpose

Manual desktop checklist for the current Smart Queue frontend checkpoint. This
checklist does not claim durable backend Smart Queue runtime, scheduler,
rollback execution, Git/file mutation, Terminal launch, Workspace Agent
runtime auto-call, backend migrations, or storage schema changes.

## Setup

- Start Hobit from `C:\Users\Dmitry\Documents\prj\Hobit_fixed`.
- Open or create a Workspace.
- Keep screenshots available for any failed step.

## Expected Labels

During the smoke, verify these product labels appear where applicable:

- `Ready`
- `Waiting dependency`
- `Blocked: dependency failed`
- `Blocked: dependency blocked`
- `Needs decision: validation failed`
- `Retry available`
- `Approval required`
- `Destructive`
- `No rollback executed`

## Smoke Flow

1. Open the Widget Catalog and add Agent Queue.
   - Expected: exactly one Queue view is visible.

2. Try to add Agent Queue again.
   - Expected: the existing Queue view is reused or restored; no duplicate
     Queue view is created.

3. Import a prompt pack with at least one root task and one dependent task.
   - Expected: the import preview shows Smart Queue materialization, singleton
     Workspace Queue targeting, dependency counts, and no task auto-run.

4. Click `Create Queue items`.
   - Expected: Queue tasks are created from the materialized graph, but no
     worker starts.

5. Inspect the created tasks.
   - Expected: root task is `Ready`; dependent tasks are
     `Waiting dependency`.

6. Set Queue to Paused or keep it paused.
   - Expected: Paused prevents task pickup.

7. Set Queue to Active.
   - Expected: only eligible root `Ready` tasks can be picked up; dependent,
     blocked, failed, closed, cancelled, and needs-decision tasks are not
     picked up.

8. Produce or load a dependency-failed scenario.
   - Expected: downstream task shows `Blocked: dependency failed`; deeper
     downstream task shows `Blocked: dependency blocked`.

9. Recover the upstream task to accepted/closed state.
   - Expected: dependency-derived blockers clear and downstream eligible tasks
     return to `Ready` or remain `Waiting dependency` only when another
     unfinished dependency still exists.

10. Produce or load a validation-failure worker report.
    - Expected: the selected task details show a Coordinator Decision Card with
      `Needs decision: validation failed`, `Retry available`, and visible
      allowed next actions.

11. Click Retry same.
    - Expected: a new attempt is recorded, previous evidence remains visible,
      task returns to `Ready`, and no worker starts immediately.

12. Click Retry with changes.
    - Expected: the modified prompt editor opens; empty prompt is rejected;
      saving a changed prompt updates the next runnable prompt, preserves prior
      evidence, records a new attempt, and does not start a worker.

13. Click Ask Workspace Agent.
    - Expected: a handoff prompt is prepared for the operator; Workspace Agent
      is not started or called automatically.

14. Click Prepare rollback proposal.
    - Expected: proposal shows `Approval required`, `Destructive`, affected
      files/base revision where available, and `No rollback executed`.

15. Recheck Queue view count.
    - Expected: no duplicate Queue view exists.

16. In Workspace Agent, test Queue item creation through the Hobit Agent
    Capability Runtime direction, not a phrase route.
    - Expected: Queue item creation is represented by Queue capabilities such
      as `queue.createItem` / `queue.createItems` in the capability manifest
      and future broker boundary. Typing phrases such as
      `add example queue items to queue`, `create queue items`, or
      `add tasks to queue` must not be treated as
      `user text -> regex -> Queue action`.
    - Expected: No Codex run, shell command, Terminal action, Queue Autorun,
      worker start, Git action, or duplicate Queue view is created as a hidden
      product-action workaround. Codex/shell remain restricted capabilities for
      explicit workspace/code execution requests only.

17. Check for side effects.
    - Expected: no Git/file mutation, Terminal launch, Workspace Agent runtime
      call, rollback execution, or hidden worker start happened during preview,
      creation, retry preparation, assistance preparation, or rollback
      proposal preparation.

## Failure Capture

For every failed smoke step, capture:

- screenshot;
- task title/id if visible;
- Queue mode: Active or Paused;
- current lane/status;
- action clicked;
- expected vs actual result;
- whether any worker, Git, Terminal, Workspace Agent, or rollback side effect
  occurred.

## Next Engineering Blocks

1. Manual smoke fixes first.
2. Durable backend persistence design.
3. Backend scheduler/runtime ownership design.
4. Durable attempt/coordinator decision persistence.
5. Safe Workspace Agent handoff integration.
6. Rollback execution design only after the approval/safety contract.
