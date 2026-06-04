import type { AgentQueueWorkerConfig } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const fallbackAgentQueueWorkers = new Map<string, AgentQueueWorkerConfig[]>();
let fallbackWorkerId = 1;

export async function listMemoryAgentQueueWorkers(
  request: Parameters<WorkspaceApi["listAgentQueueWorkers"]>[0],
): ReturnType<WorkspaceApi["listAgentQueueWorkers"]> {
  return (fallbackAgentQueueWorkers.get(request.workspaceId) ?? [])
    .slice()
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map(cloneAgentQueueWorker);
}

export async function createMemoryAgentQueueWorker(
  request: Parameters<WorkspaceApi["createAgentQueueWorker"]>[0],
): ReturnType<WorkspaceApi["createAgentQueueWorker"]> {
  const now = new Date().toISOString();
  const worker: AgentQueueWorkerConfig = {
    workerId: request.workerId?.trim() || `fallback_worker_${fallbackWorkerId++}`,
    workspaceId: request.workspaceId,
    name: requiredValue(request.name, "worker name"),
    enabled: request.enabled,
    scopeKind: request.scopeKind === "queue_tag" ? "queue_tag" : "all",
    queueTagId: request.scopeKind === "queue_tag" ? request.queueTagId ?? null : null,
    queueTagName:
      request.scopeKind === "queue_tag" ? request.queueTagName ?? null : null,
    displayOrder: request.displayOrder,
    createdAt: now,
    updatedAt: now,
  };
  const workers = fallbackAgentQueueWorkers.get(request.workspaceId) ?? [];
  fallbackAgentQueueWorkers.set(request.workspaceId, [
    ...workers.filter((candidate) => candidate.workerId !== worker.workerId),
    worker,
  ]);

  return cloneAgentQueueWorker(worker);
}

export async function updateMemoryAgentQueueWorker(
  request: Parameters<WorkspaceApi["updateAgentQueueWorker"]>[0],
): ReturnType<WorkspaceApi["updateAgentQueueWorker"]> {
  const workers = fallbackAgentQueueWorkers.get(request.workspaceId) ?? [];
  const existing = workers.find((worker) => worker.workerId === request.workerId);

  if (!existing) {
    return null;
  }

  const updated: AgentQueueWorkerConfig = {
    ...existing,
    name: requiredValue(request.name, "worker name"),
    enabled: request.enabled,
    scopeKind: request.scopeKind === "queue_tag" ? "queue_tag" : "all",
    queueTagId: request.scopeKind === "queue_tag" ? request.queueTagId ?? null : null,
    queueTagName:
      request.scopeKind === "queue_tag" ? request.queueTagName ?? null : null,
    displayOrder: request.displayOrder,
    updatedAt: new Date().toISOString(),
  };
  fallbackAgentQueueWorkers.set(
    request.workspaceId,
    workers.map((worker) => (worker.workerId === request.workerId ? updated : worker)),
  );

  return cloneAgentQueueWorker(updated);
}

export async function deleteMemoryAgentQueueWorker(
  request: Parameters<WorkspaceApi["deleteAgentQueueWorker"]>[0],
): ReturnType<WorkspaceApi["deleteAgentQueueWorker"]> {
  const workers = fallbackAgentQueueWorkers.get(request.workspaceId) ?? [];
  const nextWorkers = workers.filter(
    (worker) => worker.workerId !== request.workerId,
  );
  fallbackAgentQueueWorkers.set(request.workspaceId, nextWorkers);
  return nextWorkers.length !== workers.length;
}

function requiredValue(value: string, label: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error(`${label} must not be empty`);
  }
  return trimmedValue;
}

function cloneAgentQueueWorker(worker: AgentQueueWorkerConfig): AgentQueueWorkerConfig {
  return { ...worker };
}
