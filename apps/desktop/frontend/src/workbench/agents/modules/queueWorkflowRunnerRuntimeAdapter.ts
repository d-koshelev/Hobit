import type { HobitAgentWorkflowRequestEnvelopeReadResult } from "../broker";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  runQueueWorkflowFinalizationRunner,
  runQueueWorkflowReadOnlyRunner,
  runQueueWorkflowReviewRunner,
  type QueueWorkflowAckReviewMessageResult,
  type QueueWorkflowFinalizationCommandResult,
  type QueueWorkflowFinalizationCommandStatus,
  type QueueWorkflowFinalizationPort,
  type QueueWorkflowReadPort,
  type QueueWorkflowReviewCommandStatus,
  type QueueWorkflowReviewPort,
  type QueueWorkflowRunnerRequest,
  type QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";
import { validateQueueWorkflowRequest } from "./queueWorkflowRequestValidation";

export type QueueWorkflowRunnerRuntimePhase =
  | "finalization"
  | "read"
  | "review";

export type QueueWorkflowRunnerRuntimeStatus =
  | "blocked"
  | "completed"
  | "deferred"
  | "failed_unexpected"
  | "invalid_request"
  | "paused"
  | "unavailable"
  | "unsupported";

export type QueueWorkflowRunnerRuntimePorts = {
  finalizationPort?: QueueWorkflowFinalizationPort | null;
  readPort?: QueueWorkflowReadPort | null;
  reviewPort?: QueueWorkflowReviewPort | null;
};

export type QueueWorkflowRunnerRuntimeAdapterInput = {
  actorId?: string | null;
  ports?: QueueWorkflowRunnerRuntimePorts | null;
  queueBridge?: WorkspaceAgentQueueBridge | null;
  workflowRequestRead: HobitAgentWorkflowRequestEnvelopeReadResult;
};

export type QueueWorkflowRunnerRuntimeResult = {
  blockers: readonly string[];
  invoked: boolean;
  moduleId: string | null;
  phase: QueueWorkflowRunnerRuntimePhase | null;
  phasesExecuted: readonly string[];
  requestId: string | null;
  runnerResult?: QueueWorkflowRunnerResult;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowId: string | null;
};

const QUEUE_MODULE_ID = "queue";
const DEFAULT_ACTOR_ID = "workspace-agent";
const SUPPORTED_REVIEW_DEFERRED_WORKFLOWS = new Set(["review_acceptance"]);

const REVIEW_COMMAND_STATUSES = new Set<QueueWorkflowReviewCommandStatus>([
  "already_done",
  "already_exists",
  "blocked",
  "failed_unexpected",
  "invalid_input",
  "needs_confirmation",
  "policy_blocked",
  "precondition_failed",
  "succeeded",
  "unavailable",
]);

const FINALIZATION_COMMAND_STATUSES =
  new Set<QueueWorkflowFinalizationCommandStatus>([
    "already_done",
    "already_failed",
    "blocked",
    "failed_unexpected",
    "invalid_input",
    "needs_confirmation",
    "policy_blocked",
    "precondition_failed",
    "succeeded",
    "unavailable",
  ]);

export async function runQueueWorkflowRunnerRuntimeAdapter({
  actorId,
  ports,
  queueBridge,
  workflowRequestRead,
}: QueueWorkflowRunnerRuntimeAdapterInput): Promise<QueueWorkflowRunnerRuntimeResult> {
  if (workflowRequestRead.status !== "valid") {
    return notInvoked({
      blockers: workflowRequestRead.status === "invalid" ? workflowRequestRead.reasons : [],
      status: "invalid_request",
      summary:
        workflowRequestRead.status === "invalid"
          ? "Invalid Hobit workflow request; Queue workflow runner was not invoked."
          : "No Hobit workflow request was available; Queue workflow runner was not invoked.",
      validationReasons:
        workflowRequestRead.status === "invalid" ? workflowRequestRead.reasons : [],
    });
  }

  const request = workflowRequestRead.envelope;
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return notInvoked({
      moduleId: request.moduleId,
      requestId: request.requestId,
      status: "unsupported",
      summary:
        "Queue workflow runner only handles moduleId queue; no workflow runner was invoked.",
      unsupportedReason: "module_not_queue",
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  if (
    !workflowRequestRead.validation.ok &&
    workflowRequestRead.validation.reasonCode !== "input_validation_deferred"
  ) {
    return notInvoked({
      blockers: workflowRequestRead.validation.reasons,
      moduleId: request.moduleId,
      requestId: request.requestId,
      status:
        workflowRequestRead.validation.reasonCode === "workflow_not_declared" ||
        workflowRequestRead.validation.reasonCode === "workflow_unavailable"
          ? "unsupported"
          : "invalid_request",
      summary:
        "Queue workflow request was not runner-supported; Queue workflow runner was not invoked.",
      unsupportedReason: workflowRequestRead.validation.reasonCode,
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  const phaseSelection = resolveRuntimePhase(request);
  if (!phaseSelection.ok) {
    return notInvoked({
      blockers: [phaseSelection.reason],
      moduleId: request.moduleId,
      requestId: request.requestId,
      status: phaseSelection.status,
      summary: phaseSelection.reason,
      unsupportedReason: phaseSelection.reasonCode,
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  const validation = validateQueueWorkflowRequest({
    ...(request.grant ? { grant: request.grant } : {}),
    ...(request.inputs ? { inputs: request.inputs } : {}),
    moduleId: request.moduleId,
    workflowId: request.workflowId,
  });
  if (
    !validation.ok &&
    !(
      validation.status === "input_validation_deferred" &&
      phaseSelection.phase === "review" &&
      SUPPORTED_REVIEW_DEFERRED_WORKFLOWS.has(request.workflowId)
    )
  ) {
    return notInvoked({
      blockers: validation.reasons,
      moduleId: request.moduleId,
      requestId: request.requestId,
      status:
        validation.status === "input_validation_deferred"
          ? "deferred"
          : "invalid_request",
      summary:
        validation.status === "input_validation_deferred"
          ? "Queue workflow input validation is deferred for this workflow; Queue workflow runner was not invoked."
          : "Queue workflow validation failed; Queue workflow runner was not invoked.",
      unsupportedReason: validation.status,
      validationReasons: validation.reasons,
      validationStatus: validation.status,
      workflowId: request.workflowId,
    });
  }

  const runnerRequest: QueueWorkflowRunnerRequest = {
    ...(request.grant ? { grant: request.grant } : {}),
    ...(request.inputs ? { inputs: request.inputs } : {}),
    moduleId: request.moduleId,
    requestId: request.requestId,
    workflowId: request.workflowId,
  };
  const runtimePorts =
    ports ??
    createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
      actorId: actorId?.trim() || DEFAULT_ACTOR_ID,
      queueBridge,
    });
  const runnerResult = await runSelectedRunner({
    phase: phaseSelection.phase,
    ports: runtimePorts,
    request: runnerRequest,
    validation,
  });

  return {
    blockers: runnerResult.blockers.map((blocker) => blocker.message),
    invoked: true,
    moduleId: request.moduleId,
    phase: phaseSelection.phase,
    phasesExecuted: phasesExecuted(runnerResult, phaseSelection.phase),
    requestId: request.requestId,
    runnerResult,
    status: runtimeStatusFromRunner(runnerResult.status),
    summary: runnerResult.report.summary,
    validationReasons: validation.reasons,
    validationStatus: validation.status,
    workflowId: request.workflowId,
  };
}

export function createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
  actorId,
  queueBridge,
}: {
  actorId: string;
  queueBridge?: WorkspaceAgentQueueBridge | null;
}): QueueWorkflowRunnerRuntimePorts {
  return {
    finalizationPort: queueBridge
      ? createFinalizationPort(queueBridge, actorId)
      : null,
    readPort: queueBridge ? createReadPort(queueBridge) : null,
    reviewPort: queueBridge ? createReviewPort(queueBridge, actorId) : null,
  };
}

async function runSelectedRunner({
  phase,
  ports,
  request,
  validation,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  ports: QueueWorkflowRunnerRuntimePorts;
  request: QueueWorkflowRunnerRequest;
  validation: Parameters<typeof runQueueWorkflowReadOnlyRunner>[0]["validation"];
}) {
  if (phase === "review") {
    return runQueueWorkflowReviewRunner({
      readPort: ports.readPort,
      request,
      reviewPort: ports.reviewPort,
      validation,
    });
  }

  if (phase === "finalization") {
    return runQueueWorkflowFinalizationRunner({
      finalizationPort: ports.finalizationPort,
      readPort: ports.readPort,
      request,
      validation,
    });
  }

  return runQueueWorkflowReadOnlyRunner({
    readPort: ports.readPort,
    request,
    validation,
  });
}

function createReadPort(
  queueBridge: WorkspaceAgentQueueBridge,
): QueueWorkflowReadPort | null {
  if (!queueBridge.getItemAggregate || !queueBridge.listItemAggregates) {
    return null;
  }

  return {
    getEvidenceBundle: queueBridge.getWorkerEvidenceBundle
      ? (request) =>
          queueBridge.getWorkerEvidenceBundle!({
            ...(request.runId ? { runId: request.runId } : {}),
            taskId: request.taskId,
          })
      : undefined,
    getLifecycle: (taskId) => queueBridge.getItemAggregate!({ taskId }),
    getQueueItemAggregate: (taskId) => queueBridge.getItemAggregate!({ taskId }),
    listQueueItemAggregates: () => queueBridge.listItemAggregates!(),
  };
}

function createReviewPort(
  queueBridge: WorkspaceAgentQueueBridge,
  actorId: string,
): QueueWorkflowReviewPort | null {
  if (!queueBridge.createReviewMessage || !queueBridge.ackReviewMessage) {
    return null;
  }

  return {
    ackReviewMessage: async (request): Promise<QueueWorkflowAckReviewMessageResult> => {
      const result = await queueBridge.ackReviewMessage!({
        actorId,
        messageId: request.messageId,
        taskId: request.taskId,
      });
      const candidate = result as { status?: unknown };
      return {
        aggregate: result.aggregate,
        durable: result.durable,
        messageId: result.messageId,
        reviewMessage: result.reviewMessage,
        status: reviewCommandStatus(candidate.status, "succeeded"),
        taskId: result.taskId,
      };
    },
    createReviewMessage: async (request) => {
      const result = await queueBridge.createReviewMessage!({
        actorId,
        evidenceBundleId: request.evidenceBundleId,
        messageBody: request.messageBody,
        runId: request.runId,
        taskId: request.taskId,
      });
      return {
        aggregate: result.aggregate,
        blocker: result.blocker,
        durable: result.durable,
        evidenceBundleId: result.evidenceBundleId,
        existingMessageId: result.blocker?.existingMessageId,
        messageId: result.messageId,
        reviewMessage: result.reviewMessage,
        runId: result.runId,
        status: reviewCommandStatus(result.status, "failed_unexpected"),
        taskId: result.taskId,
      };
    },
  };
}

function createFinalizationPort(
  queueBridge: WorkspaceAgentQueueBridge,
  actorId: string,
): QueueWorkflowFinalizationPort | null {
  if (!queueBridge.markItemDone || !queueBridge.failItem) {
    return null;
  }

  return {
    failItem: async (request) => {
      const result = await queueBridge.failItem!({
        actorId,
        confirmationToken: request.confirmationToken,
        evidenceBundleId: request.evidenceBundleId,
        reason: request.reason,
        reviewMessageId: request.messageId,
        runId: request.runId,
        taskId: request.taskId,
      });
      return finalizationResult({
        aggregate: result.aggregate,
        blocker: result.blocker,
        durable: result.durable,
        evidenceBundleId: result.evidenceBundleId,
        runId: result.runId,
        status: result.status,
        taskId: result.taskId,
      });
    },
    markDone: async (request) => {
      const result = await queueBridge.markItemDone!({
        actorId,
        confirmationToken: request.confirmationToken,
        reason: request.reason,
        reviewMessageId: request.messageId,
        runId: request.runId,
        taskId: request.taskId,
      });
      return finalizationResult({
        aggregate: result.aggregate,
        blocker: result.blocker,
        durable: result.durable,
        evidenceBundleId: result.evidenceBundleId,
        runId: result.runId,
        status: result.status,
        taskId: result.taskId,
      });
    },
  };
}

function finalizationResult(
  result: Omit<QueueWorkflowFinalizationCommandResult, "status"> & {
    status: unknown;
  },
): QueueWorkflowFinalizationCommandResult {
  return {
    ...result,
    status: finalizationCommandStatus(result.status),
  };
}

function resolveRuntimePhase(
  request: QueueWorkflowRunnerRequest,
):
  | { ok: true; phase: QueueWorkflowRunnerRuntimePhase }
  | {
      ok: false;
      reason: string;
      reasonCode: string;
      status: "deferred" | "unsupported";
    } {
  const explicitPhase = stringInput(request.inputs, "phase");
  if (explicitPhase) {
    if (
      explicitPhase === "read" ||
      explicitPhase === "review" ||
      explicitPhase === "finalization"
    ) {
      return { ok: true, phase: explicitPhase };
    }

    return {
      ok: false,
      reason: `Queue workflow runner phase ${explicitPhase} is not supported.`,
      reasonCode: "unsupported_runner_phase",
      status: "unsupported",
    };
  }

  if (request.workflowId === "review_acceptance") {
    return { ok: true, phase: "review" };
  }

  if (request.workflowId === "terminal_failure") {
    return {
      ok: false,
      reason:
        "terminal_failure workflow runner integration is deferred; no Queue runner phase was invoked.",
      reasonCode: "terminal_failure_deferred",
      status: "deferred",
    };
  }

  return { ok: true, phase: "read" };
}

function runtimeStatusFromRunner(
  status: QueueWorkflowRunnerResult["status"],
): QueueWorkflowRunnerRuntimeStatus {
  if (
    status === "completed" ||
    status === "review_acknowledged" ||
    status === "review_completed" ||
    status === "finalization_already_done" ||
    status === "finalization_already_failed" ||
    status === "finalization_completed"
  ) {
    return "completed";
  }

  if (
    status === "paused" ||
    status === "finalization_needs_confirmation"
  ) {
    return "paused";
  }

  if (status === "invalid_request" || status === "finalization_invalid_input") {
    return "invalid_request";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  if (
    status === "failed_unexpected" ||
    status === "finalization_failed_unexpected"
  ) {
    return "failed_unexpected";
  }

  if (
    status === "review_not_supported_for_workflow" ||
    status === "finalization_not_supported_for_workflow"
  ) {
    return "unsupported";
  }

  return "blocked";
}

function phasesExecuted(
  runnerResult: QueueWorkflowRunnerResult,
  selectedPhase: QueueWorkflowRunnerRuntimePhase,
): readonly string[] {
  const phases = [
    selectedPhase,
    ...runnerResult.steps.map((step) => step.phase),
  ]
    .filter(
      (phase): phase is NonNullable<typeof phase> => phase !== undefined,
    );
  return [...new Set(phases)];
}

function reviewCommandStatus(
  value: unknown,
  fallback: QueueWorkflowReviewCommandStatus,
): QueueWorkflowReviewCommandStatus {
  return typeof value === "string" &&
    REVIEW_COMMAND_STATUSES.has(value as QueueWorkflowReviewCommandStatus)
    ? (value as QueueWorkflowReviewCommandStatus)
    : fallback;
}

function finalizationCommandStatus(
  value: unknown,
): QueueWorkflowFinalizationCommandStatus {
  return typeof value === "string" &&
    FINALIZATION_COMMAND_STATUSES.has(
      value as QueueWorkflowFinalizationCommandStatus,
    )
    ? (value as QueueWorkflowFinalizationCommandStatus)
    : "failed_unexpected";
}

function notInvoked({
  blockers = [],
  moduleId = null,
  requestId = null,
  status,
  summary,
  unsupportedReason,
  validationReasons = [],
  validationStatus,
  workflowId = null,
}: {
  blockers?: readonly string[];
  moduleId?: string | null;
  requestId?: string | null;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons?: readonly string[];
  validationStatus?: string;
  workflowId?: string | null;
}): QueueWorkflowRunnerRuntimeResult {
  return {
    blockers,
    invoked: false,
    moduleId,
    phase: null,
    phasesExecuted: [],
    requestId,
    status,
    summary,
    ...(unsupportedReason ? { unsupportedReason } : {}),
    validationReasons,
    ...(validationStatus ? { validationStatus } : {}),
    workflowId,
  };
}

function stringInput(
  inputs: QueueWorkflowRunnerRequest["inputs"],
  fieldName: string,
): string | null {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return null;
  }

  const value = inputs[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
