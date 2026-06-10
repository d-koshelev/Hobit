import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type {
  CoordinatorActionProposal,
  CoordinatorProposalInput,
} from "./coordinatorActionProposalRegistry";
import {
  formatProposalDetails,
  getProposalCardState,
  isSqlSuggestionInput,
  proposalActionState,
  proposalInputValue,
  type ProposalResultDisplay,
} from "./workspaceAgentProposalDisplayState";

type ProposalPatch = {
  expectedResult: string;
  inputs: CoordinatorProposalInput[];
  intent: string;
};

type CoordinatorActionProposalCardProps = {
  isKnowledgeDocumentCreationPending?: boolean;
  isNoteCreationPending?: boolean;
  isQueueTaskCreationPending?: boolean;
  isSkillCreationPending?: boolean;
  onApprove: (proposalId: string) => void;
  onCreateKnowledgeDocument?: (proposalId: string) => void;
  onCreateNote?: (proposalId: string) => void;
  onCreateQueueTask?: (proposalId: string) => void;
  onCreateSkill?: (proposalId: string) => void;
  onEdit: (proposalId: string, patch: ProposalPatch) => void;
  onOpenQueueTask?: (queueItemId: string) => void;
  onReject: (proposalId: string) => void;
  proposal: CoordinatorActionProposal;
};

export function CoordinatorActionProposalCard({
  isKnowledgeDocumentCreationPending = false,
  isNoteCreationPending = false,
  isQueueTaskCreationPending = false,
  isSkillCreationPending = false,
  onApprove,
  onCreateKnowledgeDocument,
  onCreateNote,
  onCreateQueueTask,
  onCreateSkill,
  onEdit,
  onOpenQueueTask,
  onReject,
  proposal,
}: CoordinatorActionProposalCardProps) {
  const editFormId = useId();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [draftExpectedResult, setDraftExpectedResult] = useState(
    proposal.expectedResult,
  );
  const [draftInputs, setDraftInputs] = useState(proposal.inputs);
  const [draftIntent, setDraftIntent] = useState(proposal.intent);
  const [isEditing, setIsEditing] = useState(false);

  function beginEdit() {
    setCopyStatus(null);
    setDraftExpectedResult(proposal.expectedResult);
    setDraftInputs(proposal.inputs);
    setDraftIntent(proposal.intent);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function saveEdit() {
    onEdit(proposal.id, {
      expectedResult: draftExpectedResult.trim(),
      inputs: draftInputs.map((input) => ({
        ...input,
        value: input.value.trim(),
      })),
      intent: draftIntent.trim(),
    });
    setIsEditing(false);
  }

  function updateDraftInput(index: number, value: string) {
    setDraftInputs((currentInputs) =>
      currentInputs.map((input, inputIndex) =>
        inputIndex === index ? { ...input, value } : input,
      ),
    );
  }

  async function copyProposalDetails() {
    setCopyStatus(null);
    const details = formatProposalDetails(proposal);
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable. No action ran.");
      return;
    }

    try {
      await navigator.clipboard.writeText(details);
      setCopyStatus("Copied proposal details. No action ran.");
    } catch {
      setCopyStatus("Copy failed. No action ran.");
    }
  }

  async function copySqlSuggestion() {
    setCopyStatus(null);
    if (!sqlSuggestion) {
      setCopyStatus("No SQL suggestion to copy. No action ran.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable. No SQL ran.");
      return;
    }

    try {
      await navigator.clipboard.writeText(sqlSuggestion);
      setCopyStatus("Copied SQL only. No SQL ran.");
    } catch {
      setCopyStatus("Copy SQL failed. No SQL ran.");
    }
  }

  const sqlSuggestion = proposalInputValue(proposal, "Suggested SQL text");
  const cardState = getProposalCardState(proposal);
  const actions = proposalActionState(proposal, {
    isKnowledgeDocumentCreationPending,
    isNoteCreationPending,
    isQueueTaskCreationPending,
    isSkillCreationPending,
  });
  const queueDraft = actions.isCreateQueueTaskProposal
    ? queueDraftSummary(proposal)
    : null;
  const visibleInputs = proposal.inputs.slice(0, RENDER_MEMORY_CAPS.eventRows);
  const hiddenInputCount = Math.max(0, proposal.inputs.length - visibleInputs.length);

  return (
    <section
      aria-label={`Workspace Agent action proposal: ${proposal.title}`}
      className={`coordinator-proposal-card coordinator-proposal-card-${cardState.tone}`}
    >
      <div className="coordinator-proposal-header">
        <div className="coordinator-proposal-title-copy">
          <p className="coordinator-proposal-kicker">{cardState.typeLabel}</p>
          <h4 className="coordinator-proposal-title">{proposal.title}</h4>
          <dl className="coordinator-proposal-summary">
            <ProposalMeta label="Target" value={proposal.targetWidget} />
            <ProposalMeta label="Capability" value={proposal.targetCapability} />
            <ProposalMeta label="Risk" value={proposal.riskLevel} />
          </dl>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant={cardState.approvalVariant}>
            {proposal.approvalStatus}
          </Badge>
          <Badge variant={cardState.executionVariant}>
            {proposal.executionStatus}
          </Badge>
        </div>
      </div>

      <div
        className={`coordinator-proposal-state coordinator-proposal-state-${cardState.tone}`}
      >
        <span
          aria-hidden="true"
          className={`status-dot status-dot-${cardState.statusDotVariant}`}
        />
        <div className="coordinator-proposal-state-copy">
          <p className="coordinator-proposal-state-label">
            {cardState.stateLabel}
          </p>
          <p className="coordinator-proposal-state-description">
            {cardState.stateDescription}
          </p>
        </div>
      </div>

      {isEditing ? (
        <div
          aria-label="Edit proposal preview fields"
          className="coordinator-proposal-edit"
        >
          <div className="coordinator-proposal-edit-heading">
            <p className="coordinator-proposal-section-label">
              Editing visible proposal fields
            </p>
            <p className="coordinator-proposal-section-value">
              Save changes returns this card to review. No action runs.
            </p>
          </div>
          <label
            className="coordinator-proposal-label"
            htmlFor={`${editFormId}-intent`}
          >
            Intent
          </label>
          <textarea
            className="input coordinator-proposal-textarea"
            id={`${editFormId}-intent`}
            onChange={(event) => setDraftIntent(event.currentTarget.value)}
            rows={2}
            value={draftIntent}
          />
          <div className="coordinator-proposal-input-list">
            {draftInputs.map((input, index) => (
              <label
                className="coordinator-proposal-label"
                htmlFor={`${editFormId}-input-${index}`}
                key={`${input.label}-${index}`}
              >
                {input.label}
                <textarea
                  className="input coordinator-proposal-textarea"
                  id={`${editFormId}-input-${index}`}
                  onChange={(event) =>
                    updateDraftInput(index, event.currentTarget.value)
                  }
                  rows={2}
                  value={input.value}
                />
              </label>
            ))}
          </div>
          <label
            className="coordinator-proposal-label"
            htmlFor={`${editFormId}-expected`}
          >
            Expected result
          </label>
          <textarea
            className="input coordinator-proposal-textarea"
            id={`${editFormId}-expected`}
            onChange={(event) =>
              setDraftExpectedResult(event.currentTarget.value)
            }
            rows={2}
            value={draftExpectedResult}
          />
        </div>
      ) : (
        <>
          {queueDraft ? <QueueDraftWorkItem draft={queueDraft} /> : null}
          <ProposalSection label="Intent" value={proposal.intent} />
          <div className="coordinator-proposal-section">
            <p className="coordinator-proposal-section-label">Visible inputs</p>
            <dl className="coordinator-proposal-inputs">
              {visibleInputs.map((input) => (
                <div className="coordinator-proposal-input" key={input.label}>
                  <dt>{input.label}</dt>
                  <dd>
                    {isSqlSuggestionInput(input) ? (
                      <pre className="coordinator-proposal-sql">
                        <code>
                          {cappedPreviewText(
                            input.value,
                            RENDER_MEMORY_CAPS.transcriptPayloadChars,
                          )}
                        </code>
                      </pre>
                    ) : (
                      cappedPreviewText(
                        input.value,
                        RENDER_MEMORY_CAPS.transcriptPayloadChars,
                      )
                    )}
                  </dd>
                </div>
              ))}
              {hiddenInputCount > 0 ? (
                <div className="coordinator-proposal-input">
                  <dt>Preview capped</dt>
                  <dd>
                    Showing first {visibleInputs.length.toString()} of{" "}
                    {proposal.inputs.length.toString()} input(s).
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <details className="coordinator-proposal-safety" open>
            <summary>Risk / safety notes</summary>
            <ul className="coordinator-proposal-risk-list">
              {proposal.riskNotes.slice(0, RENDER_MEMORY_CAPS.eventRows).map((riskNote, index) => (
                <li key={`${index.toString()}-${riskNote.slice(0, 24)}`}>
                  {cappedPreviewText(
                    riskNote,
                    RENDER_MEMORY_CAPS.transcriptPayloadChars,
                  )}
                </li>
              ))}
              {proposal.riskNotes.length > RENDER_MEMORY_CAPS.eventRows ? (
                <li>Preview capped.</li>
              ) : null}
            </ul>
          </details>
          <ProposalSection
            label="Expected result"
            value={proposal.expectedResult}
          />
          {cardState.result ? (
            <ProposalResult result={cardState.result} />
          ) : null}
        </>
      )}

      <div className="coordinator-proposal-actions">
        {isEditing ? (
          <>
            <Button onClick={saveEdit} variant="primary">
              Save changes
            </Button>
            <Button onClick={cancelEdit} variant="ghost">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={!actions.canChangeReviewState || actions.isApproved}
              onClick={() => onApprove(proposal.id)}
              variant="primary"
            >
              {actions.isApproved ? "Approved" : "Approve"}
            </Button>
            <Button
              disabled={!actions.canChangeReviewState}
              onClick={() => onReject(proposal.id)}
              variant="secondary"
            >
              Reject
            </Button>
            <Button
              disabled={!actions.canChangeReviewState}
              onClick={beginEdit}
              variant="secondary"
            >
              Edit
            </Button>
            {actions.canCreateNote || isNoteCreationPending ? (
              <Button
                disabled={
                  !actions.canCreateNote ||
                  isNoteCreationPending ||
                  !onCreateNote
                }
                onClick={() => onCreateNote?.(proposal.id)}
                variant="primary"
              >
                {isNoteCreationPending ? "Creating Note" : "Create Note"}
              </Button>
            ) : null}
            {actions.canCreateQueueTask || isQueueTaskCreationPending ? (
              <Button
                disabled={
                  !actions.canCreateQueueTask ||
                  isQueueTaskCreationPending ||
                  !onCreateQueueTask
                }
                onClick={() => onCreateQueueTask?.(proposal.id)}
                variant="primary"
              >
                {isQueueTaskCreationPending
                  ? "Creating Queue task"
                  : "Create Queue task"}
              </Button>
            ) : null}
            {actions.hasCreatedQueueTask && proposal.createdQueueTaskId ? (
              <Button
                disabled={!onOpenQueueTask}
                onClick={() =>
                  proposal.createdQueueTaskId
                    ? onOpenQueueTask?.(proposal.createdQueueTaskId)
                    : undefined
                }
                variant="secondary"
              >
                Open task
              </Button>
            ) : null}
            {actions.canCreateKnowledgeDocument ||
            isKnowledgeDocumentCreationPending ? (
              <Button
                disabled={
                  !actions.canCreateKnowledgeDocument ||
                  isKnowledgeDocumentCreationPending ||
                  !onCreateKnowledgeDocument
                }
                onClick={() => onCreateKnowledgeDocument?.(proposal.id)}
                variant="primary"
              >
                {isKnowledgeDocumentCreationPending
                  ? "Creating Document"
                  : "Create Document"}
              </Button>
            ) : null}
            {actions.canCreateSkill || isSkillCreationPending ? (
              <Button
                disabled={
                  !actions.canCreateSkill ||
                  isSkillCreationPending ||
                  !onCreateSkill
                }
                onClick={() => onCreateSkill?.(proposal.id)}
                variant="primary"
              >
                {isSkillCreationPending ? "Creating Skill" : "Create Skill"}
              </Button>
            ) : null}
            {actions.isJdbcQuerySuggestion ? (
              <Button
                disabled={!sqlSuggestion}
                onClick={() => void copySqlSuggestion()}
                variant="secondary"
              >
                Copy SQL
              </Button>
            ) : null}
            <Button onClick={copyProposalDetails} variant="ghost">
              Copy details
            </Button>
          </>
        )}
      </div>
      {copyStatus ? (
        <p aria-live="polite" className="coordinator-proposal-note">
          {copyStatus}
        </p>
      ) : null}
    </section>
  );
}

type QueueDraftSummary = {
  policy: string;
  priority: string;
  prompt: string;
  status: string;
  title: string;
};

function QueueDraftWorkItem({ draft }: { draft: QueueDraftSummary }) {
  return (
    <section
      aria-label={`Draft Queue task: ${draft.title}`}
      className="coordinator-queue-draft"
    >
      <div className="coordinator-queue-draft-heading">
        <div className="coordinator-queue-draft-title-copy">
          <p className="coordinator-proposal-section-label">
            Draft Queue task
          </p>
          <p className="coordinator-queue-draft-title">{draft.title}</p>
        </div>
        <dl className="coordinator-queue-draft-meta">
          <ProposalMeta label="Priority" value={draft.priority} />
          <ProposalMeta label="Policy" value={draft.policy} />
          <ProposalMeta label="Status" value={draft.status} />
        </dl>
      </div>
      <div className="coordinator-queue-draft-prompt">
        <p className="coordinator-proposal-section-label">Prompt preview</p>
        <p className="coordinator-proposal-section-value">
          {cappedPreviewText(
            draft.prompt,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
        </p>
      </div>
      <p className="coordinator-proposal-note">
        Creates a draft task. Does not run it. Queue/Executor run work only
        after explicit operator action.
      </p>
    </section>
  );
}

function queueDraftSummary(
  proposal: CoordinatorActionProposal,
): QueueDraftSummary {
  return {
    policy: proposalInputValue(proposal, "Policy") || "manual",
    priority: proposalInputValue(proposal, "Priority") || "0",
    prompt: proposalInputValue(proposal, "Prompt") || proposal.intent,
    status: proposal.createdQueueTaskId ? "draft/created" : "draft/proposed",
    title: proposalInputValue(proposal, "Title") || proposal.title,
  };
}

function ProposalMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProposalSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinator-proposal-section">
      <p className="coordinator-proposal-section-label">{label}</p>
      <p className="coordinator-proposal-section-value">
        {cappedPreviewText(value, RENDER_MEMORY_CAPS.transcriptPayloadChars)}
      </p>
    </div>
  );
}

function ProposalResult({ result }: { result: ProposalResultDisplay }) {
  return (
    <div
      className={`coordinator-proposal-result coordinator-proposal-result-${result.tone}`}
    >
      <p className="coordinator-proposal-section-label">{result.title}</p>
      <p className="coordinator-proposal-section-value">
        {cappedPreviewText(
          result.detail,
          RENDER_MEMORY_CAPS.transcriptPayloadChars,
        )}
      </p>
      {result.summary ? (
        <p className="coordinator-proposal-note">
          {cappedPreviewText(
            result.summary,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
        </p>
      ) : null}
    </div>
  );
}
