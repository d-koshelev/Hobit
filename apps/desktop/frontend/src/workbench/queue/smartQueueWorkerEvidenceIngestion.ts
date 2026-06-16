import type {
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../../workspace/types";
import {
  createActionRequest,
  type HobitAgentActionRequest,
  type HobitAgentBrokerResult,
  type HobitAgentBrokerStatus,
} from "../agents/broker";
import type { HobitAgentRoleId } from "../agents/context/types";
import type {
  QueueAgentLifecycleAgentFinishedInput,
  QueueAgentLifecycleTransitionOutput,
} from "../agents/adapters";
import {
  createEvidenceBundleFromAgentExecutorRunDetail,
  createEvidenceBundleFromDirectWorkResult,
  createEvidenceBundleFromQueueWorkerReport,
  createEvidenceBundleFromWorkspaceAgentRun,
  createQueueWorkerEvidenceBundle,
  getEvidenceBundleHumanSummary,
  normalizeQueueWorkerEvidenceBundle,
  toLifecycleAgentFinishedInput,
  validateQueueWorkerEvidenceBundle,
  type QueueAgentExecutorRunDetailEvidenceInput,
  type QueueDirectWorkEvidenceInput,
  type QueueWorkerEvidenceBundle,
  type QueueWorkerEvidenceBundleInput,
  type QueueWorkerEvidenceBundleValidationResult,
  type QueueWorkerEvidenceOutcome,
  type QueueWorkerReportEvidenceInput,
  type QueueWorkspaceAgentRunEvidenceInput,
} from "./smartQueueWorkerEvidenceBundle";

const QUEUE_WORKER_EVIDENCE_INGESTION_CAPABILITY_ID =
  "queue.lifecycle.agentFinished";
const QUEUE_WORKER_EVIDENCE_INGESTION_REASON =
  "queue-worker-evidence-ingestion";

export type QueueWorkerEvidenceIngestionStatus =
  | "success"
  | "invalid_input"
  | "unavailable"
  | "policy_blocked"
  | "dry_run_required"
  | "confirmation_required"
  | "failed"
  | "not_linked";

export type QueueWorkerEvidenceIngestionBrokerInvoker = (
  request: HobitAgentActionRequest,
) => HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput> | Promise<
  HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput>
>;

export type QueueWorkerEvidenceIngestionDependencies = {
  readonly agentId?: string;
  readonly agentRoleId?: HobitAgentRoleId;
  readonly createdAt?: string;
  readonly invokeBrokerAction?: QueueWorkerEvidenceIngestionBrokerInvoker;
  readonly requestId?: string;
};

export type QueueWorkerEvidenceIngestionInput = Omit<
  Partial<QueueWorkerEvidenceBundleInput>,
  "completedAt" | "outcome" | "taskId"
> & {
  readonly completedAt?: string | null;
  readonly dryRun?: boolean;
  readonly evidenceBundle?: QueueWorkerEvidenceBundle | QueueWorkerEvidenceBundleInput | null;
  readonly finishedAt?: string | null;
  readonly outcome?: QueueWorkerEvidenceOutcome | null;
  readonly rawRunResult?: unknown;
  readonly requestId?: string;
  readonly taskId?: string | null;
};

export type QueueWorkerEvidenceIngestionResult = {
  readonly activityTitle: string;
  readonly brokerResult?: HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput>;
  readonly brokerStatus?: HobitAgentBrokerStatus;
  readonly dryRun: boolean;
  readonly evidenceBundle?: QueueWorkerEvidenceBundle;
  readonly evidenceSummary?: string;
  readonly lifecycleOutput?: QueueAgentLifecycleTransitionOutput;
  readonly message: string;
  readonly productStatusLabel: string;
  readonly reasons: readonly string[];
  readonly status: QueueWorkerEvidenceIngestionStatus;
  readonly taskId?: string;
};

export type QueueWorkerEvidenceIngestionCallback = (
  input: QueueWorkerEvidenceIngestionInput,
) => Promise<QueueWorkerEvidenceIngestionResult>;

export type QueueLinkedDirectWorkIngestionInput = Omit<
  QueueDirectWorkEvidenceInput,
  "taskId"
> & {
  readonly dryRun?: boolean;
  readonly requestId?: string;
  readonly taskId?: string | null;
};

export type QueueLinkedWorkspaceAgentIngestionInput = Omit<
  QueueWorkspaceAgentRunEvidenceInput,
  "taskId"
> & {
  readonly dryRun?: boolean;
  readonly requestId?: string;
  readonly taskId?: string | null;
};

export type QueueLinkedAgentExecutorIngestionInput = Omit<
  QueueAgentExecutorRunDetailEvidenceInput,
  "taskId"
> & {
  readonly dryRun?: boolean;
  readonly requestId?: string;
  readonly taskId?: string | null;
};

export type QueueLinkedWorkerReportIngestionInput = Omit<
  QueueWorkerReportEvidenceInput,
  "taskId"
> & {
  readonly dryRun?: boolean;
  readonly requestId?: string;
  readonly taskId?: string | null;
};

export function createQueueWorkerEvidenceIngestionBridge(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
): QueueWorkerEvidenceIngestionCallback {
  return (input) => ingestQueueWorkerEvidence(dependencies, input);
}

export async function ingestQueueWorkerEvidence(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: QueueWorkerEvidenceIngestionInput,
): Promise<QueueWorkerEvidenceIngestionResult> {
  const dryRun = input.dryRun ?? false;
  const taskId = cleanText(input.taskId);

  if (!taskId) {
    return invalidInputResult({
      dryRun,
      message: "Queue worker evidence ingestion requires an explicit Queue task link.",
      reasons: ["taskId is required. Evidence ingestion never infers taskId from text."],
    });
  }

  if (!dependencies.invokeBrokerAction) {
    return unavailableResult({
      dryRun,
      message: "Queue worker evidence ingestion broker is unavailable.",
      reasons: ["Action Broker dependency is required."],
      taskId,
    });
  }

  const evidence = buildEvidenceBundle(input, taskId);
  if (!evidence.ok) {
    return invalidInputResult({
      dryRun,
      evidenceBundle: evidence.bundle,
      message: evidence.reasons[0] ?? "Queue worker evidence is invalid.",
      reasons: evidence.reasons,
      taskId,
    });
  }

  const bundle = evidence.bundle;
  const lifecycleInput = toBrokerAgentFinishedInput(bundle, input);
  const request = createActionRequest({
    agentId: dependencies.agentId ?? "queue.worker.evidence.ingestion",
    agentRoleId: dependencies.agentRoleId ?? "workspace_agent",
    capabilityId: QUEUE_WORKER_EVIDENCE_INGESTION_CAPABILITY_ID,
    createdAt: dependencies.createdAt ?? new Date().toISOString(),
    dryRun,
    input: lifecycleInput,
    reason: QUEUE_WORKER_EVIDENCE_INGESTION_REASON,
    requestId:
      input.requestId ??
      dependencies.requestId ??
      `${QUEUE_WORKER_EVIDENCE_INGESTION_CAPABILITY_ID}:${taskId}:ingest`,
  });
  const brokerResult = await Promise.resolve(
    dependencies.invokeBrokerAction(request),
  );

  return ingestionResultFromBroker({
    brokerResult,
    dryRun,
    evidenceBundle: bundle,
    taskId,
  });
}

export async function ingestQueueLinkedDirectWorkCompletion(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: QueueLinkedDirectWorkIngestionInput,
): Promise<QueueWorkerEvidenceIngestionResult> {
  const taskId = cleanText(input.taskId);
  if (!taskId) {
    return notLinkedResult(input.dryRun ?? false);
  }

  return ingestQueueWorkerEvidence(dependencies, {
    dryRun: input.dryRun,
    evidenceBundle: createEvidenceBundleFromDirectWorkResult({
      ...input,
      taskId,
    }),
    requestId: input.requestId,
    taskId,
  });
}

export async function maybeIngestQueueLinkedDirectWorkCompletion(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: {
    readonly attemptId?: string;
    readonly changedFiles?: QueueWorkerEvidenceBundleInput["changedFiles"];
    readonly changedFilesSummary?: string;
    readonly completedAt?: string;
    readonly dryRun?: boolean;
    readonly logReference?: string;
    readonly providerId?: string;
    readonly rawProviderSummary?: string;
    readonly result: RunCodexDirectWorkResponse;
    readonly requestId?: string;
    readonly startedAt?: string;
    readonly taskId?: string | null;
    readonly threadId?: string;
    readonly validation?: RunDirectWorkValidationResponse | null;
    readonly workerId?: string;
  },
): Promise<QueueWorkerEvidenceIngestionResult> {
  const taskId = cleanText(input.taskId);
  if (!taskId) {
    return notLinkedResult(input.dryRun ?? false);
  }

  return ingestQueueLinkedDirectWorkCompletion(dependencies, {
    ...input,
    taskId,
  });
}

export async function ingestQueueLinkedWorkspaceAgentCompletion(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: QueueLinkedWorkspaceAgentIngestionInput,
): Promise<QueueWorkerEvidenceIngestionResult> {
  const taskId = cleanText(input.taskId);
  if (!taskId) {
    return notLinkedResult(input.dryRun ?? false);
  }

  return ingestQueueWorkerEvidence(dependencies, {
    dryRun: input.dryRun,
    evidenceBundle: createEvidenceBundleFromWorkspaceAgentRun({
      ...input,
      taskId,
    }),
    requestId: input.requestId,
    taskId,
  });
}

export async function ingestQueueLinkedAgentExecutorRunDetail(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: QueueLinkedAgentExecutorIngestionInput,
): Promise<QueueWorkerEvidenceIngestionResult> {
  const taskId = cleanText(input.taskId);
  if (!taskId) {
    return notLinkedResult(input.dryRun ?? false);
  }

  return ingestQueueWorkerEvidence(dependencies, {
    dryRun: input.dryRun,
    evidenceBundle: createEvidenceBundleFromAgentExecutorRunDetail({
      ...input,
      taskId,
    }),
    requestId: input.requestId,
    taskId,
  });
}

export async function ingestQueueLinkedWorkerReport(
  dependencies: QueueWorkerEvidenceIngestionDependencies,
  input: QueueLinkedWorkerReportIngestionInput,
): Promise<QueueWorkerEvidenceIngestionResult> {
  const taskId = cleanText(input.taskId);
  if (!taskId) {
    return notLinkedResult(input.dryRun ?? false);
  }

  if (input.report.itemId && input.report.itemId !== taskId) {
    return invalidInputResult({
      dryRun: input.dryRun ?? false,
      message: "Queue worker report task link does not match the ingestion taskId.",
      reasons: ["Worker report itemId must match explicit taskId."],
      taskId,
    });
  }

  return ingestQueueWorkerEvidence(dependencies, {
    dryRun: input.dryRun,
    evidenceBundle: createEvidenceBundleFromQueueWorkerReport({
      ...input,
      taskId,
    }),
    requestId: input.requestId,
    taskId,
  });
}

function buildEvidenceBundle(
  input: QueueWorkerEvidenceIngestionInput,
  taskId: string,
): QueueWorkerEvidenceBundleValidationResult {
  const attemptId = cleanText(input.attemptId);

  if (input.outcome !== undefined && input.outcome !== null && !isOutcome(input.outcome)) {
    return {
      missingFields: ["outcome"],
      ok: false,
      reasons: ["Evidence outcome must be completed, not_completed, or failed."],
    };
  }

  if (input.evidenceBundle) {
    const normalized = normalizeQueueWorkerEvidenceBundle(input.evidenceBundle, {
      ...(attemptId ? { expectedAttemptId: attemptId } : {}),
      expectedTaskId: taskId,
    });

    if (
      input.outcome &&
      normalized.ok &&
      normalized.bundle.outcome !== input.outcome
    ) {
      return {
        bundle: normalized.bundle,
        missingFields: [],
        ok: false,
        reasons: [
          "Evidence bundle outcome does not match the ingestion outcome.",
        ],
      };
    }

    return normalized;
  }

  if (!input.outcome) {
    return {
      missingFields: ["outcome"],
      ok: false,
      reasons: ["Evidence outcome is required."],
    };
  }

  const completedAt = cleanText(input.completedAt) ?? cleanText(input.finishedAt);
  const bundle = createQueueWorkerEvidenceBundle({
    attemptId: input.attemptId,
    changedFiles: input.changedFiles,
    changedFilesSummary: input.changedFilesSummary,
    completedAt,
    failureReason: input.failureReason,
    finalAgentMessage: input.finalAgentMessage,
    logReference: input.logReference,
    outcome: input.outcome,
    providerId: input.providerId,
    rawProviderSummary: input.rawProviderSummary,
    runId: input.runId,
    startedAt: input.startedAt,
    stuckReason: input.stuckReason,
    taskId,
    threadId: input.threadId,
    validationExitCode: input.validationExitCode,
    validationOutputPreview: input.validationOutputPreview,
    validationStatus: input.validationStatus,
    validationSummary: input.validationSummary,
    workerId: input.workerId,
  });

  return validateQueueWorkerEvidenceBundle(bundle, {
    ...(attemptId ? { expectedAttemptId: attemptId } : {}),
    expectedTaskId: taskId,
  });
}

function toBrokerAgentFinishedInput(
  bundle: QueueWorkerEvidenceBundle,
  input: QueueWorkerEvidenceIngestionInput,
): QueueAgentLifecycleAgentFinishedInput {
  const lifecycleInput = toLifecycleAgentFinishedInput(bundle, {
    attemptId: cleanText(input.attemptId),
    changedFilesSummary: cleanText(input.changedFilesSummary),
    finalAgentMessage: cleanText(input.finalAgentMessage),
    finishedAt: cleanText(input.finishedAt) ?? cleanText(input.completedAt),
    outcome: input.outcome ?? undefined,
    taskId: cleanText(input.taskId),
    threadId: cleanText(input.threadId),
    validationSummary: cleanText(input.validationSummary),
  });

  return {
    attemptId: lifecycleInput.attemptId,
    changedFilesSummary: lifecycleInput.changedFilesSummary,
    evidenceBundle: lifecycleInput.workerEvidenceBundle,
    finalAgentMessage: lifecycleInput.finalAgentMessage,
    finishedAt: lifecycleInput.finishedAt,
    outcome: lifecycleInput.outcome,
    taskId: lifecycleInput.taskId,
    threadId: lifecycleInput.threadId,
    validationSummary: lifecycleInput.validationSummary,
  };
}

function ingestionResultFromBroker({
  brokerResult,
  dryRun,
  evidenceBundle,
  taskId,
}: {
  readonly brokerResult: HobitAgentBrokerResult<QueueAgentLifecycleTransitionOutput>;
  readonly dryRun: boolean;
  readonly evidenceBundle: QueueWorkerEvidenceBundle;
  readonly taskId: string;
}): QueueWorkerEvidenceIngestionResult {
  const status = mapBrokerStatus(brokerResult.status);
  const lifecycleOutput = brokerResult.result.output;
  const succeeded = status === "success";
  const productStatusLabel = productStatusLabelFor({
    dryRun,
    lifecycleOutput,
    status,
  });

  return {
    activityTitle: succeeded
      ? dryRun
        ? "Queue worker evidence preview prepared"
        : "Queue worker evidence ingested"
      : "Queue evidence ingestion failed",
    brokerResult,
    brokerStatus: brokerResult.status,
    dryRun,
    evidenceBundle,
    evidenceSummary: getEvidenceBundleHumanSummary(evidenceBundle),
    lifecycleOutput,
    message: brokerResult.result.message,
    productStatusLabel,
    reasons: brokerResult.result.policyReasons,
    status,
    taskId,
  };
}

function invalidInputResult({
  dryRun,
  evidenceBundle,
  message,
  reasons,
  taskId,
}: {
  readonly dryRun: boolean;
  readonly evidenceBundle?: QueueWorkerEvidenceBundle;
  readonly message: string;
  readonly reasons: readonly string[];
  readonly taskId?: string;
}): QueueWorkerEvidenceIngestionResult {
  return {
    activityTitle: "Queue evidence ingestion failed",
    dryRun,
    ...(evidenceBundle ? { evidenceBundle } : {}),
    ...(evidenceBundle
      ? { evidenceSummary: getEvidenceBundleHumanSummary(evidenceBundle) }
      : {}),
    message,
    productStatusLabel: "Queue evidence ingestion failed",
    reasons,
    status: "invalid_input",
    ...(taskId ? { taskId } : {}),
  };
}

function unavailableResult({
  dryRun,
  message,
  reasons,
  taskId,
}: {
  readonly dryRun: boolean;
  readonly message: string;
  readonly reasons: readonly string[];
  readonly taskId: string;
}): QueueWorkerEvidenceIngestionResult {
  return {
    activityTitle: "Queue evidence ingestion failed",
    dryRun,
    message,
    productStatusLabel: "Queue evidence ingestion failed",
    reasons,
    status: "unavailable",
    taskId,
  };
}

function notLinkedResult(dryRun: boolean): QueueWorkerEvidenceIngestionResult {
  return {
    activityTitle: "Queue evidence ingestion skipped",
    dryRun,
    message: "Run is not explicitly linked to a Queue task.",
    productStatusLabel: "Queue evidence ingestion skipped",
    reasons: [
      "Explicit taskId is required. Evidence ingestion never infers Queue task links from prompt or final-message text.",
    ],
    status: "not_linked",
  };
}

function mapBrokerStatus(
  status: HobitAgentBrokerStatus,
): QueueWorkerEvidenceIngestionStatus {
  if (status === "succeeded") {
    return "success";
  }

  if (status === "needs_confirmation") {
    return "confirmation_required";
  }

  return status;
}

function productStatusLabelFor({
  dryRun,
  lifecycleOutput,
  status,
}: {
  readonly dryRun: boolean;
  readonly lifecycleOutput?: QueueAgentLifecycleTransitionOutput;
  readonly status: QueueWorkerEvidenceIngestionStatus;
}): string {
  if (status !== "success") {
    return status === "dry_run_required"
      ? "Queue evidence ingestion needs dry-run"
      : "Queue evidence ingestion failed";
  }

  if (dryRun) {
    return "Queue worker evidence preview prepared";
  }

  return lifecycleOutput?.ticketState === "awaiting_review"
    ? "Queue item awaiting review"
    : "Queue worker evidence ingested";
}

function isOutcome(value: unknown): value is QueueWorkerEvidenceOutcome {
  return value === "completed" || value === "not_completed" || value === "failed";
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
