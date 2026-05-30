import type { AgentQueueTask } from "../../workspace/types";
import {
  normalizeQueueTag,
  normalizeTaskPriority,
  sortQueueTasksForDisplay,
} from "../agentQueueTaskUiModel";

export type QueueTaskInsertPosition = "top" | "bottom";

export type QueueTaskReorderPosition = "up" | "down" | "top" | "bottom";

export function queueTaskOrderingControls({
  selectedTask,
  tasks,
}: {
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
}) {
  if (!selectedTask) {
    return {
      canMoveDown: false,
      canMoveToBottom: false,
      canMoveToTop: false,
      canMoveUp: false,
      orderLabel: null,
    };
  }

  const orderedPeers = orderedManualReorderPeers(tasks, selectedTask);
  const selectedIndex = orderedPeers.findIndex(
    (task) => task.queueItemId === selectedTask.queueItemId,
  );
  const position = selectedIndex >= 0 ? selectedIndex + 1 : null;
  const total = orderedPeers.length;

  return {
    canMoveDown: selectedIndex >= 0 && selectedIndex < total - 1,
    canMoveToBottom: selectedIndex >= 0 && selectedIndex < total - 1,
    canMoveToTop: selectedIndex > 0,
    canMoveUp: selectedIndex > 0,
    orderLabel: position ? `${position.toString()} of ${total.toString()}` : null,
  };
}

export function reorderQueueTask({
  position,
  queueItemId,
  tasks,
}: {
  position: QueueTaskReorderPosition;
  queueItemId: string;
  tasks: AgentQueueTask[];
}) {
  const selectedTask = tasks.find((task) => task.queueItemId === queueItemId);

  if (!selectedTask) {
    return { changed: false, updatedTasks: tasks };
  }

  const peers = orderedManualReorderPeers(tasks, selectedTask);
  const currentIndex = peers.findIndex((task) => task.queueItemId === queueItemId);

  if (currentIndex < 0) {
    return { changed: false, updatedTasks: tasks };
  }

  const nextIndex =
    position === "top"
      ? 0
      : position === "bottom"
        ? peers.length - 1
        : position === "up"
          ? currentIndex - 1
          : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= peers.length || nextIndex === currentIndex) {
    return { changed: false, updatedTasks: tasks };
  }

  const reorderedPeers = [...peers];
  const [movedTask] = reorderedPeers.splice(currentIndex, 1);
  reorderedPeers.splice(nextIndex, 0, movedTask);
  const orderById = new Map(
    reorderedPeers.map((task, index) => [task.queueItemId, index]),
  );
  const updatedTasks = sortQueueTasksForDisplay(
    tasks.map((task) =>
      orderById.has(task.queueItemId)
        ? { ...task, orderIndex: orderById.get(task.queueItemId) }
        : task,
    ),
  );

  return { changed: true, updatedTasks };
}

export function nextOrderIndexForQueueTag({
  insertPosition,
  queueTagId,
  tasks,
}: {
  insertPosition: QueueTaskInsertPosition;
  queueTagId: string;
  tasks: AgentQueueTask[];
}) {
  const orderIndexes = tasks
    .filter((task) => normalizeQueueTag(task).queueTagId === queueTagId)
    .map((task) => task.orderIndex)
    .filter((orderIndex): orderIndex is number =>
      typeof orderIndex === "number" && Number.isFinite(orderIndex),
    );

  if (orderIndexes.length === 0) {
    return 0;
  }

  return insertPosition === "top"
    ? Math.min(...orderIndexes) - 1
    : Math.max(...orderIndexes) + 1;
}

export function withQueueOrderIndexes(tasks: AgentQueueTask[]) {
  const sortedTasks = sortQueueTasksForDisplay(tasks);
  const nextOrderByGroup = new Map<string, number>();

  return sortQueueTasksForDisplay(
    sortedTasks.map((task) => {
      if (typeof task.orderIndex === "number" && Number.isFinite(task.orderIndex)) {
        return task;
      }

      const groupKey = manualOrderGroupKey(task);
      const nextOrderIndex = nextOrderByGroup.get(groupKey) ?? 0;
      nextOrderByGroup.set(groupKey, nextOrderIndex + 1);
      return { ...task, orderIndex: nextOrderIndex };
    }),
  );
}

function orderedManualReorderPeers(
  tasks: AgentQueueTask[],
  selectedTask: AgentQueueTask,
) {
  const selectedQueueTag = normalizeQueueTag(selectedTask);
  const selectedPriority = normalizeTaskPriority(selectedTask.priority);

  return sortQueueTasksForDisplay(
    tasks.filter((task) => {
      const queueTag = normalizeQueueTag(task);
      return (
        queueTag.queueTagId === selectedQueueTag.queueTagId &&
        normalizeTaskPriority(task.priority) === selectedPriority
      );
    }),
  );
}

function manualOrderGroupKey(task: AgentQueueTask) {
  const queueTag = normalizeQueueTag(task);
  return `${queueTag.queueTagId}:${normalizeTaskPriority(task.priority).toString()}`;
}
