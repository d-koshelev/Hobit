import {
  useEffect,
  useRef,
  useState,
} from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { catalogActionProposalsFromText } from "./coordinatorCatalogActionDrafts";
import {
  type CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import {
  generateLocalCoordinatorProposals,
  type CoordinatorOutcomeReviewDraft,
  type CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";
import { coordinatorProviderDraftProposals } from "./coordinatorProviderDraftProposals";
import {
  coordinatorProviderAssistantText,
  coordinatorProviderErrorMeta,
  coordinatorProviderFallbackMeta,
  coordinatorProviderMessage,
  type CoordinatorProviderMessageMeta,
  coordinatorProviderPendingMeta,
  coordinatorProviderProposalDraftContext,
  coordinatorProviderResponseMeta,
} from "./coordinatorProviderRequest";
import {
  errorToMessage,
  providerResponseAllowsCatalogDrafts,
} from "./workspaceAgentProviderGuards";
import type { WidgetRenderProps } from "./types";
import {
  CODEX_THREAD_NOT_AVAILABLE_MESSAGE,
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING,
  DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE,
  DIRECT_WORK_EMPTY_PROMPT_MESSAGE,
  DIRECT_WORK_UNAVAILABLE_MESSAGE,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
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
  directWorkFailureTranscriptBody,
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
import { WorkspaceAgentComposer } from "./WorkspaceAgentComposer";
import { WorkspaceAgentHeaderStatus } from "./WorkspaceAgentStatusPanel";
import {
  appendWorkspaceAgentVisibleContextBlock,
  removeWorkspaceAgentVisibleContextFromDraft,
  workspaceAgentVisibleContextBlock,
  type WorkspaceAgentVisibleContext,
} from "./workspaceAgentVisibleContext";
import {
  WorkspaceAgentTranscript,
  type WorkspaceAgentTranscriptMessage,
} from "./WorkspaceAgentTranscript";
import {
  WORKSPACE_AGENT_SUGGESTED_PROMPTS,
} from "./workspaceAgentSuggestedPrompts";
import {
  approveProposal as approveProposalState,
  approveQueueDraftProposals,
  editProposalPatch,
  rejectProposalPatch,
  updateProposal,
} from "./workspaceAgentProposalState";
import {
  runCreateKnowledgeDocumentProposal,
  runCreateNoteProposal,
  runCreateQueueTaskProposal,
  runCreateSkillProposal,
} from "./workspaceAgentProposalCreationActions";
import type { DirectWorkStreamEvent } from "../workspace/types";
import { agentActivityEventFromDirectWorkStreamEvent } from "./agentActivityModel";

type InteractiveAgentMessage = WorkspaceAgentTranscriptMessage;

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [];

export function InteractiveAgentPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateAgentQueueTask,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onCreateWorkspaceNote,
  coordinatorAttachedContextRequest,
  onGenerateCoordinatorProviderResponse,
  onSearchKnowledgeDocuments,
  onCancelCodexDirectWorkRun,
  onLoadLogs,
  onPublishAgentActivityEvents,
  onStartCodexDirectWorkStream,
  onStartFrameMove,
  title,
  workspaceId,
}: WidgetRenderProps) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageId = useRef(1);
  const [messages, setMessages] = useState<InteractiveAgentMessage[]>(
    INITIAL_MESSAGES,
  );
  const [plans, setPlans] = useState<Record<string, CoordinatorPlanDraft>>({});
  const [reviews, setReviews] = useState<
    Record<string, CoordinatorOutcomeReviewDraft>
  >({});
  const [proposals, setProposals] = useState<
    Record<string, CoordinatorActionProposal>
  >({});
  const [creatingQueueProposalIds, setCreatingQueueProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [
    creatingKnowledgeDocumentProposalIds,
    setCreatingKnowledgeDocumentProposalIds,
  ] = useState<ReadonlySet<string>>(() => new Set());
  const [creatingNoteProposalIds, setCreatingNoteProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [creatingSkillProposalIds, setCreatingSkillProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [draft, setDraft] = useState("");
  const [visibleAttachedContext, setVisibleAttachedContext] =
    useState<WorkspaceAgentVisibleContext | null>(null);
  const [isProviderPending, setIsProviderPending] = useState(false);
  const [directWorkDirectory, setDirectWorkDirectory] = useState("~");
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
  const directWorkCompletedDuringStartRef = useRef(false);
  const directWorkFinalMessageRef = useRef<string | null>(null);
  const directWorkAccessDeniedRef = useRef(false);
  const directWorkCapturedThreadIdRef = useRef<string | null>(null);
  const directWorkRunScopeRef = useRef<ActiveDirectWorkRunScope | null>(null);
  const directWorkLogSequenceRef = useRef(0);
  const workspaceScopeId = workspaceId?.trim() || "__local_workspace__";
  const sessionScopeKey = `${workspaceScopeId}\u0000${instance.id}`;
  const sessionScopeKeyRef = useRef(sessionScopeKey);
  const currentCodexThreadId = codexThreadIdForScope(
    currentCodexThread,
    workspaceScopeId,
    instance.id,
    directWorkDirectory.trim(),
  );
  const trimmedDraftLength = draft.trim().length;
  const isDirectModeEnabled = Boolean(onStartCodexDirectWorkStream);
  const canSend =
    !isDirectModeEnabled && trimmedDraftLength > 0 && !isProviderPending;
  const canStartDirectWork =
    isDirectModeEnabled &&
    directWorkStatus !== "running" &&
    !isProviderPending &&
    trimmedDraftLength > 0;
  const canStopDirectWork =
    directWorkStatus === "running" &&
    Boolean(directWorkRunId) &&
    Boolean(onCancelCodexDirectWorkRun);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [messages.length, isProviderPending]);

  useEffect(() => {
    if (sessionScopeKeyRef.current === sessionScopeKey) {
      return;
    }

    sessionScopeKeyRef.current = sessionScopeKey;
    resetCurrentSessionState();
  }, [sessionScopeKey]);

  useEffect(() => {
    if (!coordinatorAttachedContextRequest) {
      return;
    }

    const attachedContext = {
      contextText: coordinatorAttachedContextRequest.contextText,
      sourceLabel: coordinatorAttachedContextRequest.sourceLabel,
    };
    const attachmentBlock = workspaceAgentVisibleContextBlock(attachedContext);

    setVisibleAttachedContext(attachedContext);
    setDraft((currentDraft) =>
      appendWorkspaceAgentVisibleContextBlock(currentDraft, attachmentBlock),
    );
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [coordinatorAttachedContextRequest?.id]);

  useEffect(() => () => stopDirectWorkEventListening(), []);

  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
    proposalIds?: string[],
    providerMeta?: CoordinatorProviderMessageMeta,
    planId?: string,
    reviewId?: string,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      planId,
      proposalIds,
      providerMeta,
      reviewId,
      role,
      body,
    };
  }

  async function sendCoordinatorMessage() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isProviderPending) {
      return;
    }

    const operatorMessage = createLocalMessage("operator", trimmedDraft);
    const assistantMessageId = `local-${nextMessageId.current}`;
    const generated = generateLocalCoordinatorProposals(
      trimmedDraft,
      assistantMessageId,
    );
    const generatedProposalIds = generated.proposals.map(
      (proposal) => proposal.id,
    );
    const assistantMessage = createLocalMessage(
      "assistant",
      onGenerateCoordinatorProviderResponse
        ? "Drafting from the visible chat."
        : generated.responseBody,
      generatedProposalIds.length > 0 ? generatedProposalIds : undefined,
      onGenerateCoordinatorProviderResponse
        ? coordinatorProviderPendingMeta(generatedProposalIds.length)
        : coordinatorProviderFallbackMeta(
            "Provider API unavailable in this runtime. Local deterministic response only.",
          ),
      generated.plan?.id,
      generated.review?.id,
    );
    const providerConversation = [...messages, operatorMessage];

    if (generated.proposals.length > 0) {
      setProposals((currentProposals) => ({
        ...currentProposals,
        ...Object.fromEntries(
          generated.proposals.map((proposal) => [proposal.id, proposal]),
        ),
      }));
    }
    const generatedPlan = generated.plan;
    if (generatedPlan) {
      setPlans((currentPlans) => ({
        ...currentPlans,
        [generatedPlan.id]: generatedPlan,
      }));
    }
    const generatedReview = generated.review;
    if (generatedReview) {
      setReviews((currentReviews) => ({
        ...currentReviews,
        [generatedReview.id]: generatedReview,
      }));
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      operatorMessage,
      assistantMessage,
    ]);
    setDraft("");
    setVisibleAttachedContext(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);

    if (!onGenerateCoordinatorProviderResponse) {
      return;
    }

    setIsProviderPending(true);
    try {
      const providerResponse = await onGenerateCoordinatorProviderResponse(
        instance.id,
        {
          operatorMessage: trimmedDraft,
          visibleConversation: providerConversation.map(
            coordinatorProviderMessage,
          ),
          visibleProposalDrafts: generated.proposals.map(
            coordinatorProviderProposalDraftContext,
          ),
        },
      );
      const providerDrafts = coordinatorProviderDraftProposals(
        providerResponse,
        assistantMessage.id,
      );
      const assistantText = coordinatorProviderAssistantText(
        providerResponse,
        generated.responseBody,
      );
      const providerCatalogProposals = providerResponseAllowsCatalogDrafts(
        providerResponse,
      )
        ? catalogActionProposalsFromText(assistantText, assistantMessage.id)
        : [];
      const providerProposals = [
        ...providerDrafts.proposals,
        ...providerCatalogProposals,
      ];
      const providerProposalIds = providerProposals.map(
        (proposal) => proposal.id,
      );

      if (providerProposals.length > 0) {
        setProposals((currentProposals) => ({
          ...currentProposals,
          ...Object.fromEntries(
            providerProposals.map((proposal) => [proposal.id, proposal]),
          ),
        }));
      }

      patchMessage(assistantMessage.id, {
        body: assistantText,
        providerMeta: coordinatorProviderResponseMeta(providerResponse),
        proposalIds:
          providerProposalIds.length > 0
            ? providerProposalIds
            : assistantMessage.proposalIds,
      });
    } catch (error) {
      const message = errorToMessage(error, "Provider request failed.");
      patchMessage(assistantMessage.id, {
        body: generated.responseBody,
        providerMeta: coordinatorProviderErrorMeta(
          `Provider request failed visibly: ${message} Local response remained in use.`,
        ),
      });
    } finally {
      setIsProviderPending(false);
    }
  }

  async function startCoordinatorDirectWork() {
    if (directWorkStatus === "running") {
      return;
    }

    const operatorPrompt = draft.trim();
    const repoRoot = directWorkDirectory.trim();

    if (!repoRoot) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE);
      return;
    }

    if (!operatorPrompt) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_EMPTY_PROMPT_MESSAGE);
      return;
    }

    if (!onStartCodexDirectWorkStream) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_UNAVAILABLE_MESSAGE);
      return;
    }

    stopDirectWorkEventListening();
    directWorkCompletedDuringStartRef.current = false;
    directWorkFinalMessageRef.current = null;
    directWorkAccessDeniedRef.current = false;
    directWorkCapturedThreadIdRef.current = null;
    directWorkRunScopeRef.current = {
      widgetInstanceId: instance.id,
      workingDirectory: repoRoot,
      workspaceId: workspaceScopeId,
    };
    const resumeThreadId = codexThreadIdForScope(
      currentCodexThread,
      workspaceScopeId,
      instance.id,
      repoRoot,
    );
    if (currentCodexThread && !resumeThreadId) {
      setCurrentCodexThread(null);
    }
    const knowledgeLookup =
      await searchWorkspaceKnowledgeForDirectWork(operatorPrompt);
    const promptForCodex =
      knowledgeLookup.results.length > 0
        ? codexPromptWithWorkspaceKnowledge(operatorPrompt, knowledgeLookup.results)
        : operatorPrompt;
    const threadStartText = resumeThreadId
      ? `Continuing Codex thread ${shortCodexThreadId(resumeThreadId)}.`
      : "Starting new Codex thread.";
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage("operator", operatorPrompt),
    ]);
    setDraft("");
    setVisibleAttachedContext(null);
    setDirectWorkStatus("running");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setDirectWorkActivitySummary(
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
        instance.id,
        {
          approvalPolicy: "never",
          codexExecutable: defaultCoordinatorCodexExecutable(),
          codexThreadId: resumeThreadId,
          operatorPrompt: promptForCodex,
          repoRoot,
          sandbox: "workspace_write",
          skipGitRepoCheck: true,
          stderrCapBytes: null,
          stdoutCapBytes: null,
          timeoutMs: null,
        },
        recordCoordinatorDirectWorkEvent,
      );

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
        appendCoordinatorDirectWorkLog(
          `Direct Work run ${session.runId} started.`,
          "local",
        );
      }
    } catch (error) {
      const message = errorToMessage(error, "Unable to start Direct Work.");
      stopDirectWorkEventListening();
      setDirectWorkStatus("failed");
      setDirectWorkError(message);
      setDirectWorkWarning(null);
      setDirectWorkActivitySummary((currentSummary) =>
        workspaceAgentActivitySummaryForLocalFailure(currentSummary, message),
      );
      appendCoordinatorDirectWorkLog(message, "local");
      appendCoordinatorDirectWorkTranscript("failed", message);
    } finally {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
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

  async function stopCoordinatorDirectWork() {
    if (
      !directWorkRunId ||
      !onCancelCodexDirectWorkRun ||
      isDirectWorkStopPending
    ) {
      return;
    }

    setIsDirectWorkStopPending(true);
    appendCoordinatorDirectWorkLog("Stop requested.", "local");

    try {
      const response = await onCancelCodexDirectWorkRun(
        instance.id,
        directWorkRunId,
      );

      if (!response) {
        throw new Error("Stop command returned no response.");
      }

      appendCoordinatorDirectWorkLog(response.message, "local");
    } catch (error) {
      const message = errorToMessage(error, "Unable to stop Direct Work.");
      setDirectWorkError(message);
      appendCoordinatorDirectWorkLog(message, "local");
    } finally {
      setIsDirectWorkStopPending(false);
    }
  }

  function recordCoordinatorDirectWorkEvent(event: DirectWorkStreamEvent) {
    if (!directWorkEventBelongsToCurrentAgent(event, workspaceId, instance.id)) {
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

    if (directWorkEventHasAccessDenied(event)) {
      directWorkAccessDeniedRef.current = true;
    }

    if (event.codexThreadId) {
      const runScope = directWorkRunScopeRef.current ?? {
        widgetInstanceId: instance.id,
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
      directWorkFinalMessageRef.current = event.text;
    }

    const codexAgentMessage = codexAgentMessageFromEvent(event);
    if (codexAgentMessage) {
      directWorkFinalMessageRef.current = codexAgentMessage;
    }

    appendCoordinatorDirectWorkLog(
      directWorkEventText(event),
      event.eventKind,
    );

    if (!event.isFinal) {
      setDirectWorkActivitySummary((currentSummary) =>
        workspaceAgentActivitySummaryFromEvent(currentSummary, event, {
          accessDeniedSeen: directWorkAccessDeniedRef.current,
        }),
      );
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
    const finalResult =
      finalAgentMessage ??
      event.text ??
      failureReason ??
      event.stderrPreview ??
      `Codex Direct Work ended with status ${event.finalStatus ?? finalStatus}.`;

    setDirectWorkStatus(finalStatus);
    setDirectWorkRunId(null);
    setDirectWorkFinalResult(finalResult);
    setDirectWorkError(failureReason);
    setDirectWorkWarning(failureWarning);
    setDirectWorkActivitySummary((currentSummary) =>
      workspaceAgentActivitySummaryFromEvent(currentSummary, event, {
        accessDeniedSeen: directWorkAccessDeniedRef.current,
        failureReason,
      }),
    );
    if (
      finalStatus === "completed" &&
      !directWorkCapturedThreadIdRef.current
    ) {
      setCurrentCodexThread(null);
      setCodexThreadNotice(CODEX_THREAD_NOT_AVAILABLE_MESSAGE);
      appendCoordinatorDirectWorkLog(CODEX_THREAD_NOT_AVAILABLE_MESSAGE, "local");
    }
    stopDirectWorkEventListening();

    appendCoordinatorDirectWorkTranscript(
      finalStatus,
      finalResult,
      Boolean(finalAgentMessage),
    );
    directWorkRunScopeRef.current = null;
  }

  function appendCoordinatorDirectWorkLog(
    text: string,
    kind: CoordinatorDirectWorkLogEntry["kind"],
  ) {
    const id = `direct-log-${++directWorkLogSequenceRef.current}`;
    setDirectWorkLogs((currentLogs) =>
      [...currentLogs, { id, kind, text }].slice(-6),
    );
  }

  function recordCoordinatorDirectWorkLocalFailure(reason: string) {
    setDirectWorkStatus("failed");
    setDirectWorkRunId(null);
    setDirectWorkError(reason);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setDirectWorkActivitySummary((currentSummary) =>
      workspaceAgentActivitySummaryForLocalFailure(currentSummary, reason),
    );
    appendCoordinatorDirectWorkLog(reason, "local");
    appendCoordinatorDirectWorkTranscript("failed", reason);
  }

  function resetCodexThread() {
    setCurrentCodexThread(null);
    setCodexThreadNotice("Codex thread reset.");
    setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    removeVisibleAttachedContext();
    appendCoordinatorDirectWorkLog("Codex thread reset.", "local");
  }

  function updateDirectWorkDirectory(value: string) {
    setDirectWorkDirectory(value);
    if (value !== directWorkDirectory && currentCodexThreadId) {
      setCurrentCodexThread(null);
      setCodexThreadNotice(
        "Working directory changed. Next Codex run starts a new thread.",
      );
      setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
      appendCoordinatorDirectWorkLog(
        "Working directory changed. Next Codex run starts a new thread.",
        "local",
      );
    }
  }

  function resetCurrentSessionState() {
    stopDirectWorkEventListening();
    nextMessageId.current = 1;
    directWorkCompletedDuringStartRef.current = false;
    directWorkFinalMessageRef.current = null;
    directWorkAccessDeniedRef.current = false;
    directWorkCapturedThreadIdRef.current = null;
    directWorkRunScopeRef.current = null;
    directWorkLogSequenceRef.current = 0;
    setMessages(INITIAL_MESSAGES);
    setPlans({});
    setReviews({});
    setProposals({});
    setCreatingQueueProposalIds(new Set());
    setCreatingKnowledgeDocumentProposalIds(new Set());
    setCreatingNoteProposalIds(new Set());
    setCreatingSkillProposalIds(new Set());
    setDraft("");
    setVisibleAttachedContext(null);
    setIsProviderPending(false);
    setDirectWorkDirectory("~");
    setDirectWorkStatus("idle");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setCurrentCodexThread(null);
    setCodexThreadNotice(null);
    setDirectWorkLogs([]);
    setDirectWorkActivitySummary(EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY);
    setWorkspaceKnowledgeLookup(EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP);
    setIsDirectWorkStopPending(false);
  }

  function appendCoordinatorDirectWorkTranscript(
    status: CoordinatorDirectWorkStatus,
    reason: string,
    useDirectBody = false,
  ) {
    const body =
      status === "completed" || useDirectBody
        ? reason
        : status === "failed"
          ? directWorkFailureTranscriptBody(reason)
          : reason;

    const assistantMessage = createLocalMessage("assistant", body);
    const catalogProposals = catalogActionProposalsFromText(
      body,
      assistantMessage.id,
    );

    if (catalogProposals.length > 0) {
      setProposals((currentProposals) => ({
        ...currentProposals,
        ...Object.fromEntries(
          catalogProposals.map((proposal) => [proposal.id, proposal]),
        ),
      }));
      assistantMessage.proposalIds = catalogProposals.map(
        (proposal) => proposal.id,
      );
    }

    setMessages((currentMessages) => [...currentMessages, assistantMessage]);
  }

  function stopDirectWorkEventListening() {
    directWorkStopListeningRef.current?.();
    directWorkStopListeningRef.current = null;
  }

  function useSuggestedPrompt(prompt: string) {
    setDraft(prompt);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function removeVisibleAttachedContext() {
    if (!visibleAttachedContext) {
      return;
    }

    setDraft((currentDraft) =>
      removeWorkspaceAgentVisibleContextFromDraft(
        currentDraft,
        visibleAttachedContext,
      ),
    );
    setVisibleAttachedContext(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function patchMessage(
    messageId: string,
    patch: Partial<InteractiveAgentMessage>,
  ) {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    );
  }

  function approveProposal(proposalId: string) {
    setProposals((currentProposals) =>
      approveProposalState(currentProposals, proposalId),
    );
  }

  function approveAllQueueDrafts(proposalIds: string[]) {
    setProposals((currentProposals) =>
      approveQueueDraftProposals(currentProposals, proposalIds),
    );
  }

  function rejectProposal(proposalId: string) {
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, rejectProposalPatch()),
    );
  }

  function editProposal(
    proposalId: string,
    patch: Pick<
      CoordinatorActionProposal,
      "expectedResult" | "inputs" | "intent"
    >,
  ) {
    setProposals((currentProposals) => {
      const proposal = currentProposals[proposalId];
      return updateProposal(
        currentProposals,
        proposalId,
        editProposalPatch(proposal, patch),
      );
    });
  }

  async function createQueueTaskFromProposal(proposalId: string) {
    await runCreateQueueTaskProposal({
      onCreateAgentQueueTask,
      pendingProposalIds: creatingQueueProposalIds,
      proposalId,
      proposals,
      setPendingProposalIds: setCreatingQueueProposalIds,
      setProposals,
    });
  }

  async function createNoteFromProposal(proposalId: string) {
    await runCreateNoteProposal({
      onCreateWorkspaceNote,
      pendingProposalIds: creatingNoteProposalIds,
      proposalId,
      proposals,
      setPendingProposalIds: setCreatingNoteProposalIds,
      setProposals,
    });
  }

  async function createKnowledgeDocumentFromProposal(proposalId: string) {
    await runCreateKnowledgeDocumentProposal({
      onCreateKnowledgeDocument,
      pendingProposalIds: creatingKnowledgeDocumentProposalIds,
      proposalId,
      proposals,
      setPendingProposalIds: setCreatingKnowledgeDocumentProposalIds,
      setProposals,
    });
  }

  async function createSkillFromProposal(proposalId: string) {
    await runCreateSkillProposal({
      onCreateSkill,
      pendingProposalIds: creatingSkillProposalIds,
      proposalId,
      proposals,
      setPendingProposalIds: setCreatingSkillProposalIds,
      setProposals,
    });
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={
        <WorkspaceAgentHeaderStatus status={directWorkStatus} />
      }
      title={title}
    >
      <div className="interactive-agent-chat">
        <WorkspaceAgentTranscript
          creatingKnowledgeDocumentProposalIds={
            creatingKnowledgeDocumentProposalIds
          }
          creatingNoteProposalIds={creatingNoteProposalIds}
          creatingQueueProposalIds={creatingQueueProposalIds}
          messages={messages}
          onApproveAllQueueDrafts={approveAllQueueDrafts}
          onApproveProposal={approveProposal}
          onCreateKnowledgeDocument={(proposalId) =>
            void createKnowledgeDocumentFromProposal(proposalId)
          }
          onCreateNote={(proposalId) => void createNoteFromProposal(proposalId)}
          onCreateQueueTask={(proposalId) =>
            void createQueueTaskFromProposal(proposalId)
          }
          onCreateSkill={(proposalId) => void createSkillFromProposal(proposalId)}
          onEditProposal={editProposal}
          onRejectProposal={rejectProposal}
          onSuggestionClick={useSuggestedPrompt}
          plans={plans}
          proposals={proposals}
          reviews={reviews}
          suggestedPrompts={WORKSPACE_AGENT_SUGGESTED_PROMPTS}
          transcriptRef={messageListRef}
        />

        <WorkspaceAgentComposer
          canSend={canSend}
          directMode={
            isDirectModeEnabled
              ? {
                  activitySummary: directWorkActivitySummary,
                  canStartDirectWork,
                  canStopDirectWork,
                  directWorkDirectory,
                  error: directWorkError,
                  finalResult: directWorkFinalResult,
                  isStopPending: isDirectWorkStopPending,
                  knowledgeLookup: workspaceKnowledgeLookup,
                  logs: directWorkLogs,
                  onDirectoryChange: updateDirectWorkDirectory,
                  onResetThread: resetCodexThread,
                  onStopDirectWork: () => void stopCoordinatorDirectWork(),
                  runId: directWorkRunId,
                  status: directWorkStatus,
                  threadId: currentCodexThreadId,
                  threadNotice: codexThreadNotice,
                  warning: directWorkWarning,
                }
              : null
          }
          draft={draft}
          isProviderPending={isProviderPending}
          onMessageChange={setDraft}
          onRemoveVisibleContext={removeVisibleAttachedContext}
          onRunWithCodex={startCoordinatorDirectWork}
          onSend={sendCoordinatorMessage}
          textareaRef={textareaRef}
          visibleAttachedContext={visibleAttachedContext}
        />
      </div>
    </WidgetFrame>
  );
}
