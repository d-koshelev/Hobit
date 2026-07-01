import { validateQueueWorkflowRequest } from "../queueWorkflowRequestValidation";
import type {
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeResult,
} from "./queueWorkflowRuntimeAdapterTypes";
import {
  CREATE_SETUP_START_WORKFLOWS,
  QUEUE_MODULE_ID,
  SUPPORTED_REVIEW_DEFERRED_WORKFLOWS,
  stringInput,
  workflowRunIdFromMetadata,
} from "./queueWorkflowRuntimeGuards";
import { notInvoked } from "./queueWorkflowRuntimeErrors";
import type { HobitAgentWorkflowRequestEnvelopeReadResult } from "../../broker";
import type {
  QueueWorkflowRunnerRequest,
} from "../queueWorkflowRunner";

export type NormalizedQueueWorkflowRuntimeRequest = {
  phase: QueueWorkflowRunnerRuntimePhase;
  request: QueueWorkflowRunnerRequest;
  typedWorkflowRunId: string | null;
  validation: ReturnType<typeof validateQueueWorkflowRequest>;
  validationReasons: readonly string[];
  validationStatus?: string;
};

export function normalizeQueueWorkflowRuntimeRequest(
  workflowRequestRead: HobitAgentWorkflowRequestEnvelopeReadResult,
):
  | { ok: true; value: NormalizedQueueWorkflowRuntimeRequest }
  | { ok: false; result: QueueWorkflowRunnerRuntimeResult } {
  if (workflowRequestRead.status !== "valid") {
    return {
      ok: false,
      result: notInvoked({
        blockers:
          workflowRequestRead.status === "invalid"
            ? workflowRequestRead.reasons
            : [],
        status: "invalid_request",
        summary:
          workflowRequestRead.status === "invalid"
            ? "Invalid Hobit workflow request; Queue workflow runner was not invoked."
            : "No Hobit workflow request was available; Queue workflow runner was not invoked.",
        validationReasons:
          workflowRequestRead.status === "invalid"
            ? workflowRequestRead.reasons
            : [],
      }),
    };
  }

  const request = workflowRequestRead.envelope;
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      ok: false,
      result: notInvoked({
        moduleId: request.moduleId,
        requestId: request.requestId,
        status: "unsupported",
        summary:
          "Queue workflow runner only handles moduleId queue; no workflow runner was invoked.",
        unsupportedReason: "module_not_queue",
        validationReasons: workflowRequestRead.validation.reasons,
        validationStatus: workflowRequestRead.validation.status,
        workflowId: request.workflowId,
      }),
    };
  }

  if (
    !workflowRequestRead.validation.ok &&
    workflowRequestRead.validation.reasonCode !== "input_validation_deferred"
  ) {
    return {
      ok: false,
      result: notInvoked({
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
      }),
    };
  }

  const phaseSelection = resolveRuntimePhase({
    ...(request.grant ? { grant: request.grant } : {}),
    ...(request.inputs ? { inputs: request.inputs } : {}),
    moduleId: request.moduleId,
    requestId: request.requestId,
    workflowId: request.workflowId,
  });
  if (!phaseSelection.ok) {
    return {
      ok: false,
      result: notInvoked({
        blockers: [phaseSelection.reason],
        moduleId: request.moduleId,
        requestId: request.requestId,
        status: phaseSelection.status,
        summary: phaseSelection.reason,
        unsupportedReason: phaseSelection.reasonCode,
        validationReasons: workflowRequestRead.validation.reasons,
        validationStatus: workflowRequestRead.validation.status,
        workflowId: request.workflowId,
      }),
    };
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
    return {
      ok: false,
      result: notInvoked({
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
      }),
    };
  }

  return {
    ok: true,
    value: {
      phase: phaseSelection.phase,
      request: {
        ...(request.grant ? { grant: request.grant } : {}),
        ...(request.inputs ? { inputs: request.inputs } : {}),
        moduleId: request.moduleId,
        requestId: request.requestId,
        workflowId: request.workflowId,
      },
      typedWorkflowRunId: workflowRunIdFromMetadata(request.metadata),
      validation,
      validationReasons: validation.reasons,
      validationStatus: validation.status,
    },
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
      explicitPhase === "create_setup_start" ||
      explicitPhase === "read" ||
      explicitPhase === "review" ||
      explicitPhase === "finalization" ||
      explicitPhase === "worker_evidence"
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

  if (CREATE_SETUP_START_WORKFLOWS.has(request.workflowId)) {
    return { ok: true, phase: "create_setup_start" };
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
