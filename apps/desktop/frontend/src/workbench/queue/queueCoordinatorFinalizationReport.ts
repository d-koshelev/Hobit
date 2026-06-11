import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type {
  QueueCoordinatorCommitMetadata,
  QueueCoordinatorDecisionState,
  QueueCoordinatorDiffReviewRef,
  QueueCoordinatorEvidenceRef,
  QueueCoordinatorFinalizationDecision,
  QueueCoordinatorFinalizationWarning,
  QueueDependencyGateResult,
} from "./queueCoordinatorFinalizationService";

export function buildCoordinatorFinalizationReport({
  commit,
  dependencyGate,
  decision,
  decisionState,
  diffReview,
  evidenceRefs,
  operatorNote,
  task,
  timestamp,
  warnings,
}: {
  commit?: QueueCoordinatorCommitMetadata;
  dependencyGate: QueueDependencyGateResult;
  decision: QueueCoordinatorFinalizationDecision;
  decisionState: QueueCoordinatorDecisionState;
  diffReview?: QueueCoordinatorDiffReviewRef;
  evidenceRefs: QueueCoordinatorEvidenceRef[];
  operatorNote?: string;
  task: AgentQueueTask;
  timestamp: string;
  warnings: QueueCoordinatorFinalizationWarning[];
}): AgentQueueWorkerExecutionReport {
  const latestReport = latestReportForTask(task);
  const reportId = `coordinator-finalization-${task.queueItemId}-${timestamp.replace(/[^0-9A-Za-z]/g, "")}`;

  return {
    changedFiles: latestReport?.changedFiles ?? [],
    commandsRun: [],
    commitHash: commit?.commitHash,
    createdAt: timestamp,
    errors: [],
    finalGitStatus: commit?.commitHash
      ? `commit_metadata_${commit.verificationStatus ?? "unverified"}`
      : undefined,
    itemId: task.queueItemId,
    rawReportPreview: coordinatorFinalizationMetadataBlock({
      commit,
      dependencyGate,
      decision,
      decisionState,
      diffReview,
      evidenceRefs,
      operatorNote,
      reportId,
      task,
      timestamp,
    }),
    reportId,
    reportStatus:
      decisionState.coordinatorStatus === "finalized"
        ? "completed"
        : decisionState.coordinatorStatus === "failed"
          ? "failed"
          : "needs_follow_up",
    summary: decisionSummary(decision, commit),
    validationCommandsSuggested: [],
    validationResult:
      decisionState.validationStatus === "passed"
        ? "passed"
        : decisionState.validationStatus === "failed"
          ? "failed"
          : "partial",
    warnings: warnings.map((warning) => warning.message),
    workerId: "queue-coordinator",
  };
}

export function appendCoordinatorFinalizationMetadata(
  description: string,
  report: AgentQueueWorkerExecutionReport,
) {
  const block = report.rawReportPreview?.trim();
  if (!block) {
    return description;
  }

  return `${description.trim()}\n\n${block}`.trim();
}

export function decisionSummary(
  decision: QueueCoordinatorFinalizationDecision,
  commit?: QueueCoordinatorCommitMetadata,
) {
  switch (decision) {
    case "accepted_with_commit":
      return commit?.commitHash
        ? `Accepted with existing commit ${commit.commitHash}.`
        : "Accepted-with-commit requested, but commit hash is missing.";
    case "accepted_without_commit":
      return `Accepted without commit. Reason: ${commit?.noCommitReason ?? "no commit required"}.`;
    case "request_changes":
      return "Requested changes; dependency gates remain blocked.";
    case "follow_up_required":
      return "Marked follow-up required; no follow-up was run automatically.";
    case "blocked":
      return "Marked blocked by coordinator.";
    case "failed":
      return "Marked failed/rejected by coordinator.";
    case "rollback_required":
      return "Marked rollback required as a coordinator decision marker only.";
    case "manual_review_required":
      return "Marked manual review required.";
  }
}

export function latestReportForTask(task: AgentQueueTask) {
  return task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ] ?? null;
}

function coordinatorFinalizationMetadataBlock({
  commit,
  dependencyGate,
  decision,
  decisionState,
  diffReview,
  evidenceRefs,
  operatorNote,
  reportId,
  task,
  timestamp,
}: {
  commit?: QueueCoordinatorCommitMetadata;
  dependencyGate: QueueDependencyGateResult;
  decision: QueueCoordinatorFinalizationDecision;
  decisionState: QueueCoordinatorDecisionState;
  diffReview?: QueueCoordinatorDiffReviewRef;
  evidenceRefs: QueueCoordinatorEvidenceRef[];
  operatorNote?: string;
  reportId: string;
  task: AgentQueueTask;
  timestamp: string;
}) {
  return [
    "[Coordinator finalization]",
    `report_id: ${reportId}`,
    `recorded_at: ${timestamp}`,
    `queue_item_id: ${task.queueItemId}`,
    `decision: ${decision}`,
    `queue_status: ${decisionState.status}`,
    `coordinator_status: ${decisionState.coordinatorStatus}`,
    `closure_state: ${decisionState.closureState}`,
    `validation_status: ${decisionState.validationStatus}`,
    commit?.commitHash ? `commit_hash: ${commit.commitHash}` : null,
    commit?.commitTitle ? `commit_title: ${commit.commitTitle}` : null,
    commit?.expectedCommitTitle
      ? `expected_commit_title: ${commit.expectedCommitTitle}`
      : null,
    commit?.noCommitReason ? `no_commit_reason: ${commit.noCommitReason}` : null,
    commit?.verificationStatus
      ? `commit_verification_status: ${commit.verificationStatus}`
      : null,
    diffReview?.itemId ? `diff_review_item_id: ${diffReview.itemId}` : null,
    diffReview?.reportId ? `diff_review_report_id: ${diffReview.reportId}` : null,
    diffReview?.status ? `diff_review_status: ${diffReview.status}` : null,
    diffReview?.recommendation
      ? `diff_review_recommendation: ${diffReview.recommendation}`
      : null,
    evidenceRefs.length
      ? `evidence_refs: ${evidenceRefs
          .map((ref) => `${ref.kind}:${ref.refId}:${ref.status}`)
          .join(", ")}`
      : "evidence_refs: none",
    `dependency_gate: ${dependencyGate.summary}`,
    operatorNote ? `operator_note: ${operatorNote}` : null,
    "effects: no_run, no_autorun, no_commit, no_push, no_rollback",
    "[/Coordinator finalization]",
  ]
    .filter(Boolean)
    .join("\n");
}
