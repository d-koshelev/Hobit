import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  CoordinatorActionProposal,
  CoordinatorProposalInput,
} from "./coordinatorActionProposalRegistry";
import {
  formatProposalDetails,
  getProposalCardState,
  isSqlSuggestionInput,
  proposalInputValue,
  type ProposalResultDisplay,
} from "./coordinatorActionProposalCardState";

type ProposalPatch = {
  expectedResult: string;
  inputs: CoordinatorProposalInput[];
  intent: string;
};

type CoordinatorActionProposalCardProps = {
  isNoteCreationPending?: boolean;
  isQueueTaskCreationPending?: boolean;
  onApprove: (proposalId: string) => void;
  onCreateNote?: (proposalId: string) => void;
  onCreateQueueTask?: (proposalId: string) => void;
  onEdit: (proposalId: string, patch: ProposalPatch) => void;
  onReject: (proposalId: string) => void;
  proposal: CoordinatorActionProposal;
};

export function CoordinatorActionProposalCard({
  isNoteCreationPending = false,
  isQueueTaskCreationPending = false,
  onApprove,
  onCreateNote,
  onCreateQueueTask,
  onEdit,
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

  const hasCreatedNote = Boolean(proposal.createdNoteId);
  const hasCreatedQueueTask = Boolean(proposal.createdQueueTaskId);
  const isCreateNoteProposal = proposal.typeId === "create-note";
  const isJdbcQuerySuggestion =
    proposal.typeId === "prepare-jdbc-query-suggestion";
  const isCreateQueueTaskProposal =
    proposal.typeId === "create-agent-queue-task";
  const isApproved = proposal.approvalStatus === "Approved preview";
  const sqlSuggestion = proposalInputValue(proposal, "Suggested SQL text");
  const cardState = getProposalCardState(proposal);
  const canCreateNote =
    isCreateNoteProposal && isApproved && !hasCreatedNote;
  const canCreateQueueTask =
    isCreateQueueTaskProposal && isApproved && !hasCreatedQueueTask;
  const canChangeReviewState =
    !isNoteCreationPending &&
    !isQueueTaskCreationPending &&
    !hasCreatedNote &&
    !hasCreatedQueueTask;
  const queueDraft = isCreateQueueTaskProposal
    ? queueDraftSummary(proposal)
    : null;

  return (
    <section
      aria-label={`Coordinator action proposal: ${proposal.title}`}
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
              {proposal.inputs.map((input) => (
                <div className="coordinator-proposal-input" key={input.label}>
                  <dt>{input.label}</dt>
                  <dd>
                    {isSqlSuggestionInput(input) ? (
                      <pre className="coordinator-proposal-sql">
                        <code>{input.value}</code>
                      </pre>
                    ) : (
                      input.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <details className="coordinator-proposal-safety" open>
            <summary>Risk / safety notes</summary>
            <ul className="coordinator-proposal-risk-list">
              {proposal.riskNotes.map((riskNote) => (
                <li key={riskNote}>{riskNote}</li>
              ))}
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
              disabled={!canChangeReviewState || isApproved}
              onClick={() => onApprove(proposal.id)}
              variant="primary"
            >
              {isApproved ? "Approved" : "Approve"}
            </Button>
            <Button
              disabled={!canChangeReviewState}
              onClick={() => onReject(proposal.id)}
              variant="secondary"
            >
              Reject
            </Button>
            <Button
              disabled={!canChangeReviewState}
              onClick={beginEdit}
              variant="secondary"
            >
              Edit
            </Button>
            {canCreateNote || isNoteCreationPending ? (
              <Button
                disabled={
                  !canCreateNote || isNoteCreationPending || !onCreateNote
                }
                onClick={() => onCreateNote?.(proposal.id)}
                variant="primary"
              >
                {isNoteCreationPending ? "Creating Note" : "Create Note"}
              </Button>
            ) : null}
            {canCreateQueueTask || isQueueTaskCreationPending ? (
              <Button
                disabled={
                  !canCreateQueueTask ||
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
            {isJdbcQuerySuggestion ? (
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
        <p className="coordinator-proposal-section-value">{draft.prompt}</p>
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
      <p className="coordinator-proposal-section-value">{value}</p>
    </div>
  );
}

function ProposalResult({ result }: { result: ProposalResultDisplay }) {
  return (
    <div
      className={`coordinator-proposal-result coordinator-proposal-result-${result.tone}`}
    >
      <p className="coordinator-proposal-section-label">{result.title}</p>
      <p className="coordinator-proposal-section-value">{result.detail}</p>
      {result.summary ? (
        <p className="coordinator-proposal-note">{result.summary}</p>
      ) : null}
    </div>
  );
}
