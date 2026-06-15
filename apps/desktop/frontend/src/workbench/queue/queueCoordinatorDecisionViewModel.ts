import type { AgentQueueTask } from "../../workspace/types";
import {
  latestSmartQueueFailurePayloadForTask,
} from "./smartQueueWorkerReportIntegration";
import {
  canApplySmartQueueRetrySame,
  canApplySmartQueueRetryWithModifiedPrompt,
} from "./smartQueueRetrySameAction";
import {
  canApplySmartQueueWorkspaceAgentAssistance,
} from "./smartQueueAssistanceRequest";
import type {
  SmartQueueCoordinatorDecision,
  SmartQueueCoordinatorDecisionAction,
} from "./smartQueueCoordinatorDecision";

export type QueueCoordinatorDecisionCardViewModel = {
  readonly actionAvailability: "Action unavailable";
  readonly allowedActionLabels: readonly string[];
  readonly destructive: boolean;
  readonly destructiveLabel: string;
  readonly evidenceSummary: string;
  readonly askWorkspaceAgentAvailable: boolean;
  readonly askWorkspaceAgentLabel: "Ask Workspace Agent";
  readonly recommendedActionLabel: string;
  readonly requiresApproval: boolean;
  readonly requiresApprovalLabel: string;
  readonly retrySameAvailable: boolean;
  readonly retrySameLabel: "Retry";
  readonly retryWithModifiedPromptAvailable: boolean;
  readonly retryWithModifiedPromptLabel: "Retry with changes";
  readonly statusLabel: string;
  readonly taskId: string;
};

export function queueCoordinatorDecisionCardViewModelForTask(
  task: Pick<AgentQueueTask, "queueItemId" | "workerExecutionReports">,
): QueueCoordinatorDecisionCardViewModel | null {
  const payload = latestSmartQueueFailurePayloadForTask(task);

  if (!payload) {
    return null;
  }

  return queueCoordinatorDecisionCardViewModel(payload.coordinatorDecision);
}

export function queueCoordinatorDecisionCardViewModel(
  decision: SmartQueueCoordinatorDecision,
): QueueCoordinatorDecisionCardViewModel {
  const recommended =
    decision.recommendedActions[0] ?? decision.action;

  return {
    actionAvailability: "Action unavailable",
    allowedActionLabels: decision.availableActions
      .filter((action) => action !== "retry_same")
      .map(actionLabel),
    destructive: decision.destructive,
    destructiveLabel: decision.destructive
      ? "Destructive action proposed"
      : "No destructive action proposed",
    evidenceSummary: productEvidenceSummary(decision.evidenceSummary),
    askWorkspaceAgentAvailable:
      canApplySmartQueueWorkspaceAgentAssistance(decision),
    askWorkspaceAgentLabel: "Ask Workspace Agent",
    recommendedActionLabel: actionLabel(recommended),
    requiresApproval: decision.requiresOperatorApproval,
    requiresApprovalLabel: decision.requiresOperatorApproval
      ? "Operator approval required"
      : "No operator approval required",
    retrySameAvailable: canApplySmartQueueRetrySame(decision),
    retrySameLabel: "Retry",
    retryWithModifiedPromptAvailable:
      canApplySmartQueueRetryWithModifiedPrompt(decision),
    retryWithModifiedPromptLabel: "Retry with changes",
    statusLabel: productText(decision.productLabel, "Needs decision"),
    taskId: decision.taskId,
  };
}

function actionLabel(action: SmartQueueCoordinatorDecisionAction) {
  switch (action) {
    case "retry_same":
      return "Retry";
    case "retry_with_modified_prompt":
      return "Retry with changes";
    case "move_blocked":
      return "Block";
    case "mark_failed":
      return "Mark failed";
    case "request_human_input":
      return "Request human input";
    case "request_workspace_agent_assistance":
      return "Ask Workspace Agent";
    case "rollback_attempt_proposal":
      return "Rollback proposal";
    case "split_followup_task":
      return "Split follow-up task";
    case "accept_dependency_anyway":
      return "Accept dependency";
  }
}

function productEvidenceSummary(value: string) {
  return productText(value, "Worker report needs operator review.");
}

function productText(value: string, fallback: string) {
  const trimmed = value.trim();

  if (!trimmed || looksLikeRawPayload(trimmed)) {
    return fallback;
  }

  return humanizeInternalTokens(trimmed).slice(0, 240);
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
