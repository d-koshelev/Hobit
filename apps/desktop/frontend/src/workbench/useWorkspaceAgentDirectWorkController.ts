import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { DirectWorkSandbox, DirectWorkStreamEvent } from "../workspace/types";
import { createWorkspaceAgentPromptWithCapabilityContext } from "./agents/context";
import {
  type HobitAgentActionRequest,
  type HobitAgentActionResult,
} from "./agents/broker";
import {
  CODEX_THREAD_NOT_AVAILABLE_MESSAGE,
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING,
  DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE,
  DIRECT_WORK_EMPTY_PROMPT_MESSAGE,
  DIRECT_WORK_UNAVAILABLE_MESSAGE,
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
  codexAgentMessageFromEvent,
  codexThreadIdForScope,
  coordinatorDirectWorkStatusFromEvent,
  defaultCoordinatorCodexExecutable,
  directWorkEventBelongsToCurrentAgent,
  directWorkEventHasAccessDenied,
  directWorkFailureIsAccessDenied,
  directWorkFailureReason,
  shortCodexThreadId,
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
import {
  createProductActionToolLoopGuardState,
  recordProductActionToolLoopAttempt,
  TYPED_PRODUCT_ACTION_UNAVAILABLE,
  type ProductActionToolLoopGuardState,
} from "./workspaceAgentProductActionGuards";
import { errorToMessage } from "./workspaceAgentProviderGuards";
import {
  tokenUsageFromDirectWorkStreamEvent,
  type WorkspaceAgentRunMetadata,
  type WorkspaceAgentRunTokenUsage,
} from "./workspaceAgentRunMetadata";
import {
  classifyAgentProtocolRuntimeOutput,
  createCodexAgentProvider,
  recordAgentActivity,
  runBrokerContinuationRuntime,
  workspaceAgentHobitActionResultMessage,
  type AgentProvider,
  type AgentProviderEvent,
  type AgentActivityRecorderResult,
  type BrokerContinuationRuntimeResult,
  type BrokerContinuationTurnIntent,
} from "./agentRuntime";
import type { WorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import {
  createWorkspaceAgentBrokerContinuationState,
  readWorkspaceAgentQueueAutonomyGrantFromText,
  WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
  type WorkspaceAgentBrokerPolicyDiagnostics,
  type WorkspaceAgentBrokerContinuationState,
  type WorkspaceAgentBrokerContinuationStopReason,
} from "./workspaceAgentBrokerContinuation";
import type { WidgetRenderProps } from "./types";

type UseWorkspaceAgentDirectWorkControllerOptions = {
  agentProvider?: AgentProvider;
  currentWorkspaceRoot?: string | null;
  draft: string;
  instanceId: string;
  isProviderPending: boolean;
  onAppendAssistantTranscript: (
    status: CoordinatorDirectWorkStatus,
    reason: string,
    useDirectBody?: boolean,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) => void;
  onAppendAssistantActionTranscript?: (
    body: string,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) => void;
  onAppendOperatorTranscript: (body: string) => void;
  onCancelCodexDirectWorkRun?: WidgetRenderProps["onCancelCodexDirectWorkRun"];
  onClearDraft: () => void;
  onClearVisibleAttachedContext: () => void;
  onFocusComposer: () => void;
  onInvokeHobitAgentActionRequest?: WorkspaceAgentHobitActionInvoker;
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
  agentProvider,
  currentWorkspaceRoot,
  draft,
  instanceId,
  isProviderPending,
  onAppendAssistantTranscript,
  onAppendAssistantActionTranscript,
  onAppendOperatorTranscript,
  onCancelCodexDirectWorkRun,
  onClearDraft,
  onClearVisibleAttachedContext,
  onFocusComposer,
  onInvokeHobitAgentActionRequest,
  onPublishAgentActivityEvents,
  onRemoveVisibleAttachedContext,
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
  const [directWorkStopNotice, setDirectWorkStopNotice] = useState<string | null>(
    null,
  );
  const [directWorkFinalResult, setDirectWorkFinalResult] =
    useState<string | null>(null);
  const [directWorkRunMetadata, setDirectWorkRunMetadata] =
    useState<WorkspaceAgentRunMetadata | null>(null);
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
  const productActionLoopGuardRef =
    useRef<ProductActionToolLoopGuardState | null>(null);
  const brokerContinuationStateRef =
    useRef<WorkspaceAgentBrokerContinuationState | null>(null);
  const activeBrokerContinuationChainIdRef = useRef<string | null>(null);
  const directWorkLogSequenceRef = useRef(0);
  const workspaceScopeId = workspaceId?.trim() || "__local_workspace__";
  const workspaceAgentProvider = useMemo(
    () =>
      agentProvider ??
      createCodexAgentProvider({
        cancelCodexDirectWorkRun: onCancelCodexDirectWorkRun,
        codexExecutable: defaultCoordinatorCodexExecutable(),
        startCodexDirectWorkStream: onStartCodexDirectWorkStream,
      }),
    [agentProvider, onCancelCodexDirectWorkRun, onStartCodexDirectWorkStream],
  );
  const hasAgentProviderRuntime = Boolean(
    agentProvider || onStartCodexDirectWorkStream,
  );
  const activeThreadId = codexThreadIdForScope(
    currentCodexThread,
    workspaceScopeId,
    instanceId,
    directWorkDirectory.trim(),
  );
  const isDirectModeEnabled = hasAgentProviderRuntime;
  const canStartDirectWork =
    isDirectModeEnabled &&
    directWorkStatus !== "running" &&
    !isProviderPending &&
    draft.trim().length > 0;
  const canStopDirectWork =
    directWorkStatus === "running" &&
    Boolean(directWorkRunId) &&
    Boolean(workspaceAgentProvider.cancelRun);

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

    if (!hasAgentProviderRuntime) {
      recordDirectWorkLocalFailure(DIRECT_WORK_UNAVAILABLE_MESSAGE);
      return;
    }

    const chainId = `workspace-agent-action-chain-${Date.now().toString()}`;
    const queueAutonomyGrantRead =
      readWorkspaceAgentQueueAutonomyGrantFromText(operatorPrompt);
    brokerContinuationStateRef.current =
      createWorkspaceAgentBrokerContinuationState({
        autonomyGrantRejectionReasons: queueAutonomyGrantRead.reasons,
        chainId,
        queueAutonomyGrant: queueAutonomyGrantRead.grant,
      });
    activeBrokerContinuationChainIdRef.current = null;
    await startDirectWorkTurn({
      appendOperatorTranscript: true,
      attachCapabilityContext: true,
      clearDraftAndVisibleContext: true,
      initialLocalNotice: queueAutonomyGrantNotice(queueAutonomyGrantRead),
      operatorPrompt,
      repoRoot,
      startNewThread: Boolean(options.startNewThread),
    });
  }

  async function startDirectWorkTurn({
    appendOperatorTranscript,
    attachCapabilityContext,
    brokerContinuationChainId = null,
    clearDraftAndVisibleContext,
    initialLocalNotice = null,
    operatorPrompt,
    repoRoot,
    resumeThreadIdOverride,
    startNewThread = false,
  }: {
    appendOperatorTranscript: boolean;
    attachCapabilityContext: boolean;
    brokerContinuationChainId?: string | null;
    clearDraftAndVisibleContext: boolean;
    initialLocalNotice?: string | null;
    operatorPrompt: string;
    repoRoot: string;
    resumeThreadIdOverride?: string | null;
    startNewThread?: boolean;
  }) {
    if (!hasAgentProviderRuntime) {
      if (brokerContinuationChainId) {
        recordBrokerContinuationStop({
          message:
            "Workspace Agent Direct Work is unavailable for broker continuation.",
          runMetadata: {
            durationMs: null,
            status: "failed",
            stepCount: 0,
            threadId: null,
            tokenUsage: null,
          },
          severity: "error",
          status: "failed",
          stopReason: "unavailable",
        });
        clearBrokerContinuationState();
        return;
      }

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
    productActionLoopGuardRef.current =
      createProductActionToolLoopGuardState(operatorPrompt);
    activeBrokerContinuationChainIdRef.current = brokerContinuationChainId;
    const resumeThreadId =
      resumeThreadIdOverride !== undefined
        ? resumeThreadIdOverride
        : startNewThread
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
    const providerThreadText = providerThreadLabel(workspaceAgentProvider);
    const threadStartText = resumeThreadId
      ? `Continuing ${providerThreadText} ${shortCodexThreadId(resumeThreadId)}.`
      : `Starting new ${providerThreadText}.`;
    const promptWithCapabilityContext = attachCapabilityContext
      ? createWorkspaceAgentPromptWithCapabilityContext({
          currentPrompt: operatorPrompt,
          widgetInstanceId: instanceId,
          workspaceId: workspaceScopeId,
          workspaceRoot: currentWorkspaceRoot?.trim() || repoRoot,
        })
      : operatorPrompt;
    if (appendOperatorTranscript) {
      onAppendOperatorTranscript(operatorPrompt);
    }
    if (clearDraftAndVisibleContext) {
      onClearDraft();
      onClearVisibleAttachedContext();
    }
    setDirectWorkStatus("running");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkStopNotice(null);
    setDirectWorkFinalResult(null);
    setDirectWorkRunMetadata(null);
    updateDirectWorkActivitySummary(
      workspaceAgentActivitySummaryForLocalStart(
        brokerContinuationChainId
          ? "Continuing broker action chain"
          : resumeThreadId
            ? "Starting agent turn"
            : "Starting Codex thread",
      ),
    );
    const contextLogText = attachCapabilityContext
      ? "Hobit capability context attached. Capability manifest attached. Knowledge is not searched automatically; only visible composer text plus capability instructions are sent."
      : "Compact Hobit action result context attached for same-thread continuation. No manual user turn was added.";
    setDirectWorkLogs([
      {
        id: "direct-local-starting",
        kind: "local",
        text: `${threadStartText} ${contextLogText} ${initialLocalNotice ? `${initialLocalNotice} ` : ""}Starting ${workspaceAgentProvider.providerDisplayName} from ${repoRoot}.`,
      },
    ]);

    try {
      const session = await workspaceAgentProvider.startTurn(
        {
          approvalPolicy: "never",
          createdAtMs: Date.now(),
          id: `workspace-agent-turn-${Date.now().toString()}`,
          mode: "direct",
          prompt: promptWithCapabilityContext,
          providerThreadId: resumeThreadId,
          sandbox: directWorkSandbox,
          widgetInstanceId: instanceId,
          workingDirectory: repoRoot,
          workspaceId: workspaceScopeId,
        },
        recordAgentProviderEvent,
        {
          signal: startAbortController.signal,
        },
      );
      if (!isMountedRef.current || startAbortController.signal.aborted) {
        session?.stopListening();
        return;
      }

      if (!session) {
        throw new Error(
          `${workspaceAgentProvider.providerDisplayName} was not accepted for this widget.`,
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
      productActionLoopGuardRef.current = null;
      clearBrokerContinuationState();
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
      !workspaceAgentProvider.cancelRun ||
      isDirectWorkStopPending
    ) {
      return;
    }

    setIsDirectWorkStopPending(true);
    setDirectWorkStopNotice("Stop requested.");
    appendDirectWorkLog("Stop requested.", "local");

    try {
      const response = await workspaceAgentProvider.cancelRun(
        instanceId,
        directWorkRunId,
      );

      if (!response) {
        throw new Error("Stop command returned no response.");
      }

      setDirectWorkStopNotice(response.message);
      appendDirectWorkLog(response.message, "local");
    } catch (error) {
      const message = errorToMessage(error, "Unable to stop Direct Work.");
      setDirectWorkError(message);
      setDirectWorkStopNotice(null);
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
    setDirectWorkStopNotice(null);
    setDirectWorkFinalResult(null);
    setDirectWorkRunMetadata(null);
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
    productActionLoopGuardRef.current = null;
    brokerContinuationStateRef.current = null;
    activeBrokerContinuationChainIdRef.current = null;
    directWorkLogSequenceRef.current = 0;
    setDirectWorkDirectory("~");
    setDirectWorkSandbox("workspace_write");
    setDirectWorkStatus("idle");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkStopNotice(null);
    setDirectWorkFinalResult(null);
    setDirectWorkRunMetadata(null);
    setCurrentCodexThread(null);
    setCodexThreadNotice(null);
    setDirectWorkLogs([]);
    updateDirectWorkActivitySummary(EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY);
    setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    setIsDirectWorkStopPending(false);
  }

  function recordAgentProviderEvent(event: AgentProviderEvent) {
    const directWorkEvent = directWorkStreamEventFromAgentProviderEvent(event);
    if (!directWorkEvent) {
      return;
    }

    recordDirectWorkEvent(directWorkEvent);
  }

  function directWorkStreamEventFromAgentProviderEvent(
    event: AgentProviderEvent,
  ): DirectWorkStreamEvent | null {
    if (event.rawDirectWorkEvent) {
      return event.rawDirectWorkEvent;
    }

    const runScope = directWorkRunScopeRef.current ?? {
      widgetInstanceId: instanceId,
      workingDirectory: directWorkDirectory.trim(),
      workspaceId: workspaceScopeId,
    };
    const base = {
      codexThreadId: event.providerThreadId ?? null,
      elapsedMs: 0,
      errorMessage: null,
      exitCode: null,
      failedStage: null,
      finalStatus: null,
      isFinal: false,
      line: null,
      parsedCodexEventType: null,
      runId: event.runId,
      status: null,
      stderrPreview: null,
      text: null,
      widgetInstanceId: runScope.widgetInstanceId,
      workbenchId: "workspace-agent-provider",
      workspaceId: runScope.workspaceId,
    } satisfies Omit<DirectWorkStreamEvent, "eventKind">;

    if (event.type === "run_started") {
      return {
        ...base,
        eventKind: "started",
        status: "running",
      };
    }

    if (
      event.type === "text_delta" ||
      event.type === "message_delta" ||
      event.type === "structured_output" ||
      event.type === "action_request_detected" ||
      event.type === "workflow_request_detected" ||
      event.type === "final_answer"
    ) {
      return {
        ...base,
        eventKind: event.type === "text_delta" ? "stdout_line" : "final_message",
        line: event.type === "text_delta" ? event.text : null,
        text: event.text,
      };
    }

    if (event.type === "error") {
      return {
        ...base,
        errorMessage: event.errorMessage,
        eventKind: "failed",
        finalStatus: "failed",
        isFinal: true,
        status: "failed",
        text: event.errorMessage,
      };
    }

    if (event.type === "cancelled" || event.type === "stopped") {
      return {
        ...base,
        eventKind: "cancelled",
        finalStatus: "cancelled",
        isFinal: true,
        status: "cancelled",
        text: event.message ?? `${workspaceAgentProvider.providerDisplayName} stopped.`,
      };
    }

    if (event.type === "run_finished") {
      return {
        ...base,
        elapsedMs: event.elapsedMs ?? 0,
        eventKind: event.status,
        finalStatus: event.status,
        isFinal: true,
        status: event.status,
        text: event.finalMessage ?? null,
      };
    }

    return null;
  }

  function recordDirectWorkEvent(event: DirectWorkStreamEvent) {
    if (!directWorkEventBelongsToCurrentAgent(event, workspaceId, instanceId)) {
      return;
    }

    const productActionLoopResult = productActionLoopGuardRef.current
      ? recordProductActionToolLoopAttempt(
          productActionLoopGuardRef.current,
          event,
        )
      : null;
    if (productActionLoopResult?.shouldStop) {
      void onCancelCodexDirectWorkRun?.(instanceId, event.runId);
      stopDirectWorkEventListening();
      setDirectWorkStatus("failed");
      setDirectWorkRunId(null);
      setDirectWorkError(productActionLoopResult.message);
      setDirectWorkWarning(null);
      setDirectWorkStopNotice(null);
      setDirectWorkFinalResult(null);
      setDirectWorkRunMetadata(null);
      updateDirectWorkActivitySummary(
        workspaceAgentActivitySummaryForLocalFailure(
          directWorkActivitySummaryRef.current,
          TYPED_PRODUCT_ACTION_UNAVAILABLE,
        ),
      );
      appendDirectWorkLog(productActionLoopResult.message, "local");
      onAppendAssistantTranscript("failed", productActionLoopResult.message);
      directWorkRunScopeRef.current = null;
      productActionLoopGuardRef.current = null;
      clearBrokerContinuationState();
      return;
    }

    applyAgentActivityRecorderResult(
      recordAgentActivity({
        event: {
          brokerContinuationChainId:
            activeBrokerContinuationChainIdRef.current,
          streamEvent: event,
          type: "provider_stream_event",
        },
        timestampMs: Date.now(),
        widgetInstanceId: instanceId,
        workspaceId: workspaceScopeId,
      }),
    );
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
    setDirectWorkStopNotice(null);
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

    const runMetadata: WorkspaceAgentRunMetadata = {
      durationMs: event.elapsedMs >= 0 ? event.elapsedMs : null,
      status:
        finalStatus === "completed" || finalStatus === "cancelled"
          ? finalStatus
          : "failed",
      stepCount: finalActivitySummary.stepCount,
      threadId:
        directWorkCapturedThreadIdRef.current ?? event.codexThreadId ?? null,
      tokenUsage: directWorkTokenUsageRef.current,
    };
    setDirectWorkRunMetadata(runMetadata);

    if (
      handleFinalHobitActionRequest({
        finalAgentMessage,
        finalResult,
        finalStatus,
        runId: event.runId,
        runMetadata,
      })
    ) {
      directWorkRunScopeRef.current = null;
      productActionLoopGuardRef.current = null;
      return;
    }

    onAppendAssistantTranscript(
      finalStatus,
      finalResult,
      Boolean(finalAgentMessage),
      runMetadata,
    );
    directWorkRunScopeRef.current = null;
    productActionLoopGuardRef.current = null;
  }

  function handleFinalHobitActionRequest({
    finalAgentMessage,
    finalResult,
    finalStatus,
    runId,
    runMetadata,
  }: {
    finalAgentMessage: string | null;
    finalResult: string;
    finalStatus: CoordinatorDirectWorkStatus;
    runId: string;
    runMetadata: WorkspaceAgentRunMetadata;
  }) {
    if (finalStatus !== "completed") {
      return false;
    }

    const protocolOutcome = classifyAgentProtocolRuntimeOutput({
      mode: brokerContinuationStateRef.current
        ? "typed_capability_action"
        : "normal",
      text: finalAgentMessage ?? finalResult,
    });

    return applyBrokerContinuationRuntimeResult({
      runId,
      runMetadata,
      runtimeResult: runBrokerContinuationRuntime({
        activeChainId: activeBrokerContinuationChainIdRef.current,
        agentId: `workspace-agent:${instanceId}`,
        continuationThreadId: brokerContinuationThreadId(runMetadata),
        createdAt: new Date().toISOString(),
        derivedChainId: `workspace-agent-action-chain-${runId}`,
        kind: "provider_protocol_result",
        protocolOutcome,
        state: brokerContinuationStateRef.current,
      }),
    });
  }

  function applyBrokerContinuationRuntimeResult({
    runId,
    runMetadata,
    runtimeResult,
  }: {
    runId: string;
    runMetadata: WorkspaceAgentRunMetadata;
    runtimeResult: BrokerContinuationRuntimeResult;
  }) {
    if (!runtimeResult.handled) {
      return false;
    }

    for (const effect of runtimeResult.effects) {
      if (effect.type === "complete") {
        if (
          effect.completionKind === "final_answer" &&
          effect.stopReason &&
          effect.chainId
        ) {
          recordBrokerContinuationStop({
            chainId: effect.chainId,
            message: "Workspace Agent completed the action chain.",
            runMetadata,
            severity: "success",
            status: "completed",
            stopReason: effect.stopReason,
          });
        }

        if (effect.completionKind === "final_answer") {
          applyAgentActivityRecorderResult(
            recordAgentActivity({
              event: {
                finalAnswer: effect.finalAnswer,
                runId,
                runMetadata,
                type: "provider_final_answer",
              },
              timestampMs: Date.now(),
              widgetInstanceId: instanceId,
              workspaceId: workspaceScopeId,
            }),
          );
        } else {
          applyAgentActivityRecorderResult(
            recordAgentActivity({
              event: {
                runId: effect.chainId ?? runId,
                runMetadata,
                type: "workflow_request_recognized",
                workflowRequestRead:
                  effect.protocolOutcome.workflowRequestRead,
              },
              timestampMs: Date.now(),
              widgetInstanceId: instanceId,
              workspaceId: workspaceScopeId,
            }),
          );
        }
        continue;
      }

      if (effect.type === "queue_structured_confirmation_injected") {
        appendDirectWorkLog(effect.message, "local");
        continue;
      }

      if (effect.type === "record_broker_action_result") {
        recordHobitActionResultTranscript({
          activityRunId: effect.activityRunId,
          actionIndex: effect.actionIndex,
          capabilityId: effect.capabilityId,
          message: effect.message,
          policyDiagnostics: effect.policyDiagnostics,
          result: effect.result,
          runMetadata,
          stopReason: effect.stopReason,
        });
        continue;
      }

      if (effect.type === "invoke_next_action") {
        brokerContinuationStateRef.current = effect.state;
        applyAgentActivityRecorderResult(
          recordAgentActivity({
            event: {
              actionIndex: effect.intent.actionIndex,
              capabilityId: effect.intent.request.capabilityId,
              maxActions: effect.state.maxActions,
              runId: effect.state.chainId,
              type: "broker_action_requested",
            },
            timestampMs: Date.now(),
            widgetInstanceId: instanceId,
            workspaceId: workspaceScopeId,
          }),
        );

        if (!onInvokeHobitAgentActionRequest) {
          recordHobitActionResultTranscript({
            activityRunId: effect.state.chainId,
            actionIndex: effect.intent.actionIndex,
            capabilityId: effect.intent.request.capabilityId,
            message:
              "Action unavailable. Workspace Agent Action Broker is unavailable.",
            runMetadata,
            severity: "warning",
            status: "failed",
            stopReason: "broker_unavailable",
            title: "Action unavailable",
          });
          clearBrokerContinuationState();
          continue;
        }

        void invokeWorkspaceAgentHobitActionRequest({
          actionIndex: effect.intent.actionIndex,
          confirmationInjected: effect.intent.confirmationInjected,
          request: effect.intent.request,
          runMetadata,
        });
        continue;
      }

      if (effect.type === "request_repair_turn") {
        brokerContinuationStateRef.current = effect.state;
        applyAgentActivityRecorderResult(
          recordAgentActivity({
            event: {
              outcome: effect.outcome,
              runId: effect.state.chainId,
              runMetadata,
              type: "protocol_repair_required",
            },
            timestampMs: Date.now(),
            widgetInstanceId: instanceId,
            workspaceId: workspaceScopeId,
          }),
        );
        void startBrokerProtocolRepairTurn(effect.intent);
        continue;
      }

      if (effect.type === "request_continuation_turn") {
        brokerContinuationStateRef.current = effect.state;
        void startBrokerContinuationTurn(effect.intent);
        continue;
      }

      if (effect.type === "stop") {
        setDirectWorkStatus("failed");
        if (effect.protocolOutcome?.kind === "invalid_action_request") {
          applyAgentActivityRecorderResult(
            recordAgentActivity({
              event: {
                actionIndex: effect.actionIndex,
                reasons: effect.protocolOutcome.actionRequestRead.reasons,
                runId: effect.chainId,
                runMetadata,
                type: "invalid_action_request",
              },
              timestampMs: Date.now(),
              widgetInstanceId: instanceId,
              workspaceId: workspaceScopeId,
            }),
          );
        } else if (
          effect.protocolOutcome?.kind === "invalid_workflow_request" ||
          effect.protocolOutcome?.kind === "mixed_action_and_workflow_request"
        ) {
          applyAgentActivityRecorderResult(
            recordAgentActivity({
              event: {
                actionIndex: effect.actionIndex,
                reasons: effect.protocolOutcome.workflowRequestRead.reasons,
                runId: effect.chainId,
                runMetadata,
                type: effect.protocolOutcome.kind,
              },
              timestampMs: Date.now(),
              widgetInstanceId: instanceId,
              workspaceId: workspaceScopeId,
            }),
          );
        } else if (
          effect.protocolOutcome?.kind === "protocol_stall" ||
          effect.protocolOutcome?.kind === "no_action_output"
        ) {
          applyAgentActivityRecorderResult(
            recordAgentActivity({
              event: {
                outcome: effect.protocolOutcome,
                runId: effect.chainId,
                runMetadata,
                type: "protocol_error",
              },
              timestampMs: Date.now(),
              widgetInstanceId: instanceId,
              workspaceId: workspaceScopeId,
            }),
          );
        } else if (effect.message) {
          recordHobitActionResultTranscript({
            activityRunId: effect.chainId,
            actionIndex: effect.actionIndex,
            capabilityId: effect.capabilityId,
            message: effect.message,
            runMetadata,
            severity: "warning",
            status: "failed",
            stopReason: effect.stopReason,
            title: effect.title,
          });
        }

        if (effect.logMessage) {
          appendDirectWorkLog(effect.logMessage, "local");
        }
      }
    }

    if (runtimeResult.nextState === null) {
      clearBrokerContinuationState();
    }

    return true;
  }

  async function invokeWorkspaceAgentHobitActionRequest({
    actionIndex,
    confirmationInjected,
    request,
    runMetadata,
  }: {
    actionIndex: number;
    confirmationInjected: boolean;
    request: HobitAgentActionRequest;
    runMetadata: WorkspaceAgentRunMetadata;
  }) {
    try {
      const brokerResult = await onInvokeHobitAgentActionRequest?.(request);
      if (!brokerResult || !isMountedRef.current) {
        return;
      }

      const message = workspaceAgentHobitActionResultMessage(
        brokerResult.result,
      );
      applyBrokerContinuationRuntimeResult({
        runId: request.requestId,
        runMetadata,
        runtimeResult: runBrokerContinuationRuntime({
          actionIndex,
          brokerResult,
          confirmationInjected,
          continuationThreadId: brokerContinuationThreadId(runMetadata),
          kind: "broker_action_result",
          message,
          request,
          state: brokerContinuationStateRef.current,
        }),
      });
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = errorToMessage(error, "Hobit action failed.");
      const state = brokerContinuationStateRef.current;
      recordHobitActionResultTranscript({
        activityRunId: state?.chainId ?? request.requestId,
        actionIndex,
        capabilityId: request.capabilityId,
        message,
        runMetadata,
        severity: "error",
        status: "failed",
        stopReason: "failed",
        title: "Hobit action failed",
      });
      clearBrokerContinuationState();
    }
  }

  async function startBrokerContinuationTurn(intent: BrokerContinuationTurnIntent) {
    await startDirectWorkTurn({
      appendOperatorTranscript: false,
      attachCapabilityContext: false,
      brokerContinuationChainId: intent.chainId,
      clearDraftAndVisibleContext: false,
      operatorPrompt: intent.prompt,
      repoRoot: directWorkDirectory.trim(),
      resumeThreadIdOverride: intent.resumeThreadId,
    });
  }

  async function startBrokerProtocolRepairTurn(intent: BrokerContinuationTurnIntent) {
    await startDirectWorkTurn({
      appendOperatorTranscript: false,
      attachCapabilityContext: false,
      brokerContinuationChainId: intent.chainId,
      clearDraftAndVisibleContext: false,
      operatorPrompt: intent.prompt,
      repoRoot: directWorkDirectory.trim(),
      resumeThreadIdOverride: intent.resumeThreadId,
    });
  }

  function brokerContinuationThreadId(runMetadata: WorkspaceAgentRunMetadata) {
    return (
      runMetadata.threadId ??
      directWorkCapturedThreadIdRef.current ??
      codexThreadIdForScope(
        currentCodexThread,
        workspaceScopeId,
        instanceId,
        directWorkDirectory.trim(),
      )
    );
  }

  function queueAutonomyGrantNotice(
    readResult: ReturnType<typeof readWorkspaceAgentQueueAutonomyGrantFromText>,
  ) {
    if (readResult.status === "valid") {
      return `Structured Queue autonomy grant active: ${readResult.grant.mode}.`;
    }

    if (readResult.status === "invalid") {
      return `Queue autonomy grant ignored: ${readResult.reasons.join(" ")}`;
    }

    return null;
  }

  function recordHobitActionResultTranscript({
    actionIndex,
    activityRunId,
    capabilityId,
    message,
    policyDiagnostics,
    result,
    runMetadata,
    severity,
    status,
    stopReason,
    title,
  }: {
    actionIndex?: number;
    activityRunId: string;
    capabilityId?: string;
    message: string;
    policyDiagnostics?: WorkspaceAgentBrokerPolicyDiagnostics;
    result?: HobitAgentActionResult;
    runMetadata: WorkspaceAgentRunMetadata;
    severity?: AgentActivityRecorderResult["activityAppends"][number]["severity"];
    status?: AgentActivityRecorderResult["activityAppends"][number]["status"];
    stopReason?: WorkspaceAgentBrokerContinuationStopReason;
    title?: string;
  }) {
    applyAgentActivityRecorderResult(
      recordAgentActivity({
        event: {
          actionIndex,
          activityRunId,
          capabilityId,
          maxActions:
            brokerContinuationStateRef.current?.maxActions ??
            WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
          message,
          policyDiagnostics,
          result,
          runMetadata,
          severity,
          status,
          stopReason,
          title,
          type: "broker_action_result",
        },
        timestampMs: Date.now(),
        widgetInstanceId: instanceId,
        workspaceId: workspaceScopeId,
      }),
    );
  }

  function appendAssistantActionTranscript(
    body: string,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) {
    if (onAppendAssistantActionTranscript) {
      onAppendAssistantActionTranscript(body, runMetadata);
      return;
    }

    onAppendAssistantTranscript("completed", body, true, runMetadata);
  }

  function recordBrokerContinuationStop({
    chainId,
    message,
    runMetadata,
    severity,
    status,
    stopReason,
  }: {
    chainId?: string;
    message: string;
    runMetadata: WorkspaceAgentRunMetadata;
    severity: AgentActivityRecorderResult["activityAppends"][number]["severity"];
    status: AgentActivityRecorderResult["activityAppends"][number]["status"];
    stopReason: WorkspaceAgentBrokerContinuationStopReason;
  }) {
    const state = brokerContinuationStateRef.current;
    const runId = chainId ?? state?.chainId ?? null;
    if (!runId) {
      return;
    }

    applyAgentActivityRecorderResult(
      recordAgentActivity({
        event: {
          message,
          runId,
          runMetadata,
          severity,
          status,
          stopReason,
          type: "broker_continuation_stopped",
        },
        timestampMs: Date.now(),
        widgetInstanceId: instanceId,
        workspaceId: workspaceScopeId,
      }),
    );
  }

  function clearBrokerContinuationState() {
    brokerContinuationStateRef.current = null;
    activeBrokerContinuationChainIdRef.current = null;
  }

  function applyAgentActivityRecorderResult(
    recorderResult: AgentActivityRecorderResult,
  ) {
    for (const notice of recorderResult.notices) {
      if (notice.kind === "direct_work_error") {
        setDirectWorkError(notice.value);
      } else if (notice.kind === "direct_work_final_result") {
        setDirectWorkFinalResult(notice.value);
      }
    }

    for (const logAppend of recorderResult.logAppends) {
      appendDirectWorkLog(logAppend.text, logAppend.kind);
    }

    if (recorderResult.activityAppends.length > 0) {
      onPublishAgentActivityEvents?.(recorderResult.activityAppends);
    }

    for (const transcriptAppend of recorderResult.transcriptAppends) {
      if (transcriptAppend.kind === "assistant_action") {
        appendAssistantActionTranscript(
          transcriptAppend.body,
          transcriptAppend.runMetadata,
        );
      } else {
        onAppendAssistantTranscript(
          transcriptAppend.status,
          transcriptAppend.body,
          transcriptAppend.useDirectBody,
          transcriptAppend.runMetadata,
        );
      }
    }
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
    setDirectWorkStopNotice(null);
    setDirectWorkFinalResult(null);
    setDirectWorkRunMetadata(null);
    setDirectWorkActivitySummary((currentSummary) => {
      const nextSummary = workspaceAgentActivitySummaryForLocalFailure(
        currentSummary,
        reason,
      );
      directWorkActivitySummaryRef.current = nextSummary;
      return nextSummary;
    });
    productActionLoopGuardRef.current = null;
    clearBrokerContinuationState();
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
    directWorkRunMetadata,
    directWorkSandbox,
    directWorkStatus,
    directWorkStopNotice,
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

function providerThreadLabel(provider: AgentProvider) {
  return provider.providerId === "codex-direct-work"
    ? "Codex thread"
    : `${provider.providerDisplayName} thread`;
}
