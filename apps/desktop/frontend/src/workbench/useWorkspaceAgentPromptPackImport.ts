import type { RefObject, Dispatch, SetStateAction } from "react";
import { useState } from "react";

import type { WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";
import type { WorkspaceAgentPromptPackImportState } from "./promptPack";

export function useWorkspaceAgentPromptPackImport({
  messageListRef,
  nextMessageId,
  setMessages,
}: {
  messageListRef: RefObject<HTMLDivElement | null>;
  nextMessageId: RefObject<number>;
  setMessages: Dispatch<SetStateAction<WorkspaceAgentTranscriptMessage[]>>;
}) {
  const [imports, setImports] = useState<
    Record<string, WorkspaceAgentPromptPackImportState>
  >({});

  function start() {
    const messageId = `local-${nextMessageId.current}`;
    const importId = `prompt-pack-import-${nextMessageId.current}`;
    nextMessageId.current += 1;

    setImports((currentImports) => ({
      ...currentImports,
      [importId]: {
        id: importId,
        sourceText: "",
      },
    }));
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        body: "Prompt-pack import started. Select an explicit source by pasting prompt-batch JSON or a numbered Markdown prompt, preview it, then confirm Queue item creation.",
        id: messageId,
        promptPackImportId: importId,
        role: "assistant",
      },
    ]);
    window.setTimeout(() => {
      const messageList = messageListRef.current;
      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
      }
    }, 0);
  }

  function patch(
    importId: string,
    patchValue: Partial<WorkspaceAgentPromptPackImportState>,
  ) {
    setImports((currentImports) => {
      const currentImport = currentImports[importId];

      if (!currentImport) {
        return currentImports;
      }

      return {
        ...currentImports,
        [importId]: {
          ...currentImport,
          ...patchValue,
        },
      };
    });
  }

  function cancel(importId: string) {
    patch(importId, { isCancelled: true });
  }

  function reset() {
    setImports({});
  }

  return {
    cancel,
    imports,
    patch,
    reset,
    start,
  };
}
