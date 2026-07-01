import type { WorkspaceAgentQueueBridge } from "../../../workspaceAgentQueueBridge";
import { isLegacyFrontendQueueWorkflowPhase } from "../queueWorkflowBackendStepDispatcher";
import {
  runQueueWorkflowReadOnlyRunner,
  type QueueWorkflowReadPort,
  type QueueWorkflowRunnerRequest,
} from "../queueWorkflowRunner";
import type {
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimePorts,
} from "./queueWorkflowRuntimeAdapterTypes";

export function createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
  queueBridge,
}: {
  actorId: string;
  queueBridge?: WorkspaceAgentQueueBridge | null;
}): QueueWorkflowRunnerRuntimePorts {
  return {
    readPort: queueBridge ? createReadPort(queueBridge) : null,
  };
}

export async function runSelectedReadOnlyRunner({
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
  if (!isLegacyFrontendQueueWorkflowPhase(phase)) {
    throw new Error(
      `Backend-owned Queue workflow phase ${phase} must use the backend step dispatcher.`,
    );
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
