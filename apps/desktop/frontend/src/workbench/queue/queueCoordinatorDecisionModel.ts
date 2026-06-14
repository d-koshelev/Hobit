import type {
  QueueAssistanceRequest,
  QueueAssistanceResponse,
  QueueCoordinatorDecision,
  QueueCoordinatorDecisionAction,
  QueueCoordinatorDecisionKind,
  QueueCoordinatorDecisionStatus,
  SmartQueueBlockerKind,
  WorkerStuckReport,
} from "../../workspace/types";

export type QueueCoordinatorDecisionInput = {
  report: WorkerStuckReport;
  decisionId: string;
  createdAt: string;
  assistanceRequestId?: string;
};

export type QueueAssistanceDecisionProposalInput = {
  request: QueueAssistanceRequest;
  response: QueueAssistanceResponse;
  decisionId: string;
  createdAt: string;
};

export function decideQueueCoordinatorAction(
  input: QueueCoordinatorDecisionInput,
): QueueCoordinatorDecision {
  const { report } = input;

  if (retryLimitExceeded(report)) {
    return createDecision(input, {
      action: report.flags?.needsHumanInput ? "request_human_input" : "mark_failed",
      status: report.flags?.needsHumanInput ? "needs_decision" : "failed",
      blockerKind: report.flags?.needsHumanInput ? "requires_human_input" : undefined,
      reason: report.flags?.needsHumanInput
        ? "Retry limit reached. Human input is required before another attempt."
        : "Retry limit reached. Marking failed prevents an infinite retry loop.",
      requiresApproval: true,
    });
  }

  switch (report.kind) {
    case "validation_failure":
      if (report.flags?.needsWorkspaceAgentAssistance) {
        return workspaceAgentAssistanceDecision(
          input,
          "validation_requires_decision",
          "Ask Workspace Agent to explain the validation failure and draft options from visible context.",
        );
      }

      return createDecision(input, {
        action: report.flags?.hasRollbackRecommendation
          ? "rollback_attempt"
          : "request_human_input",
        status: "needs_decision",
        blockerKind: "validation_requires_decision",
        reason: "Validation failed. Queue Coordinator needs an explicit decision before continuing.",
        requiresApproval: true,
      });

    case "exec_failure":
      if (report.flags?.environmentOrToolIssue) {
        return createDecision(input, {
          action: "move_blocked",
          status: "blocked",
          blockerKind: "worker_unavailable",
          reason: "Blocked: exec failure from environment or tool issue.",
          requiresApproval: false,
        });
      }

      return createDecision(input, {
        action: "request_human_input",
        status: "needs_decision",
        reason: "Worker execution failed. Queue Coordinator needs an explicit retry, block, or fail decision.",
        requiresApproval: true,
      });

    case "missing_context":
      if (report.flags?.needsWorkspaceAgentAssistance) {
        return workspaceAgentAssistanceDecision(
          input,
          "requires_human_input",
          "Ask Workspace Agent to identify options for the missing context from visible task details.",
        );
      }

      return createDecision(input, {
        action: "request_human_input",
        status: "needs_decision",
        blockerKind: "requires_human_input",
        reason: "Missing context requires human input before the worker can continue.",
        requiresApproval: true,
      });

    case "missing_config":
      return createDecision(input, {
        action: "move_blocked",
        status: "blocked",
        blockerKind: "missing_config",
        reason: "Blocked: missing run configuration.",
        requiresApproval: false,
      });

    case "missing_prompt":
      return createDecision(input, {
        action: "move_blocked",
        status: "blocked",
        blockerKind: "missing_prompt",
        reason: "Blocked: missing task prompt.",
        requiresApproval: false,
      });

    case "dirty_worktree":
      return createDecision(input, {
        action: "move_blocked",
        status: "blocked",
        blockerKind: "dirty_worktree",
        reason: "Blocked: dirty workspace. Review or clean local changes before continuing.",
        requiresApproval: false,
      });

    case "dependency_failed":
      return createDecision(input, {
        action: "move_blocked",
        status: "blocked",
        blockerKind: "dependency_failed",
        reason: "Blocked: upstream dependency failed.",
        requiresApproval: false,
      });

    case "dependency_blocked":
      return createDecision(input, {
        action: "move_blocked",
        status: "blocked",
        blockerKind: "dependency_blocked",
        reason: "Blocked: upstream dependency is blocked.",
        requiresApproval: false,
      });
  }
}

export function proposeQueueCoordinatorRetryDecision(
  input: QueueCoordinatorDecisionInput & {
    modifiedPrompt?: string;
  },
): QueueCoordinatorDecision {
  return createDecision(input, {
    action: input.modifiedPrompt ? "retry_with_modified_prompt" : "retry_same",
    status: "needs_decision",
    reason: input.modifiedPrompt
      ? "Retry with a modified prompt was proposed. Previous worker report remains attached as evidence."
      : "Retry was proposed. Previous worker report remains attached as evidence.",
    requiresApproval: true,
    proposedPrompt: input.modifiedPrompt,
  });
}

export function proposeCoordinatorDecisionFromAssistanceResponse(
  input: QueueAssistanceDecisionProposalInput,
): QueueCoordinatorDecision {
  const action = actionFromRecommendedDecision(input.response.recommendedDecision);

  return {
    action,
    assistanceRequest: input.request,
    batchId: input.request.batchId,
    blockerKind: input.request.reason,
    createdAt: input.createdAt,
    decidedBy: "queue_coordinator",
    decisionId: input.decisionId,
    maxRetryCount: 0,
    proposedPrompt: input.response.proposedPrompt,
    queueId: input.request.queueId,
    reason: `Workspace Agent assistance proposed ${action}. Queue Coordinator decision is still required. ${input.response.summary}`,
    requiresApproval: true,
    retryCount: 0,
    status: action === "move_blocked" ? "blocked" : "needs_decision",
    taskId: input.request.taskId,
    workspaceId: input.request.workspaceId,
  };
}

export function describeQueueCoordinatorDecision(
  decision: QueueCoordinatorDecision,
): string {
  const target = decision.taskId ? `Task ${decision.taskId}` : "Queue";
  const blocker = decision.blockerKind ? ` Blocker: ${decision.blockerKind}.` : "";
  const approval = decision.requiresApproval ? " Approval required." : "";

  return `${target}: ${decision.status} via ${decision.action}. ${decision.reason}${blocker}${approval}`;
}

function retryLimitExceeded(report: WorkerStuckReport) {
  return report.flags?.retryCountExceeded === true || report.retryCount >= report.maxRetryCount;
}

function workspaceAgentAssistanceDecision(
  input: QueueCoordinatorDecisionInput,
  reason: SmartQueueBlockerKind,
  question: string,
) {
  return createDecision(input, {
    action: "request_workspace_agent_assistance",
    status: "assistance_requested",
    blockerKind: reason,
    reason: "Workspace Agent assistance requested as a typed request; no Queue task is created by default.",
    requiresApproval: false,
    assistanceRequest: createAssistanceRequest(input, reason, question),
  });
}

function createDecision(
  input: QueueCoordinatorDecisionInput,
  values: {
    action: QueueCoordinatorDecisionAction;
    status: QueueCoordinatorDecisionStatus;
    reason: string;
    blockerKind?: SmartQueueBlockerKind;
    requiresApproval: boolean;
    assistanceRequest?: QueueAssistanceRequest;
    proposedPrompt?: string;
  },
): QueueCoordinatorDecision {
  const { report } = input;

  const decision: QueueCoordinatorDecision = {
    action: values.action,
    batchId: report.batchId,
    blockerKind: values.blockerKind,
    createdAt: input.createdAt,
    decidedBy: "queue_coordinator",
    decisionId: input.decisionId,
    maxRetryCount: report.maxRetryCount,
    proposedPrompt: values.proposedPrompt,
    queueId: report.queueId,
    reason: values.reason,
    requiresApproval: values.requiresApproval,
    retryCount: report.retryCount,
    sourceAttemptId: report.attemptId,
    sourceReportId: report.reportId,
    status: values.status,
    taskId: report.taskId,
    workspaceId: report.workspaceId,
  };

  if (values.assistanceRequest) {
    decision.assistanceRequest = values.assistanceRequest;
  }

  return decision;
}

function createAssistanceRequest(
  input: QueueCoordinatorDecisionInput,
  reason: SmartQueueBlockerKind,
  question: string,
): QueueAssistanceRequest {
  const { report } = input;

  return {
    allowedResponseKinds: ["explanation", "options", "draft_prompt", "decision_recommendation"],
    batchId: report.batchId,
    createdAt: input.createdAt,
    question,
    queueId: report.queueId,
    reason,
    requestId: input.assistanceRequestId ?? `${input.decisionId}:assistance`,
    requestedBy: "queue_coordinator",
    target: "workspace_agent",
    taskId: report.taskId,
    visibleContext: {
      blockerSummary: report.summary,
      dependencyTaskIds: report.dependencyTaskIds,
      evidence: report.evidence,
      validationSummary: report.validationSummary,
      workerReportPreview: report.summary,
    },
    workspaceId: report.workspaceId,
    attemptId: report.attemptId,
    availableActions: [
      "retry_same",
      "retry_with_modified_prompt",
      "move_blocked",
      "mark_failed",
      "request_human_input",
      "rollback_attempt",
      "split_followup_task",
      "accept_dependency_anyway",
    ],
  };
}

function actionFromRecommendedDecision(
  decision: QueueAssistanceResponse["recommendedDecision"],
): QueueCoordinatorDecisionAction {
  const mapping: Partial<Record<QueueCoordinatorDecisionKind, QueueCoordinatorDecisionAction>> = {
    block_task: "move_blocked",
    cancel_task: "mark_failed",
    close_task: "request_human_input",
    drain_queue: "request_human_input",
    fail_task: "mark_failed",
    pause_queue: "request_human_input",
    request_review: "request_human_input",
    request_validation: "request_human_input",
    retry_task: "retry_same",
    stop_queue: "request_human_input",
  };

  return decision ? mapping[decision] ?? "request_human_input" : "request_human_input";
}
