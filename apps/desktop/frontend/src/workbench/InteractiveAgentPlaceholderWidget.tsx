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
import type {
  AgentQueueReportActionCard,
  AgentQueueReportActionType,
} from "../workspace/types";
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
  directWorkFailureTranscriptBody,
  type CoordinatorDirectWorkStatus,
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
import type {
  WorkspaceAgentQueueReportActionCardPatch,
  WorkspaceAgentQueueReportActionResult,
} from "./WorkspaceAgentQueueReportActionCard";
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
import { useWorkspaceAgentDirectWorkController } from "./useWorkspaceAgentDirectWorkController";

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
  onOpenAgentQueueItem,
  onSearchKnowledgeDocuments,
  onCancelCodexDirectWorkRun,
  onLoadLogs,
  onPublishAgentActivityEvents,
  onSelectWorkspaceDirectory,
  onStartCodexDirectWorkStream,
  onUpdateAgentQueueTask,
  queueReportActionCardRequest,
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
  const [queueReportCards, setQueueReportCards] = useState<
    Record<string, AgentQueueReportActionCard>
  >({});
  const [queueReportActionResults, setQueueReportActionResults] = useState<
    Record<string, Record<string, WorkspaceAgentQueueReportActionResult>>
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
  const workspaceScopeId = workspaceId?.trim() || "__local_workspace__";
  const sessionScopeKey = `${workspaceScopeId}\u0000${instance.id}`;
  const sessionScopeKeyRef = useRef(sessionScopeKey);
  const trimmedDraftLength = draft.trim().length;
  const directWork = useWorkspaceAgentDirectWorkController({
    draft,
    instanceId: instance.id,
    isProviderPending,
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
    onPublishAgentActivityEvents,
    onRemoveVisibleAttachedContext: removeVisibleAttachedContext,
    onSearchKnowledgeDocuments,
    onStartCodexDirectWorkStream,
    workspaceId,
  });
  const isDirectModeEnabled = directWork.isDirectModeEnabled;
  const canSend =
    !isDirectModeEnabled && trimmedDraftLength > 0 && !isProviderPending;

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

  useEffect(() => {
    if (!queueReportActionCardRequest) {
      return;
    }

    const card = queueReportActionCardRequest.card;
    setQueueReportCards((currentCards) => ({
      ...currentCards,
      [card.cardId]: card,
    }));
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage(
        "assistant",
        "Report received. Coordinator action required. No final status applied.",
        undefined,
        undefined,
        undefined,
        undefined,
        card.cardId,
      ),
    ]);
    window.setTimeout(() => {
      const messageList = messageListRef.current;

      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
      }
    }, 0);
  }, [queueReportActionCardRequest?.id]);

  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
    proposalIds?: string[],
    providerMeta?: CoordinatorProviderMessageMeta,
    planId?: string,
    reviewId?: string,
    queueReportCardId?: string,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      planId,
      proposalIds,
      providerMeta,
      queueReportCardId,
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

  function resetCurrentSessionState() {
    nextMessageId.current = 1;
    setMessages(INITIAL_MESSAGES);
    setPlans({});
    setReviews({});
    setProposals({});
    setQueueReportCards({});
    setQueueReportActionResults({});
    setCreatingQueueProposalIds(new Set());
    setCreatingKnowledgeDocumentProposalIds(new Set());
    setCreatingNoteProposalIds(new Set());
    setCreatingSkillProposalIds(new Set());
    setDraft("");
    setVisibleAttachedContext(null);
    setIsProviderPending(false);
    directWork.resetDirectWorkSession();
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
        <WorkspaceAgentHeaderStatus status={directWork.directWorkStatus} />
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
          onCreateQueueTaskFromReportCard={onCreateAgentQueueTask}
          onCreateSkill={(proposalId) => void createSkillFromProposal(proposalId)}
          onEditProposal={editProposal}
          onOpenAgentQueueItem={onOpenAgentQueueItem}
          onPatchQueueReportCard={patchQueueReportCard}
          onQueueReportActionResult={recordQueueReportActionResult}
          onRejectProposal={rejectProposal}
          onSuggestionClick={useSuggestedPrompt}
          onUpdateQueueTaskFromReportCard={onUpdateAgentQueueTask}
          plans={plans}
          proposals={proposals}
          queueReportActionResults={queueReportActionResults}
          queueReportCards={queueReportCards}
          reviews={reviews}
          suggestedPrompts={WORKSPACE_AGENT_SUGGESTED_PROMPTS}
          transcriptRef={messageListRef}
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
                  error: directWork.directWorkError,
                  finalResult: directWork.directWorkFinalResult,
                  isStopPending: directWork.isDirectWorkStopPending,
                  knowledgeLookup: directWork.workspaceKnowledgeLookup,
                  logs: directWork.directWorkLogs,
                  onDirectoryChange: directWork.handleWorkingDirectoryChange,
                  onResetThread: directWork.handleNewThread,
                  onSelectWorkspaceDirectory,
                  onStopDirectWork: () => void directWork.handleStopDirectWork(),
                  runId: directWork.directWorkRunId,
                  status: directWork.directWorkStatus,
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
          onRunWithCodex={directWork.handleRunWithCodex}
          onSend={sendCoordinatorMessage}
          textareaRef={textareaRef}
          visibleAttachedContext={visibleAttachedContext}
        />
      </div>
    </WidgetFrame>
  );
}
