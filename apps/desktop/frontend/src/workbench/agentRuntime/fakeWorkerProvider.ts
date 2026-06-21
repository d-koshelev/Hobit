import {
  createWorkerProviderCapabilities,
  evidenceSummaryFromWorkerProviderFinalResult,
  type WorkerProvider,
  type WorkerProviderEvent,
  type WorkerProviderFinalResult,
  type WorkerProviderFinalStatus,
  type WorkerProviderRunSnapshot,
  type WorkerProviderWorkRequest,
} from "./workerProvider";

export type FakeWorkerProviderScenario =
  | "cancelled"
  | "completed_with_evidence"
  | "failed_with_evidence"
  | "output_and_logs"
  | "provider_error"
  | "stopped";

export type FakeWorkerProviderScriptStep =
  | {
      text: string;
      type: "worker_log_delta" | "worker_output_delta";
    }
  | {
      evidence?: Partial<ReturnType<typeof evidenceSummaryFromWorkerProviderFinalResult>>;
      type: "worker_evidence_available";
    }
  | {
      result?: Partial<WorkerProviderFinalResult>;
      type:
        | "worker_cancelled"
        | "worker_completed"
        | "worker_failed"
        | "worker_stopped";
    }
  | {
      errorCode?: string;
      errorMessage: string;
      type: "worker_error";
    };

export type FakeWorkerProviderOptions = {
  providerDisplayName?: string;
  providerId?: string;
  providerRunId?: string;
  providerThreadId?: string | null;
  runId?: string;
  script: readonly FakeWorkerProviderScriptStep[];
};

export function createFakeWorkerProvider({
  providerDisplayName = "Fake Worker Provider",
  providerId = "fake-worker-provider",
  providerRunId,
  providerThreadId = "fake-worker-thread-1",
  runId = "fake-worker-run-1",
  script,
}: FakeWorkerProviderOptions): WorkerProvider {
  const runs = new Map<string, WorkerProviderRunSnapshot>();

  return {
    capabilities: createWorkerProviderCapabilities({
      supportsCancellation: true,
      supportsProviderThreads: true,
      supportsRunLookup: true,
      supportsStreamingOutput: true,
    }),
    async cancelRun(activeRunId) {
      const current = runs.get(activeRunId);
      if (!current) {
        return {
          message: "Fake worker run was not found.",
          providerId,
          runId: activeRunId,
          status: "not_found",
        };
      }

      runs.set(activeRunId, {
        ...current,
        status: "cancelled",
      });
      return {
        message: "Fake worker cancellation requested.",
        providerId,
        runId: activeRunId,
        status: "requested",
      };
    },
    async getRun(activeRunId) {
      return runs.get(activeRunId) ?? null;
    },
    providerDisplayName,
    providerId,
    async startWork(request, onEvent) {
      let sequence = 1;
      const startedAtMs = Date.now();
      const activeRunId = runId;
      const activeProviderRunId = providerRunId ?? activeRunId;
      const activeThreadId = request.providerThreadId ?? providerThreadId;

      runs.set(activeRunId, {
        providerId,
        providerRunId: activeProviderRunId,
        providerThreadId: activeThreadId,
        runId: activeRunId,
        status: "running",
        taskId: request.taskId,
      });

      onEvent({
        executorWidgetId: request.executorWidgetId,
        providerId,
        providerRunId: activeProviderRunId,
        providerThreadId: activeThreadId,
        runId: activeRunId,
        sequence: sequence++,
        taskId: request.taskId,
        timestampMs: startedAtMs,
        type: "worker_run_started",
      });

      let terminalSeen = false;
      for (const step of script) {
        const event = fakeStepToEvent({
          providerId,
          providerRunId: activeProviderRunId,
          providerThreadId: activeThreadId,
          request,
          runId: activeRunId,
          sequence: sequence++,
          startedAtMs,
          step,
        });
        onEvent(event);
        const result = "result" in event ? event.result : undefined;
        if (result) {
          runs.set(activeRunId, {
            finalResult: result,
            providerId,
            providerRunId: activeProviderRunId,
            providerThreadId: activeThreadId,
            runId: activeRunId,
            status: result.status,
            taskId: request.taskId,
          });
        }
        terminalSeen = terminalSeen || isTerminalWorkerEvent(event);
      }

      if (!terminalSeen) {
        const result = defaultFinalResult({
          providerId,
          providerRunId: activeProviderRunId,
          providerThreadId: activeThreadId,
          request,
          runId: activeRunId,
          startedAtMs,
          status: "completed",
        });
        onEvent({
          executorWidgetId: request.executorWidgetId,
          providerId,
          providerRunId: activeProviderRunId,
          providerThreadId: activeThreadId,
          result,
          runId: activeRunId,
          sequence: sequence++,
          taskId: request.taskId,
          timestampMs: Date.now(),
          type: "worker_completed",
        });
        runs.set(activeRunId, {
          finalResult: result,
          providerId,
          providerRunId: activeProviderRunId,
          providerThreadId: activeThreadId,
          runId: activeRunId,
          status: "completed",
          taskId: request.taskId,
        });
      }

      return {
        executorWidgetId: request.executorWidgetId,
        providerId,
        providerRunId: activeProviderRunId,
        providerThreadId: activeThreadId,
        runId: activeRunId,
        stopListening: () => undefined,
        taskId: request.taskId,
      };
    },
  };
}

export function fakeWorkerProviderScriptForScenario(
  scenario: FakeWorkerProviderScenario,
): readonly FakeWorkerProviderScriptStep[] {
  switch (scenario) {
    case "completed_with_evidence":
      return [
        { text: "Fake worker started implementation.", type: "worker_log_delta" },
        { text: "Implemented requested change.", type: "worker_output_delta" },
        { type: "worker_evidence_available" },
        {
          result: {
            changedFiles: [{ path: "src/fake.ts", status: "modified" }],
            finalMessage: "Fake worker completed.",
            status: "completed",
            summary: "Fake worker completed with evidence.",
            validation: {
              status: "passed",
              summary: "typecheck passed",
            },
          },
          type: "worker_completed",
        },
      ];
    case "failed_with_evidence":
      return [
        { text: "Fake worker hit a deterministic failure.", type: "worker_log_delta" },
        { type: "worker_evidence_available" },
        {
          result: {
            errorMessage: "Fake worker failed.",
            failureReason: "Fake validation failed.",
            status: "failed",
            summary: "Fake worker failed with evidence.",
            validation: {
              status: "failed",
              summary: "typecheck failed",
            },
          },
          type: "worker_failed",
        },
      ];
    case "provider_error":
      return [
        {
          errorCode: "fake_provider_error",
          errorMessage: "Fake worker provider error.",
          type: "worker_error",
        },
      ];
    case "cancelled":
      return [
        {
          result: {
            status: "cancelled",
            stuckReason: "Fake worker was cancelled.",
            summary: "Fake worker cancelled.",
          },
          type: "worker_cancelled",
        },
      ];
    case "stopped":
      return [
        {
          result: {
            status: "stopped",
            stuckReason: "Fake worker was stopped.",
            summary: "Fake worker stopped.",
          },
          type: "worker_stopped",
        },
      ];
    case "output_and_logs":
      return [
        { text: "stdout delta", type: "worker_output_delta" },
        { text: "log delta", type: "worker_log_delta" },
      ];
  }
}

function fakeStepToEvent({
  providerId,
  providerRunId,
  providerThreadId,
  request,
  runId,
  sequence,
  startedAtMs,
  step,
}: {
  providerId: string;
  providerRunId: string;
  providerThreadId: string | null;
  request: WorkerProviderWorkRequest;
  runId: string;
  sequence: number;
  startedAtMs: number;
  step: FakeWorkerProviderScriptStep;
}): WorkerProviderEvent {
  const base = {
    executorWidgetId: request.executorWidgetId,
    providerId,
    providerRunId,
    providerThreadId,
    runId,
    sequence,
    taskId: request.taskId,
    timestampMs: Date.now(),
  };

  if (step.type === "worker_output_delta" || step.type === "worker_log_delta") {
    return {
      ...base,
      text: step.text,
      type: step.type,
    };
  }

  if (step.type === "worker_error") {
    return {
      ...base,
      errorCode: step.errorCode,
      errorMessage: step.errorMessage,
      type: "worker_error",
    };
  }

  if (step.type === "worker_evidence_available") {
    const result = defaultFinalResult({
      providerId,
      providerRunId,
      providerThreadId,
      request,
      runId,
      startedAtMs,
      status: "completed",
    });
    return {
      ...base,
      evidence: {
        ...evidenceSummaryFromWorkerProviderFinalResult(result),
        ...step.evidence,
      },
      type: "worker_evidence_available",
    };
  }

  if (!isTerminalScriptStep(step)) {
    throw new Error(`Unsupported fake worker provider step: ${step.type}`);
  }

  const status = statusForTerminalStep(step.type);
  return {
    ...base,
    result: {
      ...defaultFinalResult({
        providerId,
        providerRunId,
        providerThreadId,
        request,
        runId,
        startedAtMs,
        status,
      }),
      ...step.result,
    },
    type: step.type,
  };
}

function defaultFinalResult({
  providerId,
  providerRunId,
  providerThreadId,
  request,
  runId,
  startedAtMs,
  status,
}: {
  providerId: string;
  providerRunId: string;
  providerThreadId: string | null;
  request: WorkerProviderWorkRequest;
  runId: string;
  startedAtMs: number;
  status: WorkerProviderFinalStatus;
}): WorkerProviderFinalResult {
  const completedAtMs = Date.now();
  return {
    changedFiles: [],
    completedAtMs,
    elapsedMs: completedAtMs - startedAtMs,
    executorWidgetId: request.executorWidgetId,
    finalMessage: status === "completed" ? "Fake worker completed." : undefined,
    providerId,
    providerMetadata: request.metadata,
    providerRunId,
    providerThreadId,
    runId,
    startedAtMs,
    status,
    summary: status === "completed" ? "Fake worker completed." : undefined,
    taskId: request.taskId,
    validation: { status: "not_run" },
    workerId: request.workerId,
  };
}

function statusForTerminalStep(
  type: Extract<
    FakeWorkerProviderScriptStep["type"],
    "worker_cancelled" | "worker_completed" | "worker_failed" | "worker_stopped"
  >,
): WorkerProviderFinalStatus {
  switch (type) {
    case "worker_completed":
      return "completed";
    case "worker_failed":
      return "failed";
    case "worker_cancelled":
      return "cancelled";
    case "worker_stopped":
      return "stopped";
  }
}

function isTerminalWorkerEvent(event: WorkerProviderEvent) {
  return (
    event.type === "worker_completed" ||
    event.type === "worker_failed" ||
    event.type === "worker_cancelled" ||
    event.type === "worker_stopped" ||
    event.type === "worker_error"
  );
}

function isTerminalScriptStep(
  step: FakeWorkerProviderScriptStep,
): step is Extract<
  FakeWorkerProviderScriptStep,
  {
    type:
      | "worker_cancelled"
      | "worker_completed"
      | "worker_failed"
      | "worker_stopped";
  }
> {
  return (
    step.type === "worker_completed" ||
    step.type === "worker_failed" ||
    step.type === "worker_cancelled" ||
    step.type === "worker_stopped"
  );
}
