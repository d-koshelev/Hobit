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
import { createWorkspaceAgentPromptWithCapabilityContext } from "./agents/context";
import {
  createHobitAgentActionRequestFromEnvelope,
  readHobitAgentActionRequestEnvelope,
  type HobitAgentActionRequest,
  type HobitAgentActionResult,
} from "./agents/broker";
import { agentActivityEventFromDirectWorkStreamEvent } from "./agentActivityModel";
import type {
  AgentActivityEvent,
  AgentActivitySeverity,
  AgentActivityStatus,
} from "./agentActivityModel";
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
  directWorkEventText,
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
  workspaceAgentHobitActionActivityTitle,
  workspaceAgentHobitActionResultMessage,
  workspaceAgentInvalidActionRequestMessage,
  type WorkspaceAgentHobitActionInvoker,
} from "./workspaceAgentBrokerActionRuntime";
import type { WidgetRenderProps } from "./types";

type UseWorkspaceAgentDirectWorkControllerOptions = {
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
    productActionLoopGuardRef.current =
      createProductActionToolLoopGuardState(operatorPrompt);
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
    const threadStartText = resumeThreadId
      ? `Continuing Codex thread ${shortCodexThreadId(resumeThreadId)}.`
      : "Starting new Codex thread.";
    const promptWithCapabilityContext =
      createWorkspaceAgentPromptWithCapabilityContext({
        currentPrompt: operatorPrompt,
        widgetInstanceId: instanceId,
        workspaceId: workspaceScopeId,
        workspaceRoot: currentWorkspaceRoot?.trim() || repoRoot,
      });
    onAppendOperatorTranscript(operatorPrompt);
    onClearDraft();
    onClearVisibleAttachedContext();
    setDirectWorkStatus("running");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkStopNotice(null);
    setDirectWorkFinalResult(null);
    setDirectWorkRunMetadata(null);
    updateDirectWorkActivitySummary(
      workspaceAgentActivitySummaryForLocalStart(
        resumeThreadId ? "Starting agent turn" : "Starting Codex thread",
      ),
    );
    setDirectWorkLogs([
      {
        id: "direct-local-starting",
        kind: "local",
        text: `${threadStartText} Hobit capability context attached. Capability manifest attached. Knowledge is not searched automatically; only visible composer text plus capability instructions are sent. Starting Codex Direct Work from ${repoRoot}.`,
      },
    ]);

    try {
      const session = await onStartCodexDirectWorkStream(
        instanceId,
        {
          approvalPolicy: "never",
          codexExecutable: defaultCoordinatorCodexExecutable(),
          codexThreadId: resumeThreadId,
          operatorPrompt: promptWithCapabilityContext,
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
      productActionLoopGuardRef.current = null;
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
    setDirectWorkStopNotice("Stop requested.");
    appendDirectWorkLog("Stop requested.", "local");

    try {
      const response = await onCancelCodexDirectWorkRun(
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

    const envelopeRead = readHobitAgentActionRequestEnvelope(
      finalAgentMessage ?? finalResult,
    );

    if (envelopeRead.status === "none") {
      return false;
    }

    if (envelopeRead.status === "invalid") {
      const message = workspaceAgentInvalidActionRequestMessage(
        envelopeRead.reasons,
      );
      recordHobitActionResultTranscript({
        activityRunId: runId,
        message,
        runMetadata,
        severity: "error",
        status: "failed",
        title: "Invalid Hobit action request",
      });
      return true;
    }

    const actionRequest = createHobitAgentActionRequestFromEnvelope({
      agentId: `workspace-agent:${instanceId}`,
      createdAt: new Date().toISOString(),
      envelope: envelopeRead.envelope,
    });
    publishHobitActionActivityEvent({
      runId: actionRequest.requestId,
      severity: "info",
      status: "running",
      summary: actionRequest.reason ?? actionRequest.capabilityId,
      title: "Hobit action requested",
    });
    setDirectWorkFinalResult("Hobit action requested.");
    appendDirectWorkLog("Hobit action requested.", "local");

    if (!onInvokeHobitAgentActionRequest) {
      recordHobitActionResultTranscript({
        activityRunId: actionRequest.requestId,
        message:
          "Action unavailable. Workspace Agent Action Broker is unavailable.",
        runMetadata,
        severity: "warning",
        status: "failed",
        title: "Action unavailable",
      });
      return true;
    }

    void invokeWorkspaceAgentHobitActionRequest(actionRequest, runMetadata);
    return true;
  }

  async function invokeWorkspaceAgentHobitActionRequest(
    request: HobitAgentActionRequest,
    runMetadata: WorkspaceAgentRunMetadata,
  ) {
    try {
      const brokerResult = await onInvokeHobitAgentActionRequest?.(request);
      if (!brokerResult || !isMountedRef.current) {
        return;
      }

      const message = workspaceAgentHobitActionResultMessage(
        brokerResult.result,
      );
      recordHobitActionResultTranscript({
        activityRunId: request.requestId,
        message,
        result: brokerResult.result,
        runMetadata,
      });
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = errorToMessage(error, "Hobit action failed.");
      recordHobitActionResultTranscript({
        activityRunId: request.requestId,
        message,
        runMetadata,
        severity: "error",
        status: "failed",
        title: "Hobit action failed",
      });
    }
  }

  function recordHobitActionResultTranscript({
    activityRunId,
    message,
    result,
    runMetadata,
    severity,
    status,
    title,
  }: {
    activityRunId: string;
    message: string;
    result?: HobitAgentActionResult;
    runMetadata: WorkspaceAgentRunMetadata;
    severity?: AgentActivitySeverity;
    status?: AgentActivityStatus;
    title?: string;
  }) {
    setDirectWorkFinalResult(message);
    appendDirectWorkLog(message, "local");
    publishHobitActionActivityEvent({
      runId: activityRunId,
      severity: severity ?? activitySeverityForHobitActionResult(result),
      status: status ?? activityStatusForHobitActionResult(result),
      summary: message,
      title:
        title ??
        workspaceAgentHobitActionActivityTitle(
          result?.status ?? "failed",
          result?.capabilityId,
          result?.dryRun ?? false,
        ),
    });
    appendAssistantActionTranscript(message, runMetadata);
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

  function publishHobitActionActivityEvent({
    runId,
    severity,
    status,
    summary,
    title,
  }: {
    runId: string;
    severity: AgentActivitySeverity;
    status: AgentActivityStatus;
    summary?: string;
    title: string;
  }) {
    const event: AgentActivityEvent = {
      id: `${workspaceScopeId}:${instanceId}:hobit-action:${runId}:${status}:${title}`,
      runId,
      severity,
      sourceKind: "workspace-agent",
      sourceLabel: "Workspace Agent",
      sourceWidgetInstanceId: instanceId,
      status,
      summary,
      timestamp: Date.now(),
      timestampLabel: "0s",
      title,
      workspaceId: workspaceScopeId,
    };

    onPublishAgentActivityEvents?.([event]);
  }

  function activityStatusForHobitActionResult(
    result: HobitAgentActionResult | undefined,
  ): AgentActivityStatus {
    if (!result) {
      return "failed";
    }

    if (result.status === "succeeded") {
      return "completed";
    }

    if (
      result.status === "needs_confirmation" ||
      result.status === "dry_run_required"
    ) {
      return "pending";
    }

    return "failed";
  }

  function activitySeverityForHobitActionResult(
    result: HobitAgentActionResult | undefined,
  ): AgentActivitySeverity {
    if (!result) {
      return "error";
    }

    if (result.status === "succeeded") {
      return "success";
    }

    if (
      result.status === "needs_confirmation" ||
      result.status === "dry_run_required" ||
      result.status === "unavailable"
    ) {
      return "warning";
    }

    return "error";
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
