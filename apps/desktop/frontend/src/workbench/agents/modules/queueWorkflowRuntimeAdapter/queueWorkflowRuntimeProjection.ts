import type {
  AgentQueueWorkflowJsonValue,
  RecordAgentQueueWorkflowRunnerReportAction,
  RecordAgentQueueWorkflowRunnerReportRequest,
} from "../../../../workspace/types";
import type {
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapterTypes";
import {
  currentStepForRunnerResult,
  pauseReasonForRunnerResult,
  persistedRunStatusFromRunner,
  phasesExecuted,
  runtimeStatusFromRunner,
} from "./queueWorkflowRuntimeActivity";
import {
  sanitizeJsonValue,
  stripNullish,
  stripUndefined,
  workflowPhaseForRuntimePhase,
} from "./queueWorkflowRuntimeGuards";
import type {
  QueueWorkflowRunnerResult,
} from "../queueWorkflowRunner";

export function recordRequestForRunnerResult({
  phase,
  runnerResult,
  workflowRunId,
  workspaceId,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  runnerResult: QueueWorkflowRunnerResult;
  workflowRunId: string;
  workspaceId: string;
}): RecordAgentQueueWorkflowRunnerReportRequest {
  const runtimeStatus = runtimeStatusFromRunner(runnerResult.status);
  const actions = actionSummariesForRunnerResult({
    phase,
    runnerResult,
    workflowRunId,
  });
  const blockers = runnerResult.blockers.map((blocker) => ({
    fieldPath: blocker.fieldPath,
    message: blocker.message,
    reasonCode: blocker.reasonCode,
    slot: blocker.slot,
    taskId: blocker.taskId,
  }));
  const persistedStatus = persistedRunStatusFromRunner(runtimeStatus);

  return {
    actionLogSummary: sanitizeJsonValue({
      actionCount: actions.length,
      blockers,
      refs: workflowReportRefs(runnerResult),
      phasesExecuted: phasesExecuted(runnerResult, phase),
      runnerStatus: runnerResult.status,
      summary: runnerResult.report.summary,
    }),
    actions,
    blockerReason: blockers.length > 0 ? blockers[0]?.message : null,
    currentStep: currentStepForRunnerResult(phase, runtimeStatus),
    idempotencyKeys: actions.map((action) => action.idempotencyKey),
    mutationRefs: mutationRefsForRunnerResult(runnerResult),
    pauseReason:
      persistedStatus === "paused"
        ? pauseReasonForRunnerResult(phase, runnerResult)
        : null,
    phase: workflowPhaseForRuntimePhase(phase),
    slotBindings: null,
    status: persistedStatus,
    variables: sanitizeJsonValue({
      evidenceBundleIdsBySlot: runnerResult.variables.evidenceBundleIdsBySlot,
      messageIdsBySlot: runnerResult.variables.messageIdsBySlot,
      requestId: runnerResult.variables.requestId,
      runIdsBySlot: runnerResult.variables.runIdsBySlot,
      scopedEvidenceBundleIds: runnerResult.variables.scopedEvidenceBundleIds,
      scopedMessageIds: runnerResult.variables.scopedMessageIds,
      scopedRunIds: runnerResult.variables.scopedRunIds,
      scopedTaskIds: runnerResult.variables.scopedTaskIds,
      slots: runnerResult.variables.slots,
      taskIdsBySlot: runnerResult.variables.taskIdsBySlot,
      workflowId: runnerResult.variables.workflowId,
    }),
    workflowRunId,
    workspaceId,
  };
}

function workflowReportRefs(
  runnerResult: QueueWorkflowRunnerResult,
): AgentQueueWorkflowJsonValue {
  return sanitizeJsonValue(
    stripUndefined({
      downstreamTaskId:
        runnerResult.report.createSetupStart.downstreamTaskId ??
        runnerResult.variables.taskIdsBySlot.downstream,
      evidenceBundleId:
        runnerResult.report.workerEvidence.evidenceBundleId ??
        runnerResult.variables.evidenceBundleIdsBySlot.upstream,
      messageId:
        runnerResult.report.review.messageId ??
        runnerResult.variables.messageIdsBySlot.upstream,
      runId:
        runnerResult.report.createSetupStart.start?.runId ??
        runnerResult.report.workerEvidence.runId ??
        runnerResult.variables.runIdsBySlot.upstream,
      upstreamTaskId:
        runnerResult.report.createSetupStart.upstreamTaskId ??
        runnerResult.variables.taskIdsBySlot.upstream,
    }),
  );
}

function actionSummariesForRunnerResult({
  phase,
  runnerResult,
  workflowRunId,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  runnerResult: QueueWorkflowRunnerResult;
  workflowRunId: string;
}): RecordAgentQueueWorkflowRunnerReportAction[] {
  const actions: RecordAgentQueueWorkflowRunnerReportAction[] = [];

  for (const taskId of runnerResult.report.taskReads) {
    actions.push({
      actionType: "queue.lifecycle.get",
      idempotencyKey: `${workflowRunId}:queue.lifecycle.get:task:${taskId}`,
      resultRefs: { status: "read" },
      status: "completed",
      stepId: `read.aggregate:${taskId}`,
      targetRefs: { taskId },
    });
  }

  for (const evidenceRead of runnerResult.report.evidenceReads) {
    const keyParts = [
      workflowRunId,
      "queue.evidence.lookup",
      evidenceRead.taskId,
      evidenceRead.runId ?? "no-run",
      evidenceRead.evidenceBundleId ?? "latest",
    ];
    actions.push({
      actionType: "queue.evidence.lookup",
      idempotencyKey: keyParts.join(":"),
      resultRefs: {
        evidenceBundleId: evidenceRead.evidenceBundleId ?? null,
        runId: evidenceRead.runId ?? null,
        status: "read",
      },
      status: "completed",
      stepId: `read.evidence:${evidenceRead.taskId}`,
      targetRefs: stripNullish({
        evidenceBundleId: evidenceRead.evidenceBundleId,
        runId: evidenceRead.runId,
        taskId: evidenceRead.taskId,
      }),
    });
  }

  if (runnerResult.status.includes("failed_unexpected") && actions.length === 0) {
    actions.push({
      actionType: "queue.workflow.runner",
      blockerCode: runnerResult.blockers[0]?.reasonCode,
      blockerMessage: runnerResult.blockers[0]?.message,
      idempotencyKey: `${workflowRunId}:queue.workflow.runner:${phase}:${runnerResult.requestId}`,
      resultRefs: {
        runnerStatus: runnerResult.status,
        summary: runnerResult.report.summary,
      },
      status: "failed",
      stepId: `runner.${phase}`,
      targetRefs: {
        phase,
        requestId: runnerResult.requestId,
        workflowId: runnerResult.workflowId,
      },
    });
  }

  return actions;
}

function mutationRefsForRunnerResult(
  runnerResult: QueueWorkflowRunnerResult,
): AgentQueueWorkflowJsonValue {
  const createSetupStart = runnerResult.report.createSetupStart;
  const workerEvidence = runnerResult.report.workerEvidence;
  const review = runnerResult.report.review;
  return sanitizeJsonValue(
    stripUndefined({
      createSetupStartStatus: createSetupStart.status,
      downstreamTaskId: createSetupStart.downstreamTaskId,
      evidenceBundleId: workerEvidence.evidenceBundleId,
      recordWorkerEvidenceStatus: workerEvidence.commandStatus,
      executionTargetHash: createSetupStart.runSettings?.executionTargetHash,
      executionTargetKind: createSetupStart.runSettings?.executionTargetKind,
      settingsHash: createSetupStart.runSettings?.settingsHash,
      startedRunId: createSetupStart.start?.runId,
      upstreamTaskId: createSetupStart.upstreamTaskId,
      workerEvidenceRunId: workerEvidence.runId,
      workerEvidenceTaskId: workerEvidence.taskId,
      reviewAckStatus: review.ackStatus,
      reviewCreateStatus: review.createStatus,
      reviewMessageId: review.messageId,
      reviewTaskId: review.taskId,
    }),
  );
}
