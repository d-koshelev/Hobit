# Queue Assistance Protocol Contract

## Purpose

This contract defines the bounded assistance protocol between Queue Coordinator,
Workspace Agent, and human/operator review for Smart Queue work.

It is a docs and type-vocabulary contract. It does not add provider calls,
Workspace Agent tools, Queue runtime, scheduler behavior, storage schema,
Tauri commands, Finder behavior, Git mutation, or Terminal launch.

## Status

Planned for Smart Queue assistance semantics.

## Principle

Workspace Agent is an assistance and escalation channel. It is not the owner of
Queue lifecycle.

Queue Coordinator owns retry, block, fail, needs-help, review, close, drain,
pause, and stop decisions. Workspace Agent may provide bounded help only after
an explicit request.

## Assistance Request Shape

Assistance requests should be shaped like:

```ts
type QueueAssistanceRequest = {
  requestId: string;
  workspaceId: string;
  queueId: string;
  batchId?: string;
  taskId?: string;
  requestedBy: "queue_coordinator" | "human_operator";
  target: "workspace_agent" | "human_operator";
  reason:
    | "dependency_failed"
    | "dependency_blocked"
    | "missing_config"
    | "validation_requires_decision"
    | "worker_unavailable"
    | "dirty_worktree"
    | "missing_prompt"
    | "requires_human_input";
  question: string;
  visibleContext: {
    taskTitle?: string;
    taskPromptPreview?: string;
    dependencyTaskIds?: string[];
    workerReportPreview?: string;
    validationSummary?: string;
    blockerSummary?: string;
  };
  allowedResponseKinds: Array<
    "explanation" | "options" | "draft_prompt" | "decision_recommendation"
  >;
  createdAt: string;
};
```

Visible context must be intentionally selected and bounded. Assistance requests
must not include raw logs, hidden files, hidden widget state, secrets, full
diffs, Finder state, Terminal transcripts, or unapproved Knowledge/Notes
content.

## Assistance Response Shape

Assistance responses should be shaped like:

```ts
type QueueAssistanceResponse = {
  responseId: string;
  requestId: string;
  responder: "workspace_agent" | "human_operator";
  responseKind:
    | "explanation"
    | "options"
    | "draft_prompt"
    | "decision_recommendation";
  summary: string;
  recommendedDecision?:
    | "retry_task"
    | "request_review"
    | "request_validation"
    | "block_task"
    | "fail_task"
    | "close_task"
    | "cancel_task"
    | "pause_queue"
    | "drain_queue"
    | "stop_queue";
  proposedPrompt?: string;
  warnings: string[];
  createdAt: string;
  requiresCoordinatorDecision: true;
};
```

Every assistance response requires a Queue Coordinator or human/operator
decision before it changes Queue lifecycle state.

## Allowed Assistance

Workspace Agent may:

- explain a failure or blocker from visible request context;
- propose options for a coordinator decision;
- draft a replacement or follow-up prompt;
- summarize visible worker and validation reports;
- recommend a decision for review.

Workspace Agent must not:

- start a task;
- retry a task;
- mark a task blocked, failed, closed, or cancelled;
- change Queue state;
- create hidden Queue tasks;
- execute tools;
- mutate files or Git;
- launch Terminal;
- read Finder state;
- request hidden context.

## Human Assistance

Human/operator assistance may provide missing input, approve a decision, change
configuration through explicit UI, or decide to pause, drain, stop, retry,
block, fail, or close work.

Human responses should still be recorded as assistance or decision context so
later Queue Coordinator decisions remain explainable.
