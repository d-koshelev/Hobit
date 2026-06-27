import { isBackendOwnedQueueWorkflowPhase } from "../queueWorkflowBackendStepDispatcher";
import {
  DEFAULT_ACTOR_ID,
} from "./queueWorkflowRuntimeGuards";
import { dispatchPreparedBackendStep } from "./queueWorkflowRuntimeBackendSteps";
import {
  blockersFromRecordResult,
  runtimeStatusFromRunner,
} from "./queueWorkflowRuntimeActivity";
import {
  notInvoked,
  unexpectedRuntimeFailureResult,
} from "./queueWorkflowRuntimeErrors";
import { prepareQueueWorkflowRuntimeExecution } from "./queueWorkflowRuntimePersistence";
import { recordRequestForRunnerResult } from "./queueWorkflowRuntimeProjection";
import { normalizeQueueWorkflowRuntimeRequest } from "./queueWorkflowRuntimeRequest";
import {
  createQueueWorkflowRunnerRuntimePortsFromQueueBridge,
  runSelectedReadOnlyRunner,
} from "./queueWorkflowRuntimeReadOnly";
import type {
  QueueWorkflowRunnerRuntimeAdapterInput,
  QueueWorkflowRunnerRuntimeResult,
} from "./queueWorkflowRuntimeAdapterTypes";

export type {
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimeAdapterInput,
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimePorts,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapterTypes";

export { createQueueWorkflowRunnerRuntimePortsFromQueueBridge };

export async function runQueueWorkflowRunnerRuntimeAdapter(
  input: QueueWorkflowRunnerRuntimeAdapterInput,
): Promise<QueueWorkflowRunnerRuntimeResult> {
  try {
    return await runQueueWorkflowRunnerRuntimeAdapterUnsafe(input);
  } catch {
    return unexpectedRuntimeFailureResult(input);
  }
}

async function runQueueWorkflowRunnerRuntimeAdapterUnsafe({
  actorId,
  ports,
  queueBridge,
  workflowPersistence,
  workflowRequestRead,
  workspaceId,
}: QueueWorkflowRunnerRuntimeAdapterInput): Promise<QueueWorkflowRunnerRuntimeResult> {
  const normalized = normalizeQueueWorkflowRuntimeRequest(workflowRequestRead);
  if (!normalized.ok) return normalized.result;

  const actor = actorId?.trim() || DEFAULT_ACTOR_ID;
  const prepared = await prepareQueueWorkflowRuntimeExecution({
    actorId: actor,
    phase: normalized.value.phase,
    request: normalized.value.request,
    typedWorkflowRunId: normalized.value.typedWorkflowRunId,
    validationReasons: normalized.value.validationReasons,
    validationStatus: normalized.value.validationStatus,
    workflowPersistence,
    workspaceId,
  });
  if (!prepared.ok) return prepared.result;

  if (isBackendOwnedQueueWorkflowPhase(prepared.value.selectedPhase)) {
    return dispatchPreparedBackendStep({
      actorId: actor,
      prepared: {
        ...prepared.value,
        selectedPhase: prepared.value.selectedPhase,
      },
      validationReasons: normalized.value.validationReasons,
      validationStatus: normalized.value.validationStatus,
    });
  }

  const runtimePorts =
    ports ??
    createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
      actorId: actor,
      queueBridge,
    });
  const runnerResult = await runSelectedReadOnlyRunner({
    phase: prepared.value.selectedPhase,
    ports: runtimePorts,
    request: prepared.value.runnerRequest,
    validation: normalized.value.validation,
  });
  const workflowRunId = prepared.value.workflowRunId;
  if (!workflowRunId) {
    return notInvoked({
      blockers: ["Queue workflow run id is unavailable for report recording."],
      moduleId: prepared.value.runnerRequest.moduleId,
      persistenceStatus: prepared.value.persistenceStatus,
      persistentStatus: prepared.value.persistentStatus,
      phase: prepared.value.selectedPhase,
      requestId: prepared.value.runnerRequest.requestId,
      resumePlan: prepared.value.resumePlan,
      status: "blocked",
      summary:
        "Queue workflow report persistence requires a workflowRunId; read-only result was not recorded.",
      validationReasons: normalized.value.validationReasons,
      validationStatus: normalized.value.validationStatus,
      workflowId: prepared.value.runnerRequest.workflowId,
      workflowStartStatus: prepared.value.workflowStartStatus,
    });
  }

  const recordRequest = recordRequestForRunnerResult({
    phase: prepared.value.selectedPhase,
    runnerResult,
    workflowRunId,
    workspaceId: prepared.value.workspaceId,
  });
  const recordResult =
    await prepared.value.workflowPersistence.recordAgentQueueWorkflowRunnerReport(
      recordRequest,
    );
  const recordBlockers = blockersFromRecordResult(recordResult);
  const runtimeStatus = runtimeStatusFromRunner(runnerResult.status);
  const finalStatus =
    recordResult.status === "recorded" ? runtimeStatus : "blocked";
  const persistentRecordedStatus =
    recordResult.workflowRun?.status ?? prepared.value.persistentStatus;

  return {
    actionLedgerSummaryCount: Math.max(
      recordRequest.actions.length,
      recordResult.actions.length,
    ),
    blockers: [
      ...runnerResult.blockers.map((blocker) => blocker.message),
      ...recordBlockers,
    ],
    invoked: true,
    moduleId: prepared.value.runnerRequest.moduleId,
    persistedActionCount: recordResult.actions.length,
    persistenceStatus:
      recordResult.status === "recorded"
        ? prepared.value.persistenceStatus
        : recordResult.status,
    persistentStatus: persistentRecordedStatus,
    phase: prepared.value.selectedPhase,
    phasesExecuted: [
      prepared.value.selectedPhase,
      ...runnerResult.steps
        .map((step) => step.phase)
        .filter((phase): phase is NonNullable<typeof phase> => phase !== undefined),
    ].filter((phase, index, phases) => phases.indexOf(phase) === index),
    recordResult,
    requestId: prepared.value.runnerRequest.requestId,
    resumePlan: prepared.value.resumePlan,
    runnerResult,
    status: finalStatus,
    summary:
      recordResult.status === "recorded"
        ? runnerResult.report.summary
        : `Queue workflow runner completed, but workflow report persistence returned ${recordResult.status}.`,
    validationReasons: normalized.value.validationReasons,
    validationStatus: normalized.value.validationStatus,
    workflowId: prepared.value.runnerRequest.workflowId,
    workflowRunId,
    workflowStartStatus: prepared.value.workflowStartStatus,
  };
}
