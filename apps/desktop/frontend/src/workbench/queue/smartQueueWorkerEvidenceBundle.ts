import type {
  AgentExecutorRunDetail,
  AgentQueueWorkerExecutionReport,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../../workspace/types";
import { RENDER_MEMORY_CAPS, cappedPreviewText } from "../../renderMemoryGuards";

export type QueueWorkerEvidenceOutcome =
  | "completed"
  | "not_completed"
  | "failed";

export type QueueWorkerValidationStatus =
  | "passed"
  | "failed"
  | "not_run"
  | "unknown";

export type QueueWorkerRunReference = {
  readonly completedAt?: string;
  readonly logReference?: string;
  readonly providerId?: string;
  readonly rawProviderSummary?: string;
  readonly runId?: string;
  readonly startedAt?: string;
  readonly workerId?: string;
};

export type QueueWorkerAttemptReference = {
  readonly attemptId?: string;
  readonly taskId: string;
};

export type QueueWorkerThreadReference = {
  readonly providerId?: string;
  readonly threadId?: string;
};

export type QueueWorkerFinalReport = {
  readonly finalAgentMessage?: string;
  readonly rawProviderSummary?: string;
};

export type QueueWorkerChangedFileEvidence = {
  readonly additions?: number | null;
  readonly deletions?: number | null;
  readonly path: string;
  readonly status?: string;
  readonly truncated: boolean;
};

export type QueueWorkerValidationEvidence = {
  readonly exitCode?: number | null;
  readonly outputPreview?: string;
  readonly status: QueueWorkerValidationStatus;
  readonly summary?: string;
};

export type QueueWorkerFailureEvidence = {
  readonly reason: string;
};

export type QueueWorkerStuckEvidence = {
  readonly reason: string;
};

export type QueueWorkerEvidenceSummary = {
  readonly changedFileCount: number;
  readonly changedFilesLabel: string;
  readonly changedFilesOmittedCount: number;
  readonly finalReportLabel: string;
  readonly frontendOnlyLabel: string;
  readonly humanSummary: string;
  readonly logsLabel: string;
  readonly outcomeLabel: string;
  readonly validationLabel: string;
};

export type QueueWorkerEvidenceBundle = {
  readonly attempt?: QueueWorkerAttemptReference;
  readonly attemptId?: string;
  readonly changedFiles: readonly QueueWorkerChangedFileEvidence[];
  readonly changedFilesSummary?: string;
  readonly completedAt?: string;
  readonly durable: false;
  readonly failure?: QueueWorkerFailureEvidence;
  readonly failureReason?: string;
  readonly finalAgentMessage?: string;
  readonly finalReport?: QueueWorkerFinalReport;
  readonly frontendOnly: true;
  readonly kind: "queue_worker_evidence_bundle";
  readonly logReference?: string;
  readonly outcome: QueueWorkerEvidenceOutcome;
  readonly providerId?: string;
  readonly rawProviderSummary?: string;
  readonly run?: QueueWorkerRunReference;
  readonly runId?: string;
  readonly startedAt?: string;
  readonly stuck?: QueueWorkerStuckEvidence;
  readonly stuckReason?: string;
  readonly summary: QueueWorkerEvidenceSummary;
  readonly taskId: string;
  readonly thread?: QueueWorkerThreadReference;
  readonly threadId?: string;
  readonly validation?: QueueWorkerValidationEvidence;
  readonly validationExitCode?: number | null;
  readonly validationOutputPreview?: string;
  readonly validationStatus: QueueWorkerValidationStatus;
  readonly validationSummary?: string;
  readonly version: 1;
  readonly workerId?: string;
};

export type QueueWorkerEvidenceBundleInput = {
  readonly attemptId?: string | null;
  readonly changedFiles?: readonly (
    | string
    | Partial<QueueWorkerChangedFileEvidence>
  )[] | null;
  readonly changedFilesSummary?: string | null;
  readonly completedAt?: string | null;
  readonly failureReason?: string | null;
  readonly finalAgentMessage?: string | null;
  readonly logReference?: string | null;
  readonly outcome: QueueWorkerEvidenceOutcome;
  readonly providerId?: string | null;
  readonly rawProviderSummary?: string | null;
  readonly runId?: string | null;
  readonly startedAt?: string | null;
  readonly stuckReason?: string | null;
  readonly taskId: string;
  readonly threadId?: string | null;
  readonly validationExitCode?: number | null;
  readonly validationOutputPreview?: string | null;
  readonly validationStatus?: QueueWorkerValidationStatus | null;
  readonly validationSummary?: string | null;
  readonly workerId?: string | null;
};

export type QueueWorkerEvidenceBundleValidationResult =
  | {
      readonly bundle: QueueWorkerEvidenceBundle;
      readonly missingFields: readonly string[];
      readonly ok: true;
      readonly reasons: readonly string[];
    }
  | {
      readonly bundle?: QueueWorkerEvidenceBundle;
      readonly missingFields: readonly string[];
      readonly ok: false;
      readonly reasons: readonly string[];
    };

export type QueueWorkerEvidenceValidationOptions = {
  readonly expectedAttemptId?: string;
  readonly expectedTaskId?: string;
};

export type QueueWorkerLifecycleAgentFinishedInput = {
  readonly attemptId?: string;
  readonly changedFilesSummary?: string;
  readonly finalAgentMessage: string;
  readonly finishedAt?: string;
  readonly outcome: QueueWorkerEvidenceOutcome;
  readonly taskId: string;
  readonly threadId?: string;
  readonly validationSummary?: string;
  readonly workerEvidenceBundle: QueueWorkerEvidenceBundle;
};

export type QueueWorkerReviewMessageEvidenceInput = {
  readonly attemptId?: string;
  readonly changedFilesSummary?: string;
  readonly evidenceSummary: string;
  readonly finalAgentMessage: string;
  readonly validationSummary?: string;
  readonly workerEvidenceBundle: QueueWorkerEvidenceBundle;
};

export type QueueWorkspaceAgentRunEvidenceInput = {
  readonly attemptId?: string;
  readonly changedFiles?: QueueWorkerEvidenceBundleInput["changedFiles"];
  readonly changedFilesSummary?: string;
  readonly completedAt?: string;
  readonly failureReason?: string;
  readonly finalAgentMessage?: string;
  readonly logReference?: string;
  readonly providerId?: string;
  readonly rawProviderSummary?: string;
  readonly runId?: string;
  readonly startedAt?: string;
  readonly status?: string | null;
  readonly stuckReason?: string;
  readonly taskId: string;
  readonly threadId?: string;
  readonly validationExitCode?: number | null;
  readonly validationOutputPreview?: string;
  readonly validationStatus?: QueueWorkerValidationStatus;
  readonly validationSummary?: string;
  readonly workerId?: string;
};

export type QueueDirectWorkEvidenceInput = {
  readonly attemptId?: string;
  readonly changedFiles?: QueueWorkerEvidenceBundleInput["changedFiles"];
  readonly changedFilesSummary?: string;
  readonly completedAt?: string;
  readonly logReference?: string;
  readonly providerId?: string;
  readonly rawProviderSummary?: string;
  readonly result: RunCodexDirectWorkResponse;
  readonly startedAt?: string;
  readonly taskId: string;
  readonly threadId?: string;
  readonly validation?: RunDirectWorkValidationResponse | null;
  readonly workerId?: string;
};

export type QueueAgentExecutorRunDetailEvidenceInput = {
  readonly attemptId?: string;
  readonly logReference?: string;
  readonly providerId?: string;
  readonly taskId: string;
  readonly threadId?: string;
  readonly workerId?: string;
  readonly detail: AgentExecutorRunDetail;
};

export type QueueWorkerReportEvidenceInput = {
  readonly attemptId?: string;
  readonly providerId?: string;
  readonly report: AgentQueueWorkerExecutionReport;
  readonly runId?: string;
  readonly taskId?: string;
  readonly threadId?: string;
};

const MAX_CHANGED_FILES = 20;
const MAX_CHANGED_FILE_PATH_CHARS = 240;
const MAX_TEXT_CHARS = {
  changedFilesSummary: 1_000,
  finalAgentMessage: RENDER_MEMORY_CAPS.transcriptMessageChars,
  logReference: 500,
  providerSummary: RENDER_MEMORY_CAPS.rawJsonPreviewChars,
  reason: 1_000,
  validationOutputPreview: RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
  validationSummary: 1_500,
} as const;

export function createQueueWorkerEvidenceBundle(
  input: QueueWorkerEvidenceBundleInput,
): QueueWorkerEvidenceBundle {
  const taskId = cleanRequiredText(input.taskId);
  const attemptId = cleanOptionalText(input.attemptId);
  const runId = cleanOptionalText(input.runId);
  const threadId = cleanOptionalText(input.threadId);
  const workerId = cleanOptionalText(input.workerId);
  const providerId = cleanOptionalText(input.providerId);
  const startedAt = cleanOptionalText(input.startedAt);
  const completedAt = cleanOptionalText(input.completedAt);
  const finalAgentMessage = cappedOptionalText(
    input.finalAgentMessage,
    MAX_TEXT_CHARS.finalAgentMessage,
  );
  const changedFiles = normalizeChangedFiles(input.changedFiles);
  const changedFilesSummary = cappedOptionalText(
    input.changedFilesSummary,
    MAX_TEXT_CHARS.changedFilesSummary,
  );
  const validationStatus = normalizeValidationStatus(
    input.validationStatus,
    input.validationExitCode,
    input.validationSummary,
    input.validationOutputPreview,
  );
  const validationSummary = cappedOptionalText(
    input.validationSummary,
    MAX_TEXT_CHARS.validationSummary,
  );
  const validationOutputPreview = cappedOptionalText(
    input.validationOutputPreview,
    MAX_TEXT_CHARS.validationOutputPreview,
  );
  const validationExitCode = normalizeNullableNumber(input.validationExitCode);
  const failureReason = cappedOptionalText(
    input.failureReason,
    MAX_TEXT_CHARS.reason,
  );
  const stuckReason = cappedOptionalText(
    input.stuckReason,
    MAX_TEXT_CHARS.reason,
  );
  const logReference = cappedOptionalText(
    input.logReference,
    MAX_TEXT_CHARS.logReference,
  );
  const rawProviderSummary = cappedOptionalText(
    input.rawProviderSummary,
    MAX_TEXT_CHARS.providerSummary,
  );
  const summary = summarizeQueueWorkerEvidenceBundleFields({
    changedFiles,
    changedFilesSummary,
    failureReason,
    finalAgentMessage,
    logReference,
    outcome: input.outcome,
    rawProviderSummary,
    stuckReason,
    validationStatus,
  });
  const run: QueueWorkerRunReference | undefined =
    runId ||
    workerId ||
    providerId ||
    startedAt ||
    completedAt ||
    logReference ||
    rawProviderSummary
      ? {
          ...(completedAt ? { completedAt } : {}),
          ...(logReference ? { logReference } : {}),
          ...(providerId ? { providerId } : {}),
          ...(rawProviderSummary ? { rawProviderSummary } : {}),
          ...(runId ? { runId } : {}),
          ...(startedAt ? { startedAt } : {}),
          ...(workerId ? { workerId } : {}),
        }
      : undefined;
  const attempt: QueueWorkerAttemptReference | undefined =
    taskId || attemptId
      ? {
          ...(attemptId ? { attemptId } : {}),
          taskId,
        }
      : undefined;
  const thread: QueueWorkerThreadReference | undefined =
    threadId || providerId
      ? {
          ...(providerId ? { providerId } : {}),
          ...(threadId ? { threadId } : {}),
        }
      : undefined;
  const finalReport: QueueWorkerFinalReport | undefined =
    finalAgentMessage || rawProviderSummary
      ? {
          ...(finalAgentMessage ? { finalAgentMessage } : {}),
          ...(rawProviderSummary ? { rawProviderSummary } : {}),
        }
      : undefined;
  const validation: QueueWorkerValidationEvidence | undefined =
    validationStatus !== "not_run" ||
    validationSummary ||
    validationOutputPreview ||
    validationExitCode !== undefined
      ? {
          ...(validationExitCode !== undefined ? { exitCode: validationExitCode } : {}),
          ...(validationOutputPreview ? { outputPreview: validationOutputPreview } : {}),
          status: validationStatus,
          ...(validationSummary ? { summary: validationSummary } : {}),
        }
      : undefined;
  const failure = failureReason ? { reason: failureReason } : undefined;
  const stuck = stuckReason ? { reason: stuckReason } : undefined;

  return {
    ...(attempt ? { attempt } : {}),
    ...(attemptId ? { attemptId } : {}),
    changedFiles,
    ...(changedFilesSummary ? { changedFilesSummary } : {}),
    ...(completedAt ? { completedAt } : {}),
    durable: false,
    ...(failure ? { failure, failureReason } : {}),
    ...(finalAgentMessage ? { finalAgentMessage } : {}),
    ...(finalReport ? { finalReport } : {}),
    frontendOnly: true,
    kind: "queue_worker_evidence_bundle",
    ...(logReference ? { logReference } : {}),
    outcome: input.outcome,
    ...(providerId ? { providerId } : {}),
    ...(rawProviderSummary ? { rawProviderSummary } : {}),
    ...(run ? { run } : {}),
    ...(runId ? { runId } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(stuck ? { stuck, stuckReason } : {}),
    summary,
    taskId,
    ...(thread ? { thread } : {}),
    ...(threadId ? { threadId } : {}),
    ...(validation ? { validation } : {}),
    ...(validationExitCode !== undefined ? { validationExitCode } : {}),
    ...(validationOutputPreview ? { validationOutputPreview } : {}),
    validationStatus,
    ...(validationSummary ? { validationSummary } : {}),
    version: 1,
    ...(workerId ? { workerId } : {}),
  };
}

export function normalizeQueueWorkerEvidenceBundle(
  value: unknown,
  options: QueueWorkerEvidenceValidationOptions = {},
): QueueWorkerEvidenceBundleValidationResult {
  if (!isRecord(value)) {
    return {
      missingFields: ["evidenceBundle"],
      ok: false,
      reasons: ["Evidence bundle must be a structured object."],
    };
  }

  const missingFields = getEvidenceBundleMissingFields(value);
  const outcome = typeof value.outcome === "string" ? value.outcome : "";
  const reasons: string[] = [];

  if (!isQueueWorkerEvidenceOutcome(outcome)) {
    reasons.push("Evidence bundle outcome must be completed, not_completed, or failed.");
  }

  if (missingFields.includes("taskId")) {
    reasons.push("Evidence bundle taskId is required.");
  }

  const taskId = cleanOptionalText(value.taskId);
  if (options.expectedTaskId && taskId && options.expectedTaskId !== taskId) {
    reasons.push("Evidence bundle taskId does not match the action input taskId.");
  }

  const attemptId = cleanOptionalText(value.attemptId);
  if (
    options.expectedAttemptId &&
    attemptId &&
    options.expectedAttemptId !== attemptId
  ) {
    reasons.push("Evidence bundle attemptId does not match the action input attemptId.");
  }

  if (reasons.length > 0) {
    return {
      missingFields,
      ok: false,
      reasons,
    };
  }

  const optionalAttemptId = cleanOptionalText(value.attemptId);
  const optionalChangedFilesSummary = cleanOptionalText(value.changedFilesSummary);
  const optionalCompletedAt = cleanOptionalText(value.completedAt);
  const optionalFailureReason = cleanOptionalText(value.failureReason);
  const optionalFinalAgentMessage = cleanOptionalText(value.finalAgentMessage);
  const optionalLogReference = cleanOptionalText(value.logReference);
  const optionalProviderId = cleanOptionalText(value.providerId);
  const optionalRawProviderSummary = cleanOptionalText(value.rawProviderSummary);
  const optionalRunId = cleanOptionalText(value.runId);
  const optionalStartedAt = cleanOptionalText(value.startedAt);
  const optionalStuckReason = cleanOptionalText(value.stuckReason);
  const optionalThreadId = cleanOptionalText(value.threadId);
  const optionalValidationExitCode = normalizeUnknownNullableNumber(
    value.validationExitCode,
  );
  const optionalValidationOutputPreview = cleanOptionalText(
    value.validationOutputPreview,
  );
  const optionalValidationStatus = normalizeUnknownValidationStatus(
    value.validationStatus,
  );
  const optionalValidationSummary = cleanOptionalText(value.validationSummary);
  const optionalWorkerId = cleanOptionalText(value.workerId);

  const bundle = createQueueWorkerEvidenceBundle({
    ...(optionalAttemptId ? { attemptId: optionalAttemptId } : {}),
    changedFiles: normalizeUnknownChangedFileInput(value.changedFiles),
    ...(optionalChangedFilesSummary
      ? { changedFilesSummary: optionalChangedFilesSummary }
      : {}),
    ...(optionalCompletedAt ? { completedAt: optionalCompletedAt } : {}),
    ...(optionalFailureReason ? { failureReason: optionalFailureReason } : {}),
    ...(optionalFinalAgentMessage
      ? { finalAgentMessage: optionalFinalAgentMessage }
      : {}),
    ...(optionalLogReference ? { logReference: optionalLogReference } : {}),
    outcome: outcome as QueueWorkerEvidenceOutcome,
    ...(optionalProviderId ? { providerId: optionalProviderId } : {}),
    ...(optionalRawProviderSummary
      ? { rawProviderSummary: optionalRawProviderSummary }
      : {}),
    ...(optionalRunId ? { runId: optionalRunId } : {}),
    ...(optionalStartedAt ? { startedAt: optionalStartedAt } : {}),
    ...(optionalStuckReason ? { stuckReason: optionalStuckReason } : {}),
    taskId: taskId ?? "",
    ...(optionalThreadId ? { threadId: optionalThreadId } : {}),
    ...(optionalValidationExitCode !== undefined
      ? { validationExitCode: optionalValidationExitCode }
      : {}),
    ...(optionalValidationOutputPreview
      ? { validationOutputPreview: optionalValidationOutputPreview }
      : {}),
    ...(optionalValidationStatus ? { validationStatus: optionalValidationStatus } : {}),
    ...(optionalValidationSummary
      ? { validationSummary: optionalValidationSummary }
      : {}),
    ...(optionalWorkerId ? { workerId: optionalWorkerId } : {}),
  });

  return validateQueueWorkerEvidenceBundle(bundle, options);
}

export function validateQueueWorkerEvidenceBundle(
  bundle: QueueWorkerEvidenceBundle,
  options: QueueWorkerEvidenceValidationOptions = {},
): QueueWorkerEvidenceBundleValidationResult {
  const reasons: string[] = [];
  const missingFields = getEvidenceBundleMissingFields(bundle);

  if (missingFields.includes("taskId")) {
    reasons.push("Evidence bundle taskId is required.");
  }

  if (!isQueueWorkerEvidenceOutcome(bundle.outcome)) {
    reasons.push("Evidence bundle outcome must be completed, not_completed, or failed.");
  }

  if (
    bundle.outcome === "completed" &&
    !bundle.finalAgentMessage &&
    !bundle.rawProviderSummary
  ) {
    reasons.push("Completed evidence requires a final report.");
  }

  if (
    bundle.outcome === "failed" &&
    !bundle.failureReason &&
    !bundle.finalAgentMessage
  ) {
    reasons.push("Failed evidence requires a failure reason or final report.");
  }

  if (
    bundle.outcome === "not_completed" &&
    !bundle.stuckReason &&
    !bundle.finalAgentMessage
  ) {
    reasons.push("Not-completed evidence requires a final report or stuck reason.");
  }

  if (options.expectedTaskId && bundle.taskId !== options.expectedTaskId) {
    reasons.push("Evidence bundle taskId does not match the action input taskId.");
  }

  if (
    options.expectedAttemptId &&
    bundle.attemptId &&
    bundle.attemptId !== options.expectedAttemptId
  ) {
    reasons.push("Evidence bundle attemptId does not match the action input attemptId.");
  }

  return reasons.length > 0
    ? {
        bundle,
        missingFields,
        ok: false,
        reasons,
      }
    : {
        bundle,
        missingFields,
        ok: true,
        reasons: [],
      };
}

export function summarizeQueueWorkerEvidenceBundle(
  bundle: QueueWorkerEvidenceBundle,
): QueueWorkerEvidenceSummary {
  return summarizeQueueWorkerEvidenceBundleFields(bundle);
}

export function getQueueWorkerEvidenceOutcome(
  bundle: QueueWorkerEvidenceBundle,
): QueueWorkerEvidenceOutcome {
  return bundle.outcome;
}

export function mapEvidenceOutcomeToReviewOutcome(
  outcome: QueueWorkerEvidenceOutcome,
): QueueWorkerEvidenceOutcome {
  return outcome;
}

export function toLifecycleAgentFinishedInput(
  bundle: QueueWorkerEvidenceBundle,
  overrides: {
    readonly attemptId?: string;
    readonly changedFilesSummary?: string;
    readonly finalAgentMessage?: string;
    readonly finishedAt?: string;
    readonly outcome?: QueueWorkerEvidenceOutcome;
    readonly taskId?: string;
    readonly threadId?: string;
    readonly validationSummary?: string;
  } = {},
): QueueWorkerLifecycleAgentFinishedInput {
  return {
    attemptId: overrides.attemptId ?? bundle.attemptId,
    changedFilesSummary:
      overrides.changedFilesSummary ?? changedFilesSummaryForEvidence(bundle),
    finalAgentMessage:
      cleanOptionalText(overrides.finalAgentMessage) ??
      finalMessageForLifecycle(bundle),
    finishedAt: overrides.finishedAt ?? bundle.completedAt,
    outcome: overrides.outcome ?? mapEvidenceOutcomeToReviewOutcome(bundle.outcome),
    taskId: overrides.taskId ?? bundle.taskId,
    threadId: overrides.threadId ?? bundle.threadId,
    validationSummary:
      cleanOptionalText(overrides.validationSummary) ??
      validationSummaryForEvidence(bundle),
    workerEvidenceBundle: bundle,
  };
}

export function toReviewMessageEvidenceInput(
  bundle: QueueWorkerEvidenceBundle,
  overrides: {
    readonly attemptId?: string;
    readonly changedFilesSummary?: string;
    readonly finalAgentMessage?: string;
    readonly validationSummary?: string;
  } = {},
): QueueWorkerReviewMessageEvidenceInput {
  return {
    attemptId: overrides.attemptId ?? bundle.attemptId,
    changedFilesSummary:
      overrides.changedFilesSummary ?? changedFilesSummaryForEvidence(bundle),
    evidenceSummary: getEvidenceBundleHumanSummary(bundle),
    finalAgentMessage:
      cleanOptionalText(overrides.finalAgentMessage) ??
      finalMessageForLifecycle(bundle),
    validationSummary:
      cleanOptionalText(overrides.validationSummary) ??
      validationSummaryForEvidence(bundle),
    workerEvidenceBundle: bundle,
  };
}

export function getEvidenceBundleHumanSummary(
  bundle: QueueWorkerEvidenceBundle,
): string {
  return summarizeQueueWorkerEvidenceBundle(bundle).humanSummary;
}

export function getEvidenceBundleMissingFields(
  value: Partial<QueueWorkerEvidenceBundleInput | QueueWorkerEvidenceBundle>,
): readonly string[] {
  const missing: string[] = [];
  const outcome = typeof value.outcome === "string" ? value.outcome : undefined;

  if (!cleanOptionalText(value.taskId)) {
    missing.push("taskId");
  }

  if (!outcome || !isQueueWorkerEvidenceOutcome(outcome)) {
    missing.push("outcome");
    return missing;
  }

  if (
    outcome === "completed" &&
    !cleanOptionalText(value.finalAgentMessage) &&
    !cleanOptionalText(value.rawProviderSummary)
  ) {
    missing.push("finalAgentMessage");
  }

  if (
    outcome === "failed" &&
    !cleanOptionalText(value.failureReason) &&
    !cleanOptionalText(value.finalAgentMessage)
  ) {
    missing.push("failureReason");
  }

  if (
    outcome === "not_completed" &&
    !cleanOptionalText(value.stuckReason) &&
    !cleanOptionalText(value.finalAgentMessage)
  ) {
    missing.push("stuckReason");
  }

  return missing;
}

export function createEvidenceBundleFromWorkspaceAgentRun(
  input: QueueWorkspaceAgentRunEvidenceInput,
): QueueWorkerEvidenceBundle {
  const outcome = outcomeFromStatus(input.status, {
    failureReason: input.failureReason,
    finalAgentMessage: input.finalAgentMessage,
    stuckReason: input.stuckReason,
  });

  return createQueueWorkerEvidenceBundle({
    attemptId: input.attemptId,
    changedFiles: input.changedFiles,
    changedFilesSummary: input.changedFilesSummary,
    completedAt: input.completedAt,
    failureReason: input.failureReason,
    finalAgentMessage: input.finalAgentMessage,
    logReference: input.logReference,
    outcome,
    providerId: input.providerId,
    rawProviderSummary: input.rawProviderSummary,
    runId: input.runId,
    startedAt: input.startedAt,
    stuckReason: input.stuckReason,
    taskId: input.taskId,
    threadId: input.threadId,
    validationExitCode: input.validationExitCode,
    validationOutputPreview: input.validationOutputPreview,
    validationStatus: input.validationStatus,
    validationSummary: input.validationSummary,
    workerId: input.workerId,
  });
}

export function createEvidenceBundleFromDirectWorkResult(
  input: QueueDirectWorkEvidenceInput,
): QueueWorkerEvidenceBundle {
  const validation = input.validation;
  const validationOutputPreview = validation
    ? validationOutputPreviewFromParts(validation.stdout, validation.stderr)
    : undefined;

  return createQueueWorkerEvidenceBundle({
    attemptId: input.attemptId,
    changedFiles: input.changedFiles,
    changedFilesSummary: input.changedFilesSummary,
    completedAt: input.completedAt,
    failureReason: input.result.errorMessage,
    finalAgentMessage: input.result.finalMessage ?? undefined,
    logReference: input.logReference,
    outcome: outcomeFromDirectWorkStatus(input.result.status, input.result.exitCode),
    providerId: input.providerId,
    rawProviderSummary:
      input.rawProviderSummary ?? input.result.commandSummary.join(" "),
    runId: input.result.runId,
    startedAt: input.startedAt,
    stuckReason: stuckReasonFromStatus(input.result.status, input.result.errorMessage),
    taskId: input.taskId,
    threadId: input.threadId,
    validationExitCode: validation?.exitCode,
    validationOutputPreview,
    validationStatus: validation
      ? validationStatusFromExitCode(validation.exitCode, validation.status)
      : "not_run",
    validationSummary: validation
      ? validationSummaryFromDirectWorkValidation(validation)
      : undefined,
    workerId: input.workerId,
  });
}

export function createEvidenceBundleFromAgentExecutorRunDetail(
  input: QueueAgentExecutorRunDetailEvidenceInput,
): QueueWorkerEvidenceBundle {
  const detail = input.detail;
  const summary = detail.summary;
  const finalAgentMessage =
    detail.finalMessage ?? detail.resultContent ?? detail.resultSummary ?? undefined;
  const validationOutputPreview = validationOutputPreviewFromParts(
    detail.stdoutPreview,
    detail.stderrPreview,
  );

  return createQueueWorkerEvidenceBundle({
    attemptId: input.attemptId,
    changedFilesSummary: detail.changedFilesSummary ?? undefined,
    completedAt: summary.finishedAt ?? undefined,
    failureReason: detail.errorMessage ?? undefined,
    finalAgentMessage,
    logReference: input.logReference,
    outcome: outcomeFromDirectWorkStatus(summary.status, null),
    providerId: input.providerId,
    rawProviderSummary: detail.resultSummary ?? undefined,
    runId: summary.runId,
    startedAt: summary.startedAt,
    stuckReason: stuckReasonFromStatus(summary.status, detail.errorMessage),
    taskId: input.taskId,
    threadId: input.threadId,
    validationOutputPreview,
    validationStatus: validationStatusFromStoredRun(detail.validationStatus),
    validationSummary: validationSummaryFromExecutorDetail(detail),
    workerId: input.workerId,
  });
}

export function createEvidenceBundleFromQueueWorkerReport(
  input: QueueWorkerReportEvidenceInput,
): QueueWorkerEvidenceBundle {
  const report = input.report;
  const taskId = input.taskId ?? report.itemId;
  const failedReason = report.errors[0] ?? report.summary;
  const stuckReason =
    report.reportStatus === "needs_follow_up"
      ? report.followUpRecommendation ?? report.summary
      : undefined;

  return createQueueWorkerEvidenceBundle({
    attemptId: input.attemptId,
    changedFiles: report.changedFiles,
    completedAt: report.createdAt,
    failureReason:
      report.reportStatus === "failed" || report.reportStatus === "interrupted"
        ? failedReason
        : undefined,
    finalAgentMessage: report.summary,
    logReference: undefined,
    outcome: outcomeFromWorkerReportStatus(report.reportStatus),
    providerId: input.providerId,
    rawProviderSummary: report.rawReportPreview,
    runId: input.runId ?? report.reportId,
    stuckReason,
    taskId,
    threadId: input.threadId,
    validationStatus: validationStatusFromWorkerReport(report.validationResult),
    validationSummary: validationSummaryFromWorkerReport(report),
    workerId: report.workerId,
  });
}

function summarizeQueueWorkerEvidenceBundleFields({
  changedFiles,
  changedFilesSummary,
  failureReason,
  finalAgentMessage,
  logReference,
  outcome,
  rawProviderSummary,
  stuckReason,
  validationStatus,
}: {
  readonly changedFiles: readonly QueueWorkerChangedFileEvidence[];
  readonly changedFilesSummary?: string;
  readonly failureReason?: string;
  readonly finalAgentMessage?: string;
  readonly logReference?: string;
  readonly outcome: QueueWorkerEvidenceOutcome;
  readonly rawProviderSummary?: string;
  readonly stuckReason?: string;
  readonly validationStatus: QueueWorkerValidationStatus;
}): QueueWorkerEvidenceSummary {
  const changedFilesOmittedCount = Math.max(0, changedFiles.length - MAX_CHANGED_FILES);
  const changedFileCount = changedFiles.length;
  const changedFilesLabel =
    changedFileCount > 0
      ? `${changedFileCount.toString()} changed file${changedFileCount === 1 ? "" : "s"}`
      : changedFilesSummary
        ? "Changed files summary available"
        : "No changed files reported";
  const finalReportLabel =
    finalAgentMessage || rawProviderSummary
      ? "Final report available"
      : "Final report missing";
  const logsLabel = logReference ? "Logs available" : "Logs not attached";
  const outcomeLabel = outcomeLabelFor(outcome);
  const validationLabel = validationLabelFor(validationStatus);
  const frontendOnlyLabel = "Evidence bundle is frontend-only and not durable yet";
  const detailReason = failureReason ?? stuckReason;
  const parts = [
    outcomeLabel,
    changedFilesLabel,
    validationLabel,
    finalReportLabel,
    logsLabel,
    frontendOnlyLabel,
    detailReason ? `Reason: ${detailReason}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    changedFileCount,
    changedFilesLabel,
    changedFilesOmittedCount,
    finalReportLabel,
    frontendOnlyLabel,
    humanSummary: parts.join(". "),
    logsLabel,
    outcomeLabel,
    validationLabel,
  };
}

function normalizeChangedFiles(
  value: QueueWorkerEvidenceBundleInput["changedFiles"],
): readonly QueueWorkerChangedFileEvidence[] {
  const files = Array.isArray(value) ? value : [];
  const normalized: QueueWorkerChangedFileEvidence[] = [];
  const seen = new Set<string>();

  for (const entry of files) {
    const evidence = normalizeChangedFile(entry);
    if (!evidence) {
      continue;
    }

    const key = evidence.path.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(evidence);

    if (normalized.length >= MAX_CHANGED_FILES) {
      break;
    }
  }

  return normalized;
}

function normalizeChangedFile(
  value: string | Partial<QueueWorkerChangedFileEvidence>,
): QueueWorkerChangedFileEvidence | null {
  const rawPath = typeof value === "string" ? value : value.path;
  const cleanedPath = cleanPath(rawPath);
  if (!cleanedPath) {
    return null;
  }

  const truncated = cleanedPath.length > MAX_CHANGED_FILE_PATH_CHARS;
  const path = truncated
    ? cleanedPath.slice(0, MAX_CHANGED_FILE_PATH_CHARS).trimEnd()
    : cleanedPath;
  const status = typeof value === "string" ? undefined : cleanOptionalText(value.status);
  const additions = typeof value === "string" ? undefined : normalizeNullableNumber(value.additions);
  const deletions = typeof value === "string" ? undefined : normalizeNullableNumber(value.deletions);

  return {
    ...(additions !== undefined ? { additions } : {}),
    ...(deletions !== undefined ? { deletions } : {}),
    path,
    ...(status ? { status } : {}),
    truncated,
  };
}

function cleanPath(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .split("\r")
    .join(" ")
    .split("\n")
    .join(" ")
    .split("\t")
    .join(" ")
    .trim();
}

function changedFilesSummaryForEvidence(bundle: QueueWorkerEvidenceBundle) {
  if (bundle.changedFilesSummary) {
    return bundle.changedFilesSummary;
  }

  if (bundle.changedFiles.length === 0) {
    return undefined;
  }

  const paths = bundle.changedFiles.map((file) => file.path).join(", ");
  return `${bundle.changedFiles.length.toString()} changed file${bundle.changedFiles.length === 1 ? "" : "s"}: ${paths}`;
}

function validationSummaryForEvidence(bundle: QueueWorkerEvidenceBundle) {
  if (bundle.validationSummary) {
    return bundle.validationSummary;
  }

  if (bundle.validationStatus === "not_run") {
    return undefined;
  }

  return bundle.summary.validationLabel;
}

function finalMessageForLifecycle(bundle: QueueWorkerEvidenceBundle) {
  return (
    bundle.finalAgentMessage ??
    bundle.failureReason ??
    bundle.stuckReason ??
    bundle.rawProviderSummary ??
    bundle.summary.outcomeLabel
  );
}

function normalizeValidationStatus(
  status: QueueWorkerValidationStatus | null | undefined,
  exitCode: number | null | undefined,
  validationSummary: string | null | undefined,
  validationOutputPreview: string | null | undefined,
): QueueWorkerValidationStatus {
  if (status) {
    return status;
  }

  if (typeof exitCode === "number") {
    return exitCode === 0 ? "passed" : "failed";
  }

  if (cleanOptionalText(validationSummary) || cleanOptionalText(validationOutputPreview)) {
    return "unknown";
  }

  return "not_run";
}

function normalizeUnknownValidationStatus(
  value: unknown,
): QueueWorkerValidationStatus | undefined {
  return value === "passed" ||
    value === "failed" ||
    value === "not_run" ||
    value === "unknown"
    ? value
    : undefined;
}

function validationStatusFromExitCode(
  exitCode: number | null,
  status: string | null | undefined,
): QueueWorkerValidationStatus {
  if (typeof exitCode === "number") {
    return exitCode === 0 ? "passed" : "failed";
  }

  return status === "completed" || status === "passed" ? "passed" : "unknown";
}

function validationStatusFromStoredRun(
  status: string | null,
): QueueWorkerValidationStatus {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "not_started":
    case null:
      return "not_run";
    default:
      return "unknown";
  }
}

function validationStatusFromWorkerReport(
  status: AgentQueueWorkerExecutionReport["validationResult"],
): QueueWorkerValidationStatus {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "not_run":
    case undefined:
      return "not_run";
    case "partial":
      return "unknown";
  }
}

function validationSummaryFromDirectWorkValidation(
  validation: RunDirectWorkValidationResponse,
) {
  const status = validationStatusFromExitCode(validation.exitCode, validation.status);
  return `${validationLabelFor(status)}. Profile: ${validation.profile}.`;
}

function validationSummaryFromExecutorDetail(detail: AgentExecutorRunDetail) {
  if (!detail.validationStatus && !detail.validationProfile) {
    return undefined;
  }

  return [
    detail.validationStatus ? `Validation ${detail.validationStatus}` : null,
    detail.validationProfile ? `profile ${detail.validationProfile}` : null,
  ].filter((item): item is string => Boolean(item)).join(", ");
}

function validationSummaryFromWorkerReport(
  report: AgentQueueWorkerExecutionReport,
) {
  if (!report.validationResult || report.validationResult === "not_run") {
    return undefined;
  }

  return `Validation ${report.validationResult}.`;
}

function validationOutputPreviewFromParts(
  stdout: string | null | undefined,
  stderr: string | null | undefined,
) {
  const parts = [
    cleanOptionalText(stdout) ? `stdout preview:\n${cleanOptionalText(stdout)}` : null,
    cleanOptionalText(stderr) ? `stderr preview:\n${cleanOptionalText(stderr)}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function outcomeFromDirectWorkStatus(
  status: string,
  exitCode: number | null,
): QueueWorkerEvidenceOutcome {
  if (status === "completed" || status === "succeeded") {
    return "completed";
  }

  if (status === "cancelled" || status === "canceled" || status === "timed_out") {
    return "not_completed";
  }

  if (typeof exitCode === "number" && exitCode === 0) {
    return "completed";
  }

  return "failed";
}

function outcomeFromStatus(
  status: string | null | undefined,
  evidence: {
    readonly failureReason?: string;
    readonly finalAgentMessage?: string;
    readonly stuckReason?: string;
  },
): QueueWorkerEvidenceOutcome {
  if (status === "completed" || status === "succeeded") {
    return "completed";
  }

  if (status === "cancelled" || status === "canceled" || status === "timed_out") {
    return "not_completed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (evidence.failureReason) {
    return "failed";
  }

  if (evidence.stuckReason) {
    return "not_completed";
  }

  return evidence.finalAgentMessage ? "completed" : "not_completed";
}

function outcomeFromWorkerReportStatus(
  status: AgentQueueWorkerExecutionReport["reportStatus"],
): QueueWorkerEvidenceOutcome {
  switch (status) {
    case "completed":
    case "reported":
      return "completed";
    case "needs_follow_up":
    case "interrupted":
      return "not_completed";
    case "failed":
      return "failed";
  }
}

function stuckReasonFromStatus(status: string, errorMessage: string | null) {
  if (status === "cancelled" || status === "canceled") {
    return errorMessage ?? "Run was cancelled.";
  }

  if (status === "timed_out") {
    return errorMessage ?? "Run timed out.";
  }

  return undefined;
}

function outcomeLabelFor(outcome: QueueWorkerEvidenceOutcome) {
  switch (outcome) {
    case "completed":
      return "Agent completed";
    case "not_completed":
      return "Agent did not complete";
    case "failed":
      return "Agent failed";
  }
}

function validationLabelFor(status: QueueWorkerValidationStatus) {
  switch (status) {
    case "passed":
      return "Validation passed";
    case "failed":
      return "Validation failed";
    case "not_run":
      return "Validation not run";
    case "unknown":
      return "Validation available";
  }
}

function isQueueWorkerEvidenceOutcome(
  value: string,
): value is QueueWorkerEvidenceOutcome {
  return (
    value === "completed" ||
    value === "not_completed" ||
    value === "failed"
  );
}

function normalizeUnknownChangedFileInput(
  value: unknown,
): QueueWorkerEvidenceBundleInput["changedFiles"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const changedFiles: (string | Partial<QueueWorkerChangedFileEvidence>)[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      changedFiles.push(item);
      continue;
    }

    if (!isRecord(item)) {
      continue;
    }

    const additions = normalizeUnknownNullableNumber(item.additions);
    const deletions = normalizeUnknownNullableNumber(item.deletions);
    const path = cleanOptionalText(item.path) ?? "";
    const status = cleanOptionalText(item.status);

    changedFiles.push({
      ...(additions !== undefined ? { additions } : {}),
      ...(deletions !== undefined ? { deletions } : {}),
      path,
      ...(status ? { status } : {}),
    });
  }

  return changedFiles;
}

function normalizeNullableNumber(value: number | null | undefined) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeUnknownNullableNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function cappedOptionalText(value: string | null | undefined, maxChars: number) {
  const cleaned = cleanOptionalText(value);

  return cleaned ? cappedPreviewText(cleaned, maxChars) : undefined;
}

function cleanRequiredText(value: string) {
  return cleanOptionalText(value) ?? "";
}

function cleanOptionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
