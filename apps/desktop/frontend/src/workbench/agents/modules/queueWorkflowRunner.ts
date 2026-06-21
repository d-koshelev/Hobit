import type {
  WorkflowGrant,
  WorkflowInputs,
} from "../broker/workflowGrantInputSplit";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkerEvidenceQueryResult,
} from "../../../workspace/types";
import type { QueueWorkflowId } from "./queueWorkflowModuleMetadata";
import type { QueueWorkflowRequestValidationResult } from "./queueWorkflowRequestValidation";

export type QueueWorkflowRunnerStatus =
  | "completed"
  | "blocked"
  | "paused"
  | "invalid_request"
  | "unavailable"
  | "failed_unexpected";

export type QueueWorkflowRunnerStepStatus =
  | "completed"
  | "blocked"
  | "paused"
  | "skipped"
  | "unavailable"
  | "failed_unexpected";

export type QueueWorkflowRunnerBlockerReason =
  | "aggregate_not_found"
  | "evidence_read_unavailable"
  | "failed_unexpected"
  | "input_validation_deferred"
  | "invalid_request"
  | "missing_explicit_evidence_ids"
  | "missing_explicit_task_ids"
  | "read_only_runner_requires_existing_tasks"
  | "read_port_unavailable"
  | "workflow_not_supported_read_only";

export type QueueWorkflowRunnerBlocker = {
  fieldPath?: string;
  message: string;
  reasonCode: QueueWorkflowRunnerBlockerReason;
  slot?: string;
  taskId?: string;
};

export type QueueWorkflowRunnerEvent = {
  message: string;
  reasonCode?: QueueWorkflowRunnerBlockerReason;
  slot?: string;
  status: QueueWorkflowRunnerStepStatus;
  taskId?: string;
  timestamp?: string;
};

export type QueueWorkflowRunnerStep = {
  evidenceBundleId?: string;
  message: string;
  reasonCode?: QueueWorkflowRunnerBlockerReason;
  runId?: string;
  slot?: string;
  status: QueueWorkflowRunnerStepStatus;
  stepId: string;
  taskId?: string;
};

export type QueueWorkflowLifecycleSnapshot =
  | AgentQueueItemAggregate
  | {
      aggregate?: AgentQueueItemAggregate | null;
      blockers?: readonly unknown[];
      dependencyState?: string;
      evidenceState?: string;
      reviewState?: string;
      taskId?: string;
      ticketState?: string;
      workerRunState?: string;
    };

export type QueueWorkflowEvidenceReadRequest = {
  evidenceBundleId?: string;
  runId?: string;
  taskId: string;
};

export type QueueWorkflowReadPort = {
  getEvidenceBundle?: (
    request: QueueWorkflowEvidenceReadRequest,
  ) => Promise<AgentQueueWorkerEvidenceQueryResult | null>;
  getLifecycle?: (
    taskId: string,
  ) => Promise<QueueWorkflowLifecycleSnapshot | null>;
  getQueueItemAggregate: (
    taskId: string,
  ) => Promise<AgentQueueItemAggregate | null>;
  listQueueItemAggregates: () => Promise<readonly AgentQueueItemAggregate[]>;
};

export type QueueWorkflowRunnerRequest = {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  moduleId: string;
  requestId: string;
  workflowId: string;
};

export type QueueWorkflowSlotVariables = {
  evidenceBundleId?: string;
  messageId?: string;
  runId?: string;
  slot: string;
  taskId?: string;
};

export type QueueWorkflowReadSnapshots = {
  aggregatesByTaskId: Record<string, AgentQueueItemAggregate | null>;
  evidenceByKey: Record<string, AgentQueueWorkerEvidenceQueryResult | null>;
  lifecycleByTaskId: Record<string, QueueWorkflowLifecycleSnapshot | null>;
};

export type QueueWorkflowVariables = {
  evidenceBundleIdsBySlot: Record<string, string>;
  messageIdsBySlot: Record<string, string>;
  readSnapshots: QueueWorkflowReadSnapshots;
  runIdsBySlot: Record<string, string>;
  scopedEvidenceBundleIds: string[];
  scopedMessageIds: string[];
  scopedRunIds: string[];
  scopedTaskIds: string[];
  slots: Record<string, QueueWorkflowSlotVariables>;
  taskIdsBySlot: Record<string, string>;
  workflowId: string;
  requestId: string;
};

export type QueueWorkflowRunnerReport = {
  evidenceReads: QueueWorkflowEvidenceReadRequest[];
  missingExplicitIds: string[];
  mutationSummary: {
    didAckReview: false;
    didBlock: false;
    didCreateReviewMessage: false;
    didFail: false;
    didFollowUp: false;
    didMarkDone: false;
    didMutateQueue: false;
    didStartWorker: false;
    didValidate: false;
    didLaunchTerminal: false;
    didMutateGit: false;
    didRollback: false;
  };
  nextMutatingPhase: string | null;
  readOnly: true;
  summary: string;
  taskReads: string[];
};

export type QueueWorkflowRunnerResult = {
  blockers: QueueWorkflowRunnerBlocker[];
  events: QueueWorkflowRunnerEvent[];
  report: QueueWorkflowRunnerReport;
  requestId: string;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
  workflowId: string;
};

export type QueueWorkflowRunnerInput = {
  readPort?: QueueWorkflowReadPort | null;
  request: QueueWorkflowRunnerRequest;
  validation: QueueWorkflowRequestValidationResult;
};

const QUEUE_MODULE_ID = "queue";
const DEPENDENCY_WORKFLOWS = new Set<string>([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
]);
const VALIDATION_DEFERRED_WORKFLOWS = new Set<string>([
  "review_acceptance",
  "terminal_failure",
]);
const DEPENDENCY_REQUIRED_SLOTS = ["upstream", "downstream"] as const;
const MUTATION_SUMMARY: QueueWorkflowRunnerReport["mutationSummary"] = {
  didAckReview: false,
  didBlock: false,
  didCreateReviewMessage: false,
  didFail: false,
  didFollowUp: false,
  didLaunchTerminal: false,
  didMarkDone: false,
  didMutateGit: false,
  didMutateQueue: false,
  didRollback: false,
  didStartWorker: false,
  didValidate: false,
};

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

async function readTaskSnapshots({
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

async function readEvidenceSnapshots({
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

function buildVariables(request: QueueWorkflowRunnerRequest): QueueWorkflowVariables {
  const taskIdsBySlot = stringRecord(request.inputs?.taskIdsBySlot);
  const runIdsBySlot = stringRecord(request.inputs?.runIdsBySlot);
  const evidenceBundleIdsBySlot = stringRecord(
    request.inputs?.evidenceBundleIdsBySlot,
  );
  const messageIdsBySlot = stringRecord(request.inputs?.messageIdsBySlot);
  const slots = slotVariables({
    evidenceBundleIdsBySlot,
    inputs: request.inputs,
    messageIdsBySlot,
    runIdsBySlot,
    taskIdsBySlot,
  });

  return {
    evidenceBundleIdsBySlot,
    messageIdsBySlot,
    readSnapshots: {
      aggregatesByTaskId: {},
      evidenceByKey: {},
      lifecycleByTaskId: {},
    },
    requestId: request.requestId,
    runIdsBySlot,
    scopedEvidenceBundleIds: stringArray(request.grant?.scope?.evidenceBundleIds),
    scopedMessageIds: stringArray(request.grant?.scope?.messageIds),
    scopedRunIds: stringArray(request.grant?.scope?.runIds),
    scopedTaskIds: stringArray(request.grant?.scope?.taskIds),
    slots,
    taskIdsBySlot,
    workflowId: request.workflowId,
  };
}

function slotVariables({
  evidenceBundleIdsBySlot,
  inputs,
  messageIdsBySlot,
  runIdsBySlot,
  taskIdsBySlot,
}: {
  evidenceBundleIdsBySlot: Record<string, string>;
  inputs?: WorkflowInputs;
  messageIdsBySlot: Record<string, string>;
  runIdsBySlot: Record<string, string>;
  taskIdsBySlot: Record<string, string>;
}): Record<string, QueueWorkflowSlotVariables> {
  const slots = new Set<string>();
  const taskTemplates = Array.isArray(inputs?.tasks) ? inputs.tasks : [];

  for (const task of taskTemplates) {
    if (isRecord(task) && typeof task.slot === "string" && task.slot.trim()) {
      slots.add(task.slot.trim());
    }
  }
  for (const slot of Object.keys(taskIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(runIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(evidenceBundleIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(messageIdsBySlot)) slots.add(slot);

  const variables: Record<string, QueueWorkflowSlotVariables> = {};
  for (const slot of slots) {
    variables[slot] = stripUndefined({
      evidenceBundleId: evidenceBundleIdsBySlot[slot],
      messageId: messageIdsBySlot[slot],
      runId: runIdsBySlot[slot],
      slot,
      taskId: taskIdsBySlot[slot],
    });
  }

  return variables;
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

function missingAggregateBlockersForReads(
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

function result({
  blockers,
  events,
  reportSummary,
  status,
  steps,
  variables,
}: {
  blockers: QueueWorkflowRunnerBlocker[];
  events: QueueWorkflowRunnerEvent[];
  reportSummary: string;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): QueueWorkflowRunnerResult {
  const evidenceReads = Object.keys(variables.readSnapshots.evidenceByKey).map(
    evidenceRequestFromKey,
  );

  return {
    blockers,
    events,
    report: {
      evidenceReads,
      missingExplicitIds: blockers
        .filter((blocker) =>
          [
            "missing_explicit_evidence_ids",
            "missing_explicit_task_ids",
            "read_only_runner_requires_existing_tasks",
          ].includes(blocker.reasonCode),
        )
        .map((blocker) => blocker.fieldPath ?? blocker.reasonCode),
      mutationSummary: { ...MUTATION_SUMMARY },
      nextMutatingPhase: nextMutatingPhase(variables.workflowId),
      readOnly: true,
      summary: reportSummary,
      taskReads: Object.keys(variables.readSnapshots.aggregatesByTaskId),
    },
    requestId: variables.requestId,
    status,
    steps,
    variables,
    workflowId: variables.workflowId,
  };
}

function nextMutatingPhase(workflowId: string): string | null {
  switch (workflowId as QueueWorkflowId) {
    case "dependency_acceptance_smoke":
      return "Later runner phases may create/setup/run/review/final-accept tasks, but this runner only reads.";
    case "dependency_failure_smoke":
      return "Later runner phases may create/setup/run/review/terminal-fail tasks, but this runner only reads.";
    case "review_acceptance":
    case "terminal_failure":
      return null;
  }
}

function pushStep(
  steps: QueueWorkflowRunnerStep[],
  events: QueueWorkflowRunnerEvent[],
  step: QueueWorkflowRunnerStep,
) {
  steps.push(stripUndefined(step));
  events.push(
    stripUndefined({
      message: step.message,
      reasonCode: step.reasonCode,
      slot: step.slot,
      status: step.status,
      taskId: step.taskId,
    }),
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim()) {
      record[key] = item.trim();
    }
  }
  return record;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueEvidenceRequests(
  requests: readonly QueueWorkflowEvidenceReadRequest[],
): QueueWorkflowEvidenceReadRequest[] {
  const seen = new Set<string>();
  const unique: QueueWorkflowEvidenceReadRequest[] = [];
  for (const request of requests) {
    const key = evidenceKey(request);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(request);
  }
  return unique;
}

function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}

function evidenceRequestFromKey(key: string): QueueWorkflowEvidenceReadRequest {
  const [taskId = "", runId = "", evidenceBundleId = ""] = key.split("|");
  return stripUndefined({
    evidenceBundleId: evidenceBundleId || undefined,
    runId: runId || undefined,
    taskId,
  });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
