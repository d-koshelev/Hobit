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
block commands. Explicit terminal failure now comes from the backend failure
decision ledger.

Current backend aggregates report dependency-derived read state and treat an
upstream as satisfied only after durable backend accepted completion. Failed
upstream propagation comes from the durable backend failure decision ledger.
Block propagation remains planned until an explicit backend block command
exists. Frontend overlays may present compatibility labels but must not become
dependency product truth.

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
- `failed_upstream`: at least one upstream dependency has a durable terminal
  failure decision before accepted completion.
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
Broker result mappers must also not emit a typed `nextAction` for
`queue.item.startRun` from dependency-waiting aggregates. After upstream
accepted completion clears the blocker, any downstream `nextAction` must be
built from that downstream task's own readiness and validated capability input.
Workspace Agent bounded autonomy grants do not override this dependency gate:
even under `queue_acceptance_smoke` or `queue_failure_smoke`, a typed
`queue.item.startRun` nextAction stops when the authoritative backend/result
state reports `waiting`, `blocked`, `failed_upstream`, `unknown`, or a
dependency blocker.

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

## Failure For Dependency Blocking

Dependency failure requires an explicit durable backend failure decision from
`queue.item.fail`. Worker failure evidence, failed run links, review message
creation, review ACK, raw failed compatibility status, validation failure
evidence, and frontend lifecycle overlays do not by themselves create
`failed_upstream`.

After `queue.item.fail` succeeds for an upstream task, downstream aggregate
reads expose `dependencyState=failed_upstream`, a `dependency_failed` blocker,
and no runnable `queue.item.startRun`, `queue.enable`, or
`queue.item.promoteDraft` path. No downstream task starts automatically.
`queue_failure_smoke` grants may allow the explicit upstream
`queue.item.fail` command with exact structured confirmation, but they must not
start, promote, or otherwise mutate downstream tasks.

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

Workspace Agent typed Queue create capabilities use `dependsOn: string[]` as
the public dependency field. The values must be explicit upstream Queue task ids
returned by prior typed Queue results such as `queue.createItem`,
`queue.createItems`, `queue.items.list`, or `queue.lifecycle.get`.
Dependencies must not be inferred from task order, title, prompt text, prose, or
prompt-pack-local ids. For dependency smoke, create the upstream task first,
then create the downstream task with `dependsOn: [upstreamTaskId]`.

Queue workflow task slot materialization uses a different internal typed
dependency shape: `dependsOnSlots`. A downstream workflow slot can be
materialized only after each upstream slot already has a durable slot binding
to a Queue task id in the same workflow/workspace. The backend resolves those
explicit slots to existing task ids and writes the existing Queue task
`depends_on` edge. It does not infer dependencies from slot order, title,
prompt, UI position, file path, or prose. Missing upstream slot bindings block
materialization, and missing persisted dependency edges block resume planning
as `blocked_dependency_edge_missing`; the planner does not repair edges in the
MVP.

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
