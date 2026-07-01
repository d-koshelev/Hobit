import { dispatchQueueWorkflowBackendStep } from "../queueWorkflowBackendStepDispatcher";
import type {
  PreparedQueueWorkflowRuntime,
  QueueWorkflowRunnerRuntimeResult,
} from "./queueWorkflowRuntimeAdapterTypes";
import type { BackendOwnedQueueWorkflowPhase } from "../queueWorkflowBackendStepDispatcher";

export function dispatchPreparedBackendStep({
  actorId,
  prepared,
  validationReasons,
  validationStatus,
}: {
  actorId: string;
  prepared: PreparedQueueWorkflowRuntime & {
    selectedPhase: BackendOwnedQueueWorkflowPhase;
  };
  validationReasons: readonly string[];
  validationStatus?: string;
}): Promise<QueueWorkflowRunnerRuntimeResult> {
  return dispatchQueueWorkflowBackendStep({
    actorId,
    persistenceStatus: prepared.persistenceStatus,
    persistentStatus: prepared.persistentStatus,
    phase: prepared.selectedPhase,
    request: prepared.runnerRequest,
    resumePlan: prepared.resumePlan,
    validationReasons,
    validationStatus,
    workflowPersistence: prepared.workflowPersistence,
    workflowRunId: prepared.workflowRunId,
    workspaceId: prepared.workspaceId,
    workflowStartStatus: prepared.workflowStartStatus,
  });
}
