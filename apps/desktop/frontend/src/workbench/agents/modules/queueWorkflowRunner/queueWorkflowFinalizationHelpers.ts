import type { QueueWorkflowRequestValidationResult } from "../queueWorkflowRequestValidation";
import {
  DEPENDENCY_WORKFLOWS,
  QUEUE_FINALIZATION_CONFIRMATION_TOKEN,
  QUEUE_MODULE_ID,
} from "./queueWorkflowRunnerConstants";
import {
  booleanRecord,
  cleanString,
  firstString,
  isRecord,
  recordRecord,
  recordString,
  stripUndefined,
} from "./queueWorkflowRunnerRefs";
import type {
  QueueWorkflowFinalizationCommandResult,
  QueueWorkflowFinalizationCommandStatus,
  QueueWorkflowFinalizationRunnerInput,
  QueueWorkflowFinalizationStatus,
  QueueWorkflowLifecycleSnapshot,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerRequest,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

export type QueueWorkflowFinalizationAction = "fail" | "mark_done";

type QueueWorkflowFinalizationTarget = {
  action: QueueWorkflowFinalizationAction;
  downstreamTaskId?: string;
  evidenceBundleId?: string;
  failureReason?: string;
  messageId?: string;
  reason?: string;
  runId?: string;
  targetSlot: "upstream";
  taskId: string;
};

type QueueWorkflowFinalizationTargetResolution =
  | { ok: true; value: QueueWorkflowFinalizationTarget }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowFinalizationConfirmationResolution =
  | { ok: true; token: string }
  | {
      blocker: QueueWorkflowRunnerBlocker;
      ok: false;
      status: "finalization_invalid_input" | "finalization_needs_confirmation";
    };

type QueueWorkflowReviewPreconditionResolution =
  | { ok: true }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

export function validateFinalizationRunnerBoundary({
  request,
  validation,
}: QueueWorkflowFinalizationRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue finalization workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return null;
  }

  if (!validation.ok) {
    if (onlyMissingFailureReason(validation)) {
      return null;
    }
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  return null;
}

function onlyMissingFailureReason(
  validation: QueueWorkflowRequestValidationResult,
): boolean {
  if (validation.ok || !("issues" in validation)) {
    return false;
  }
  return (
    validation.workflowId === "dependency_failure_smoke" &&
    validation.issues.length > 0 &&
    validation.issues.every(
      (issue) =>
        issue.fieldPath === "$.inputs.failureReason" &&
        issue.reasonCode === "missing_required_input",
    )
  );
}

export function resolveFinalizationTarget(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowFinalizationTargetResolution {
  const slot = variables.slots.upstream;
  const taskId = slot?.taskId;
  if (!taskId) {
    return {
      blocker: {
        fieldPath: "$.inputs.taskIdsBySlot.upstream",
        message:
          "Queue dependency finalization phase requires explicit upstream taskId.",
        reasonCode: "finalization_missing_upstream_task_id",
        slot: "upstream",
      },
      ok: false,
    };
  }

  if (request.workflowId === "dependency_acceptance_smoke") {
    return {
      ok: true,
      value: stripUndefined({
        action: "mark_done",
        downstreamTaskId: variables.slots.downstream?.taskId,
        messageId: slot.messageId,
        reason: finalizationReason(request),
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  if (request.workflowId === "dependency_failure_smoke") {
    const failureReason = finalizationFailureReason(request);
    if (!failureReason) {
      return {
        blocker: {
          fieldPath: "$.inputs.failureReason",
          message:
            "Queue dependency failure finalization requires explicit failureReason.",
          reasonCode: "finalization_missing_failure_reason",
          slot: "upstream",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        action: "fail",
        downstreamTaskId: variables.slots.downstream?.taskId,
        evidenceBundleId: slot.evidenceBundleId,
        failureReason,
        messageId: slot.messageId,
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  return {
    blocker: {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue finalization workflow runner.`,
      reasonCode: "finalization_not_supported_for_workflow",
    },
    ok: false,
  };
}

export function resolveFinalizationConfirmation(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowFinalizationConfirmationResolution {
  const token = cleanString(request.grant?.confirmationToken);
  if (!token) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue finalization requires exact structured confirmationToken.",
        reasonCode: "finalization_confirmation_required",
      },
      ok: false,
      status: "finalization_needs_confirmation",
    };
  }

  if (token !== QUEUE_FINALIZATION_CONFIRMATION_TOKEN) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue finalization confirmationToken must exactly equal operator-confirmed.",
        reasonCode: "finalization_confirmation_invalid",
      },
      ok: false,
      status: "finalization_invalid_input",
    };
  }

  return { ok: true, token };
}

export function reviewAcknowledgedForFinalization({
  request,
  snapshot,
  target,
}: {
  request: QueueWorkflowRunnerRequest;
  snapshot: QueueWorkflowLifecycleSnapshot | null;
  target: QueueWorkflowFinalizationTarget;
}): QueueWorkflowReviewPreconditionResolution {
  if (explicitReviewAcknowledged(request, target.targetSlot)) {
    return { ok: true };
  }

  const reviewState = snapshotString(snapshot, "reviewState");
  const allowedStates =
    target.action === "mark_done"
      ? ["done", "in_review", "reviewed"]
      : ["failed", "in_review", "reviewed"];
  if (reviewState && allowedStates.includes(reviewState)) {
    return { ok: true };
  }

  return {
    blocker: {
      fieldPath: "$.inputs.reviewAcknowledgedBySlot.upstream",
      message:
        "Queue finalization requires an ACKed review state for the explicit upstream task.",
      reasonCode: "finalization_review_ack_required",
      slot: target.targetSlot,
      taskId: target.taskId,
    },
    ok: false,
  };
}

export function finalizationStatusForCommandResult(
  status: QueueWorkflowFinalizationCommandStatus,
  action: QueueWorkflowFinalizationAction,
): QueueWorkflowFinalizationStatus | "unavailable" {
  if (status === "succeeded") {
    return "finalization_completed";
  }
  if (status === "already_done") {
    return action === "mark_done"
      ? "finalization_already_done"
      : "finalization_blocked";
  }
  if (status === "already_failed") {
    return action === "fail"
      ? "finalization_already_failed"
      : "finalization_blocked";
  }
  if (status === "invalid_input") {
    return "finalization_invalid_input";
  }
  if (status === "needs_confirmation") {
    return "finalization_needs_confirmation";
  }
  if (status === "failed_unexpected") {
    return "finalization_failed_unexpected";
  }
  if (status === "unavailable") {
    return "unavailable";
  }
  return "finalization_blocked";
}

export function blockerForFinalizationResult(
  commandResult: QueueWorkflowFinalizationCommandResult,
  action: QueueWorkflowFinalizationAction,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: commandResult.fieldPath,
    message:
      commandResult.message ??
      commandResult.blocker?.blockerMessage ??
      `Queue ${finalizationActionLabel(action)} finalization stopped with status ${commandResult.status}.`,
    reasonCode:
      commandResult.status === "invalid_input"
        ? "finalization_invalid_input"
        : commandResult.status === "needs_confirmation"
          ? "finalization_confirmation_required"
          : commandResult.status === "policy_blocked"
            ? "finalization_policy_blocked"
            : commandResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : "finalization_command_blocked",
    taskId,
  };
}

export function finalizationSuccessMessage(
  status: QueueWorkflowFinalizationCommandStatus,
  action: QueueWorkflowFinalizationAction,
): string {
  if (status === "already_done" || status === "already_failed") {
    return `Queue ${finalizationActionLabel(action)} finalization is already durable; treating as idempotent.`;
  }
  return `Queue ${finalizationActionLabel(action)} finalization completed.`;
}

function finalizationActionLabel(action: QueueWorkflowFinalizationAction) {
  return action === "mark_done" ? "accepted completion" : "terminal failure";
}

function finalizationReason(
  request: QueueWorkflowRunnerRequest,
): string | undefined {
  const finalizationInput = recordRecord(request.inputs, "finalization");
  return firstString(
    recordString(finalizationInput, "reason"),
    recordString(request.inputs, "reason"),
  );
}

function finalizationFailureReason(
  request: QueueWorkflowRunnerRequest,
): string | undefined {
  const finalizationInput = recordRecord(request.inputs, "finalization");
  return firstString(
    recordString(finalizationInput, "failureReason"),
    recordString(finalizationInput, "reason"),
    recordString(request.inputs, "failureReason"),
  );
}

function explicitReviewAcknowledged(
  request: QueueWorkflowRunnerRequest,
  slot: string,
): boolean {
  return booleanRecord(request.inputs?.reviewAcknowledgedBySlot)[slot] === true;
}

export function snapshotForTask(
  variables: QueueWorkflowVariables,
  taskId: string,
): QueueWorkflowLifecycleSnapshot | null {
  return (
    variables.readSnapshots.lifecycleByTaskId[taskId] ??
    variables.readSnapshots.aggregatesByTaskId[taskId] ??
    null
  );
}

export function snapshotString(
  snapshot: QueueWorkflowLifecycleSnapshot | null | undefined,
  fieldName: "dependencyState" | "reviewState" | "ticketState" | "workerRunState",
): string | undefined {
  if (!snapshot) {
    return undefined;
  }
  const snapshotRecord = snapshot as Record<string, unknown>;
  const aggregate = snapshotRecord["aggregate"];
  if (isRecord(aggregate)) {
    return recordString(aggregate, fieldName);
  }
  return recordString(snapshotRecord, fieldName);
}
