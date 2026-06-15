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

export type SmartQueueRollbackProposalRecord = {
  readonly proposalId: string;
  readonly taskId: string;
  readonly attemptId?: string;
  readonly coordinatorDecisionId?: string;
  readonly reason: string;
  readonly status: string;
  readonly baseRevision?: string;
  readonly changedFiles: readonly string[];
  readonly changedFilesCount: number;
  readonly validationSummary?: string;
  readonly failureSummary?: string;
  readonly riskSummary: string;
  readonly approvalRequired: true;
  readonly destructive: true;
  readonly executableNow: false;
  readonly createdAt: string;
  readonly planText: string;
};

export type SmartQueueRollbackProposalPayload = {
  readonly kind: "smart_queue_rollback_proposal_record";
  readonly version: 1;
  readonly preparedAction: "rollback_attempt_proposal";
  readonly preparedAt: string;
  readonly proposal: SmartQueueRollbackProposalRecord;
  readonly taskId: string;
  readonly previousAttemptId?: string;
  readonly previousDecisionId?: string;
  readonly sideEffects: {
    readonly wouldCallWorkspaceAgent: false;
    readonly wouldExecuteRetry: false;
    readonly wouldExecuteRollback: false;
    readonly wouldLaunchTerminal: false;
    readonly wouldMutateFiles: false;
    readonly wouldMutateGit: false;
    readonly wouldMutateQueue: true;
    readonly wouldStartWorker: false;
  };
};

export type SmartQueueCannotPrepareRollbackProposalResult = {
  readonly ok: false;
  readonly message: "Cannot prepare rollback proposal";
  readonly reason: string;
  readonly task: AgentQueueTask;
};

export type SmartQueueRollbackProposalResult =
  | {
      readonly ok: true;
      readonly message: "Rollback proposal prepared";
      readonly proposal: SmartQueueRollbackProposalRecord;
      readonly report: AgentQueueWorkerExecutionReport;
      readonly task: AgentQueueTask;
    }
  | SmartQueueCannotPrepareRollbackProposalResult;

export function canPrepareSmartQueueRollbackProposal(
  decision: SmartQueueCoordinatorDecision | null | undefined,
) {
  return Boolean(
    decision?.availableActions.includes("rollback_attempt_proposal") &&
      decision.requiresOperatorApproval &&
      decision.destructive,
  );
}

export function applySmartQueueRollbackProposalToTask({
  createdAt = new Date().toISOString(),
  proposalId,
  task,
}: {
  readonly createdAt?: string;
  readonly proposalId?: string;
  readonly task: AgentQueueTask;
}): SmartQueueRollbackProposalResult {
  const failurePayload = latestSmartQueueFailurePayloadForTask(task);

  if (!failurePayload) {
    return cannotPrepareRollbackProposal(
      task,
      "Smart Queue decision payload is unavailable.",
    );
  }

  if (!canPrepareSmartQueueRollbackProposal(failurePayload.coordinatorDecision)) {
    return cannotPrepareRollbackProposal(
      task,
      "Coordinator decision does not allow rollback proposal preparation.",
    );
  }

  const proposal = buildSmartQueueRollbackProposal({
    createdAt,
    failurePayload,
    proposalId:
      proposalId ??
      smartQueueRollbackProposalId({
        createdAt,
        decisionId: failurePayload.coordinatorDecision.decisionId,
        taskId: task.queueItemId,
      }),
    task,
  });
  const payload: SmartQueueRollbackProposalPayload = {
    kind: "smart_queue_rollback_proposal_record",
    preparedAction: "rollback_attempt_proposal",
    preparedAt: createdAt,
    previousAttemptId: proposal.attemptId,
    previousDecisionId: proposal.coordinatorDecisionId,
    proposal,
    sideEffects: {
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateFiles: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
    },
    taskId: task.queueItemId,
    version: 1,
  };
  const report = rollbackProposalWorkerReport({
    createdAt,
    payload,
    task,
  });
  const updatedTask: AgentQueueTask = {
    ...task,
    workerExecutionReports: [...(task.workerExecutionReports ?? []), report],
  };

  return {
    message: "Rollback proposal prepared",
    ok: true,
    proposal,
    report,
    task: updatedTask,
  };
}

export function buildSmartQueueRollbackProposal({
  createdAt,
  failurePayload,
  proposalId,
  task,
}: {
  readonly createdAt: string;
  readonly failurePayload: SmartQueueWorkerFailurePayload;
  readonly proposalId: string;
  readonly task: AgentQueueTask;
}): SmartQueueRollbackProposalRecord {
  const decision = failurePayload.coordinatorDecision;
  const changedFiles = changedFilesForRollback(task, failurePayload);
  const validation = validationSummary(failurePayload);
  const failureSummary = productOptionalText(
    decision.evidenceSummary || failurePayload.workerReport.evidenceSummary,
  );
  const baseRevision = productOptionalText(
    failurePayload.attempt.baseRevision,
  );

  return {
    approvalRequired: true,
    attemptId: decision.attemptId ?? failurePayload.attempt.attemptId,
    baseRevision,
    changedFiles,
    changedFilesCount: changedFiles.length,
    coordinatorDecisionId: decision.decisionId,
    createdAt,
    destructive: true,
    executableNow: false,
    failureSummary,
    planText: rollbackPlanText({
      baseRevision,
      changedFiles,
      failureSummary,
      task,
      validationSummary: validation,
    }),
    proposalId,
    reason: reasonLabel(decision.failureKind, decision.shortReason),
    riskSummary: "Destructive rollback needs operator approval before any action.",
    status: productText(decision.productLabel, "Needs decision"),
    taskId: task.queueItemId,
    validationSummary: validation,
  };
}

export function parseSmartQueueRollbackProposalPayload(
  rawReportPreview: string | null | undefined,
): SmartQueueRollbackProposalPayload | null {
  if (!rawReportPreview?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawReportPreview) as Partial<SmartQueueRollbackProposalPayload>;

    if (
      parsed.kind !== "smart_queue_rollback_proposal_record" ||
      parsed.version !== 1 ||
      parsed.preparedAction !== "rollback_attempt_proposal" ||
      !parsed.proposal ||
      !parsed.taskId
    ) {
      return null;
    }

    return parsed as SmartQueueRollbackProposalPayload;
  } catch {
    return null;
  }
}

function rollbackProposalWorkerReport({
  createdAt,
  payload,
  task,
}: {
  readonly createdAt: string;
  readonly payload: SmartQueueRollbackProposalPayload;
  readonly task: AgentQueueTask;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [...payload.proposal.changedFiles],
    commandsRun: [],
    createdAt,
    errors: [],
    itemId: task.queueItemId,
    rawReportPreview: JSON.stringify(payload),
    reportId: `smart_queue_rollback_proposal_${sanitizeIdPart(payload.proposal.proposalId)}`,
    reportStatus: "reported",
    summary: "Rollback proposal prepared",
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult: task.validationStatus === "failed" ? "failed" : "not_run",
    warnings: [
      "Task remains blocked for coordinator review. No rollback executed.",
    ],
    workerId:
      task.assignedWorkerId ??
      task.assignedExecutorWidgetId ??
      "agent-queue",
  };
}

function rollbackPlanText({
  baseRevision,
  changedFiles,
  failureSummary,
  task,
  validationSummary,
}: {
  readonly baseRevision?: string;
  readonly changedFiles: readonly string[];
  readonly failureSummary?: string;
  readonly task: AgentQueueTask;
  readonly validationSummary?: string;
}) {
  const lines = [
    `Rollback proposal for ${productText(task.title, "Untitled Queue task")}.`,
    "Approval required.",
    "Destructive.",
    "No rollback executed.",
    `Affected files: ${changedFiles.length.toString()}`,
    baseRevision
      ? `Base revision: ${baseRevision}`
      : "Base revision unavailable",
  ];

  if (failureSummary) {
    lines.push(`Reason: ${failureSummary}`);
  }

  if (validationSummary) {
    lines.push(`Evidence: ${validationSummary}`);
  }

  if (changedFiles.length > 0) {
    lines.push(`Files: ${changedFiles.join(", ")}`);
  }

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

function changedFilesForRollback(
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

function smartQueueRollbackProposalId({
  createdAt,
  decisionId,
  taskId,
}: {
  readonly createdAt: string;
  readonly decisionId: string;
  readonly taskId: string;
}) {
  return [
    "smart-rollback-proposal",
    sanitizeIdPart(taskId),
    sanitizeIdPart(decisionId),
    sanitizeIdPart(createdAt),
  ].join(":");
}

function cannotPrepareRollbackProposal(
  task: AgentQueueTask,
  reason: string,
): SmartQueueCannotPrepareRollbackProposalResult {
  return {
    message: "Cannot prepare rollback proposal",
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
