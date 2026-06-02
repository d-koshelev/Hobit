import type { Ref } from "react";
import type {
  AgentQueueReportActionCard,
  AgentQueueReportActionType,
  AgentQueueTask,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../workspace/types";
import type {
  CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import type {
  CoordinatorOutcomeReviewDraft,
  CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";
import type { CoordinatorProviderMessageMeta } from "./coordinatorProviderRequest";
import {
  CoordinatorPlanCard,
  CoordinatorReviewCard,
} from "./WorkspaceAgentPlanReviewCards";
import { WorkspaceAgentMessageBubble } from "./WorkspaceAgentMessageBubble";
import {
  WorkspaceAgentProposalList,
  type WorkspaceAgentProposalPatch,
} from "./WorkspaceAgentProposalList";
import {
  WorkspaceAgentQueueReportActionCard,
  type WorkspaceAgentQueueReportActionCardPatch,
  type WorkspaceAgentQueueReportActionResult,
} from "./WorkspaceAgentQueueReportActionCard";
import {
  WorkspaceAgentQueueActionResultCard,
  WorkspaceAgentQueueIntentDraftCard,
} from "./WorkspaceAgentQueueActionCards";
import type {
  WorkspaceAgentQueueActionCardResult,
} from "./workspaceAgentQueueActions";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";
import type {
  WorkspaceAgentSuggestedPrompt,
} from "./workspaceAgentSuggestedPrompts";

export type {
  WorkspaceAgentSuggestedPrompt,
} from "./workspaceAgentSuggestedPrompts";

export type WorkspaceAgentTranscriptMessage = {
  id: string;
  planId?: string;
  proposalIds?: string[];
  providerMeta?: CoordinatorProviderMessageMeta;
  queueActionResultId?: string;
  queueIntentDraftIds?: string[];
  queueReportCardId?: string;
  reviewId?: string;
  role: "operator" | "assistant";
  body: string;
};

export function WorkspaceAgentTranscript({
  creatingKnowledgeDocumentProposalIds,
  creatingNoteProposalIds,
  creatingQueueProposalIds,
  messages,
  onApproveAllQueueDrafts,
  onApproveProposal,
  onCreateKnowledgeDocument,
  onCreateNote,
  onCreateQueueTask,
  onCreateQueueTaskFromReportCard,
  onCreateSkill,
  onDiscardQueueIntentDraft,
  onOpenAgentQueueItem,
  onPatchQueueReportCard,
  onPatchQueueIntentDraft,
  onQueueActionResult,
  onQueueReportActionResult,
  onUpdateQueueTaskFromReportCard,
  onEditProposal,
  onRejectProposal,
  onSuggestionClick,
  plans,
  proposals,
  queueActionResults,
  queueIntentDrafts,
  queueReportActionResults,
  queueReportCards,
  reviews,
  suggestedPrompts,
  transcriptRef,
  workspaceAgentQueueBridge,
}: {
  creatingKnowledgeDocumentProposalIds: ReadonlySet<string>;
  creatingNoteProposalIds: ReadonlySet<string>;
  creatingQueueProposalIds: ReadonlySet<string>;
  messages: WorkspaceAgentTranscriptMessage[];
  onApproveAllQueueDrafts: (proposalIds: string[]) => void;
  onApproveProposal: (proposalId: string) => void;
  onCreateKnowledgeDocument: (proposalId: string) => void;
  onCreateNote: (proposalId: string) => void;
  onCreateQueueTask: (proposalId: string) => void;
  onCreateQueueTaskFromReportCard?: (
    request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onCreateSkill: (proposalId: string) => void;
  onDiscardQueueIntentDraft: (draftId: string) => void;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onPatchQueueReportCard: (
    cardId: string,
    patch: WorkspaceAgentQueueReportActionCardPatch,
  ) => void;
  onPatchQueueIntentDraft: (
    draftId: string,
    patch: Partial<WorkspaceAgentQueueIntentDraft>,
  ) => void;
  onQueueActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
  onQueueReportActionResult: (
    cardId: string,
    actionType: AgentQueueReportActionType,
    result: WorkspaceAgentQueueReportActionResult,
  ) => void;
  onUpdateQueueTaskFromReportCard?: (
    request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask | null>;
  onEditProposal: (
    proposalId: string,
    patch: WorkspaceAgentProposalPatch,
  ) => void;
  onRejectProposal: (proposalId: string) => void;
  onSuggestionClick: (prompt: string) => void;
  plans: Record<string, CoordinatorPlanDraft>;
  proposals: Record<string, CoordinatorActionProposal>;
  queueActionResults: Record<string, WorkspaceAgentQueueActionCardResult>;
  queueIntentDrafts: Record<string, WorkspaceAgentQueueIntentDraft>;
  queueReportActionResults: Record<
    string,
    Record<string, WorkspaceAgentQueueReportActionResult>
  >;
  queueReportCards: Record<string, AgentQueueReportActionCard>;
  reviews: Record<string, CoordinatorOutcomeReviewDraft>;
  suggestedPrompts: WorkspaceAgentSuggestedPrompt[];
  transcriptRef: Ref<HTMLDivElement>;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge;
}) {
  return (
    <div
      aria-label="Local Workspace Agent transcript"
      aria-live="polite"
      className="interactive-agent-message-list"
      ref={transcriptRef}
      role="log"
    >
      {messages.length === 0 ? (
        <WorkspaceAgentTranscriptEmptyState
          onSuggestionClick={onSuggestionClick}
          suggestedPrompts={suggestedPrompts}
        />
      ) : null}
      {messages.map((message) => (
        <WorkspaceAgentMessageBubble
          body={message.body}
          key={message.id}
          providerMeta={message.providerMeta}
          role={message.role}
        >
          {message.planId && plans[message.planId] ? (
            <CoordinatorPlanCard plan={plans[message.planId]} />
          ) : null}
          {message.reviewId && reviews[message.reviewId] ? (
            <CoordinatorReviewCard review={reviews[message.reviewId]} />
          ) : null}
          {message.queueReportCardId &&
          queueReportCards[message.queueReportCardId] ? (
            <WorkspaceAgentQueueReportActionCard
              actionResults={
                queueReportActionResults[message.queueReportCardId] ?? {}
              }
              card={queueReportCards[message.queueReportCardId]}
              onCreateQueueTask={onCreateQueueTaskFromReportCard}
              onOpenQueueItem={onOpenAgentQueueItem}
              onPatchCard={onPatchQueueReportCard}
              onRecordActionResult={onQueueReportActionResult}
              onUpdateQueueTask={onUpdateQueueTaskFromReportCard}
            />
          ) : null}
          {message.queueActionResultId &&
          queueActionResults[message.queueActionResultId] ? (
            <WorkspaceAgentQueueActionResultCard
              result={queueActionResults[message.queueActionResultId]}
            />
          ) : null}
          {message.queueIntentDraftIds
            ? message.queueIntentDraftIds.map((queueIntentDraftId) => {
                const queueIntentDraft = queueIntentDrafts[queueIntentDraftId];

                return queueIntentDraft ? (
                  <WorkspaceAgentQueueIntentDraftCard
                    bridge={workspaceAgentQueueBridge}
                    draft={queueIntentDraft}
                    key={queueIntentDraft.id}
                    onActionResult={onQueueActionResult}
                    onDiscard={onDiscardQueueIntentDraft}
                    onPatchDraft={onPatchQueueIntentDraft}
                  />
                ) : null;
              })
            : null}
          {message.proposalIds ? (
            <WorkspaceAgentProposalList
              creatingKnowledgeDocumentProposalIds={
                creatingKnowledgeDocumentProposalIds
              }
              creatingNoteProposalIds={creatingNoteProposalIds}
              creatingQueueProposalIds={creatingQueueProposalIds}
              onApproveAllQueueDrafts={onApproveAllQueueDrafts}
              onApproveProposal={onApproveProposal}
              onCreateKnowledgeDocument={onCreateKnowledgeDocument}
              onCreateNote={onCreateNote}
              onCreateQueueTask={onCreateQueueTask}
              onCreateSkill={onCreateSkill}
              onEditProposal={onEditProposal}
              onRejectProposal={onRejectProposal}
              proposalIds={message.proposalIds}
              proposals={proposals}
            />
          ) : null}
        </WorkspaceAgentMessageBubble>
      ))}
    </div>
  );
}

function WorkspaceAgentTranscriptEmptyState({
  onSuggestionClick,
  suggestedPrompts,
}: {
  onSuggestionClick: (prompt: string) => void;
  suggestedPrompts: WorkspaceAgentSuggestedPrompt[];
}) {
  return (
    <div className="interactive-agent-empty">
      <p className="interactive-agent-empty-title">
        Start with a planning question or a task draft.
      </p>
      <p className="interactive-agent-empty-text">
        Workspace Agent works from visible chat and explicit attachments.
        Multiple agents can work independently in the same workspace.
      </p>
      <p className="interactive-agent-empty-text">
        Drafts stay inert until you approve them and use the separate create or
        copy action.
      </p>
      <div
        aria-label="Workspace Agent suggested prompts"
        className="interactive-agent-suggestion-list"
      >
        {suggestedPrompts.map((suggestion) => (
          <button
            className="interactive-agent-suggestion"
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            type="button"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
