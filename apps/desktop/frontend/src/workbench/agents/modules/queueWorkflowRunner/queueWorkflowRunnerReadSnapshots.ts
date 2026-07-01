import {
  DEPENDENCY_REQUIRED_SLOTS,
  DEPENDENCY_WORKFLOWS,
  QUEUE_MODULE_ID,
  VALIDATION_DEFERRED_WORKFLOWS,
} from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import {
  buildVariables,
  evidenceKey,
  isRecord,
  nonEmptyString,
  stringArray,
  stripUndefined,
  uniqueEvidenceRequests,
  uniqueStrings,
} from "./queueWorkflowRunnerRefs";
import { result } from "./queueWorkflowRunnerReports";
import type {
  QueueWorkflowEvidenceReadRequest,
  QueueWorkflowReadPort,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerInput,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStatus,
  QueueWorkflowRunnerStep,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

export async function runQueueWorkflowReadOnlyRunner(
  input: QueueWorkflowRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);

  const validationBlocker = validateRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      reasonCode: validationBlocker.reasonCode,
      status:
        validationBlocker.reasonCode === "input_validation_deferred"
          ? "paused"
          : "blocked",
      stepId: "validate_request",
    });
    return result({
      blockers,
      events,
      reportSummary: validationBlocker.message,
      status:
        validationBlocker.reasonCode === "input_validation_deferred"
          ? "paused"
          : "invalid_request",
      steps,
      variables,
    });
  }

  if (VALIDATION_DEFERRED_WORKFLOWS.has(input.request.workflowId)) {
    const blocker = blockerForDeferredWorkflow(input.request.workflowId);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "paused",
      stepId: "defer_workflow",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "paused",
      steps,
      variables,
    });
  }

  if (!DEPENDENCY_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the read-only Queue workflow runner.`,
      reasonCode: "workflow_not_supported_read_only",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_workflow",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "blocked",
      steps,
      variables,
    });
  }

  const readTaskIds = explicitReadTaskIds(variables);
  const missingSlotBlockers = missingDependencySlotBlockers(variables);
  blockers.push(...missingSlotBlockers);

  if (readTaskIds.length === 0) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.inputs.taskIdsBySlot",
      message:
        "Read-only Queue workflow runner requires explicit existing task ids for dependency smoke inspection.",
      reasonCode: "read_only_runner_requires_existing_tasks",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "paused",
      stepId: "resolve_explicit_task_ids",
    });
    return result({
      blockers,
      events,
      reportSummary:
        "Paused before Queue reads because no explicit existing task ids were supplied.",
      status: "paused",
      steps,
      variables,
    });
  }

  if (!input.readPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow read port is unavailable.",
      reasonCode: "read_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_read_port",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  try {
    await readTaskSnapshots({
      events,
      readPort: input.readPort,
      steps,
      taskIds: readTaskIds,
      variables,
    });

    const evidenceBlockers = await readEvidenceSnapshots({
      events,
      readPort: input.readPort,
      request: input.request,
      steps,
      variables,
    });
    blockers.push(...evidenceBlockers);
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue workflow read failed unexpectedly.",
      reasonCode: "failed_unexpected",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "read_failed",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "failed_unexpected",
      steps,
      variables,
    });
  }

  const missingAggregateBlockers = missingAggregateBlockersForReads(
    variables,
    readTaskIds,
  );
  blockers.push(...missingAggregateBlockers);

  const status = finalStatus(blockers);
  return result({
    blockers,
    events,
    reportSummary:
      status === "completed"
        ? "Read-only Queue workflow inspection completed without Queue mutation."
        : "Read-only Queue workflow inspection paused or blocked with explicit diagnostics.",
    status,
    steps,
    variables,
  });
}

function validateRunnerBoundary({
  request,
  validation,
}: QueueWorkflowRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue workflow runner only accepts moduleId queue.",
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

function blockerForDeferredWorkflow(workflowId: string): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: "$.inputs",
    message: `${workflowId} input validation is deferred; the read-only runner will not inspect or execute it yet.`,
    reasonCode: "input_validation_deferred",
  };
}

export async function readTaskSnapshots({
  events,
  readPort,
  steps,
  taskIds,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  taskIds: readonly string[];
  variables: QueueWorkflowVariables;
}) {
  for (const taskId of taskIds) {
    const aggregate = await readPort.getQueueItemAggregate(taskId);
    variables.readSnapshots.aggregatesByTaskId[taskId] = aggregate;
    pushStep(steps, events, {
      message: aggregate
        ? `Read Queue aggregate for ${taskId}.`
        : `Queue aggregate not found for ${taskId}.`,
      reasonCode: aggregate ? undefined : "aggregate_not_found",
      status: aggregate ? "completed" : "blocked",
      stepId: `read_aggregate:${taskId}`,
      taskId,
    });

    const lifecycle = readPort.getLifecycle
      ? await readPort.getLifecycle(taskId)
      : aggregate;
    variables.readSnapshots.lifecycleByTaskId[taskId] = lifecycle;
    pushStep(steps, events, {
      message: lifecycle
        ? `Read Queue lifecycle for ${taskId}.`
        : `Queue lifecycle not found for ${taskId}.`,
      reasonCode: lifecycle ? undefined : "aggregate_not_found",
      status: lifecycle ? "completed" : "blocked",
      stepId: `read_lifecycle:${taskId}`,
      taskId,
    });
  }
}

export async function readEvidenceSnapshots({
  events,
  readPort,
  request,
  steps,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  request: QueueWorkflowRunnerRequest;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowRunnerBlocker[]> {
  const evidenceRequests = explicitEvidenceRequests(request, variables);
  const blockers: QueueWorkflowRunnerBlocker[] = [];

  for (const evidenceRequest of evidenceRequests) {
    if (!evidenceRequest.runId && !evidenceRequest.evidenceBundleId) {
      blockers.push({
        fieldPath: "$.inputs.evidenceReads",
        message:
          "Evidence inspection requires explicit taskId plus runId or evidenceBundleId.",
        reasonCode: "missing_explicit_evidence_ids",
        taskId: evidenceRequest.taskId,
      });
      pushStep(steps, events, {
        message:
          "Skipped evidence read because explicit runId or evidenceBundleId was missing.",
        reasonCode: "missing_explicit_evidence_ids",
        status: "paused",
        stepId: `skip_evidence:${evidenceRequest.taskId}`,
        taskId: evidenceRequest.taskId,
      });
      continue;
    }

    if (!readPort.getEvidenceBundle) {
      blockers.push({
        message: "Queue evidence read API is unavailable.",
        reasonCode: "evidence_read_unavailable",
        taskId: evidenceRequest.taskId,
      });
      pushStep(steps, events, {
        message: "Queue evidence read API is unavailable.",
        reasonCode: "evidence_read_unavailable",
        status: "unavailable",
        stepId: `read_evidence_unavailable:${evidenceRequest.taskId}`,
        taskId: evidenceRequest.taskId,
      });
      continue;
    }

    const evidence = await readPort.getEvidenceBundle(evidenceRequest);
    variables.readSnapshots.evidenceByKey[evidenceKey(evidenceRequest)] =
      evidence;
    pushStep(steps, events, {
      evidenceBundleId: evidenceRequest.evidenceBundleId,
      message: evidence
        ? `Read Queue evidence for ${evidenceRequest.taskId}.`
        : `Queue evidence not found for ${evidenceRequest.taskId}.`,
      runId: evidenceRequest.runId,
      status: "completed",
      stepId: `read_evidence:${evidenceKey(evidenceRequest)}`,
      taskId: evidenceRequest.taskId,
    });
  }

  return blockers;
}

function explicitReadTaskIds(variables: QueueWorkflowVariables): string[] {
  return uniqueStrings([
    ...Object.values(variables.taskIdsBySlot),
    ...variables.scopedTaskIds,
  ]);
}

function missingDependencySlotBlockers(
  variables: QueueWorkflowVariables,
): QueueWorkflowRunnerBlocker[] {
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  for (const slot of DEPENDENCY_REQUIRED_SLOTS) {
    if (!variables.taskIdsBySlot[slot]) {
      blockers.push({
        fieldPath: `$.inputs.taskIdsBySlot.${slot}`,
        message: `Read-only dependency workflow inspection requires explicit existing task id for slot ${slot}.`,
        reasonCode: "missing_explicit_task_ids",
        slot,
      });
    }
  }

  return blockers;
}

function explicitEvidenceRequests(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowEvidenceReadRequest[] {
  const requests: QueueWorkflowEvidenceReadRequest[] = [];
  const evidenceReads = Array.isArray(request.inputs?.evidenceReads)
    ? request.inputs.evidenceReads
    : [];

  for (const item of evidenceReads) {
    if (!isRecord(item) || !nonEmptyString(item.taskId)) {
      continue;
    }
    requests.push(
      stripUndefined({
        evidenceBundleId: nonEmptyString(item.evidenceBundleId)
          ? item.evidenceBundleId.trim()
          : undefined,
        runId: nonEmptyString(item.runId) ? item.runId.trim() : undefined,
        taskId: item.taskId.trim(),
      }),
    );
  }

  for (const slot of Object.values(variables.slots)) {
    if (!slot.taskId || (!slot.runId && !slot.evidenceBundleId)) {
      continue;
    }
    requests.push(
      stripUndefined({
        evidenceBundleId: slot.evidenceBundleId,
        runId: slot.runId,
        taskId: slot.taskId,
      }),
    );
  }

  return uniqueEvidenceRequests(requests);
}

export function missingAggregateBlockersForReads(
  variables: QueueWorkflowVariables,
  taskIds: readonly string[],
): QueueWorkflowRunnerBlocker[] {
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  for (const taskId of taskIds) {
    if (variables.readSnapshots.aggregatesByTaskId[taskId] === null) {
      blockers.push({
        message: `Queue aggregate not found for explicit task id ${taskId}.`,
        reasonCode: "aggregate_not_found",
        taskId,
      });
    }
  }
  return blockers;
}

function finalStatus(
  blockers: readonly QueueWorkflowRunnerBlocker[],
): QueueWorkflowRunnerStatus {
  if (blockers.length === 0) {
    return "completed";
  }
  if (
    blockers.some((blocker) =>
      [
        "input_validation_deferred",
        "missing_explicit_evidence_ids",
        "missing_explicit_task_ids",
        "read_only_runner_requires_existing_tasks",
      ].includes(blocker.reasonCode),
    )
  ) {
    return "paused";
  }
  if (
    blockers.some((blocker) =>
      ["evidence_read_unavailable", "read_port_unavailable"].includes(
        blocker.reasonCode,
      ),
    )
  ) {
    return "unavailable";
  }
  if (
    blockers.some((blocker) => blocker.reasonCode === "failed_unexpected")
  ) {
    return "failed_unexpected";
  }
  return "blocked";
}
