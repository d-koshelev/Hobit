import {
  DEPENDENCY_WORKFLOWS,
  QUEUE_MODULE_ID,
} from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import {
  cleanString,
  evidenceKey,
  firstString,
  recordRecord,
  recordString,
  stripUndefined,
} from "./queueWorkflowRunnerRefs";
import type {
  QueueWorkflowAckReviewMessageResult,
  QueueWorkflowCreateReviewMessageResult,
  QueueWorkflowReadPort,
  QueueWorkflowReviewRunnerInput,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerStep,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

type QueueWorkflowReviewTarget = {
  evidenceBundleId?: string;
  messageBody?: string;
  messageId?: string;
  runId?: string;
  targetSlot?: string;
  taskId: string;
};

type QueueWorkflowReviewTargetResolution =
  | { ok: true; value: QueueWorkflowReviewTarget }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowReviewEvidenceResolution =
  | {
      evidenceBundleId: string;
      evidenceState: string;
      ok: true;
      runId?: string;
    }
  | {
      blocker: QueueWorkflowRunnerBlocker;
      evidenceState: string;
      ok: false;
    };

export function validateReviewRunnerBoundary({
  request,
  validation,
}: QueueWorkflowReviewRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue review workflow runner only accepts moduleId queue.",
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

export function resolveReviewTarget(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowReviewTargetResolution {
  if (DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    const slot = variables.slots.upstream;
    const taskId = slot?.taskId;
    if (!taskId) {
      return {
        blocker: {
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          message:
            "Queue dependency review phase requires explicit upstream taskId.",
          reasonCode: "review_blocked_missing_task_or_run",
          slot: "upstream",
        },
        ok: false,
      };
    }

    if (!slot.runId && !slot.evidenceBundleId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runIdsBySlot.upstream",
          message:
            "Queue dependency review phase requires explicit upstream runId or evidenceBundleId.",
          reasonCode: "review_blocked_missing_task_or_run",
          slot: "upstream",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        evidenceBundleId: slot.evidenceBundleId,
        messageId: slot.messageId,
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  if (request.workflowId === "review_acceptance") {
    const inputs = request.inputs;
    const taskId = firstString(
      recordString(inputs, "taskId"),
      recordString(recordRecord(inputs, "task"), "taskId"),
      recordString(recordRecord(inputs, "workerEvidence"), "taskId"),
      recordString(recordRecord(inputs, "reviewMessage"), "taskId"),
    );
    if (!taskId) {
      return {
        blocker: {
          fieldPath: "$.inputs.taskId",
          message:
            "Queue review_acceptance phase requires explicit taskId.",
          reasonCode: "review_blocked_missing_task_or_run",
        },
        ok: false,
      };
    }

    const runId = firstString(
      recordString(inputs, "runId"),
      recordString(recordRecord(inputs, "task"), "runId"),
      recordString(recordRecord(inputs, "workerEvidence"), "runId"),
      recordString(recordRecord(inputs, "reviewMessage"), "runId"),
    );
    const evidenceBundleId = firstString(
      recordString(inputs, "evidenceBundleId"),
      recordString(recordRecord(inputs, "workerEvidence"), "evidenceBundleId"),
      recordString(recordRecord(inputs, "reviewMessage"), "evidenceBundleId"),
    );
    if (!runId && !evidenceBundleId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runId",
          message:
            "Queue review_acceptance phase requires explicit runId or evidenceBundleId.",
          reasonCode: "review_blocked_missing_task_or_run",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        evidenceBundleId,
        messageBody: firstString(
          recordString(inputs, "messageBody"),
          recordString(recordRecord(inputs, "reviewMessage"), "messageBody"),
        ),
        messageId: firstString(
          recordString(inputs, "messageId"),
          recordString(recordRecord(inputs, "reviewMessage"), "messageId"),
        ),
        runId,
        targetSlot: "review",
        taskId,
      }),
    };
  }

  return {
    blocker: {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue review workflow runner.`,
      reasonCode: "review_not_supported_for_workflow",
    },
    ok: false,
  };
}

export async function resolveReviewEvidence({
  events,
  readPort,
  steps,
  target,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  target: QueueWorkflowReviewTarget;
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowReviewEvidenceResolution> {
  if (!readPort.getEvidenceBundle) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue evidence read API is unavailable.",
      reasonCode: "evidence_read_unavailable",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: `read_review_evidence_unavailable:${target.taskId}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState: "unavailable", ok: false };
  }

  const evidenceRequest = stripUndefined({
    evidenceBundleId: target.evidenceBundleId,
    runId: target.runId,
    taskId: target.taskId,
  });
  const evidence = await readPort.getEvidenceBundle(evidenceRequest);
  variables.readSnapshots.evidenceByKey[evidenceKey(evidenceRequest)] =
    evidence;

  const evidenceState = evidence?.state ?? "missing";
  const bundle = evidence?.evidenceBundle ?? null;
  if (evidenceState !== "available" || !bundle) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        evidenceState === "missing"
          ? "Queue review evidence was not returned."
          : `Queue review evidence is not available: ${evidenceState}.`,
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: target.evidenceBundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  if (target.evidenceBundleId && bundle.bundleId !== target.evidenceBundleId) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        "Queue review evidence bundle did not match the explicit evidenceBundleId.",
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: target.evidenceBundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence_mismatch:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  if (target.runId && bundle.runId !== target.runId) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue review evidence run did not match the explicit runId.",
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: bundle.bundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence_run_mismatch:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  pushStep(steps, events, {
    evidenceBundleId: bundle.bundleId,
    message: "Queue review evidence bundle read from backend.",
    phase: "read",
    runId: bundle.runId,
    status: "completed",
    stepId: `read_review_evidence:${evidenceKey(evidenceRequest)}`,
    taskId: target.taskId,
  });

  return {
    evidenceBundleId: bundle.bundleId,
    evidenceState,
    ok: true,
    runId: bundle.runId,
  };
}

export function blockerForCreateReviewResult(
  createResult: QueueWorkflowCreateReviewMessageResult,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: createResult.fieldPath,
    message:
      createResult.message ??
      createResult.blocker?.blockerMessage ??
      `Queue review message creation stopped with status ${createResult.status}.`,
    reasonCode:
      createResult.status === "invalid_input"
        ? "review_create_invalid_input"
        : createResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "review_create_blocked",
    taskId,
  };
}

export function blockerForAckReviewResult(
  ackResult: QueueWorkflowAckReviewMessageResult,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: ackResult.fieldPath,
    message:
      ackResult.message ??
      `Queue review ACK stopped with status ${ackResult.status}.`,
    reasonCode:
      ackResult.status === "invalid_input"
        ? "review_ack_invalid_input"
        : ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "review_ack_blocked",
    taskId,
  };
}

export function messageIdFromCreateResult(
  createResult: QueueWorkflowCreateReviewMessageResult,
): string | undefined {
  return (
    cleanString(createResult.messageId) ??
    cleanString(createResult.existingMessageId) ??
    cleanString(createResult.blocker?.existingMessageId)
  );
}
