import type { HobitAgentCapabilityId } from "../capabilities/types";
import type { QueueCapabilityRiskClass } from "../capabilities/queueCapabilityContracts";
import type { ModuleWorkflowReference } from "./moduleControlSurface";

export type QueueWorkflowId =
  | "dependency_acceptance_smoke"
  | "dependency_failure_smoke"
  | "review_acceptance"
  | "terminal_failure";

export type QueueModuleWorkflowMetadata =
  ModuleWorkflowReference<QueueCapabilityRiskClass> & {
    workflowId: QueueWorkflowId;
  };

const COMMON_SAFETY_CONSTRAINTS = [
  "noGit",
  "noValidationExecution",
  "noRollback",
  "noTerminal",
  "noDelete",
  "noDownstreamAutoStart",
] as const;

const COMMON_BACKEND_OWNERSHIP_NOTES = [
  "Queue aggregate, dependency, worker evidence, review, accepted-completion, and terminal-failure truth remain backend/domain/storage owned.",
  "Frontend renders authoritative DTOs and sends typed commands only; Queue UI is not workflow truth.",
] as const;

const COMMON_PAUSE_REASONS = [
  "workflowRunnerNotImplemented",
  "queueWorkflowInputValidationDeferred",
  "grantMissingOrInsufficient",
  "capabilityUnavailable",
  "backendPreconditionBlocked",
  "operatorConfirmationRequired",
] as const;

const COMMON_TRANSITIONAL_LIMITATIONS = [
  "Metadata and validation only in this block; no Queue workflow runner exists.",
  "Dependency acceptance/failure smoke workflows validate typed runSettings, task slots, dependency slot references, grant modes, and safety constraints.",
  "Review acceptance and terminal failure workflow input validation remains deferred until their typed runner/input contracts are narrowed.",
  "No worker, validation, Git, rollback, Terminal, downstream auto-start, or scheduler behavior is triggered by workflow metadata.",
] as const;

const METADATA_ONLY_RESUME_SUPPORT = {
  notes: [
    "No durable workflow run state or resume runner exists yet; future support must be typed and backend-aware.",
  ],
  status: "planned",
} as const;

export const QUEUE_MODULE_WORKFLOWS: readonly QueueModuleWorkflowMetadata[] = [
  queueWorkflow({
    confirmationRequirement: "required",
    displayName: "Dependency Acceptance Smoke",
    requiredCapabilityIds: [
      "queue.items.list",
      "queue.lifecycle.get",
      "queue.createItem",
      "queue.createItems",
      "queue.item.updateRunSettings",
      "queue.item.promoteDraft",
      "queue.enable",
      "queue.item.startRun",
      "queue.lifecycle.agentFinished",
      "queue.review.getEvidenceBundle",
      "queue.review.createMessage",
      "queue.review.ack",
      "queue.item.markDone",
    ],
    requiredGrantModes: ["queue_acceptance_smoke", "queue_operator_flow"],
    requiredInputSections: [
      "inputs.tasks",
      "inputs.tasks[].dependsOnSlots",
      "inputs.runSettings",
    ],
    requiredRiskClasses: [
      "read",
      "setup",
      "run_start",
      "worker_evidence",
      "review",
      "final_accept",
    ],
    summary:
      "Create or use an upstream/downstream dependency flow, run upstream, record evidence, create and ACK review, mark accepted completion, then verify downstream is ready without auto-start.",
    supportedPhases: [
      "intake",
      "setup",
      "run_start",
      "worker_evidence",
      "review",
      "decision",
      "closed",
    ],
    workflowId: "dependency_acceptance_smoke",
  }),
  queueWorkflow({
    confirmationRequirement: "required",
    displayName: "Dependency Failure Smoke",
    requiredCapabilityIds: [
      "queue.items.list",
      "queue.lifecycle.get",
      "queue.createItem",
      "queue.createItems",
      "queue.item.updateRunSettings",
      "queue.item.promoteDraft",
      "queue.enable",
      "queue.item.startRun",
      "queue.lifecycle.agentFinished",
      "queue.review.getEvidenceBundle",
      "queue.review.createMessage",
      "queue.review.ack",
      "queue.item.fail",
    ],
    requiredGrantModes: ["queue_failure_smoke", "queue_operator_flow"],
    requiredInputSections: [
      "inputs.tasks",
      "inputs.tasks[].dependsOnSlots",
      "inputs.runSettings",
      "inputs.failureReason",
    ],
    requiredRiskClasses: [
      "read",
      "setup",
      "run_start",
      "worker_evidence",
      "review",
      "terminal_fail",
    ],
    summary:
      "Create or use an upstream/downstream dependency flow, run upstream, record evidence, create and ACK review, make an explicit terminal failure decision, then verify downstream failed-upstream state without auto-start.",
    supportedPhases: [
      "intake",
      "setup",
      "run_start",
      "worker_evidence",
      "review",
      "decision",
      "closed",
    ],
    workflowId: "dependency_failure_smoke",
  }),
  queueWorkflow({
    confirmationRequirement: "none",
    displayName: "Review Acceptance",
    requiredCapabilityIds: [
      "queue.lifecycle.get",
      "queue.review.getEvidenceBundle",
      "queue.review.createMessage",
      "queue.review.ack",
    ],
    requiredGrantModes: [
      "queue_acceptance_smoke",
      "queue_failure_smoke",
      "queue_operator_flow",
    ],
    requiredInputSections: [
      "inputs.task",
      "inputs.workerEvidence",
      "inputs.reviewMessage",
    ],
    requiredRiskClasses: ["read", "review"],
    summary:
      "Read evidence, create a backend review message, and ACK that review message without marking the Queue item done or failed.",
    supportedPhases: ["worker_evidence", "review"],
    workflowId: "review_acceptance",
  }),
  queueWorkflow({
    confirmationRequirement: "required",
    displayName: "Terminal Failure",
    requiredCapabilityIds: [
      "queue.lifecycle.get",
      "queue.review.getEvidenceBundle",
      "queue.review.createMessage",
      "queue.review.ack",
      "queue.item.fail",
    ],
    requiredGrantModes: ["queue_failure_smoke", "queue_operator_flow"],
    requiredInputSections: [
      "inputs.task",
      "inputs.workerEvidence",
      "inputs.reviewMessage",
      "inputs.failureReason",
    ],
    requiredRiskClasses: ["read", "review", "terminal_fail"],
    summary:
      "Make an explicit terminal failure decision after evidence and review preconditions are met.",
    supportedPhases: ["worker_evidence", "review", "decision", "closed"],
    workflowId: "terminal_failure",
  }),
] as const;

export const QUEUE_MODULE_WORKFLOW_IDS = QUEUE_MODULE_WORKFLOWS.map(
  (workflow) => workflow.workflowId,
);

function queueWorkflow({
  confirmationRequirement,
  displayName,
  requiredCapabilityIds,
  requiredGrantModes,
  requiredInputSections,
  requiredRiskClasses,
  summary,
  supportedPhases,
  workflowId,
}: {
  confirmationRequirement: "none" | "recommended" | "required";
  displayName: string;
  requiredCapabilityIds: readonly HobitAgentCapabilityId[];
  requiredGrantModes: readonly string[];
  requiredInputSections: readonly string[];
  requiredRiskClasses: readonly QueueCapabilityRiskClass[];
  summary: string;
  supportedPhases: readonly string[];
  workflowId: QueueWorkflowId;
}): QueueModuleWorkflowMetadata {
  return {
    backendOwnership: COMMON_BACKEND_OWNERSHIP_NOTES,
    backingStatus: "metadata_only",
    confirmationRequirement,
    displayName,
    implementationStatus:
      "Declared workflow metadata with validation-only request handling; dependency acceptance/failure request inputs can validate, but no Queue workflow runner executes.",
    pauseReasons: COMMON_PAUSE_REASONS,
    requiredCapabilityIds,
    requiredGrantModes,
    requiredInputSections,
    requiredRiskClasses,
    resumeSupport: METADATA_ONLY_RESUME_SUPPORT,
    safetyConstraints: COMMON_SAFETY_CONSTRAINTS,
    summary,
    supportedPhases,
    transitionalLimitations: COMMON_TRANSITIONAL_LIMITATIONS,
    uiDependencyPolicy: "none",
    workflowId,
  };
}
