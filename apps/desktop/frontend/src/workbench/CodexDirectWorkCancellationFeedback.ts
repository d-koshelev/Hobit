import type {
  CancelCodexDirectWorkRunResponse,
  ForceKillCodexDirectWorkRunResponse,
} from "../workspace/types";
import type {
  CodexDirectWorkLiveLogEntryKind,
  CodexDirectWorkLiveLogEntryTone,
} from "./CodexDirectWorkLiveLog";
import { cancellationStatusMessage } from "./CodexDirectWorkStatusText";

type CancellationLiveLogEntry = {
  detail: string;
  kind: CodexDirectWorkLiveLogEntryKind;
  runId: string;
  status: string;
  text: string;
  tone: CodexDirectWorkLiveLogEntryTone;
};

export type CodexDirectWorkCancellationFeedback = {
  entry: CancellationLiveLogEntry;
  notice: {
    message: string;
    title: string;
    variant: "info" | "error";
  };
};

export function cancellationFeedbackFromResponse(
  response: CancelCodexDirectWorkRunResponse,
): CodexDirectWorkCancellationFeedback {
  const message = response.message || cancellationStatusMessage(response.status);

  if (
    response.cancellationRequested ||
    response.status === "cancellation_requested"
  ) {
    return {
      entry: {
        detail: "Waiting for the Direct Work stream to finish cancellation.",
        kind: "stop_acknowledged",
        runId: response.runId,
        status: response.status,
        text: "Stop request accepted.",
        tone: "info",
      },
      notice: {
        message:
          "Stop requested; waiting for the run to finish cancellation. Review Git status after cancellation if files may have changed.",
        title: "Stop requested",
        variant: "info",
      },
    };
  }

  if (response.status === "already_finished") {
    return {
      entry: {
        detail: message,
        kind: "stop_not_active",
        runId: response.runId,
        status: response.status,
        text: "Run already finished.",
        tone: "neutral",
      },
      notice: {
        message,
        title: "Run already finished",
        variant: "info",
      },
    };
  }

  if (response.status === "not_found" || response.status === "not_active") {
    return {
      entry: {
        detail: message,
        kind: "stop_not_active",
        runId: response.runId,
        status: response.status,
        text: "No active run to stop.",
        tone: "neutral",
      },
      notice: {
        message,
        title:
          response.status === "not_active"
            ? "Run is not active"
            : "Run was not found",
        variant: "info",
      },
    };
  }

  return {
    entry: {
      detail: message,
      kind: "stop_not_active",
      runId: response.runId,
      status: response.status,
      text: "Stop request returned a status.",
      tone: "neutral",
    },
    notice: {
      message,
      title: "Stop request status",
      variant: "info",
    },
  };
}

export function forceKillFeedbackFromResponse(
  response: ForceKillCodexDirectWorkRunResponse,
): CodexDirectWorkCancellationFeedback {
  const message = response.message || cancellationStatusMessage(response.status);

  if (
    response.forceKillRequested ||
    response.status === "force_kill_requested"
  ) {
    return {
      entry: {
        detail:
          "Waiting for the Direct Work stream to report a final cancelled state. Files already written are not rolled back; check Git status after killing.",
        kind: "kill_acknowledged",
        runId: response.runId,
        status: response.status,
        text: "Kill request accepted.",
        tone: "error",
      },
      notice: {
        message:
          "Force kill requested; waiting for the run to report cancellation. Files already written are not rolled back. Check Git status after killing.",
        title: "Kill requested",
        variant: "error",
      },
    };
  }

  if (response.status === "already_finished") {
    return {
      entry: {
        detail: message,
        kind: "kill_not_active",
        runId: response.runId,
        status: response.status,
        text: "Run already finished.",
        tone: "neutral",
      },
      notice: {
        message,
        title: "Run already finished",
        variant: "info",
      },
    };
  }

  if (response.status === "not_found" || response.status === "not_active") {
    return {
      entry: {
        detail: message,
        kind: "kill_not_active",
        runId: response.runId,
        status: response.status,
        text: "No active run to kill.",
        tone: "neutral",
      },
      notice: {
        message,
        title:
          response.status === "not_active"
            ? "Run is not active"
            : "Run was not found",
        variant: "info",
      },
    };
  }

  return {
    entry: {
      detail: message,
      kind: "kill_not_active",
      runId: response.runId,
      status: response.status,
      text: "Kill request returned a status.",
      tone: "neutral",
    },
    notice: {
      message,
      title: "Kill request status",
      variant: "info",
    },
  };
}
