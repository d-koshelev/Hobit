import type { Ref } from "react";
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
  onEditProposal: (
    proposalId: string,
    patch: WorkspaceAgentProposalPatch,
  ) => void;
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
