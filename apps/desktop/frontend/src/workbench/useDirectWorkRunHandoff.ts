import { useRef, useState } from "react";

import type {
  DirectWorkQueueTaskAutoRefreshRequest,
  DirectWorkRunHandoff,
  DirectWorkRunHandoffInput,
  WidgetInstanceId,
} from "./types";
import {
  createQueueLinkedDirectWorkCompletionIdentity,
  withQueueLinkedDirectWorkMetadata,
} from "./queueLinkedDirectWorkMetadata";

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

    const nextHandoff = withQueueLinkedDirectWorkMetadata({
      ...handoff,
      executorWidgetInstanceId,
      id: ++handoffIdRef.current,
      queueItemId: handoff.queueItemId.trim(),
      repoRoot: handoff.repoRoot.trim(),
      runId,
      startedAt: handoff.startedAt ?? new Date().toISOString(),
      taskTitle: handoff.taskTitle.trim() || "Queue task",
    });

    setHandoffs((currentHandoffs) => ({
      ...currentHandoffs,
      [executorWidgetInstanceId]: nextHandoff,
    }));
  }

  function recordFinalState(
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) {
    const completedAt = new Date().toISOString();
    const identityResult = createQueueLinkedDirectWorkCompletionIdentity({
      completedAt,
      handoff,
    });

    if (
      identityResult.status !== "valid" ||
      autoRefreshRunKeysRef.current.has(identityResult.identity.idempotencyKey)
    ) {
      return;
    }

    const { identity } = identityResult;
    const runKey = identity.idempotencyKey;
    autoRefreshRunKeysRef.current.add(runKey);
    setQueueTaskAutoRefreshRequest({
      attemptId: identity.attemptId,
      completedAt,
      executorWidgetInstanceId: identity.executorWidgetId,
      finalStatus,
      id: ++autoRefreshIdRef.current,
      queueItemId: identity.queueItemId,
      queueLinkedMetadata: identity.metadata,
      queueLinkedSource: identity.metadata.source,
      repoRoot: handoff.repoRoot,
      runId: identity.runId,
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
