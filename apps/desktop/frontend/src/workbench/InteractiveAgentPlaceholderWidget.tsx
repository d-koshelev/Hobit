import { type FormEvent, useId, useRef, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { CoordinatorActionProposalCard } from "./CoordinatorActionProposalCard";
import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  LOCAL_COORDINATOR_SAMPLE_PROPOSALS,
  type CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import type { WidgetRenderProps } from "./types";

type InteractiveAgentMessage = {
  id: string;
  proposalIds?: string[];
  role: "operator" | "assistant";
  body: string;
};

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [
  {
    id: "local-assistant-intro",
    role: "assistant",
    body: "Coordinator Chat is the primary operator chat surface. Provider not connected yet. Widget tools are not enabled yet. No workspace actions are performed in this version.",
    proposalIds: LOCAL_COORDINATOR_SAMPLE_PROPOSALS.map(
      (proposal) => proposal.id,
    ),
  },
];

const LOCAL_PLACEHOLDER_RESPONSE =
  "Coordinator Chat is not connected yet. This message is stored only in this local widget session. Future versions will use approved widget capabilities.";

const APPROVED_PREVIEW_SUMMARY =
  "Approved locally only. Execution bridge is not implemented, and no widget capability was invoked.";

const REJECTED_PREVIEW_SUMMARY =
  "Rejected locally only. No widget capability was invoked.";

const EDITED_PREVIEW_SUMMARY =
  "Edited locally only. Review this preview again before any future handoff.";

const STATIC_PROPOSAL_TYPE_SUMMARY =
  COORDINATOR_ACTION_PROPOSAL_REGISTRY.map(
    (proposalType) => proposalType.displayName,
  ).join(", ");

export function InteractiveAgentPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageId = useRef(1);
  const [messages, setMessages] = useState<InteractiveAgentMessage[]>(
    INITIAL_MESSAGES,
  );
  const [proposals, setProposals] = useState<
    Record<string, CoordinatorActionProposal>
  >(() =>
    Object.fromEntries(
      LOCAL_COORDINATOR_SAMPLE_PROPOSALS.map((proposal) => [
        proposal.id,
        proposal,
      ]),
    ),
  );
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;

  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      role,
      body,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage("operator", trimmedDraft),
      createLocalMessage("assistant", LOCAL_PLACEHOLDER_RESPONSE),
    ]);
    setDraft("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function approveProposal(proposalId: string) {
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        approvalStatus: "Approved preview",
        executionStatus: "Execution bridge not implemented",
        resultSummary: APPROVED_PREVIEW_SUMMARY,
      }),
    );
  }

  function rejectProposal(proposalId: string) {
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        approvalStatus: "Rejected preview",
        executionStatus: "Not run",
        resultSummary: REJECTED_PREVIEW_SUMMARY,
      }),
    );
  }

  function editProposal(
    proposalId: string,
    patch: Pick<
      CoordinatorActionProposal,
      "expectedResult" | "inputs" | "intent"
    >,
  ) {
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        ...patch,
        approvalStatus: "Edited preview",
        executionStatus: "Execution bridge not implemented",
        resultSummary: EDITED_PREVIEW_SUMMARY,
      }),
    );
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Preview</Badge>}
      title={title}
    >
      <div className="interactive-agent-chat">
        <section
          aria-label="Coordinator Chat local-only status"
          className="interactive-agent-status"
        >
          <div className="interactive-agent-status-copy">
            <p className="interactive-agent-title">Coordinator Chat</p>
            <p className="interactive-agent-text">
              Primary operator chat surface.
            </p>
            <p className="interactive-agent-text">Provider not connected yet.</p>
            <p className="interactive-agent-text">
              Widget tools are not enabled yet.
            </p>
            <p className="interactive-agent-text">
              No workspace actions are performed in this version.
            </p>
            <p className="interactive-agent-text">
              Static preview types: {STATIC_PROPOSAL_TYPE_SUMMARY}.
            </p>
          </div>
          <Badge variant="neutral">Local only</Badge>
        </section>

        <div
          aria-label="Local Coordinator Chat transcript"
          aria-live="polite"
          className="interactive-agent-message-list"
          role="log"
        >
          {messages.map((message) => (
            <article
              className={`interactive-agent-message interactive-agent-message-${message.role}`}
              key={message.id}
            >
              <p className="interactive-agent-message-role">
                {message.role === "operator" ? "You" : "Coordinator Chat"}
              </p>
              <p className="interactive-agent-message-body">{message.body}</p>
              {message.proposalIds ? (
                <div className="coordinator-proposal-list">
                  {message.proposalIds.map((proposalId) => {
                    const proposal = proposals[proposalId];

                    return proposal ? (
                      <CoordinatorActionProposalCard
                        key={proposal.id}
                        onApprove={approveProposal}
                        onEdit={editProposal}
                        onReject={rejectProposal}
                        proposal={proposal}
                      />
                    ) : null;
                  })}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form className="interactive-agent-composer" onSubmit={handleSubmit}>
          <label className="interactive-agent-label" htmlFor={textareaId}>
            Message
          </label>
          <textarea
            className="input interactive-agent-input"
            id={textareaId}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Type a local message."
            ref={textareaRef}
            rows={3}
            value={draft}
          />
          <div className="interactive-agent-action-row">
            <p className="interactive-agent-note">Local transcript only.</p>
            <Button disabled={!canSend} type="submit" variant="primary">
              Send
            </Button>
          </div>
        </form>
      </div>
    </WidgetFrame>
  );
}

function updateProposal(
  proposals: Record<string, CoordinatorActionProposal>,
  proposalId: string,
  patch: Partial<CoordinatorActionProposal>,
) {
  const proposal = proposals[proposalId];
  if (!proposal) {
    return proposals;
  }

  return {
    ...proposals,
    [proposalId]: {
      ...proposal,
      ...patch,
    },
  };
}
