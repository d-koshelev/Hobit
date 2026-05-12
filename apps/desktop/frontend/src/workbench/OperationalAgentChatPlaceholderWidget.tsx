import { useId, useMemo, useState, type FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { PersistAgentChatProposalResponse } from "../workspace/types";
import { AgentChatApprovedContextSection } from "./AgentChatApprovedContextSection";
import {
  createAgentChatApprovedContextSnapshot,
  emptyAgentChatApprovedContextSelection,
  type AgentChatApprovedContextSelection,
  type AgentChatApprovedContextSnapshot,
  type AgentChatContextSourceId,
} from "./agentChatApprovedContext";
import { useAgentChatAvailableContext } from "./AgentChatContextProvider";
import {
  createAgentChatMockProposal,
  type AgentChatMockProposal,
  type AgentChatProposalAction,
} from "./agentChatProposalMock";
import type { WidgetRenderProps } from "./types";

const idleActivity = [
  "Idle: no proposal requested yet.",
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
  onPersistAgentChatProposal,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const promptId = useId();
  const availableContext = useAgentChatAvailableContext();
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<AgentChatMockProposal | null>(null);
  const [persistenceState, setPersistenceState] =
    useState<ProposalPersistenceState>({
      status: "idle",
    });
  const [contextSelection, setContextSelection] =
    useState<AgentChatApprovedContextSelection>(
      emptyAgentChatApprovedContextSelection,
    );
  const trimmedPrompt = prompt.trim();
  const isPersistingProposal = persistenceState.status === "persisting";
  const canGenerateProposal = trimmedPrompt.length > 0 && !isPersistingProposal;
  const approvedContextPreview = useMemo(
    () =>
      createAgentChatApprovedContextSnapshot(
        availableContext,
        contextSelection,
      ),
    [availableContext, contextSelection],
  );
  const localActivity = proposal
    ? [
        "Prompt received by local mock runtime.",
        "Mock proposal generated.",
        proposal.approvedContextSnapshot.status === "approved"
          ? "Selected context included."
          : "No context approved; prompt-only proposal generated.",
        persistenceActivityLine(persistenceState),
        "No tools executed and no workspace content mutation performed.",
      ]
    : idleActivity;

  function updateContextSelection(
    sourceId: AgentChatContextSourceId,
    isSelected: boolean,
  ) {
    setContextSelection((currentSelection) => ({
      ...currentSelection,
      [sourceId]: isSelected,
    }));
  }

  async function generateProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canGenerateProposal) {
      return;
    }

    const nextSequence = proposal ? proposal.sequence + 1 : 1;
    const nextProposal = createAgentChatMockProposal(
      prompt,
      nextSequence,
      approvedContextPreview,
    );
    setProposal(nextProposal);
    await persistProposal(nextProposal);
  }

  async function persistProposal(nextProposal: AgentChatMockProposal) {
    if (!onPersistAgentChatProposal) {
      setPersistenceState({
        message:
          "Proposal preview generated locally. Persistence is unavailable in this runtime.",
        status: "unsupported",
      });
      return;
    }

    setPersistenceState({ status: "persisting" });

    try {
      const response = await onPersistAgentChatProposal(instance.id, {
        approvedContextSnapshotJson: JSON.stringify(
          nextProposal.approvedContextSnapshot,
        ),
        operatorPrompt: nextProposal.prompt,
        proposal: agentChatProposalPersistPayload(nextProposal),
      });

      if (!response) {
        setPersistenceState({
          message:
            "Proposal persistence was not accepted for this Agent Chat widget instance.",
          status: "failed",
        });
        return;
      }

      setPersistenceState({
        response,
        status: "persisted",
      });
    } catch (error) {
      setPersistenceState({
        message: errorToMessage(error),
        status: isUnsupportedPersistenceError(error)
          ? "unsupported"
          : "failed",
      });
    }
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
                Ask for a proposal
              </p>
              <p className="agent-chat-proposal-text">
                Generate a local proposal from your prompt and approved
                context. No LLM is connected yet; no tools run and nothing
                mutates.
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
                {isPersistingProposal ? "Persisting..." : "Generate proposal"}
              </Button>
            </div>
          </form>
        </section>

        <AgentChatApprovedContextSection
          isContextAvailable={Boolean(availableContext)}
          onSelectionChange={updateContextSelection}
          selection={contextSelection}
          snapshot={approvedContextPreview}
        />

        {proposal ? (
          <AgentChatProposalPreview
            persistenceState={persistenceState}
            proposal={proposal}
          />
        ) : (
          <section
            aria-label="Empty Agent Chat proposal preview"
            className="agent-chat-proposal-panel agent-chat-proposal-empty"
          >
            <p className="agent-chat-proposal-title">No proposal generated</p>
            <p className="agent-chat-proposal-text">
              Submit a prompt to create a local proposal preview. Desktop mode
              saves a proposal artifact that can be inspected in Agent
              Monitoring.
            </p>
          </section>
        )}

        <section
          aria-label="Agent Chat local mock activity"
          className="agent-chat-proposal-panel agent-chat-local-activity"
        >
          <div className="agent-chat-proposal-header">
            <div className="agent-chat-proposal-copy">
              <p className="agent-chat-proposal-title">Proposal status</p>
              <p className="agent-chat-proposal-text">
                Local generation and saved artifact status.
              </p>
            </div>
            {persistenceBadge(persistenceState)}
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

type ProposalPersistenceState =
  | {
      status: "idle" | "persisting";
    }
  | {
      message: string;
      status: "failed" | "unsupported";
    }
  | {
      response: PersistAgentChatProposalResponse;
      status: "persisted";
    };

function AgentChatProposalPreview({
  persistenceState,
  proposal,
}: {
  persistenceState: ProposalPersistenceState;
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
      <ContextUsedSection snapshot={proposal.approvedContextSnapshot} />
      <ProposalSection
        items={proposal.safetyNotes}
        title="Risks and approval notes"
      />
      <ProposalSection items={proposal.runtimeNotes} title="Runtime status" />
      <PersistenceStatusSection persistenceState={persistenceState} />
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

function ContextUsedSection({
  snapshot,
}: {
  snapshot: AgentChatApprovedContextSnapshot;
}) {
  return (
    <div className="agent-chat-proposal-section">
      <p className="agent-chat-proposal-section-title">Context used</p>
      <p className="agent-chat-proposal-text">{snapshot.summary}</p>
      {snapshot.items.length > 0 ? (
        <div className="agent-chat-context-preview-groups">
          {snapshot.items.map((item) => (
            <div
              className="agent-chat-context-preview-group"
              key={item.sourceId}
            >
              <p className="agent-chat-context-preview-title">{item.title}</p>
              <ul className="agent-chat-list">
                {item.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
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

function PersistenceStatusSection({
  persistenceState,
}: {
  persistenceState: ProposalPersistenceState;
}) {
  if (persistenceState.status === "idle") {
    return null;
  }

  if (persistenceState.status === "persisting") {
    return (
      <div className="agent-chat-proposal-section">
        <p className="agent-chat-proposal-section-title">Persisted result</p>
        <p className="agent-chat-proposal-text">
          Persisting proposal-only widget run/result artifact...
        </p>
      </div>
    );
  }

  if (persistenceState.status === "persisted") {
    return (
      <div className="agent-chat-proposal-section">
        <p className="agent-chat-proposal-section-title">Persisted result</p>
        <dl className="agent-chat-persistence-grid">
          <div>
            <dt>Run id</dt>
            <dd>{persistenceState.response.runId}</dd>
          </div>
          <div>
            <dt>Result id</dt>
            <dd>{persistenceState.response.resultId}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{persistenceState.response.status}</dd>
          </div>
          <div>
            <dt>Result type</dt>
            <dd>{persistenceState.response.resultType}</dd>
          </div>
        </dl>
        <p className="agent-chat-proposal-text">
          Saved proposal artifact for read-only inspection in Agent Monitoring.
          {` ${persistenceState.response.summary}`}
        </p>
      </div>
    );
  }

  if (
    persistenceState.status === "failed" ||
    persistenceState.status === "unsupported"
  ) {
    return (
      <div className="agent-chat-proposal-section">
        <p className="agent-chat-proposal-section-title">
          {persistenceState.status === "unsupported"
            ? "Persistence unavailable"
            : "Persistence failed"}
        </p>
        <p className="agent-chat-proposal-text">{persistenceState.message}</p>
      </div>
    );
  }

  return null;
}

function agentChatProposalPersistPayload(proposal: AgentChatMockProposal) {
  return {
    actionProposals: proposal.actionProposals.map((action) => ({
      description: action.description,
      title: action.title,
    })),
    contextNeeded: [...proposal.contextNeeded],
    id: proposal.id,
    proposedPlan: [...proposal.proposedPlan],
    requestSummary: proposal.requestSummary,
    runtimeNotes: [...proposal.runtimeNotes],
    safetyNotes: [...proposal.safetyNotes],
  };
}

function persistenceActivityLine(state: ProposalPersistenceState) {
  switch (state.status) {
    case "persisted":
      return `Proposal persisted as widget run ${state.response.runId}.`;
    case "persisting":
      return "Proposal persistence is in progress.";
    case "unsupported":
      return "Persistence unavailable in this runtime; preview remains local.";
    case "failed":
      return "Proposal persistence failed; preview remains local.";
    case "idle":
      return "Proposal persistence has not started.";
  }
}

function persistenceBadge(state: ProposalPersistenceState) {
  switch (state.status) {
    case "persisted":
      return <Badge variant="success">Persisted</Badge>;
    case "persisting":
      return <Badge variant="info">Persisting</Badge>;
    case "unsupported":
      return <Badge variant="warning">Local only</Badge>;
    case "failed":
      return <Badge variant="error">Persist failed</Badge>;
    case "idle":
      return <Badge variant="neutral">Not persisted</Badge>;
  }
}

function isUnsupportedPersistenceError(error: unknown) {
  return errorToMessage(error).includes("Browser fallback");
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to persist Agent Chat proposal result.";
}
