import { EMPTY_DOWNSTREAM_VERIFICATION } from "./queueWorkflowRunnerConstants";
import { pushStep } from "./queueWorkflowRunnerEvents";
import { stripUndefined } from "./queueWorkflowRunnerRefs";
import { snapshotString, type QueueWorkflowFinalizationAction } from "./queueWorkflowFinalizationHelpers";
import type {
  QueueWorkflowDownstreamVerificationReport,
  QueueWorkflowReadPort,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerStep,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

export async function verifyDownstreamAfterFinalization({
  action,
  downstreamTaskId,
  events,
  readPort,
  steps,
  variables,
}: {
  action: QueueWorkflowFinalizationAction;
  downstreamTaskId?: string;
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowDownstreamVerificationReport> {
  if (!downstreamTaskId) {
    return {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      missingReason: "missing_downstream_task_id",
      verificationMissing: true,
    };
  }

  const aggregate = await readPort.getQueueItemAggregate(downstreamTaskId);
  variables.readSnapshots.aggregatesByTaskId[downstreamTaskId] = aggregate;
  pushStep(steps, events, {
    message: aggregate
      ? `Read downstream Queue aggregate for ${downstreamTaskId}.`
      : `Downstream Queue aggregate not found for ${downstreamTaskId}.`,
    phase: "verification",
    reasonCode: aggregate ? undefined : "aggregate_not_found",
    status: aggregate ? "completed" : "blocked",
    stepId: `verify_downstream_aggregate:${downstreamTaskId}`,
    taskId: downstreamTaskId,
  });

  const lifecycle = readPort.getLifecycle
    ? await readPort.getLifecycle(downstreamTaskId)
    : aggregate;
  variables.readSnapshots.lifecycleByTaskId[downstreamTaskId] = lifecycle;
  pushStep(steps, events, {
    message: lifecycle
      ? `Read downstream Queue lifecycle for ${downstreamTaskId}.`
      : `Downstream Queue lifecycle not found for ${downstreamTaskId}.`,
    phase: "verification",
    reasonCode: lifecycle ? undefined : "aggregate_not_found",
    status: lifecycle ? "completed" : "blocked",
    stepId: `verify_downstream_lifecycle:${downstreamTaskId}`,
    taskId: downstreamTaskId,
  });

  const snapshot = lifecycle ?? aggregate;
  if (!snapshot) {
    return {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      missingReason: "snapshot_unavailable",
      taskId: downstreamTaskId,
      verificationMissing: true,
    };
  }

  const dependencyState = snapshotString(snapshot, "dependencyState");
  const workerRunState = snapshotString(snapshot, "workerRunState");
  const expectedDependencyState =
    action === "mark_done" ? "ready" : "failed_upstream";
  const dependencyVerified = dependencyState
    ? action === "mark_done"
      ? dependencyState === "ready" || dependencyState === "none"
      : dependencyState === "failed_upstream"
    : null;
  const notAutoStartedVerified = workerRunState
    ? workerRunState === "not_started"
    : null;

  return stripUndefined({
    dependencyState,
    dependencyVerified,
    expectedDependencyState,
    notAutoStartedVerified,
    snapshot,
    taskId: downstreamTaskId,
    verificationMissing: false,
    workerRunState,
  });
}
