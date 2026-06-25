import type { QueueWorkflowId } from "../queueWorkflowModuleMetadata";
import {
  EMPTY_CREATE_SETUP_START_REPORT,
  EMPTY_DOWNSTREAM_VERIFICATION,
  EMPTY_FINALIZATION_REPORT,
  EMPTY_REVIEW_REPORT,
  EMPTY_WORKER_EVIDENCE_REPORT,
  MUTATION_SUMMARY,
} from "./queueWorkflowRunnerConstants";
import { evidenceRequestFromKey, stripUndefined } from "./queueWorkflowRunnerRefs";
import type {
  QueueWorkflowCreateSetupStartReport,
  QueueWorkflowFinalizationReport,
  QueueWorkflowReviewReport,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerEvent,
  QueueWorkflowRunnerReport,
  QueueWorkflowRunnerResult,
  QueueWorkflowRunnerStatus,
  QueueWorkflowRunnerStep,
  QueueWorkflowVariables,
  QueueWorkflowWorkerEvidenceReport,
} from "./queueWorkflowRunnerTypes";

export function reviewReport(
  report: Partial<QueueWorkflowReviewReport>,
): QueueWorkflowReviewReport {
  return {
    ...EMPTY_REVIEW_REPORT,
    ...stripUndefined(report),
  };
}

export function finalizationReport(
  report: Partial<QueueWorkflowFinalizationReport>,
): QueueWorkflowFinalizationReport {
  return {
    ...EMPTY_FINALIZATION_REPORT,
    ...stripUndefined(report),
    downstreamVerification: {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      ...stripUndefined(report.downstreamVerification ?? {}),
    },
  };
}

export function result({
  blockers,
  createSetupStartReport = EMPTY_CREATE_SETUP_START_REPORT,
  events,
  finalizationReport = EMPTY_FINALIZATION_REPORT,
  mutationSummary = MUTATION_SUMMARY,
  readOnly = true,
  reportSummary,
  reviewReport = EMPTY_REVIEW_REPORT,
  status,
  steps,
  variables,
  workerEvidenceReport = EMPTY_WORKER_EVIDENCE_REPORT,
}: {
  blockers: QueueWorkflowRunnerBlocker[];
  createSetupStartReport?: QueueWorkflowCreateSetupStartReport;
  events: QueueWorkflowRunnerEvent[];
  finalizationReport?: QueueWorkflowFinalizationReport;
  mutationSummary?: QueueWorkflowRunnerReport["mutationSummary"];
  readOnly?: boolean;
  reportSummary: string;
  reviewReport?: QueueWorkflowReviewReport;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
  workerEvidenceReport?: QueueWorkflowWorkerEvidenceReport;
}): QueueWorkflowRunnerResult {
  const evidenceReads = Object.keys(variables.readSnapshots.evidenceByKey).map(
    evidenceRequestFromKey,
  );

  return {
    blockers,
    events,
    report: {
      createSetupStart: { ...createSetupStartReport },
      evidenceReads,
      finalization: { ...finalizationReport },
      missingExplicitIds: blockers
        .filter((blocker) =>
          [
            "missing_explicit_evidence_ids",
            "missing_explicit_task_ids",
            "read_only_runner_requires_existing_tasks",
          ].includes(blocker.reasonCode),
        )
        .map((blocker) => blocker.fieldPath ?? blocker.reasonCode),
      mutationSummary: { ...mutationSummary },
      nextMutatingPhase: nextMutatingPhase(variables.workflowId),
      readOnly,
      review: { ...reviewReport },
      summary: reportSummary,
      taskReads: Object.keys(variables.readSnapshots.aggregatesByTaskId),
      workerEvidence: { ...workerEvidenceReport },
    },
    requestId: variables.requestId,
    status,
    steps,
    variables,
    workflowId: variables.workflowId,
  };
}

function nextMutatingPhase(workflowId: string): string | null {
  switch (workflowId as QueueWorkflowId) {
    case "dependency_acceptance_smoke":
      return "Create/setup/start can materialize dependency slots, apply upstream settings, promote upstream, start the explicit upstream worker, and pause awaiting worker completion; worker evidence, review, and accepted-completion finalization remain separate typed phases.";
    case "dependency_failure_smoke":
      return "Create/setup/start can materialize dependency slots, apply upstream settings, promote upstream, start the explicit upstream worker, and pause awaiting worker completion; worker evidence, review, and terminal-failure finalization remain separate typed phases.";
    case "review_acceptance":
    case "terminal_failure":
      return null;
  }
}
