import type { SmartQueueTaskHumanStatus } from "../../workspace/types/smartQueue";

export type SmartQueueWorkerReportStage =
  | "planning"
  | "execution"
  | "validation"
  | "commit"
  | "dependency"
  | "environment";

export type SmartQueueFailureKind =
  | "validation_failure"
  | "execution_failure"
  | "missing_config"
  | "missing_context"
  | "dependency_failed"
  | "dependency_blocked"
  | "dirty_worktree"
  | "timeout"
  | "tool_failure"
  | "unknown";

export type SmartQueueCoordinatorDecisionAction =
  | "retry_same"
  | "retry_with_modified_prompt"
  | "move_blocked"
  | "mark_failed"
  | "request_human_input"
  | "request_workspace_agent_assistance"
  | "rollback_attempt_proposal"
  | "split_followup_task"
  | "accept_dependency_anyway";

export type SmartQueueDecisionSeverity =
  | "info"
  | "warning"
  | "needs_decision"
  | "blocked"
  | "failed";

export type SmartQueueRetryPolicy = {
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly canRetry: boolean;
  readonly exhaustedReason?: string;
};

export type SmartQueueWorkerReport = {
  readonly taskId: string;
  readonly attemptId?: string;
  readonly stage: SmartQueueWorkerReportStage;
  readonly failureKind: SmartQueueFailureKind;
  readonly shortReason: string;
  readonly evidenceSummary: string;
  readonly suggestedActions?: readonly SmartQueueCoordinatorDecisionAction[];
};

export type SmartQueueAssistanceRequest = {
  readonly taskId: string;
  readonly attemptId?: string;
  readonly reasonKind: SmartQueueFailureKind;
  readonly shortReason: string;
  readonly evidenceSummary: string;
  readonly availableActions: readonly SmartQueueCoordinatorDecisionAction[];
  readonly recommendedAction?: SmartQueueCoordinatorDecisionAction;
};

export type SmartQueueDecisionSideEffectFlags = {
  readonly wouldCallWorkspaceAgent: false;
  readonly wouldExecuteRetry: false;
  readonly wouldMutateQueue: false;
  readonly wouldRollback: false;
  readonly wouldStartWorker: false;
};

export type SmartQueueCoordinatorDecision = {
  readonly decisionId: string;
  readonly taskId: string;
  readonly attemptId?: string;
  readonly stage: SmartQueueWorkerReportStage;
  readonly failureKind: SmartQueueFailureKind;
  readonly action: SmartQueueCoordinatorDecisionAction;
  readonly availableActions: readonly SmartQueueCoordinatorDecisionAction[];
  readonly recommendedActions: readonly SmartQueueCoordinatorDecisionAction[];
  readonly severity: SmartQueueDecisionSeverity;
  readonly humanStatus: {
    readonly status: SmartQueueTaskHumanStatus;
    readonly label: string;
    readonly text: string;
  };
  readonly productLabel: string;
  readonly shortReason: string;
  readonly evidenceSummary: string;
  readonly retryPolicy: SmartQueueRetryPolicy;
  readonly assistanceRequest?: SmartQueueAssistanceRequest;
  readonly requiresOperatorApproval: boolean;
  readonly destructive: boolean;
  readonly sideEffects: SmartQueueDecisionSideEffectFlags;
};

export type SmartQueueDecisionInput = {
  readonly report: SmartQueueWorkerReport;
  readonly retryCount?: number;
  readonly maxRetries?: number;
  readonly decisionId?: string;
  readonly preferWorkspaceAgentAssistance?: boolean;
};

type DecisionValues = {
  readonly action: SmartQueueCoordinatorDecisionAction;
  readonly availableActions: readonly SmartQueueCoordinatorDecisionAction[];
  readonly recommendedActions: readonly SmartQueueCoordinatorDecisionAction[];
  readonly severity: SmartQueueDecisionSeverity;
  readonly status: SmartQueueTaskHumanStatus;
  readonly productLabel: string;
  readonly shortReason: string;
  readonly requiresOperatorApproval?: boolean;
  readonly destructive?: boolean;
  readonly assistanceRequest?: SmartQueueAssistanceRequest;
};

const NO_SIDE_EFFECTS: SmartQueueDecisionSideEffectFlags = {
  wouldCallWorkspaceAgent: false,
  wouldExecuteRetry: false,
  wouldMutateQueue: false,
  wouldRollback: false,
  wouldStartWorker: false,
};

export function decideSmartQueueCoordinatorAction(
  input: SmartQueueDecisionInput,
): SmartQueueCoordinatorDecision {
  const retryPolicy = computeSmartQueueRetryPolicy(input);
  const { report } = input;

  switch (report.failureKind) {
    case "validation_failure":
      return decision(input, retryPolicy, {
        action: "request_human_input",
        availableActions: [
          "retry_with_modified_prompt",
          "request_human_input",
          "mark_failed",
          ...suggestedRollbackAction(report),
        ],
        productLabel: "Needs decision: validation failed",
        recommendedActions: [
          "retry_with_modified_prompt",
          "request_human_input",
          "mark_failed",
        ],
        requiresOperatorApproval: true,
        severity: "needs_decision",
        shortReason: "validation failed",
        status: "needs_decision",
      });

    case "execution_failure":
      return decision(input, retryPolicy, {
        action: "move_blocked",
        availableActions: ["move_blocked", "request_human_input", "mark_failed"],
        productLabel: "Blocked: exec failure",
        recommendedActions: ["move_blocked", "request_human_input"],
        severity: "blocked",
        shortReason: "exec failure",
        status: "blocked",
      });

    case "missing_config":
      return decision(input, retryPolicy, {
        action: "move_blocked",
        availableActions: ["move_blocked", "request_human_input"],
        productLabel: "Blocked: missing config",
        recommendedActions: ["move_blocked"],
        severity: "blocked",
        shortReason: "missing config",
        status: "blocked",
      });

    case "missing_context":
      return missingContextDecision(input, retryPolicy);

    case "dependency_failed":
      return decision(input, retryPolicy, {
        action: "move_blocked",
        availableActions: [
          "move_blocked",
          "request_workspace_agent_assistance",
          "request_human_input",
          "accept_dependency_anyway",
        ],
        productLabel: "Blocked: dependency failed",
        recommendedActions: ["move_blocked"],
        severity: "blocked",
        shortReason: "dependency failed",
        status: "blocked",
      });

    case "dependency_blocked":
      return decision(input, retryPolicy, {
        action: "move_blocked",
        availableActions: [
          "move_blocked",
          "request_workspace_agent_assistance",
          "request_human_input",
          "accept_dependency_anyway",
        ],
        productLabel: "Blocked: dependency blocked",
        recommendedActions: ["move_blocked"],
        severity: "blocked",
        shortReason: "dependency blocked",
        status: "blocked",
      });

    case "dirty_worktree":
      return decision(input, retryPolicy, {
        action: "move_blocked",
        availableActions: ["move_blocked", "request_human_input"],
        productLabel: "Blocked: dirty workspace",
        recommendedActions: ["move_blocked"],
        severity: "blocked",
        shortReason: "dirty workspace",
        status: "blocked",
      });

    case "timeout":
      return retryableFailureDecision(input, retryPolicy);

    case "tool_failure":
      return retryableFailureDecision(input, retryPolicy);

    case "unknown":
      return decision(input, retryPolicy, {
        action: "request_human_input",
        availableActions: ["request_human_input", "move_blocked", "mark_failed"],
        productLabel: "Needs decision",
        recommendedActions: ["request_human_input"],
        requiresOperatorApproval: true,
        severity: "needs_decision",
        shortReason: cleanReason(report.shortReason, "needs human input"),
        status: "needs_decision",
      });
  }
}

export function computeSmartQueueRetryPolicy(
  input: Pick<SmartQueueDecisionInput, "maxRetries" | "retryCount">,
): SmartQueueRetryPolicy {
  const retryCount = Math.max(0, input.retryCount ?? 0);
  const maxRetries = Math.max(0, input.maxRetries ?? 0);
  const canRetry = retryCount < maxRetries;

  return {
    canRetry,
    exhaustedReason: canRetry ? undefined : "Retry limit reached",
    maxRetries,
    retryCount,
  };
}

export function proposeSmartQueueRollbackAttemptDecision(
  input: SmartQueueDecisionInput,
): SmartQueueCoordinatorDecision {
  const retryPolicy = computeSmartQueueRetryPolicy(input);

  return decision(input, retryPolicy, {
    action: "rollback_attempt_proposal",
    availableActions: [
      "rollback_attempt_proposal",
      "request_human_input",
      "mark_failed",
    ],
    destructive: true,
    productLabel: "Needs decision: rollback proposal",
    recommendedActions: ["rollback_attempt_proposal"],
    requiresOperatorApproval: true,
    severity: "needs_decision",
    shortReason: "rollback proposal",
    status: "needs_decision",
  });
}

function missingContextDecision(
  input: SmartQueueDecisionInput,
  retryPolicy: SmartQueueRetryPolicy,
): SmartQueueCoordinatorDecision {
  const useWorkspaceAgent = input.preferWorkspaceAgentAssistance !== false;
  const action = useWorkspaceAgent
    ? "request_workspace_agent_assistance"
    : "request_human_input";
  const availableActions: readonly SmartQueueCoordinatorDecisionAction[] = [
    "request_workspace_agent_assistance",
    "request_human_input",
    "retry_with_modified_prompt",
    "move_blocked",
  ];

  return decision(input, retryPolicy, {
    action,
    assistanceRequest: useWorkspaceAgent
      ? assistanceRequest(input.report, availableActions, action)
      : undefined,
    availableActions,
    productLabel: useWorkspaceAgent ? "Ask Workspace Agent" : "Needs decision",
    recommendedActions: [action],
    requiresOperatorApproval: !useWorkspaceAgent,
    severity: useWorkspaceAgent ? "warning" : "needs_decision",
    shortReason: cleanReason(input.report.shortReason, "missing context"),
    status: useWorkspaceAgent ? "blocked" : "needs_decision",
  });
}

function retryableFailureDecision(
  input: SmartQueueDecisionInput,
  retryPolicy: SmartQueueRetryPolicy,
): SmartQueueCoordinatorDecision {
  const shortReason =
    input.report.failureKind === "timeout" ? "timeout" : "tool failure";

  if (retryPolicy.canRetry) {
    return decision(input, retryPolicy, {
      action: "retry_same",
      availableActions: ["retry_same", "move_blocked", "request_human_input"],
      productLabel: "Retry available",
      recommendedActions: ["retry_same"],
      requiresOperatorApproval: true,
      severity: "warning",
      shortReason,
      status: "needs_decision",
    });
  }

  return decision(input, retryPolicy, {
    action: "move_blocked",
    availableActions: ["move_blocked", "request_human_input", "mark_failed"],
    productLabel: "Retry limit reached",
    recommendedActions: ["move_blocked", "request_human_input"],
    requiresOperatorApproval: true,
    severity: "blocked",
    shortReason: retryPolicy.exhaustedReason ?? "retry limit reached",
    status: "blocked",
  });
}

function decision(
  input: SmartQueueDecisionInput,
  retryPolicy: SmartQueueRetryPolicy,
  values: DecisionValues,
): SmartQueueCoordinatorDecision {
  const { report } = input;

  return {
    action: values.action,
    assistanceRequest: values.assistanceRequest,
    attemptId: report.attemptId,
    availableActions: uniqueActions([
      ...values.availableActions,
      ...(report.suggestedActions ?? []),
    ]),
    decisionId:
      input.decisionId ??
      `smart-queue-decision:${report.taskId}:${report.attemptId ?? "attempt"}:${report.failureKind}`,
    destructive: values.destructive ?? false,
    evidenceSummary: report.evidenceSummary,
    failureKind: report.failureKind,
    humanStatus: {
      label: values.productLabel,
      status: values.status,
      text: values.productLabel,
    },
    productLabel: values.productLabel,
    recommendedActions: values.recommendedActions,
    requiresOperatorApproval: values.requiresOperatorApproval ?? false,
    retryPolicy,
    severity: values.severity,
    shortReason: values.shortReason,
    sideEffects: NO_SIDE_EFFECTS,
    stage: report.stage,
    taskId: report.taskId,
  };
}

function assistanceRequest(
  report: SmartQueueWorkerReport,
  availableActions: readonly SmartQueueCoordinatorDecisionAction[],
  recommendedAction: SmartQueueCoordinatorDecisionAction,
): SmartQueueAssistanceRequest {
  return {
    attemptId: report.attemptId,
    availableActions,
    evidenceSummary: report.evidenceSummary,
    reasonKind: report.failureKind,
    recommendedAction,
    shortReason: cleanReason(report.shortReason, "missing context"),
    taskId: report.taskId,
  };
}

function suggestedRollbackAction(report: SmartQueueWorkerReport) {
  return report.suggestedActions?.includes("rollback_attempt_proposal")
    ? (["rollback_attempt_proposal"] satisfies SmartQueueCoordinatorDecisionAction[])
    : [];
}

function uniqueActions(
  actions: readonly SmartQueueCoordinatorDecisionAction[],
): readonly SmartQueueCoordinatorDecisionAction[] {
  return [...new Set(actions)];
}

function cleanReason(reason: string, fallback: string) {
  return reason.trim() || fallback;
}
