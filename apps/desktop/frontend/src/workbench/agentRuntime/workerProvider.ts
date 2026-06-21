export type WorkerProviderId = string;

export type WorkerProviderSandbox =
  | "danger_full_access"
  | "read_only"
  | "workspace_write";

export type WorkerProviderApprovalPolicy =
  | "never"
  | "on_request"
  | "untrusted";

export type WorkerProviderCapabilities = {
  requiresExplicitWorkspace: boolean;
  supportsCancellation: boolean;
  supportsEvidenceEvents: boolean;
  supportsProviderThreads: boolean;
  supportsRunLookup: boolean;
  supportsStreamingOutput: boolean;
};

export type WorkerProviderWorkRequest = {
  approvalPolicy: WorkerProviderApprovalPolicy;
  createdAtMs: number;
  executionWorkspace: string;
  executorWidgetId: string;
  id: string;
  metadata?: Record<string, unknown>;
  prompt: string;
  providerThreadId?: string | null;
  sandbox: WorkerProviderSandbox;
  source?: string;
  taskId: string;
  workbenchId: string;
  workerId?: string;
  workspaceId: string;
};

export type WorkerProviderRunHandle = {
  executorWidgetId?: string;
  providerId: WorkerProviderId;
  providerRunId?: string;
  providerThreadId?: string | null;
  runId: string;
  stopListening: () => void;
  taskId?: string;
};

export type WorkerProviderCancelResult = {
  message: string;
  providerId: WorkerProviderId;
  runId: string;
  status: "cancelled" | "not_found" | "not_supported" | "requested" | "stopped";
};

export type WorkerProviderRunStatus =
  | "cancelled"
  | "completed"
  | "error"
  | "failed"
  | "not_completed"
  | "running"
  | "starting"
  | "stopped";

export type WorkerProviderFinalStatus = Exclude<
  WorkerProviderRunStatus,
  "running" | "starting"
>;

export type WorkerProviderEvidenceStatus =
  | "completed"
  | "failed"
  | "not_completed";

export type WorkerProviderChangedFile = {
  additions?: number | null;
  deletions?: number | null;
  path: string;
  status?: string;
  truncated?: boolean;
};

export type WorkerProviderValidationSummary = {
  exitCode?: number | null;
  outputPreview?: string;
  status: "failed" | "not_run" | "passed" | "unknown";
  summary?: string;
};

export type WorkerProviderEvidenceSummary = {
  changedFiles: readonly WorkerProviderChangedFile[];
  evidenceBundleId?: string;
  finalMessage?: string;
  providerMetadata?: Record<string, unknown>;
  report?: string;
  status: WorkerProviderEvidenceStatus;
  summary?: string;
  validation?: WorkerProviderValidationSummary;
};

export type WorkerProviderFinalResult = {
  changedFiles: readonly WorkerProviderChangedFile[];
  completedAtMs?: number;
  elapsedMs?: number | null;
  errorMessage?: string;
  evidenceBundleId?: string;
  executorWidgetId?: string;
  failureReason?: string;
  finalMessage?: string;
  providerId: WorkerProviderId;
  providerMetadata?: Record<string, unknown>;
  providerRunId?: string;
  providerThreadId?: string | null;
  runId: string;
  startedAtMs?: number;
  status: WorkerProviderFinalStatus;
  stuckReason?: string;
  summary?: string;
  taskId?: string;
  validation?: WorkerProviderValidationSummary;
  workerId?: string;
};

export type WorkerProviderRunSnapshot = {
  finalResult?: WorkerProviderFinalResult;
  providerId: WorkerProviderId;
  providerRunId?: string;
  providerThreadId?: string | null;
  runId: string;
  status: WorkerProviderRunStatus;
  taskId?: string;
};

type WorkerProviderEventBase = {
  evidenceBundleId?: string;
  executorWidgetId?: string;
  providerId: WorkerProviderId;
  providerRunId?: string;
  providerThreadId?: string | null;
  runId: string;
  sequence: number;
  taskId?: string;
  timestampMs: number;
};

export type WorkerProviderEvent =
  | (WorkerProviderEventBase & {
      type: "worker_run_started";
    })
  | (WorkerProviderEventBase & {
      text: string;
      type: "worker_log_delta" | "worker_output_delta";
    })
  | (WorkerProviderEventBase & {
      evidence: WorkerProviderEvidenceSummary;
      type: "worker_evidence_available";
    })
  | (WorkerProviderEventBase & {
      result: WorkerProviderFinalResult;
      type:
        | "worker_cancelled"
        | "worker_completed"
        | "worker_failed"
        | "worker_stopped";
    })
  | (WorkerProviderEventBase & {
      errorCode?: string;
      errorMessage: string;
      type: "worker_error";
    });

export type WorkerProviderStartOptions = {
  signal?: AbortSignal;
};

export type WorkerProvider = {
  capabilities: WorkerProviderCapabilities;
  cancelRun?: (runId: string) => Promise<WorkerProviderCancelResult>;
  getRun?: (runId: string) => Promise<WorkerProviderRunSnapshot | null>;
  providerDisplayName: string;
  providerId: WorkerProviderId;
  startWork: (
    request: WorkerProviderWorkRequest,
    onEvent: (event: WorkerProviderEvent) => void,
    options?: WorkerProviderStartOptions,
  ) => Promise<WorkerProviderRunHandle | null>;
};

export function createWorkerProviderCapabilities(
  overrides: Partial<WorkerProviderCapabilities> = {},
): WorkerProviderCapabilities {
  return {
    requiresExplicitWorkspace: true,
    supportsCancellation: false,
    supportsEvidenceEvents: true,
    supportsProviderThreads: false,
    supportsRunLookup: false,
    supportsStreamingOutput: false,
    ...overrides,
  };
}

export function isWorkerProviderRunHandle(
  value: WorkerProviderRunHandle | null | undefined,
): value is WorkerProviderRunHandle {
  return Boolean(value?.runId && value.providerId && value.stopListening);
}

export function workerProviderFinalStatusToEvidenceStatus(
  status: WorkerProviderFinalStatus,
): WorkerProviderEvidenceStatus {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed" || status === "error") {
    return "failed";
  }

  return "not_completed";
}

export function evidenceSummaryFromWorkerProviderFinalResult(
  result: WorkerProviderFinalResult,
): WorkerProviderEvidenceSummary {
  return {
    changedFiles: [...result.changedFiles],
    ...(result.evidenceBundleId
      ? { evidenceBundleId: result.evidenceBundleId }
      : {}),
    ...(result.finalMessage ? { finalMessage: result.finalMessage } : {}),
    ...(result.providerMetadata
      ? { providerMetadata: result.providerMetadata }
      : {}),
    ...(result.summary ? { report: result.summary, summary: result.summary } : {}),
    status: workerProviderFinalStatusToEvidenceStatus(result.status),
    ...(result.validation ? { validation: result.validation } : {}),
  };
}
