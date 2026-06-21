import type {
  CodexDirectWorkRunRequest,
  CodexDirectWorkStreamSession,
} from "../directWorkStreamSessions";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  DirectWorkStreamEvent,
} from "../../workspace/types";
import {
  createWorkerProviderCapabilities,
  evidenceSummaryFromWorkerProviderFinalResult,
  type WorkerProvider,
  type WorkerProviderEvent,
  type WorkerProviderFinalResult,
  type WorkerProviderRunSnapshot,
  type WorkerProviderWorkRequest,
} from "./workerProvider";

export const CODEX_WORKER_PROVIDER_ID = "codex-direct-work-worker";

export type CodexWorkerProviderActions = {
  cancelCodexDirectWorkRun?: (
    widgetInstanceId: string,
    runId: string,
  ) => Promise<unknown>;
  startCodexDirectWorkStream?: (
    widgetInstanceId: string,
    request: CodexDirectWorkRunRequest,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<CodexDirectWorkStreamSession | null>;
};

export type CodexWorkerProviderOptions = CodexWorkerProviderActions & {
  codexExecutable: string;
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
};

export function createCodexWorkerProvider({
  cancelCodexDirectWorkRun,
  codexExecutable,
  startCodexDirectWorkStream,
  stderrCapBytes = null,
  stdoutCapBytes = null,
  timeoutMs = null,
}: CodexWorkerProviderOptions): WorkerProvider {
  const runOwners = new Map<string, string>();
  const runSnapshots = new Map<string, WorkerProviderRunSnapshot>();
  const capabilities = createWorkerProviderCapabilities({
    supportsCancellation: Boolean(cancelCodexDirectWorkRun),
    supportsProviderThreads: true,
    supportsRunLookup: true,
    supportsStreamingOutput: true,
  });

  return {
    capabilities,
    async cancelRun(runId) {
      const executorWidgetId = runOwners.get(runId);
      if (!cancelCodexDirectWorkRun) {
        return {
          message: "Codex worker cancellation is unavailable.",
          providerId: CODEX_WORKER_PROVIDER_ID,
          runId,
          status: "not_supported",
        };
      }

      if (!executorWidgetId) {
        return {
          message: "Codex worker run owner is unavailable.",
          providerId: CODEX_WORKER_PROVIDER_ID,
          runId,
          status: "not_found",
        };
      }

      const response = await cancelCodexDirectWorkRun(executorWidgetId, runId);
      return {
        message: responseMessage(response, "Codex worker cancellation requested."),
        providerId: CODEX_WORKER_PROVIDER_ID,
        runId,
        status: "requested",
      };
    },
    async getRun(runId) {
      return runSnapshots.get(runId) ?? null;
    },
    providerDisplayName: "Codex Direct Work Worker",
    providerId: CODEX_WORKER_PROVIDER_ID,
    async startWork(request, onEvent, options) {
      if (!startCodexDirectWorkStream) {
        onEvent({
          errorCode: "codex_stream_unavailable",
          errorMessage: "Codex Direct Work stream API is unavailable.",
          executorWidgetId: request.executorWidgetId,
          providerId: CODEX_WORKER_PROVIDER_ID,
          providerThreadId: request.providerThreadId ?? null,
          runId: request.id,
          sequence: 1,
          taskId: request.taskId,
          timestampMs: Date.now(),
          type: "worker_error",
        });
        return null;
      }

      let sequence = 0;
      const startedAtMs = Date.now();
      const session = await startCodexDirectWorkStream(
        request.executorWidgetId,
        codexWorkerRequestToDirectWorkRequest(request, {
          codexExecutable,
          stderrCapBytes,
          stdoutCapBytes,
          timeoutMs,
        }),
        (event) => {
          for (const workerEvent of directWorkEventToWorkerEvents({
            event,
            request,
            sequenceStart: sequence + 1,
            startedAtMs,
          })) {
            sequence = workerEvent.sequence;
            onEvent(workerEvent);
            updateRunSnapshot(runSnapshots, workerEvent);
          }
        },
        options?.signal,
      );

      if (!session) {
        onEvent({
          errorCode: "codex_stream_not_accepted",
          errorMessage:
            "Codex Direct Work stream was not accepted for this worker.",
          executorWidgetId: request.executorWidgetId,
          providerId: CODEX_WORKER_PROVIDER_ID,
          providerThreadId: request.providerThreadId ?? null,
          runId: request.id,
          sequence: sequence + 1,
          taskId: request.taskId,
          timestampMs: Date.now(),
          type: "worker_error",
        });
        return null;
      }

      runOwners.set(session.runId, request.executorWidgetId);
      runSnapshots.set(session.runId, {
        providerId: CODEX_WORKER_PROVIDER_ID,
        providerRunId: session.runId,
        providerThreadId: request.providerThreadId ?? null,
        runId: session.runId,
        status: "running",
        taskId: request.taskId,
      });

      return {
        executorWidgetId: request.executorWidgetId,
        providerId: CODEX_WORKER_PROVIDER_ID,
        providerRunId: session.runId,
        providerThreadId: request.providerThreadId ?? null,
        runId: session.runId,
        stopListening: session.stopListening,
        taskId: request.taskId,
      };
    },
  };
}

export function codexWorkerRequestToDirectWorkRequest(
  request: WorkerProviderWorkRequest,
  options: {
    codexExecutable: string;
    stderrCapBytes?: number | null;
    stdoutCapBytes?: number | null;
    timeoutMs?: number | null;
  },
): CodexDirectWorkRunRequest {
  return {
    approvalPolicy: request.approvalPolicy as DirectWorkApprovalPolicy,
    codexExecutable: options.codexExecutable,
    codexThreadId: request.providerThreadId ?? null,
    operatorPrompt: request.prompt,
    repoRoot: request.executionWorkspace,
    sandbox: request.sandbox as DirectWorkSandbox,
    skipGitRepoCheck: true,
    stderrCapBytes: options.stderrCapBytes ?? null,
    stdoutCapBytes: options.stdoutCapBytes ?? null,
    timeoutMs: options.timeoutMs ?? null,
  };
}

export function directWorkEventToWorkerEvents({
  event,
  request,
  sequenceStart,
  startedAtMs,
}: {
  event: DirectWorkStreamEvent;
  request: WorkerProviderWorkRequest;
  sequenceStart: number;
  startedAtMs: number;
}): WorkerProviderEvent[] {
  const base = {
    executorWidgetId: request.executorWidgetId,
    providerId: CODEX_WORKER_PROVIDER_ID,
    providerRunId: event.runId,
    providerThreadId: event.codexThreadId ?? request.providerThreadId ?? null,
    runId: event.runId,
    taskId: request.taskId,
    timestampMs: Date.now(),
  };

  if (event.eventKind === "started") {
    return [
      {
        ...base,
        sequence: sequenceStart,
        type: "worker_run_started",
      },
    ];
  }

  if (event.isFinal) {
    const result = directWorkFinalEventToWorkerProviderFinalResult({
      event,
      request,
      startedAtMs,
    });
    const evidenceEvent: WorkerProviderEvent = {
      ...base,
      evidence: evidenceSummaryFromWorkerProviderFinalResult(result),
      evidenceBundleId: result.evidenceBundleId,
      sequence: sequenceStart,
      type: "worker_evidence_available",
    };
    const terminalEvent: WorkerProviderEvent = {
      ...base,
      evidenceBundleId: result.evidenceBundleId,
      result,
      sequence: sequenceStart + 1,
      type: terminalEventTypeForFinalResult(result),
    };
    return [evidenceEvent, terminalEvent];
  }

  if (event.eventKind === "stdout_line") {
    return [
      {
        ...base,
        sequence: sequenceStart,
        text: directWorkEventText(event) ?? "",
        type: "worker_output_delta",
      },
    ];
  }

  if (event.eventKind === "stderr_line" || event.eventKind === "codex_json_event") {
    return [
      {
        ...base,
        sequence: sequenceStart,
        text: directWorkEventText(event) ?? event.eventKind,
        type: "worker_log_delta",
      },
    ];
  }

  if (event.eventKind === "failed" || event.eventKind === "timed_out") {
    return [
      {
        ...base,
        errorMessage:
          event.errorMessage ??
          event.text ??
          event.stderrPreview ??
          "Codex Direct Work worker failed.",
        sequence: sequenceStart,
        type: "worker_error",
      },
    ];
  }

  return [
    {
      ...base,
      sequence: sequenceStart,
      text: directWorkEventText(event) ?? event.eventKind,
      type: "worker_log_delta",
    },
  ];
}

export function directWorkFinalEventToWorkerProviderFinalResult({
  event,
  request,
  startedAtMs,
}: {
  event: DirectWorkStreamEvent;
  request: WorkerProviderWorkRequest;
  startedAtMs: number;
}): WorkerProviderFinalResult {
  const completedAtMs = Date.now();
  const status = finalStatusFromDirectWorkEvent(event);
  const message = directWorkEventText(event);
  const errorMessage =
    status === "failed" || status === "stopped" || status === "cancelled"
      ? event.errorMessage ?? event.stderrPreview ?? message
      : undefined;

  return {
    changedFiles: [],
    completedAtMs,
    elapsedMs:
      event.elapsedMs >= 0 ? event.elapsedMs : completedAtMs - startedAtMs,
    ...(errorMessage ? { errorMessage } : {}),
    executorWidgetId: request.executorWidgetId,
    ...(status === "failed" && errorMessage ? { failureReason: errorMessage } : {}),
    ...(message ? { finalMessage: message, summary: message } : {}),
    providerId: CODEX_WORKER_PROVIDER_ID,
    providerMetadata: {
      directWorkEventKind: event.eventKind,
      exitCode: event.exitCode,
      failedStage: event.failedStage,
      finalStatus: event.finalStatus,
      source: request.source ?? "worker_provider",
      status: event.status,
    },
    providerRunId: event.runId,
    providerThreadId: event.codexThreadId ?? request.providerThreadId ?? null,
    runId: event.runId,
    startedAtMs,
    status,
    ...(status === "stopped" && errorMessage ? { stuckReason: errorMessage } : {}),
    taskId: request.taskId,
    validation: { status: "not_run" },
    workerId: request.workerId,
  };
}

function updateRunSnapshot(
  snapshots: Map<string, WorkerProviderRunSnapshot>,
  event: WorkerProviderEvent,
) {
  if ("result" in event) {
    snapshots.set(event.runId, {
      finalResult: event.result,
      providerId: event.providerId,
      providerRunId: event.providerRunId,
      providerThreadId: event.providerThreadId,
      runId: event.runId,
      status: event.result.status,
      taskId: event.taskId,
    });
    return;
  }

  if (event.type === "worker_run_started") {
    snapshots.set(event.runId, {
      providerId: event.providerId,
      providerRunId: event.providerRunId,
      providerThreadId: event.providerThreadId,
      runId: event.runId,
      status: "running",
      taskId: event.taskId,
    });
  }
}

function terminalEventTypeForFinalResult(
  result: WorkerProviderFinalResult,
): Extract<
  WorkerProviderEvent["type"],
  "worker_cancelled" | "worker_completed" | "worker_failed" | "worker_stopped"
> {
  if (result.status === "completed") {
    return "worker_completed";
  }

  if (result.status === "cancelled") {
    return "worker_cancelled";
  }

  if (result.status === "stopped" || result.status === "not_completed") {
    return "worker_stopped";
  }

  return "worker_failed";
}

function finalStatusFromDirectWorkEvent(
  event: DirectWorkStreamEvent,
): WorkerProviderFinalResult["status"] {
  if (event.eventKind === "cancelled" || event.finalStatus === "cancelled") {
    return "cancelled";
  }

  if (event.eventKind === "timed_out" || event.finalStatus === "timed_out") {
    return "stopped";
  }

  if (event.eventKind === "completed" || event.finalStatus === "completed") {
    return "completed";
  }

  return "failed";
}

function directWorkEventText(event: DirectWorkStreamEvent) {
  return (
    event.text ??
    event.line ??
    event.errorMessage ??
    event.stderrPreview ??
    event.status ??
    event.finalStatus ??
    undefined
  );
}

function responseMessage(value: unknown, fallback: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return fallback;
}
