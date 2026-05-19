import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  CoordinatorActionProposal,
  CoordinatorProposalApprovalStatus,
  CoordinatorProposalInput,
} from "./coordinatorActionProposalRegistry";

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

  const hasCreatedNote = Boolean(proposal.createdNoteId);
  const hasCreatedQueueTask = Boolean(proposal.createdQueueTaskId);
  const isCreateNoteProposal = proposal.typeId === "create-note";
  const isCreateQueueTaskProposal =
    proposal.typeId === "create-agent-queue-task";
  const isApproved = proposal.approvalStatus === "Approved preview";
  const canCreateNote =
    isCreateNoteProposal && isApproved && !hasCreatedNote;
  const canCreateQueueTask =
    isCreateQueueTaskProposal && isApproved && !hasCreatedQueueTask;
  const canChangeReviewState =
    !isNoteCreationPending &&
    !isQueueTaskCreationPending &&
    !hasCreatedNote &&
    !hasCreatedQueueTask;

  return (
    <section
      aria-label={`Coordinator action proposal: ${proposal.title}`}
      className="coordinator-proposal-card"
    >
      <div className="coordinator-proposal-header">
        <div className="coordinator-proposal-title-copy">
          <p className="coordinator-proposal-kicker">
            {isCreateQueueTaskProposal
              ? "Queue task proposal"
              : isCreateNoteProposal
                ? "Note proposal"
              : "Local inert proposal"}
          </p>
          <h4 className="coordinator-proposal-title">{proposal.title}</h4>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant={approvalBadgeVariant(proposal.approvalStatus)}>
            {proposal.approvalStatus}
          </Badge>
          <Badge variant={executionBadgeVariant(proposal.executionStatus)}>
            {proposal.executionStatus}
          </Badge>
        </div>
      </div>

      <div className="coordinator-proposal-meta-grid">
        <ProposalMeta label="Target widget" value={proposal.targetWidget} />
        <ProposalMeta label="Capability" value={proposal.targetCapability} />
        <ProposalMeta label="Risk" value={proposal.riskLevel} />
      </div>

      {isEditing ? (
        <div
          aria-label="Edit proposal preview fields"
          className="coordinator-proposal-edit"
        >
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
          <ProposalSection label="Intent" value={proposal.intent} />
          <div className="coordinator-proposal-section">
            <p className="coordinator-proposal-section-label">Visible inputs</p>
            <dl className="coordinator-proposal-inputs">
              {proposal.inputs.map((input) => (
                <div className="coordinator-proposal-input" key={input.label}>
                  <dt>{input.label}</dt>
                  <dd>{input.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="coordinator-proposal-section">
            <p className="coordinator-proposal-section-label">
              Risk / safety notes
            </p>
            <ul className="coordinator-proposal-risk-list">
              {proposal.riskNotes.map((riskNote) => (
                <li key={riskNote}>{riskNote}</li>
              ))}
            </ul>
          </div>
          <ProposalSection
            label="Expected result"
            value={proposal.expectedResult}
          />
          {proposal.createdQueueTaskId ? (
            <ProposalSection
              label="Created Queue task"
              value={`${proposal.createdQueueTaskTitle ?? "Queue task"} (${proposal.createdQueueTaskId})`}
            />
          ) : null}
          {proposal.createdNoteId ? (
            <ProposalSection
              label="Created Note"
              value={`${proposal.createdNoteTitle ?? "Note"} (${proposal.createdNoteId})`}
            />
          ) : null}
          {proposal.executionError ? (
            <ProposalSection label="Error" value={proposal.executionError} />
          ) : null}
          <ProposalSection
            label="Result summary"
            value={proposal.resultSummary}
          />
        </>
      )}

      <div className="coordinator-proposal-actions">
        {isEditing ? (
          <>
            <Button onClick={saveEdit} variant="primary">
              Save edit
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
            <Button onClick={copyProposalDetails} variant="ghost">
              Copy
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

function ProposalMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinator-proposal-meta">
      <span>{label}</span>
      <strong>{value}</strong>
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

function approvalBadgeVariant(
  status: CoordinatorProposalApprovalStatus,
): "info" | "success" | "warning" | "error" {
  if (status === "Approved preview") {
    return "success";
  }
  if (status === "Rejected preview") {
    return "error";
  }
  if (status === "Edited preview") {
    return "info";
  }
  return "warning";
}

function executionBadgeVariant(
  status: CoordinatorActionProposal["executionStatus"],
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "Queue task created") {
    return "success";
  }
  if (status === "Note created") {
    return "success";
  }
  if (
    status === "Queue task creation failed" ||
    status === "Note creation failed"
  ) {
    return "error";
  }
  if (
    status === "Ready to create Queue task" ||
    status === "Creating Queue task" ||
    status === "Ready to create Note" ||
    status === "Creating Note"
  ) {
    return "info";
  }
  if (status === "Execution bridge not implemented") {
    return "warning";
  }
  return "neutral";
}

function formatProposalDetails(proposal: CoordinatorActionProposal) {
  const inputs = proposal.inputs
    .map((input) => `- ${input.label}: ${input.value}`)
    .join("\n");
  const riskNotes = proposal.riskNotes.map((note) => `- ${note}`).join("\n");

  return [
    `Title: ${proposal.title}`,
    `Target widget: ${proposal.targetWidget}`,
    `Capability: ${proposal.targetCapability}`,
    `Risk: ${proposal.riskLevel}`,
    `Approval status: ${proposal.approvalStatus}`,
    `Execution status: ${proposal.executionStatus}`,
    "",
    `Intent: ${proposal.intent}`,
    "",
    "Visible inputs:",
    inputs,
    "",
    "Risk / safety notes:",
    riskNotes,
    "",
    `Expected result: ${proposal.expectedResult}`,
    proposal.createdQueueTaskId
      ? `Created Queue task: ${proposal.createdQueueTaskTitle ?? "Queue task"} (${proposal.createdQueueTaskId})`
      : null,
    proposal.createdNoteId
      ? `Created Note: ${proposal.createdNoteTitle ?? "Note"} (${proposal.createdNoteId})`
      : null,
    proposal.executionError ? `Error: ${proposal.executionError}` : null,
    `Result summary: ${proposal.resultSummary}`,
    "",
    proposal.typeId === "create-agent-queue-task"
      ? "Queue task creation requires approval and a separate Create Queue task action. No provider runtime, Agent Executor launch, Queue auto-dispatch, Terminal command, Git mutation, or JDBC SQL execution is triggered."
      : proposal.typeId === "create-note"
        ? "Note creation requires approval and a separate Create Note action. No existing Notes content is read, and no provider runtime, Queue task, Agent Executor launch, Terminal command, Git mutation, or JDBC SQL execution is triggered."
        : "Preview only. No backend API, widget mutation, provider runtime, or tool execution ran.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
