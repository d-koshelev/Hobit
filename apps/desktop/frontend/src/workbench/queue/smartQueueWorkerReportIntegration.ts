import type {
  AgentQueueCoordinatorStatus,
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  attachCoordinatorDecisionToAttempt,
  createInitialAttempt,
  createWorkerReportFromAttemptFailure,
  finishAttemptFailure,
  startAttempt,
  type SmartQueueAttempt,
  type SmartQueueAttemptFailureKind,
} from "./smartQueueAttemptModel";
import {
  decideSmartQueueCoordinatorAction,
  type SmartQueueCoordinatorDecision,
  type SmartQueueWorkerReport,
  type SmartQueueWorkerReportStage,
} from "./smartQueueCoordinatorDecision";

export type SmartQueueFailureIntegrationInput = {
  readonly attemptId?: string;
  readonly changedFiles?: readonly string[];
  readonly createdAt?: string;
  readonly evidenceSummary?: string;
  readonly failureKind?: SmartQueueAttemptFailureKind;
  readonly finalStatus?: string | null;
  readonly maxRetries?: number;
  readonly reason: string;
  readonly retryCount?: number;
  readonly runId?: string | null;
  readonly stage?: SmartQueueWorkerReportStage;
  readonly task: AgentQueueTask;
  readonly workerId?: string | null;
};

export type SmartQueueFailureTaskPatch = {
  readonly coordinatorStatus: AgentQueueCoordinatorStatus;
  readonly status: AgentQueueTaskStatus;
  readonly validationStatus: AgentQueueTaskValidationStatus;
  readonly workerExecutionReport: AgentQueueWorkerExecutionReport;
};

export type SmartQueueWorkerFailurePayload = {
  readonly kind: "smart_queue_worker_failure_report";
  readonly version: 1;
  readonly attempt: SmartQueueAttempt;
  readonly coordinatorDecision: SmartQueueCoordinatorDecision;
  readonly queueDetail: string;
  readonly queueStatus: string;
  readonly workerReport: SmartQueueWorkerReport;
  readonly sideEffects: {
    readonly wouldCallWorkspaceAgent: false;
    readonly wouldExecuteRetry: false;
    readonly wouldExecuteRollback: false;
    readonly wouldMutateQueue: false;
    readonly wouldStartWorker: false;
  };
};

export type SmartQueueRetrySamePayload = {
  readonly kind: "smart_queue_retry_same_record";
  readonly version: 1;
  readonly acceptedAction: "retry_same";
  readonly acceptedAt: string;
  readonly previousAttemptId?: string;
  readonly previousDecisionId: string;
  readonly retryAttempt: SmartQueueAttempt;
  readonly taskId: string;
  readonly sideEffects: {
    readonly wouldCallWorkspaceAgent: false;
    readonly wouldExecuteRetry: false;
    readonly wouldExecuteRollback: false;
    readonly wouldLaunchTerminal: false;
    readonly wouldMutateGit: false;
    readonly wouldMutateQueue: true;
    readonly wouldStartWorker: false;
  };
};

export type SmartQueueFailureIntegrationResult =
  SmartQueueWorkerFailurePayload & {
    readonly taskPatch: SmartQueueFailureTaskPatch;
  };

export function buildSmartQueueWorkerFailureIntegration(
  input: SmartQueueFailureIntegrationInput,
): SmartQueueFailureIntegrationResult {
  const failureKind =
    input.failureKind ?? classifySmartQueueFailure(input.reason, input.finalStatus);
  const attemptId =
    input.attemptId ??
    smartQueueAttemptId({
      failureKind,
      runId: input.runId,
      taskId: input.task.queueItemId,
    });
  const createdAt = input.createdAt ?? new Date().toISOString();
  const startedAttempt = startAttempt(
    createInitialAttempt({
      attemptId,
      taskId: input.task.queueItemId,
    }),
    {
      changedFiles: input.changedFiles,
      startedAt: createdAt,
      workerId: input.workerId ?? workerIdForTask(input.task),
    },
  );
  const failedAttempt = finishAttemptFailure(startedAttempt, {
    changedFiles: input.changedFiles,
    failureKind,
    finishedAt: createdAt,
    result: {
      evidence: [input.reason],
      summary: input.evidenceSummary ?? input.reason,
    },
    shortReason: productReasonForFailure(failureKind, input.reason),
    validationResult:
      failureKind === "validation_failure"
        ? {
            evidence: [input.reason],
            status: "failed",
            summary: input.evidenceSummary ?? input.reason,
          }
        : undefined,
  });
  const workerReport = createWorkerReportFromAttemptFailure({
    attempt: failedAttempt,
    evidenceSummary: input.evidenceSummary ?? input.reason,
    stage: input.stage,
  });

  if (!workerReport) {
    throw new Error("Smart Queue failure integration requires a failed attempt.");
  }

  const coordinatorDecision = decideSmartQueueCoordinatorAction({
    maxRetries: input.maxRetries ?? 1,
    report: workerReport,
    retryCount: input.retryCount ?? countPriorSmartQueueFailures(input.task),
  });
  const attempt = attachCoordinatorDecisionToAttempt(
    failedAttempt,
    coordinatorDecision.decisionId,
  );
  const queueStatus = coordinatorDecision.productLabel;
  const queueDetail = queueDetailForDecision(coordinatorDecision);
  const payload: SmartQueueWorkerFailurePayload = {
    attempt,
    coordinatorDecision,
    kind: "smart_queue_worker_failure_report",
    queueDetail,
    queueStatus,
    sideEffects: {
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldMutateQueue: false,
      wouldStartWorker: false,
    },
    version: 1,
    workerReport,
  };
  const taskPatch: SmartQueueFailureTaskPatch = {
    coordinatorStatus: coordinatorStatusForDecision(coordinatorDecision),
    status: statusForFailure(input.task.status),
    validationStatus: validationStatusForDecision(coordinatorDecision),
    workerExecutionReport: workerExecutionReportForSmartQueueFailure({
      createdAt,
      input,
      payload,
    }),
  };

  return {
    ...payload,
    taskPatch,
  };
}

export function classifySmartQueueFailure(
  reason: string,
  finalStatus?: string | null,
): SmartQueueAttemptFailureKind {
  const text = `${finalStatus ?? ""} ${reason}`.toLowerCase();

  if (/\bvalidation\b/.test(text) && /\b(failed|failure|error)\b/.test(text)) {
    return "validation_failure";
  }

  if (/\b(missing|not configured|required)\b/.test(text)) {
    if (/\b(config|configuration|setting|workspace|repo|repository|codex|sandbox|approval)\b/.test(text)) {
      return "missing_config";
    }
  }

  if (/\bdirty\b/.test(text) || /\b(worktree|working tree)\b/.test(text)) {
    return "dirty_worktree";
  }

  if (/\b(timed_out|timeout|timed out)\b/.test(text)) {
    return "timeout";
  }

  if (/\b(tool|command|executable|codex|spawn|failed_to_start|not found)\b/.test(text)) {
    return "tool_failure";
  }

  if (/\b(failed|failure|error|cancelled|canceled)\b/.test(text)) {
    return "execution_failure";
  }

  return "unknown";
}

export function parseSmartQueueWorkerFailurePayload(
  rawReportPreview: string | null | undefined,
): SmartQueueWorkerFailurePayload | null {
  if (!rawReportPreview?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawReportPreview) as Partial<SmartQueueWorkerFailurePayload>;

    if (
      parsed.kind !== "smart_queue_worker_failure_report" ||
      parsed.version !== 1 ||
      !parsed.attempt ||
      !parsed.workerReport ||
      !parsed.coordinatorDecision
    ) {
      return null;
    }

    return parsed as SmartQueueWorkerFailurePayload;
  } catch {
    return null;
  }
}

export function parseSmartQueueRetrySamePayload(
  rawReportPreview: string | null | undefined,
): SmartQueueRetrySamePayload | null {
  if (!rawReportPreview?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawReportPreview) as Partial<SmartQueueRetrySamePayload>;

    if (
      parsed.kind !== "smart_queue_retry_same_record" ||
      parsed.version !== 1 ||
      parsed.acceptedAction !== "retry_same" ||
      !parsed.previousDecisionId ||
      !parsed.retryAttempt ||
      !parsed.taskId
    ) {
      return null;
    }

    return parsed as SmartQueueRetrySamePayload;
  } catch {
    return null;
  }
}

export function latestSmartQueueFailurePayloadForTask(
  task: Pick<AgentQueueTask, "workerExecutionReports">,
): SmartQueueWorkerFailurePayload | null {
  const reports = task.workerExecutionReports ?? [];

  for (let index = reports.length - 1; index >= 0; index -= 1) {
    const retryPayload = parseSmartQueueRetrySamePayload(
      reports[index]?.rawReportPreview,
    );

    if (retryPayload) {
      return null;
    }

    const payload = parseSmartQueueWorkerFailurePayload(
      reports[index]?.rawReportPreview,
    );

    if (payload) {
      return payload;
    }
  }

  return null;
}

function workerExecutionReportForSmartQueueFailure({
  createdAt,
  input,
  payload,
}: {
  createdAt: string;
  input: SmartQueueFailureIntegrationInput;
  payload: SmartQueueWorkerFailurePayload;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [...(input.changedFiles ?? [])],
    commandsRun: [],
    createdAt,
    errors: [payload.workerReport.shortReason],
    itemId: input.task.queueItemId,
    rawReportPreview: JSON.stringify(payload),
    reportId:
      input.runId?.trim()
        ? `smart_queue_failure_${input.runId.trim()}`
        : `smart_queue_failure_${payload.attempt.attemptId}`,
    reportStatus:
      payload.coordinatorDecision.failureKind === "timeout"
        ? "interrupted"
        : "failed",
    summary: payload.queueStatus,
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult:
      payload.coordinatorDecision.failureKind === "validation_failure"
        ? "failed"
        : "not_run",
    warnings: [payload.queueDetail],
    workerId: input.workerId?.trim() || workerIdForTask(input.task),
  };
}

function smartQueueAttemptId({
  failureKind,
  runId,
  taskId,
}: {
  failureKind: SmartQueueAttemptFailureKind;
  runId?: string | null;
  taskId: string;
}) {
  return [
    "smart-attempt",
    sanitizeIdPart(taskId),
    sanitizeIdPart(runId ?? failureKind),
  ].join(":");
}

function sanitizeIdPart(value: string) {
  return value.trim().replace(/[^a-z0-9_.:-]+/gi, "-") || "unknown";
}

function productReasonForFailure(
  failureKind: SmartQueueAttemptFailureKind,
  reason: string,
) {
  const cleanReason = reason.trim();

  switch (failureKind) {
    case "validation_failure":
      return "validation failed";
    case "execution_failure":
      return "exec failure";
    case "missing_config":
      return "missing config";
    case "dirty_worktree":
      return "dirty workspace";
    case "timeout":
      return "timeout";
    case "tool_failure":
      return "tool failure";
    case "unknown":
      return cleanReason || "needs human input";
    case "missing_context":
      return cleanReason || "missing context";
    case "dependency_failed":
      return "dependency failed";
    case "dependency_blocked":
      return "dependency blocked";
  }
}

function queueDetailForDecision(decision: SmartQueueCoordinatorDecision) {
  if (decision.retryPolicy.canRetry) {
    return `Retry available: ${decision.retryPolicy.retryCount.toString()}/${decision.retryPolicy.maxRetries.toString()} used.`;
  }

  if (decision.retryPolicy.maxRetries > 0) {
    return decision.retryPolicy.exhaustedReason ?? "Retry limit reached";
  }

  return decision.shortReason;
}

function coordinatorStatusForDecision(
  decision: SmartQueueCoordinatorDecision,
): AgentQueueCoordinatorStatus {
  if (decision.humanStatus.status === "blocked") {
    return "blocked";
  }

  if (decision.humanStatus.status === "failed") {
    return "failed";
  }

  return "awaiting_coordinator_review";
}

function validationStatusForDecision(
  decision: SmartQueueCoordinatorDecision,
): AgentQueueTaskValidationStatus {
  if (decision.failureKind === "validation_failure") {
    return "failed";
  }

  return "needs_review";
}

function statusForFailure(status: AgentQueueTaskStatus): AgentQueueTaskStatus {
  if (status === "running" || status === "completed") {
    return "review_needed";
  }

  return status;
}

function countPriorSmartQueueFailures(task: AgentQueueTask) {
  return (task.workerExecutionReports ?? []).filter((report) =>
    Boolean(parseSmartQueueWorkerFailurePayload(report.rawReportPreview)),
  ).length;
}

function workerIdForTask(task: AgentQueueTask) {
  return (
    task.assignedWorkerId ??
    task.assignedExecutorWidgetId ??
    "agent-queue"
  );
}
