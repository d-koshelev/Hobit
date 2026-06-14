# Queue Dependency State Contract

## Purpose

This contract defines structural dependency semantics and dependency-derived
task states for Smart Queue work.

It is a docs and type-vocabulary contract. It does not add runtime dependency
execution, storage schema, scheduler behavior, backend commands, Finder
behavior, Git mutation, or Terminal launch.

## Status

Planned for Smart Queue dependency modeling.

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

- none: no upstream dependencies.
- waiting: at least one upstream dependency is incomplete, with no failed
  upstream dependency.
- satisfied: every upstream dependency has reached accepted completion.
- failed: at least one upstream dependency failed.
- blocked: at least one upstream dependency is blocked or needs intervention.

Dependency gate `waiting` keeps a dependent task out of the eligible set but
does not by itself make the task Blocked.

Dependency gate `failed` changes downstream waiting tasks to Blocked with
blocker kind `dependency_failed`.

Dependency gate `blocked` exposes that upstream intervention is needed. The
Queue Coordinator decides whether downstream remains Waiting dependency or
becomes Blocked with `dependency_blocked`.

## Completion For Dependency Satisfaction

Dependency satisfaction requires accepted completion. A worker report,
completed process, passing validation, or `completed` compatibility status is
not sufficient by itself if coordinator finalization or closure is still
required.

Accepted completion maps to a Queue-owned closed/finalized outcome, such as an
explicit Closed human status or a current compatibility closure state accepted
by the active Queue contracts.

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

- dependency_failed
- dependency_blocked

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
