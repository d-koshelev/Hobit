import { Button } from "../design-system/Button";
import type {
  CoordinatorActionProposal,
  CoordinatorProposalInput,
} from "./coordinatorActionProposalRegistry";
import { CoordinatorActionProposalCard } from "./CoordinatorActionProposalCard";
import { queueDraftReviewState } from "./workspaceAgentProposalDisplayState";

export type WorkspaceAgentProposalPatch = {
  expectedResult: string;
  inputs: CoordinatorProposalInput[];
  intent: string;
};

const QUEUE_DRAFT_REVIEW_NOTE =
  "Approve all drafts is local review only. Create Queue task stays explicit on each approved draft.";

export function WorkspaceAgentProposalList({
  creatingKnowledgeDocumentProposalIds,
  creatingNoteProposalIds,
  creatingQueueProposalIds,
  creatingSkillProposalIds,
  onApproveAllQueueDrafts,
  onApproveProposal,
  onCreateKnowledgeDocument,
  onCreateNote,
  onCreateQueueTask,
  onCreateSkill,
  onEditProposal,
  onRejectProposal,
  proposalIds,
  proposals,
}: {
  creatingKnowledgeDocumentProposalIds: ReadonlySet<string>;
  creatingNoteProposalIds: ReadonlySet<string>;
  creatingQueueProposalIds: ReadonlySet<string>;
  creatingSkillProposalIds?: ReadonlySet<string>;
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
  proposalIds: string[];
  proposals: Record<string, CoordinatorActionProposal>;
}) {
  return (
    <div className="coordinator-proposal-list">
      <CoordinatorProposalReviewControls
        onApproveAllQueueDrafts={onApproveAllQueueDrafts}
        proposalIds={proposalIds}
        proposals={proposals}
      />
      {proposalIds.map((proposalId) => {
        const proposal = proposals[proposalId];

        return proposal ? (
          <CoordinatorActionProposalCard
            key={proposal.id}
            isKnowledgeDocumentCreationPending={creatingKnowledgeDocumentProposalIds.has(
              proposal.id,
            )}
            isNoteCreationPending={creatingNoteProposalIds.has(proposal.id)}
            isQueueTaskCreationPending={creatingQueueProposalIds.has(
              proposal.id,
            )}
            isSkillCreationPending={creatingSkillProposalIds?.has(proposal.id)}
            onApprove={onApproveProposal}
            onCreateKnowledgeDocument={onCreateKnowledgeDocument}
            onCreateNote={onCreateNote}
            onCreateQueueTask={onCreateQueueTask}
            onCreateSkill={onCreateSkill}
            onEdit={onEditProposal}
            onReject={onRejectProposal}
            proposal={proposal}
          />
        ) : null;
      })}
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
