import type { AgentQueueTask } from "../../../workspace/types";
import {
  coordinatorStatusLabel,
  normalizeCoordinatorStatus,
  normalizeValidationStatus,
} from "../../agentQueueTaskUiModel";
import { getQueuePromptPackImportMetadata } from "../../promptPack/queuePromptPackMetadata";
import { diffReviewLinkageViewForTask } from "../../queue/agentQueueDiffReviewModel";

type ParsedCoordinatorReport = Record<string, string>;

export type QueueV2CoordinatorFinalizationView = {
  actualCommitHash: string | null;
  actualCommitTitle: string | null;
  blockedMarker: string | null;
  cardMarker: string;
  cardMarkerTone: "neutral" | "info" | "success" | "warning" | "error";
  commitSaved: boolean;
  decisionState: string;
  dependencyGateResult: string;
  diffReviewSummary: string;
  expectedCommitTitle: string | null;
  nextAction: string;
  operatorNote: string;
  validationGateSummary: string;
};

export function queueV2CoordinatorFinalizationView(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[] = [task],
): QueueV2CoordinatorFinalizationView {
  const parsed = latestCoordinatorReport(task);
  const coordinatorStatus = normalizeCoordinatorStatus(task.coordinatorStatus);
  const closureState = task.closureState ?? parsed.closure_state ?? "closure_required";
  const validationStatus = normalizeValidationStatus(task.validationStatus);
  const latestReport =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ?? null;
  const promptPackMetadata = getQueuePromptPackImportMetadata(task);
  const diffReview = diffReviewLinkageViewForTask(task, tasks);
  const actualCommitHash =
    latestReport?.commitHash ?? parsed.commit_hash ?? null;
  const actualCommitTitle = parsed.commit_title ?? null;
  const expectedCommitTitle =
    promptPackMetadata?.expectedCommitTitle ?? parsed.expected_commit_title ?? null;

  return {
    actualCommitHash,
    actualCommitTitle,
    blockedMarker: blockedMarker(coordinatorStatus),
    cardMarker: coordinatorCardMarker({
      actualCommitHash,
      closureState,
      coordinatorStatus,
    }),
    cardMarkerTone: coordinatorCardTone(coordinatorStatus, closureState),
    commitSaved: closureState === "commit_created" && Boolean(actualCommitHash),
    decisionState: `${coordinatorStatusLabel(coordinatorStatus)} / ${closureStateLabel(closureState)}`,
    dependencyGateResult:
      parsed.dependency_gate ??
      "Dependency gate was not recomputed for this visible Queue item.",
    diffReviewSummary: diffReview.linkedReviewTitle
      ? `${diffReview.statusLabel}: ${diffReview.linkedReviewTitle}`
      : task.diffReview
        ? `${diffReview.statusLabel}: source ${task.diffReview.sourceItemId}`
        : "Diff Review reference is missing.",
    expectedCommitTitle,
    nextAction: nextCoordinatorAction({
      actualCommitHash,
      closureState,
      coordinatorStatus,
      validationStatus,
      diffReviewStatus: diffReview.status,
    }),
    operatorNote: parsed.operator_note ?? "No operator note recorded.",
    validationGateSummary: validationGateSummary(validationStatus, parsed),
  };
}

function latestCoordinatorReport(task: AgentQueueTask): ParsedCoordinatorReport {
  const report = [...(task.workerExecutionReports ?? [])]
    .reverse()
    .find(
      (candidate) =>
        candidate.workerId === "queue-coordinator" ||
        candidate.rawReportPreview?.includes("[Coordinator finalization]"),
    );

  if (!report?.rawReportPreview) {
    return {};
  }

  return parseCoordinatorMetadataBlock(report.rawReportPreview);
}

function parseCoordinatorMetadataBlock(rawReportPreview: string) {
  const parsed: ParsedCoordinatorReport = {};
  const lines = rawReportPreview.split(/\r?\n/);
  let inside = false;

  for (const line of lines) {
    if (line.trim() === "[Coordinator finalization]") {
      inside = true;
      continue;
    }
    if (line.trim() === "[/Coordinator finalization]") {
      break;
    }
    if (!inside) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function coordinatorCardMarker({
  actualCommitHash,
  closureState,
  coordinatorStatus,
}: {
  actualCommitHash: string | null;
  closureState: string;
  coordinatorStatus: ReturnType<typeof normalizeCoordinatorStatus>;
}) {
  if (coordinatorStatus === "finalized") {
    return actualCommitHash ? "Finalized / commit saved" : "Finalized";
  }

  if (closureState === "commit_created" && actualCommitHash) {
    return "Commit saved";
  }

  return coordinatorStatusLabel(coordinatorStatus);
}

function coordinatorCardTone(
  coordinatorStatus: ReturnType<typeof normalizeCoordinatorStatus>,
  closureState: string,
): QueueV2CoordinatorFinalizationView["cardMarkerTone"] {
  if (coordinatorStatus === "finalized" || closureState === "commit_created") {
    return "success";
  }

  if (coordinatorStatus === "failed" || coordinatorStatus === "rollback_required") {
    return "error";
  }

  if (
    coordinatorStatus === "blocked" ||
    coordinatorStatus === "needs_changes" ||
    coordinatorStatus === "follow_up_required"
  ) {
    return "warning";
  }

  if (
    coordinatorStatus === "awaiting_validation" ||
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "ready_for_finalization"
  ) {
    return "info";
  }

  return "neutral";
}

function closureStateLabel(closureState: string) {
  switch (closureState) {
    case "closure_required":
      return "closure required";
    case "commit_required":
      return "commit required";
    case "commit_created":
      return "commit created";
    case "no_change_accepted":
      return "no-change accepted";
    case "follow_up_created":
      return "follow-up created";
    case "closure_blocked":
      return "closure blocked";
    default:
      return closureState.replace(/_/g, " ");
  }
}

function blockedMarker(
  coordinatorStatus: ReturnType<typeof normalizeCoordinatorStatus>,
) {
  switch (coordinatorStatus) {
    case "blocked":
      return "Blocked";
    case "needs_changes":
      return "Changes requested";
    case "follow_up_required":
      return "Follow-up required";
    case "rollback_required":
      return "Rollback required";
    case "failed":
      return "Failed / rejected";
    default:
      return null;
  }
}

function validationGateSummary(
  validationStatus: ReturnType<typeof normalizeValidationStatus>,
  parsed: ParsedCoordinatorReport,
) {
  if (parsed.validation_status) {
    return `Recorded validation: ${parsed.validation_status}.`;
  }

  switch (validationStatus) {
    case "passed":
      return "Validation passed.";
    case "failed":
      return "Validation failed; final acceptance should stay blocked.";
    case "validating":
      return "Validation is still running.";
    case "needs_review":
      return "Validation evidence needs review.";
    case "not_started":
      return "Validation evidence is missing.";
  }
}

function nextCoordinatorAction({
  actualCommitHash,
  closureState,
  coordinatorStatus,
  diffReviewStatus,
  validationStatus,
}: {
  actualCommitHash: string | null;
  closureState: string;
  coordinatorStatus: ReturnType<typeof normalizeCoordinatorStatus>;
  diffReviewStatus: string;
  validationStatus: ReturnType<typeof normalizeValidationStatus>;
}) {
  if (coordinatorStatus === "finalized") {
    return "View history.";
  }

  if (validationStatus === "failed" || validationStatus === "not_started") {
    return "Resolve validation evidence before acceptance.";
  }

  if (diffReviewStatus === "not_requested") {
    return "Create or link Diff Review evidence before acceptance.";
  }

  if (closureState === "commit_required" && !actualCommitHash) {
    return "Record an existing commit hash or accept as no-change only when valid.";
  }

  if (coordinatorStatus === "needs_changes") {
    return "Request changes or create a follow-up task.";
  }

  if (coordinatorStatus === "follow_up_required") {
    return "Create or review the follow-up task.";
  }

  if (coordinatorStatus === "rollback_required") {
    return "Review rollback requirement; Queue will not execute rollback.";
  }

  return "Choose an explicit coordinator decision.";
}
