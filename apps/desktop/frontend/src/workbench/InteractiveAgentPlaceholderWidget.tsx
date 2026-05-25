import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { CoordinatorActionProposalCard } from "./CoordinatorActionProposalCard";
import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
  type CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import {
  generateLocalCoordinatorProposals,
  type CoordinatorOutcomeReviewDraft,
  type CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";
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
import type {
  DirectWorkStreamEvent,
  DirectWorkStreamEventKind,
} from "../workspace/types";

type InteractiveAgentMessage = {
  id: string;
  planId?: string;
  proposalIds?: string[];
  providerMeta?: CoordinatorProviderMessageMeta;
  reviewId?: string;
  role: "operator" | "assistant";
  body: string;
};

const INITIAL_MESSAGES: InteractiveAgentMessage[] = [];

const SUGGESTED_PROMPTS = [
  {
    label: "Make a plan",
    prompt:
      "Make a plan from the visible chat only. Goal: ",
  },
  {
    label: "Break into Queue tasks",
    prompt: "Break this into Queue tasks from visible text only. Goal: ",
  },
  {
    label: "Draft tasks for this goal",
    prompt: "Draft tasks for this goal using only the visible chat: ",
  },
  {
    label: "Review pasted Queue result",
    prompt:
      "Review pasted Queue result using visible chat text only. Paste result here: ",
  },
  {
    label: "Explain this Executor failure",
    prompt:
      "Explain this Executor failure using visible chat text only. Paste failure here: ",
  },
  {
    label: "Turn this result into next steps",
    prompt:
      "Turn this result into next steps using visible chat text only. Paste result here: ",
  },
  {
    label: "Draft follow-up Queue tasks",
    prompt:
      "Draft follow-up Queue tasks from this pasted result using visible chat text only. Paste result here: ",
  },
  {
    label: "Summarize validation output",
    prompt:
      "Summarize validation output using visible chat text only. Paste validation output here: ",
  },
  {
    label: "Explain how to execute this safely",
    prompt:
      "Explain how to execute this safely from visible chat only. Do not start Queue, Executor, Terminal, Git, or JDBC actions.",
  },
];

const APPROVED_PREVIEW_SUMMARY =
  "Approved locally only. Execution bridge is not implemented, and no widget capability was invoked.";

const APPROVED_QUEUE_TASK_SUMMARY =
  "Approved locally. Use Create Queue task to create a draft task. Does not run it.";

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

const QUEUE_DRAFT_REVIEW_NOTE =
  "Approve all drafts is local review only. Create Queue task stays explicit on each approved draft.";

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

const DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE =
  "Working directory is required before Direct Work can start.";

const DIRECT_WORK_EMPTY_PROMPT_MESSAGE =
  "Direct Work uses the current composer message as the prompt. Type the task, then choose Run with Codex.";

const DIRECT_WORK_UNAVAILABLE_MESSAGE =
  "Coordinator Direct Mode is only available in the Tauri desktop shell.";

const DIRECT_WORK_FALLBACK_FAILURE_MESSAGE =
  "Codex Direct Work failed. Check Codex CLI availability, login, working directory, or logs.";

const DEFAULT_COORDINATOR_CODEX_EXECUTABLE = "codex";
const WINDOWS_COORDINATOR_CODEX_EXECUTABLE = "codex.cmd";

type CoordinatorDirectWorkStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type CoordinatorDirectWorkLogEntry = {
  id: string;
  kind: DirectWorkStreamEventKind | "local";
  text: string;
};

export function InteractiveAgentPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateAgentQueueTask,
  onCreateWorkspaceNote,
  coordinatorAttachedContextRequest,
  onGenerateCoordinatorProviderResponse,
  onCancelCodexDirectWorkRun,
  onLoadLogs,
  onStartCodexDirectWorkStream,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const textareaId = useId();
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageId = useRef(1);
  const [messages, setMessages] = useState<InteractiveAgentMessage[]>(
    INITIAL_MESSAGES,
  );
  const [plans, setPlans] = useState<Record<string, CoordinatorPlanDraft>>({});
  const [reviews, setReviews] = useState<
    Record<string, CoordinatorOutcomeReviewDraft>
  >({});
  const [proposals, setProposals] = useState<
    Record<string, CoordinatorActionProposal>
  >({});
  const [creatingQueueProposalIds, setCreatingQueueProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [creatingNoteProposalIds, setCreatingNoteProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [draft, setDraft] = useState("");
  const [visibleAttachedContext, setVisibleAttachedContext] = useState<{
    contextText: string;
    sourceLabel: string;
  } | null>(null);
  const [isProviderPending, setIsProviderPending] = useState(false);
  const [providerModeLabel, setProviderModeLabel] =
    useState("Mock/local fallback");
  const [isDirectModeEnabled, setIsDirectModeEnabled] = useState(false);
  const [directWorkDirectory, setDirectWorkDirectory] = useState("~");
  const [directWorkStatus, setDirectWorkStatus] =
    useState<CoordinatorDirectWorkStatus>("idle");
  const [directWorkRunId, setDirectWorkRunId] = useState<string | null>(null);
  const [directWorkError, setDirectWorkError] = useState<string | null>(null);
  const [directWorkFinalResult, setDirectWorkFinalResult] =
    useState<string | null>(null);
  const [directWorkLogs, setDirectWorkLogs] = useState<
    CoordinatorDirectWorkLogEntry[]
  >([]);
  const [isDirectWorkStopPending, setIsDirectWorkStopPending] = useState(false);
  const directWorkStopListeningRef = useRef<(() => void) | null>(null);
  const directWorkCompletedDuringStartRef = useRef(false);
  const directWorkFinalMessageRef = useRef<string | null>(null);
  const directWorkLogSequenceRef = useRef(0);
  const trimmedDraftLength = draft.trim().length;
  const canSend =
    !isDirectModeEnabled && trimmedDraftLength > 0 && !isProviderPending;
  const canStartDirectWork =
    isDirectModeEnabled &&
    directWorkStatus !== "running" &&
    !isProviderPending &&
    trimmedDraftLength > 0;
  const canStopDirectWork =
    directWorkStatus === "running" &&
    Boolean(directWorkRunId) &&
    Boolean(onCancelCodexDirectWorkRun);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [messages.length, isProviderPending]);

  useEffect(() => {
    if (!coordinatorAttachedContextRequest) {
      return;
    }

    const attachedContext = {
      contextText: coordinatorAttachedContextRequest.contextText,
      sourceLabel: coordinatorAttachedContextRequest.sourceLabel,
    };
    const attachmentBlock = coordinatorAttachedContextBlock(attachedContext);

    setVisibleAttachedContext(attachedContext);
    setDraft((currentDraft) => appendDraftBlock(currentDraft, attachmentBlock));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [coordinatorAttachedContextRequest?.id]);

  useEffect(() => () => stopDirectWorkEventListening(), []);

  function createLocalMessage(
    role: InteractiveAgentMessage["role"],
    body: string,
    proposalIds?: string[],
    providerMeta?: CoordinatorProviderMessageMeta,
    planId?: string,
    reviewId?: string,
  ): InteractiveAgentMessage {
    const id = `local-${nextMessageId.current}`;
    nextMessageId.current += 1;

    return {
      id,
      planId,
      proposalIds,
      providerMeta,
      reviewId,
      role,
      body,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDirectModeEnabled) {
      await startCoordinatorDirectWork();
      return;
    }

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
    const generatedProposalIds = generated.proposals.map(
      (proposal) => proposal.id,
    );
    const assistantMessage = createLocalMessage(
      "assistant",
      onGenerateCoordinatorProviderResponse
        ? "Drafting from the visible chat."
        : generated.responseBody,
      generatedProposalIds.length > 0 ? generatedProposalIds : undefined,
      onGenerateCoordinatorProviderResponse
        ? coordinatorProviderPendingMeta(generatedProposalIds.length)
        : coordinatorProviderFallbackMeta(
            "Provider API unavailable in this runtime. Local deterministic response only.",
          ),
      generated.plan?.id,
      generated.review?.id,
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
    const generatedPlan = generated.plan;
    if (generatedPlan) {
      setPlans((currentPlans) => ({
        ...currentPlans,
        [generatedPlan.id]: generatedPlan,
      }));
    }
    const generatedReview = generated.review;
    if (generatedReview) {
      setReviews((currentReviews) => ({
        ...currentReviews,
        [generatedReview.id]: generatedReview,
      }));
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      operatorMessage,
      assistantMessage,
    ]);
    setDraft("");
    setVisibleAttachedContext(null);
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
          `Provider request failed visibly: ${message} Local response remained in use.`,
        ),
      });
    } finally {
      setIsProviderPending(false);
    }
  }

  async function startCoordinatorDirectWork() {
    if (directWorkStatus === "running") {
      return;
    }

    const operatorPrompt = draft.trim();
    const repoRoot = directWorkDirectory.trim();

    if (!repoRoot) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE);
      return;
    }

    if (!operatorPrompt) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_EMPTY_PROMPT_MESSAGE);
      return;
    }

    if (!onStartCodexDirectWorkStream) {
      recordCoordinatorDirectWorkLocalFailure(DIRECT_WORK_UNAVAILABLE_MESSAGE);
      return;
    }

    stopDirectWorkEventListening();
    directWorkCompletedDuringStartRef.current = false;
    directWorkFinalMessageRef.current = null;
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage("operator", operatorPrompt),
      createLocalMessage(
        "assistant",
        `Sent to Codex Direct Mode. Starting foreground Codex Direct Work from ${repoRoot}.`,
      ),
    ]);
    setDraft("");
    setVisibleAttachedContext(null);
    setDirectWorkStatus("running");
    setDirectWorkRunId(null);
    setDirectWorkError(null);
    setDirectWorkFinalResult(null);
    setDirectWorkLogs([
      {
        id: "direct-local-starting",
        kind: "local",
        text: `Starting Codex Direct Work from ${repoRoot}.`,
      },
    ]);

    try {
      const session = await onStartCodexDirectWorkStream(
        instance.id,
        {
          approvalPolicy: "never",
          codexExecutable: defaultCoordinatorCodexExecutable(),
          operatorPrompt,
          repoRoot,
          sandbox: "workspace_write",
          skipGitRepoCheck: true,
          stderrCapBytes: null,
          stdoutCapBytes: null,
          timeoutMs: null,
        },
        recordCoordinatorDirectWorkEvent,
      );

      if (!session) {
        throw new Error(
          "Coordinator Direct Work was not accepted for this widget.",
        );
      }

      if (directWorkCompletedDuringStartRef.current) {
        session.stopListening();
      } else {
        directWorkStopListeningRef.current = session.stopListening;
        setDirectWorkRunId(session.runId);
        appendCoordinatorDirectWorkLog(
          `Direct Work run ${session.runId} started.`,
          "local",
        );
      }
    } catch (error) {
      const message = errorToMessage(error, "Unable to start Direct Work.");
      stopDirectWorkEventListening();
      setDirectWorkStatus("failed");
      setDirectWorkError(message);
      appendCoordinatorDirectWorkLog(message, "local");
      appendCoordinatorDirectWorkTranscript("failed", message);
    } finally {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  async function stopCoordinatorDirectWork() {
    if (
      !directWorkRunId ||
      !onCancelCodexDirectWorkRun ||
      isDirectWorkStopPending
    ) {
      return;
    }

    setIsDirectWorkStopPending(true);
    appendCoordinatorDirectWorkLog("Stop requested.", "local");

    try {
      const response = await onCancelCodexDirectWorkRun(
        instance.id,
        directWorkRunId,
      );

      if (!response) {
        throw new Error("Stop command returned no response.");
      }

      appendCoordinatorDirectWorkLog(response.message, "local");
    } catch (error) {
      const message = errorToMessage(error, "Unable to stop Direct Work.");
      setDirectWorkError(message);
      appendCoordinatorDirectWorkLog(message, "local");
    } finally {
      setIsDirectWorkStopPending(false);
    }
  }

  function recordCoordinatorDirectWorkEvent(event: DirectWorkStreamEvent) {
    if (event.eventKind === "final_message" && event.text) {
      directWorkFinalMessageRef.current = event.text;
    }

    appendCoordinatorDirectWorkLog(
      directWorkEventText(event),
      event.eventKind,
    );

    if (!event.isFinal) {
      return;
    }

    directWorkCompletedDuringStartRef.current = true;
    const finalStatus = coordinatorDirectWorkStatusFromEvent(event);
    const failureReason =
      finalStatus === "failed" ? directWorkFailureReason(event) : null;
    const finalResult =
      directWorkFinalMessageRef.current ??
      event.text ??
      failureReason ??
      event.stderrPreview ??
      `Codex Direct Work ended with status ${event.finalStatus ?? finalStatus}.`;

    setDirectWorkStatus(finalStatus);
    setDirectWorkRunId(null);
    setDirectWorkFinalResult(finalResult);
    setDirectWorkError(failureReason);
    stopDirectWorkEventListening();

    appendCoordinatorDirectWorkTranscript(finalStatus, finalResult);
  }

  function appendCoordinatorDirectWorkLog(
    text: string,
    kind: CoordinatorDirectWorkLogEntry["kind"],
  ) {
    const id = `direct-log-${++directWorkLogSequenceRef.current}`;
    setDirectWorkLogs((currentLogs) =>
      [...currentLogs, { id, kind, text }].slice(-6),
    );
  }

  function recordCoordinatorDirectWorkLocalFailure(reason: string) {
    setDirectWorkStatus("failed");
    setDirectWorkRunId(null);
    setDirectWorkError(reason);
    setDirectWorkFinalResult(null);
    appendCoordinatorDirectWorkLog(reason, "local");
    appendCoordinatorDirectWorkTranscript("failed", reason);
  }

  function appendCoordinatorDirectWorkTranscript(
    status: CoordinatorDirectWorkStatus,
    reason: string,
  ) {
    setMessages((currentMessages) => [
      ...currentMessages,
      createLocalMessage(
        "assistant",
        status === "failed"
          ? directWorkFailureTranscriptBody(reason)
          : status === "completed"
            ? `Codex Direct Mode completed.\n\n${reason}`
            : `Codex Direct Mode ${status}. ${reason}`,
      ),
    ]);
  }

  function stopDirectWorkEventListening() {
    directWorkStopListeningRef.current?.();
    directWorkStopListeningRef.current = null;
  }

  function useSuggestedPrompt(prompt: string) {
    setDraft(prompt);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function removeVisibleAttachedContext() {
    if (!visibleAttachedContext) {
      return;
    }

    const attachmentBlock = coordinatorAttachedContextBlock(
      visibleAttachedContext,
    );
    setDraft((currentDraft) =>
      currentDraft.includes(attachmentBlock)
        ? currentDraft.replace(attachmentBlock, "").trimStart()
        : currentDraft,
    );
    setVisibleAttachedContext(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
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
      if (!proposal) {
        return currentProposals;
      }

      return updateProposal(
        currentProposals,
        proposalId,
        approvedProposalPatch(proposal),
      );
    });
  }

  function approveAllQueueDrafts(proposalIds: string[]) {
    setProposals((currentProposals) => {
      let nextProposals = currentProposals;

      proposalIds.forEach((proposalId) => {
        const proposal = nextProposals[proposalId];
        if (
          proposal?.typeId !== "create-agent-queue-task" ||
          proposal.createdQueueTaskId
        ) {
          return;
        }

        nextProposals = updateProposal(
          nextProposals,
          proposalId,
          approvedProposalPatch(proposal),
        );
      });

      return nextProposals;
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
      status={
        <Badge variant={isDirectModeEnabled ? "info" : "neutral"}>
          {isDirectModeEnabled ? "Codex Direct Mode" : "Mock/local fallback"}
        </Badge>
      }
      title={title}
    >
      <div className="interactive-agent-chat">
        <section
          aria-label="Coordinator Chat status"
          className="interactive-agent-status"
        >
          <div className="interactive-agent-status-copy">
            <div className="interactive-agent-status-heading">
              <div className="interactive-agent-title-copy">
                <h3 className="interactive-agent-title">
                  Plan work, draft tasks, review results
                </h3>
              </div>
              <div className="interactive-agent-header-badges">
                <Badge
                  variant={
                    isProviderPending
                      ? "warning"
                      : isDirectModeEnabled
                        ? "info"
                        : "neutral"
                  }
                >
                  {isProviderPending
                    ? "Drafting"
                    : isDirectModeEnabled
                      ? "Codex Direct Mode"
                      : "Mock/local fallback"}
                </Badge>
                <div
                  aria-label="Coordinator safety boundaries"
                  className="interactive-agent-provider-badges"
                >
                  <Badge variant="neutral">Visible context only</Badge>
                  <Badge variant="neutral">Tools disabled</Badge>
                  <Badge variant="neutral">No hidden context</Badge>
                </div>
              </div>
            </div>
            <details
              aria-label="Coordinator provider details"
              className="interactive-agent-provider-disclosure interactive-agent-provider-secondary"
            >
              <summary>Response setup</summary>
              <div className="interactive-agent-provider-row">
                <span className="interactive-agent-status-label">Response</span>
                <Badge
                  variant={
                    isProviderPending
                      ? "warning"
                      : providerModeLabel === "Provider error"
                        ? "error"
                        : providerModeLabel === "Provider timeout" ||
                            providerModeLabel === "Invalid provider response" ||
                            providerModeLabel === "Network failure" ||
                            providerModeLabel === "Request too large"
                          ? "warning"
                          : providerModeLabel === "Not configured" ||
                              providerModeLabel.includes("unavailable")
                            ? "warning"
                            : providerModeLabel === "Local fallback" ||
                                providerModeLabel === "Mock/local fallback"
                              ? "neutral"
                              : "info"
                  }
                >
                  {isProviderPending ? "Drafting" : providerModeLabel}
                </Badge>
                <span className="interactive-agent-status-label">Setup</span>
                <Badge variant="neutral">Backend selected</Badge>
              </div>
              <p className="interactive-agent-text">
                Mock/local fallback is deterministic local behavior, not a
                connected AI provider. Enable Direct Mode to make the primary
                composer action run Codex in the foreground.
              </p>
              <p className="interactive-agent-text">
                Supported review cards: {STATIC_PROPOSAL_TYPE_SUMMARY}. Queue
                and Note cards require approval plus a separate create action;
                JDBC cards stay copy-only.
              </p>
            </details>
          </div>
        </section>

        <div
          aria-label="Local Coordinator Chat transcript"
          aria-live="polite"
          className="interactive-agent-message-list"
          ref={messageListRef}
          role="log"
        >
          {messages.length === 0 ? (
            <div className="interactive-agent-empty">
              <p className="interactive-agent-empty-title">
                Start with a planning question or a task draft.
              </p>
              <p className="interactive-agent-empty-text">
                Coordinator works from visible chat and explicit attachments. It
                can draft reviewable Queue, Note, or JDBC suggestion cards.
              </p>
              <p className="interactive-agent-empty-text">
                Drafts stay inert until you approve them and use the separate
                create or copy action.
              </p>
              <div
                aria-label="Coordinator suggested prompts"
                className="interactive-agent-suggestion-list"
              >
                {SUGGESTED_PROMPTS.map((suggestion) => (
                  <button
                    className="interactive-agent-suggestion"
                    key={suggestion.label}
                    onClick={() => useSuggestedPrompt(suggestion.prompt)}
                    type="button"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              aria-label={
                message.role === "operator"
                  ? "User message"
                  : "Coordinator message"
              }
              className={`interactive-agent-message interactive-agent-message-${message.role}${
                message.providerMeta
                  ? ` interactive-agent-message-${message.providerMeta.tone}`
                  : ""
              }`}
              data-testid={`interactive-agent-message-${message.role}`}
              key={message.id}
            >
              <div className="interactive-agent-message-body">
                {renderMessageBody(message.body)}
              </div>
              {message.providerMeta ? (
                <details
                  className={`interactive-agent-provider-meta interactive-agent-provider-meta-${message.providerMeta.tone}`}
                >
                  <summary>Details</summary>
                  <p>
                    Source: {message.providerMeta.label}.{" "}
                    {message.providerMeta.detail}
                  </p>
                </details>
              ) : null}
              {message.planId && plans[message.planId] ? (
                <CoordinatorPlanCard plan={plans[message.planId]} />
              ) : null}
              {message.reviewId && reviews[message.reviewId] ? (
                <CoordinatorReviewCard review={reviews[message.reviewId]} />
              ) : null}
              {message.proposalIds ? (
                <div className="coordinator-proposal-list">
                  <CoordinatorProposalReviewControls
                    onApproveAllQueueDrafts={approveAllQueueDrafts}
                    proposalIds={message.proposalIds}
                    proposals={proposals}
                  />
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
          {visibleAttachedContext ? (
            <section
              aria-label="Visible attached context"
              className="interactive-agent-attached-context"
            >
              <div className="interactive-agent-attached-context-header">
                <div>
                  <p className="interactive-agent-attached-context-kicker">
                    Visible attached context
                  </p>
                  <p className="interactive-agent-attached-context-source">
                    {visibleAttachedContext.sourceLabel}
                  </p>
                </div>
                <Button
                  onClick={removeVisibleAttachedContext}
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
              <pre className="interactive-agent-attached-context-body">
                {visibleAttachedContext.contextText}
              </pre>
              <p className="interactive-agent-attached-context-note">
                Included in the message below. Edit or remove it before Send.
              </p>
            </section>
          ) : null}
          <CoordinatorDirectModePanel
            directWorkDirectory={directWorkDirectory}
            error={directWorkError}
            finalResult={directWorkFinalResult}
            isEnabled={isDirectModeEnabled}
            logs={directWorkLogs}
            onDirectoryChange={setDirectWorkDirectory}
            onToggle={setIsDirectModeEnabled}
            runId={directWorkRunId}
            status={directWorkStatus}
          />
          <label
            className="interactive-agent-label interactive-agent-label-hidden"
            htmlFor={textareaId}
          >
            Message
          </label>
          <textarea
            className="input interactive-agent-input"
            id={textareaId}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Plan work, draft Queue tasks, review pasted results, or ask what to do next."
            ref={textareaRef}
            rows={3}
            value={draft}
          />
          <div className="interactive-agent-action-row">
            <p className="interactive-agent-note">
              {isDirectModeEnabled
                ? "Primary action sends this message to Codex Direct Mode. No mock/local chat response is generated."
                : "Send uses mock/local fallback unless a provider is configured. No tools run."}
            </p>
            <div className="interactive-agent-composer-actions">
              {canStopDirectWork ? (
                <Button
                  disabled={isDirectWorkStopPending}
                  onClick={() => void stopCoordinatorDirectWork()}
                  type="button"
                  variant="secondary"
                >
                  {isDirectWorkStopPending ? "Stopping" : "Stop"}
                </Button>
              ) : null}
              <Button
                disabled={
                  isDirectModeEnabled ? !canStartDirectWork : !canSend
                }
                type="submit"
                variant="primary"
              >
                {isDirectModeEnabled
                  ? directWorkStatus === "running"
                    ? "Running with Codex"
                    : "Run with Codex"
                  : isProviderPending
                    ? "Drafting"
                    : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </WidgetFrame>
  );
}

function CoordinatorDirectModePanel({
  directWorkDirectory,
  error,
  finalResult,
  isEnabled,
  logs,
  onDirectoryChange,
  onToggle,
  runId,
  status,
}: {
  directWorkDirectory: string;
  error: string | null;
  finalResult: string | null;
  isEnabled: boolean;
  logs: CoordinatorDirectWorkLogEntry[];
  onDirectoryChange: (value: string) => void;
  onToggle: (value: boolean) => void;
  runId: string | null;
  status: CoordinatorDirectWorkStatus;
}) {
  const workingDirectoryInputId = useId();
  const statusVariant =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "error"
        : status === "cancelled"
          ? "warning"
          : status === "running"
            ? "info"
            : "neutral";
  const latestLog = logs[logs.length - 1]?.text ?? null;
  const resolutionText = directWorkDirectoryResolutionText(directWorkDirectory);
  const compactResult = finalResult
    ? compactDirectWorkText(finalResult)
    : null;

  return (
    <section
      aria-label="Coordinator Direct Mode"
      className="interactive-agent-direct-mode"
    >
      <div className="interactive-agent-direct-mode-bar">
        <label className="interactive-agent-direct-mode-toggle">
          <input
            checked={isEnabled}
            onChange={(event) => onToggle(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Direct Mode</span>
        </label>
        {isEnabled ? (
          <>
            <span className="interactive-agent-direct-mode-label">
              Working dir
            </span>
            <input
              aria-label="Direct Work working directory"
              autoComplete="off"
              className="input interactive-agent-direct-mode-input"
              id={workingDirectoryInputId}
              onChange={(event) => onDirectoryChange(event.currentTarget.value)}
              spellCheck={false}
              type="text"
              value={directWorkDirectory}
            />
            <span className="interactive-agent-direct-mode-path">
              {resolutionText}
            </span>
          </>
        ) : null}
        <Badge variant={statusVariant}>{status}</Badge>
      </div>

      {isEnabled ? (
        <div className="interactive-agent-direct-mode-body">
          <div className="interactive-agent-direct-mode-status" role="status">
            {runId ? <span>Run {runId}</span> : null}
            {error ? (
              <span className="interactive-agent-direct-mode-error">
                {error}
              </span>
            ) : null}
            {compactResult ? (
              <span className="interactive-agent-direct-mode-result-line">
                Final: {compactResult}
              </span>
            ) : null}
            {!error && !compactResult && latestLog ? (
              <span>Latest: {compactDirectWorkText(latestLog)}</span>
            ) : null}
          </div>
          {logs.length > 0 || finalResult ? (
            <details className="interactive-agent-direct-mode-details">
              <summary>Direct Work details</summary>
              {logs.length > 0 ? (
                <ul className="interactive-agent-direct-mode-log">
                  {logs.map((entry) => (
                    <li key={entry.id}>{entry.text}</li>
                  ))}
                </ul>
              ) : null}
              {finalResult ? (
                <div className="interactive-agent-direct-mode-result">
                  <p className="interactive-agent-status-label">
                    Final result
                  </p>
                  <pre>{finalResult}</pre>
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function renderMessageBody(body: string): ReactNode {
  const segments = body.split(/```/);

  if (segments.length === 1) {
    return <p>{body}</p>;
  }

  return segments.map((segment, index) => {
    const key = `${index}-${segment.slice(0, 12)}`;
    if (index % 2 === 1) {
      const code = segment.replace(/^\w+\n/, "").trim();
      return (
        <pre className="interactive-agent-code-block" key={key}>
          <code>{code}</code>
        </pre>
      );
    }

    return segment.trim() ? <p key={key}>{segment.trim()}</p> : null;
  });
}

function coordinatorAttachedContextBlock(context: {
  contextText: string;
  sourceLabel: string;
}) {
  return [
    `Visible attached context (${context.sourceLabel})`,
    context.contextText,
    "Only visible attached context is sent.",
  ].join("\n");
}

function appendDraftBlock(currentDraft: string, block: string) {
  const trimmedDraft = currentDraft.trim();

  if (!trimmedDraft) {
    return block;
  }

  return `${trimmedDraft}\n\n${block}`;
}

function CoordinatorReviewCard({
  review,
}: {
  review: CoordinatorOutcomeReviewDraft;
}) {
  const statusVariant =
    review.statusInterpretation === "success"
      ? "success"
      : review.statusInterpretation === "failure"
        ? "error"
        : review.statusInterpretation === "needs review"
          ? "warning"
          : "neutral";

  return (
    <section
      aria-label={`Coordinator outcome review: ${review.title}`}
      className={`coordinator-review-card coordinator-review-card-${review.statusInterpretation.replace(
        /\s+/g,
        "-",
      )}`}
    >
      <div className="coordinator-review-header">
        <div className="coordinator-review-title-copy">
          <p className="coordinator-review-kicker">Outcome review</p>
          <h4 className="coordinator-review-title">{review.title}</h4>
        </div>
        <div className="coordinator-review-badges">
          <Badge variant={statusVariant}>
            {review.statusInterpretation}
          </Badge>
          <Badge variant="neutral">Visible text only</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-review-grid">
        <ReviewSection
          label="Observed result summary"
          value={review.observedSummary}
        />
        <ReviewSection
          label="Status interpretation"
          value={review.statusInterpretation}
        />
        <ReviewSection label="Likely outcome" value={review.likelyOutcome} />
        <ReviewList label="Risks / blockers" values={review.risksBlockers} />
        <ReviewList
          label="Next recommended actions"
          values={review.nextActions}
        />
      </div>
      <p className="coordinator-review-note">
        Review only. Coordinator does not read Queue history, Executor logs, or
        artifacts unless you paste or explicitly share them.
      </p>
    </section>
  );
}

function CoordinatorPlanCard({ plan }: { plan: CoordinatorPlanDraft }) {
  return (
    <section
      aria-label={`Coordinator plan: ${plan.title}`}
      className="coordinator-plan-card"
    >
      <div className="coordinator-plan-header">
        <div className="coordinator-plan-title-copy">
          <p className="coordinator-plan-kicker">Coordinator plan</p>
          <h4 className="coordinator-plan-title">{plan.title}</h4>
          <div className="coordinator-plan-goal-block">
            <p className="coordinator-plan-section-label">Goal</p>
            <p className="coordinator-plan-goal">{plan.goal}</p>
          </div>
        </div>
        <div className="coordinator-plan-badges">
          <Badge variant="info">Plan draft</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-plan-grid">
        <PlanList label="Steps" values={plan.steps} />
        <PlanList label="Risks / notes" values={plan.riskNotes} />
        <PlanList
          label="Suggested next actions"
          values={plan.suggestedNextActions}
        />
      </div>
      <p className="coordinator-plan-note">
        Plan only. Queue task drafts require approval plus Create Queue task.
        Queue/Executor run work only after explicit operator action.
      </p>
    </section>
  );
}

function ReviewSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <p className="coordinator-review-section-value">{value}</p>
    </div>
  );
}

function ReviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <ol className="coordinator-review-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
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
  const queueDraftIds = proposalIds.filter(
    (proposalId) =>
      proposals[proposalId]?.typeId === "create-agent-queue-task",
  );

  if (queueDraftIds.length < 2) {
    return null;
  }

  const queueDrafts = queueDraftIds
    .map((proposalId) => proposals[proposalId])
    .filter((proposal): proposal is CoordinatorActionProposal =>
      Boolean(proposal),
    );
  const approvedCount = queueDrafts.filter(
    (proposal) => proposal.approvalStatus === "Approved preview",
  ).length;
  const createdCount = queueDrafts.filter((proposal) =>
    Boolean(proposal.createdQueueTaskId),
  ).length;
  const approvableIds = queueDrafts
    .filter((proposal) => !proposal.createdQueueTaskId)
    .map((proposal) => proposal.id);
  const canApproveAll =
    approvableIds.length > 0 && approvedCount < queueDrafts.length;

  return (
    <section
      aria-label="Queue draft review controls"
      className="coordinator-proposal-review"
    >
      <div className="coordinator-proposal-review-copy">
        <p className="coordinator-proposal-section-label">
          Draft Queue tasks
        </p>
        <p className="coordinator-proposal-section-value">
          {queueDrafts.length} drafted, {approvedCount} approved,{" "}
          {createdCount} created.
        </p>
        <p className="coordinator-proposal-note">
          {QUEUE_DRAFT_REVIEW_NOTE}
        </p>
      </div>
      <Button
        disabled={!canApproveAll}
        onClick={() => onApproveAllQueueDrafts(approvableIds)}
        variant="secondary"
      >
        Approve all drafts
      </Button>
    </section>
  );
}

function PlanList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-plan-section">
      <p className="coordinator-plan-section-label">{label}</p>
      <ol className="coordinator-plan-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </div>
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

function approvedProposalPatch(proposal: CoordinatorActionProposal) {
  const isCreateQueueTaskProposal =
    proposal.typeId === "create-agent-queue-task";
  const isCreateNoteProposal = proposal.typeId === "create-note";
  const isJdbcQuerySuggestion =
    proposal.typeId === "prepare-jdbc-query-suggestion";

  return {
    approvalStatus: "Approved preview" as const,
    executionError: undefined,
    executionStatus: isCreateQueueTaskProposal
      ? ("Ready to create Queue task" as const)
      : isCreateNoteProposal
        ? ("Ready to create Note" as const)
        : isJdbcQuerySuggestion
          ? ("SQL suggestion only" as const)
          : ("Execution bridge not implemented" as const),
    resultSummary: isCreateQueueTaskProposal
      ? APPROVED_QUEUE_TASK_SUMMARY
      : isCreateNoteProposal
        ? APPROVED_NOTE_SUMMARY
        : isJdbcQuerySuggestion
          ? APPROVED_JDBC_SUGGESTION_SUMMARY
          : APPROVED_PREVIEW_SUMMARY,
  };
}

function coordinatorDirectWorkStatusFromEvent(
  event: DirectWorkStreamEvent,
): CoordinatorDirectWorkStatus {
  const status = event.finalStatus ?? event.status ?? event.eventKind;

  if (status === "completed") {
    return "completed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "failed";
}

function directWorkFailureReason(event: DirectWorkStreamEvent): string {
  return (
    event.errorMessage ??
    event.stderrPreview ??
    event.text ??
    DIRECT_WORK_FALLBACK_FAILURE_MESSAGE
  );
}

function directWorkFailureTranscriptBody(reason: string): string {
  return reason === DIRECT_WORK_FALLBACK_FAILURE_MESSAGE
    ? reason
    : `Direct Work failed: ${reason}`;
}

function directWorkDirectoryResolutionText(directory: string): string {
  const trimmedDirectory = directory.trim();

  if (!trimmedDirectory) {
    return "Required before start.";
  }

  if (trimmedDirectory === "~" || /^~[\\/]/.test(trimmedDirectory)) {
    return "Runs from ~ by default. Non-git directories use Codex skip git repo check.";
  }

  return "Non-git directories use Codex skip git repo check.";
}

function defaultCoordinatorCodexExecutable(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_COORDINATOR_CODEX_EXECUTABLE;
  }

  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? WINDOWS_COORDINATOR_CODEX_EXECUTABLE
    : DEFAULT_COORDINATOR_CODEX_EXECUTABLE;
}

function compactDirectWorkText(text: string): string {
  const compacted = text.replace(/\s+/g, " ").trim();

  return compacted.length > 180 ? `${compacted.slice(0, 177)}...` : compacted;
}

function directWorkEventText(event: DirectWorkStreamEvent): string {
  if (event.eventKind === "started") {
    return `Run ${event.runId} started.`;
  }

  if (event.eventKind === "final_message") {
    return "Final response received.";
  }

  if (event.isFinal) {
    return `Run ended with ${event.finalStatus ?? event.status ?? event.eventKind}.`;
  }

  return (
    event.text ??
    event.line ??
    event.parsedCodexEventType ??
    event.eventKind.replace(/_/g, " ")
  );
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
