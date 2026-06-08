import { useCallback, useRef, useState } from "react";

import type {
  AgentContextSnapshot,
  AgentRunEvent,
  AgentRunResult,
  AgentToolPolicy,
  CodexAgentRuntimeAdapter,
  CodexAgentRuntimeRunHandle,
} from "../../agentRuntime";
import { CODEX_AGENT_PROVIDER_ID } from "../../agentRuntime";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../../workspace/types";
import type { WorkspaceAgentV2TranscriptMessage } from "./WorkspaceAgentV2Transcript";
import {
  buildWorkspaceAgentV2DirectRunRequest,
  isWorkspaceAgentV2DirectRunBusy,
  workspaceAgentV2ContextMaterializedEvent,
  workspaceAgentV2ResultEvent,
  workspaceAgentV2ResultTranscriptMessage,
  workspaceAgentV2UserPromptTranscriptMessage,
  type WorkspaceAgentV2DirectRunStatus,
} from "./workspaceAgentV2DirectRunModel";

export type WorkspaceAgentV2DirectRunControllerOptions = {
  readonly adapter: CodexAgentRuntimeAdapter;
  readonly approvalPolicy?: DirectWorkApprovalPolicy;
  readonly codexExecutable?: string;
  readonly initialActivityEvents?: readonly AgentRunEvent[];
  readonly initialTranscriptMessages?: readonly WorkspaceAgentV2TranscriptMessage[];
  readonly sandbox?: DirectWorkSandbox;
  readonly toolPolicy?: AgentToolPolicy;
  readonly visibleContextSnapshot?: AgentContextSnapshot;
  readonly widgetInstanceId: string;
  readonly workingDirectory?: string | null;
  readonly workspaceId: string;
};

export type WorkspaceAgentV2DirectRunController = {
  readonly activityEvents: readonly AgentRunEvent[];
  readonly cancelDirectRun: () => Promise<void>;
  readonly currentRunId: string | null;
  readonly errorMessage: string | null;
  readonly startDirectRun: (promptText: string) => Promise<void>;
  readonly status: WorkspaceAgentV2DirectRunStatus;
  readonly transcriptMessages: readonly WorkspaceAgentV2TranscriptMessage[];
  readonly warnings: readonly string[];
};

export function useWorkspaceAgentV2DirectRun({
  adapter,
  approvalPolicy,
  codexExecutable,
  initialActivityEvents = [],
  initialTranscriptMessages = [],
  sandbox,
  toolPolicy,
  visibleContextSnapshot,
  widgetInstanceId,
  workingDirectory,
  workspaceId,
}: WorkspaceAgentV2DirectRunControllerOptions): WorkspaceAgentV2DirectRunController {
  const [activityEvents, setActivityEvents] =
    useState<readonly AgentRunEvent[]>(initialActivityEvents);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] =
    useState<WorkspaceAgentV2DirectRunStatus>("idle");
  const [transcriptMessages, setTranscriptMessages] = useState<
    readonly WorkspaceAgentV2TranscriptMessage[]
  >(initialTranscriptMessages);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const completedResultRunIdsRef = useRef(new Set<string>());
  const eventSequenceRef = useRef(0);
  const handleRef = useRef<CodexAgentRuntimeRunHandle | null>(null);
  const requestSequenceRef = useRef(0);
  const statusRef = useRef<WorkspaceAgentV2DirectRunStatus>("idle");

  const setControllerStatus = useCallback(
    (nextStatus: WorkspaceAgentV2DirectRunStatus) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
    },
    [],
  );

  const appendEvent = useCallback((event: AgentRunEvent) => {
    setActivityEvents((events) => [...events, event]);
  }, []);

  const appendResult = useCallback(
    (result: AgentRunResult) => {
      if (completedResultRunIdsRef.current.has(result.runId)) {
        return;
      }

      completedResultRunIdsRef.current.add(result.runId);
      appendEvent(
        workspaceAgentV2ResultEvent({
          result,
          sequence: nextEventSequence(eventSequenceRef),
          timestampMs: Date.now(),
        }),
      );
      setTranscriptMessages((messages) => [
        ...messages,
        workspaceAgentV2ResultTranscriptMessage(result),
      ]);
      setCurrentRunId(result.runId);

      if (result.lifecycle === "completed") {
        setErrorMessage(null);
        setControllerStatus("completed");
        return;
      }

      if (result.lifecycle === "cancelled") {
        setErrorMessage(result.errorMessage ?? null);
        setControllerStatus("cancelled");
        return;
      }

      setErrorMessage(result.errorMessage ?? "Direct Run failed.");
      setControllerStatus("failed");
    },
    [appendEvent, setControllerStatus],
  );

  const startDirectRun = useCallback(
    async (promptText: string) => {
      if (isWorkspaceAgentV2DirectRunBusy(statusRef.current)) {
        setWarnings((existing) => [
          ...existing,
          "Direct Run is already running; duplicate start was ignored.",
        ]);
        return;
      }

      requestSequenceRef.current += 1;
      const requestId = `workspace-agent-v2-direct-run-${requestSequenceRef.current}`;
      setControllerStatus("preparing");
      setErrorMessage(null);
      setWarnings([]);

      await nextMicrotask();

      const built = buildWorkspaceAgentV2DirectRunRequest({
        approvalPolicy,
        codexExecutable,
        promptText,
        requestId,
        sandbox,
        toolPolicy,
        visibleContextSnapshot,
        widgetInstanceId,
        workingDirectory,
        workspaceId,
      });

      setWarnings((existing) => [...existing, ...built.warnings]);

      if (built.unsupportedReason || !built.launchOptions) {
        setErrorMessage(built.unsupportedReason);
        setControllerStatus("unsupported");
        return;
      }

      setTranscriptMessages((messages) => [
        ...messages,
        workspaceAgentV2UserPromptTranscriptMessage({
          prompt: built.request.prompt,
          providerId: built.request.providerId,
          requestId,
        }),
      ]);
      setControllerStatus("materializing_context");
      appendEvent(
        workspaceAgentV2ContextMaterializedEvent({
          request: built.request,
          sequence: nextEventSequence(eventSequenceRef),
          timestampMs: Date.now(),
        }),
      );

      await nextMicrotask();

      setControllerStatus("running");

      try {
        const handleOrResult = await adapter.startRun(
          built.request,
          built.launchOptions,
          appendEvent,
          undefined,
          appendResult,
        );

        if (isAgentRunResult(handleOrResult)) {
          if (handleOrResult.lifecycle === "blocked") {
            setErrorMessage(
              handleOrResult.errorMessage ??
                "Codex Direct Run is unsupported by this provider adapter.",
            );
            setWarnings((existing) => [
              ...existing,
              ...(handleOrResult.warnings ?? []),
            ]);
            setControllerStatus("unsupported");
            return;
          }

          appendResult(handleOrResult);
          return;
        }

        handleRef.current = handleOrResult;
        setCurrentRunId(handleOrResult.runId);
        setWarnings((existing) => [...existing, ...handleOrResult.warnings]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Direct Run provider failed.";
        const failedResult: AgentRunResult = {
          errorMessage: message,
          fileChanges: [],
          lifecycle: "failed",
          metadata: {
            lifecycle: "failed",
            mode: "direct",
            providerId: CODEX_AGENT_PROVIDER_ID,
            runId: requestId,
            tokenUsage: null,
            workspaceId,
          },
          runId: requestId,
          validationSuggestions: [],
          warnings: [],
        };
        setCurrentRunId(requestId);
        appendResult(failedResult);
      }
    },
    [
      adapter,
      appendEvent,
      appendResult,
      approvalPolicy,
      codexExecutable,
      sandbox,
      setControllerStatus,
      toolPolicy,
      visibleContextSnapshot,
      widgetInstanceId,
      workingDirectory,
      workspaceId,
    ],
  );

  const cancelDirectRun = useCallback(async () => {
    const activeRunId = currentRunId ?? handleRef.current?.runId;

    if (!activeRunId || !isWorkspaceAgentV2DirectRunBusy(statusRef.current)) {
      setWarnings((existing) => [
        ...existing,
        "No active Direct Run is available to cancel.",
      ]);
      return;
    }

    if (!adapter.capabilities.supportsCancellation) {
      setWarnings((existing) => [
        ...existing,
        "Cancellation is unavailable for this Codex adapter instance.",
      ]);
      return;
    }

    const response = await adapter.cancelRun(widgetInstanceId, activeRunId);
    setWarnings((existing) => [...existing, ...response.warnings]);

    if (!response.supported) {
      return;
    }

    handleRef.current?.stopListening();
    setControllerStatus("cancelled");
    const sequence = nextEventSequence(eventSequenceRef);
    appendEvent({
      id: `${activeRunId}:cancelled:${sequence}`,
      kind: "cancelled",
      lifecycle: "cancelled",
      message: "Cancellation was requested from the Codex provider adapter.",
      runId: activeRunId,
      sequence,
      timestampMs: Date.now(),
      title: "Direct Run cancellation requested",
    });
  }, [
    adapter,
    appendEvent,
    currentRunId,
    setControllerStatus,
    widgetInstanceId,
  ]);

  return {
    activityEvents,
    cancelDirectRun,
    currentRunId,
    errorMessage,
    startDirectRun,
    status,
    transcriptMessages,
    warnings,
  };
}

function isAgentRunResult(
  value: CodexAgentRuntimeRunHandle | AgentRunResult,
): value is AgentRunResult {
  return "lifecycle" in value;
}

function nextEventSequence(sequenceRef: { current: number }) {
  sequenceRef.current += 1;
  return sequenceRef.current;
}

function nextMicrotask() {
  return Promise.resolve();
}
