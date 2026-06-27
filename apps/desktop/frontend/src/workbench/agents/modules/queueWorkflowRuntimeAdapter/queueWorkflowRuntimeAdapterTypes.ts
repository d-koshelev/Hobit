import type { HobitAgentWorkflowRequestEnvelopeReadResult } from "../../broker";
import type { WorkspaceAgentQueueBridge } from "../../../workspaceAgentQueueBridge";
import type {
  AgentQueueWorkflowCreateSetupStartStepResult,
  AgentQueueWorkflowFinalizationStepResult,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowReviewStepResult,
  AgentQueueWorkflowRunnerReportRecordResult,
  AgentQueueWorkflowStartResult,
  AgentQueueWorkflowWorkerEvidenceStepResult,
  ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
  ExecuteAgentQueueWorkflowReviewStepRequest,
  RecordAgentQueueWorkflowRunnerReportRequest,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
  StartAgentQueueWorkflowRequest,
} from "../../../../workspace/types";
import type {
  QueueWorkflowReadPort,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
} from "../queueWorkflowRunner";

export type QueueWorkflowRunnerRuntimePhase =
  | "create_setup_start"
  | "finalization"
  | "read"
  | "review"
  | "worker_evidence";

export type QueueWorkflowRunnerRuntimeStatus =
  | "blocked"
  | "completed"
  | "deferred"
  | "failed_unexpected"
  | "invalid_request"
  | "paused"
  | "unavailable"
  | "unsupported";

export type QueueWorkflowRunnerRuntimePorts = {
  readPort?: QueueWorkflowReadPort | null;
};

export type QueueWorkflowPersistencePort = {
  planAgentQueueWorkflowResume: (request: {
    expectedVersion?: number | null;
    workflowRunId: string;
    workspaceId: string;
  }) => Promise<AgentQueueWorkflowResumePlan | null>;
  recordAgentQueueWorkflowRunnerReport: (
    request: RecordAgentQueueWorkflowRunnerReportRequest,
  ) => Promise<AgentQueueWorkflowRunnerReportRecordResult>;
  executeAgentQueueWorkflowWorkerEvidenceStep?: (
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
  ) => Promise<AgentQueueWorkflowWorkerEvidenceStepResult>;
  executeAgentQueueWorkflowCreateSetupStartStep?: (
    request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
  ) => Promise<AgentQueueWorkflowCreateSetupStartStepResult>;
  executeAgentQueueWorkflowReviewStep?: (
    request: ExecuteAgentQueueWorkflowReviewStepRequest,
  ) => Promise<AgentQueueWorkflowReviewStepResult>;
  executeAgentQueueWorkflowFinalizationStep?: (
    request: ExecuteAgentQueueWorkflowFinalizationStepRequest,
  ) => Promise<AgentQueueWorkflowFinalizationStepResult>;
  startAgentQueueWorkflow: (
    request: StartAgentQueueWorkflowRequest,
  ) => Promise<AgentQueueWorkflowStartResult>;
};

export type QueueWorkflowRunnerRuntimeAdapterInput = {
  actorId?: string | null;
  ports?: QueueWorkflowRunnerRuntimePorts | null;
  queueBridge?: WorkspaceAgentQueueBridge | null;
  workflowPersistence?: QueueWorkflowPersistencePort | null;
  workflowRequestRead: HobitAgentWorkflowRequestEnvelopeReadResult;
  workspaceId?: string | null;
};

export type QueueWorkflowRunnerRuntimeResult = {
  actionLedgerSummaryCount?: number;
  blockers: readonly string[];
  invoked: boolean;
  moduleId: string | null;
  persistedActionCount?: number;
  persistenceStatus?: string | null;
  persistentStatus?: string | null;
  phase: QueueWorkflowRunnerRuntimePhase | null;
  phasesExecuted: readonly string[];
  evidenceStepResult?: AgentQueueWorkflowWorkerEvidenceStepResult;
  createSetupStartStepResult?: AgentQueueWorkflowCreateSetupStartStepResult;
  finalizationStepResult?: AgentQueueWorkflowFinalizationStepResult;
  reviewStepResult?: AgentQueueWorkflowReviewStepResult;
  recordResult?: AgentQueueWorkflowRunnerReportRecordResult;
  requestId: string | null;
  requestHashConflict?: AgentQueueWorkflowStartResult["conflict"];
  resumePlan?: AgentQueueWorkflowResumePlan;
  runnerResult?: QueueWorkflowRunnerResult;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowId: string | null;
  workflowRunId?: string | null;
  workflowStartStatus?: AgentQueueWorkflowStartResult["status"] | null;
};

export type PreparedQueueWorkflowRuntime = {
  persistenceStatus: string | null;
  persistentStatus: string | null;
  resumePlan?: AgentQueueWorkflowResumePlan;
  runnerRequest: QueueWorkflowRunnerRequest;
  selectedPhase: QueueWorkflowRunnerRuntimePhase;
  workflowPersistence: QueueWorkflowPersistencePort;
  workflowRunId: string | null;
  workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null;
  workspaceId: string;
};

export type QueueWorkflowRuntimeJsonValue = AgentQueueWorkflowJsonValue;
