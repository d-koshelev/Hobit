import type { AgentQueueTask } from "../../workspace/types";
import type { SmartQueueTaskHumanStatus } from "../../workspace/types/smartQueue";
import {
  displayTaskTitle,
  normalizeCoordinatorStatus,
  normalizeTaskStatus,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";
import {
  addFollowUpPrompt,
  acknowledgeReviewMessage,
  approveValidation,
  attachCommitResult,
  blockQueueItem,
  canStartDependentAfterReviewGate,
  completeAgentPrompt,
  createDogfoodLifecycleItem,
  createReviewMessage,
  failAgentPrompt,
  failQueueItem,
  getLifecycleHumanStatus,
  getSmartQueueDogfoodLifecycleSideEffects,
  markAgentPromptNotCompleted,
  markQueueItemDone,
  queueDogfoodLifecycleItem,
  requestCommit,
  startQueueItemRun,
  type AcknowledgeReviewMessageInput,
  type AddFollowUpPromptInput,
  type AttachCommitResultInput,
  type CreateReviewMessageInput,
  type SmartQueueDogfoodLifecycleItem,
  type SmartQueueDogfoodReviewOutcome,
  type SmartQueueDogfoodTicketState,
  type SmartQueueLifecycleTransitionResult,
} from "./smartQueueDogfoodLifecycle";
import {
  computeSmartQueueDependencyGate,
} from "./smartQueueDependencyPropagation";
import type {
  SmartQueueDependency,
  SmartQueueDependencyGate,
  SmartQueueTaskInput,
  SmartQueueTaskLifecycle,
} from "./smartQueueEligibility";
import type { QueueTaskLifecycle } from "./queueV2LifecycleModel";
import type { QueueWorkerEvidenceBundle } from "./smartQueueWorkerEvidenceBundle";

export type QueueTaskDogfoodLifecycleSource =
  | ReadonlyMap<string, SmartQueueDogfoodLifecycleItem>
  | Readonly<Record<string, SmartQueueDogfoodLifecycleItem>>
  | readonly SmartQueueDogfoodLifecycleItem[];

export type QueueTaskDogfoodLifecyclePresentation = {
  readonly additionalPromptCount: number;
  readonly agentPromptLabel: string;
  readonly agentPromptState: SmartQueueDogfoodLifecycleItem["agentPromptState"];
  readonly detail: string | null;
  readonly doneGatedForDependents: boolean;
  readonly humanStatus: {
    readonly detail: string | null;
    readonly label: string;
    readonly status: SmartQueueTaskHumanStatus;
    readonly text: string;
  };
  readonly inReview: boolean;
  readonly awaitingReview: boolean;
  readonly followUpPromptRunning: boolean;
  readonly primaryLabel: string;
  readonly reviewLabel: string | null;
  readonly reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  readonly secondaryLabels: readonly string[];
  readonly sideEffects: SmartQueueDogfoodLifecycleItem["sideEffects"];
  readonly taskId: string;
  readonly text: string;
  readonly ticketLabel: string;
  readonly ticketState: SmartQueueDogfoodTicketState;
};

export type QueueTaskDogfoodLifecycleOverlay = {
  readonly lifecycle: SmartQueueDogfoodLifecycleItem;
  readonly presentation: QueueTaskDogfoodLifecyclePresentation;
  readonly task: AgentQueueTask;
  readonly taskId: string;
};

export type QueueTaskDogfoodDependencyGate = {
  readonly canStart: boolean;
  readonly gate: SmartQueueDependencyGate;
  readonly reason: string;
};

export type QueueDogfoodLifecycleTransition =
  | { readonly type: "queue"; readonly queuedAt: string }
  | {
      readonly attemptId?: string;
      readonly runnablePrompt?: string;
      readonly startedAt: string;
      readonly threadId?: string;
      readonly type: "start_run";
    }
  | ({ readonly type: "agent_finished" } & ApplyAgentFinishedInput)
  | ({ readonly type: "create_review_message" } & CreateReviewMessageInput)
  | ({ readonly type: "coordinator_ack" } & AcknowledgeReviewMessageInput)
  | ({ readonly type: "approve_validation" } & ApplyValidationApprovalInput)
  | ({ readonly type: "request_commit" } & ApplyCommitRequestInput)
  | ({ readonly type: "attach_fake_commit_result" } & AttachCommitResultInput)
  | ({ readonly type: "mark_done" } & ApplyDoneDecisionInput)
  | ({ readonly type: "follow_up_prompt" } & AddFollowUpPromptInput)
  | ({ readonly type: "block" } & ApplyBlockDecisionInput)
  | ({ readonly type: "fail" } & ApplyFailDecisionInput);

export type ApplyAgentFinishedInput = {
  readonly attemptId?: string;
  readonly changedFilesSummary?: string;
  readonly finalAgentMessage: string;
  readonly finishedAt: string;
  readonly outcome: SmartQueueDogfoodReviewOutcome;
  readonly threadId?: string;
  readonly validationSummary?: string;
  readonly workerEvidenceBundle?: QueueWorkerEvidenceBundle;
};

export type ApplyValidationApprovalInput = {
  readonly approvedAt: string;
  readonly approvedByCoordinatorAgentId: string;
  readonly decisionId?: string;
  readonly summary: string;
  readonly validationApprovalId: string;
};

export type ApplyCommitRequestInput = {
  readonly commitRequestId: string;
  readonly createdAt: string;
  readonly decisionId?: string;
  readonly reason: string;
  readonly requestedByCoordinatorAgentId: string;
};

export type ApplyDoneDecisionInput = {
  readonly commitAttachedAt: string;
  readonly commitHash?: string;
  readonly commitRequestCreatedAt: string;
  readonly commitRequestId: string;
  readonly commitRequestReason: string;
  readonly commitResultId: string;
  readonly commitResultSummary: string;
  readonly completedAt: string;
  readonly coordinatorAgentId: string;
  readonly decisionId: string;
  readonly reason: string;
  readonly validationApprovedAt: string;
  readonly validationApprovalId: string;
  readonly validationSummary: string;
};

export type ApplyBlockDecisionInput = {
  readonly blockedAt: string;
  readonly coordinatorAgentId: string;
  readonly decisionId: string;
  readonly reason: string;
};

export type ApplyFailDecisionInput = {
  readonly coordinatorAgentId: string;
  readonly decisionId: string;
  readonly failedAt: string;
  readonly reason: string;
};

export type QueueDogfoodLifecycleControllerSelfTestReport = {
  readonly additionalPromptCount: number;
  readonly dependentAfterDoneStartable: boolean;
  readonly dependentBeforeDoneStartable: boolean;
  readonly followUpReturnedToRunning: boolean;
  readonly reportId: string;
  readonly sideEffects: SmartQueueDogfoodLifecycleItem["sideEffects"];
  readonly status: "passed" | "failed";
  readonly summary: string;
};

export function createLifecycleForQueueTask(
  task: AgentQueueTask,
  options: { readonly createdAt?: string } = {},
): SmartQueueDogfoodLifecycleItem {
  return createDogfoodLifecycleItem({
    createdAt: options.createdAt ?? task.createdAt,
    originalPrompt: task.prompt,
    taskId: task.queueItemId,
    title: displayTaskTitle(task),
  });
}

export function deriveLifecycleFromQueueTask(
  task: AgentQueueTask,
  lifecycle?: SmartQueueDogfoodLifecycleItem | null,
): SmartQueueDogfoodLifecycleItem {
  if (lifecycle?.taskId === task.queueItemId) {
    return lifecycle;
  }

  const base = createLifecycleForQueueTask(task);
  const status = normalizeTaskStatus(task.status);
  const coordinatorStatus = normalizeCoordinatorStatus(task.coordinatorStatus);
  const validationStatus = normalizeValidationStatus(task.validationStatus);
  const updatedAt = task.updatedAt || task.createdAt;

  if (status === "draft") {
    return base;
  }

  if (status === "queued" || status === "ready") {
    return {
      ...base,
      ticketState: "queued",
      updatedAt,
    };
  }

  if (status === "running") {
    return {
      ...base,
      agentPromptState: "running",
      currentRunnablePrompt: task.prompt,
      ticketState: "running",
      updatedAt,
    };
  }

  if (status === "failed") {
    return {
      ...base,
      agentPromptState: "failed",
      failureReason: latestQueueReportSummary(task) ?? "Task failed.",
      reviewOutcome: "failed",
      ticketState: "failure",
      updatedAt,
    };
  }

  if (status === "cancelled") {
    return {
      ...base,
      agentPromptState: "not_completed",
      failureReason: "Task was cancelled.",
      reviewOutcome: "not_completed",
      ticketState: "failure",
      updatedAt,
    };
  }

  if (status === "completed" || status === "review_needed") {
    const reviewOutcome: SmartQueueDogfoodReviewOutcome =
      validationStatus === "failed" ? "failed" : "completed";

    return {
      ...base,
      agentPromptState:
        reviewOutcome === "failed" ? "failed" : "completed",
      changedFilesSummary: changedFilesSummaryForTask(task),
      finalAgentMessage:
        latestQueueReportSummary(task) ??
        (status === "review_needed"
          ? "Task output is ready for review."
          : "Task completed."),
      reviewOutcome,
      ticketState: derivedReviewTicketState(coordinatorStatus),
      updatedAt,
      validationSummary: validationSummaryForTask(task),
    };
  }

  return base;
}

export function createDogfoodLifecycleOverlayForQueueTask(
  task: AgentQueueTask,
  source?: QueueTaskDogfoodLifecycleSource | null,
): QueueTaskDogfoodLifecycleOverlay {
  const lifecycle = deriveLifecycleFromQueueTask(
    task,
    findDogfoodLifecycleForTask(task.queueItemId, source),
  );

  return {
    lifecycle,
    presentation: getQueueTaskDogfoodLifecyclePresentation(lifecycle),
    task,
    taskId: task.queueItemId,
  };
}

export function findDogfoodLifecycleForTask(
  taskId: string,
  source?: QueueTaskDogfoodLifecycleSource | null,
) {
  if (!source) {
    return null;
  }

  if (isDogfoodLifecycleMap(source)) {
    return source.get(taskId) ?? null;
  }

  if (Array.isArray(source)) {
    return source.find((candidate) => candidate.taskId === taskId) ?? null;
  }

  const record = source as Readonly<Record<string, SmartQueueDogfoodLifecycleItem>>;
  return record[taskId] ?? null;
}

function isDogfoodLifecycleMap(
  source: QueueTaskDogfoodLifecycleSource,
): source is ReadonlyMap<string, SmartQueueDogfoodLifecycleItem> {
  return typeof (source as { get?: unknown }).get === "function";
}

export function applyDogfoodLifecycleTransition(
  item: SmartQueueDogfoodLifecycleItem,
  transition: QueueDogfoodLifecycleTransition,
): SmartQueueLifecycleTransitionResult<unknown> {
  switch (transition.type) {
    case "queue":
      return queueDogfoodLifecycleItem(item, transition.queuedAt);
    case "start_run":
      return startQueueItemRun(item, transition);
    case "agent_finished":
      return applyAgentFinishedToQueueLifecycle(item, transition);
    case "create_review_message":
      return createReviewMessage(item, transition);
    case "coordinator_ack":
      return applyCoordinatorAckToQueueLifecycle(item, transition);
    case "approve_validation":
      return approveValidation(item, transition);
    case "request_commit":
      return requestCommit(item, transition);
    case "attach_fake_commit_result":
      return attachCommitResult(item, transition);
    case "mark_done":
      return applyCoordinatorDoneDecisionToQueueLifecycle(item, transition);
    case "follow_up_prompt":
      return applyCoordinatorFollowUpDecisionToQueueLifecycle(item, transition);
    case "block":
      return blockQueueItem(item, transition);
    case "fail":
      return failQueueItem(item, transition);
  }
}

export function applyAgentFinishedToQueueLifecycle(
  item: SmartQueueDogfoodLifecycleItem,
  input: ApplyAgentFinishedInput,
) {
  switch (input.outcome) {
    case "completed":
      return completeAgentPrompt(item, {
        attemptId: input.attemptId,
        changedFilesSummary: input.changedFilesSummary,
        completedAt: input.finishedAt,
        finalAgentMessage: input.finalAgentMessage,
        threadId: input.threadId,
        validationSummary: input.validationSummary,
        workerEvidenceBundle: input.workerEvidenceBundle,
      });
    case "not_completed":
      return markAgentPromptNotCompleted(item, {
        attemptId: input.attemptId,
        changedFilesSummary: input.changedFilesSummary,
        completedAt: input.finishedAt,
        finalAgentMessage: input.finalAgentMessage,
        threadId: input.threadId,
        validationSummary: input.validationSummary,
        workerEvidenceBundle: input.workerEvidenceBundle,
      });
    case "failed":
      return failAgentPrompt(item, {
        attemptId: input.attemptId,
        changedFilesSummary: input.changedFilesSummary,
        failedAt: input.finishedAt,
        finalAgentMessage: input.finalAgentMessage,
        threadId: input.threadId,
        validationSummary: input.validationSummary,
        workerEvidenceBundle: input.workerEvidenceBundle,
      });
  }
}

export function applyCoordinatorAckToQueueLifecycle(
  item: SmartQueueDogfoodLifecycleItem,
  input: AcknowledgeReviewMessageInput,
) {
  return acknowledgeReviewMessage(item, input);
}

export function applyCoordinatorDoneDecisionToQueueLifecycle(
  item: SmartQueueDogfoodLifecycleItem,
  input: ApplyDoneDecisionInput,
): SmartQueueLifecycleTransitionResult<unknown> {
  const approved = approveValidation(item, {
    approvedAt: input.validationApprovedAt,
    approvedByCoordinatorAgentId: input.coordinatorAgentId,
    summary: input.validationSummary,
    validationApprovalId: input.validationApprovalId,
  });

  if (!approved.ok) {
    return approved;
  }

  const commitRequested = requestCommit(approved.item, {
    commitRequestId: input.commitRequestId,
    createdAt: input.commitRequestCreatedAt,
    reason: input.commitRequestReason,
    requestedByCoordinatorAgentId: input.coordinatorAgentId,
  });

  if (!commitRequested.ok) {
    return commitRequested;
  }

  const commitAttached = attachCommitResult(commitRequested.item, {
    attachedAt: input.commitAttachedAt,
    commitHash: input.commitHash,
    commitRequestId: input.commitRequestId,
    commitResultId: input.commitResultId,
    status: "success",
    summary: input.commitResultSummary,
  });

  if (!commitAttached.ok) {
    return commitAttached;
  }

  return markQueueItemDone(commitAttached.item, {
    completedAt: input.completedAt,
    coordinatorAgentId: input.coordinatorAgentId,
    decisionId: input.decisionId,
    reason: input.reason,
  });
}

export function applyCoordinatorFollowUpDecisionToQueueLifecycle(
  item: SmartQueueDogfoodLifecycleItem,
  input: AddFollowUpPromptInput,
) {
  return addFollowUpPrompt(item, input);
}

export function canQueueTaskStartByDogfoodLifecycleGate({
  lifecycles,
  task,
  tasks,
}: {
  readonly lifecycles?: QueueTaskDogfoodLifecycleSource | null;
  readonly task: AgentQueueTask;
  readonly tasks: readonly AgentQueueTask[];
}) {
  return getQueueTaskDogfoodDependencyGate({
    lifecycles,
    task,
    tasks,
  }).canStart;
}

export function getQueueTaskDogfoodDependencyGate({
  lifecycles,
  task,
  tasks,
}: {
  readonly lifecycles?: QueueTaskDogfoodLifecycleSource | null;
  readonly task: AgentQueueTask;
  readonly tasks: readonly AgentQueueTask[];
}): QueueTaskDogfoodDependencyGate {
  const dependencies = smartQueueDependenciesForQueueTasks(tasks);
  const smartTasks = tasks.map((candidate) =>
    smartQueueTaskInputForQueueTaskDogfoodLifecycle(
      candidate,
      findDogfoodLifecycleForTask(candidate.queueItemId, lifecycles),
    ),
  );
  const smartTask =
    smartTasks.find((candidate) => candidate.taskId === task.queueItemId) ??
    smartQueueTaskInputForQueueTaskDogfoodLifecycle(
      task,
      findDogfoodLifecycleForTask(task.queueItemId, lifecycles),
    );
  const gate = computeSmartQueueDependencyGate(
    smartTask,
    smartTasks,
    dependencies,
  );

  return {
    canStart: gate.gate === "none" || gate.gate === "satisfied",
    gate,
    reason: dogfoodDependencyGateReason(gate),
  };
}

export function smartQueueTaskInputForQueueTaskDogfoodLifecycle(
  task: AgentQueueTask,
  lifecycle?: SmartQueueDogfoodLifecycleItem | null,
): SmartQueueTaskInput {
  const dogfoodLifecycle = deriveLifecycleFromQueueTask(task, lifecycle);

  return {
    blockers: [],
    lifecycle: smartLifecycleForDogfoodLifecycle(dogfoodLifecycle),
    taskId: task.queueItemId,
    title: displayTaskTitle(task),
  };
}

export function queueV2LifecycleForDogfoodLifecycle(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): QueueTaskLifecycle {
  switch (lifecycle.ticketState) {
    case "draft":
      return "draft";
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "awaiting_review":
    case "in_review":
      return "review_required";
    case "done":
      return "finalized";
    case "failure":
      return "failed";
    case "blocked":
      return "blocked";
  }
}

export function getQueueTaskDogfoodLifecyclePresentation(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): QueueTaskDogfoodLifecyclePresentation {
  const status = getLifecycleHumanStatus(lifecycle);
  const humanStatus = queueHumanStatusForDogfoodLifecycle(lifecycle);
  const agentPromptLabel =
    lifecycle.agentPromptState === "additional_prompt_running"
      ? "Follow-up prompt running"
      : status.agentPromptLabel;
  const reviewLabel = reviewLabelForLifecycle(lifecycle, status.reviewLabel);
  const secondaryLabels = [
    lifecycle.agentPromptState !== "idle" && agentPromptLabel !== humanStatus.label
      ? agentPromptLabel
      : null,
    reviewLabel && reviewLabel !== humanStatus.label ? reviewLabel : null,
    lifecycle.additionalPromptCount > 0
      ? `Additional prompts: ${lifecycle.additionalPromptCount.toString()}`
      : null,
  ].filter((label): label is string => Boolean(label));

  return {
    additionalPromptCount: lifecycle.additionalPromptCount,
    agentPromptLabel,
    agentPromptState: lifecycle.agentPromptState,
    awaitingReview: lifecycle.ticketState === "awaiting_review",
    detail: humanStatus.detail,
    doneGatedForDependents: canStartDependentAfterReviewGate(lifecycle),
    followUpPromptRunning:
      lifecycle.agentPromptState === "additional_prompt_running",
    humanStatus,
    inReview: lifecycle.ticketState === "in_review",
    primaryLabel: humanStatus.label,
    reviewLabel,
    reviewOutcome: lifecycle.reviewOutcome ?? null,
    secondaryLabels,
    sideEffects: lifecycle.sideEffects,
    taskId: lifecycle.taskId,
    text: [humanStatus.label, ...secondaryLabels].join(" - "),
    ticketLabel: status.ticketLabel,
    ticketState: lifecycle.ticketState,
  };
}

export function runFakeQueueDogfoodLifecycleControllerSelfTest():
  QueueDogfoodLifecycleControllerSelfTestReport {
  const rootTask = fakeQueueTask({
    prompt: "Implement root task.",
    queueItemId: "task-root",
    title: "Root task",
  });
  const dependentTask = fakeQueueTask({
    dependsOn: ["task-root"],
    prompt: "Implement dependent task.",
    queueItemId: "task-dependent",
    title: "Dependent task",
  });
  const runningRoot = mustTransition(
    applyDogfoodLifecycleTransition(
      mustTransition(
        applyDogfoodLifecycleTransition(
          createLifecycleForQueueTask(rootTask),
          { queuedAt: "2026-06-16T00:01:00.000Z", type: "queue" },
        ),
      ),
      {
        attemptId: "attempt-root-1",
        startedAt: "2026-06-16T00:02:00.000Z",
        threadId: "thread-root",
        type: "start_run",
      },
    ),
  );
  const awaitingReviewRoot = mustTransition(
    applyAgentFinishedToQueueLifecycle(runningRoot, {
      changedFilesSummary: "Changed files: 1",
      finalAgentMessage: "Root task completed.",
      finishedAt: "2026-06-16T00:10:00.000Z",
      outcome: "completed",
      validationSummary: "Validation passed.",
    }),
  );
  const dependentBeforeDoneStartable = canQueueTaskStartByDogfoodLifecycleGate({
    lifecycles: [awaitingReviewRoot],
    task: dependentTask,
    tasks: [rootTask, dependentTask],
  });
  const inReviewRoot = mustTransition(
    applyCoordinatorAckToQueueLifecycle(
      mustTransition(
        createReviewMessage(awaitingReviewRoot, {
          createdAt: "2026-06-16T00:11:00.000Z",
          messageId: "review-message-root",
          toCoordinatorAgentId: "coordinator-1",
        }),
      ),
      {
        ackId: "ack-root",
        coordinatorAgentId: "coordinator-1",
        messageId: "review-message-root",
        receivedAt: "2026-06-16T00:12:00.000Z",
      },
    ),
  );
  const doneRoot = mustTransition(
    applyCoordinatorDoneDecisionToQueueLifecycle(inReviewRoot, {
      commitAttachedAt: "2026-06-16T00:15:00.000Z",
      commitHash: "fake123",
      commitRequestCreatedAt: "2026-06-16T00:14:00.000Z",
      commitRequestId: "commit-request-root",
      commitRequestReason: "Attach fake commit result.",
      commitResultId: "commit-result-root",
      commitResultSummary: "Fake commit result attached.",
      completedAt: "2026-06-16T00:16:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-root-done",
      reason: "Accepted.",
      validationApprovedAt: "2026-06-16T00:13:00.000Z",
      validationApprovalId: "validation-root",
      validationSummary: "Validation approved.",
    }),
  );
  const dependentAfterDoneStartable = canQueueTaskStartByDogfoodLifecycleGate({
    lifecycles: [doneRoot],
    task: dependentTask,
    tasks: [rootTask, dependentTask],
  });
  const followUpRunning = runFakeFollowUpBranch();
  const passed =
    !dependentBeforeDoneStartable &&
    dependentAfterDoneStartable &&
    followUpRunning.ticketState === "running" &&
    followUpRunning.agentPromptState === "additional_prompt_running" &&
    followUpRunning.additionalPromptCount === 1;

  return {
    additionalPromptCount: followUpRunning.additionalPromptCount,
    dependentAfterDoneStartable,
    dependentBeforeDoneStartable,
    followUpReturnedToRunning: followUpRunning.ticketState === "running",
    reportId: "smart-queue-dogfood-lifecycle-controller:self-test",
    sideEffects: getSmartQueueDogfoodLifecycleSideEffects(),
    status: passed ? "passed" : "failed",
    summary: passed
      ? "Queue dogfood lifecycle controller self-test passed."
      : "Queue dogfood lifecycle controller self-test failed.",
  };
}

function smartLifecycleForDogfoodLifecycle(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): SmartQueueTaskLifecycle {
  switch (lifecycle.ticketState) {
    case "done":
      return "closed";
    case "failure":
      return "failed";
    case "blocked":
      return "blocked";
    case "running":
      return "running";
    case "awaiting_review":
    case "in_review":
      return "review";
    case "draft":
      return "draft";
    case "queued":
      return "queued";
  }
}

function queueHumanStatusForDogfoodLifecycle(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): QueueTaskDogfoodLifecyclePresentation["humanStatus"] {
  const status = getLifecycleHumanStatus(lifecycle);
  const reviewLabel = reviewLabelForLifecycle(lifecycle, status.reviewLabel);

  switch (lifecycle.ticketState) {
    case "draft":
      return humanStatus("ready", "Draft");
    case "queued":
      return humanStatus("ready", "Queued");
    case "running":
      return humanStatus(
        "running",
        lifecycle.agentPromptState === "additional_prompt_running"
          ? "Follow-up prompt running"
          : "Running",
      );
    case "awaiting_review":
      return humanStatus(
        "review",
        "Awaiting review",
        reviewLabel ?? "Waiting for coordinator review",
      );
    case "in_review":
      return humanStatus(
        "review",
        "In review",
        reviewLabel ?? "Review acknowledged",
      );
    case "done":
      return humanStatus("closed", "Done");
    case "failure":
      return humanStatus("failed", "Failure");
    case "blocked":
      return humanStatus(
        "blocked",
        "Blocked",
        lifecycle.blockedReason ?? null,
      );
  }
}

function humanStatus(
  status: SmartQueueTaskHumanStatus,
  label: string,
  detail: string | null = null,
) {
  return {
    detail,
    label,
    status,
    text: label,
  };
}

function reviewLabelForLifecycle(
  lifecycle: SmartQueueDogfoodLifecycleItem,
  _modelLabel: string | undefined,
) {
  if (lifecycle.ticketState === "awaiting_review") {
    return "Waiting for coordinator review";
  }

  if (lifecycle.ticketState === "in_review") {
    return "Review acknowledged";
  }

  return null;
}

function derivedReviewTicketState(
  coordinatorStatus: ReturnType<typeof normalizeCoordinatorStatus>,
): SmartQueueDogfoodTicketState {
  switch (coordinatorStatus) {
    case "finalized":
      return "done";
    case "failed":
      return "failure";
    case "blocked":
      return "blocked";
    case "awaiting_validation":
    case "ready_for_finalization":
    case "needs_changes":
    case "follow_up_required":
    case "rollback_required":
      return "in_review";
    case "awaiting_coordinator_review":
    case "worker_reported":
    case "not_reported":
    default:
      return "awaiting_review";
  }
}

function smartQueueDependenciesForQueueTasks(
  tasks: readonly AgentQueueTask[],
): SmartQueueDependency[] {
  return tasks.flatMap((task) =>
    (task.dependsOn ?? [])
      .map((upstreamTaskId) => upstreamTaskId.trim())
      .filter(Boolean)
      .map((upstreamTaskId) => ({
        downstreamTaskId: task.queueItemId,
        kind: "blocks_start" as const,
        upstreamTaskId,
      })),
  );
}

function dogfoodDependencyGateReason(gate: SmartQueueDependencyGate) {
  switch (gate.gate) {
    case "none":
      return "No dependencies";
    case "satisfied":
      return "Dogfood dependencies done";
    case "waiting":
      return "Waiting for dogfood dependency done";
    case "blocked":
      return "Blocked by dogfood dependency";
    case "failed":
      return "Blocked by failed dogfood dependency";
  }
}

function latestQueueReportSummary(task: AgentQueueTask) {
  const report =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ??
    null;

  return report?.summary?.trim() || null;
}

function changedFilesSummaryForTask(task: AgentQueueTask) {
  const report =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ??
    null;

  if (!report || report.changedFiles.length === 0) {
    return undefined;
  }

  return `Changed files: ${report.changedFiles.length.toString()}`;
}

function validationSummaryForTask(task: AgentQueueTask) {
  const validationStatus = normalizeValidationStatus(task.validationStatus);
  const report =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ??
    null;

  return report?.validationResult
    ? `Validation ${report.validationResult}.`
    : validationStatus !== "not_started"
      ? `Validation ${validationStatus}.`
      : undefined;
}

function runFakeFollowUpBranch() {
  const task = fakeQueueTask({
    prompt: "Implement follow-up branch.",
    queueItemId: "task-follow-up",
    title: "Follow-up task",
  });
  const running = mustTransition(
    startQueueItemRun(
      mustTransition(
        queueDogfoodLifecycleItem(
          createLifecycleForQueueTask(task),
          "2026-06-16T00:01:00.000Z",
        ),
      ),
      {
        attemptId: "attempt-follow-up-1",
        startedAt: "2026-06-16T00:02:00.000Z",
        threadId: "thread-follow-up",
      },
    ),
  );
  const awaitingReview = mustTransition(
    completeAgentPrompt(running, {
      completedAt: "2026-06-16T00:10:00.000Z",
      finalAgentMessage: "Needs follow-up.",
    }),
  );
  const inReview = mustTransition(
    acknowledgeReviewMessage(
      mustTransition(
        createReviewMessage(awaitingReview, {
          createdAt: "2026-06-16T00:11:00.000Z",
          messageId: "review-message-follow-up",
          toCoordinatorAgentId: "coordinator-1",
        }),
      ),
      {
        ackId: "ack-follow-up",
        coordinatorAgentId: "coordinator-1",
        messageId: "review-message-follow-up",
        receivedAt: "2026-06-16T00:12:00.000Z",
      },
    ),
  );

  return mustTransition(
    applyCoordinatorFollowUpDecisionToQueueLifecycle(inReview, {
      createdAt: "2026-06-16T00:13:00.000Z",
      createdByCoordinatorAgentId: "coordinator-1",
      followUpPromptId: "follow-up-1",
      prompt: "Continue with a narrower follow-up.",
    }),
  );
}

function mustTransition<TPayload>(
  result: SmartQueueLifecycleTransitionResult<TPayload>,
) {
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Expected dogfood transition success.");
  }

  return result.item;
}

function fakeQueueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-06-16T00:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Run task.",
    queueItemId: "task",
    status: "queued",
    title: "Task",
    updatedAt: "2026-06-16T00:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
