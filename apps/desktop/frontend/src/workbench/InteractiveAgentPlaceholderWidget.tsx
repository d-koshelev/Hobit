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
import { generateLocalCoordinatorProposals } from "./coordinatorLocalProposalGeneration";
import {
  noteCreateRequestFromProposal,
  queueTaskRequestFromProposal,
} from "./coordinatorProposalHandoffs";
import { coordinatorProviderDraftProposals } from "./coordinatorProviderDraftProposals";
import {
  coordinatorProviderAssistantText,
  coordinatorProviderErrorMeta,
  coordinatorProviderFallbackMeta,
  coordinatorProviderMessage,
  coordinatorProviderModeLabel,
  type CoordinatorProviderMessageMeta,
  coordinatorProviderPendingMeta,
  coordinatorProviderProposalDraftContext,
  coordinatorProviderResponseMeta,
} from "./coordinatorProviderRequest";
import type { WidgetRenderProps } from "./types";

type InteractiveAgentMessage = {
  id: string;
  proposalIds?: string[];
  providerMeta?: CoordinatorProviderMessageMeta;
  role: "operator" | "assistant";
  body: string;
};

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [
  {
    id: "local-assistant-intro",
    role: "assistant",
    body: "Coordinator Chat can draft text through a mock/local provider in desktop mode. The sample proposal cards below are local previews.",
    providerMeta: {
      badgeVariant: "neutral",
      detail: "Current-session preview. No provider request was made for this message.",
      label: "Local preview",
      tone: "neutral",
    },
    proposalIds: LOCAL_COORDINATOR_SAMPLE_PROPOSALS.map(
      (proposal) => proposal.id,
    ),
  },
];

const APPROVED_PREVIEW_SUMMARY =
  "Approved locally only. Execution bridge is not implemented, and no widget capability was invoked.";

const APPROVED_QUEUE_TASK_SUMMARY =
  "Approved locally. Review the visible inputs, then use Create Queue task. No Queue task has been created yet.";

const APPROVED_NOTE_SUMMARY =
  "Approved locally. Review the visible title, body, and pinned state, then use Create Note. No Note has been created yet.";

const APPROVED_JDBC_SUGGESTION_SUMMARY =
  "Approved locally as a non-executing SQL suggestion. Use Copy SQL for manual review. No connector is accessed and no SQL is executed.";

const CREATING_QUEUE_TASK_SUMMARY =
  "Creating a draft Agent Queue task from the visible approved proposal inputs.";

const CREATING_NOTE_SUMMARY =
  "Creating a workspace-local Note from the visible approved proposal inputs.";

const QUEUE_TASK_CREATED_SUMMARY =
  "Draft Queue task created. It was not assigned, dispatched, run, or handed to Agent Executor.";

const NOTE_CREATED_SUMMARY =
  "Workspace-local Note created. Existing Notes content was not read, summarized, or searched.";

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
  onCreateWorkspaceNote,
  onGenerateCoordinatorProviderResponse,
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
  const [creatingNoteProposalIds, setCreatingNoteProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [draft, setDraft] = useState("");
  const [isProviderPending, setIsProviderPending] = useState(false);
  const [providerModeLabel, setProviderModeLabel] =
    useState("Mock/local provider");
  const canSend = draft.trim().length > 0 && !isProviderPending;

  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
    proposalIds?: string[],
    providerMeta?: CoordinatorProviderMessageMeta,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      proposalIds,
      providerMeta,
      role,
      body,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isProviderPending) {
      return;
    }

    const operatorMessage = createLocalMessage("operator", trimmedDraft);
    const assistantMessageId = `local-${nextMessageId.current}`;
    const generated = generateLocalCoordinatorProposals(
      trimmedDraft,
      assistantMessageId,
    );
    const generatedProposalIds = generated.proposals.map((proposal) => proposal.id);
    const assistantMessage = createLocalMessage(
      "assistant",
      onGenerateCoordinatorProviderResponse
        ? "Drafting a mock/local provider response from visible chat."
        : generated.responseBody,
      generatedProposalIds.length > 0 ? generatedProposalIds : undefined,
      onGenerateCoordinatorProviderResponse
        ? coordinatorProviderPendingMeta(generatedProposalIds.length)
        : coordinatorProviderFallbackMeta("Provider API unavailable in this runtime. Local deterministic response only."),
    );
    const providerConversation = [...messages, operatorMessage];

    if (generated.proposals.length > 0) {
      setProposals((currentProposals) => ({
        ...currentProposals,
        ...Object.fromEntries(
          generated.proposals.map((proposal) => [proposal.id, proposal]),
        ),
      }));
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      operatorMessage,
      assistantMessage,
    ]);
    setDraft("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);

    if (!onGenerateCoordinatorProviderResponse) {
      setProviderModeLabel("Local fallback");
      return;
    }

    setIsProviderPending(true);
    try {
      const providerResponse = await onGenerateCoordinatorProviderResponse(
        instance.id,
        {
          operatorMessage: trimmedDraft,
          visibleConversation: providerConversation.map(
            coordinatorProviderMessage,
          ),
          visibleProposalDrafts: generated.proposals.map(
            coordinatorProviderProposalDraftContext,
          ),
        },
      );
      const providerDrafts = coordinatorProviderDraftProposals(
        providerResponse,
        assistantMessage.id,
      );
      setProviderModeLabel(coordinatorProviderModeLabel(providerResponse));
      const providerProposalIds = providerDrafts.proposals.map(
        (proposal) => proposal.id,
      );

      if (providerDrafts.proposals.length > 0) {
        setProposals((currentProposals) => ({
          ...currentProposals,
          ...Object.fromEntries(
            providerDrafts.proposals.map((proposal) => [proposal.id, proposal]),
          ),
        }));
      }

      patchMessage(assistantMessage.id, {
        body: coordinatorProviderAssistantText(
          providerResponse,
          generated.responseBody,
        ),
        providerMeta: coordinatorProviderResponseMeta(providerResponse),
        proposalIds:
          providerProposalIds.length > 0
            ? providerProposalIds
            : assistantMessage.proposalIds,
      });
    } catch (error) {
      const message = errorToMessage(error, "Provider request failed.");
      setProviderModeLabel("Provider error");
      patchMessage(assistantMessage.id, {
        body: generated.responseBody,
        providerMeta: coordinatorProviderErrorMeta(
          `Mock/local provider request failed visibly: ${message}`,
        ),
      });
    } finally {
      setIsProviderPending(false);
    }
  }

  function patchMessage(
    messageId: string,
    patch: Partial<InteractiveAgentMessage>,
  ) {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    );
  }

  function approveProposal(proposalId: string) {
    setProposals((currentProposals) => {
      const proposal = currentProposals[proposalId];
      const isCreateQueueTaskProposal =
        proposal?.typeId === "create-agent-queue-task";
      const isCreateNoteProposal = proposal?.typeId === "create-note";
      const isJdbcQuerySuggestion =
        proposal?.typeId === "prepare-jdbc-query-suggestion";

      return updateProposal(currentProposals, proposalId, {
        approvalStatus: "Approved preview",
        executionError: undefined,
        executionStatus: isCreateQueueTaskProposal
          ? "Ready to create Queue task"
          : isCreateNoteProposal
            ? "Ready to create Note"
            : isJdbcQuerySuggestion
              ? "SQL suggestion only"
              : "Execution bridge not implemented",
        resultSummary: isCreateQueueTaskProposal
          ? APPROVED_QUEUE_TASK_SUMMARY
          : isCreateNoteProposal
            ? APPROVED_NOTE_SUMMARY
            : isJdbcQuerySuggestion
              ? APPROVED_JDBC_SUGGESTION_SUMMARY
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
      const isCreateNoteProposal = proposal?.typeId === "create-note";
      const isJdbcQuerySuggestion =
        proposal?.typeId === "prepare-jdbc-query-suggestion";

      return updateProposal(currentProposals, proposalId, {
        ...patch,
        approvalStatus: "Edited preview",
        createdNoteId: undefined,
        createdNoteTitle: undefined,
        createdQueueTaskId: undefined,
        createdQueueTaskTitle: undefined,
        executionError: undefined,
        executionStatus: isCreateQueueTaskProposal
          ? "Not run"
          : isCreateNoteProposal
            ? "Not run"
            : isJdbcQuerySuggestion
              ? "SQL suggestion only"
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

  async function createNoteFromProposal(proposalId: string) {
    if (creatingNoteProposalIds.has(proposalId)) {
      return;
    }

    const proposal = proposals[proposalId];
    if (!proposal || proposal.typeId !== "create-note") {
      return;
    }

    if (proposal.approvalStatus !== "Approved preview") {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError: "Approve this proposal before creating a Note.",
          executionStatus: "Note creation failed",
          resultSummary: "No Note was created.",
        }),
      );
      return;
    }

    if (proposal.createdNoteId) {
      return;
    }

    if (!onCreateWorkspaceNote) {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError:
            "Workspace Note creation is unavailable in this runtime.",
          executionStatus: "Note creation failed",
          resultSummary: "No Note was created.",
        }),
      );
      return;
    }

    setCreatingNoteProposalIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(proposalId);
      return nextIds;
    });
    setProposals((currentProposals) =>
      updateProposal(currentProposals, proposalId, {
        executionError: undefined,
        executionStatus: "Creating Note",
        resultSummary: CREATING_NOTE_SUMMARY,
      }),
    );

    try {
      const note = await onCreateWorkspaceNote(
        noteCreateRequestFromProposal(proposal),
      );
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          createdNoteId: note.noteId,
          createdNoteTitle: note.title,
          executionError: undefined,
          executionStatus: "Note created",
          resultSummary: `${NOTE_CREATED_SUMMARY} Created note "${note.title}" (${note.noteId}).`,
        }),
      );
    } catch (error) {
      setProposals((currentProposals) =>
        updateProposal(currentProposals, proposalId, {
          executionError: errorToMessage(error, "Unable to create Note."),
          executionStatus: "Note creation failed",
          resultSummary: "No Note was created.",
        }),
      );
    } finally {
      setCreatingNoteProposalIds((currentIds) => {
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
          aria-label="Coordinator Chat provider status"
          className="interactive-agent-status"
        >
          <div className="interactive-agent-status-copy">
            <p className="interactive-agent-title">Coordinator Chat</p>
            <p className="interactive-agent-text">
              Provider responses use visible chat only. Mock/local remains the fallback; configured providers stay tools-disabled.
            </p>
            <div
              aria-label="Coordinator provider boundaries"
              className="interactive-agent-provider-badges"
            >
              <Badge
                variant={
                  isProviderPending
                    ? "warning"
                    : providerModeLabel === "Provider error"
                      ? "error"
                      : providerModeLabel === "Not configured" ||
                          providerModeLabel.includes("unavailable")
                        ? "warning"
                        : providerModeLabel === "Local fallback"
                          ? "neutral"
                          : "info"
                }
              >
                {isProviderPending ? "Drafting" : providerModeLabel}
              </Badge>
              <Badge variant="neutral">Tools disabled</Badge>
              <Badge variant="neutral">Visible chat only</Badge>
              <Badge variant="neutral">Current session</Badge>
            </div>
            <details className="interactive-agent-provider-disclosure">
              <summary>Supported local proposals</summary>
              <p className="interactive-agent-text">
                {STATIC_PROPOSAL_TYPE_SUMMARY}. Queue and Note handoffs require approval plus a separate create action; JDBC suggestions do not execute SQL.
              </p>
            </details>
          </div>
        </section>

        <div
          aria-label="Local Coordinator Chat transcript"
          aria-live="polite"
          className="interactive-agent-message-list"
          role="log"
        >
          {messages.map((message) => (
            <article
              className={`interactive-agent-message interactive-agent-message-${message.role}${
                message.providerMeta
                  ? ` interactive-agent-message-${message.providerMeta.tone}`
                  : ""
              }`}
              key={message.id}
            >
              <div className="interactive-agent-message-heading">
                <p className="interactive-agent-message-role">
                  {message.role === "operator" ? "You" : "Coordinator Chat"}
                </p>
                {message.providerMeta ? (
                  <Badge variant={message.providerMeta.badgeVariant}>
                    {message.providerMeta.label}
                  </Badge>
                ) : null}
              </div>
              <p className="interactive-agent-message-body">{message.body}</p>
              {message.providerMeta ? (
                <p className={`interactive-agent-provider-meta interactive-agent-provider-meta-${message.providerMeta.tone}`}>
                  {message.providerMeta.detail}
                </p>
              ) : null}
              {message.proposalIds ? (
                <div className="coordinator-proposal-list">
                  {message.proposalIds.map((proposalId) => {
                    const proposal = proposals[proposalId];

                    return proposal ? (
                      <CoordinatorActionProposalCard
                        key={proposal.id}
                        isNoteCreationPending={creatingNoteProposalIds.has(
                          proposal.id,
                        )}
                        isQueueTaskCreationPending={creatingQueueProposalIds.has(
                          proposal.id,
                        )}
                        onApprove={approveProposal}
                        onCreateNote={(proposalId) =>
                          void createNoteFromProposal(proposalId)
                        }
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
            <p className="interactive-agent-note">
              Visible chat only. Tools disabled.
            </p>
            <Button disabled={!canSend} type="submit" variant="primary">
              {isProviderPending ? "Sending" : "Send"}
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

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
