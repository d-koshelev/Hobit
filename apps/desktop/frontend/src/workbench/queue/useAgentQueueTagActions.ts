import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask, AgentQueueWorkerConfig } from "../../workspace/types";
import {
  DEFAULT_QUEUE_TAG_ID,
  errorToMessage,
  normalizeItemType,
  normalizeQueueTag,
  normalizeQueueTagName,
  normalizeTaskDependencies,
  normalizeTaskExecutionPolicy,
  normalizeValidationStatus,
  queueTagNameToId,
  type QueueTagPauseState,
  type TaskDraft,
  type WorkerScope,
  validateQueueTagName,
} from "../agentQueueTaskUiModel";
import type { QueueTagRecord, QueueTagSummary } from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";

type QueueTagActionsContext = Pick<WidgetRenderProps, "onUpdateAgentQueueTask"> & {
  persistWorkerScopeUpdates: (
    update: (worker: AgentQueueWorkerConfig) => AgentQueueWorkerConfig,
  ) => Promise<void>;
  queueTags: QueueTagSummary[];
  selectedTask: AgentQueueTask | null;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  setGlobalMessage: Dispatch<SetStateAction<string | null>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<
      Map<
        string,
        Pick<
          AgentQueueTask,
          | "assignedWorkerId"
          | "coordinatorStatus"
          | "dependsOn"
          | "itemType"
          | "orderIndex"
          | "queueTagId"
          | "queueTagName"
          | "validationStatus"
          | "executionPlanPreview"
          | "workerExecutionReports"
        >
      >
    >
  >;
  setManagedQueueTags: Dispatch<SetStateAction<QueueTagRecord[]>>;
  setQueueTagPauseStates: Dispatch<
    SetStateAction<Map<string, QueueTagPauseState>>
  >;
  setSelectedTask: Dispatch<SetStateAction<AgentQueueTask | null>>;
  setTagManagementError: Dispatch<SetStateAction<string | null>>;
  setTagManagementMessage: Dispatch<SetStateAction<string | null>>;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setWorkerScopes: Dispatch<SetStateAction<Map<string, WorkerScope>>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

export function createAgentQueueTagActions({
  onUpdateAgentQueueTask,
  persistWorkerScopeUpdates,
  queueTags,
  selectedTask,
  setDraft,
  setGlobalMessage,
  setLocalTaskFields,
  setManagedQueueTags,
  setQueueTagPauseStates,
  setSelectedTask,
  setTagManagementError,
  setTagManagementMessage,
  setTasks,
  setWorkerScopes,
  tasksRef,
}: QueueTagActionsContext) {
  function createQueueTag(queueTagName: string) {
    const existingTags = queueTags.map(queueTagSummaryToRecord);
    const validationError = validateQueueTagName(queueTagName, existingTags);

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (validationError) {
      setTagManagementError(validationError);
      return false;
    }

    const normalizedName = normalizeQueueTagName(queueTagName);
    const queueTagId = queueTagNameToId(normalizedName);

    setManagedQueueTags((current) =>
      upsertQueueTagRecord(current, {
        queueTagId,
        queueTagName: normalizedName,
      }),
    );
    setTagManagementMessage(`Queue tag "${normalizedName}" created.`);
    setGlobalMessage(
      "Queue tag created. It has no items and does not start workers.",
    );
    return true;
  }

  async function renameQueueTag(queueTagId: string, queueTagName: string) {
    const existingTags = queueTags.map(queueTagSummaryToRecord);
    const tag = existingTags.find((candidate) => candidate.queueTagId === queueTagId);
    const validationError = tag
      ? validateQueueTagName(queueTagName, existingTags, {
          allowQueueTagId: queueTagId,
        })
      : "Queue tag could not be found.";

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (validationError) {
      setTagManagementError(validationError);
      return false;
    }

    if (!tag) {
      setTagManagementError("Queue tag could not be found.");
      return false;
    }

    const normalizedName = normalizeQueueTagName(queueTagName);
    const affectedTasks = tasksRef.current.filter(
      (task) => normalizeQueueTag(task).queueTagId === queueTagId,
    );

    try {
      for (const task of affectedTasks) {
        if (!onUpdateAgentQueueTask) {
          throw new Error("Queue task update is not available in this runtime.");
        }

        const updatedTask = await onUpdateAgentQueueTask({
          queueItemId: task.queueItemId,
          title: task.title,
          description: task.description,
          prompt: task.prompt,
          status: task.status,
          priority: task.priority,
          executionPolicy: normalizeTaskExecutionPolicy(task.executionPolicy),
          itemType: normalizeItemType(task.itemType),
          queueTagId,
          queueTagName: normalizedName,
          validationStatus: normalizeValidationStatus(task.validationStatus),
        });

        if (!updatedTask) {
          throw new Error("A queue task using this tag could not be found.");
        }
      }
    } catch (error) {
      setTagManagementError(errorToMessage(error, "Unable to rename queue tag."));
      return false;
    }

    setManagedQueueTags((current) =>
      upsertQueueTagRecord(current, {
        queueTagId,
        queueTagName: normalizedName,
      }),
    );
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of affectedTasks) {
        next.set(task.queueItemId, {
          ...(next.get(task.queueItemId) ?? {}),
          queueTagId,
          queueTagName: normalizedName,
        });
      }
      return next;
    });
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) =>
        normalizeQueueTag(task).queueTagId === queueTagId
          ? { ...task, queueTagId, queueTagName: normalizedName }
          : task,
      );
      tasksRef.current = nextTasks;
      return nextTasks;
    });
    setSelectedTask((currentTask) =>
      currentTask && normalizeQueueTag(currentTask).queueTagId === queueTagId
        ? { ...currentTask, queueTagId, queueTagName: normalizedName }
        : currentTask,
    );
    setDraft((currentDraft) =>
      selectedTask && normalizeQueueTag(selectedTask).queueTagId === queueTagId
        ? { ...currentDraft, queueTagName: normalizedName }
        : currentDraft,
    );
    setWorkerScopes((current) => {
      const next = new Map(current);
      for (const [workerId, scope] of next.entries()) {
        if (scope.kind === "queue_tag" && scope.queueTagId === queueTagId) {
          next.set(workerId, {
            kind: "queue_tag",
            queueTagId,
            queueTagName: normalizedName,
          });
        }
      }
      return next;
    });
    void persistWorkerScopeUpdates((worker) =>
      worker.scopeKind === "queue_tag" && worker.queueTagId === queueTagId
        ? {
            ...worker,
            queueTagName: normalizedName,
          }
        : worker,
    );
    setTagManagementMessage(`Queue tag renamed to "${normalizedName}".`);
    setGlobalMessage(
      "Queue tag renamed. Existing items and scoped workers were updated without running work.",
    );
    return true;
  }

  function deleteQueueTag(queueTagId: string) {
    const tag = queueTags.find((candidate) => candidate.queueTagId === queueTagId);

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (!tag) {
      setTagManagementError("Queue tag could not be found.");
      return false;
    }

    if (tag.runningCount > 0) {
      setTagManagementError(
        "Queue tags with running items cannot be deleted. Stop or finish the Agent Executor work first.",
      );
      return false;
    }

    if (tag.taskCount > 0) {
      setTagManagementError("Reassign items before deleting this queue tag.");
      return false;
    }

    if (queueTagId === DEFAULT_QUEUE_TAG_ID) {
      setTagManagementError(
        "Default queue tag is kept for legacy and basic queue items.",
      );
      return false;
    }

    setManagedQueueTags((current) =>
      current.filter((managedTag) => managedTag.queueTagId !== queueTagId),
    );
    setQueueTagPauseStates((current) => {
      const next = new Map(current);
      next.delete(queueTagId);
      return next;
    });
    setWorkerScopes((current) => {
      const next = new Map(current);
      for (const [workerId, scope] of next.entries()) {
        if (scope.kind === "queue_tag" && scope.queueTagId === queueTagId) {
          next.set(workerId, { kind: "all" });
        }
      }
      return next;
    });
    void persistWorkerScopeUpdates((worker) =>
      worker.scopeKind === "queue_tag" && worker.queueTagId === queueTagId
        ? {
            ...worker,
            queueTagId: null,
            queueTagName: null,
            scopeKind: "all",
          }
        : worker,
    );
    setTagManagementMessage(`Queue tag "${tag.queueTagName}" deleted.`);
    setGlobalMessage(
      "Empty queue tag deleted. Scoped workers were moved back to All queues.",
    );
    return true;
  }

  function pauseQueueTag(queueTagId: string) {
    setQueueTagPauseStates((current) =>
      new Map(current).set(queueTagId, { paused: true, reason: "manual" }),
    );
    setTagManagementError(null);
    setTagManagementMessage("Queue tag paused.");
    setGlobalMessage(
      "Queue tag paused. Workers must not take new items from that tag until coordinator resume.",
    );
  }

  function resumeQueueTag(queueTagId: string) {
    setQueueTagPauseStates((current) => {
      const next = new Map(current);
      next.delete(queueTagId);
      return next;
    });
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of tasksRef.current) {
        if (normalizeQueueTag(task).queueTagId === queueTagId) {
          next.set(task.queueItemId, {
            ...(next.get(task.queueItemId) ?? {}),
            coordinatorStatus: "not_reported",
          });
        }
      }
      return next;
    });
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) =>
        normalizeQueueTag(task).queueTagId === queueTagId
          ? { ...task, coordinatorStatus: "not_reported" as const }
          : task,
      );
      tasksRef.current = nextTasks;
      return nextTasks;
    });
    setSelectedTask((currentTask) =>
      currentTask && normalizeQueueTag(currentTask).queueTagId === queueTagId
        ? { ...currentTask, coordinatorStatus: "not_reported" }
        : currentTask,
    );
    setTagManagementError(null);
    setTagManagementMessage("Queue tag resumed.");
    setGlobalMessage("Queue tag resumed by coordinator review.");
  }

  return {
    createQueueTag,
    deleteQueueTag,
    pauseQueueTag,
    renameQueueTag,
    resumeQueueTag,
  };
}

export function queueTagSummaryToRecord(tag: QueueTagSummary): QueueTagRecord {
  return {
    queueTagId: tag.queueTagId,
    queueTagName: tag.queueTagName,
  };
}

export function upsertQueueTagRecord(
  queueTags: QueueTagRecord[],
  queueTag: QueueTagRecord,
) {
  const found = queueTags.some(
    (candidate) => candidate.queueTagId === queueTag.queueTagId,
  );

  if (found) {
    return queueTags.map((candidate) =>
      candidate.queueTagId === queueTag.queueTagId ? queueTag : candidate,
    );
  }

  return [...queueTags, queueTag];
}
