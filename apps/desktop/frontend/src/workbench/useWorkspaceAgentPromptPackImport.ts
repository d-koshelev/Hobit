import type { RefObject, Dispatch, SetStateAction } from "react";
import { useState } from "react";

import type { WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";
import type { WorkspaceAgentPromptPackImportState } from "./promptPack";

export type WorkspaceAgentPromptPackImportStartOptions = {
  sourcePath?: string;
  sourceText?: string;
  sourceUnavailableReason?: string;
};

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

  function start(options: WorkspaceAgentPromptPackImportStartOptions = {}) {
    startWithMessage({ options });
  }

  function startFromOperatorMessage(
    operatorBody: string,
    options: WorkspaceAgentPromptPackImportStartOptions = {},
  ) {
    startWithMessage({ operatorBody, options });
  }

  function startWithMessage({
    operatorBody,
    options,
  }: {
    operatorBody?: string;
    options: WorkspaceAgentPromptPackImportStartOptions;
  }) {
    const messageId = `local-${nextMessageId.current}`;
    const importId = `prompt-pack-import-${nextMessageId.current}`;
    nextMessageId.current += 1;

    setImports((currentImports) => ({
      ...currentImports,
      [importId]: {
        id: importId,
        sourcePath: options.sourcePath,
        sourceText: options.sourceText ?? "",
        sourceUnavailableReason: options.sourceUnavailableReason,
      },
    }));
    setMessages((currentMessages) => [
      ...currentMessages,
      ...(operatorBody
        ? [
            {
              body: operatorBody,
              id: `local-${nextMessageId.current++}`,
              role: "operator" as const,
            },
          ]
        : []),
      {
        body: promptPackImportStartMessage(options),
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
    startFromOperatorMessage,
  };
}

function promptPackImportStartMessage(
  options: WorkspaceAgentPromptPackImportStartOptions,
) {
  if (options.sourceText?.trim()) {
    return "Prompt-pack import preview started from the explicit pasted source. Review the preview card, then confirm Queue item creation.";
  }

  if (options.sourcePath?.trim()) {
    return "Prompt-pack import preview started, but the requested path source is unavailable in the typed product path. Paste prompt-batch JSON or a numbered Markdown prompt in the card before creating Queue items.";
  }

  return "Prompt-pack import started. Select an explicit source by pasting prompt-batch JSON or a numbered Markdown prompt, preview it, then confirm Queue item creation.";
}
