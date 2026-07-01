import type {
  HobitAgentCapability,
  HobitAgentCapabilityRegistry,
  HobitAgentCapabilityId,
  HobitAgentCapabilitySideEffect,
} from "../capabilities/types";
import type { HobitAgentPolicyDecision } from "../capabilities/policy";
import type { HobitAgentId } from "../runtime/hobitMultiAgentRuntime";
import type { HobitAgentRoleId } from "../context/types";

export const HOBIT_AGENT_ACTION_STATUS_TAXONOMY = [
  "succeeded",
  "blocked",
  "blocked_actionable",
  "invalid_input",
  "needs_confirmation",
  "already_exists",
  "already_done",
  "already_failed",
  "precondition_failed",
  "policy_blocked",
  "unavailable",
  "paused",
  "failed_unexpected",
] as const;

export type HobitAgentActionTaxonomyStatus =
  (typeof HOBIT_AGENT_ACTION_STATUS_TAXONOMY)[number];

export type HobitAgentActionStatus =
  | HobitAgentActionTaxonomyStatus
  | "dry_run_required"
  | "failed";

export type HobitAgentActionReasonCode =
  | "already_done"
  | "already_failed"
  | "already_exists"
  | "capability_unavailable"
  | "confirmation_required"
  | "dependency_waiting"
  | "evidence_bundle_missing"
  | "invalid_payload"
  | "policy_denied"
  | "precondition_failed"
  | "queue_disabled"
  | "review_message_already_exists"
  | "task_not_ready"
  | "unexpected_error"
  | (string & {});

export type HobitNextActionSource =
  | "backend_aggregate"
  | "capability_result"
  | "policy"
  | "workflow_runner";

export type HobitNextActionTargetIds = {
  evidenceBundleId?: string;
  executorWidgetId?: string;
  messageId?: string;
  runId?: string;
  taskId?: string;
};

export type HobitNextActionConfirmationMetadata = {
  required?: boolean;
  tokenField?: string;
  tokenValuePresent?: boolean;
};

export type HobitNextAction = {
  autoContinuationSafe?: boolean;
  capabilityId: HobitAgentCapabilityId;
  confirmation?: HobitNextActionConfirmationMetadata;
  confirmationRequired?: {
    field: string;
    value: string;
  };
  input: unknown;
  moduleId?: string;
  reason?: string;
  reasonCode?: HobitAgentActionReasonCode;
  reasonMessage?: string;
  requiresConfirmation?: boolean;
  riskClass?: string;
  source?: HobitNextActionSource;
  targetIds?: HobitNextActionTargetIds;
};

export type HobitNextActionUnavailableReasonCode =
  | "ambiguous_next_action"
  | "invalid_next_action_payload"
  | "missing_required_input"
  | "next_action_unavailable"
  | HobitAgentActionReasonCode;

export type HobitNextActionUnavailable = {
  ambiguousCandidateIds?: readonly string[];
  invalidPayloadReason?: string;
  missingRequiredInputs?: readonly string[];
  reasonCode: HobitNextActionUnavailableReasonCode;
  reasonMessage: string;
};

export type HobitNextActionValidationResult =
  | {
      capabilityId: HobitAgentCapabilityId;
      missingRequiredInputs: [];
      moduleId: string | null;
      ok: true;
      reasons: [];
    }
  | {
      capabilityId?: HobitAgentCapabilityId | null;
      invalidPayloadReason?: string;
      missingRequiredInputs: string[];
      moduleId?: string | null;
      ok: false;
      reasonCode: HobitNextActionUnavailableReasonCode;
      reasons: string[];
    };

export type HobitAgentBrokerStatus = HobitAgentActionStatus;

export type HobitAgentHiddenSideEffectFlags = {
  noCodexRun: false;
  noGitMutation: false;
  noQueueMutation: false;
  noRollbackExecution: false;
  noShellCommand: false;
  noTerminalLaunch: false;
  noWorkerStart: false;
};

export type HobitAgentActionRequest = {
  agentId: HobitAgentId;
  agentRole: HobitAgentRoleId;
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  createdAt: string;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  rawRequestId?: string | null;
  requestId: string;
  requestIdSource?: "derived" | "explicit";
  requestedAt?: string | null;
};

export type HobitAgentAuditEvent = {
  actorAgentId?: HobitAgentId;
  actorRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  eventName: string;
  message: string;
  requestId?: string;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  timestamp?: string | null;
};

export type HobitAgentActionResult<TOutput = unknown> = {
  auditEvents: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  fieldPath?: string;
  fieldPaths?: string[];
  hiddenSideEffectFlags: HobitAgentHiddenSideEffectFlags;
  message: string;
  ok: boolean;
  output?: TOutput;
  policyDecision?: HobitAgentPolicyDecision;
  policyReasons: string[];
  reasonCode?: HobitAgentActionReasonCode;
  requestId: string;
  status: HobitAgentActionStatus;
  unavailableReason?: string;
};

export type HobitAgentBrokerResult<TOutput = unknown> = {
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult<TOutput>;
  status: HobitAgentBrokerStatus;
};

export type HobitAgentActionHandlerContext = {
  auditEvents: HobitAgentAuditEvent[];
  capability: HobitAgentCapability;
  policyDecision: HobitAgentPolicyDecision;
  registry: HobitAgentCapabilityRegistry;
  request: HobitAgentActionRequest;
};

export type HobitAgentActionHandlerResult<TOutput = unknown> =
  | HobitAgentActionResult<TOutput>
  | Promise<HobitAgentActionResult<TOutput>>;

export type HobitAgentActionHandler<TOutput = unknown> = (
  context: HobitAgentActionHandlerContext,
) => HobitAgentActionHandlerResult<TOutput>;

export type HobitAgentActionHandlerMap = Partial<
  Record<HobitAgentCapabilityId, HobitAgentActionHandler>
>;

export type HobitAgentActionRequestValidation =
  | {
      ok: true;
      reasons: [];
    }
  | {
      ok: false;
      reasons: string[];
    };

export type HobitAgentActionBroker = {
  readonly registry: HobitAgentCapabilityRegistry;
  invoke<TOutput = unknown>(
    request: HobitAgentActionRequest,
  ): HobitAgentBrokerResult<TOutput>;
  invokeAsync<TOutput = unknown>(
    request: HobitAgentActionRequest,
  ): Promise<HobitAgentBrokerResult<TOutput>>;
};
