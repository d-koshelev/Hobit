import type {
  WorkerProviderChangedFile,
  WorkerProviderFinalResult,
  WorkerProviderValidationSummary,
} from "../agentRuntime";
import { workerProviderFinalStatusToEvidenceStatus } from "../agentRuntime";
import type {
  QueueWorkerEvidenceIngestionInput,
} from "./smartQueueWorkerEvidenceIngestion";

export type WorkerProviderQueueEvidenceMetadata = {
  evidenceBundleId?: string;
  providerId: string;
  providerMetadata?: Record<string, unknown>;
  providerRunId?: string;
  providerThreadId?: string | null;
  workerStatus: WorkerProviderFinalResult["status"];
};

export type WorkerProviderQueueEvidenceMapping = {
  evidenceBundleId?: string;
  ingestionInput: QueueWorkerEvidenceIngestionInput;
  providerMetadata: WorkerProviderQueueEvidenceMetadata;
};

export function mapWorkerProviderFinalResultToQueueEvidenceIngestion(
  result: WorkerProviderFinalResult,
  options: {
    dryRun?: boolean;
    requestId?: string;
  } = {},
): WorkerProviderQueueEvidenceMapping {
  const outcome = workerProviderFinalStatusToEvidenceStatus(result.status);
  const finalReport = finalReportFromWorkerResult(result);
  const failureReason =
    outcome === "failed"
      ? result.failureReason ?? result.errorMessage ?? finalReport
      : undefined;
  const stuckReason =
    outcome === "not_completed"
      ? result.stuckReason ?? result.errorMessage ?? finalReport
      : undefined;

  return {
    ...(result.evidenceBundleId
      ? { evidenceBundleId: result.evidenceBundleId }
      : {}),
    ingestionInput: {
      changedFiles: result.changedFiles.map(queueChangedFileFromWorkerFile),
      completedAt: isoFromMs(result.completedAtMs),
      dryRun: options.dryRun,
      failureReason,
      finalAgentMessage: finalReport,
      outcome,
      providerId: result.providerId,
      rawProviderSummary: rawProviderSummaryFromWorkerResult(result),
      requestId: options.requestId,
      runId: result.runId,
      startedAt: isoFromMs(result.startedAtMs),
      stuckReason,
      taskId: result.taskId ?? null,
      threadId: result.providerThreadId ?? undefined,
      validationExitCode: result.validation?.exitCode,
      validationOutputPreview: result.validation?.outputPreview,
      validationStatus: validationStatusFromWorkerValidation(result.validation),
      validationSummary: result.validation?.summary,
      workerId: result.workerId,
    },
    providerMetadata: {
      ...(result.evidenceBundleId
        ? { evidenceBundleId: result.evidenceBundleId }
        : {}),
      providerId: result.providerId,
      ...(result.providerMetadata
        ? { providerMetadata: result.providerMetadata }
        : {}),
      ...(result.providerRunId ? { providerRunId: result.providerRunId } : {}),
      providerThreadId: result.providerThreadId,
      workerStatus: result.status,
    },
  };
}

function finalReportFromWorkerResult(result: WorkerProviderFinalResult) {
  return (
    cleanText(result.finalMessage) ??
    cleanText(result.summary) ??
    cleanText(result.failureReason) ??
    cleanText(result.stuckReason) ??
    cleanText(result.errorMessage)
  );
}

function rawProviderSummaryFromWorkerResult(result: WorkerProviderFinalResult) {
  const providerMetadata = result.providerMetadata
    ? JSON.stringify(result.providerMetadata)
    : undefined;
  return [cleanText(result.summary), providerMetadata]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function queueChangedFileFromWorkerFile(file: WorkerProviderChangedFile) {
  return {
    ...(file.additions !== undefined ? { additions: file.additions } : {}),
    ...(file.deletions !== undefined ? { deletions: file.deletions } : {}),
    path: file.path,
    ...(file.status ? { status: file.status } : {}),
    ...(file.truncated !== undefined ? { truncated: file.truncated } : {}),
  };
}

function validationStatusFromWorkerValidation(
  validation: WorkerProviderValidationSummary | undefined,
) {
  return validation?.status ?? "not_run";
}

function isoFromMs(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : undefined;
}

function cleanText(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
