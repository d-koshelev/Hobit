# Queue Dependency State Contract

## Purpose

This contract defines structural dependency semantics and dependency-derived
task states for Smart Queue work.

It is a docs and type-vocabulary contract. It does not add runtime dependency
execution, storage schema, scheduler behavior, backend commands, Finder
behavior, Git mutation, or Terminal launch.

## Status

Current for backend aggregate dependency read state. Planned for broader Smart
Queue scheduler behavior, dependency override policy, and durable coordinator
fail/block commands.

Current backend aggregates report dependency-derived read state and treat an
upstream as satisfied only after durable backend accepted completion. Block/fail
propagation is limited to existing durable task-row status until explicit
backend coordinator fail/block commands exist. Frontend overlays may present
compatibility labels but must not become dependency product truth.

## Structural Dependency

A dependency is a durable structural relationship:

```text
B depends on A
```

This means B must not start until A has reached accepted completion, unless a
future explicit override policy says otherwise. The relationship remains true
while A is waiting, running, blocked, failed, closed, or cancelled.

## Waiting Is Not Blocked

Waiting dependency is normal waiting while an upstream task is not complete.
It should be rendered and modeled separately from Blocked.

Blocked means a task cannot proceed without intervention, missing information,
configuration, or a Queue Coordinator decision.

## Dependency Gates

Backend aggregate `dependencyState` values are:

- `none`: no upstream dependencies.
- `ready`: every upstream dependency has reached accepted completion.
- `waiting`: at least one upstream dependency is incomplete, with no failed
  upstream dependency.
- `blocked`: at least one upstream dependency is explicitly blocked when a
  durable blocked state exists.
- `failed_upstream`: at least one upstream dependency failed before accepted
  completion when durable failure state exists.
- `unknown`: the backend cannot determine dependency state safely, such as a
  missing upstream task row.

Dependency gate `waiting` keeps a dependent task out of the eligible set but
does not by itself make the task Blocked.

Dependency gate `failed_upstream` changes downstream waiting tasks to Blocked with
blocker kind `dependency_failed`.

Dependency gate `blocked` exposes that upstream intervention is needed. The
Queue Coordinator decides whether downstream remains Waiting dependency or
becomes Blocked with `dependency_blocked`.

For `waiting`, `blocked`, `failed_upstream`, and `unknown`, the backend
aggregate exposes a dependency blocker and returns no runnable next action. It
must not suggest `queue.item.startRun`, and it must not suggest
`queue.item.promoteDraft` as runnable while the dependency gate is unsatisfied.

## Completion For Dependency Satisfaction

Dependency satisfaction requires accepted completion. A worker report,
completed process, passing validation, or `completed` compatibility status is
not sufficient by itself if coordinator finalization or closure is still
required.

Accepted completion maps to the backend/domain `queue.item.markDone` decision
ledger. Review ACK and worker completion do not satisfy dependencies until that
durable completion decision exists.

Raw `task.status=completed`, a completed run link, durable worker evidence,
`reviewState=in_review`, and review ACK are review/completion inputs only. They
do not unblock dependents without an accepted-completion decision.

## Dependency Record Shape

Dependency records should be shaped like:

```ts
type QueueTaskDependency = {
  dependencyId: string;
  upstreamTaskId: string;
  downstreamTaskId: string;
  kind: "blocks_start";
  createdBy: "queue_importer" | "queue_coordinator" | "human_operator";
  createdAt: string;
};
```

The current compatibility `dependsOn: string[]` field may continue to represent
upstream task ids until a richer model is explicitly implemented.

## Blocker Kinds

Dependency-derived blockers use:

- dependency_waiting
- dependency_failed
- dependency_blocked
- dependency_unknown

Other Smart Queue blockers are defined in
`docs/SMART_QUEUE_WORKFLOW_CONTRACT.md`.

## Non-Goals

This contract does not add:

- automatic dependency execution;
- dependency graph storage migration;
- hidden downstream task mutation;
- dependency override UI;
- auto-retry;
- provider-based dependency reasoning;
- Finder, Git, Terminal, or schema changes.
