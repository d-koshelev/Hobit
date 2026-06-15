import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type {
  SmartQueueCoordinatorDecision,
  SmartQueueFailureKind,
} from "./smartQueueCoordinatorDecision";
import {
  latestSmartQueueFailurePayloadForTask,
  type SmartQueueWorkerFailurePayload,
} from "./smartQueueWorkerReportIntegration";

export type SmartQueueAssistanceRequestRecord = {
  readonly requestId: string;
  readonly taskId: string;
  readonly attemptId?: string;
  readonly coordinatorDecisionId?: string;
  readonly reason: string;
  readonly status: string;
  readonly taskTitle: string;
  readonly originalPrompt: string;
  readonly currentRunnablePrompt: string;
  readonly failureSummary: string;
  readonly validationSummary?: string;
  readonly changedFiles: readonly string[];
  readonly dependencyContext?: string;
  readonly recommendedPrompt: string;
  readonly createdAt: string;
};

export type SmartQueueAssistanceRequestPayload = {
  readonly kind: "smart_queue_assistance_request_record";
  readonly version: 1;
  readonly requestedAction: "request_workspace_agent_assistance";
  readonly requestedAt: string;
  readonly request: SmartQueueAssistanceRequestRecord;
  readonly taskId: string;
  readonly previousAttemptId?: string;
  readonly previousDecisionId?: string;
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

export type SmartQueueCannotRequestAssistanceResult = {
  readonly ok: false;
  readonly message: "Cannot prepare assistance request";
  readonly reason: string;
  readonly task: AgentQueueTask;
};

export type SmartQueueAssistanceRequestResult =
  | {
      readonly ok: true;
      readonly message: "Assistance request prepared";
      readonly report: AgentQueueWorkerExecutionReport;
      readonly request: SmartQueueAssistanceRequestRecord;
      readonly task: AgentQueueTask;
    }
  | SmartQueueCannotRequestAssistanceResult;

export function canApplySmartQueueWorkspaceAgentAssistance(
  decision: SmartQueueCoordinatorDecision | null | undefined,
) {
  return Boolean(
    decision?.availableActions.includes("request_workspace_agent_assistance"),
  );
}

export function applySmartQueueAssistanceRequestToTask({
  createdAt = new Date().toISOString(),
  requestId,
  task,
}: {
  readonly createdAt?: string;
  readonly requestId?: string;
  readonly task: AgentQueueTask;
}): SmartQueueAssistanceRequestResult {
  const failurePayload = latestSmartQueueFailurePayloadForTask(task);

  if (!failurePayload) {
    return cannotRequestAssistance(
      task,
      "Smart Queue decision payload is unavailable.",
    );
  }

  if (
    !canApplySmartQueueWorkspaceAgentAssistance(
      failurePayload.coordinatorDecision,
    )
  ) {
    return cannotRequestAssistance(
      task,
      "Coordinator decision does not allow Workspace Agent assistance.",
    );
  }

  const request = buildSmartQueueAssistanceRequest({
    createdAt,
    failurePayload,
    requestId:
      requestId ??
      smartQueueAssistanceRequestId({
        createdAt,
        decisionId: failurePayload.coordinatorDecision.decisionId,
        taskId: task.queueItemId,
      }),
    task,
  });
  const payload: SmartQueueAssistanceRequestPayload = {
    kind: "smart_queue_assistance_request_record",
    previousAttemptId: request.attemptId,
    previousDecisionId: request.coordinatorDecisionId,
    request,
    requestedAction: "request_workspace_agent_assistance",
    requestedAt: createdAt,
    sideEffects: {
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
    },
    taskId: task.queueItemId,
    version: 1,
  };
  const report = assistanceRequestWorkerReport({
    createdAt,
    payload,
    task,
  });
  const updatedTask: AgentQueueTask = {
    ...task,
    workerExecutionReports: [...(task.workerExecutionReports ?? []), report],
  };

  return {
    message: "Assistance request prepared",
    ok: true,
    report,
    request,
    task: updatedTask,
  };
}

export function buildSmartQueueAssistanceRequest({
  createdAt,
  failurePayload,
  requestId,
  task,
}: {
  readonly createdAt: string;
  readonly failurePayload: SmartQueueWorkerFailurePayload;
  readonly requestId: string;
  readonly task: AgentQueueTask;
}): SmartQueueAssistanceRequestRecord {
  const decision = failurePayload.coordinatorDecision;
  const failureSummary = productText(
    decision.evidenceSummary || failurePayload.workerReport.evidenceSummary,
    "The worker attempt needs review.",
  );

  return {
    attemptId: decision.attemptId ?? failurePayload.attempt.attemptId,
    changedFiles: changedFilesForAssistance(task, failurePayload),
    coordinatorDecisionId: decision.decisionId,
    createdAt,
    currentRunnablePrompt: task.prompt,
    dependencyContext: dependencyContext(task),
    failureSummary,
    originalPrompt:
      failurePayload.attempt.promptOverride?.originalPrompt ?? task.prompt,
    reason: reasonLabel(decision.failureKind, decision.shortReason),
    recommendedPrompt: handoffPrompt({
      changedFiles: changedFilesForAssistance(task, failurePayload),
      dependencyContext: dependencyContext(task),
      failureSummary,
      task,
      validationSummary: validationSummary(failurePayload),
    }),
    requestId,
    status: productText(decision.productLabel, "Needs decision"),
    taskId: task.queueItemId,
    taskTitle: productText(task.title, "Untitled Queue task"),
    validationSummary: validationSummary(failurePayload),
  };
}

export function parseSmartQueueAssistanceRequestPayload(
  rawReportPreview: string | null | undefined,
): SmartQueueAssistanceRequestPayload | null {
  if (!rawReportPreview?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawReportPreview) as Partial<SmartQueueAssistanceRequestPayload>;

    if (
      parsed.kind !== "smart_queue_assistance_request_record" ||
      parsed.version !== 1 ||
      parsed.requestedAction !== "request_workspace_agent_assistance" ||
      !parsed.request ||
      !parsed.taskId
    ) {
      return null;
    }

    return parsed as SmartQueueAssistanceRequestPayload;
  } catch {
    return null;
  }
}

function assistanceRequestWorkerReport({
  createdAt,
  payload,
  task,
}: {
  readonly createdAt: string;
  readonly payload: SmartQueueAssistanceRequestPayload;
  readonly task: AgentQueueTask;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [...payload.request.changedFiles],
    commandsRun: [],
    createdAt,
    errors: [],
    itemId: task.queueItemId,
    rawReportPreview: JSON.stringify(payload),
    reportId: `smart_queue_assistance_${sanitizeIdPart(payload.request.requestId)}`,
    reportStatus: "reported",
    summary: "Assistance request prepared",
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult: task.validationStatus === "failed" ? "failed" : "not_run",
    warnings: [
      "Task remains blocked for coordinator review. No Workspace Agent run, worker start, retry, rollback, Git, or Terminal action was started.",
    ],
    workerId:
      task.assignedWorkerId ??
      task.assignedExecutorWidgetId ??
      "agent-queue",
  };
}

function handoffPrompt({
  changedFiles,
  dependencyContext,
  failureSummary,
  task,
  validationSummary,
}: {
  readonly changedFiles: readonly string[];
  readonly dependencyContext?: string;
  readonly failureSummary: string;
  readonly task: AgentQueueTask;
  readonly validationSummary?: string;
}) {
  const lines = [
    `Please review why the Queue task "${productText(task.title, "Untitled Queue task")}" is stuck or failed.`,
    "",
    "Use only the visible Queue evidence below.",
    `Failure summary: ${failureSummary}`,
  ];

  if (validationSummary) {
    lines.push(`Validation summary: ${validationSummary}`);
  }

  if (changedFiles.length > 0) {
    lines.push(`Changed files: ${changedFiles.join(", ")}`);
  }

  if (dependencyContext) {
    lines.push(`Dependency context: ${dependencyContext}`);
  }

  lines.push(
    "",
    "Inspect the likely cause and propose one next step: a modified prompt, a follow-up Queue task, a manual fix, or marking the task failed.",
    "Do not commit, push, run destructive actions, start Terminal commands, or perform rollback unless the operator explicitly approves a later action.",
    "",
    "Current runnable prompt:",
    productText(task.prompt, "No runnable prompt is available."),
  );

  return lines.join("\n");
}

function validationSummary(payload: SmartQueueWorkerFailurePayload) {
  return productOptionalText(
    payload.attempt.validationResult?.summary ??
      (payload.workerReport.stage === "validation"
        ? payload.workerReport.evidenceSummary
        : undefined),
  );
}

function changedFilesForAssistance(
  task: AgentQueueTask,
  payload: SmartQueueWorkerFailurePayload,
) {
  const reports = task.workerExecutionReports ?? [];
  const latestReport = reports[reports.length - 1];

  return [
    ...new Set(
      [
        ...(payload.attempt.changedFiles ?? []),
        ...(latestReport?.changedFiles ?? []),
      ]
        .map((changedFile) => productText(changedFile, ""))
        .filter(Boolean),
    ),
  ];
}

function dependencyContext(task: AgentQueueTask) {
  const dependencies = (task.dependsOn ?? [])
    .map((dependency) => productText(dependency, ""))
    .filter(Boolean);

  if (dependencies.length === 0) {
    return undefined;
  }

  return `Depends on ${dependencies.join(", ")}`;
}

function reasonLabel(kind: SmartQueueFailureKind, shortReason: string) {
  const cleanReason = productText(shortReason, "");

  if (cleanReason) {
    return cleanReason;
  }

  switch (kind) {
    case "validation_failure":
      return "validation failed";
    case "execution_failure":
      return "execution failed";
    case "missing_config":
      return "missing configuration";
    case "missing_context":
      return "missing context";
    case "dependency_failed":
      return "dependency failed";
    case "dependency_blocked":
      return "dependency blocked";
    case "dirty_worktree":
      return "dirty workspace";
    case "timeout":
      return "timeout";
    case "tool_failure":
      return "tool failure";
    case "unknown":
      return "needs review";
  }
}

function smartQueueAssistanceRequestId({
  createdAt,
  decisionId,
  taskId,
}: {
  readonly createdAt: string;
  readonly decisionId: string;
  readonly taskId: string;
}) {
  return [
    "smart-assistance",
    sanitizeIdPart(taskId),
    sanitizeIdPart(decisionId),
    sanitizeIdPart(createdAt),
  ].join(":");
}

function cannotRequestAssistance(
  task: AgentQueueTask,
  reason: string,
): SmartQueueCannotRequestAssistanceResult {
  return {
    message: "Cannot prepare assistance request",
    ok: false,
    reason,
    task,
  };
}

function productOptionalText(value: string | undefined) {
  const clean = productText(value ?? "", "");

  return clean || undefined;
}

function productText(value: string, fallback: string) {
  const trimmed = value.trim();

  if (!trimmed || looksLikeRawPayload(trimmed)) {
    return fallback;
  }

  return humanizeInternalTokens(trimmed).slice(0, 500);
}

function looksLikeRawPayload(value: string) {
  return (
    value.startsWith("{") ||
    value.startsWith("[") ||
    value.includes("\"kind\"") ||
    value.includes("\"coordinatorDecision\"") ||
    value.includes("rawReportPreview")
  );
}

function humanizeInternalTokens(value: string) {
  return value.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (token) =>
    token.replace(/_/g, " "),
  );
}

function sanitizeIdPart(value: string) {
  return value.trim().replace(/[^a-z0-9_.:-]+/gi, "-") || "unknown";
}
