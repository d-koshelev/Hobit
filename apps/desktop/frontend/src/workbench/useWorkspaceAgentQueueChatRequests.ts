import { useRef, useState } from "react";

import type { AgentQueueReportActionCard, AgentQueueTask } from "../workspace/types";
import type {
  WidgetInstanceId,
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
} from "./types";

export function useWorkspaceAgentQueueChatRequests({
  coordinatorWidgetId,
}: {
  coordinatorWidgetId: WidgetInstanceId | null;
}) {
  const queueReportActionCardRequestIdRef = useRef(0);
  const [queueReportActionCardRequest, setQueueReportActionCardRequest] =
    useState<WorkspaceAgentQueueReportActionCardRequest | null>(null);
  const queueTaskStatusCardRequestIdRef = useRef(0);
  const [queueTaskStatusCardRequest, setQueueTaskStatusCardRequest] =
    useState<WorkspaceAgentQueueTaskStatusCardRequest | null>(null);

  function showQueueReportInWorkspaceChat(card: AgentQueueReportActionCard) {
    if (!coordinatorWidgetId) {
      return;
    }

    scrollToWidget(coordinatorWidgetId);
    setQueueReportActionCardRequest({
      card,
      id: ++queueReportActionCardRequestIdRef.current,
      targetCoordinatorWidgetInstanceId: coordinatorWidgetId,
    });
  }

  function showQueueTaskInWorkspaceChat(task: AgentQueueTask) {
    if (!coordinatorWidgetId) {
      return;
    }

    scrollToWidget(coordinatorWidgetId);
    setQueueTaskStatusCardRequest({
      id: ++queueTaskStatusCardRequestIdRef.current,
      targetCoordinatorWidgetInstanceId: coordinatorWidgetId,
      task,
    });
  }

  return {
    queueReportActionCardRequest,
    queueTaskStatusCardRequest,
    showQueueReportInWorkspaceChat,
    showQueueTaskInWorkspaceChat,
  };
}

function scrollToWidget(widgetInstanceId: WidgetInstanceId) {
  const target =
    typeof document === "undefined"
      ? null
      : Array.from(
          document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
        ).find((element) => element.dataset.widgetInstanceId === widgetInstanceId);

  target?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}
