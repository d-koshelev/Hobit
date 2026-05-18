import { useRef, useState } from "react";

import type {
  DirectWorkQueueTaskAutoRefreshRequest,
  DirectWorkRunHandoff,
  DirectWorkRunHandoffInput,
  WidgetInstanceId,
} from "./types";

export type DirectWorkRunHandoffController = {
  handoffs: Partial<Record<WidgetInstanceId, DirectWorkRunHandoff>>;
  queueTaskAutoRefreshRequest: DirectWorkQueueTaskAutoRefreshRequest | null;
  recordFinalState: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  recordHandoff: (handoff: DirectWorkRunHandoffInput) => void;
};

export function useDirectWorkRunHandoff(): DirectWorkRunHandoffController {
  const autoRefreshIdRef = useRef(0);
  const autoRefreshRunKeysRef = useRef<Set<string>>(new Set());
  const handoffIdRef = useRef(0);
  const [handoffs, setHandoffs] = useState<
    Partial<Record<WidgetInstanceId, DirectWorkRunHandoff>>
  >({});
  const [queueTaskAutoRefreshRequest, setQueueTaskAutoRefreshRequest] =
    useState<DirectWorkQueueTaskAutoRefreshRequest | null>(null);

  function recordHandoff(handoff: DirectWorkRunHandoffInput) {
    const executorWidgetInstanceId = handoff.executorWidgetInstanceId.trim();
    const runId = handoff.runId.trim();

    if (!executorWidgetInstanceId || !runId) {
      return;
    }

    const nextHandoff: DirectWorkRunHandoff = {
      ...handoff,
      executorWidgetInstanceId,
      id: ++handoffIdRef.current,
      repoRoot: handoff.repoRoot.trim(),
      runId,
      startedAt: handoff.startedAt ?? new Date().toISOString(),
      taskTitle: handoff.taskTitle.trim() || "Queue task",
    };

    setHandoffs((currentHandoffs) => ({
      ...currentHandoffs,
      [executorWidgetInstanceId]: nextHandoff,
    }));
  }

  function recordFinalState(
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) {
    const queueItemId = handoff.queueItemId.trim();
    const runId = handoff.runId.trim();
    const runKey = `${queueItemId}:${runId}`;

    if (!queueItemId || !runId || autoRefreshRunKeysRef.current.has(runKey)) {
      return;
    }

    autoRefreshRunKeysRef.current.add(runKey);
    setQueueTaskAutoRefreshRequest({
      completedAt: new Date().toISOString(),
      executorWidgetInstanceId: handoff.executorWidgetInstanceId,
      finalStatus,
      id: ++autoRefreshIdRef.current,
      queueItemId,
      repoRoot: handoff.repoRoot,
      runId,
      startedAt: handoff.startedAt,
      taskTitle: handoff.taskTitle,
      workbenchId: handoff.workbenchId,
      workspaceId: handoff.workspaceId,
    });
  }

  return {
    handoffs,
    queueTaskAutoRefreshRequest,
    recordFinalState,
    recordHandoff,
  };
}
