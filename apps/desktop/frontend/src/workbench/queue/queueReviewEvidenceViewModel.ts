import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../agents/adapters/queueAgentCapabilityTypes";
import {
  getQueueTaskDogfoodLifecyclePresentation,
  type QueueTaskDogfoodLifecyclePresentation,
} from "./smartQueueDogfoodLifecycleController";
import type {
  QueueWorkerChangedFileEvidence,
  QueueWorkerEvidenceBundle,
  QueueWorkerEvidenceSummary,
} from "./smartQueueWorkerEvidenceBundle";

const FINAL_MESSAGE_PREVIEW_LIMIT = 520;
const VALIDATION_PREVIEW_LIMIT = 360;
const CHANGED_FILE_PREVIEW_LIMIT = 5;

export const QUEUE_REVIEW_FOLLOW_UP_PROMPT_MAX_LENGTH = 2_000;
export const QUEUE_REVIEW_REASON_MAX_LENGTH = 800;

export type QueueReviewEvidenceActionKey =
  | "ackReview"
  | "addFollowUpPrompt"
  | "approveValidation"
  | "block"
  | "createReviewMessage"
  | "fail"
  | "markDone";

export type QueueReviewEvidenceActionAvailability = {
  readonly disabledReason: string | null;
  readonly enabled: boolean;
  readonly label: string;
  readonly visible: boolean;
};

export type QueueReviewEvidenceViewModel = {
  readonly actions: Record<
    QueueReviewEvidenceActionKey,
    QueueReviewEvidenceActionAvailability
  >;
  readonly additionalPromptCount: number;
  readonly agentOutcomeLabel: string;
  readonly awaitingReview: boolean;
  readonly changedFiles: {
    readonly count: number;
    readonly label: string;
    readonly omittedCount: number;
    readonly previewPaths: readonly string[];
  };
  readonly evidenceBundle: QueueWorkerEvidenceBundle | null;
  readonly evidenceLabel: string | null;
  readonly evidenceSummary: string | null;
  readonly finalAgentMessage: {
    readonly preview: string | null;
    readonly truncated: boolean;
  };
  readonly followUpPromptRunning: boolean;
  readonly frontendOnlyLabel: string | null;
  readonly inReview: boolean;
  readonly latestReviewMessageId: string | null;
  readonly lifecycleStatusLabel: string;
  readonly logReferenceLabel: string | null;
  readonly relevant: boolean;
  readonly reviewMessageStateLabel: string | null;
  readonly reviewOutcome: QueueAgentReviewEvidenceBundleOutput["reviewOutcome"];
  readonly runReferenceLabel: string | null;
  readonly taskId: string;
  readonly validation: {
    readonly label: string;
    readonly outputPreview: string | null;
    readonly outputTruncated: boolean;
    readonly summaryPreview: string | null;
    readonly summaryTruncated: boolean;
  };
};

export function buildQueueReviewEvidenceViewModel({
  dogfoodLifecycle,
  evidenceOutput,
  taskId,
}: {
  readonly dogfoodLifecycle?: QueueTaskDogfoodLifecyclePresentation | null;
  readonly evidenceOutput?: QueueAgentReviewEvidenceBundleOutput | null;
  readonly taskId: string;
}): QueueReviewEvidenceViewModel {
  const lifecycle = evidenceOutput?.lifecycle ?? null;
  const presentation = lifecycle
    ? getQueueTaskDogfoodLifecyclePresentation(lifecycle)
    : dogfoodLifecycle ?? null;
  const evidenceBundle =
    evidenceOutput?.evidenceBundle ?? lifecycle?.workerEvidenceBundle ?? null;
  const evidenceSummary =
    evidenceOutput?.evidenceSummary ??
    evidenceBundle?.summary ??
    lifecycle?.workerEvidenceSummary ??
    null;
  const finalAgentMessage = cleanText(
    evidenceOutput?.finalAgentMessage ??
      lifecycle?.finalAgentMessage ??
      evidenceBundle?.finalAgentMessage ??
      evidenceBundle?.finalReport?.finalAgentMessage,
  );
  const validationSummary = cleanText(
    evidenceOutput?.validationSummary ??
      lifecycle?.validationSummary ??
      evidenceBundle?.validationSummary ??
      evidenceBundle?.validation?.summary,
  );
  const validationOutput = cleanText(
    evidenceBundle?.validationOutputPreview ??
      evidenceBundle?.validation?.outputPreview,
  );
  const changedFiles = changedFilesPreview(evidenceBundle, evidenceSummary);
  const latestReviewMessageId =
    evidenceOutput?.latestReviewMessage?.messageId ??
    lifecycle?.reviewMessages[lifecycle.reviewMessages.length - 1]?.messageId ??
    null;
  const reviewMessagesCount =
    evidenceOutput?.reviewMessages.length ?? lifecycle?.reviewMessages.length ?? 0;
  const awaitingReview =
    presentation?.awaitingReview ?? lifecycle?.ticketState === "awaiting_review";
  const inReview = presentation?.inReview ?? lifecycle?.ticketState === "in_review";
  const followUpPromptRunning =
    presentation?.followUpPromptRunning ??
    (lifecycle?.agentPromptState === "additional_prompt_running");
  const additionalPromptCount =
    presentation?.additionalPromptCount ?? lifecycle?.additionalPromptCount ?? 0;
  const reviewOutcome =
    evidenceOutput?.reviewOutcome ?? presentation?.reviewOutcome ?? null;
  const lifecycleStatusLabel = lifecycleStatusFor({
    followUpPromptRunning,
    presentation,
    ticketState: lifecycle?.ticketState,
  });
  const agentOutcomeLabel = agentOutcomeFor({
    evidenceSummary,
    presentation,
    reviewOutcome,
  });
  const summaryText =
    compactEvidenceSummary(evidenceSummary) ??
    cleanText(evidenceOutput?.latestReviewMessage?.evidenceSummary) ??
    null;
  const finalMessagePreview = previewText(
    finalAgentMessage,
    FINAL_MESSAGE_PREVIEW_LIMIT,
  );
  const validationSummaryPreview = previewText(
    validationSummary,
    VALIDATION_PREVIEW_LIMIT,
  );
  const validationOutputPreview = previewText(
    validationOutput,
    VALIDATION_PREVIEW_LIMIT,
  );
  const hasEvidence =
    Boolean(evidenceBundle || evidenceSummary || finalAgentMessage || validationSummary);
  const relevant = Boolean(
    hasEvidence ||
      awaitingReview ||
      inReview ||
      followUpPromptRunning ||
      presentation ||
      reviewMessagesCount > 0,
  );

  return {
    actions: actionAvailability({
      awaitingReview,
      inReview,
      latestReviewMessageId,
      reviewOutcome,
    }),
    additionalPromptCount,
    agentOutcomeLabel,
    awaitingReview,
    changedFiles,
    evidenceBundle,
    evidenceLabel: hasEvidence ? "Evidence available" : null,
    evidenceSummary: summaryText,
    finalAgentMessage: {
      preview: finalMessagePreview.text,
      truncated: finalMessagePreview.truncated,
    },
    followUpPromptRunning,
    frontendOnlyLabel:
      evidenceOutput?.evidenceBundlePersistence === "frontend_only_not_durable" ||
      evidenceBundle?.frontendOnly
        ? "Frontend evidence only - not durable"
        : null,
    inReview,
    latestReviewMessageId,
    lifecycleStatusLabel,
    logReferenceLabel: logReferenceLabel(evidenceBundle),
    relevant,
    reviewMessageStateLabel: reviewMessageStateLabel({
      inReview,
      latestReviewMessageId,
    }),
    reviewOutcome,
    runReferenceLabel: runReferenceLabel(evidenceBundle),
    taskId,
    validation: {
      label: evidenceSummary?.validationLabel ?? validationLabel(evidenceBundle),
      outputPreview: validationOutputPreview.text,
      outputTruncated: validationOutputPreview.truncated,
      summaryPreview: validationSummaryPreview.text,
      summaryTruncated: validationSummaryPreview.truncated,
    },
  };
}

export function queueReviewEvidenceOutputIsRelevant(
  output: QueueAgentReviewEvidenceBundleOutput | null | undefined,
) {
  if (!output) {
    return false;
  }

  const lifecycle = output.lifecycle;
  return Boolean(
    output.evidenceBundle ||
      output.evidenceSummary ||
      output.finalAgentMessage ||
      output.validationSummary ||
      output.latestReviewMessage ||
      output.reviewMessages.length > 0 ||
      lifecycle.ticketState === "awaiting_review" ||
      lifecycle.ticketState === "in_review" ||
      lifecycle.agentPromptState === "additional_prompt_running",
  );
}

function actionAvailability({
  awaitingReview,
  inReview,
  latestReviewMessageId,
  reviewOutcome,
}: {
  readonly awaitingReview: boolean;
  readonly inReview: boolean;
  readonly latestReviewMessageId: string | null;
  readonly reviewOutcome: QueueAgentReviewEvidenceBundleOutput["reviewOutcome"];
}): QueueReviewEvidenceViewModel["actions"] {
  return {
    ackReview: {
      disabledReason: !latestReviewMessageId
        ? "Create a review message first."
        : awaitingReview
          ? null
          : "Acknowledge review is available while awaiting review.",
      enabled: awaitingReview && Boolean(latestReviewMessageId),
      label: "Acknowledge review",
      visible: awaitingReview,
    },
    addFollowUpPrompt: {
      disabledReason: inReview ? null : "Follow-up prompt is available in review.",
      enabled: inReview,
      label: "Add follow-up prompt",
      visible: inReview,
    },
    approveValidation: {
      disabledReason: inReview
        ? null
        : "Validation approval is available in review.",
      enabled: inReview,
      label: "Approve validation",
      visible: inReview,
    },
    block: {
      disabledReason:
        awaitingReview || inReview ? null : "Block is available during review.",
      enabled: awaitingReview || inReview,
      label: "Block",
      visible: awaitingReview || inReview,
    },
    createReviewMessage: {
      disabledReason: awaitingReview
        ? null
        : "Create review message is available while awaiting review.",
      enabled: awaitingReview,
      label: "Create review message",
      visible: awaitingReview,
    },
    fail: {
      disabledReason:
        awaitingReview || inReview
          ? null
          : "Mark failed is available during review.",
      enabled: awaitingReview || inReview,
      label: "Mark failed",
      visible: awaitingReview || inReview,
    },
    markDone: {
      disabledReason:
        inReview && reviewOutcome === "completed"
          ? null
          : "Mark done requires an in-review completed result.",
      enabled: inReview && reviewOutcome === "completed",
      label: "Mark done",
      visible: inReview,
    },
  };
}

function changedFilesPreview(
  evidenceBundle: QueueWorkerEvidenceBundle | null,
  evidenceSummary: QueueWorkerEvidenceSummary | null,
): QueueReviewEvidenceViewModel["changedFiles"] {
  const changedFiles = evidenceBundle?.changedFiles ?? [];
  const previewPaths = changedFiles
    .slice(0, CHANGED_FILE_PREVIEW_LIMIT)
    .map(changedFileLabel);
  const count =
    evidenceSummary?.changedFileCount ?? evidenceBundle?.changedFiles.length ?? 0;
  const omittedCount = Math.max(0, count - previewPaths.length);

  return {
    count,
    label:
      evidenceSummary?.changedFilesLabel ??
      (count > 0
        ? `${count.toString()} changed file${count === 1 ? "" : "s"}`
        : "No changed files reported"),
    omittedCount,
    previewPaths,
  };
}

function compactEvidenceSummary(
  evidenceSummary: QueueWorkerEvidenceSummary | null,
) {
  if (!evidenceSummary?.humanSummary) {
    return null;
  }

  const parts = evidenceSummary.humanSummary
    .split(". ")
    .map((part) => part.trim())
    .filter(
      (part) => part && part !== evidenceSummary.frontendOnlyLabel.trim(),
    );

  return parts.length > 0 ? parts.join(". ") : null;
}

function changedFileLabel(file: QueueWorkerChangedFileEvidence) {
  return file.status ? `${file.path} (${file.status})` : file.path;
}

function lifecycleStatusFor({
  followUpPromptRunning,
  presentation,
  ticketState,
}: {
  readonly followUpPromptRunning: boolean;
  readonly presentation: QueueTaskDogfoodLifecyclePresentation | null;
  readonly ticketState?: string;
}) {
  if (followUpPromptRunning) {
    return "Follow-up prompt running";
  }

  switch (ticketState ?? presentation?.ticketState) {
    case "awaiting_review":
      return "Awaiting review";
    case "in_review":
      return "In review";
    case "done":
      return "Done";
    case "failure":
    case "blocked":
      return "Failed";
    default:
      return presentation?.awaitingReview
        ? "Awaiting review"
        : presentation?.inReview
          ? "In review"
          : "Evidence available";
  }
}

function agentOutcomeFor({
  evidenceSummary,
  presentation,
  reviewOutcome,
}: {
  readonly evidenceSummary: QueueWorkerEvidenceSummary | null;
  readonly presentation: QueueTaskDogfoodLifecyclePresentation | null;
  readonly reviewOutcome: QueueAgentReviewEvidenceBundleOutput["reviewOutcome"];
}) {
  if (evidenceSummary?.outcomeLabel) {
    return evidenceSummary.outcomeLabel;
  }

  switch (reviewOutcome ?? presentation?.reviewOutcome) {
    case "completed":
      return "Agent completed";
    case "not_completed":
      return "Agent did not complete";
    case "failed":
      return "Agent failed";
    default:
      return "Agent did not complete";
  }
}

function validationLabel(evidenceBundle: QueueWorkerEvidenceBundle | null) {
  switch (evidenceBundle?.validationStatus) {
    case "passed":
      return "Validation passed";
    case "failed":
      return "Validation failed";
    case "not_run":
      return "Validation not run";
    case "unknown":
      return "Validation available";
    default:
      return "Validation not run";
  }
}

function reviewMessageStateLabel({
  inReview,
  latestReviewMessageId,
}: {
  readonly inReview: boolean;
  readonly latestReviewMessageId: string | null;
}) {
  if (!latestReviewMessageId) {
    return null;
  }

  return inReview ? "In review" : "Waiting for coordinator review";
}

function runReferenceLabel(evidenceBundle: QueueWorkerEvidenceBundle | null) {
  const runId = cleanText(evidenceBundle?.run?.runId ?? evidenceBundle?.runId);
  return runId ? `Run ${runId}` : null;
}

function logReferenceLabel(evidenceBundle: QueueWorkerEvidenceBundle | null) {
  const logReference = cleanText(
    evidenceBundle?.run?.logReference ?? evidenceBundle?.logReference,
  );
  return logReference ? `Logs: ${logReference}` : null;
}

function previewText(value: string | null, maxLength: number) {
  if (!value) {
    return { text: null, truncated: false };
  }

  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, maxLength).trimEnd()}\n[Preview capped]`,
    truncated: true,
  };
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
