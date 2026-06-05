import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { DirectWorkSandbox, DirectWorkStreamEvent } from "../workspace/types";
import { agentActivityEventFromDirectWorkStreamEvent } from "./agentActivityModel";
import {
  CODEX_THREAD_NOT_AVAILABLE_MESSAGE,
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING,
  DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE,
  DIRECT_WORK_EMPTY_PROMPT_MESSAGE,
  DIRECT_WORK_UNAVAILABLE_MESSAGE,
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
  codexAgentMessageFromEvent,
  codexPromptWithWorkspaceKnowledge,
  codexThreadIdForScope,
  coordinatorDirectWorkStatusFromEvent,
  defaultCoordinatorCodexExecutable,
  directWorkEventBelongsToCurrentAgent,
  directWorkEventHasAccessDenied,
  directWorkEventText,
  directWorkFailureIsAccessDenied,
  directWorkFailureReason,
  shortCodexThreadId,
  workspaceKnowledgeLogText,
  type ActiveDirectWorkRunScope,
  type CodexThreadScope,
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
  workspaceAgentActivitySummaryForLocalFailure,
  workspaceAgentActivitySummaryForLocalStart,
  workspaceAgentActivitySummaryFromEvent,
} from "./workspaceAgentDirectWorkModel";
import { errorToMessage } from "./workspaceAgentProviderGuards";
import {
  tokenUsageFromDirectWorkStreamEvent,
  type WorkspaceAgentRunMetadata,
  type WorkspaceAgentRunTokenUsage,
} from "./workspaceAgentRunMetadata";
import type { WidgetRenderProps } from "./types";

type UseWorkspaceAgentDirectWorkControllerOptions = {
  draft: string;
  instanceId: string;
  isProviderPending: boolean;
  onAppendAssistantTranscript: (
    status: CoordinatorDirectWorkStatus,
    reason: string,
    useDirectBody?: boolean,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) => void;
  onAppendOperatorTranscript: (body: string) => void;
  onCancelCodexDirectWorkRun?: WidgetRenderProps["onCancelCodexDirectWorkRun"];
  onClearDraft: () => void;
  onClearVisibleAttachedContext: () => void;
  onFocusComposer: () => void;
  onPublishAgentActivityEvents?: WidgetRenderProps["onPublishAgentActivityEvents"];
  onRemoveVisibleAttachedContext: () => void;
  onSearchKnowledgeDocuments?: WidgetRenderProps["onSearchKnowledgeDocuments"];
  onStartCodexDirectWorkStream?: WidgetRenderProps["onStartCodexDirectWorkStream"];
  workspaceId?: string;
};

type RunWithCodexOptions = {
  startNewThread?: boolean;
};

export function useWorkspaceAgentDirectWorkController({
  draft,
  instanceId,
  isProviderPending,
  onAppendAssistantTranscript,
  onAppendOperatorTranscript,
  onCancelCodexDirectWorkRun,
  onClearDraft,
  onClearVisibleAttachedContext,
  onFocusComposer,
  onPublishAgentActivityEvents,
  onRemoveVisibleAttachedContext,
  onSearchKnowledgeDocuments,
  onStartCodexDirectWorkStream,
  workspaceId,
}: UseWorkspaceAgentDirectWorkControllerOptions) {
  const [directWorkDirectory, setDirectWorkDirectory] = useState("~");
  const [directWorkSandbox, setDirectWorkSandbox] =
    useState<DirectWorkSandbox>("workspace_write");
  const [directWorkStatus, setDirectWorkStatus] =
    useState<CoordinatorDirectWorkStatus>("idle");
  const [directWorkRunId, setDirectWorkRunId] = useState<string | null>(null);
  const [directWorkError, setDirectWorkError] = useState<string | null>(null);
  const [directWorkWarning, setDirectWorkWarning] = useState<string | null>(
    null,
  );
  const [directWorkFinalResult, setDirectWorkFinalResult] =
    useState<string | null>(null);
  const [currentCodexThread, setCurrentCodexThread] =
    useState<CodexThreadScope | null>(null);
  const [codexThreadNotice, setCodexThreadNotice] = useState<string | null>(
    null,
  );
  const [directWorkLogs, setDirectWorkLogs] = useState<
    CoordinatorDirectWorkLogEntry[]
  >([]);
  const [directWorkActivitySummary, setDirectWorkActivitySummary] =
    useState<WorkspaceAgentActivitySummary>(
      EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
    );
  const [workspaceKnowledgeLookup, setWorkspaceKnowledgeLookup] =
    useState<WorkspaceKnowledgeLookup>(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
  const [isDirectWorkStopPending, setIsDirectWorkStopPending] = useState(false);
  const directWorkStopListeningRef = useRef<(() => void) | null>(null);
  const directWorkStartAbortControllerRef = useRef<AbortController | null>(
    null,
  );
  const isMountedRef = useRef(false);
  const directWorkCompletedDuringStartRef = useRef(false);
  const directWorkFinalMessageRef = useRef<string | null>(null);
  const directWorkAccessDeniedRef = useRef(false);
  const directWorkCapturedThreadIdRef = useRef<string | null>(null);
  const directWorkActivitySummaryRef = useRef<WorkspaceAgentActivitySummary>(
    EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  );
  const directWorkTokenUsageRef = useRef<WorkspaceAgentRunTokenUsage | null>(
    null,
  );
  const directWorkRunScopeRef = useRef<ActiveDirectWorkRunScope | null>(null);
  const directWorkLogSequenceRef = useRef(0);
  const workspaceScopeId = workspaceId?.trim() || "__local_workspace__";
  const activeThreadId = codexThreadIdForScope(
    currentCodexThread,
    workspaceScopeId,
    instanceId,
    directWorkDirectory.trim(),
  );
  const isDirectModeEnabled = Boolean(onStartCodexDirectWorkStream);
  const canStartDirectWork =
    isDirectModeEnabled &&
    directWorkStatus !== "running" &&
    !isProviderPending &&
    draft.trim().length > 0;
  const canStopDirectWork =
    directWorkStatus === "running" &&
    Boolean(directWorkRunId) &&
    Boolean(onCancelCodexDirectWorkRun);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopDirectWorkEventListening();
    };
  }, []);

  async function handleRunWithCodex(options: RunWithCodexOptions = {}) {
    if (directWorkStatus === "running") {
      return;
    }

    const operatorPrompt = draft.trim();
    const repoRoot = directWorkDirectory.trim();

    if (!repoRoot) {
      recordDirectWorkLocalFailure(DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE);
      return;
    }

    if (!operatorPrompt) {
      recordDirectWorkLocalFailure(DIRECT_WORK_EMPTY_PROMPT_MESSAGE);
      return;
    }

    if (!onStartCodexDirectWorkStream) {
      recordDirectWorkLocalFailure(DIRECT_WORK_UNAVAILABLE_MESSAGE);
      return;
    }

    stopDirectWorkEventListening();
    directWorkCompletedDuringStartRef.current = false;
    directWorkFinalMessageRef.current = null;
    directWorkAccessDeniedRef.current = false;
    directWorkCapturedThreadIdRef.current = null;
    directWorkTokenUsageRef.current = null;
    directWorkRunScopeRef.current = {
      widgetInstanceId: instanceId,
      workingDirectory: repoRoot,
      workspaceId: workspaceScopeId,
    };
    const startNewThread = Boolean(options.startNewThread);
    const resumeThreadId = startNewThread
      ? null
      : codexThreadIdForScope(
          currentCodexThread,
          workspaceScopeId,
          instanceId,
          repoRoot,
        );
    if (startNewThread && currentCodexThread) {
      setCurrentCodexThread(null);
      setCodexThreadNotice("Starting a new Codex thread.");
      setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    }
    if (currentCodexThread && !resumeThreadId) {
      setCurrentCodexThread(null);
    }
    directWorkStartAbortControllerRef.current?.abort();
    const startAbortController = new AbortController();
    directWorkStartAbortControllerRef.current = startAbortController;
    const knowledgeLookup =
      await searchWorkspaceKnowledgeForDirectWork(operatorPrompt);

    if (!isMountedRef.current || startAbortController.signal.aborted) {
      return;
    }

    const promptForCodex =
      knowledgeLookup.results.length > 0
        ? codexPromptWithWorkspaceKnowledge(operatorPrompt, knowledgeLookup.results)
        : operatorPrompt;
    const threadStartText = resumeThreadId
      ? `Continuing Codex thread ${shortCodexThreadId(resumeThreadId)}.`
      : "Starting new Codex thread.";
    onAppendOperatorTranscript(operatorPrompt);
    onClearDraft();
    onClearVisibleAttachedContext();
    setDirectWorkStatus("running");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    updateDirectWorkActivitySummary(
      workspaceAgentActivitySummaryForLocalStart(
        resumeThreadId ? "Starting agent turn" : "Starting Codex thread",
      ),
    );
    setDirectWorkLogs([
      {
        id: "direct-local-starting",
        kind: "local",
        text: `${threadStartText} ${workspaceKnowledgeLogText(
          knowledgeLookup,
        )} Starting Codex Direct Work from ${repoRoot}.`,
      },
    ]);

    try {
      const session = await onStartCodexDirectWorkStream(
        instanceId,
        {
          approvalPolicy: "never",
          codexExecutable: defaultCoordinatorCodexExecutable(),
          codexThreadId: resumeThreadId,
          operatorPrompt: promptForCodex,
          repoRoot,
          sandbox: directWorkSandbox,
          skipGitRepoCheck: true,
          stderrCapBytes: null,
          stdoutCapBytes: null,
          timeoutMs: null,
        },
        recordDirectWorkEvent,
        startAbortController.signal,
      );

      if (!isMountedRef.current || startAbortController.signal.aborted) {
        session?.stopListening();
        return;
      }

      if (!session) {
        throw new Error(
          "Workspace Agent Direct Work was not accepted for this widget.",
        );
      }

      if (directWorkCompletedDuringStartRef.current) {
        session.stopListening();
      } else {
        directWorkStopListeningRef.current = session.stopListening;
        setDirectWorkRunId(session.runId);
        appendDirectWorkLog(
          `Direct Work run ${session.runId} started.`,
          "local",
        );
      }
    } catch (error) {
      if (!isMountedRef.current || startAbortController.signal.aborted) {
        return;
      }

      const message = errorToMessage(error, "Unable to start Direct Work.");
      stopDirectWorkEventListening();
      setDirectWorkStatus("failed");
      setDirectWorkError(message);
      setDirectWorkWarning(null);
      setDirectWorkActivitySummary((currentSummary) => {
        const nextSummary = workspaceAgentActivitySummaryForLocalFailure(
          currentSummary,
          message,
        );
        directWorkActivitySummaryRef.current = nextSummary;
        return nextSummary;
      });
      appendDirectWorkLog(message, "local");
      onAppendAssistantTranscript("failed", message);
    } finally {
      if (directWorkStartAbortControllerRef.current === startAbortController) {
        directWorkStartAbortControllerRef.current = null;
      }
      if (isMountedRef.current && !startAbortController.signal.aborted) {
        onFocusComposer();
      }
    }
  }

  async function handleStopDirectWork() {
    if (
      !directWorkRunId ||
      !onCancelCodexDirectWorkRun ||
      isDirectWorkStopPending
    ) {
      return;
    }

    setIsDirectWorkStopPending(true);
    appendDirectWorkLog("Stop requested.", "local");

    try {
      const response = await onCancelCodexDirectWorkRun(
        instanceId,
        directWorkRunId,
      );

      if (!response) {
        throw new Error("Stop command returned no response.");
      }

      appendDirectWorkLog(response.message, "local");
    } catch (error) {
      const message = errorToMessage(error, "Unable to stop Direct Work.");
      setDirectWorkError(message);
      appendDirectWorkLog(message, "local");
    } finally {
      setIsDirectWorkStopPending(false);
    }
  }

  function handleNewThread() {
    setCurrentCodexThread(null);
    setCodexThreadNotice("Codex thread reset.");
    setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    onRemoveVisibleAttachedContext();
    appendDirectWorkLog("Codex thread reset.", "local");
  }

  function handleWorkingDirectoryChange(value: string) {
    setDirectWorkDirectory(value);
    if (value !== directWorkDirectory && activeThreadId) {
      setCurrentCodexThread(null);
      setCodexThreadNotice(
        "Working directory changed. Next Codex run starts a new thread.",
      );
      setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
      appendDirectWorkLog(
        "Working directory changed. Next Codex run starts a new thread.",
        "local",
      );
    }
  }

  function resetDirectWorkSession() {
    stopDirectWorkEventListening();
    directWorkCompletedDuringStartRef.current = false;
    directWorkFinalMessageRef.current = null;
    directWorkAccessDeniedRef.current = false;
    directWorkCapturedThreadIdRef.current = null;
    directWorkTokenUsageRef.current = null;
    directWorkRunScopeRef.current = null;
    directWorkLogSequenceRef.current = 0;
    setDirectWorkDirectory("~");
    setDirectWorkSandbox("workspace_write");
    setDirectWorkStatus("idle");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setCurrentCodexThread(null);
    setCodexThreadNotice(null);
    setDirectWorkLogs([]);
    updateDirectWorkActivitySummary(EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY);
    setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    setIsDirectWorkStopPending(false);
  }

  async function searchWorkspaceKnowledgeForDirectWork(
    operatorPrompt: string,
  ): Promise<WorkspaceKnowledgeLookup> {
    const query = operatorPrompt.trim();
    if (!query) {
      const lookup = { ...EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP, query };
      setWorkspaceKnowledgeLookup(lookup);
      return lookup;
    }

    if (!onSearchKnowledgeDocuments) {
      const lookup: WorkspaceKnowledgeLookup = {
        error: null,
        query,
        results: [],
        status: "unavailable",
      };
      setWorkspaceKnowledgeLookup(lookup);
      return lookup;
    }

    try {
      const results = await onSearchKnowledgeDocuments({ limit: 5, query });
      const lookup: WorkspaceKnowledgeLookup = {
        error: null,
        query,
        results,
        status: results.length > 0 ? "matched" : "checked",
      };
      setWorkspaceKnowledgeLookup(lookup);
      return lookup;
    } catch (error) {
      const lookup: WorkspaceKnowledgeLookup = {
        error: errorToMessage(error, "Knowledge search failed."),
        query,
        results: [],
        status: "failed",
      };
      setWorkspaceKnowledgeLookup(lookup);
      return lookup;
    }
  }

  function recordDirectWorkEvent(event: DirectWorkStreamEvent) {
    if (!directWorkEventBelongsToCurrentAgent(event, workspaceId, instanceId)) {
      return;
    }

    const activityEvent = agentActivityEventFromDirectWorkStreamEvent({
      event,
      sourceKind: "workspace-agent",
      sourceLabel: "Workspace Agent",
    });
    if (activityEvent) {
      onPublishAgentActivityEvents?.([activityEvent]);
    }
    const tokenUsage = tokenUsageFromDirectWorkStreamEvent(event);
    if (tokenUsage) {
      directWorkTokenUsageRef.current = tokenUsage;
    }

    if (directWorkEventHasAccessDenied(event)) {
      directWorkAccessDeniedRef.current = true;
    }

    if (event.codexThreadId) {
      const runScope = directWorkRunScopeRef.current ?? {
        widgetInstanceId: instanceId,
        workingDirectory: directWorkDirectory.trim(),
        workspaceId: workspaceScopeId,
      };
      directWorkCapturedThreadIdRef.current = event.codexThreadId;
      setCurrentCodexThread({
        ...runScope,
        threadId: event.codexThreadId,
      });
      setCodexThreadNotice(
        `Thread active: ${shortCodexThreadId(event.codexThreadId)}.`,
      );
    }

    if (event.eventKind === "final_message" && event.text) {
      directWorkFinalMessageRef.current = cappedPreviewText(
        event.text,
        RENDER_MEMORY_CAPS.transcriptMessageChars,
      );
    }

    const codexAgentMessage = codexAgentMessageFromEvent(event);
    if (codexAgentMessage) {
      directWorkFinalMessageRef.current = cappedPreviewText(
        codexAgentMessage,
        RENDER_MEMORY_CAPS.transcriptMessageChars,
      );
    }

    appendDirectWorkLog(
      directWorkEventText(event),
      event.eventKind,
    );

    if (!event.isFinal) {
      const nextSummary = workspaceAgentActivitySummaryFromEvent(
        directWorkActivitySummaryRef.current,
        event,
        {
          accessDeniedSeen: directWorkAccessDeniedRef.current,
        },
      );
      updateDirectWorkActivitySummary(nextSummary);
      return;
    }

    directWorkCompletedDuringStartRef.current = true;
    const finalStatus = coordinatorDirectWorkStatusFromEvent(event);
    const failureReason =
      finalStatus === "failed"
        ? directWorkFailureReason(event, directWorkAccessDeniedRef.current)
        : null;
    const failureWarning =
      finalStatus === "failed" &&
      directWorkFailureIsAccessDenied(event, directWorkAccessDeniedRef.current)
        ? DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING
        : null;
    const finalAgentMessage = directWorkFinalMessageRef.current;
    const finalResult = cappedPreviewText(
      finalAgentMessage ??
        event.text ??
        failureReason ??
        event.stderrPreview ??
        `Codex Direct Work ended with status ${event.finalStatus ?? finalStatus}.`,
      RENDER_MEMORY_CAPS.transcriptMessageChars,
    );

    setDirectWorkStatus(finalStatus);
    setDirectWorkRunId(null);
    setDirectWorkFinalResult(finalResult);
    setDirectWorkError(failureReason);
    setDirectWorkWarning(failureWarning);
    const finalActivitySummary = workspaceAgentActivitySummaryFromEvent(
      directWorkActivitySummaryRef.current,
      event,
      {
        accessDeniedSeen: directWorkAccessDeniedRef.current,
        failureReason,
      },
    );
    updateDirectWorkActivitySummary(finalActivitySummary);
    if (
      finalStatus === "completed" &&
      !directWorkCapturedThreadIdRef.current
    ) {
      setCurrentCodexThread(null);
      setCodexThreadNotice(CODEX_THREAD_NOT_AVAILABLE_MESSAGE);
      appendDirectWorkLog(CODEX_THREAD_NOT_AVAILABLE_MESSAGE, "local");
    }
    stopDirectWorkEventListening();

    onAppendAssistantTranscript(
      finalStatus,
      finalResult,
      Boolean(finalAgentMessage),
      {
        durationMs: event.elapsedMs >= 0 ? event.elapsedMs : null,
        status:
          finalStatus === "completed" || finalStatus === "cancelled"
            ? finalStatus
            : "failed",
        stepCount: finalActivitySummary.stepCount,
        threadId:
          directWorkCapturedThreadIdRef.current ?? event.codexThreadId ?? null,
        tokenUsage: directWorkTokenUsageRef.current,
      },
    );
    directWorkRunScopeRef.current = null;
  }

  function appendDirectWorkLog(
    text: string,
    kind: CoordinatorDirectWorkLogEntry["kind"],
  ) {
    const id = `direct-log-${++directWorkLogSequenceRef.current}`;
    setDirectWorkLogs((currentLogs) =>
      [
        ...currentLogs,
        {
          id,
          kind,
          text: cappedPreviewText(
            text,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          ),
        },
      ].slice(-6),
    );
  }

  function recordDirectWorkLocalFailure(reason: string) {
    setDirectWorkStatus("failed");
    setDirectWorkRunId(null);
    setDirectWorkError(reason);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setDirectWorkActivitySummary((currentSummary) => {
      const nextSummary = workspaceAgentActivitySummaryForLocalFailure(
        currentSummary,
        reason,
      );
      directWorkActivitySummaryRef.current = nextSummary;
      return nextSummary;
    });
    appendDirectWorkLog(reason, "local");
    onAppendAssistantTranscript("failed", reason);
  }

  function updateDirectWorkActivitySummary(
    summary: WorkspaceAgentActivitySummary,
  ) {
    directWorkActivitySummaryRef.current = summary;
    setDirectWorkActivitySummary(summary);
  }

  function stopDirectWorkEventListening() {
    directWorkStartAbortControllerRef.current?.abort();
    directWorkStartAbortControllerRef.current = null;
    directWorkStopListeningRef.current?.();
    directWorkStopListeningRef.current = null;
  }

  return {
    activeThreadId,
    canStartDirectWork,
    canStopDirectWork,
    directWorkActivitySummary,
    directWorkDirectory,
    directWorkError,
    directWorkFinalResult,
    directWorkLogs,
    directWorkRunId,
    directWorkSandbox,
    directWorkStatus,
    directWorkWarning,
    handleNewThread,
    handleRunWithCodex,
    handleStopDirectWork,
    handleWorkingDirectoryChange,
    handleSandboxChange: setDirectWorkSandbox,
    isDirectModeEnabled,
    isDirectWorkStopPending,
    resetDirectWorkSession,
    threadNotice: codexThreadNotice,
    workspaceKnowledgeLookup,
  };
}
