import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import { codexDirectWorkErrorToMessage } from "./CodexDirectWorkErrors";
import {
  isFinalStatus,
  type CodexDirectWorkLiveLogEntry,
  type CodexDirectWorkLiveLogEntryKind,
  type CodexDirectWorkLiveRun,
} from "./CodexDirectWorkLiveLog";
import {
  handoffStartedAtMs,
  queueHandoffLiveRun,
  queueHandoffLiveRunFromDetail,
  queueHandoffRequestDraft,
} from "./CodexDirectWorkQueueHandoffModel";
import type {
  CodexDirectWorkRequestDraft,
  CodexDirectWorkStreamSession,
} from "./CodexDirectWorkTypes";
import type { DirectWorkRunHandoff, WidgetInstanceId } from "./types";
import { createQueueLinkedDirectWorkCompletionIdentity } from "./queueLinkedDirectWorkMetadata";
import {
  ingestQueueLinkedDirectWorkCompletionEvidence,
  type QueueLinkedDirectWorkEvidenceIngestionCallback,
  type QueueLinkedDirectWorkEvidenceWiringResult,
} from "./queueLinkedDirectWorkEvidenceWiring";

const QUEUE_HANDOFF_RECOVERY_DELAY_MS = 1500;

type NoticeState = {
  message: string;
  title: string;
};

type LocalLogAppender = (
  kind: CodexDirectWorkLiveLogEntryKind,
  text: string,
  tone: CodexDirectWorkLiveLogEntry["tone"],
  detail?: string,
  status?: string | null,
  runId?: string,
) => void;

type UseCodexDirectWorkQueueHandoffOptions = {
  activeRequestRef: MutableRefObject<CodexDirectWorkRequestDraft | null>;
  activeStreamingRunId: string | null;
  appendLocalLiveLogEntry: LocalLogAppender;
  clearRunState: () => void;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
  isRunning: boolean;
  liveRun: CodexDirectWorkLiveRun | null;
  onAttachToCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  onGetAgentExecutorRunDetail?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
  onIngestQueueLinkedDirectWorkEvidence?: QueueLinkedDirectWorkEvidenceIngestionCallback;
  onQueueRunFinalState?: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  recordStreamEvent: (event: DirectWorkStreamEvent) => void;
  refreshRunHistory: () => void;
  runStartedAtRef: MutableRefObject<number | null>;
  setActiveStreamingRunId: Dispatch<SetStateAction<string | null>>;
  setIsRunning: Dispatch<SetStateAction<boolean>>;
  setIsStopRequesting: Dispatch<SetStateAction<boolean>>;
  setLiveRun: Dispatch<SetStateAction<CodexDirectWorkLiveRun | null>>;
  setQueueRunSource: Dispatch<SetStateAction<DirectWorkRunHandoff | null>>;
  setRunErrorMessage: Dispatch<SetStateAction<string | null>>;
  setRunInfoNotice: Dispatch<SetStateAction<NoticeState | null>>;
  setValidationRepositoryRoot: Dispatch<SetStateAction<string | null>>;
  stopActiveStreamListening: () => void;
  stopStreamListeningRef: MutableRefObject<(() => void) | null>;
  widgetInstanceId: WidgetInstanceId;
};

export function useCodexDirectWorkQueueHandoff({
  activeRequestRef,
  activeStreamingRunId,
  appendLocalLiveLogEntry,
  clearRunState,
  directWorkRunHandoff,
  isRunning,
  liveRun,
  onAttachToCodexDirectWorkStream,
  onGetAgentExecutorRunDetail,
  onIngestQueueLinkedDirectWorkEvidence,
  onQueueRunFinalState,
  recordStreamEvent,
  refreshRunHistory,
  runStartedAtRef,
  setActiveStreamingRunId,
  setIsRunning,
  setIsStopRequesting,
  setLiveRun,
  setQueueRunSource,
  setRunErrorMessage,
  setRunInfoNotice,
  setValidationRepositoryRoot,
  stopActiveStreamListening,
  stopStreamListeningRef,
  widgetInstanceId,
}: UseCodexDirectWorkQueueHandoffOptions) {
  const activeStreamingRunIdRef = useRef(activeStreamingRunId);
  const attachAbortControllerRef = useRef<AbortController | null>(null);
  const handledQueueHandoffIdRef = useRef<number | null>(null);
  const handledEvidenceIngestionKeysRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(false);
  const liveRunRef = useRef(liveRun);
  const recoveryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeStreamingRunIdRef.current = activeStreamingRunId;
  }, [activeStreamingRunId]);

  useEffect(() => {
    liveRunRef.current = liveRun;
  }, [liveRun]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      attachAbortControllerRef.current?.abort();
      attachAbortControllerRef.current = null;
      clearQueueHandoffRecoveryTimer();
    };
  }, []);

  useEffect(() => {
    if (
      !directWorkRunHandoff ||
      handledQueueHandoffIdRef.current === directWorkRunHandoff.id
    ) {
      return;
    }

    handledQueueHandoffIdRef.current = directWorkRunHandoff.id;
    void attachQueueStartedRun(directWorkRunHandoff);
  }, [directWorkRunHandoff]);

  async function attachQueueStartedRun(handoff: DirectWorkRunHandoff) {
    if (isRunning || activeStreamingRunId) {
      setRunInfoNotice({
        message:
          "This Agent Executor already has an active run. The Queue-started run was not attached in this UI session.",
        title: "Queue run handoff ignored",
      });
      return;
    }

    if (!onAttachToCodexDirectWorkStream) {
      setRunErrorMessage("Codex Direct Work stream attachment is unavailable.");
      return;
    }

    clearRunState();
    const startedAtMs = handoffStartedAtMs(handoff.startedAt);
    const initialLiveRun = queueHandoffLiveRun(handoff.runId, startedAtMs);
    setQueueRunSource(handoff);
    activeRequestRef.current = queueHandoffRequestDraft(handoff.repoRoot);
    runStartedAtRef.current = startedAtMs;
    activeStreamingRunIdRef.current = handoff.runId;
    liveRunRef.current = initialLiveRun;
    setIsRunning(true);
    setActiveStreamingRunId(handoff.runId);
    setLiveRun(initialLiveRun);
    appendLocalLiveLogEntry(
      "queue_handoff_attached",
      "Attached to Queue-started Direct Work run.",
      "info",
      `Run id: ${handoff.runId}`,
      "running",
      handoff.runId,
    );

    attachAbortControllerRef.current?.abort();
    const attachAbortController = new AbortController();
    attachAbortControllerRef.current = attachAbortController;

    try {
      const session = await onAttachToCodexDirectWorkStream(
        widgetInstanceId,
        handoff.runId,
        (event) => {
          recordStreamEvent(event);
          notifyQueueRunFinalStateFromEvent(handoff, event);
        },
        attachAbortController.signal,
      ).finally(() => {
        if (attachAbortControllerRef.current === attachAbortController) {
          attachAbortControllerRef.current = null;
        }
      });

      if (!isMountedRef.current || attachAbortController.signal.aborted) {
        session?.stopListening();
        return;
      }

      if (!session) {
        throw new Error("Queue-started Direct Work stream was not attached.");
      }

      stopStreamListeningRef.current = session.stopListening;
      scheduleQueueHandoffRecovery(handoff);
    } catch (error) {
      if (!isMountedRef.current || attachAbortController.signal.aborted) {
        return;
      }

      clearQueueHandoffRecoveryTimer();
      setRunErrorMessage(codexDirectWorkErrorToMessage(error));
      liveRunRef.current = null;
      activeStreamingRunIdRef.current = null;
      setLiveRun(null);
      setIsRunning(false);
      setActiveStreamingRunId(null);
    }
  }

  function scheduleQueueHandoffRecovery(handoff: DirectWorkRunHandoff) {
    if (!onGetAgentExecutorRunDetail || typeof window === "undefined") {
      return;
    }

    clearQueueHandoffRecoveryTimer();
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      void recoverQueueHandoffRunDetail(handoff);
    }, QUEUE_HANDOFF_RECOVERY_DELAY_MS);
  }

  async function recoverQueueHandoffRunDetail(handoff: DirectWorkRunHandoff) {
    const runId = handoff.runId;

    if (!onGetAgentExecutorRunDetail || !shouldRecoverRun(runId)) {
      return;
    }

    let detail: AgentExecutorRunDetail | null = null;
    try {
      detail = await onGetAgentExecutorRunDetail(widgetInstanceId, runId);
    } catch {
      return;
    }

    if (
      !detail ||
      detail.summary.runId !== runId ||
      !isFinalStatus(detail.summary.status) ||
      !shouldRecoverRun(runId)
    ) {
      return;
    }

    const currentRun = liveRunRef.current;
    const recoveredRun = queueHandoffLiveRunFromDetail(
      detail,
      currentRun?.startedAtMs ?? runStartedAtRef.current,
    );
    const repositoryRoot =
      activeRequestRef.current?.repoRoot || detail.summary.repoRoot;

    stopActiveStreamListening();
    liveRunRef.current = recoveredRun;
    activeStreamingRunIdRef.current = null;
    setLiveRun(recoveredRun);
    setIsRunning(false);
    setIsStopRequesting(false);
    setActiveStreamingRunId(null);
    setValidationRepositoryRoot(repositoryRoot ?? null);
    activeRequestRef.current = null;
    refreshRunHistory();
    const identityResult = createQueueLinkedDirectWorkCompletionIdentity({
      handoff,
      runDetail: detail,
      source: "recovered_handoff",
    });

    if (identityResult.status === "valid") {
      onQueueRunFinalState?.(
        identityResult.handoff ?? handoff,
        detail.summary.status,
      );
      void ingestRecoveredQueueEvidence(
        identityResult.handoff ?? handoff,
        detail,
        detail.summary.status,
      );
    }
    setRunInfoNotice({
      message:
        "The Queue-started run had already reached a final state; Agent Executor loaded its stored result.",
      title: "Queue run final state loaded",
    });
    appendLocalLiveLogEntry(
      "queue_handoff_attached",
      "Loaded final Queue-started run from stored Agent Executor result.",
      recoveredLogTone(recoveredRun.status),
      "The live stream had no final event in this UI session.",
      recoveredRun.status,
      runId,
    );
  }

  function shouldRecoverRun(runId: string) {
    const currentRun = liveRunRef.current;

    return (
      activeStreamingRunIdRef.current === runId &&
      currentRun?.runId === runId &&
      !isFinalStatus(currentRun.status)
    );
  }

  function notifyQueueRunFinalStateFromEvent(
    handoff: DirectWorkRunHandoff,
    event: DirectWorkStreamEvent,
  ) {
    if (!event.isFinal || event.runId !== handoff.runId) {
      return;
    }

    const finalStatus = finalStreamEventStatus(event);
    const identityResult = createQueueLinkedDirectWorkCompletionIdentity({
      handoff,
      streamEvent: event,
    });

    if (finalStatus && identityResult.status === "valid") {
      onQueueRunFinalState?.(identityResult.handoff ?? handoff, finalStatus);
      void ingestFinalStreamQueueEvidence(
        identityResult.handoff ?? handoff,
        event,
        finalStatus,
      );
    }
  }

  async function ingestFinalStreamQueueEvidence(
    handoff: DirectWorkRunHandoff,
    event: DirectWorkStreamEvent,
    finalStatus: string,
  ) {
    let runDetail: AgentExecutorRunDetail | null = null;

    if (onGetAgentExecutorRunDetail) {
      try {
        runDetail = await onGetAgentExecutorRunDetail(
          widgetInstanceId,
          handoff.runId,
        );
      } catch {
        runDetail = null;
      }
    }

    const result = await ingestQueueLinkedDirectWorkCompletionEvidence({
      finalStatus,
      handoff,
      handledIngestionKeys: handledEvidenceIngestionKeysRef.current,
      ingestEvidence: onIngestQueueLinkedDirectWorkEvidence,
      runDetail,
      streamEvent: event,
    });

    recordQueueEvidenceWiringResult(result);
  }

  async function ingestRecoveredQueueEvidence(
    handoff: DirectWorkRunHandoff,
    runDetail: AgentExecutorRunDetail,
    finalStatus: string,
  ) {
    const result = await ingestQueueLinkedDirectWorkCompletionEvidence({
      finalStatus,
      handoff,
      handledIngestionKeys: handledEvidenceIngestionKeysRef.current,
      ingestEvidence: onIngestQueueLinkedDirectWorkEvidence,
      runDetail,
      source: "recovered_handoff",
    });

    recordQueueEvidenceWiringResult(result);
  }

  function recordQueueEvidenceWiringResult(
    result: QueueLinkedDirectWorkEvidenceWiringResult,
  ) {
    if (!isMountedRef.current) {
      return;
    }

    appendLocalLiveLogEntry(
      "queue_evidence_ingestion",
      result.activityTitle,
      queueEvidenceLogTone(result.status),
      queueEvidenceLogDetail(result),
      result.status,
      result.runId,
    );
  }

  function clearQueueHandoffRecoveryTimer() {
    if (recoveryTimerRef.current === null) {
      return;
    }

    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
  }
}

function finalStreamEventStatus(event: DirectWorkStreamEvent) {
  const status = event.status ?? event.eventKind;

  return isFinalStatus(status) ? status : null;
}

function recoveredLogTone(
  status: string,
): CodexDirectWorkLiveLogEntry["tone"] {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed" || status === "timed_out") {
    return "error";
  }

  return "info";
}

function queueEvidenceLogTone(
  status: QueueLinkedDirectWorkEvidenceWiringResult["status"],
): CodexDirectWorkLiveLogEntry["tone"] {
  if (status === "success") {
    return "success";
  }

  if (
    status === "duplicate_ignored" ||
    status === "not_queue_linked" ||
    status === "missing_queue_item" ||
    status === "missing_run_id" ||
    status === "missing_executor_widget"
  ) {
    return "info";
  }

  return "error";
}

function queueEvidenceLogDetail(
  result: QueueLinkedDirectWorkEvidenceWiringResult,
) {
  const parts = [
    result.productStatusLabel,
    result.taskId ? `Queue item: ${result.taskId}` : null,
    result.runId ? `Run id: ${result.runId}` : null,
    result.reasons[0] ?? null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}
