import type { MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import type { AgentQueueWorkerConfig } from "../../workspace/types";
import { errorToMessage, type WorkerScope } from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";

type WorkerApiOptions = Pick<
  WidgetRenderProps,
  | "onCreateAgentQueueWorker"
  | "onDeleteAgentQueueWorker"
  | "onListAgentQueueWorkers"
  | "onUpdateAgentQueueWorker"
> & {
  agentExecutorSlots: NonNullable<WidgetRenderProps["agentExecutorSlots"]>;
};

type WorkerActionsContext = WorkerApiOptions & {
  maxExecutors: number;
  setGlobalMessage: Dispatch<SetStateAction<string | null>>;
  setMaxExecutorMessage: Dispatch<SetStateAction<string | null>>;
  setTagManagementError: Dispatch<SetStateAction<string | null>>;
  setWorkerConfigs: Dispatch<SetStateAction<AgentQueueWorkerConfig[]>>;
  setWorkerScopes: Dispatch<SetStateAction<Map<string, WorkerScope>>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
  workerConfigsRef: MutableRefObject<AgentQueueWorkerConfig[]>;
};

export function createAgentQueueWorkerActions({
  agentExecutorSlots,
  maxExecutors,
  onCreateAgentQueueWorker,
  onDeleteAgentQueueWorker,
  onListAgentQueueWorkers,
  onUpdateAgentQueueWorker,
  setGlobalMessage,
  setMaxExecutorMessage,
  setTagManagementError,
  setWorkerConfigs,
  setWorkerScopes,
  tasksRef,
  workerConfigsRef,
}: WorkerActionsContext) {
  async function loadWorkers() {
    if (!onListAgentQueueWorkers) {
      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      workerConfigsRef.current = defaultWorkers;
      setWorkerConfigs(defaultWorkers);
      return;
    }

    try {
      const loadedWorkers = await onListAgentQueueWorkers();
      if (loadedWorkers.length > 0) {
        workerConfigsRef.current = loadedWorkers;
        setWorkerConfigs(loadedWorkers);
        setWorkerScopes(workerScopesFromConfigs(loadedWorkers));
        return;
      }

      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      if (!onCreateAgentQueueWorker) {
        workerConfigsRef.current = defaultWorkers;
        setWorkerConfigs(defaultWorkers);
        setWorkerScopes(workerScopesFromConfigs(defaultWorkers));
        return;
      }

      const createdWorkers: AgentQueueWorkerConfig[] = [];
      for (const worker of defaultWorkers) {
        createdWorkers.push(
          await onCreateAgentQueueWorker({
            displayOrder: worker.displayOrder,
            enabled: worker.enabled,
            name: worker.name,
            queueTagId: worker.queueTagId,
            queueTagName: worker.queueTagName,
            scopeKind: worker.scopeKind,
            workerId: worker.workerId,
          }),
        );
      }
      workerConfigsRef.current = createdWorkers;
      setWorkerConfigs(createdWorkers);
      setWorkerScopes(workerScopesFromConfigs(createdWorkers));
    } catch {
      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      workerConfigsRef.current = defaultWorkers;
      setWorkerConfigs(defaultWorkers);
      setWorkerScopes(workerScopesFromConfigs(defaultWorkers));
    }
  }

  function changeWorkerScope(workerId: string, scope: WorkerScope) {
    setWorkerScopes((current) => new Map(current).set(workerId, scope));
    updateWorkerConfig(workerId, {
      queueTagId: scope.kind === "queue_tag" ? scope.queueTagId : null,
      queueTagName: scope.kind === "queue_tag" ? scope.queueTagName : null,
      scopeKind: scope.kind,
    });
    setGlobalMessage("Worker scope updated. No Queue work was started.");
  }

  function createWorker() {
    if (workerConfigsRef.current.length >= maxExecutors) {
      setMaxExecutorMessage(
        "Max executors reached. Remove a worker or raise the max before adding another.",
      );
      return;
    }

    const displayOrder = nextWorkerDisplayOrder(workerConfigsRef.current);
    const workerConfig = localWorkerConfig({
      displayOrder,
      name: `Agent Worker ${(displayOrder + 1).toString()}`,
    });

    workerConfigsRef.current = [...workerConfigsRef.current, workerConfig];
    setWorkerConfigs((current) => [...current, workerConfig]);
    setWorkerScopes((current) =>
      new Map(current).set(workerConfig.workerId, { kind: "all" }),
    );
    setMaxExecutorMessage("Agent Worker added. No runtime was started.");
    setGlobalMessage("Agent Worker added. No runtime was started.");

    if (onCreateAgentQueueWorker) {
      void onCreateAgentQueueWorker({
        displayOrder: workerConfig.displayOrder,
        enabled: workerConfig.enabled,
        name: workerConfig.name,
        queueTagId: null,
        queueTagName: null,
        scopeKind: "all",
        workerId: workerConfig.workerId,
      })
        .then((createdWorker) => {
          workerConfigsRef.current = workerConfigsRef.current.map((worker) =>
            worker.workerId === workerConfig.workerId ? createdWorker : worker,
          );
          setWorkerConfigs((current) =>
            current.map((worker) =>
              worker.workerId === workerConfig.workerId ? createdWorker : worker,
            ),
          );
        })
        .catch((error) => {
          setTagManagementError(
            errorToMessage(error, "Unable to persist Agent Worker."),
          );
        });
    }
  }

  function renameWorker(workerId: string, name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setTagManagementError("Worker name is required.");
      return;
    }

    updateWorkerConfig(workerId, { name: trimmedName });
    setGlobalMessage("Agent Worker renamed. No runtime was started.");
  }

  function setWorkerEnabled(workerId: string, enabled: boolean) {
    updateWorkerConfig(workerId, { enabled });
    setGlobalMessage(
      enabled
        ? "Agent Worker enabled. No Queue work was started."
        : "Agent Worker disabled. Existing Executor work is unchanged.",
    );
  }

  function deleteWorker(workerId: string) {
    const assignedTask = tasksRef.current.find(
      (task) =>
        task.assignedWorkerId === workerId ||
        task.assignedExecutorWidgetId === workerId,
    );

    if (assignedTask) {
      setTagManagementError(
        "Clear this worker's task assignment before removing it.",
      );
      return;
    }

    workerConfigsRef.current = workerConfigsRef.current.filter(
      (worker) => worker.workerId !== workerId,
    );
    setWorkerConfigs((current) =>
      current.filter((worker) => worker.workerId !== workerId),
    );
    setWorkerScopes((current) => {
      const next = new Map(current);
      next.delete(workerId);
      return next;
    });
    setGlobalMessage("Agent Worker removed. No runtime was stopped or started.");

    if (onDeleteAgentQueueWorker) {
      void onDeleteAgentQueueWorker({ workerId }).catch((error) => {
        setTagManagementError(
          errorToMessage(error, "Unable to delete Agent Worker."),
        );
      });
    }
  }

  function updateWorkerConfig(
    workerId: string,
    patch: Partial<
      Pick<
        AgentQueueWorkerConfig,
        "enabled" | "name" | "queueTagId" | "queueTagName" | "scopeKind"
      >
    >,
  ) {
    const existingWorker = workerConfigsRef.current.find(
      (worker) => worker.workerId === workerId,
    );

    if (!existingWorker) {
      return;
    }

    const updatedWorker: AgentQueueWorkerConfig = {
      ...existingWorker,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    workerConfigsRef.current = workerConfigsRef.current.map((worker) =>
      worker.workerId === workerId ? updatedWorker : worker,
    );

    setWorkerConfigs((current) =>
      current.map((worker) =>
        worker.workerId === workerId ? updatedWorker : worker,
      ),
    );
    setTagManagementError(null);

    if (onUpdateAgentQueueWorker) {
      void onUpdateAgentQueueWorker({
        displayOrder: updatedWorker.displayOrder,
        enabled: updatedWorker.enabled,
        name: updatedWorker.name,
        queueTagId: updatedWorker.queueTagId,
        queueTagName: updatedWorker.queueTagName,
        scopeKind: updatedWorker.scopeKind,
        workerId: updatedWorker.workerId,
      }).catch((error) => {
        setTagManagementError(
          errorToMessage(error, "Unable to persist Agent Worker."),
        );
      });
    }
  }

  async function persistWorkerScopeUpdates(
    update: (worker: AgentQueueWorkerConfig) => AgentQueueWorkerConfig,
  ) {
    const updatedWorkers = workerConfigsRef.current.map(update);
    workerConfigsRef.current = updatedWorkers;
    setWorkerConfigs(updatedWorkers);
    setWorkerScopes(workerScopesFromConfigs(updatedWorkers));

    if (!onUpdateAgentQueueWorker) {
      return;
    }

    for (const worker of updatedWorkers) {
      const previousWorker = workerConfigsRef.current.find(
        (candidate) => candidate.workerId === worker.workerId,
      );
      if (
        previousWorker?.scopeKind === worker.scopeKind &&
        previousWorker?.queueTagId === worker.queueTagId &&
        previousWorker?.queueTagName === worker.queueTagName
      ) {
        continue;
      }

      await onUpdateAgentQueueWorker({
        displayOrder: worker.displayOrder,
        enabled: worker.enabled,
        name: worker.name,
        queueTagId: worker.queueTagId,
        queueTagName: worker.queueTagName,
        scopeKind: worker.scopeKind,
        workerId: worker.workerId,
      });
    }
  }

  return {
    changeWorkerScope,
    createWorker,
    deleteWorker,
    loadWorkers,
    persistWorkerScopeUpdates,
    renameWorker,
    setWorkerEnabled,
  };
}

export function defaultWorkerConfigsFromExecutorSlots(
  agentExecutorSlots: Array<{ label: string; widgetInstanceId: string }>,
): AgentQueueWorkerConfig[] {
  const now = new Date().toISOString();

  if (agentExecutorSlots.length === 0) {
    return [
      {
        createdAt: now,
        displayOrder: 0,
        enabled: true,
        name: "Agent Worker 1",
        queueTagId: null,
        queueTagName: null,
        scopeKind: "all",
        updatedAt: now,
        workerId: `agent-worker-${Date.now().toString(36)}`,
        workspaceId: "",
      },
    ];
  }

  return agentExecutorSlots.map((slot, index) => ({
    createdAt: now,
    displayOrder: index,
    enabled: true,
    name: slot.label,
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: now,
    workerId: slot.widgetInstanceId,
    workspaceId: "",
  }));
}

export function workerScopesFromConfigs(workerConfigs: AgentQueueWorkerConfig[]) {
  return new Map(
    workerConfigs.map((worker): [string, WorkerScope] => [
      worker.workerId,
      worker.scopeKind === "queue_tag" && worker.queueTagId && worker.queueTagName
        ? {
            kind: "queue_tag",
            queueTagId: worker.queueTagId,
            queueTagName: worker.queueTagName,
          }
        : { kind: "all" },
    ]),
  );
}

export function nextWorkerDisplayOrder(workerConfigs: AgentQueueWorkerConfig[]) {
  if (workerConfigs.length === 0) {
    return 0;
  }

  return (
    Math.max(
      ...workerConfigs.map((worker) =>
        Number.isFinite(worker.displayOrder) ? worker.displayOrder : 0,
      ),
    ) + 1
  );
}

export function localWorkerConfig({
  displayOrder,
  name,
}: {
  displayOrder: number;
  name: string;
}): AgentQueueWorkerConfig {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    displayOrder,
    enabled: true,
    name,
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: now,
    workerId: `agent-worker-${Date.now().toString(36)}-${displayOrder.toString()}`,
    workspaceId: "",
  };
}
