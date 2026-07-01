import type {
  QueueWorkflowCreateSetupStartReport,
  QueueWorkflowDownstreamVerificationReport,
  QueueWorkflowFinalizationReport,
  QueueWorkflowReviewReport,
  QueueWorkflowRunnerReport,
  QueueWorkflowWorkerEvidenceReport,
} from "./queueWorkflowRunnerTypes";

export const QUEUE_MODULE_ID = "queue";
export const QUEUE_FINALIZATION_CONFIRMATION_TOKEN = "operator-confirmed";
export const DEPENDENCY_WORKFLOWS = new Set<string>([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
]);
export const REVIEW_WORKFLOWS = new Set<string>([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
  "review_acceptance",
]);
export const VALIDATION_DEFERRED_WORKFLOWS = new Set<string>([
  "review_acceptance",
  "terminal_failure",
]);
export const DEPENDENCY_REQUIRED_SLOTS = ["upstream", "downstream"] as const;
export const MUTATION_SUMMARY: QueueWorkflowRunnerReport["mutationSummary"] = {
  didAckReview: false,
  didBlock: false,
  didCreateReviewMessage: false,
  didFail: false,
  didFollowUp: false,
  didLaunchTerminal: false,
  didMarkDone: false,
  didMutateGit: false,
  didMutateQueue: false,
  didRollback: false,
  didStartWorker: false,
  didValidate: false,
};

export const EMPTY_REVIEW_REPORT: QueueWorkflowReviewReport = {
  idempotentAck: false,
  idempotentCreate: false,
  phase: "review",
  status: null,
  supportedWorkflow: false,
};

export const EMPTY_WORKER_EVIDENCE_REPORT: QueueWorkflowWorkerEvidenceReport = {
  idempotent: false,
  phase: "worker_evidence",
  status: null,
  supportedWorkflow: false,
};

export const EMPTY_DOWNSTREAM_VERIFICATION: QueueWorkflowDownstreamVerificationReport = {
  dependencyVerified: null,
  notAutoStartedVerified: null,
  verificationMissing: true,
};

export const EMPTY_FINALIZATION_REPORT: QueueWorkflowFinalizationReport = {
  confirmationTokenAccepted: false,
  downstreamVerification: EMPTY_DOWNSTREAM_VERIFICATION,
  idempotent: false,
  phase: "finalization",
  status: null,
  supportedWorkflow: false,
};

export const EMPTY_CREATE_SETUP_START_REPORT: QueueWorkflowCreateSetupStartReport = {
  materializedSlots: {},
  phase: "create_setup_start",
  status: null,
  supportedWorkflow: false,
};
