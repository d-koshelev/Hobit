# Queue Coordinator Contract

## Purpose

This contract defines the Queue Coordinator as the owner of Queue lifecycle
decisions for Smart Queue work.

It is a domain contract only. It does not add scheduler runtime, backend
execution, storage schema, Tauri commands, automatic validation, Git mutation,
Terminal launch, Finder behavior, or Workspace Agent tool execution.

## Status

Planned for broad Smart Queue decision semantics. The narrow accepted
completion path is implemented now as backend/domain-owned
`queue.item.markDone`; it records durable completion only after explicit
structured confirmation and backend aggregate preconditions. The narrow
terminal failure path is also implemented as backend/domain-owned
`queue.item.fail`; it records durable failure only after explicit structured
confirmation, visible reason, durable worker evidence, ACKed review, and
backend aggregate preconditions. Worker failure evidence alone is not terminal
task failure.

## Ownership

The Queue Coordinator owns Queue lifecycle decisions. Workspace Agent assistance
may inform a decision, but the Workspace Agent is not the lifecycle owner.
Current frontend coordinator overlays are transitional compatibility state.
Durable coordinator decisions belong in backend/domain/storage per
`docs/QUEUE_BACKEND_OWNERSHIP_CONTRACT.md`.

Coordinator-owned decisions include:

- activate, pause, drain, or stop Queue state;
- mark task ready, review, needs decision, blocked, failed, closed, or
  cancelled;
- retry a task attempt;
- request validation or human review;
- block downstream tasks after dependency failure;
- accept a worker report;
- reject a worker report;
- accept completion through the backend finalization command after review ACK
  and durable worker evidence;
- fail a task through the backend terminal-failure command after review ACK,
  durable worker evidence, explicit confirmation, and visible reason;
- request Workspace Agent assistance;
- create or request follow-up work through explicit Queue-owned flows.

## Decision Inputs

The Queue Coordinator may use only visible or explicitly approved Queue-owned
inputs:

- QueueBatch metadata;
- task prompt and settings;
- structural dependency graph;
- dependency gate state;
- worker availability and attempt summaries;
- bounded worker reports;
- validation summaries and visible failures;
- explicit human/operator decisions;
- explicit assistance responses attached to the relevant task or batch.

The Coordinator must not read hidden files, hidden widget state, raw Executor
logs, Finder state, Terminal transcripts, Notes, Knowledge, or provider context
unless a separate current contract and explicit operator action allows that
specific context.

## Decision Kinds

- start_task: allow scheduler/worker path to start an eligible task.
- retry_task: run another attempt for a task after a failed/interrupted attempt.
- request_review: move task output into Review.
- request_validation: ask for explicit validation before finalization.
- request_assistance: ask Workspace Agent or human assistance for a bounded
  question.
- block_task: mark a task Blocked with a blocker kind and visible reason.
- fail_task: mark a task Failed through explicit terminal failure or rejection;
  worker failure evidence alone only creates review evidence.
- close_task: mark a task Closed after accepted completion.
- cancel_task: cancel unstarted or active work through explicit controls.
- pause_queue: stop new starts without cancelling running attempts.
- drain_queue: allow running attempts to finish and start no new attempts.
- stop_queue: stop Queue activity according to the visible stop policy.

## Decision Record Shape

Coordinator decision records should be shaped like:

```ts
type QueueCoordinatorDecision = {
  decisionId: string;
  workspaceId: string;
  queueId: string;
  batchId?: string;
  taskId?: string;
  decision:
    | "start_task"
    | "retry_task"
    | "request_review"
    | "request_validation"
    | "request_assistance"
    | "block_task"
    | "fail_task"
    | "close_task"
    | "cancel_task"
    | "pause_queue"
    | "drain_queue"
    | "stop_queue";
  reason: string;
  createdAt: string;
  decidedBy: "queue_coordinator" | "human_operator";
  requiresApproval: boolean;
  approvedBy?: string;
};
```

This shape is a contract target. It does not require storage persistence in
this block.

## Workspace Agent Boundary

Workspace Agent can assist by answering an explicit request or drafting options
from visible request context. It must not:

- decide Queue lifecycle by itself;
- silently create tasks;
- start workers;
- override dependency gates;
- mark tasks closed or failed;
- treat review ACK, worker completion, or prose confirmation as done;
- mutate Git;
- launch Terminal;
- read Finder state;
- call provider tools for Queue execution.

## Human Approval

Human/operator approval is required for sensitive lifecycle transitions and any
future mutation path that could accept work, cancel work, fail dependent work,
commit changes, push changes, or expose additional context.

The Coordinator may prepare a decision proposal, but the operator remains in
control where approval is required.
