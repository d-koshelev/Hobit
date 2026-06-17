import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { catalogActionProposalsFromText } from "./coordinatorCatalogActionDrafts";
import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import type { AgentQueueReportActionCard, AgentQueueReportActionType, AgentQueueTask } from "../workspace/types";
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
import { errorToMessage, providerResponseAllowsCatalogDrafts } from "./workspaceAgentProviderGuards";
import type { WidgetRenderProps } from "./types";
import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkModel";
import { appendWorkspaceAgentDirectWorkTranscript } from "./workspaceAgentDirectWorkTranscript";
import type { WorkspaceAgentRunMetadata } from "./workspaceAgentRunMetadata";
import { WorkspaceAgentActivitySidePane } from "./WorkspaceAgentActivitySidePane";
import { WorkspaceAgentComposer } from "./WorkspaceAgentComposer";
import { WorkspaceAgentHeaderStatus } from "./WorkspaceAgentStatusPanel";
import {
  appendWorkspaceAgentVisibleContextBlock,
  removeWorkspaceAgentVisibleContextFromDraft,
  workspaceAgentVisibleContextBlock,
  type WorkspaceAgentVisibleContext,
} from "./workspaceAgentVisibleContext";
import { WorkspaceAgentTranscript, type WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";
import {
  workspaceAgentQueueActionCardTitle,
  type WorkspaceAgentQueueActionCardResult,
} from "./workspaceAgentQueueActions";
import {
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import {
  runWorkspaceAgentSelfTestReport,
  type HobitAgentSelfTestReportViewModel,
} from "./agents/selfTest";
import type {
  AgentActivityEvent,
  AgentActivityLifecycleStage,
  AgentActivitySeverity,
  AgentActivityStatus,
} from "./agentActivityModel";
import {
  workspaceAgentQueueIntentDraftsFromText,
  type WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";
import { sendWorkspaceAgentKnowledgeCommandFromDraft } from "./workspaceAgentKnowledgeCommands";
import type {
  WorkspaceAgentQueueReportActionCardPatch,
  WorkspaceAgentQueueReportActionResult,
} from "./WorkspaceAgentQueueReportActionCard";
import { WORKSPACE_AGENT_SUGGESTED_PROMPTS } from "./workspaceAgentSuggestedPrompts";
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
import { runWorkspaceAgentProductActionConfirmation } from "./workspaceAgentProductActionGuards";
import { useWorkspaceAgentDirectWorkController } from "./useWorkspaceAgentDirectWorkController";
import { useWorkspaceAgentQueueCardRequests } from "./useWorkspaceAgentQueueCardRequests";
import { useWorkspaceAgentPromptPackImport } from "./useWorkspaceAgentPromptPackImport";
import { explicitQueueCommandWorkspaceRoot } from "./workspaceAgentExplicitQueueRoot";
import { createWorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";

type InteractiveAgentMessage = WorkspaceAgentTranscriptMessage;

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [];

export function InteractiveAgentPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  agentQueueController,
  agentActivityEvents,
  logRefreshToken,
  onCreateAgentQueueTask,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onCreateWorkspaceNote,
  currentWorkspaceRoot,
  coordinatorAttachedContextRequest,
  onGenerateCoordinatorProviderResponse,
  onGetKnowledgeDocument,
  onInvokeHobitAgentActionRequest,
  onOpenAgentQueueItem,
  onSearchKnowledgeDocuments,
  onCancelCodexDirectWorkRun,
  onLoadLogs,
  onPublishAgentActivityEvents,
  onSelectWorkspaceDirectory, onReadPromptPackSource,
  onStartCodexDirectWorkStream,
  onUpdateAgentQueueTask, createQueueItemsFromPromptPackPreview,
  queueReportActionCardRequest,
  queueTaskStatusCardRequest,
  queueValidationRunner, workspaceAgentQueueBridge,
  onStartFrameMove,
  title,
  workspaceId,
}: WidgetRenderProps) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageId = useRef(1);
  const [messages, setMessages] = useState<InteractiveAgentMessage[]>(INITIAL_MESSAGES);
  const [plans, setPlans] = useState<Record<string, CoordinatorPlanDraft>>({});
  const [reviews, setReviews] = useState<Record<string, CoordinatorOutcomeReviewDraft>>({});
  const [proposals, setProposals] = useState<Record<string, CoordinatorActionProposal>>({});
  const [queueReportCards, setQueueReportCards] = useState<Record<string, AgentQueueReportActionCard>>({});
  const [queueReportActionResults, setQueueReportActionResults] = useState<Record<string, Record<string, WorkspaceAgentQueueReportActionResult>>>({});
  const [queueActionResults, setQueueActionResults] = useState<Record<string, WorkspaceAgentQueueActionCardResult>>({});
  const [queueIntentDrafts, setQueueIntentDrafts] = useState<Record<string, WorkspaceAgentQueueIntentDraft>>({});
  const [selfTestReports, setSelfTestReports] = useState<Record<string, HobitAgentSelfTestReportViewModel>>({});
  const [creatingQueueProposalIds, setCreatingQueueProposalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [
    creatingKnowledgeDocumentProposalIds,
    setCreatingKnowledgeDocumentProposalIds,
  ] = useState<ReadonlySet<string>>(() => new Set());
  const [creatingNoteProposalIds, setCreatingNoteProposalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [creatingSkillProposalIds, setCreatingSkillProposalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [isActivityPaneCollapsed, setIsActivityPaneCollapsed] = useState(false);
  const [visibleAttachedContext, setVisibleAttachedContext] = useState<WorkspaceAgentVisibleContext | null>(null);
  const [isProviderPending, setIsProviderPending] = useState(false);
  const [isSelfTestRunning, setIsSelfTestRunning] = useState(false);
  const workspaceScopeId = workspaceId?.trim() || "__local_workspace__";
  const sessionScopeKey = `${workspaceScopeId}\u0000${instance.id}`;
  const sessionScopeKeyRef = useRef(sessionScopeKey);
  const trimmedDraftLength = draft.trim().length;
  const promptPackImport = useWorkspaceAgentPromptPackImport({
    messageListRef,
    nextMessageId,
    setMessages,
  });
  const currentAgentActivityEvents = (agentActivityEvents ?? []).filter(
    (event) => event.sourceWidgetInstanceId === instance.id,
  );
  const invokeHobitAgentActionRequest = useMemo(
    () =>
      onInvokeHobitAgentActionRequest ??
      createWorkspaceAgentHobitActionInvoker({
        workspaceAgentQueueBridge,
      }),
    [onInvokeHobitAgentActionRequest, workspaceAgentQueueBridge],
  );
  const directWork = useWorkspaceAgentDirectWorkController({
    currentWorkspaceRoot,
    draft,
    instanceId: instance.id,
    isProviderPending,
    onAppendAssistantActionTranscript: appendCoordinatorBrokerActionTranscript,
    onAppendAssistantTranscript: appendCoordinatorDirectWorkTranscript,
    onAppendOperatorTranscript: (body) => {
      setMessages((currentMessages) => [
        ...currentMessages,
        createLocalMessage("operator", body),
      ]);
    },
    onCancelCodexDirectWorkRun,
    onClearDraft: () => setDraft(""),
    onClearVisibleAttachedContext: () => setVisibleAttachedContext(null),
    onFocusComposer: () => {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    onInvokeHobitAgentActionRequest: invokeHobitAgentActionRequest,
    onPublishAgentActivityEvents,
    onRemoveVisibleAttachedContext: removeVisibleAttachedContext,
    onSearchKnowledgeDocuments,
    onStartCodexDirectWorkStream,
    workspaceId,
  });
  const explicitWorkspaceRoot =
    explicitQueueCommandWorkspaceRoot(currentWorkspaceRoot) ??
    explicitQueueCommandWorkspaceRoot(directWork.directWorkDirectory);
  const createQueueItemsFromPromptPackPreviewForCurrentWorkspace: typeof createQueueItemsFromPromptPackPreview = createQueueItemsFromPromptPackPreview ? (preview) => createQueueItemsFromPromptPackPreview(preview, { currentWorkspaceRoot: explicitWorkspaceRoot }) : undefined;
  const isDirectModeEnabled = directWork.isDirectModeEnabled;
  const canSend = !isDirectModeEnabled && trimmedDraftLength > 0 && !isProviderPending;
  const agentSelfTestDisabledReason =
    directWork.directWorkStatus === "running" ? "Agent is running" : null;
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

  useWorkspaceAgentQueueCardRequests({
    createMessage: (input) =>
      createLocalMessage(
        "assistant",
        input.body,
        undefined,
        undefined,
        undefined,
        undefined,
        input.queueReportCardId,
        undefined,
        undefined,
        input.queueTaskStatusCard,
      ),
    messageListRef,
    queueReportActionCardRequest,
    queueTaskStatusCardRequest,
    setMessages,
    setQueueReportCards,
  });
  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
    proposalIds?: string[],
    providerMeta?: CoordinatorProviderMessageMeta,
    planId?: string,
    reviewId?: string,
    queueReportCardId?: string,
    queueActionResultId?: string,
    queueIntentDraftIds?: string[],
    queueTaskStatusCard?: AgentQueueTask,
    promptPackImportId?: string,
    selfTestReportId?: string,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      planId,
      proposalIds,
      providerMeta,
      promptPackImportId,
      queueActionResultId,
      queueIntentDraftIds,
      queueReportCardId,
      queueTaskStatusCard,
      reviewId,
      role,
      selfTestReportId,
      body,
    };
  }

  async function runAgentSelfTest() {
    if (isSelfTestRunning || agentSelfTestDisabledReason) {
      return;
    }

    const selfTestRunId = `agent-self-test-${Date.now().toString()}`;
    setIsSelfTestRunning(true);
    publishSelfTestActivity({
      lifecycleStage: "started",
      runId: selfTestRunId,
      severity: "info",
      status: "running",
      summary: "Safe self-test checks started.",
      title: "Agent self-test started",
    });
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage("assistant", "Agent self-test started."),
    ]);

    try {
      const report = await runWorkspaceAgentSelfTestReport({
        queueAdapterApi:
          createWorkspaceAgentQueueBridgeAdapterApi(workspaceAgentQueueBridge),
        reportId: selfTestRunId,
        widgetInstanceId: instance.id,
        workspaceId: workspaceScopeId,
        workspaceRoot: currentWorkspaceRoot ?? directWork.directWorkDirectory,
      });

      setSelfTestReports((currentReports) => ({
        ...currentReports,
        [report.reportId]: report,
      }));
      setMessages((currentMessages) => [
        ...currentMessages,
        createLocalMessage(
          "assistant",
          `Agent self-test completed. ${report.productSummary}`,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          report.reportId,
        ),
      ]);
      publishSelfTestActivity({
        lifecycleStage:
          report.overallStatus === "failed" ? "failed" : "completed",
        runId: selfTestRunId,
        severity:
          report.overallStatus === "failed"
            ? "error"
            : report.overallStatus === "blocked"
              ? "warning"
              : "success",
        status: report.overallStatus === "failed" ? "failed" : "completed",
        summary: report.productSummary,
        title:
          report.overallStatus === "failed"
            ? "Agent self-test failed"
            : "Agent self-test completed",
      });
    } catch (error) {
      const message = errorToMessage(error, "Agent self-test failed.");
      setMessages((currentMessages) => [
        ...currentMessages,
        createLocalMessage("assistant", `Agent self-test failed. ${message}`),
      ]);
      publishSelfTestActivity({
        lifecycleStage: "failed",
        runId: selfTestRunId,
        severity: "error",
        status: "failed",
        summary: message,
        title: "Agent self-test failed",
      });
    } finally {
      setIsSelfTestRunning(false);
    }
  }

  async function sendCoordinatorMessage() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isProviderPending) {
      return;
    }

    if (await sendProductActionConfirmationFromDraft(trimmedDraft)) {
      return;
    }

    if (await sendKnowledgeCommandFromDraft(trimmedDraft)) {
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
    const queueIntentDraftsFromMessage =
      workspaceAgentQueueIntentDraftsFromText(
        trimmedDraft,
        assistantMessageId,
        {
          includePlainTextIntents: true,
          source: "local_text",
        },
      );
    const queueIntentDraftIds = queueIntentDraftsFromMessage.map(
      (queueIntentDraft) => queueIntentDraft.id,
    );
    const assistantMessage = createLocalMessage(
      "assistant",
      onGenerateCoordinatorProviderResponse
        ? "Drafting from the visible chat."
        : queueIntentDraftIds.length > 0 &&
            generated.proposals.length === 0 &&
            !generated.plan &&
            !generated.review
          ? "I drafted a Queue intent card from the visible chat. Review or edit the visible fields before applying it through the Queue API."
          : generated.responseBody,
      generatedProposalIds.length > 0 ? generatedProposalIds : undefined,
      onGenerateCoordinatorProviderResponse
        ? coordinatorProviderPendingMeta(generatedProposalIds.length)
        : coordinatorProviderFallbackMeta(
            "Provider API unavailable in this runtime. Local deterministic response only.",
          ),
      generated.plan?.id,
      generated.review?.id,
      undefined,
      undefined,
      queueIntentDraftIds.length > 0 ? queueIntentDraftIds : undefined,
    );
    const providerConversation = [...messages, operatorMessage];

    if (queueIntentDraftsFromMessage.length > 0) {
      setQueueIntentDrafts((currentDrafts) => ({
        ...currentDrafts,
        ...Object.fromEntries(
          queueIntentDraftsFromMessage.map((queueIntentDraft) => [
            queueIntentDraft.id,
            queueIntentDraft,
          ]),
        ),
      }));
    }

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
      const providerQueueIntentDrafts =
        workspaceAgentQueueIntentDraftsFromText(
          assistantText,
          assistantMessage.id,
          { source: "provider_text" },
        );
      const providerQueueIntentDraftIds = providerQueueIntentDrafts.map(
        (queueIntentDraft) => queueIntentDraft.id,
      );

      if (providerProposals.length > 0) {
        setProposals((currentProposals) => ({
          ...currentProposals,
          ...Object.fromEntries(
            providerProposals.map((proposal) => [proposal.id, proposal]),
          ),
        }));
      }

      if (providerQueueIntentDrafts.length > 0) {
        setQueueIntentDrafts((currentDrafts) => ({
          ...currentDrafts,
          ...Object.fromEntries(
            providerQueueIntentDrafts.map((queueIntentDraft) => [
              queueIntentDraft.id,
              queueIntentDraft,
            ]),
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
        queueIntentDraftIds:
          providerQueueIntentDraftIds.length > 0
            ? providerQueueIntentDraftIds
            : assistantMessage.queueIntentDraftIds,
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

  async function sendProductActionConfirmationFromDraft(trimmedDraft: string) {
    if (!trimmedDraft || isProviderPending) {
      return false;
    }

    const result = await runWorkspaceAgentProductActionConfirmation({
      createQueueItemsFromPromptPackPreview: createQueueItemsFromPromptPackPreviewForCurrentWorkspace,
      imports: promptPackImport.imports,
      onCancelPromptPackImport: promptPackImport.cancel, onPatchPromptPackImport: promptPackImport.patch,
      onStartPromptPackImportPreview: promptPackImport.startFromOperatorMessage,
      text: trimmedDraft,
    });

    if (!result.handled) {
      return false;
    }

    if (result.transcriptHandled) {
      setDraft("");
      setVisibleAttachedContext(null);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return true;
    }

    appendLocalExchange(trimmedDraft, result.body);
    return true;
  }

  function appendLocalExchange(operatorBody: string, assistantBody: string) {
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage("operator", operatorBody),
      createLocalMessage("assistant", assistantBody),
    ]);
    setDraft("");
    setVisibleAttachedContext(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function hasPendingPromptPackImport() {
    return Object.values(promptPackImport.imports).some(
      (promptPackImportState) =>
        !promptPackImportState.result && !promptPackImportState.isCancelled,
    );
  }

  async function sendKnowledgeCommandFromDraft(trimmedDraft: string) {
    return sendWorkspaceAgentKnowledgeCommandFromDraft({
      createLocalMessage,
      getKnowledgeDocument: onGetKnowledgeDocument,
      isProviderPending,
      onFocusComposer: () => textareaRef.current?.focus(),
      onMessages: (operatorMessage, assistantMessage) => {
        setMessages((currentMessages) => [
          ...currentMessages,
          operatorMessage,
          assistantMessage,
        ]);
      },
      onSetDraft: setDraft,
      onSetVisibleContext: setVisibleAttachedContext,
      rawDraft: trimmedDraft,
      searchKnowledgeDocuments: onSearchKnowledgeDocuments,
    });
  }

  function resetCurrentSessionState() {
    nextMessageId.current = 1;
    setMessages(INITIAL_MESSAGES);
    setPlans({});
    setReviews({});
    setProposals({});
    setQueueReportCards({});
    setQueueReportActionResults({});
    setQueueActionResults({});
    setQueueIntentDrafts({});
    setSelfTestReports({});
    promptPackImport.reset();
    setCreatingQueueProposalIds(new Set());
    setCreatingKnowledgeDocumentProposalIds(new Set());
    setCreatingNoteProposalIds(new Set());
    setCreatingSkillProposalIds(new Set());
    setDraft("");
    setVisibleAttachedContext(null);
    setIsProviderPending(false);
    setIsSelfTestRunning(false);
    directWork.resetDirectWorkSession();
  }

  function publishSelfTestActivity({
    lifecycleStage,
    runId,
    severity,
    status,
    summary,
    title,
  }: {
    lifecycleStage: AgentActivityLifecycleStage;
    runId: string;
    severity: AgentActivitySeverity;
    status: AgentActivityStatus;
    summary: string;
    title: string;
  }) {
    const event: AgentActivityEvent = {
      id: `${workspaceScopeId}:${instance.id}:${runId}:${lifecycleStage}:${status}:${title}`,
      lifecycleStage,
      runKind: "workspace-agent-self-test",
      runId,
      severity,
      sourceKind: "workspace-agent",
      sourceLabel: "Workspace Agent",
      sourceWidgetInstanceId: instance.id,
      status,
      summary,
      timestamp: Date.now(),
      timestampLabel: "0s",
      title,
      workspaceId: workspaceScopeId,
    };
    onPublishAgentActivityEvents?.([event]);
  }

  function appendCoordinatorDirectWorkTranscript(
    status: CoordinatorDirectWorkStatus,
    reason: string,
    useDirectBody = false,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) {
    appendWorkspaceAgentDirectWorkTranscript({
      createMessage: (role, body) => createLocalMessage(role, body),
      reason,
      runMetadata,
      setMessages,
      setProposals,
      setQueueIntentDrafts,
      status,
      useDirectBody,
    });
  }

  function appendCoordinatorBrokerActionTranscript(
    body: string,
    runMetadata?: WorkspaceAgentRunMetadata,
  ) {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        ...createLocalMessage("assistant", body),
        runMetadata,
      },
    ]);
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

  function patchQueueReportCard(
    cardId: string,
    patch: WorkspaceAgentQueueReportActionCardPatch,
  ) {
    setQueueReportCards((currentCards) => {
      const card = currentCards[cardId];

      if (!card) {
        return currentCards;
      }

      return {
        ...currentCards,
        [cardId]: {
          ...card,
          ...patch,
        },
      };
    });
  }

  function recordQueueReportActionResult(
    cardId: string,
    actionType: AgentQueueReportActionType,
    result: WorkspaceAgentQueueReportActionResult,
  ) {
    setQueueReportActionResults((currentResults) => ({
      ...currentResults,
      [cardId]: {
        ...(currentResults[cardId] ?? {}),
        [actionType]: result,
      },
    }));
  }

  function recordQueueActionResult(result: WorkspaceAgentQueueActionCardResult) {
    const resultId = `queue-action-${nextMessageId.current}`;
    setQueueActionResults((currentResults) => ({
      ...currentResults,
      [resultId]: result,
    }));
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage(
        "assistant",
        workspaceAgentQueueActionCardTitle(result),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        resultId,
      ),
    ]);
  }

  function patchQueueIntentDraft(
    draftId: string,
    patch: Partial<WorkspaceAgentQueueIntentDraft>,
  ) {
    setQueueIntentDrafts((currentDrafts) => {
      const queueIntentDraft = currentDrafts[draftId];

      if (!queueIntentDraft) {
        return currentDrafts;
      }

      return {
        ...currentDrafts,
        [draftId]: {
          ...queueIntentDraft,
          ...patch,
        } as WorkspaceAgentQueueIntentDraft,
      };
    });
  }

  function discardQueueIntentDraft(draftId: string) {
    setQueueIntentDrafts((currentDrafts) => {
      if (!currentDrafts[draftId]) {
        return currentDrafts;
      }

      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[draftId];
      return nextDrafts;
    });
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.queueIntentDraftIds?.includes(draftId)
          ? {
              ...message,
              queueIntentDraftIds: message.queueIntentDraftIds.filter(
                (queueIntentDraftId) => queueIntentDraftId !== draftId,
              ),
            }
          : message,
      ),
    );
  }

  async function createQueueTaskFromProposal(proposalId: string) {
    await runCreateQueueTaskProposal({
      currentWorkspaceRoot: explicitWorkspaceRoot,
      pendingProposalIds: creatingQueueProposalIds,
      proposalId,
      proposals,
      setPendingProposalIds: setCreatingQueueProposalIds,
      setProposals,
      workspaceAgentQueueBridge,
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
        <WorkspaceAgentHeaderStatus
          isActivityVisible={!isActivityPaneCollapsed}
          agentSelfTestDisabledReason={agentSelfTestDisabledReason}
          isAgentSelfTestRunning={isSelfTestRunning}
          onActivityToggle={() =>
            setIsActivityPaneCollapsed((current) => !current)
          }
          onAgentSelfTestClick={() => void runAgentSelfTest()}
          onPromptPackImportClick={promptPackImport.start}
          onPromptExampleClick={useSuggestedPrompt}
          promptExamples={WORKSPACE_AGENT_SUGGESTED_PROMPTS}
          status={directWork.directWorkStatus}
        />
      }
      title={title}
    >
      <div className={isActivityPaneCollapsed ? "interactive-agent-chat interactive-agent-chat-activity-collapsed" : "interactive-agent-chat"}>
        <WorkspaceAgentTranscript
          creatingKnowledgeDocumentProposalIds={
            creatingKnowledgeDocumentProposalIds
          }
          creatingNoteProposalIds={creatingNoteProposalIds}
          creatingQueueProposalIds={creatingQueueProposalIds}
          messages={messages}
          onApproveAllQueueDrafts={approveAllQueueDrafts}
          onApproveProposal={approveProposal}
          onCreateKnowledgeDocument={(proposalId) => void createKnowledgeDocumentFromProposal(proposalId)}
          onCreateNote={(proposalId) => void createNoteFromProposal(proposalId)}
          onCreateQueueTask={(proposalId) => void createQueueTaskFromProposal(proposalId)}
          onCreateQueueTaskFromReportCard={onCreateAgentQueueTask}
          onCreateSkill={(proposalId) => void createSkillFromProposal(proposalId)}
          onEditProposal={editProposal}
          onOpenAgentQueueItem={onOpenAgentQueueItem}
          onDiscardQueueIntentDraft={discardQueueIntentDraft}
          onPatchQueueReportCard={patchQueueReportCard}
          onPatchQueueIntentDraft={patchQueueIntentDraft}
          onCancelPromptPackImport={promptPackImport.cancel}
          onPatchPromptPackImport={promptPackImport.patch} onReadPromptPackSource={onReadPromptPackSource} onSelectPromptPackFolder={onSelectWorkspaceDirectory}
          onQueueActionResult={recordQueueActionResult}
          onQueueReportActionResult={recordQueueReportActionResult}
          onViewQueueTaskReport={onOpenAgentQueueItem}
          onRejectProposal={rejectProposal}
          onSuggestionClick={useSuggestedPrompt}
          onUpdateQueueTaskFromReportCard={onUpdateAgentQueueTask}
          plans={plans}
          proposals={proposals}
          queueActionResults={queueActionResults}
          queueIntentDrafts={queueIntentDrafts}
          promptPackImports={promptPackImport.imports}
          queueReportActionResults={queueReportActionResults}
          queueReportCards={queueReportCards}
          reviews={reviews}
          selfTestReports={selfTestReports}
          suggestedPrompts={WORKSPACE_AGENT_SUGGESTED_PROMPTS}
          transcriptRef={messageListRef}
          queueController={agentQueueController}
          createQueueItemsFromPromptPackPreview={createQueueItemsFromPromptPackPreviewForCurrentWorkspace}
          workspaceAgentQueueBridge={workspaceAgentQueueBridge} workspaceChatValidationRunner={queueValidationRunner}
        />
        <WorkspaceAgentComposer
          canSend={canSend}
          directMode={
            isDirectModeEnabled
              ? {
                  activitySummary: directWork.directWorkActivitySummary,
                  canStartDirectWork: directWork.canStartDirectWork,
                  canStopDirectWork: directWork.canStopDirectWork,
                  directWorkDirectory: directWork.directWorkDirectory,
                  directWorkSandbox: directWork.directWorkSandbox,
                  error: directWork.directWorkError,
                  finalResult: directWork.directWorkFinalResult,
                  isStopPending: directWork.isDirectWorkStopPending,
                  knowledgeLookup: directWork.workspaceKnowledgeLookup,
                  logs: directWork.directWorkLogs,
                  onDirectoryChange: directWork.handleWorkingDirectoryChange,
                  onSandboxChange: directWork.handleSandboxChange,
                  onSelectWorkspaceDirectory,
                  onStopDirectWork: () => void directWork.handleStopDirectWork(),
                  runId: directWork.directWorkRunId,
                  runMetadata: directWork.directWorkRunMetadata,
                  status: directWork.directWorkStatus,
                  stopNotice: directWork.directWorkStopNotice,
                  threadId: directWork.activeThreadId,
                  threadNotice: directWork.threadNotice,
                  warning: directWork.directWorkWarning,
                }
              : null
          }
          draft={draft}
          isProviderPending={isProviderPending}
          onMessageChange={setDraft}
          onRemoveVisibleContext={removeVisibleAttachedContext}
          onRunWithCodex={async ({ startNewThread } = {}) => {
            if (await sendProductActionConfirmationFromDraft(draft.trim())) {
              return;
            }

            if (await sendKnowledgeCommandFromDraft(draft.trim())) {
              return;
            }

            await directWork.handleRunWithCodex({ startNewThread });
          }}
          onSend={sendCoordinatorMessage}
          textareaRef={textareaRef}
          visibleAttachedContext={visibleAttachedContext}
        />
        {isActivityPaneCollapsed ? null : (
          <WorkspaceAgentActivitySidePane
            events={currentAgentActivityEvents}
            onRequestCollapse={() => setIsActivityPaneCollapsed(true)}
          />
        )}
      </div>
    </WidgetFrame>
  );
}
