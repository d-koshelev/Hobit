import { useState } from "react";

import type {
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  ForceKillCodexDirectWorkRunResponse,
} from "../workspace/types";
import {
  cancellationFeedbackFromResponse,
  forceKillFeedbackFromResponse,
} from "./CodexDirectWorkCancellationFeedback";
import { codexDirectWorkErrorToMessage } from "./CodexDirectWorkErrors";
import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveLogEntryKind,
} from "./CodexDirectWorkLiveLog";
import type { WidgetInstanceId } from "./types";

type CodexDirectWorkStopNotice = {
  message: string;
  title: string;
  variant: "info" | "error";
};

type AppendLocalLiveLogEntry = (
  kind: CodexDirectWorkLiveLogEntryKind,
  text: string,
  tone: CodexDirectWorkLiveLogEntry["tone"],
  detail?: string,
  status?: string | null,
  runId?: string,
) => void;

type UseCodexDirectWorkRunControlsInput = {
  activeStreamingRunId: string | null;
  appendLocalLiveLogEntry: AppendLocalLiveLogEntry;
  canKillActiveStreamingRun: boolean;
  onCancelCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  onForceKillCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<ForceKillCodexDirectWorkRunResponse | null>;
  widgetInstanceId: WidgetInstanceId;
};

export function useCodexDirectWorkRunControls({
  activeStreamingRunId,
  appendLocalLiveLogEntry,
  canKillActiveStreamingRun,
  onCancelCodexDirectWorkRun,
  onForceKillCodexDirectWorkRun,
  widgetInstanceId,
}: UseCodexDirectWorkRunControlsInput) {
  const [stopNotice, setStopNotice] =
    useState<CodexDirectWorkStopNotice | null>(null);
  const [isStopRequesting, setIsStopRequesting] = useState(false);
  const [isKillConfirming, setIsKillConfirming] = useState(false);
  const [isKillRequesting, setIsKillRequesting] = useState(false);

  function resetRunControlState() {
    setStopNotice(null);
    setIsStopRequesting(false);
    setIsKillConfirming(false);
    setIsKillRequesting(false);
  }

  function recordFinalStreamControlState(event: DirectWorkStreamEvent) {
    setIsStopRequesting(false);
    setIsKillConfirming(false);
    setIsKillRequesting(false);

    if ((event.status ?? event.eventKind) !== "cancelled") {
      return;
    }

    const wasForceKilled = event.errorMessage?.includes("force-killed");
    setStopNotice({
      message: wasForceKilled
        ? "The active Codex process reported force-killed cancellation. Files already written are not rolled back; check Git status if files may have changed."
        : "The active Codex process reported cancelled. This does not reset files or undo changes already written.",
      title: "Run cancelled",
      variant: wasForceKilled ? "error" : "info",
    });
  }

  async function stopStreamingRun() {
    const runId = activeStreamingRunId;

    if (!runId || !onCancelCodexDirectWorkRun || isStopRequesting) {
      return;
    }

    setIsStopRequesting(true);
    setStopNotice({
      message:
        "Stop run attempts to stop the active Codex process. It does not reset files or undo changes already written.",
      title: "Stop requested",
      variant: "info",
    });
    appendLocalLiveLogEntry(
      "stop_requested",
      "Stop requested.",
      "info",
      "Waiting for the Direct Work stream to report a final cancelled state.",
      "stopping",
      runId,
    );

    try {
      const response = await onCancelCodexDirectWorkRun(
        widgetInstanceId,
        runId,
      );

      if (!response) {
        throw new Error("Cancellation command returned no response.");
      }

      recordCancellationResponse(response);
    } catch (error) {
      const message = codexDirectWorkErrorToMessage(error);
      appendLocalLiveLogEntry(
        "stop_failed",
        "Stop request failed.",
        "error",
        message,
        "failed",
        runId,
      );
      setStopNotice({
        message,
        title: "Stop request failed",
        variant: "error",
      });
    } finally {
      setIsStopRequesting(false);
    }
  }

  function requestKillConfirmation() {
    if (!canKillActiveStreamingRun || isKillRequesting) {
      return;
    }

    setIsKillConfirming(true);
  }

  function cancelKillConfirmation() {
    if (!isKillRequesting) {
      setIsKillConfirming(false);
    }
  }

  async function forceKillStreamingRun() {
    const runId = activeStreamingRunId;

    if (
      !runId ||
      !onForceKillCodexDirectWorkRun ||
      isKillRequesting ||
      !canKillActiveStreamingRun
    ) {
      return;
    }

    setIsKillRequesting(true);
    setIsKillConfirming(false);
    setStopNotice({
      message:
        "Force kill requested. Files already written are not rolled back; check Git status after killing.",
      title: "Kill requested",
      variant: "error",
    });
    appendLocalLiveLogEntry(
      "kill_requested",
      "Kill requested.",
      "error",
      "Force terminating the active Codex process. Files already written are not rolled back; check Git status after killing.",
      "killing",
      runId,
    );

    try {
      const response = await onForceKillCodexDirectWorkRun(
        widgetInstanceId,
        runId,
      );

      if (!response) {
        throw new Error("Force kill command returned no response.");
      }

      recordForceKillResponse(response);
    } catch (error) {
      const message = codexDirectWorkErrorToMessage(error);
      appendLocalLiveLogEntry(
        "kill_failed",
        "Kill request failed.",
        "error",
        message,
        "failed",
        runId,
      );
      setStopNotice({
        message,
        title: "Kill request failed",
        variant: "error",
      });
    } finally {
      setIsKillRequesting(false);
    }
  }

  function recordCancellationResponse(
    response: CancelCodexDirectWorkRunResponse,
  ) {
    const feedback = cancellationFeedbackFromResponse(response);
    appendLocalLiveLogEntry(
      feedback.entry.kind,
      feedback.entry.text,
      feedback.entry.tone,
      feedback.entry.detail,
      feedback.entry.status,
      feedback.entry.runId,
    );
    setStopNotice(feedback.notice);
  }

  function recordForceKillResponse(
    response: ForceKillCodexDirectWorkRunResponse,
  ) {
    const feedback = forceKillFeedbackFromResponse(response);
    appendLocalLiveLogEntry(
      feedback.entry.kind,
      feedback.entry.text,
      feedback.entry.tone,
      feedback.entry.detail,
      feedback.entry.status,
      feedback.entry.runId,
    );
    setStopNotice(feedback.notice);
  }

  return {
    cancelKillConfirmation,
    forceKillStreamingRun,
    isKillConfirming,
    isKillRequesting,
    isStopRequesting,
    recordFinalStreamControlState,
    requestKillConfirmation,
    resetRunControlState,
    setIsStopRequesting,
    stopNotice,
    stopStreamingRun,
  };
}
