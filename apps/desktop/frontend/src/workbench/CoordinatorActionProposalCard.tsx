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
  onApprove: (proposalId: string) => void;
  onEdit: (proposalId: string, patch: ProposalPatch) => void;
  onReject: (proposalId: string) => void;
  proposal: CoordinatorActionProposal;
};

export function CoordinatorActionProposalCard({
  onApprove,
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

  return (
    <section
      aria-label={`Inert action proposal: ${proposal.title}`}
      className="coordinator-proposal-card"
    >
      <div className="coordinator-proposal-header">
        <div className="coordinator-proposal-title-copy">
          <p className="coordinator-proposal-kicker">Local inert proposal</p>
          <h4 className="coordinator-proposal-title">{proposal.title}</h4>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant={approvalBadgeVariant(proposal.approvalStatus)}>
            {proposal.approvalStatus}
          </Badge>
          <Badge variant="neutral">{proposal.executionStatus}</Badge>
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
            <Button onClick={() => onApprove(proposal.id)} variant="primary">
              Approve
            </Button>
            <Button onClick={() => onReject(proposal.id)} variant="secondary">
              Reject
            </Button>
            <Button onClick={beginEdit} variant="secondary">
              Edit
            </Button>
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
    `Result summary: ${proposal.resultSummary}`,
    "",
    "Preview only. No backend API, widget mutation, provider runtime, or tool execution ran.",
  ].join("\n");
}
