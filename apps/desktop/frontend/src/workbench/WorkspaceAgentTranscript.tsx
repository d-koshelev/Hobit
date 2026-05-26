import type { Ref } from "react";
import { Button } from "../design-system/Button";
import type {
  CoordinatorActionProposal,
  CoordinatorProposalInput,
} from "./coordinatorActionProposalRegistry";
import { CoordinatorActionProposalCard } from "./CoordinatorActionProposalCard";
import type {
  CoordinatorOutcomeReviewDraft,
  CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";
import type { CoordinatorProviderMessageMeta } from "./coordinatorProviderRequest";
import { queueDraftReviewState } from "./workspaceAgentProposalState";
import {
  CoordinatorPlanCard,
  CoordinatorReviewCard,
} from "./WorkspaceAgentPlanReviewCards";
import { WorkspaceAgentMessageBubble } from "./WorkspaceAgentMessageBubble";

export type WorkspaceAgentTranscriptMessage = {
  id: string;
  planId?: string;
  proposalIds?: string[];
  providerMeta?: CoordinatorProviderMessageMeta;
  reviewId?: string;
  role: "operator" | "assistant";
  body: string;
};

export type WorkspaceAgentSuggestedPrompt = {
  label: string;
  prompt: string;
};

type ProposalPatch = {
  expectedResult: string;
  inputs: CoordinatorProposalInput[];
  intent: string;
};

const QUEUE_DRAFT_REVIEW_NOTE =
  "Approve all drafts is local review only. Create Queue task stays explicit on each approved draft.";

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
  onCreateSkill,
  onEditProposal,
  onRejectProposal,
  onSuggestionClick,
  plans,
  proposals,
  reviews,
  suggestedPrompts,
  transcriptRef,
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
  onCreateSkill: (proposalId: string) => void;
  onEditProposal: (proposalId: string, patch: ProposalPatch) => void;
  onRejectProposal: (proposalId: string) => void;
  onSuggestionClick: (prompt: string) => void;
  plans: Record<string, CoordinatorPlanDraft>;
  proposals: Record<string, CoordinatorActionProposal>;
  reviews: Record<string, CoordinatorOutcomeReviewDraft>;
  suggestedPrompts: WorkspaceAgentSuggestedPrompt[];
  transcriptRef: Ref<HTMLDivElement>;
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
          {message.proposalIds ? (
            <div className="coordinator-proposal-list">
              <CoordinatorProposalReviewControls
                onApproveAllQueueDrafts={onApproveAllQueueDrafts}
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
                    onApprove={onApproveProposal}
                    onCreateKnowledgeDocument={(proposalId) =>
                      onCreateKnowledgeDocument(proposalId)
                    }
                    onCreateNote={(proposalId) => onCreateNote(proposalId)}
                    onCreateQueueTask={(proposalId) =>
                      onCreateQueueTask(proposalId)
                    }
                    onCreateSkill={(proposalId) => onCreateSkill(proposalId)}
                    onEdit={onEditProposal}
                    onReject={onRejectProposal}
                    proposal={proposal}
                  />
                ) : null;
              })}
            </div>
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
        <p className="coordinator-proposal-section-label">Draft Queue tasks</p>
        <p className="coordinator-proposal-section-value">
          {reviewState.queueDraftCount} drafted, {reviewState.approvedCount}{" "}
          approved, {reviewState.createdCount} created.
        </p>
        <p className="coordinator-proposal-note">{QUEUE_DRAFT_REVIEW_NOTE}</p>
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
