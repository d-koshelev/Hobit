import { useRef, useState } from "react";

import type {
  DirectWorkRunHandoff,
  DirectWorkRunHandoffInput,
  WidgetInstanceId,
} from "./types";

export type DirectWorkRunHandoffController = {
  handoffs: Partial<Record<WidgetInstanceId, DirectWorkRunHandoff>>;
  recordHandoff: (handoff: DirectWorkRunHandoffInput) => void;
};

export function useDirectWorkRunHandoff(): DirectWorkRunHandoffController {
  const handoffIdRef = useRef(0);
  const [handoffs, setHandoffs] = useState<
    Partial<Record<WidgetInstanceId, DirectWorkRunHandoff>>
  >({});

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

  return {
    handoffs,
    recordHandoff,
  };
}
