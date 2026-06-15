import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  appendAttempt,
  selectCurrentAttempt,
  type SmartQueueAttempt,
  type SmartQueueAttemptPromptOverride,
  type SmartQueueAttemptHistory,
} from "./smartQueueAttemptModel";
import type {
  SmartQueueCoordinatorDecision,
} from "./smartQueueCoordinatorDecision";
import {
  latestSmartQueueFailurePayloadForTask,
  parseSmartQueueRetryRecordPayload,
  type SmartQueueRetryModifiedPromptPayload,
  type SmartQueueRetrySamePayload,
  type SmartQueueWorkerFailurePayload,
} from "./smartQueueWorkerReportIntegration";

export type SmartQueueCannotRetryActionResult = {
  readonly ok: false;
  readonly message: "Cannot retry task";
  readonly reason: string;
  readonly task: AgentQueueTask;
};

export type SmartQueueRetrySameActionResult =
  | {
      readonly ok: true;
      readonly message: "Retry queued";
      readonly report: AgentQueueWorkerExecutionReport;
      readonly retryAttempt: SmartQueueAttempt;
      readonly task: AgentQueueTask;
    }
  | SmartQueueCannotRetryActionResult;

export type SmartQueueRetryModifiedPromptActionResult =
  | {
      readonly ok: true;
      readonly message: "Retry with changes queued";
      readonly modifiedPrompt: string;
      readonly originalPrompt: string;
      readonly report: AgentQueueWorkerExecutionReport;
      readonly retryAttempt: SmartQueueAttempt;
      readonly task: AgentQueueTask;
    }
  | SmartQueueCannotRetryActionResult;

export function canApplySmartQueueRetrySame(
  decision: SmartQueueCoordinatorDecision | null | undefined,
) {
  return Boolean(
    decision &&
      decision.availableActions.includes("retry_same") &&
      decision.retryPolicy.canRetry &&
      !decision.destructive,
  );
}

export function canApplySmartQueueRetryWithModifiedPrompt(
  decision: SmartQueueCoordinatorDecision | null | undefined,
) {
  return Boolean(
    decision &&
      decision.availableActions.includes("retry_with_modified_prompt") &&
      decision.retryPolicy.canRetry &&
      !decision.destructive,
  );
}

export function applySmartQueueRetrySameActionToTask({
  acceptedAt = new Date().toISOString(),
  attemptId,
  task,
}: {
  readonly acceptedAt?: string;
  readonly attemptId?: string;
  readonly task: AgentQueueTask;
}): SmartQueueRetrySameActionResult {
  const failurePayload = latestSmartQueueFailurePayloadForTask(task);

  if (!failurePayload) {
    return cannotRetry(task, "Smart Queue decision payload is unavailable.");
  }

  if (!canApplySmartQueueRetrySame(failurePayload.coordinatorDecision)) {
    return cannotRetry(task, retryUnavailableReason(failurePayload));
  }

  const history = smartQueueAttemptHistoryForTask(task);
  const nextAttemptId =
    attemptId ??
    smartQueueRetryAttemptId({
      acceptedAt,
      history,
      taskId: task.queueItemId,
    });
  const nextHistory = appendAttempt(history, {
    attemptId: nextAttemptId,
    coordinatorDecisionId: failurePayload.coordinatorDecision.decisionId,
    retrySource: "retry_same",
  });
  const retryAttempt = selectCurrentAttempt(nextHistory);

  if (!retryAttempt || retryAttempt.attemptId !== nextAttemptId) {
    return cannotRetry(task, "Retry attempt could not be prepared.");
  }

  const retryPayload: SmartQueueRetrySamePayload = {
    acceptedAction: "retry_same",
    acceptedAt,
    kind: "smart_queue_retry_same_record",
    previousAttemptId: failurePayload.attempt.attemptId,
    previousDecisionId: failurePayload.coordinatorDecision.decisionId,
    retryAttempt,
    sideEffects: {
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
      wouldLaunchTerminal: false,
    },
    taskId: task.queueItemId,
    version: 1,
  };
  const report = retrySameWorkerReport({
    acceptedAt,
    payload: retryPayload,
    task,
  });
  const updatedTask: AgentQueueTask = {
    ...task,
    coordinatorStatus: "not_reported",
    status: "ready",
    validationStatus: "not_started",
    workerExecutionReports: [...(task.workerExecutionReports ?? []), report],
  };

  return {
    message: "Retry queued",
    ok: true,
    report,
    retryAttempt,
    task: updatedTask,
  };
}

export function applySmartQueueRetryWithModifiedPromptActionToTask({
  acceptedAt = new Date().toISOString(),
  attemptId,
  modifiedPrompt,
  task,
}: {
  readonly acceptedAt?: string;
  readonly attemptId?: string;
  readonly modifiedPrompt: string;
  readonly task: AgentQueueTask;
}): SmartQueueRetryModifiedPromptActionResult {
  const cleanModifiedPrompt = modifiedPrompt.trim();

  if (!cleanModifiedPrompt) {
    return cannotRetry(
      task,
      "Enter a modified prompt before queueing retry.",
    );
  }

  const failurePayload = latestSmartQueueFailurePayloadForTask(task);

  if (!failurePayload) {
    return cannotRetry(task, "Smart Queue decision payload is unavailable.");
  }

  if (
    !canApplySmartQueueRetryWithModifiedPrompt(
      failurePayload.coordinatorDecision,
    )
  ) {
    return cannotRetry(task, retryUnavailableReason(failurePayload));
  }

  const originalPrompt = task.prompt;
  const promptOverride: SmartQueueAttemptPromptOverride = {
    kind: "operator_modified_retry_prompt",
    modifiedPrompt: cleanModifiedPrompt,
    originalPrompt,
    runnablePromptField: "task.prompt",
  };
  const history = smartQueueAttemptHistoryForTask(task);
  const nextAttemptId =
    attemptId ??
    smartQueueRetryAttemptId({
      acceptedAt,
      history,
      taskId: task.queueItemId,
    });
  const nextHistory = appendAttempt(history, {
    attemptId: nextAttemptId,
    coordinatorDecisionId: failurePayload.coordinatorDecision.decisionId,
    promptOverride,
    retrySource: "retry_with_modified_prompt",
  });
  const retryAttempt = selectCurrentAttempt(nextHistory);

  if (!retryAttempt || retryAttempt.attemptId !== nextAttemptId) {
    return cannotRetry(task, "Retry attempt could not be prepared.");
  }

  const retryPayload: SmartQueueRetryModifiedPromptPayload = {
    acceptedAction: "retry_with_modified_prompt",
    acceptedAt,
    kind: "smart_queue_retry_modified_prompt_record",
    modifiedPrompt: cleanModifiedPrompt,
    originalPrompt,
    previousAttemptId: failurePayload.attempt.attemptId,
    previousDecisionId: failurePayload.coordinatorDecision.decisionId,
    retryAttempt,
    sideEffects: {
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
      wouldLaunchTerminal: false,
    },
    taskId: task.queueItemId,
    version: 1,
  };
  const report = retryModifiedPromptWorkerReport({
    acceptedAt,
    payload: retryPayload,
    task,
  });
  const updatedTask: AgentQueueTask = {
    ...task,
    coordinatorStatus: "not_reported",
    prompt: cleanModifiedPrompt,
    status: "ready",
    validationStatus: "not_started",
    workerExecutionReports: [...(task.workerExecutionReports ?? []), report],
  };

  return {
    message: "Retry with changes queued",
    modifiedPrompt: cleanModifiedPrompt,
    ok: true,
    originalPrompt,
    report,
    retryAttempt,
    task: updatedTask,
  };
}

export function smartQueueAttemptHistoryForTask(
  task: Pick<AgentQueueTask, "queueItemId" | "workerExecutionReports">,
): SmartQueueAttemptHistory {
  const attempts = (task.workerExecutionReports ?? []).flatMap((report) => {
    const retryPayload = parseSmartQueueRetryRecordPayload(
      report.rawReportPreview,
    );

    if (retryPayload?.taskId === task.queueItemId) {
      return [retryPayload.retryAttempt];
    }

    const failurePayload = latestFailurePayloadFromSingleReport(report.rawReportPreview);

    if (failurePayload?.attempt.taskId === task.queueItemId) {
      return [failurePayload.attempt];
    }

    return [];
  });

  return {
    attempts,
    taskId: task.queueItemId,
  };
}

function latestFailurePayloadFromSingleReport(rawReportPreview: string | undefined) {
  return latestSmartQueueFailurePayloadForTask({
    workerExecutionReports: rawReportPreview
      ? [
          {
            changedFiles: [],
            commandsRun: [],
            createdAt: "",
            errors: [],
            itemId: "",
            rawReportPreview,
            reportId: "",
            reportStatus: "reported",
            summary: "",
            validationCommandsSuggested: [],
            warnings: [],
            workerId: "",
          },
        ]
      : [],
  });
}

function retrySameWorkerReport({
  acceptedAt,
  payload,
  task,
}: {
  readonly acceptedAt: string;
  readonly payload: SmartQueueRetrySamePayload;
  readonly task: AgentQueueTask;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: acceptedAt,
    errors: [],
    itemId: task.queueItemId,
    rawReportPreview: JSON.stringify(payload),
    reportId: `smart_queue_retry_same_${sanitizeIdPart(payload.retryAttempt.attemptId)}`,
    reportStatus: "reported",
    summary: "Retry queued",
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [
      "Task returned to Ready. Queue Active/Pause, dependency, blocker, and worker gates still control execution.",
    ],
    workerId:
      task.assignedWorkerId ??
      task.assignedExecutorWidgetId ??
      "agent-queue",
  };
}

function retryModifiedPromptWorkerReport({
  acceptedAt,
  payload,
  task,
}: {
  readonly acceptedAt: string;
  readonly payload: SmartQueueRetryModifiedPromptPayload;
  readonly task: AgentQueueTask;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: acceptedAt,
    errors: [],
    itemId: task.queueItemId,
    rawReportPreview: JSON.stringify(payload),
    reportId: `smart_queue_retry_modified_prompt_${sanitizeIdPart(payload.retryAttempt.attemptId)}`,
    reportStatus: "reported",
    summary: "Retry with changes queued",
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [
      "Task returned to Ready with the modified prompt. Queue Active/Pause, dependency, blocker, and worker gates still control execution.",
    ],
    workerId:
      task.assignedWorkerId ??
      task.assignedExecutorWidgetId ??
      "agent-queue",
  };
}

function smartQueueRetryAttemptId({
  acceptedAt,
  history,
  taskId,
}: {
  readonly acceptedAt: string;
  readonly history: SmartQueueAttemptHistory;
  readonly taskId: string;
}) {
  const nextNumber =
    history.attempts.reduce(
      (maxAttemptNumber, attempt) =>
        Math.max(maxAttemptNumber, attempt.attemptNumber),
      0,
    ) + 1;

  return [
    "smart-retry",
    sanitizeIdPart(taskId),
    nextNumber.toString(),
    sanitizeIdPart(acceptedAt),
  ].join(":");
}

function retryUnavailableReason(payload: SmartQueueWorkerFailurePayload) {
  if (!payload.coordinatorDecision.retryPolicy.canRetry) {
    return (
      payload.coordinatorDecision.retryPolicy.exhaustedReason ??
      "Retry limit reached."
    );
  }

  if (payload.coordinatorDecision.destructive) {
    return "Coordinator proposal is destructive.";
  }

  return "Coordinator decision does not allow Retry.";
}

function cannotRetry(
  task: AgentQueueTask,
  reason: string,
): SmartQueueCannotRetryActionResult {
  return {
    message: "Cannot retry task",
    ok: false,
    reason,
    task,
  };
}

function sanitizeIdPart(value: string) {
  return value.trim().replace(/[^a-z0-9_.:-]+/gi, "-") || "unknown";
}
