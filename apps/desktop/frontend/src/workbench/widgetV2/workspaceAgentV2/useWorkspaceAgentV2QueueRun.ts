import { useCallback, useRef, useState } from "react";

import type { AgentContextSnapshot } from "../../agentRuntime";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type { WorkspaceAgentV2ContextItem } from "./WorkspaceAgentV2ContextStrip";
import {
  failedControllerResult,
  isWorkspaceAgentV2QueueRunBusy,
  workspaceAgentV2QueueRunResultFromService,
  type WorkspaceAgentV2QueueRunControllerResult,
  type WorkspaceAgentV2QueueRunStatus,
} from "./workspaceAgentV2QueueRunModel";
import {
  buildQueueRunRequestFromComposer,
  createQueueTaskFromAgentRequest,
  type WorkspaceAgentV2QueueRunDesiredStatus,
} from "./workspaceAgentV2QueueRunService";

export type WorkspaceAgentV2QueueRunControllerOptions = {
  readonly contextItems?: readonly WorkspaceAgentV2ContextItem[];
  readonly createdFromRunId?: string | null;
  readonly createdFromTranscriptId?: string | null;
  readonly desiredStatus?: WorkspaceAgentV2QueueRunDesiredStatus;
  readonly onResult?: (result: WorkspaceAgentV2QueueRunControllerResult) => void;
  readonly priority?: number;
  readonly queueBridge?: Pick<WorkspaceAgentQueueBridge, "createItem"> | null;
  readonly tags?: readonly string[];
  readonly visibleContextSnapshot?: AgentContextSnapshot;
};

export type WorkspaceAgentV2QueueRunController = {
  readonly errorMessage: string | null;
  readonly result: WorkspaceAgentV2QueueRunControllerResult | null;
  readonly startQueueRun: (promptText: string) => Promise<void>;
  readonly status: WorkspaceAgentV2QueueRunStatus;
  readonly warnings: readonly string[];
};

export function useWorkspaceAgentV2QueueRun({
  contextItems = [],
  createdFromRunId,
  createdFromTranscriptId,
  desiredStatus = "draft",
  onResult,
  priority,
  queueBridge,
  tags = [],
  visibleContextSnapshot,
}: WorkspaceAgentV2QueueRunControllerOptions): WorkspaceAgentV2QueueRunController {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] =
    useState<WorkspaceAgentV2QueueRunControllerResult | null>(null);
  const [status, setStatus] = useState<WorkspaceAgentV2QueueRunStatus>("idle");
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const emittedResultKeysRef = useRef(new Set<string>());
  const statusRef = useRef<WorkspaceAgentV2QueueRunStatus>("idle");

  const setControllerStatus = useCallback(
    (nextStatus: WorkspaceAgentV2QueueRunStatus) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
    },
    [],
  );

  const emitResult = useCallback(
    (nextResult: WorkspaceAgentV2QueueRunControllerResult) => {
      const key =
        nextResult.createdTask?.id ??
        `${nextResult.status}:${nextResult.errorCode ?? nextResult.message}`;

      setResult(nextResult);
      setWarnings(nextResult.warnings);
      setErrorMessage(nextResult.ok ? null : nextResult.errorMessage ?? nextResult.message);
      setControllerStatus(nextResult.status);

      if (emittedResultKeysRef.current.has(key)) {
        return;
      }

      emittedResultKeysRef.current.add(key);
      onResult?.(nextResult);
    },
    [onResult, setControllerStatus],
  );

  const startQueueRun = useCallback(
    async (promptText: string) => {
      if (isWorkspaceAgentV2QueueRunBusy(statusRef.current)) {
        setWarnings((existing) => [
          ...existing,
          "Queue Run is already creating a task; duplicate start was ignored.",
        ]);
        return;
      }

      setControllerStatus("preparing");
      setErrorMessage(null);
      setResult(null);
      setWarnings([]);

      await nextMicrotask();

      const built = buildQueueRunRequestFromComposer({
        contextItems,
        createdFromRunId,
        createdFromTranscriptId,
        desiredStatus,
        priority,
        prompt: promptText,
        tags,
        visibleContextSnapshot,
      });

      if (!built.ok) {
        emitResult(workspaceAgentV2QueueRunResultFromService(built));
        return;
      }

      setControllerStatus("attaching_context");
      await nextMicrotask();
      setControllerStatus("creating_task");

      try {
        const created = await createQueueTaskFromAgentRequest(built.request, {
          queueBridge,
        });
        emitResult(workspaceAgentV2QueueRunResultFromService(created));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Queue task creation failed.";
        emitResult(
          failedControllerResult({
            attachedContextCount: built.request.visibleContextRefs.length,
            errorMessage: message,
          }),
        );
      }
    },
    [
      contextItems,
      createdFromRunId,
      createdFromTranscriptId,
      desiredStatus,
      emitResult,
      priority,
      queueBridge,
      setControllerStatus,
      tags,
      visibleContextSnapshot,
    ],
  );

  return {
    errorMessage,
    result,
    startQueueRun,
    status,
    warnings,
  };
}

function nextMicrotask() {
  return Promise.resolve();
}
