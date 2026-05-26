import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { catalogActionProposalsFromText } from "./coordinatorCatalogActionDrafts";
import { CoordinatorActionProposalCard } from "./CoordinatorActionProposalCard";
import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import {
  generateLocalCoordinatorProposals,
  type CoordinatorOutcomeReviewDraft,
  type CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";
import {
  knowledgeDocumentCreateRequestFromProposal,
  noteCreateRequestFromProposal,
  queueTaskRequestFromProposal,
  skillCreateRequestFromProposal,
} from "./coordinatorProposalHandoffs";
import { coordinatorProviderDraftProposals } from "./coordinatorProviderDraftProposals";
import {
  coordinatorProviderAssistantText,
  coordinatorProviderErrorMeta,
  coordinatorProviderFallbackMeta,
  coordinatorProviderMessage,
  coordinatorProviderModeLabel,
  type CoordinatorProviderMessageMeta,
  coordinatorProviderPendingMeta,
  coordinatorProviderProposalDraftContext,
  coordinatorProviderResponseMeta,
} from "./coordinatorProviderRequest";
import type { WidgetRenderProps } from "./types";
import {
  CODEX_THREAD_NOT_AVAILABLE_MESSAGE,
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING,
  DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE,
  DIRECT_WORK_EMPTY_PROMPT_MESSAGE,
  DIRECT_WORK_UNAVAILABLE_MESSAGE,
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
  directWorkFailureTranscriptBody,
  shortCodexThreadId,
  workspaceKnowledgeLogText,
  type ActiveDirectWorkRunScope,
  type CodexThreadScope,
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";
import {
  CoordinatorAgentHeaderStatus,
  WorkspaceAgentDirectModePanel,
} from "./WorkspaceAgentDirectModePanel";
import {
  approveProposal as approveProposalState,
  approveQueueDraftProposals,
  canStartProposalCreation,
  createNotApprovedFailurePatch,
  createUnavailableFailurePatch,
  editProposalPatch,
  failedProposalPatch,
  proposalCreatedPatch,
  proposalCreatingPatch,
  queueDraftReviewState,
  rejectProposalPatch,
  updateProposal,
} from "./workspaceAgentProposalState";
import type { DirectWorkStreamEvent } from "../workspace/types";

type InteractiveAgentMessage = {
  id: string;
  planId?: string;
  proposalIds?: string[];
  providerMeta?: CoordinatorProviderMessageMeta;
  reviewId?: string;
  role: "operator" | "assistant";
  body: string;
};

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [];

const SUGGESTED_PROMPTS = [
  {
    label: "Make a plan",
    prompt:
      "Make a plan from the visible chat only. Goal: ",
  },
  {
    label: "Break into Queue tasks",
    prompt: "Break this into Queue tasks from visible text only. Goal: ",
  },
  {
    label: "Draft tasks for this goal",
    prompt: "Draft tasks for this goal using only the visible chat: ",
  },
  {
    label: "Review pasted Queue result",
    prompt:
      "Review pasted Queue result using visible chat text only. Paste result here: ",
  },
  {
    label: "Explain this Executor failure",
    prompt:
      "Explain this Executor failure using visible chat text only. Paste failure here: ",
  },
  {
    label: "Turn this result into next steps",
    prompt:
      "Turn this result into next steps using visible chat text only. Paste result here: ",
  },
  {
    label: "Draft follow-up Queue tasks",
    prompt:
      "Draft follow-up Queue tasks from this pasted result using visible chat text only. Paste result here: ",
  },
  {
    label: "Summarize validation output",
    prompt:
      "Summarize validation output using visible chat text only. Paste validation output here: ",
  },
  {
    label: "Explain how to execute this safely",
    prompt:
      "Explain how to execute this safely from visible chat only. Do not start Queue, Executor, Terminal, Git, or JDBC actions.",
  },
];

const QUEUE_DRAFT_REVIEW_NOTE =
  "Approve all drafts is local review only. Create Queue task stays explicit on each approved draft.";

const STATIC_PROPOSAL_TYPE_SUMMARY =
  COORDINATOR_ACTION_PROPOSAL_REGISTRY.map(
    (proposalType) => proposalType.displayName,
  ).join(", ");

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
  onStartCodexDirectWorkStream,
  onStartFrameMove,
  title,
  workspaceId,
}: WidgetRenderProps) {
  const textareaId = useId();
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
  const [visibleAttachedContext, setVisibleAttachedContext] = useState<{
    contextText: string;
    sourceLabel: string;
  } | null>(null);
  const [isProviderPending, setIsProviderPending] = useState(false);
  const [providerModeLabel, setProviderModeLabel] =
    useState("Mock/local fallback");
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
    const attachmentBlock = coordinatorAttachedContextBlock(attachedContext);

    setVisibleAttachedContext(attachedContext);
    setDraft((currentDraft) => appendDraftBlock(currentDraft, attachmentBlock));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDirectModeEnabled) {
      await startCoordinatorDirectWork();
      return;
    }

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
      setProviderModeLabel("Local fallback");
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
      setProviderModeLabel(coordinatorProviderModeLabel(providerResponse));
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
      setProviderModeLabel("Provider error");
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
    setProviderModeLabel("Mock/local fallback");
    setDirectWorkDirectory("~");
    setDirectWorkStatus("idle");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkWarning(null);
    setDirectWorkFinalResult(null);
    setCurrentCodexThread(null);
    setCodexThreadNotice(null);
    setDirectWorkLogs([]);
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

    const attachmentBlock = coordinatorAttachedContextBlock(
      visibleAttachedContext,
    );
    setDraft((currentDraft) =>
      currentDraft.includes(attachmentBlock)
        ? currentDraft.replace(attachmentBlock, "").trimStart()
        : currentDraft,
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
    if (creatingQueueProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-agent-queue-task") {
      return;
    }

    if (proposal.createdQueueTaskId) {
      return;
    }

    if (!canStartProposalCreation(proposal, "queueTask")) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createNotApprovedFailurePatch("queueTask"),
        ),
      );
      return;
    }

    if (!onCreateAgentQueueTask) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createUnavailableFailurePatch("queueTask"),
        ),
      );
      return;
    }

    setCreatingQueueProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(
        currentProposals,
        proposalId,
        proposalCreatingPatch("queueTask"),
      ),
    );

    try {
      const task = await onCreateAgentQueueTask(
        queueTaskRequestFromProposal(proposal),
      );
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          proposalCreatedPatch("queueTask", {
            id: task.queueItemId,
            status: task.status,
            title: task.title,
          }),
        ),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          failedProposalPatch(
            "queueTask",
            errorToMessage(error, "Unable to create Queue task."),
          ),
        ),
      );
    } finally {
      setCreatingQueueProposalIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(proposalId);
        return nextIds;
      });
    }
  }

  async function createNoteFromProposal(proposalId: string) {
    if (creatingNoteProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-note") {
      return;
    }

    if (proposal.createdNoteId) {
      return;
    }

    if (!canStartProposalCreation(proposal, "note")) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createNotApprovedFailurePatch("note"),
        ),
      );
      return;
    }

    if (!onCreateWorkspaceNote) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createUnavailableFailurePatch("note"),
        ),
      );
      return;
    }

    setCreatingNoteProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(
        currentProposals,
        proposalId,
        proposalCreatingPatch("note"),
      ),
    );

    try {
      const note = await onCreateWorkspaceNote(
        noteCreateRequestFromProposal(proposal),
      );
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          proposalCreatedPatch("note", {
            id: note.noteId,
            title: note.title,
          }),
        ),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          failedProposalPatch(
            "note",
            errorToMessage(error, "Unable to create Note."),
          ),
        ),
      );
    } finally {
      setCreatingNoteProposalIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(proposalId);
        return nextIds;
      });
    }
  }

  async function createKnowledgeDocumentFromProposal(proposalId: string) {
    if (creatingKnowledgeDocumentProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-knowledge-document") {
      return;
    }

    if (proposal.createdKnowledgeDocumentId) {
      return;
    }

    if (!canStartProposalCreation(proposal, "knowledgeDocument")) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createNotApprovedFailurePatch("knowledgeDocument"),
        ),
      );
      return;
    }

    if (!onCreateKnowledgeDocument) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createUnavailableFailurePatch("knowledgeDocument"),
        ),
      );
      return;
    }

    setCreatingKnowledgeDocumentProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(
        currentProposals,
        proposalId,
        proposalCreatingPatch("knowledgeDocument"),
      ),
    );

    try {
      const document = await onCreateKnowledgeDocument(
        knowledgeDocumentCreateRequestFromProposal(proposal),
      );
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          proposalCreatedPatch("knowledgeDocument", {
            id: document.knowledgeDocumentId,
            title: document.title,
          }),
        ),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          failedProposalPatch(
            "knowledgeDocument",
            errorToMessage(error, "Unable to create Knowledge Document."),
          ),
        ),
      );
    } finally {
      setCreatingKnowledgeDocumentProposalIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(proposalId);
        return nextIds;
      });
    }
  }

  async function createSkillFromProposal(proposalId: string) {
    if (creatingSkillProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-skill") {
      return;
    }

    if (proposal.createdSkillId) {
      return;
    }

    if (!canStartProposalCreation(proposal, "skill")) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createNotApprovedFailurePatch("skill"),
        ),
      );
      return;
    }

    if (!onCreateSkill) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          createUnavailableFailurePatch("skill"),
        ),
      );
      return;
    }

    setCreatingSkillProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(
        currentProposals,
        proposalId,
        proposalCreatingPatch("skill"),
      ),
    );

    try {
      const skill = await onCreateSkill(skillCreateRequestFromProposal(proposal));
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          proposalCreatedPatch("skill", {
            id: skill.skillId,
            title: skill.title,
          }),
        ),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(
          currentProposals,
          proposalId,
          failedProposalPatch(
            "skill",
            errorToMessage(error, "Unable to create Skill."),
          ),
        ),
      );
    } finally {
      setCreatingSkillProposalIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(proposalId);
        return nextIds;
      });
    }
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
        <CoordinatorAgentHeaderStatus status={directWorkStatus} />
      }
      title={title}
    >
      <div className="interactive-agent-chat">
        <section
          aria-label="Workspace Agent status"
          className="interactive-agent-status"
        >
          <div className="interactive-agent-status-copy">
            <div className="interactive-agent-status-heading">
              <div className="interactive-agent-title-copy">
                <h3 className="interactive-agent-title">
                  Plan work, draft tasks, review results
                </h3>
              </div>
            </div>
            <details
              aria-label="Workspace Agent provider details"
              className="interactive-agent-provider-disclosure interactive-agent-provider-secondary"
            >
              <summary>Response setup</summary>
              <div className="interactive-agent-provider-row">
                <span className="interactive-agent-status-label">Response</span>
                <Badge
                  variant={
                    isProviderPending
                      ? "warning"
                      : providerModeLabel === "Provider error"
                        ? "error"
                        : providerModeLabel === "Provider timeout" ||
                            providerModeLabel === "Invalid provider response" ||
                            providerModeLabel === "Network failure" ||
                            providerModeLabel === "Request too large"
                          ? "warning"
                          : providerModeLabel === "Not configured" ||
                              providerModeLabel.includes("unavailable")
                            ? "warning"
                            : providerModeLabel === "Local fallback" ||
                                providerModeLabel === "Mock/local fallback"
                              ? "neutral"
                              : "info"
                  }
                >
                  {isProviderPending ? "Drafting" : providerModeLabel}
                </Badge>
                <span className="interactive-agent-status-label">Setup</span>
                <Badge variant="neutral">Backend selected</Badge>
              </div>
              <p className="interactive-agent-text">
                Runs with Codex from the selected working directory when the
                desktop Codex bridge is available. Provider fallback stays
                chat-only and uses visible context with no tools.
              </p>
              <p className="interactive-agent-text">
                Supported review cards: {STATIC_PROPOSAL_TYPE_SUMMARY}. Queue
                and Note cards require approval plus a separate create action;
                JDBC cards stay copy-only.
              </p>
            </details>
          </div>
        </section>

        <div
          aria-label="Local Workspace Agent transcript"
          aria-live="polite"
          className="interactive-agent-message-list"
          ref={messageListRef}
          role="log"
        >
          {messages.length === 0 ? (
            <div className="interactive-agent-empty">
              <p className="interactive-agent-empty-title">
                Start with a planning question or a task draft.
              </p>
              <p className="interactive-agent-empty-text">
                Workspace Agent works from visible chat and explicit
                attachments. Multiple agents can work independently in the same
                workspace.
              </p>
              <p className="interactive-agent-empty-text">
                Drafts stay inert until you approve them and use the separate
                create or copy action.
              </p>
              <div
                aria-label="Workspace Agent suggested prompts"
                className="interactive-agent-suggestion-list"
              >
                {SUGGESTED_PROMPTS.map((suggestion) => (
                  <button
                    className="interactive-agent-suggestion"
                    key={suggestion.label}
                    onClick={() => useSuggestedPrompt(suggestion.prompt)}
                    type="button"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              aria-label={
                message.role === "operator"
                  ? "User message"
                  : "Workspace Agent message"
              }
              className={`interactive-agent-message interactive-agent-message-${message.role}${
                message.providerMeta
                  ? ` interactive-agent-message-${message.providerMeta.tone}`
                  : ""
              }`}
              data-testid={`interactive-agent-message-${message.role}`}
              key={message.id}
            >
              <div className="interactive-agent-message-body">
                {renderMessageBody(message.body)}
              </div>
              {message.providerMeta ? (
                <details
                  className={`interactive-agent-provider-meta interactive-agent-provider-meta-${message.providerMeta.tone}`}
                >
                  <summary>Details</summary>
                  <p>
                    Source: {message.providerMeta.label}.{" "}
                    {message.providerMeta.detail}
                  </p>
                </details>
              ) : null}
              {message.planId && plans[message.planId] ? (
                <CoordinatorPlanCard plan={plans[message.planId]} />
              ) : null}
              {message.reviewId && reviews[message.reviewId] ? (
                <CoordinatorReviewCard review={reviews[message.reviewId]} />
              ) : null}
              {message.proposalIds ? (
                <div className="coordinator-proposal-list">
                  <CoordinatorProposalReviewControls
                    onApproveAllQueueDrafts={approveAllQueueDrafts}
                    proposalIds={message.proposalIds}
                    proposals={proposals}
                  />
                  {message.proposalIds.map((proposalId) => {
                    const proposal = proposals[proposalId];

                    return proposal ? (
                      <CoordinatorActionProposalCard
                        key={proposal.id}
                        isKnowledgeDocumentCreationPending={creatingKnowledgeDocumentProposalIds.has(
                          proposal.id,
                        )}
                        isNoteCreationPending={creatingNoteProposalIds.has(
                          proposal.id,
                        )}
                        isQueueTaskCreationPending={creatingQueueProposalIds.has(
                          proposal.id,
                        )}
                        onApprove={approveProposal}
                        onCreateKnowledgeDocument={(proposalId) =>
                          void createKnowledgeDocumentFromProposal(proposalId)
                        }
                        onCreateNote={(proposalId) =>
                          void createNoteFromProposal(proposalId)
                        }
                        onCreateQueueTask={(proposalId) =>
                          void createQueueTaskFromProposal(proposalId)
                        }
                        onCreateSkill={(proposalId) =>
                          void createSkillFromProposal(proposalId)
                        }
                        onEdit={editProposal}
                        onReject={rejectProposal}
                        proposal={proposal}
                      />
                    ) : null;
                  })}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form className="interactive-agent-composer" onSubmit={handleSubmit}>
          {visibleAttachedContext ? (
            <section
              aria-label="Visible attached context"
              className="interactive-agent-attached-context"
            >
              <div className="interactive-agent-attached-context-header">
                <div>
                  <p className="interactive-agent-attached-context-kicker">
                    Visible attached context
                  </p>
                  <p className="interactive-agent-attached-context-source">
                    {visibleAttachedContext.sourceLabel}
                  </p>
                </div>
                <Button
                  onClick={removeVisibleAttachedContext}
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
              <pre className="interactive-agent-attached-context-body">
                {visibleAttachedContext.contextText}
              </pre>
              <p className="interactive-agent-attached-context-note">
                Included in the message below. Edit or remove it before Send.
              </p>
            </section>
          ) : null}
          <WorkspaceAgentDirectModePanel
            directWorkDirectory={directWorkDirectory}
            error={directWorkError}
            finalResult={directWorkFinalResult}
            knowledgeLookup={workspaceKnowledgeLookup}
            logs={directWorkLogs}
            onDirectoryChange={updateDirectWorkDirectory}
            onResetThread={resetCodexThread}
            runId={directWorkRunId}
            status={directWorkStatus}
            threadId={currentCodexThreadId}
            threadNotice={codexThreadNotice}
            warning={directWorkWarning}
          />
          <label
            className="interactive-agent-label interactive-agent-label-hidden"
            htmlFor={textareaId}
          >
            Message
          </label>
          <textarea
            className="input interactive-agent-input"
            id={textareaId}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Plan work, draft Queue tasks, review pasted results, or ask what to do next."
            ref={textareaRef}
            rows={3}
            value={draft}
          />
          <div className="interactive-agent-action-row">
            <p className="interactive-agent-note">
              {isDirectModeEnabled
                ? "Runs with Codex from the selected working directory."
                : "Send uses mock/local fallback unless a provider is configured. No tools run."}
            </p>
            <div className="interactive-agent-composer-actions">
              {canStopDirectWork ? (
                <Button
                  disabled={isDirectWorkStopPending}
                  onClick={() => void stopCoordinatorDirectWork()}
                  type="button"
                  variant="secondary"
                >
                  {isDirectWorkStopPending ? "Stopping" : "Stop"}
                </Button>
              ) : null}
              <Button
                disabled={
                  isDirectModeEnabled ? !canStartDirectWork : !canSend
                }
                type="submit"
                variant="primary"
              >
                {isDirectModeEnabled
                  ? directWorkStatus === "running"
                    ? "Running with Codex"
                    : "Run with Codex"
                  : isProviderPending
                    ? "Drafting"
                    : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </WidgetFrame>
  );
}

function renderMessageBody(body: string): ReactNode {
  const segments = body.split(/```/);

  if (segments.length === 1) {
    return <p>{body}</p>;
  }

  return segments.map((segment, index) => {
    const key = `${index}-${segment.slice(0, 12)}`;
    if (index % 2 === 1) {
      const code = segment.replace(/^[\w-]+\n/, "").trim();
      return (
        <pre className="interactive-agent-code-block" key={key}>
          <code>{code}</code>
        </pre>
      );
    }

    return segment.trim() ? <p key={key}>{segment.trim()}</p> : null;
  });
}

function coordinatorAttachedContextBlock(context: {
  contextText: string;
  sourceLabel: string;
}) {
  return [
    `Visible attached context (${context.sourceLabel})`,
    context.contextText,
    "Only visible attached context is sent.",
  ].join("\n");
}

function appendDraftBlock(currentDraft: string, block: string) {
  const trimmedDraft = currentDraft.trim();

  if (!trimmedDraft) {
    return block;
  }

  return `${trimmedDraft}\n\n${block}`;
}

function CoordinatorReviewCard({
  review,
}: {
  review: CoordinatorOutcomeReviewDraft;
}) {
  const statusVariant =
    review.statusInterpretation === "success"
      ? "success"
      : review.statusInterpretation === "failure"
        ? "error"
        : review.statusInterpretation === "needs review"
          ? "warning"
          : "neutral";

  return (
    <section
      aria-label={`Workspace Agent outcome review: ${review.title}`}
      className={`coordinator-review-card coordinator-review-card-${review.statusInterpretation.replace(
        /\s+/g,
        "-",
      )}`}
    >
      <div className="coordinator-review-header">
        <div className="coordinator-review-title-copy">
          <p className="coordinator-review-kicker">Outcome review</p>
          <h4 className="coordinator-review-title">{review.title}</h4>
        </div>
        <div className="coordinator-review-badges">
          <Badge variant={statusVariant}>
            {review.statusInterpretation}
          </Badge>
          <Badge variant="neutral">Visible text only</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-review-grid">
        <ReviewSection
          label="Observed result summary"
          value={review.observedSummary}
        />
        <ReviewSection
          label="Status interpretation"
          value={review.statusInterpretation}
        />
        <ReviewSection label="Likely outcome" value={review.likelyOutcome} />
        <ReviewList label="Risks / blockers" values={review.risksBlockers} />
        <ReviewList
          label="Next recommended actions"
          values={review.nextActions}
        />
      </div>
      <p className="coordinator-review-note">
        Review only. Workspace Agent does not read Queue history, Executor
        logs, or artifacts unless you paste or explicitly share them.
      </p>
    </section>
  );
}

function CoordinatorPlanCard({ plan }: { plan: CoordinatorPlanDraft }) {
  return (
    <section
      aria-label={`Workspace Agent plan: ${plan.title}`}
      className="coordinator-plan-card"
    >
      <div className="coordinator-plan-header">
        <div className="coordinator-plan-title-copy">
          <p className="coordinator-plan-kicker">Workspace Agent plan</p>
          <h4 className="coordinator-plan-title">{plan.title}</h4>
          <div className="coordinator-plan-goal-block">
            <p className="coordinator-plan-section-label">Goal</p>
            <p className="coordinator-plan-goal">{plan.goal}</p>
          </div>
        </div>
        <div className="coordinator-plan-badges">
          <Badge variant="info">Plan draft</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-plan-grid">
        <PlanList label="Steps" values={plan.steps} />
        <PlanList label="Risks / notes" values={plan.riskNotes} />
        <PlanList
          label="Suggested next actions"
          values={plan.suggestedNextActions}
        />
      </div>
      <p className="coordinator-plan-note">
        Plan only. Queue task drafts require approval plus Create Queue task.
        Queue/Executor run work only after explicit operator action.
      </p>
    </section>
  );
}

function ReviewSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <p className="coordinator-review-section-value">{value}</p>
    </div>
  );
}

function ReviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <ol className="coordinator-review-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </div>
  );
}

function CoordinatorProposalReviewControls({
  onApproveAllQueueDrafts,
  proposalIds,
  proposals,
}: {
  onApproveAllQueueDrafts: (proposalIds: string[]) => void;
  proposalIds: string[];
  proposals: Record<string, CoordinatorActionProposal>;
}) {
  const reviewState = queueDraftReviewState(proposalIds, proposals);

  if (reviewState.queueDraftCount < 2) {
    return null;
  }

  return (
    <section
      aria-label="Queue draft review controls"
      className="coordinator-proposal-review"
    >
      <div className="coordinator-proposal-review-copy">
        <p className="coordinator-proposal-section-label">
          Draft Queue tasks
        </p>
        <p className="coordinator-proposal-section-value">
          {reviewState.queueDraftCount} drafted,{" "}
          {reviewState.approvedCount} approved, {reviewState.createdCount}{" "}
          created.
        </p>
        <p className="coordinator-proposal-note">
          {QUEUE_DRAFT_REVIEW_NOTE}
        </p>
      </div>
      <Button
        disabled={!reviewState.canApproveAll}
        onClick={() => onApproveAllQueueDrafts(reviewState.approvableIds)}
        variant="secondary"
      >
        Approve all drafts
      </Button>
    </section>
  );
}

function PlanList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-plan-section">
      <p className="coordinator-plan-section-label">{label}</p>
      <ol className="coordinator-plan-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </div>
  );
}

function providerResponseAllowsCatalogDrafts(
  response: Awaited<
    ReturnType<NonNullable<WidgetRenderProps["onGenerateCoordinatorProviderResponse"]>>
  >,
) {
  return Boolean(
    response &&
      response.providerStatus === "completed" &&
      response.allowedTools.length === 0 &&
      response.noToolsExecuted &&
      response.noMutationsPerformed &&
      response.noHiddenContextUsed,
  );
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
