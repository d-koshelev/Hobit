import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { AgentQueueReportActionCard, AgentQueueTask } from "../workspace/types";
import type {
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
} from "./types";
import type { WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";

type CreateQueueCardMessageInput = {
  body: string;
  queueReportCardId?: string;
  queueTaskStatusCard?: AgentQueueTask;
};

export function useWorkspaceAgentQueueCardRequests({
  createMessage,
  messageListRef,
  queueReportActionCardRequest,
  queueTaskStatusCardRequest,
  setMessages,
  setQueueReportCards,
}: {
  createMessage: (
    input: CreateQueueCardMessageInput,
  ) => WorkspaceAgentTranscriptMessage;
  messageListRef: RefObject<HTMLDivElement | null>;
  queueReportActionCardRequest?: WorkspaceAgentQueueReportActionCardRequest | null;
  queueTaskStatusCardRequest?: WorkspaceAgentQueueTaskStatusCardRequest | null;
  setMessages: Dispatch<SetStateAction<WorkspaceAgentTranscriptMessage[]>>;
  setQueueReportCards: Dispatch<
    SetStateAction<Record<string, AgentQueueReportActionCard>>
  >;
}) {
  useEffect(() => {
    if (!queueReportActionCardRequest) {
      return;
    }

    const card = queueReportActionCardRequest.card;
    setQueueReportCards((currentCards) => ({
      ...currentCards,
      [card.cardId]: card,
    }));
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage({
        body: "Report received. Coordinator action required. No final status applied.",
        queueReportCardId: card.cardId,
      }),
    ]);
    scrollTranscriptToBottom(messageListRef);
  }, [queueReportActionCardRequest?.id]);

  useEffect(() => {
    if (!queueTaskStatusCardRequest) {
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage({
        body: "Queue task status card added. No Queue action ran.",
        queueTaskStatusCard: queueTaskStatusCardRequest.task,
      }),
    ]);
    scrollTranscriptToBottom(messageListRef);
  }, [queueTaskStatusCardRequest?.id]);
}

function scrollTranscriptToBottom(ref: RefObject<HTMLDivElement | null>) {
  window.setTimeout(() => {
    const messageList = ref.current;

    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, 0);
}
