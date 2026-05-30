import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  AgentQueueItem,
  AgentQueueRunnerSnapshot,
  AgentQueueSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueItemFromProposalRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskLatestRunLinkRequest,
  GetAgentQueueTaskRequest,
  ListAgentQueueTaskRunLinksRequest,
  ListAgentQueueTasksRequest,
  ListAgentQueueWorkersRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
} from "./types";

export function createAgentQueueItemFromProposal(
  request: CreateAgentQueueItemFromProposalRequest,
): Promise<AgentQueueItem | null> {
  return getWorkspaceApi().createAgentQueueItemFromProposal(request);
}

export function getAgentQueueSnapshot(
  request: GetAgentQueueSnapshotRequest,
): Promise<AgentQueueSnapshot | null> {
  return getWorkspaceApi().getAgentQueueSnapshot(request);
}

export function createAgentQueueTask(
  request: CreateAgentQueueTaskRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().createAgentQueueTask(request);
}

export function listAgentQueueTasks(
  request: ListAgentQueueTasksRequest,
): Promise<AgentQueueTask[]> {
  return getWorkspaceApi().listAgentQueueTasks(request);
}

export function getAgentQueueTask(
  request: GetAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  return getWorkspaceApi().getAgentQueueTask(request);
}

export function updateAgentQueueTask(
  request: UpdateAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  return getWorkspaceApi().updateAgentQueueTask(request);
}

export function deleteAgentQueueTask(
  request: DeleteAgentQueueTaskRequest,
): Promise<boolean> {
  return getWorkspaceApi().deleteAgentQueueTask(request);
}

export function listAgentQueueWorkers(
  request: ListAgentQueueWorkersRequest,
): Promise<AgentQueueWorkerConfig[]> {
  return getWorkspaceApi().listAgentQueueWorkers(request);
}

export function createAgentQueueWorker(
  request: CreateAgentQueueWorkerRequest,
): Promise<AgentQueueWorkerConfig> {
  return getWorkspaceApi().createAgentQueueWorker(request);
}

export function updateAgentQueueWorker(
  request: UpdateAgentQueueWorkerRequest,
): Promise<AgentQueueWorkerConfig | null> {
  return getWorkspaceApi().updateAgentQueueWorker(request);
}

export function deleteAgentQueueWorker(
  request: DeleteAgentQueueWorkerRequest,
): Promise<boolean> {
  return getWorkspaceApi().deleteAgentQueueWorker(request);
}

export function assignAgentQueueTaskToExecutor(
  request: AssignAgentQueueTaskToExecutorRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().assignAgentQueueTaskToExecutor(request);
}

export function clearAgentQueueTaskAssignment(
  request: ClearAgentQueueTaskAssignmentRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().clearAgentQueueTaskAssignment(request);
}

export function startAssignedAgentQueueTask(
  request: StartAssignedAgentQueueTaskRequest,
): Promise<StartAssignedAgentQueueTaskResponse> {
  return getWorkspaceApi().startAssignedAgentQueueTask(request);
}

export function getAgentQueueTaskLatestRunLink(
  request: GetAgentQueueTaskLatestRunLinkRequest,
): Promise<AgentQueueTaskRunLinkSummary | null> {
  return getWorkspaceApi().getAgentQueueTaskLatestRunLink(request);
}

export function listAgentQueueTaskRunLinks(
  request: ListAgentQueueTaskRunLinksRequest,
): Promise<AgentQueueTaskRunLinkSummary[]> {
  return getWorkspaceApi().listAgentQueueTaskRunLinks(request);
}

export function startAgentQueueRunnerSession(
  request: StartAgentQueueRunnerSessionRequest,
): Promise<AgentQueueRunnerSnapshot> {
  return getWorkspaceApi().startAgentQueueRunnerSession(request);
}

export function stopAgentQueueRunnerSession(): Promise<AgentQueueRunnerSnapshot> {
  return getWorkspaceApi().stopAgentQueueRunnerSession();
}

export function getAgentQueueRunnerSnapshot(): Promise<AgentQueueRunnerSnapshot> {
  return getWorkspaceApi().getAgentQueueRunnerSnapshot();
}
