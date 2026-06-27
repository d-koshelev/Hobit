import type {
  QueueWorkflowRunnerRuntimeAdapterInput,
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapterTypes";
import { workflowRunIdFromMetadata } from "./queueWorkflowRuntimeGuards";

export function unexpectedRuntimeFailureResult(
  input: QueueWorkflowRunnerRuntimeAdapterInput,
): QueueWorkflowRunnerRuntimeResult {
  const request =
    input.workflowRequestRead.status === "valid"
      ? input.workflowRequestRead.envelope
      : null;

  return notInvoked({
    blockers: ["Unexpected Queue workflow runtime adapter failure."],
    moduleId: request?.moduleId ?? null,
    requestId: request?.requestId ?? null,
    status: "failed_unexpected",
    summary:
      "Queue workflow runtime adapter failed unexpectedly; no workflow step was executed.",
    validationReasons:
      input.workflowRequestRead.status === "valid"
        ? input.workflowRequestRead.validation.reasons
        : [],
    validationStatus:
      input.workflowRequestRead.status === "valid"
        ? input.workflowRequestRead.validation.status
        : undefined,
    workflowId: request?.workflowId ?? null,
    workflowRunId: request
      ? workflowRunIdFromMetadata(request.metadata) ?? null
      : null,
  });
}

export function notInvoked({
  actionLedgerSummaryCount,
  blockers = [],
  moduleId = null,
  persistedActionCount,
  persistenceStatus,
  persistentStatus,
  phase = null,
  requestId = null,
  requestHashConflict,
  resumePlan,
  status,
  summary,
  unsupportedReason,
  validationReasons = [],
  validationStatus,
  workflowId = null,
  workflowRunId = null,
  workflowStartStatus,
}: {
  actionLedgerSummaryCount?: number;
  blockers?: readonly string[];
  moduleId?: string | null;
  persistedActionCount?: number;
  persistenceStatus?: string | null;
  persistentStatus?: string | null;
  phase?: QueueWorkflowRunnerRuntimePhase | null;
  requestId?: string | null;
  requestHashConflict?: QueueWorkflowRunnerRuntimeResult["requestHashConflict"];
  resumePlan?: QueueWorkflowRunnerRuntimeResult["resumePlan"];
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons?: readonly string[];
  validationStatus?: string;
  workflowId?: string | null;
  workflowRunId?: string | null;
  workflowStartStatus?: QueueWorkflowRunnerRuntimeResult["workflowStartStatus"];
}): QueueWorkflowRunnerRuntimeResult {
  return {
    ...(typeof actionLedgerSummaryCount === "number"
      ? { actionLedgerSummaryCount }
      : {}),
    blockers,
    invoked: false,
    moduleId,
    ...(typeof persistedActionCount === "number" ? { persistedActionCount } : {}),
    ...(persistenceStatus ? { persistenceStatus } : {}),
    ...(persistentStatus ? { persistentStatus } : {}),
    phase,
    phasesExecuted: [],
    ...(requestHashConflict ? { requestHashConflict } : {}),
    requestId,
    ...(resumePlan ? { resumePlan } : {}),
    status,
    summary,
    ...(unsupportedReason ? { unsupportedReason } : {}),
    validationReasons,
    ...(validationStatus ? { validationStatus } : {}),
    workflowId,
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(workflowStartStatus ? { workflowStartStatus } : {}),
  };
}
