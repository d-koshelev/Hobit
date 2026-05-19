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
    body: "Coordinator Chat is the primary operator chat surface. Provider not connected yet. Approved Queue task creation is the only enabled handoff; it does not run tasks.",
    proposalIds: LOCAL_COORDINATOR_SAMPLE_PROPOSALS.map(
      (proposal) => proposal.id,
    ),
  },
];

const LOCAL_PLACEHOLDER_RESPONSE =
  "Coordinator Chat is not connected yet. This message is stored only in this local widget session. Future versions will use approved widget capabilities.";

const APPROVED_PREVIEW_SUMMARY =
  "Approved locally only. Execution bridge is not implemented, and no widget capability was invoked.";

const APPROVED_QUEUE_TASK_SUMMARY =
  "Approved locally. Review the visible inputs, then use Create Queue task. No Queue task has been created yet.";

const CREATING_QUEUE_TASK_SUMMARY =
  "Creating a draft Agent Queue task from the visible approved proposal inputs.";

const QUEUE_TASK_CREATED_SUMMARY =
  "Draft Queue task created. It was not assigned, dispatched, run, or handed to Agent Executor.";

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
  onCreateAgentQueueTask,
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
  const [creatingQueueProposalIds, setCreatingQueueProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
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
    setProposals((currentProposals) => {
      const proposal = currentProposals[proposalId];
      const isCreateQueueTaskProposal =
        proposal?.typeId === "create-agent-queue-task";

      return updateProposal(currentProposals, proposalId, {
        approvalStatus: "Approved preview",
        executionError: undefined,
        executionStatus: isCreateQueueTaskProposal
          ? "Ready to create Queue task"
          : "Execution bridge not implemented",
        resultSummary: isCreateQueueTaskProposal
          ? APPROVED_QUEUE_TASK_SUMMARY
          : APPROVED_PREVIEW_SUMMARY,
      });
    });
  }

  function rejectProposal(proposalId: string) {
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        approvalStatus: "Rejected preview",
        executionError: undefined,
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
    setProposals((currentProposals) => {
      const proposal = currentProposals[proposalId];
      const isCreateQueueTaskProposal =
        proposal?.typeId === "create-agent-queue-task";

      return updateProposal(currentProposals, proposalId, {
        ...patch,
        approvalStatus: "Edited preview",
        createdQueueTaskId: undefined,
        createdQueueTaskTitle: undefined,
        executionError: undefined,
        executionStatus: isCreateQueueTaskProposal
          ? "Not run"
          : "Execution bridge not implemented",
        resultSummary: EDITED_PREVIEW_SUMMARY,
      });
    });
  }

  async function createQueueTaskFromProposal(proposalId: string) {
    if (creatingQueueProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-agent-queue-task") {
      return;
    }

    if (proposal.approvalStatus !== "Approved preview") {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError: "Approve this proposal before creating a Queue task.",
          executionStatus: "Queue task creation failed",
          resultSummary: "No Queue task was created.",
        }),
      );
      return;
    }

    if (proposal.createdQueueTaskId) {
      return;
    }

    if (!onCreateAgentQueueTask) {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError:
            "Agent Queue task creation is unavailable in this runtime.",
          executionStatus: "Queue task creation failed",
          resultSummary: "No Queue task was created.",
        }),
      );
      return;
    }

    setCreatingQueueProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        executionError: undefined,
        executionStatus: "Creating Queue task",
        resultSummary: CREATING_QUEUE_TASK_SUMMARY,
      }),
    );

    try {
      const task = await onCreateAgentQueueTask(
        queueTaskRequestFromProposal(proposal),
      );
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          createdQueueTaskId: task.queueItemId,
          createdQueueTaskTitle: task.title,
          executionError: undefined,
          executionStatus: "Queue task created",
          resultSummary: `${QUEUE_TASK_CREATED_SUMMARY} Created task "${task.title}" (${task.queueItemId}) with status ${task.status}.`,
        }),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError: errorToMessage(error, "Unable to create Queue task."),
          executionStatus: "Queue task creation failed",
          resultSummary: "No Queue task was created.",
        }),
      );
    } finally {
      setCreatingQueueProposalIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(proposalId);
        return nextIds;
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
              Approved Queue task creation is enabled.
            </p>
            <p className="interactive-agent-text">
              Queue tasks are not assigned, dispatched, or run by Coordinator.
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
                        isQueueTaskCreationPending={creatingQueueProposalIds.has(
                          proposal.id,
                        )}
                        onApprove={approveProposal}
                        onCreateQueueTask={(proposalId) =>
                          void createQueueTaskFromProposal(proposalId)
                        }
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

type QueueTaskCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateAgentQueueTask"]>
>[0];

function queueTaskRequestFromProposal(
  proposal: CoordinatorActionProposal,
): QueueTaskCreateRequest {
  return {
    description:
      proposalInputValue(proposal, "Description") || proposal.intent.trim(),
    priority: queueTaskPriority(proposalInputValue(proposal, "Priority")),
    prompt: proposalInputValue(proposal, "Prompt") || proposal.intent.trim(),
    status: "draft",
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Coordinator proposal",
  };
}

function proposalInputValue(
  proposal: CoordinatorActionProposal,
  label: string,
) {
  return (
    proposal.inputs
      .find((input) => input.label.toLowerCase() === label.toLowerCase())
      ?.value.trim() ?? ""
  );
}

function queueTaskPriority(value: string) {
  const priority = Number.parseInt(value, 10);

  if (!Number.isFinite(priority)) {
    return 0;
  }

  return Math.min(5, Math.max(0, priority));
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
