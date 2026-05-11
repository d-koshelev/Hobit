import { useId, useState, type FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  createAgentChatMockProposal,
  type AgentChatMockProposal,
  type AgentChatProposalAction,
} from "./agentChatProposalMock";
import type { WidgetRenderProps } from "./types";

const idleActivity = [
  "Idle: no prompt submitted in this local mock runtime.",
  "No approved context selected.",
  "No tools executed.",
];

export function OperationalAgentChatPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const promptId = useId();
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<AgentChatMockProposal | null>(null);
  const trimmedPrompt = prompt.trim();
  const canGenerateProposal = trimmedPrompt.length > 0;
  const localActivity = proposal
    ? [
        "Prompt received by local mock runtime.",
        "Mock proposal generated.",
        "No tools executed and no workspace mutation performed.",
      ]
    : idleActivity;

  function generateProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canGenerateProposal) {
      return;
    }

    const nextSequence = proposal ? proposal.sequence + 1 : 1;
    setProposal(createAgentChatMockProposal(prompt, nextSequence));
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Proposal only</Badge>}
      title={title}
    >
      <div className="agent-chat-proposal-widget">
        <section
          aria-label="Agent Chat local mock prompt"
          className="agent-chat-proposal-panel"
        >
          <div className="agent-chat-proposal-header">
            <div className="agent-chat-proposal-copy">
              <p className="agent-chat-proposal-title">
                Local/mock coordinator proposal
              </p>
              <p className="agent-chat-proposal-text">
                Type an operator request to generate a structured proposal
                preview. No LLM is connected, no tools run, and no workspace
                state is mutated.
              </p>
            </div>
            <Badge variant="neutral">No execution</Badge>
          </div>

          <form className="agent-chat-prompt-form" onSubmit={generateProposal}>
            <label className="agent-chat-prompt-label" htmlFor={promptId}>
              Operator prompt
            </label>
            <textarea
              className="input agent-chat-prompt-textarea"
              id={promptId}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe what the coordinator should propose..."
              value={prompt}
            />
            <div className="agent-chat-prompt-actions">
              <Button
                disabled={!canGenerateProposal}
                type="submit"
                variant="primary"
              >
                Generate proposal
              </Button>
              <Button disabled variant="secondary">
                Apply proposal planned
              </Button>
            </div>
          </form>
        </section>

        {proposal ? (
          <AgentChatProposalPreview proposal={proposal} />
        ) : (
          <section
            aria-label="Empty Agent Chat proposal preview"
            className="agent-chat-proposal-panel agent-chat-proposal-empty"
          >
            <p className="agent-chat-proposal-title">No proposal generated</p>
            <p className="agent-chat-proposal-text">
              The next submission will create a local structured preview only.
              It will not read hidden context, create Queue items, execute
              Terminal commands, or change Notes, Git, Workspace state, or
              files.
            </p>
          </section>
        )}

        <section
          aria-label="Agent Chat local mock activity"
          className="agent-chat-proposal-panel agent-chat-local-activity"
        >
          <div className="agent-chat-proposal-header">
            <div className="agent-chat-proposal-copy">
              <p className="agent-chat-proposal-title">Local mock activity</p>
              <p className="agent-chat-proposal-text">
                Frontend-only status for this widget instance.
              </p>
            </div>
            <Badge variant="neutral">Not persisted</Badge>
          </div>
          <ul className="agent-chat-list">
            {localActivity.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </WidgetFrame>
  );
}

function AgentChatProposalPreview({
  proposal,
}: {
  proposal: AgentChatMockProposal;
}) {
  return (
    <section
      aria-label="Agent Chat structured proposal preview"
      aria-live="polite"
      className="agent-chat-proposal-panel agent-chat-proposal-output"
    >
      <div className="agent-chat-proposal-header">
        <div className="agent-chat-proposal-copy">
          <p className="agent-chat-proposal-title">Structured proposal preview</p>
          <p className="agent-chat-proposal-text">{proposal.requestSummary}</p>
        </div>
        <Badge variant="info">Proposal only</Badge>
      </div>

      <ProposalSection
        items={proposal.proposedPlan}
        title="Proposed next steps"
      />
      <ProposalSection
        items={proposal.contextNeeded}
        title="Required context"
      />
      <ActionProposalSection actions={proposal.actionProposals} />
      <ProposalSection
        items={proposal.safetyNotes}
        title="Risks and approval notes"
      />
      <ProposalSection items={proposal.runtimeNotes} title="Runtime status" />
    </section>
  );
}

function ProposalSection({
  items,
  title,
}: {
  items: readonly string[];
  title: string;
}) {
  return (
    <div className="agent-chat-proposal-section">
      <p className="agent-chat-proposal-section-title">{title}</p>
      <ul className="agent-chat-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ActionProposalSection({
  actions,
}: {
  actions: readonly AgentChatProposalAction[];
}) {
  return (
    <div className="agent-chat-proposal-section">
      <p className="agent-chat-proposal-section-title">
        Tool/action proposals
      </p>
      <div className="agent-chat-action-list">
        {actions.map((action) => (
          <div className="agent-chat-action-proposal" key={action.title}>
            <div className="agent-chat-action-header">
              <p className="agent-chat-action-title">{action.title}</p>
              <Badge variant="neutral">
                {formatActionStatus(action.status)}
              </Badge>
            </div>
            <p className="agent-chat-proposal-text">{action.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatActionStatus(status: AgentChatProposalAction["status"]) {
  return status === "not-executed" ? "Not executed" : status;
}
