import type {
  AgentQueueWorkflowWorkerEvidenceRecordResult,
  AgentQueueWorkerEvidenceOutcome,
} from "../../../../workspace/types";
import {
  DEPENDENCY_WORKFLOWS,
  EMPTY_WORKER_EVIDENCE_REPORT,
  MUTATION_SUMMARY,
  QUEUE_MODULE_ID,
} from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import {
  buildVariables,
  recordRecord,
  recordString,
  stringArray,
} from "./queueWorkflowRunnerRefs";
import { result } from "./queueWorkflowRunnerReports";
import type {
  QueueWorkflowRecordWorkerEvidenceRequest,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerBlockerReason,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStep,
  QueueWorkflowVariables,
  QueueWorkflowWorkerEvidenceReport,
  QueueWorkflowWorkerEvidenceRunnerInput,
  QueueWorkflowWorkerEvidenceStatus,
} from "./queueWorkflowRunnerTypes";

export async function runQueueWorkflowWorkerEvidenceRunner(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };
  let workerEvidenceReport = workerEvidenceReportForInput(input);

  const validationBlocker = validateWorkerEvidenceRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "worker_evidence",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_worker_evidence_request",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "invalid_request",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }

  if (!input.workerEvidencePort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow worker evidence port is unavailable.",
      reasonCode: "worker_evidence_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_worker_evidence_port",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }

  const evidenceInput = resolveWorkerEvidenceInput(input);
  if (!evidenceInput.ok) {
    blockers.push(evidenceInput.blocker);
    pushStep(steps, events, {
      message: evidenceInput.blocker.message,
      phase: "worker_evidence",
      reasonCode: evidenceInput.blocker.reasonCode,
      status: "paused",
      stepId: "resolve_worker_evidence_inputs",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: evidenceInput.blocker.message,
      status: "awaiting_worker_completion",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: workerEvidenceBlockedStatus(evidenceInput.blocker.reasonCode),
      },
    });
  }

  try {
    workerEvidenceReport = {
      ...workerEvidenceReport,
      outcome: evidenceInput.value.outcome,
      runId: evidenceInput.value.runId,
      status: "recording_worker_evidence",
      targetSlot: evidenceInput.value.slot,
      taskId: evidenceInput.value.taskId,
    };
    pushStep(steps, events, {
      message: `Recording Queue worker evidence for ${evidenceInput.value.taskId}/${evidenceInput.value.runId}.`,
      phase: "worker_evidence",
      runId: evidenceInput.value.runId,
      slot: evidenceInput.value.slot,
      status: "completed",
      stepId: "record_worker_evidence",
      taskId: evidenceInput.value.taskId,
    });

    const recordResult =
      await input.workerEvidencePort.recordWorkerEvidenceForSlot({
        actionIdempotencyKey: evidenceInput.value.actionIdempotencyKey,
        actorId: evidenceInput.value.actorId,
        changedFiles: evidenceInput.value.changedFiles,
        changedFilesSummary: evidenceInput.value.changedFilesSummary,
        errorSummary: evidenceInput.value.errorSummary,
        finishedAt: evidenceInput.value.finishedAt,
        metadataJson: evidenceInput.value.metadataJson,
        outcome: evidenceInput.value.outcome,
        runId: evidenceInput.value.runId,
        slot: evidenceInput.value.slot,
        source: evidenceInput.value.source,
        summary: evidenceInput.value.summary,
        taskId: evidenceInput.value.taskId,
        validationSummary: evidenceInput.value.validationSummary,
        workerId: evidenceInput.value.workerId,
        workflowRunId: input.workflowRunId,
      });

    const evidenceBundleId =
      recordResult.binding?.evidenceBundleId ??
      recordResult.evidenceBundle?.bundleId;
    const finalStatus = workerEvidenceStatusForRecordResult(recordResult);
    workerEvidenceReport = {
      ...workerEvidenceReport,
      commandStatus: recordResult.status,
      evidenceBundleId,
      idempotent: recordResult.status === "already_recorded",
      outcome:
        recordResult.binding?.workerOutcome ??
        recordResult.evidenceBundle?.outcome ??
        evidenceInput.value.outcome,
      status: finalStatus,
      workerFinalStatus: recordResult.binding?.workerFinalStatus,
    };

    if (
      recordResult.status === "recorded" ||
      recordResult.status === "already_recorded"
    ) {
      if (evidenceBundleId) {
        setWorkerEvidenceSlotVariables(variables, {
          evidenceBundleId,
          runId: evidenceInput.value.runId,
          slot: evidenceInput.value.slot,
          taskId: evidenceInput.value.taskId,
        });
      }
      mutationSummary.didMutateQueue = recordResult.status === "recorded";
      pushStep(steps, events, {
        evidenceBundleId,
        message: `Queue worker evidence ${recordResult.status}; workflow is ready for review.`,
        phase: "worker_evidence",
        runId: evidenceInput.value.runId,
        slot: evidenceInput.value.slot,
        status: "paused",
        stepId: "worker_evidence_recorded",
        taskId: evidenceInput.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: `Queue worker evidence ${recordResult.status}; review remains a separate phase.`,
        status: "awaiting_review",
        steps,
        variables,
        workerEvidenceReport,
      });
    }

    const blocker = workerEvidenceBlockerFromRecordResult(
      recordResult,
      evidenceInput.value,
    );
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      runId: evidenceInput.value.runId,
      slot: evidenceInput.value.slot,
      status: "blocked",
      stepId: "worker_evidence_blocked",
      taskId: evidenceInput.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: finalStatus,
      steps,
      variables,
      workerEvidenceReport,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue workflow worker evidence recording failed unexpectedly.",
      reasonCode: "failed_unexpected",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "worker_evidence_error",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "failed_unexpected",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }
}

type QueueWorkflowResolvedWorkerEvidenceInput =
  QueueWorkflowRecordWorkerEvidenceRequest & {
    outcome: AgentQueueWorkerEvidenceOutcome;
  };

type QueueWorkflowWorkerEvidenceInputResolution =
  | { ok: true; value: QueueWorkflowResolvedWorkerEvidenceInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

function workerEvidenceReportForInput(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): QueueWorkflowWorkerEvidenceReport {
  return {
    ...EMPTY_WORKER_EVIDENCE_REPORT,
    supportedWorkflow: DEPENDENCY_WORKFLOWS.has(input.request.workflowId),
  };
}

function validateWorkerEvidenceRunnerBoundary({
  request,
  validation,
  workflowRunId,
}: QueueWorkflowWorkerEvidenceRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue worker evidence workflow runner only accepts moduleId queue.",
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

  if (!DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    return {
      fieldPath: "$.workflowId",
      message:
        "Worker evidence recording is supported only for dependency Queue workflows.",
      reasonCode: "worker_evidence_not_supported_for_workflow",
    };
  }

  if (!workflowRunId.trim()) {
    return {
      fieldPath: "$.metadata.workflowRunId",
      message: "Queue worker evidence recording requires a workflowRunId.",
      reasonCode: "missing_workflow_run_id",
    };
  }

  return null;
}

function resolveWorkerEvidenceInput(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): QueueWorkflowWorkerEvidenceInputResolution {
  const workerEvidence = recordRecord(input.request.inputs, "workerEvidence");
  if (!workerEvidence || !Object.keys(workerEvidence).length) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence",
        message:
          "Queue worker evidence recording requires typed inputs.workerEvidence.",
        reasonCode: "worker_evidence_missing_input",
      },
      ok: false,
    };
  }

  const requestedWorkflowRunId = recordString(workerEvidence, "workflowRunId");
  if (requestedWorkflowRunId && requestedWorkflowRunId !== input.workflowRunId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.workflowRunId",
        message:
          "Queue worker evidence workflowRunId must match the persisted workflow run.",
        reasonCode: "worker_evidence_invalid_input",
      },
      ok: false,
    };
  }

  const slot = recordString(workerEvidence, "slot");
  if (slot !== "upstream") {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.slot",
        message:
          "Queue worker evidence recording currently requires slot upstream.",
        reasonCode: "worker_evidence_invalid_input",
      },
      ok: false,
    };
  }

  const taskId = recordString(workerEvidence, "taskId");
  if (!taskId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.taskId",
        message: "Queue worker evidence recording requires typed taskId.",
        reasonCode: "worker_evidence_missing_task",
        slot,
      },
      ok: false,
    };
  }

  const runId = recordString(workerEvidence, "runId");
  if (!runId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.runId",
        message: "Queue worker evidence recording requires typed runId.",
        reasonCode: "worker_evidence_missing_run",
        slot,
        taskId,
      },
      ok: false,
    };
  }

  const outcome = recordString(workerEvidence, "outcome");
  if (!isWorkerEvidenceOutcome(outcome)) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.outcome",
        message:
          "Queue worker evidence recording requires a typed worker outcome.",
        reasonCode: "worker_evidence_invalid_input",
        slot,
        taskId,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      actionIdempotencyKey: recordString(
        workerEvidence,
        "actionIdempotencyKey",
      ),
      actorId: recordString(workerEvidence, "actorId"),
      changedFiles: stringArray(workerEvidence.changedFiles),
      changedFilesSummary: recordString(workerEvidence, "changedFilesSummary"),
      errorSummary: recordString(workerEvidence, "errorSummary"),
      finishedAt: recordString(workerEvidence, "finishedAt"),
      metadataJson: recordString(workerEvidence, "metadataJson"),
      outcome,
      runId,
      slot,
      source: recordString(workerEvidence, "source"),
      summary: recordString(workerEvidence, "summary"),
      taskId,
      validationSummary: recordString(workerEvidence, "validationSummary"),
      workerId: recordString(workerEvidence, "workerId"),
      workflowRunId: input.workflowRunId,
    },
  };
}

function isWorkerEvidenceOutcome(
  value: string | undefined,
): value is AgentQueueWorkerEvidenceOutcome {
  return value === "completed" || value === "not_completed" || value === "failed";
}

function workerEvidenceStatusForRecordResult(
  result: AgentQueueWorkflowWorkerEvidenceRecordResult,
): QueueWorkflowWorkerEvidenceStatus {
  if (result.status === "recorded") return "evidence_recorded";
  if (result.status === "already_recorded") return "evidence_already_recorded";
  if (result.status === "conflict") return "blocked_evidence_conflict";
  return workerEvidenceBlockedStatus(
    blockerReasonFromEvidenceCode(result.blocker?.blockerCode),
  );
}

function workerEvidenceBlockedStatus(
  reasonCode: QueueWorkflowRunnerBlockerReason,
): QueueWorkflowWorkerEvidenceStatus {
  if (reasonCode === "worker_not_complete") return "blocked_worker_not_complete";
  if (reasonCode === "worker_outcome_mismatch") {
    return "blocked_worker_outcome_mismatch";
  }
  if (reasonCode === "worker_evidence_missing_task") return "blocked_missing_task";
  if (reasonCode === "worker_evidence_missing_run") return "blocked_missing_run";
  if (reasonCode === "worker_evidence_conflict") return "blocked_evidence_conflict";
  return "blocked_evidence_missing";
}

function workerEvidenceBlockerFromRecordResult(
  result: AgentQueueWorkflowWorkerEvidenceRecordResult,
  request: QueueWorkflowResolvedWorkerEvidenceInput,
): QueueWorkflowRunnerBlocker {
  const reasonCode =
    result.status === "conflict"
      ? "worker_evidence_conflict"
      : blockerReasonFromEvidenceCode(result.blocker?.blockerCode);
  return {
    fieldPath: result.blocker?.missingRequiredField ?? "$.inputs.workerEvidence",
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue worker evidence recording returned ${result.status}.`,
    reasonCode,
    slot: request.slot,
    taskId: request.taskId,
  };
}

function blockerReasonFromEvidenceCode(
  code: string | null | undefined,
): QueueWorkflowRunnerBlockerReason {
  switch (code) {
    case "missing_task_binding":
    case "slot_task_mismatch":
    case "task_id_mismatch":
    case "missing_task_id":
      return "worker_evidence_missing_task";
    case "missing_run_binding":
    case "run_missing":
    case "slot_run_mismatch":
    case "run_id_mismatch":
    case "missing_run_id":
      return "worker_evidence_missing_run";
    case "worker_not_complete":
    case "worker_run_not_complete":
      return "worker_not_complete";
    case "worker_outcome_mismatch":
      return "worker_outcome_mismatch";
    case "ambiguous_worker_state":
    case "worker_run_state_mismatch":
      return "worker_run_state_mismatch";
    case "evidence_conflict":
    case "evidence_metadata_conflict":
    case "existing_evidence_mismatch":
    case "record_worker_evidence_action_ref_conflict":
    case "record_worker_evidence_action_result_conflict":
      return "worker_evidence_conflict";
    case "recovered_run_ref_mismatch":
    case "evidence_precondition_failed":
      return "worker_evidence_blocked";
    case "invalid_worker_evidence":
      return "worker_evidence_invalid_input";
    default:
      return "worker_evidence_blocked";
  }
}

function setWorkerEvidenceSlotVariables(
  variables: QueueWorkflowVariables,
  binding: {
    evidenceBundleId: string;
    runId: string;
    slot: string;
    taskId: string;
  },
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  const next = {
    ...current,
    evidenceBundleId: binding.evidenceBundleId,
    runId: binding.runId,
    slot: binding.slot,
    taskId: binding.taskId,
  };
  variables.slots[binding.slot] = next;
  variables.evidenceBundleIdsBySlot[binding.slot] = binding.evidenceBundleId;
  variables.runIdsBySlot[binding.slot] = binding.runId;
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
}
