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
  ) => Promise<CodexDirectWorkStreamSession | null>;
  onGetAgentExecutorRunDetail?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
  onQueueRunFinalState?: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  recordStreamEvent: (event: DirectWorkStreamEvent) => void;
  refreshRunHistory: () => void;
  requestGitReviewForRepositoryRoot: (repositoryRoot?: string | null) => void;
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
  onQueueRunFinalState,
  recordStreamEvent,
  refreshRunHistory,
  requestGitReviewForRepositoryRoot,
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
  const handledQueueHandoffIdRef = useRef<number | null>(null);
  const liveRunRef = useRef(liveRun);
  const recoveryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeStreamingRunIdRef.current = activeStreamingRunId;
  }, [activeStreamingRunId]);

  useEffect(() => {
    liveRunRef.current = liveRun;
  }, [liveRun]);

  useEffect(() => () => clearQueueHandoffRecoveryTimer(), []);

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

    try {
      const session = await onAttachToCodexDirectWorkStream(
        widgetInstanceId,
        handoff.runId,
        (event) => {
          recordStreamEvent(event);
          notifyQueueRunFinalStateFromEvent(handoff, event);
        },
      );

      if (!session) {
        throw new Error("Queue-started Direct Work stream was not attached.");
      }

      stopStreamListeningRef.current = session.stopListening;
      scheduleQueueHandoffRecovery(handoff);
    } catch (error) {
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
    requestGitReviewForRepositoryRoot(repositoryRoot);
    activeRequestRef.current = null;
    refreshRunHistory();
    onQueueRunFinalState?.(handoff, detail.summary.status);
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

    if (finalStatus) {
      onQueueRunFinalState?.(handoff, finalStatus);
    }
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
