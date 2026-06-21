import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
  HobitNextAction,
  HobitNextActionUnavailable,
  HobitNextActionValidationResult,
} from "./agents/broker";
import {
  hobitNextActionAgreesWithSuggestion,
  readHobitNextActionUnavailable,
  validateHobitNextAction,
} from "./agents/broker";
import type { HobitAgentCapability } from "./agents/capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
  type QueueCapabilityContract,
  type QueueCapabilityRiskClass,
} from "./agents/capabilities/queueCapabilityContracts";

export const WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS = 16;

const CONTINUATION_CONTEXT_CHAR_LIMIT = 2600;
const CONTINUATION_PROMPT_CHAR_LIMIT = 3600;
const SUMMARY_CHAR_LIMIT = 220;
const ID_LIMIT = 8;
const BLOCKER_LIMIT = 6;

const DEFAULT_AUTO_CONTINUATION_RISK_CLASSES = new Set<QueueCapabilityRiskClass>(
  ["read", "review"],
);
const QUEUE_AUTONOMY_GRANT_TYPE = "hobit.queue.autonomyGrant";
const QUEUE_AUTONOMY_GRANT_MODE_VALUES = [
  "none",
  "read_only",
  "queue_smoke",
  "queue_acceptance_smoke",
  "queue_failure_smoke",
  "queue_operator_flow",
] as const;
const QUEUE_AUTONOMY_GRANT_CONSTRAINT_KEYS = [
  "noGit",
  "noValidationExecution",
  "noRollback",
  "noTerminal",
  "noDelete",
  "noDownstreamAutoStart",
] as const;
const QUEUE_AUTONOMY_MODE_RISK_CLASSES: Record<
  QueueAutonomyMode,
  readonly QueueCapabilityRiskClass[]
> = {
  none: [],
  read_only: ["read"],
  queue_smoke: ["read", "setup", "run_start", "worker_evidence", "review"],
  queue_acceptance_smoke: [
    "read",
    "setup",
    "run_start",
    "worker_evidence",
    "review",
    "final_accept",
  ],
  queue_failure_smoke: [
    "read",
    "setup",
    "run_start",
    "worker_evidence",
    "review",
    "terminal_fail",
  ],
  queue_operator_flow: [
    "read",
    "setup",
    "run_start",
    "worker_evidence",
    "review",
    "final_accept",
    "terminal_fail",
  ],
};
const QUEUE_AUTONOMY_ALWAYS_BLOCKED_RISK_CLASSES = new Set<
  QueueCapabilityRiskClass
>(["block", "follow_up", "validation_decision", "forbidden"]);
const QUEUE_AUTONOMY_CONFIRMATION_INJECTION_RISK_CLASSES = new Set<
  QueueCapabilityRiskClass
>(["run_start", "final_accept", "terminal_fail"]);

const RESTRICTED_CAPABILITY_IDS = new Set([
  "codex.runTask",
  "workspace.shell.runCommand",
]);

const RESTRICTED_CAPABILITY_PREFIXES = [
  "git.",
  "terminal.",
  "workspace.terminal.",
  "rollback.",
  "delete.",
  "validation.",
  "workspace.shell.",
  "codex.",
];

export type WorkspaceAgentBrokerContinuationStopReason =
  | "already_done"
  | "already_exists"
  | "already_failed"
  | "ambiguous_next_action"
  | "blocked"
  | "broker_unavailable"
  | "confirmation_required"
  | "dry_run_required"
  | "failed"
  | "failed_unexpected"
  | "final_prose"
  | "invalid_input"
  | "invalid_or_unsupported_envelope"
  | "max_action_count_reached"
  | "not_allowed_for_auto_continuation"
  | "paused"
  | "policy_blocked"
  | "precondition_failed"
  | "protocol_error"
  | "repeated_request_fingerprint"
  | "repeated_request_id"
  | "restricted_capability"
  | "safety_stop"
  | "thread_unavailable"
  | "unavailable";

export type WorkspaceAgentBrokerContinuationState = {
  actionCount: number;
  autonomyGrantRejectionReasons: readonly string[];
  chainId: string;
  maxActions: number;
  pendingNextAction: HobitNextAction | null;
  protocolRepairAttempted: boolean;
  queueAutonomyGrant: QueueAutonomyGrant | null;
  queueAutonomyPolicy: QueueAutonomyPolicy;
  seenRequestFingerprints: readonly string[];
  seenRequestIds: readonly string[];
};

export type QueueAutonomyMode =
  (typeof QUEUE_AUTONOMY_GRANT_MODE_VALUES)[number];

export type QueueAutonomyConstraints = Record<
  (typeof QUEUE_AUTONOMY_GRANT_CONSTRAINT_KEYS)[number],
  boolean
>;

export type QueueAutonomyScope = {
  queueTargetId?: string;
  runIds?: readonly string[];
  taskIds?: readonly string[];
  workspaceRoot?: string;
};

export type QueueAutonomyGrant = {
  allowedCapabilities?: readonly string[];
  confirmationToken?: typeof QUEUE_START_RUN_CONFIRMATION_TOKEN;
  constraints: QueueAutonomyConstraints;
  deniedCapabilities?: readonly string[];
  maxActions?: number;
  mode: QueueAutonomyMode;
  scope?: QueueAutonomyScope;
  type: typeof QUEUE_AUTONOMY_GRANT_TYPE;
};

export type QueueAutonomyPolicy = {
  active: boolean;
  allowedCapabilities: readonly string[] | null;
  allowedRiskClasses: readonly QueueCapabilityRiskClass[];
  confirmationToken: typeof QUEUE_START_RUN_CONFIRMATION_TOKEN | null;
  constraints: QueueAutonomyConstraints;
  deniedCapabilities: readonly string[];
  maxActions: number | null;
  mode: QueueAutonomyMode;
  scope: QueueAutonomyScope | null;
};

export type QueueAutonomyDecision =
  | {
      allowed: true;
      capabilityId: string;
      confirmationInjectionAllowed: boolean;
      riskClass: QueueCapabilityRiskClass;
    }
  | {
      allowed: false;
      capabilityId: string;
      reason: string;
      riskClass?: QueueCapabilityRiskClass;
    };

export type WorkspaceAgentBrokerContinuationReasonCode =
  | "ambiguous_next_action"
  | "action_status_blocked"
  | "backend_not_bounded_autonomy_safe"
  | "capability_denied_by_grant"
  | "capability_not_allowed_by_grant"
  | "capability_not_auto_continuation_safe"
  | "capability_not_registered"
  | "confirmation_required"
  | "continuation_allowed"
  | "dependency_waiting"
  | "grant_not_parsed"
  | "max_actions_exceeded"
  | "next_action_payload_invalid"
  | "next_action_suggestion_mismatch"
  | "no_grant_for_risk_class"
  | "no_next_action"
  | "paused"
  | "out_of_scope_task"
  | "precondition_failed"
  | "restricted_capability"
  | "risk_class_not_allowed"
  | "safety_stop"
  | "terminal_finalizer_completed";

export type WorkspaceAgentBrokerPolicyDiagnostics = {
  allowedCapabilities: readonly string[] | null;
  allowedRiskClasses: readonly QueueCapabilityRiskClass[];
  candidateTaskIds: readonly string[];
  capabilityId: string;
  confirmationInjected: boolean;
  confirmationMissing: boolean;
  deniedCapabilities: readonly string[];
  deniedCapabilitiesBlocked: boolean;
  grantActive: boolean;
  grantMode: QueueAutonomyMode | null;
  moduleId: string | null;
  nextActionCapabilityId: string | null;
  nextActionModuleId: string | null;
  nextActionPayloadValidated: boolean | null;
  nextActionPayloadValidationErrors: readonly string[];
  nextActionPresent: boolean;
  reasonCode: WorkspaceAgentBrokerContinuationReasonCode;
  reasonMessage: string;
  riskClass: QueueCapabilityRiskClass | null;
};

export type WorkspaceAgentBrokerContinuationDecision =
  | {
      diagnostics: WorkspaceAgentBrokerPolicyDiagnostics;
      shouldContinue: true;
    }
  | {
      diagnostics: WorkspaceAgentBrokerPolicyDiagnostics;
      shouldContinue: false;
      stopReason: WorkspaceAgentBrokerContinuationStopReason;
    };

export type QueueAutonomyGrantReadResult =
  | {
      grant: null;
      policy: QueueAutonomyPolicy;
      reasons: readonly string[];
      status: "none";
    }
  | {
      grant: QueueAutonomyGrant;
      policy: QueueAutonomyPolicy;
      reasons: readonly string[];
      status: "valid";
    }
  | {
      grant: null;
      policy: QueueAutonomyPolicy;
      reasons: readonly string[];
      status: "invalid";
    };

export type WorkspaceAgentBrokerContinuationAttempt =
  | {
      actionIndex: number;
      fingerprint: string;
      ok: true;
    }
  | {
      actionIndex: number;
      fingerprint?: string;
      ok: false;
      stopReason: WorkspaceAgentBrokerContinuationStopReason;
    };

export type WorkspaceAgentBrokerContinuationSafety = {
  didDelete: boolean;
  didLaunchShell: boolean;
  didMutateGit: boolean;
  didRollback: boolean;
  didRunValidation: boolean;
  didStartTerminal: boolean;
};

export type WorkspaceAgentBrokerContinuationResultContext = {
  blockers: string[];
  capabilityId: string;
  ids: {
    evidenceBundleIds: string[];
    executorWidgetIds: string[];
    messageIds: string[];
    runId: string | null;
    taskIds: string[];
  };
  nextAction: HobitNextAction | null;
  nextActionUnavailable: HobitNextActionUnavailable | null;
  nextSuggestedCapability: string | null;
  notDone: string[];
  policyDiagnostics?: WorkspaceAgentBrokerPolicyDiagnostics;
  queueState: WorkspaceAgentBrokerContinuationQueueState | null;
  requestId: string;
  safety: WorkspaceAgentBrokerContinuationSafety;
  status: string;
  stopReason?: WorkspaceAgentBrokerContinuationStopReason;
  summary: string;
  type: "hobit.action.result";
};

export type WorkspaceAgentBrokerContinuationQueueState = {
  blockers: string[];
  commitState: string | null;
  dependencyState: string | null;
  durableFlags: Record<string, boolean> | null;
  evidenceState: string | null;
  evidenceSummary: Record<string, string | boolean | null> | null;
  latestRun: Record<string, string | boolean | null> | null;
  nextSuggestedCapability: string | null;
  reviewState: string | null;
  ticketState: string | null;
  validationState: string | null;
  workerRunState: string | null;
};

export function createWorkspaceAgentBrokerContinuationState({
  chainId,
  maxActions = WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
  queueAutonomyGrant = null,
  autonomyGrantRejectionReasons = [],
}: {
  autonomyGrantRejectionReasons?: readonly string[];
  chainId: string;
  maxActions?: number;
  queueAutonomyGrant?: unknown;
}): WorkspaceAgentBrokerContinuationState {
  const structuredGrant = normalizeWorkspaceAgentQueueAutonomyGrant(
    queueAutonomyGrant,
  );
  const policy = structuredGrant
    ? createQueueAutonomyPolicy(structuredGrant)
    : createDefaultQueueAutonomyPolicy();
  const boundedMaxActions = Math.min(
    maxActions,
    policy.maxActions ?? WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
    WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
  );
  return {
    actionCount: 0,
    autonomyGrantRejectionReasons,
    chainId,
    maxActions: boundedMaxActions,
    pendingNextAction: null,
    protocolRepairAttempted: false,
    queueAutonomyGrant: structuredGrant,
    queueAutonomyPolicy: policy,
    seenRequestFingerprints: [],
    seenRequestIds: [],
  };
}

export function readWorkspaceAgentQueueAutonomyGrantFromText(
  text: string,
): QueueAutonomyGrantReadResult {
  const policy = createDefaultQueueAutonomyPolicy();
  const candidates = collectQueueAutonomyGrantJsonCandidates(text);
  if (candidates.length === 0) {
    if (text.indexOf(QUEUE_AUTONOMY_GRANT_TYPE) >= 0) {
      return {
        grant: null,
        policy,
        reasons: ["Queue autonomy grant JSON is malformed."],
        status: "invalid",
      };
    }

    return {
      grant: null,
      policy,
      reasons: [],
      status: "none",
    };
  }

  const invalidReasons: string[] = [];
  for (const candidateText of candidates) {
    const parsed = parseJsonRecord(candidateText);
    if (!parsed.ok) {
      invalidReasons.push("Queue autonomy grant JSON is malformed.");
      continue;
    }

    if (parsed.value.type !== QUEUE_AUTONOMY_GRANT_TYPE) {
      continue;
    }

    const normalized = normalizeWorkspaceAgentQueueAutonomyGrantWithReasons(
      parsed.value,
    );
    if (!normalized.ok) {
      return {
        grant: null,
        policy,
        reasons: normalized.reasons,
        status: "invalid",
      };
    }

    return {
      grant: normalized.grant,
      policy: createQueueAutonomyPolicy(normalized.grant),
      reasons: [],
      status: "valid",
    };
  }

  return invalidReasons.length > 0
    ? {
        grant: null,
        policy,
        reasons: [...new Set(invalidReasons)],
        status: "invalid",
      }
    : {
        grant: null,
        policy,
        reasons: [],
        status: "none",
      };
}

export function normalizeWorkspaceAgentQueueAutonomyGrant(
  candidate: unknown,
): QueueAutonomyGrant | null {
  const normalized = normalizeWorkspaceAgentQueueAutonomyGrantWithReasons(
    candidate,
  );
  return normalized.ok ? normalized.grant : null;
}

function normalizeWorkspaceAgentQueueAutonomyGrantWithReasons(
  candidate: unknown,
):
  | { grant: QueueAutonomyGrant; ok: true }
  | { ok: false; reasons: readonly string[] } {
  const record = recordValue(candidate);
  if (!record || record.type !== QUEUE_AUTONOMY_GRANT_TYPE) {
    return {
      ok: false,
      reasons: ["Queue autonomy grant must be a structured JSON object."],
    };
  }

  const reasons: string[] = [];
  const mode = stringField(record, "mode");
  if (!isQueueAutonomyMode(mode)) {
    reasons.push("Queue autonomy grant mode is unsupported.");
  }

  const maxActions = numberField(record, "maxActions");
  if (maxActions !== null && (!Number.isInteger(maxActions) || maxActions <= 0)) {
    reasons.push("Queue autonomy grant maxActions must be a positive integer.");
  }

  const confirmationToken = stringField(record, "confirmationToken");
  if (
    confirmationToken !== null &&
    confirmationToken !== QUEUE_START_RUN_CONFIRMATION_TOKEN
  ) {
    reasons.push(
      `Queue autonomy grant confirmationToken must exactly equal ${QUEUE_START_RUN_CONFIRMATION_TOKEN}.`,
    );
  }

  const allowedCapabilities = optionalCapabilityIdList(
    record,
    "allowedCapabilities",
    reasons,
  );
  const deniedCapabilities = optionalCapabilityIdList(
    record,
    "deniedCapabilities",
    reasons,
  );
  const rawConstraints = record.constraints;
  if (rawConstraints !== undefined && !recordValue(rawConstraints)) {
    reasons.push("Queue autonomy grant constraints must be an object.");
  }
  const constraints = normalizeQueueAutonomyConstraints(
    recordValue(rawConstraints),
    reasons,
  );
  const rawScope = record.scope;
  if (rawScope !== undefined && !recordValue(rawScope)) {
    reasons.push("Queue autonomy grant scope must be an object.");
  }
  const scope = normalizeQueueAutonomyScope(recordValue(rawScope), reasons);

  if (reasons.length > 0 || !mode || !isQueueAutonomyMode(mode)) {
    return { ok: false, reasons };
  }

  return {
    grant: {
      ...(allowedCapabilities ? { allowedCapabilities } : {}),
      ...(confirmationToken === QUEUE_START_RUN_CONFIRMATION_TOKEN
        ? { confirmationToken }
        : {}),
      constraints,
      ...(deniedCapabilities ? { deniedCapabilities } : {}),
      ...(maxActions ? { maxActions } : {}),
      mode,
      ...(scope ? { scope } : {}),
      type: QUEUE_AUTONOMY_GRANT_TYPE,
    },
    ok: true,
  };
}

export function createQueueAutonomyPolicy(
  grant: QueueAutonomyGrant,
): QueueAutonomyPolicy {
  const allowedRiskClasses =
    grant.mode === "none"
      ? []
      : QUEUE_AUTONOMY_MODE_RISK_CLASSES[grant.mode].filter(
          (riskClass) => !QUEUE_AUTONOMY_ALWAYS_BLOCKED_RISK_CLASSES.has(riskClass),
        );

  return {
    active: grant.mode !== "none",
    allowedCapabilities: grant.allowedCapabilities
      ? [...new Set(grant.allowedCapabilities)]
      : null,
    allowedRiskClasses: [...new Set(allowedRiskClasses)],
    confirmationToken: grant.confirmationToken ?? null,
    constraints: grant.constraints,
    deniedCapabilities: grant.deniedCapabilities
      ? [...new Set(grant.deniedCapabilities)]
      : [],
    maxActions: grant.maxActions
      ? Math.min(grant.maxActions, WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS)
      : null,
    mode: grant.mode,
    scope: grant.scope ?? null,
  };
}

export function createDefaultQueueAutonomyPolicy(): QueueAutonomyPolicy {
  return {
    active: false,
    allowedCapabilities: null,
    allowedRiskClasses: [...DEFAULT_AUTO_CONTINUATION_RISK_CLASSES],
    confirmationToken: null,
    constraints: defaultQueueAutonomyConstraints(),
    deniedCapabilities: [],
    maxActions: null,
    mode: "none",
    scope: null,
  };
}

export function evaluateWorkspaceAgentBrokerContinuationAttempt(
  state: WorkspaceAgentBrokerContinuationState,
  request: HobitAgentActionRequest,
): WorkspaceAgentBrokerContinuationAttempt {
  const actionIndex = state.actionCount + 1;

  if (state.actionCount >= state.maxActions) {
    return {
      actionIndex,
      ok: false,
      stopReason: "max_action_count_reached",
    };
  }

  if (
    request.requestIdSource !== "derived" &&
    state.seenRequestIds.includes(request.requestId)
  ) {
    return {
      actionIndex,
      ok: false,
      stopReason: "repeated_request_id",
    };
  }

  const fingerprint = workspaceAgentBrokerActionFingerprint(request);
  if (state.seenRequestFingerprints.includes(fingerprint)) {
    return {
      actionIndex,
      fingerprint,
      ok: false,
      stopReason: "repeated_request_fingerprint",
    };
  }

  return {
    actionIndex,
    fingerprint,
    ok: true,
  };
}

export function deriveWorkspaceAgentBrokerContinuationRequestId({
  actionIndex,
  capabilityId,
  chainId,
}: {
  actionIndex: number;
  capabilityId: string;
  chainId: string;
}): string {
  return `${chainId}:action-${actionIndex.toString()}:${capabilityId}`;
}

export function recordWorkspaceAgentBrokerContinuationAttempt(
  state: WorkspaceAgentBrokerContinuationState,
  request: HobitAgentActionRequest,
  fingerprint: string,
): WorkspaceAgentBrokerContinuationState {
  return {
    ...state,
    actionCount: state.actionCount + 1,
    seenRequestFingerprints: [
      ...state.seenRequestFingerprints,
      fingerprint,
    ].slice(-state.maxActions),
    seenRequestIds: [...state.seenRequestIds, request.requestId].slice(
      -state.maxActions,
    ),
    pendingNextAction: null,
  };
}

export function recordWorkspaceAgentBrokerContinuationProtocolRepair(
  state: WorkspaceAgentBrokerContinuationState,
): WorkspaceAgentBrokerContinuationState {
  return {
    ...state,
    protocolRepairAttempted: true,
  };
}

export function prepareWorkspaceAgentBrokerContinuationStateForResult({
  result,
  state,
}: {
  result: HobitAgentActionResult;
  state: WorkspaceAgentBrokerContinuationState;
}): WorkspaceAgentBrokerContinuationState {
  const nextAction = queueResultNextAction(result.output);
  if (!nextAction || !validateHobitNextAction(nextAction).ok) {
    return {
      ...state,
      pendingNextAction: null,
    };
  }

  return {
    ...state,
    pendingNextAction: nextAction,
  };
}

export function applyWorkspaceAgentQueueAutonomyGrantToActionRequest(
  state: WorkspaceAgentBrokerContinuationState,
  request: HobitAgentActionRequest,
): {
  confirmationInjected: boolean;
  request: HobitAgentActionRequest;
} {
  if (
    request.confirmationToken ||
    state.queueAutonomyPolicy.confirmationToken !==
      QUEUE_START_RUN_CONFIRMATION_TOKEN ||
    !state.pendingNextAction ||
    !actionRequestMatchesNextAction(request, state.pendingNextAction)
  ) {
    return {
      confirmationInjected: false,
      request,
    };
  }

  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(request.capabilityId);
  if (!contract?.confirmation.required) {
    return {
      confirmationInjected: false,
      request,
    };
  }

  const decision = decideQueueAutonomyForCapability({
    capabilityId: request.capabilityId,
    contract,
    policy: state.queueAutonomyPolicy,
  });
  if (!decision.allowed || !decision.confirmationInjectionAllowed) {
    return {
      confirmationInjected: false,
      request,
    };
  }

  return {
    confirmationInjected: true,
    request: {
      ...request,
      confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
    },
  };
}

export function shouldContinueWorkspaceAgentBrokerAction({
  capability,
  request,
  result,
  state,
}: {
  capability?: HobitAgentCapability | null;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult;
  state: WorkspaceAgentBrokerContinuationState;
}):
  | { shouldContinue: true }
  | {
      shouldContinue: false;
      stopReason: WorkspaceAgentBrokerContinuationStopReason;
    } {
  const decision = decideWorkspaceAgentBrokerActionContinuation({
    capability,
    request,
    result,
    state,
  });

  return decision.shouldContinue
    ? { shouldContinue: true }
    : {
        shouldContinue: false,
        stopReason: decision.stopReason,
      };
}

export function decideWorkspaceAgentBrokerActionContinuation({
  capability,
  confirmationInjected = false,
  request,
  result,
  state,
}: {
  capability?: HobitAgentCapability | null;
  confirmationInjected?: boolean;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult;
  state: WorkspaceAgentBrokerContinuationState;
}): WorkspaceAgentBrokerContinuationDecision {
  const continueAllowed = (
    diagnostics: WorkspaceAgentBrokerPolicyDiagnostics,
  ): WorkspaceAgentBrokerContinuationDecision => ({
    diagnostics,
    shouldContinue: true,
  });
  const blocked = ({
    capabilityId,
    candidateTaskIds = [],
    confirmationMissing = false,
    deniedCapabilitiesBlocked = false,
    moduleId = null,
    nextAction = null,
    nextActionValidation = null,
    reasonCode,
    reasonMessage,
    stopReason,
  }: {
    capabilityId: string;
    candidateTaskIds?: readonly string[];
    confirmationMissing?: boolean;
    deniedCapabilitiesBlocked?: boolean;
    moduleId?: string | null;
    nextAction?: HobitNextAction | null;
    nextActionValidation?: HobitNextActionValidationResult | null;
    reasonCode: WorkspaceAgentBrokerContinuationReasonCode;
    reasonMessage: string;
    stopReason: WorkspaceAgentBrokerContinuationStopReason;
  }): WorkspaceAgentBrokerContinuationDecision => ({
    diagnostics: createWorkspaceAgentBrokerPolicyDiagnostics({
      candidateTaskIds,
      capabilityId,
      confirmationInjected,
      confirmationMissing,
      deniedCapabilitiesBlocked,
      moduleId,
      nextAction,
      nextActionValidation,
      reasonCode,
      reasonMessage,
      state,
    }),
    shouldContinue: false,
    stopReason,
  });

  const terminalStatusReason = stopReasonForActionStatus(result.status);
  if (terminalStatusReason) {
    return blocked({
      capabilityId: request.capabilityId,
      reasonCode:
        terminalStatusReason === "confirmation_required"
          ? "confirmation_required"
          : terminalStatusReason === "paused"
            ? "paused"
          : "action_status_blocked",
      reasonMessage:
        result.policyReasons[0] ??
        result.unavailableReason ??
        result.message ??
        `${request.capabilityId} returned ${result.status}.`,
      stopReason: terminalStatusReason,
    });
  }

  const capabilityClass = classifyWorkspaceAgentBrokerContinuationCapability(
    capability ?? result.capabilityId,
    state.queueAutonomyPolicy,
  );
  if (capabilityClass.kind === "restricted") {
    return blocked({
      capabilityId: request.capabilityId,
      reasonCode: "restricted_capability",
      reasonMessage: capabilityClass.reason,
      stopReason: "restricted_capability",
    });
  }

  const safety = workspaceAgentBrokerContinuationSafety(result.output);
  if (
    safety.didDelete ||
    safety.didLaunchShell ||
    safety.didMutateGit ||
    safety.didRollback ||
    safety.didRunValidation ||
    safety.didStartTerminal
  ) {
    return blocked({
      capabilityId: request.capabilityId,
      reasonCode: "safety_stop",
      reasonMessage:
        "Continuation stopped because the result reported a forbidden side effect.",
      stopReason: "safety_stop",
    });
  }

  if (state.actionCount >= state.maxActions) {
    return blocked({
      capabilityId: request.capabilityId,
      reasonCode: "max_actions_exceeded",
      reasonMessage: `Continuation action budget ${state.maxActions.toString()} was reached.`,
      stopReason: "max_action_count_reached",
    });
  }

  const nextAction = queueResultNextAction(result.output);
  const nextSuggestedCapability = queueResultNextSuggestedCapability(result.output);
  if (nextAction) {
    const validation = validateHobitNextAction(nextAction);
    if (!validation.ok) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "next_action_payload_invalid",
        reasonMessage:
          validation.reasons[0] ??
          `nextAction payload for ${nextAction.capabilityId} is invalid.`,
        stopReason: "invalid_input",
      });
    }

    if (
      !hobitNextActionAgreesWithSuggestion({
        nextAction,
        nextSuggestedCapability,
      })
    ) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "next_action_suggestion_mismatch",
        reasonMessage:
          "nextAction.capabilityId does not match nextSuggestedCapability.",
        stopReason: "invalid_input",
      });
    }

    const nextCapabilityClass =
      classifyWorkspaceAgentBrokerContinuationCapability(
        nextAction.capabilityId,
        state.queueAutonomyPolicy,
      );
    if (nextCapabilityClass.kind === "restricted") {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "restricted_capability",
        reasonMessage:
          nextCapabilityClass.reason ??
          `${nextAction.capabilityId} is restricted.`,
        stopReason: "restricted_capability",
      });
    }

    const nextContract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(
      nextAction.capabilityId,
    );
    const nextDecision = nextContract
      ? decideQueueAutonomyForCapability({
          capabilityId: nextAction.capabilityId,
          contract: nextContract,
          policy: state.queueAutonomyPolicy,
        })
      : null;
    if (nextDecision && !nextDecision.allowed) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        deniedCapabilitiesBlocked:
          state.queueAutonomyPolicy.deniedCapabilities.includes(
            nextAction.capabilityId,
          ),
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: reasonCodeForQueueAutonomyDecision({
          decision: nextDecision,
          state,
        }),
        reasonMessage: nextDecision.reason,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
    const scopeDecision = decideQueueAutonomyScopeForNextAction({
      nextAction,
      policy: state.queueAutonomyPolicy,
    });
    if (!scopeDecision.allowed) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "out_of_scope_task",
        reasonMessage: scopeDecision.reason,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
    if (queueResultForbidsNextAction(result.output, nextAction)) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "dependency_waiting",
        reasonMessage:
          "Backend aggregate dependency state blocks this next action.",
        stopReason: "policy_blocked",
      });
    }
    if (
      state.seenRequestFingerprints.includes(
        workspaceAgentBrokerActionFingerprintFromParts({
          capabilityId: nextAction.capabilityId,
          dryRun: false,
          input: nextAction.input,
        }),
      )
    ) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "action_status_blocked",
        reasonMessage:
          "Continuation stopped because the next action repeats a previous capability/input.",
        stopReason: "repeated_request_fingerprint",
      });
    }

    if (nextAction.requiresConfirmation || nextAction.confirmationRequired) {
      if (
        !nextDecision?.allowed ||
        !nextDecision.confirmationInjectionAllowed ||
        state.queueAutonomyPolicy.confirmationToken !==
          QUEUE_START_RUN_CONFIRMATION_TOKEN
      ) {
        return blocked({
          capabilityId: nextAction.capabilityId,
          confirmationMissing: true,
          moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
          nextAction,
          nextActionValidation: validation,
          reasonCode: "confirmation_required",
          reasonMessage:
            "The next action requires exact structured confirmation and the active grant cannot supply it.",
          stopReason: "confirmation_required",
        });
      }
    }
    if (!state.queueAutonomyPolicy.active && !nextAction.autoContinuationSafe) {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "capability_not_auto_continuation_safe",
        reasonMessage: `${nextAction.capabilityId} is not marked auto-continuation safe without a Queue grant.`,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }
    if (nextCapabilityClass.kind !== "allowed") {
      return blocked({
        capabilityId: nextAction.capabilityId,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: reasonCodeForCapabilityClass({
          capabilityId: nextAction.capabilityId,
          state,
        }),
        reasonMessage:
          nextCapabilityClass.reason ??
          `${nextAction.capabilityId} is not allowed for continuation.`,
        stopReason: "not_allowed_for_auto_continuation",
      });
    }

    return continueAllowed(
      createWorkspaceAgentBrokerPolicyDiagnostics({
        capabilityId: nextAction.capabilityId,
        confirmationInjected,
        moduleId: validation.moduleId ?? nextAction.moduleId ?? null,
        nextAction,
        nextActionValidation: validation,
        reasonCode: "continuation_allowed",
        reasonMessage: `${nextAction.capabilityId} is allowed for continuation.`,
        state,
      }),
    );
  }

  const nextActionUnavailable = readHobitNextActionUnavailable(result.output);
  const statusWithoutNextActionStopReason =
    stopReasonForActionStatusWithoutNextAction(result.status);
  if (nextActionUnavailable) {
    const candidateTaskIds = candidateTaskIdsForAmbiguousNextAction(
      result.output,
    );
    const ambiguous =
      nextActionUnavailable.reasonCode === "ambiguous_next_action" ||
      candidateTaskIds.length > 1;
    return blocked({
      capabilityId: nextSuggestedCapability ?? request.capabilityId,
      candidateTaskIds,
      reasonCode: ambiguous
        ? "ambiguous_next_action"
        : nextActionUnavailable.reasonCode === "invalid_next_action_payload"
          ? "next_action_payload_invalid"
          : statusWithoutNextActionStopReason === "precondition_failed"
            ? "precondition_failed"
            : "no_next_action",
      reasonMessage:
        nextActionUnavailable.invalidPayloadReason ??
        nextActionUnavailable.reasonMessage,
      stopReason: ambiguous
        ? "ambiguous_next_action"
        : statusWithoutNextActionStopReason ??
          "not_allowed_for_auto_continuation",
    });
  }

  if (statusWithoutNextActionStopReason) {
    return blocked({
      capabilityId: nextSuggestedCapability ?? request.capabilityId,
      candidateTaskIds: candidateTaskIdsForAmbiguousNextAction(result.output),
      reasonCode:
        result.status === "precondition_failed"
          ? "precondition_failed"
          : "no_next_action",
      reasonMessage: nextSuggestedCapability
        ? `${result.status} requires a schema-valid typed nextAction before ${nextSuggestedCapability} can continue.`
        : `${result.status} cannot continue without a schema-valid typed nextAction.`,
      stopReason: statusWithoutNextActionStopReason,
    });
  }

  if (nextSuggestedCapability) {
    const candidateTaskIds = candidateTaskIdsForAmbiguousNextAction(result.output);
    const ambiguous = isAmbiguousNextActionResult(result.output, candidateTaskIds);
    return blocked({
      capabilityId: nextSuggestedCapability,
      candidateTaskIds,
      reasonCode: ambiguous ? "ambiguous_next_action" : "no_next_action",
      reasonMessage: ambiguous
        ? `Result suggested ${nextSuggestedCapability}, but multiple candidate task ids are present. Use a typed nextAction or scope the read to one task.`
        : `Result suggested ${nextSuggestedCapability}, but no schema-valid typed nextAction was present.`,
      stopReason: ambiguous
        ? "ambiguous_next_action"
        : "not_allowed_for_auto_continuation",
    });
  }

  if (capabilityClass.kind === "allowed" && capabilityClass.isTerminalFinalizer) {
    return blocked({
      capabilityId: request.capabilityId,
      reasonCode: "terminal_finalizer_completed",
      reasonMessage:
        "Terminal Queue finalizer completed; continuation stops before downstream auto-start.",
      stopReason: "not_allowed_for_auto_continuation",
    });
  }

  if (capabilityClass.kind === "allowed") {
    return continueAllowed(
      createWorkspaceAgentBrokerPolicyDiagnostics({
        capabilityId: request.capabilityId,
        confirmationInjected,
        reasonCode: "continuation_allowed",
        reasonMessage: `${request.capabilityId} is allowed for continuation.`,
        state,
      }),
    );
  }

  if (
    capabilityClass.kind === "queue_start_run" &&
    queueStartRunMayContinue(request, result)
  ) {
    return continueAllowed(
      createWorkspaceAgentBrokerPolicyDiagnostics({
        capabilityId: request.capabilityId,
        confirmationInjected,
        reasonCode: "continuation_allowed",
        reasonMessage:
          "Confirmed Queue-linked run returned explicit task, executor, and run ids.",
        state,
      }),
    );
  }

  return blocked({
    capabilityId: request.capabilityId,
    reasonCode: reasonCodeForCapabilityClass({
      capabilityId: request.capabilityId,
      state,
    }),
    reasonMessage:
      capabilityClass.kind === "not_allowed"
        ? capabilityClass.reason
        : `${request.capabilityId} is not allowed for continuation.`,
    stopReason: "not_allowed_for_auto_continuation",
  });
}

function createWorkspaceAgentBrokerPolicyDiagnostics({
  candidateTaskIds = [],
  capabilityId,
  confirmationInjected = false,
  confirmationMissing = false,
  deniedCapabilitiesBlocked = false,
  moduleId = null,
  nextAction = null,
  nextActionValidation = null,
  reasonCode,
  reasonMessage,
  state,
}: {
  candidateTaskIds?: readonly string[];
  capabilityId: string;
  confirmationInjected?: boolean;
  confirmationMissing?: boolean;
  deniedCapabilitiesBlocked?: boolean;
  moduleId?: string | null;
  nextAction?: HobitNextAction | null;
  nextActionValidation?: HobitNextActionValidationResult | null;
  reasonCode: WorkspaceAgentBrokerContinuationReasonCode;
  reasonMessage: string;
  state: WorkspaceAgentBrokerContinuationState;
}): WorkspaceAgentBrokerPolicyDiagnostics {
  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
  const resolvedModuleId =
    moduleId ??
    nextActionValidation?.moduleId ??
    nextAction?.moduleId ??
    (contract ? "queue" : null);
  return {
    allowedCapabilities: state.queueAutonomyPolicy.allowedCapabilities
      ? [...state.queueAutonomyPolicy.allowedCapabilities]
      : null,
    allowedRiskClasses: [...state.queueAutonomyPolicy.allowedRiskClasses],
    candidateTaskIds: compactStringList(candidateTaskIds, ID_LIMIT),
    capabilityId,
    confirmationInjected,
    confirmationMissing,
    deniedCapabilities: [...state.queueAutonomyPolicy.deniedCapabilities],
    deniedCapabilitiesBlocked,
    grantActive: state.queueAutonomyPolicy.active,
    grantMode: state.queueAutonomyPolicy.active
      ? state.queueAutonomyPolicy.mode
      : null,
    moduleId: resolvedModuleId,
    nextActionCapabilityId: nextAction?.capabilityId ?? null,
    nextActionModuleId: nextAction ? resolvedModuleId : null,
    nextActionPayloadValidated: nextAction
      ? Boolean(nextActionValidation?.ok)
      : null,
    nextActionPayloadValidationErrors:
      nextActionValidation && !nextActionValidation.ok
        ? [...nextActionValidation.reasons]
        : [],
    nextActionPresent: Boolean(nextAction),
    reasonCode,
    reasonMessage,
    riskClass: contract?.riskClass ?? null,
  };
}

export function formatWorkspaceAgentBrokerPolicyDiagnosticSummary(
  diagnostics: WorkspaceAgentBrokerPolicyDiagnostics,
): string {
  const nextActionState = diagnostics.nextActionPresent
    ? `${diagnostics.nextActionCapabilityId ?? "unknown"}; payloadValidated=${
        diagnostics.nextActionPayloadValidated === true ? "true" : "false"
      }`
    : "absent";
  const confirmationState = diagnostics.confirmationInjected
    ? "injected"
    : diagnostics.confirmationMissing
      ? "missing"
      : "not_required";
  const candidateSuffix =
    diagnostics.candidateTaskIds.length > 0
      ? ` candidateTaskIds=${diagnostics.candidateTaskIds.join(",")};`
      : "";

  return [
    `Policy diagnostic: ${diagnostics.reasonCode}.`,
    `capabilityId=${diagnostics.capabilityId};`,
    `moduleId=${diagnostics.moduleId ?? "unknown"};`,
    `riskClass=${diagnostics.riskClass ?? "unknown"};`,
    `grantActive=${diagnostics.grantActive ? "true" : "false"};`,
    `grantMode=${diagnostics.grantMode ?? "none"};`,
    `allowedRiskClasses=${
      diagnostics.allowedRiskClasses.length > 0
        ? diagnostics.allowedRiskClasses.join(",")
        : "none"
    };`,
    `nextAction=${nextActionState};`,
    `confirmation=${confirmationState};`,
    `deniedCapabilitiesBlocked=${
      diagnostics.deniedCapabilitiesBlocked ? "true" : "false"
    };`,
    candidateSuffix,
    diagnostics.reasonMessage,
  ]
    .filter((part) => part.trim())
    .join(" ");
}

function reasonCodeForQueueAutonomyDecision({
  decision,
  state,
}: {
  decision: Extract<QueueAutonomyDecision, { allowed: false }>;
  state: WorkspaceAgentBrokerContinuationState;
}): WorkspaceAgentBrokerContinuationReasonCode {
  const policy = state.queueAutonomyPolicy;
  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(decision.capabilityId);

  if (!policy.active && state.autonomyGrantRejectionReasons.length > 0) {
    return "grant_not_parsed";
  }

  if (policy.deniedCapabilities.includes(decision.capabilityId)) {
    return "capability_denied_by_grant";
  }

  if (
    policy.allowedCapabilities &&
    !policy.allowedCapabilities.includes(decision.capabilityId)
  ) {
    return "capability_not_allowed_by_grant";
  }

  if (
    contract &&
    (contract.backing === "transitional_frontend_overlay" ||
      contract.backing === "model_preview")
  ) {
    return "backend_not_bounded_autonomy_safe";
  }

  if (decision.riskClass && !policy.allowedRiskClasses.includes(decision.riskClass)) {
    return policy.active ? "risk_class_not_allowed" : "no_grant_for_risk_class";
  }

  return policy.active ? "risk_class_not_allowed" : "no_grant_for_risk_class";
}

function reasonCodeForCapabilityClass({
  capabilityId,
  state,
}: {
  capabilityId: string;
  state: WorkspaceAgentBrokerContinuationState;
}): WorkspaceAgentBrokerContinuationReasonCode {
  const policy = state.queueAutonomyPolicy;
  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);

  if (!contract) {
    return "capability_not_registered";
  }

  if (!policy.active && state.autonomyGrantRejectionReasons.length > 0) {
    return "grant_not_parsed";
  }

  if (policy.deniedCapabilities.includes(capabilityId)) {
    return "capability_denied_by_grant";
  }

  if (policy.allowedCapabilities && !policy.allowedCapabilities.includes(capabilityId)) {
    return "capability_not_allowed_by_grant";
  }

  if (!policy.allowedRiskClasses.includes(contract.riskClass)) {
    return policy.active ? "risk_class_not_allowed" : "no_grant_for_risk_class";
  }

  if (!contract.autoContinuationSafe || contract.confirmation.required) {
    return "capability_not_auto_continuation_safe";
  }

  return "risk_class_not_allowed";
}

function decideQueueAutonomyScopeForNextAction({
  nextAction,
  policy,
}: {
  nextAction: HobitNextAction;
  policy: QueueAutonomyPolicy;
}): { allowed: true } | { allowed: false; reason: string } {
  if (!policy.active || !policy.scope) {
    return { allowed: true };
  }

  const input = recordValue(nextAction.input);
  const taskId = stringField(input, "taskId");
  const scopedTaskIds = policy.scope.taskIds ?? [];
  if (taskId && scopedTaskIds.length > 0 && !scopedTaskIds.includes(taskId)) {
    return {
      allowed: false,
      reason: `${nextAction.capabilityId} targets taskId ${taskId}, which is outside the Queue autonomy grant scope.`,
    };
  }

  const runId = stringField(input, "runId");
  const scopedRunIds = policy.scope.runIds ?? [];
  if (runId && scopedRunIds.length > 0 && !scopedRunIds.includes(runId)) {
    return {
      allowed: false,
      reason: `${nextAction.capabilityId} targets runId ${runId}, which is outside the Queue autonomy grant scope.`,
    };
  }

  return { allowed: true };
}

function candidateTaskIdsForAmbiguousNextAction(output: unknown): string[] {
  const root = recordValue(output);
  const nextActionUnavailable = readHobitNextActionUnavailable(output);
  return compactStringList(
    [
      ...(nextActionUnavailable?.ambiguousCandidateIds ?? []),
      ...stringArrayField(root, "candidateTaskIds"),
      ...stringArrayField(root, "createdTaskIds"),
      ...arrayField(root, "items").map((item) =>
        stringField(recordValue(item), "taskId"),
      ),
      ...arrayField(root, "createdItems").map((item) =>
        stringField(recordValue(item), "id"),
      ),
    ],
    ID_LIMIT,
  );
}

function isAmbiguousNextActionResult(
  output: unknown,
  candidateTaskIds: readonly string[],
) {
  const root = recordValue(output);
  const nextActionUnavailable = readHobitNextActionUnavailable(output);
  return (
    nextActionUnavailable?.reasonCode === "ambiguous_next_action" ||
    stringField(root, "nextActionUnavailableCode") === "ambiguous_next_action" ||
    candidateTaskIds.length > 1
  );
}

export function classifyWorkspaceAgentBrokerContinuationCapability(
  capabilityOrId: HobitAgentCapability | string,
  policy: QueueAutonomyPolicy = createDefaultQueueAutonomyPolicy(),
):
  | {
      isTerminalFinalizer: boolean;
      kind: "allowed";
      reason: null;
      riskClass: QueueCapabilityRiskClass | null;
    }
  | { kind: "queue_start_run"; reason: null }
  | { kind: "restricted"; reason: string }
  | { kind: "not_allowed"; reason: string } {
  const capabilityId =
    typeof capabilityOrId === "string" ? capabilityOrId : capabilityOrId.id;
  const restricted =
    typeof capabilityOrId === "string" ? false : capabilityOrId.restricted;

  if (
    restricted ||
    RESTRICTED_CAPABILITY_IDS.has(capabilityId) ||
    RESTRICTED_CAPABILITY_PREFIXES.some((prefix) =>
      capabilityId.startsWith(prefix),
    )
  ) {
    return {
      kind: "restricted",
      reason: `${capabilityId} is restricted for broker auto-continuation.`,
    };
  }

  if (capabilityId === "queue.item.startRun") {
    const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
    if (contract && policy.active) {
      const decision = decideQueueAutonomyForCapability({
        capabilityId,
        contract,
        policy,
      });
      if (decision.allowed) {
        return {
          isTerminalFinalizer: false,
          kind: "allowed",
          reason: null,
          riskClass: contract.riskClass,
        };
      }
    }

    return { kind: "queue_start_run", reason: null };
  }

  const queueContract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
  if (queueContract) {
    const decision = decideQueueAutonomyForCapability({
      capabilityId,
      contract: queueContract,
      policy,
    });
    if (
      decision.allowed &&
      (policy.active ||
        (queueContract.autoContinuationSafe &&
          !queueContract.confirmation.required))
    ) {
      return {
        isTerminalFinalizer: isTerminalFinalizerRiskClass(
          queueContract.riskClass,
        ),
        kind: "allowed",
        reason: null,
        riskClass: queueContract.riskClass,
      };
    }

    return {
      kind: "not_allowed",
      reason: decision.allowed
        ? `${capabilityId} is not auto-continuation safe without a Queue autonomy grant.`
        : decision.reason,
    };
  }

  return {
    kind: "not_allowed",
    reason: `${capabilityId} is not allowed for broker auto-continuation.`,
  };
}

export function decideQueueAutonomyForCapability({
  capabilityId,
  contract,
  policy,
}: {
  capabilityId: string;
  contract: QueueCapabilityContract;
  policy: QueueAutonomyPolicy;
}): QueueAutonomyDecision {
  if (QUEUE_AUTONOMY_ALWAYS_BLOCKED_RISK_CLASSES.has(contract.riskClass)) {
    return {
      allowed: false,
      capabilityId,
      reason: `${capabilityId} risk class ${contract.riskClass} is blocked for bounded Queue autonomy.`,
      riskClass: contract.riskClass,
    };
  }

  if (
    contract.backing === "transitional_frontend_overlay" ||
    contract.backing === "model_preview"
  ) {
    return {
      allowed: false,
      capabilityId,
      reason: `${capabilityId} is not backend-backed for bounded Queue autonomy.`,
      riskClass: contract.riskClass,
    };
  }

  if (policy.deniedCapabilities.includes(capabilityId)) {
    return {
      allowed: false,
      capabilityId,
      reason: `${capabilityId} is denied by the Queue autonomy grant.`,
      riskClass: contract.riskClass,
    };
  }

  if (
    policy.allowedCapabilities &&
    !policy.allowedCapabilities.includes(capabilityId)
  ) {
    return {
      allowed: false,
      capabilityId,
      reason: `${capabilityId} is not included in allowedCapabilities.`,
      riskClass: contract.riskClass,
    };
  }

  if (!policy.allowedRiskClasses.includes(contract.riskClass)) {
    return {
      allowed: false,
      capabilityId,
      reason: `${capabilityId} risk class ${contract.riskClass} is not allowed for broker auto-continuation.`,
      riskClass: contract.riskClass,
    };
  }

  return {
    allowed: true,
    capabilityId,
    confirmationInjectionAllowed:
      policy.active &&
      contract.confirmation.required &&
      QUEUE_AUTONOMY_CONFIRMATION_INJECTION_RISK_CLASSES.has(
        contract.riskClass,
      ),
    riskClass: contract.riskClass,
  };
}

function isQueueCapabilityRiskClass(
  value: unknown,
): value is QueueCapabilityRiskClass {
  return (
    value === "read" ||
    value === "setup" ||
    value === "run_start" ||
    value === "worker_evidence" ||
    value === "review" ||
    value === "final_accept" ||
    value === "terminal_fail" ||
    value === "block" ||
    value === "follow_up" ||
    value === "validation_decision" ||
    value === "forbidden"
  );
}

function isQueueAutonomyMode(value: unknown): value is QueueAutonomyMode {
  return (
    typeof value === "string" &&
    QUEUE_AUTONOMY_GRANT_MODE_VALUES.includes(value as QueueAutonomyMode)
  );
}

function defaultQueueAutonomyConstraints(): QueueAutonomyConstraints {
  return {
    noDelete: true,
    noDownstreamAutoStart: true,
    noGit: true,
    noRollback: true,
    noTerminal: true,
    noValidationExecution: true,
  };
}

function normalizeQueueAutonomyConstraints(
  candidate: Record<string, unknown> | null,
  reasons: string[],
): QueueAutonomyConstraints {
  const constraints = defaultQueueAutonomyConstraints();
  if (!candidate) {
    return constraints;
  }

  for (const key of QUEUE_AUTONOMY_GRANT_CONSTRAINT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(candidate, key)) {
      continue;
    }

    const value = candidate[key];
    if (typeof value !== "boolean") {
      reasons.push(`Queue autonomy constraint ${key} must be boolean.`);
    } else if (value !== true) {
      reasons.push(
        `Queue autonomy constraint ${key}=false is not supported in this MVP.`,
      );
    }
  }

  return constraints;
}

function normalizeQueueAutonomyScope(
  candidate: Record<string, unknown> | null,
  reasons: string[],
): QueueAutonomyScope | undefined {
  if (!candidate) {
    return undefined;
  }

  const taskIds = optionalStringArray(candidate, "taskIds", reasons);
  const runIds = optionalStringArray(candidate, "runIds", reasons);
  const workspaceRoot = stringField(candidate, "workspaceRoot") ?? undefined;
  const queueTargetId = stringField(candidate, "queueTargetId") ?? undefined;
  if (!taskIds && !runIds && !workspaceRoot && !queueTargetId) {
    return undefined;
  }

  return {
    ...(queueTargetId ? { queueTargetId } : {}),
    ...(runIds ? { runIds } : {}),
    ...(taskIds ? { taskIds } : {}),
    ...(workspaceRoot ? { workspaceRoot } : {}),
  };
}

function optionalCapabilityIdList(
  record: Record<string, unknown>,
  fieldName: "allowedCapabilities" | "deniedCapabilities",
  reasons: string[],
): readonly string[] | undefined {
  const field = record[fieldName];
  if (field === undefined) {
    return undefined;
  }

  if (!Array.isArray(field)) {
    reasons.push(`Queue autonomy grant ${fieldName} must be a string array.`);
    return undefined;
  }

  const capabilityIds: string[] = [];
  for (const value of field) {
    if (typeof value !== "string" || !value.trim()) {
      reasons.push(`Queue autonomy grant ${fieldName} must contain strings.`);
      continue;
    }

    const capabilityId = value.trim();
    if (!QUEUE_CAPABILITY_CONTRACT_BY_ID.has(capabilityId)) {
      reasons.push(
        `Queue autonomy grant ${fieldName} contains unsupported capability ${capabilityId}.`,
      );
      continue;
    }

    capabilityIds.push(capabilityId);
  }

  return capabilityIds.length > 0 ? [...new Set(capabilityIds)] : [];
}

function optionalStringArray(
  record: Record<string, unknown>,
  fieldName: "runIds" | "taskIds",
  reasons: string[],
): readonly string[] | undefined {
  const field = record[fieldName];
  if (field === undefined) {
    return undefined;
  }

  if (!Array.isArray(field)) {
    reasons.push(`Queue autonomy grant scope.${fieldName} must be a string array.`);
    return undefined;
  }

  const values = field.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
  if (values.length !== field.length) {
    reasons.push(`Queue autonomy grant scope.${fieldName} must contain strings.`);
  }

  return values.length > 0
    ? [...new Set(values.map((value) => value.trim()))]
    : [];
}

function collectQueueAutonomyGrantJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  const candidates: string[] = [];
  if (!trimmed) {
    return candidates;
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    candidates.push(trimmed);
  }

  for (const block of fencedJsonBlocks(trimmed)) {
    candidates.push(block);
  }

  const markerIndex = trimmed.indexOf(QUEUE_AUTONOMY_GRANT_TYPE);
  if (markerIndex >= 0) {
    for (const objectText of balancedJsonObjectsAround(trimmed, markerIndex)) {
      candidates.push(objectText);
    }
  }

  return [...new Set(candidates)];
}

function fencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let searchIndex = 0;
  while (searchIndex < text.length) {
    const fenceStart = text.indexOf("```", searchIndex);
    if (fenceStart < 0) {
      break;
    }

    const headerEnd = text.indexOf("\n", fenceStart + 3);
    if (headerEnd < 0) {
      break;
    }

    const header = text.slice(fenceStart + 3, headerEnd).trim();
    const fenceEnd = text.indexOf("```", headerEnd + 1);
    if (fenceEnd < 0) {
      break;
    }

    const isStructuredJson =
      header === "" ||
      header === "json" ||
      header === "hobit.queue.autonomyGrant" ||
      header === "hobit-queue-autonomy-grant";
    const body = text.slice(headerEnd + 1, fenceEnd).trim();
    if (isStructuredJson && body) {
      blocks.push(body);
    }

    searchIndex = fenceEnd + 3;
  }

  return blocks;
}

function balancedJsonObjectsAround(text: string, markerIndex: number): string[] {
  const objects: string[] = [];
  for (let start = markerIndex; start >= 0; start -= 1) {
    if (text[start] !== "{") {
      continue;
    }

    const end = findBalancedJsonObjectEnd(text, start);
    if (end !== null && end > markerIndex) {
      objects.push(text.slice(start, end + 1));
      break;
    }
  }

  return objects;
}

function findBalancedJsonObjectEnd(text: string, startIndex: number): number | null {
  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return null;
}

function parseJsonRecord(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    const record = recordValue(value);
    return record ? { ok: true, value: record } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function actionRequestMatchesNextAction(
  request: HobitAgentActionRequest,
  nextAction: HobitNextAction,
) {
  return (
    request.capabilityId === nextAction.capabilityId &&
    stableStringify(request.input) === stableStringify(nextAction.input)
  );
}

function queueResultForbidsNextAction(
  output: unknown,
  nextAction: HobitNextAction,
) {
  if (nextAction.capabilityId !== "queue.item.startRun") {
    return false;
  }

  const root = recordValue(output);
  const sources = [
    root,
    recordField(root, "aggregate"),
    recordField(root, "item"),
    recordField(root, "lifecycle"),
    recordValue(arrayField(root, "items")[0]),
  ];
  const dependencyState = firstStringFromSources(sources, "dependencyState");
  if (
    dependencyState === "waiting" ||
    dependencyState === "blocked" ||
    dependencyState === "failed_upstream" ||
    dependencyState === "unknown"
  ) {
    return true;
  }

  const blockers = [
    ...arrayField(root, "blockers"),
    ...arrayField(recordField(root, "aggregate"), "blockers"),
    ...arrayField(recordField(root, "item"), "blockers"),
  ];
  return blockers.some((blocker) => {
    const code = stringField(recordValue(blocker), "code");
    return Boolean(code?.startsWith("dependency_"));
  });
}

function workspaceAgentBrokerActionFingerprintFromParts({
  capabilityId,
  dryRun,
  input,
}: {
  capabilityId: string;
  dryRun: boolean;
  input: unknown;
}) {
  return stableStringify({
    capabilityId,
    dryRun,
    input,
  });
}

function isTerminalFinalizerRiskClass(riskClass: QueueCapabilityRiskClass) {
  return riskClass === "final_accept" || riskClass === "terminal_fail";
}

export function createWorkspaceAgentBrokerActionResultContext({
  policyDiagnostics,
  request,
  result,
  stopReason,
  summary,
}: {
  policyDiagnostics?: WorkspaceAgentBrokerPolicyDiagnostics;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult;
  stopReason?: WorkspaceAgentBrokerContinuationStopReason;
  summary: string;
}): WorkspaceAgentBrokerContinuationResultContext {
  const output = recordValue(result.output);
  const safety = workspaceAgentBrokerContinuationSafety(result.output);
  const nextAction = queueResultNextAction(result.output);
  const validNextAction =
    nextAction && validateHobitNextAction(nextAction).ok
      ? nextAction
      : null;
  const nextActionUnavailable = readHobitNextActionUnavailable(result.output);
  const nextSuggestedCapability = firstString([
    stringField(output, "nextSuggestedCapability"),
    stringField(recordField(output, "item"), "nextSuggestedCapability"),
    firstString(
      arrayField(output, "createdItems").map((item) =>
        stringField(recordValue(item), "nextSuggestedCapability"),
      ),
    ),
    firstString(
      arrayField(output, "items").map((item) =>
        stringField(recordValue(item), "nextSuggestedCapability"),
      ),
    ),
  ]);
  const queueState = collectQueueState(output, nextSuggestedCapability);
  const context: WorkspaceAgentBrokerContinuationResultContext = {
    blockers: compactStringList(
      [
        ...result.policyReasons,
        result.unavailableReason,
        ...collectBlockers(output),
      ],
      BLOCKER_LIMIT,
    ),
    capabilityId: result.capabilityId,
    ids: {
      evidenceBundleIds: compactStringList(
        collectEvidenceBundleIds(output, validNextAction),
        ID_LIMIT,
      ),
      executorWidgetIds: compactStringList(
        collectExecutorWidgetIds(output, validNextAction),
        ID_LIMIT,
      ),
      messageIds: compactStringList(
        collectMessageIds(output, validNextAction),
        ID_LIMIT,
      ),
      runId: firstString([
        stringField(recordValue(validNextAction?.input), "runId"),
        stringField(output, "runId"),
        stringField(recordField(output, "latestRun"), "runId"),
        stringField(recordField(recordField(output, "aggregate"), "latestRun"), "runId"),
        stringField(recordField(output, "queueLinkedMetadata"), "runId"),
      ]),
      taskIds: compactStringList(
        collectTaskIds(output, validNextAction),
        ID_LIMIT,
      ),
    },
    nextAction: validNextAction,
    nextActionUnavailable,
    nextSuggestedCapability,
    notDone: notDoneMessages(safety),
    ...(policyDiagnostics ? { policyDiagnostics } : {}),
    queueState,
    requestId: request.requestId,
    safety,
    status: result.status === "succeeded" ? "succeeded" : result.status,
    ...(stopReason ? { stopReason } : {}),
    summary: compactText(summary, SUMMARY_CHAR_LIMIT),
    type: "hobit.action.result",
  };

  return boundResultContext(context);
}

export function formatWorkspaceAgentBrokerContinuationPrompt({
  actionIndex,
  context,
  maxActions,
}: {
  actionIndex: number;
  context: WorkspaceAgentBrokerContinuationResultContext;
  maxActions: number;
}): string {
  const contextJson = JSON.stringify(context);
  return compactText(
    [
      "[Hobit broker continuation]",
      `Action ${actionIndex.toString()}/${maxActions.toString()} completed.`,
      "The app executed the typed Hobit action and returned this compact structured result.",
      "Continue the same user request from this result.",
      'Emit exactly one hobit.action.request envelope when another Hobit app action is needed, or {"type":"hobit.final.answer","message":"..."} when the task is done.',
      "The final-answer marker lets the app distinguish completion from an intermediate stall.",
      "Intermediate prose is not a capability call.",
      'Queue bounded autonomy requires a structured {"type":"hobit.queue.autonomyGrant",...} grant from the user request. Prose like go or I confirm is not a grant.',
      "Do not emit action lists. Use a fresh requestId for each envelope. Do not repeat a previous request id or same capability/input.",
      "Prefer returned nextAction when present. Use nextAction.capabilityId and nextAction.input exactly; do not rename fields.",
      "If nextAction is unavailable, ask or stop with the blocker. Do not guess from nextSuggestedCapability alone.",
      "Inside an active Queue grant, follow schema-valid nextAction exactly. If policy blocks it, finish with a hobit.final.answer blocker.",
      "Hard-stop statuses are blocked, invalid_input, needs_confirmation, policy_blocked, unavailable, paused, failed_unexpected, and failed compatibility.",
      "Actionable/idempotent statuses such as blocked_actionable, already_exists, already_done, and precondition_failed may continue only through a schema-valid typed nextAction allowed by policy.",
      "Never infer taskId, runId, evidenceBundleId, messageId, or executorWidgetId from prose, titles, paths, final messages, or source text.",
      "Do not use shell, raw Codex, Git, validation, rollback, Terminal, or hidden execution for Hobit product actions.",
      contextJson,
    ].join("\n"),
    CONTINUATION_PROMPT_CHAR_LIMIT,
  );
}

export function formatWorkspaceAgentBrokerActionTranscript({
  actionIndex,
  capabilityId,
  maxActions,
  stopReason,
  summary,
}: {
  actionIndex: number;
  capabilityId: string;
  maxActions: number;
  stopReason?: WorkspaceAgentBrokerContinuationStopReason;
  summary: string;
}): string {
  return [
    `Action ${actionIndex.toString()}/${maxActions.toString()}: ${capabilityId}`,
    summary,
    stopReason ? `Stopped: ${stopReasonLabel(stopReason)}.` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function workspaceAgentBrokerActionFingerprint(
  request: HobitAgentActionRequest,
): string {
  return workspaceAgentBrokerActionFingerprintFromParts({
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    input: request.input,
  });
}

export function stopReasonForActionStatus(
  status: HobitAgentActionResult["status"],
): WorkspaceAgentBrokerContinuationStopReason | null {
  switch (status) {
    case "succeeded":
    case "blocked_actionable":
    case "already_exists":
    case "already_done":
    case "precondition_failed":
      return null;
    case "needs_confirmation":
      return "confirmation_required";
    case "dry_run_required":
      return "dry_run_required";
    case "policy_blocked":
      return "policy_blocked";
    case "unavailable":
      return "unavailable";
    case "invalid_input":
      return "invalid_input";
    case "blocked":
      return "blocked";
    case "paused":
      return "paused";
    case "already_failed":
      return "already_failed";
    case "failed_unexpected":
      return "failed_unexpected";
    case "failed":
      return "failed";
  }
}

function stopReasonForActionStatusWithoutNextAction(
  status: HobitAgentActionResult["status"],
): WorkspaceAgentBrokerContinuationStopReason | null {
  switch (status) {
    case "blocked_actionable":
      return "blocked";
    case "already_exists":
      return "already_exists";
    case "already_done":
      return "already_done";
    case "precondition_failed":
      return "precondition_failed";
    default:
      return null;
  }
}

export function stopReasonLabel(
  reason: WorkspaceAgentBrokerContinuationStopReason,
): string {
  switch (reason) {
    case "already_done":
      return "already done";
    case "already_exists":
      return "already exists";
    case "already_failed":
      return "already failed";
    case "broker_unavailable":
      return "Action Broker unavailable";
    case "ambiguous_next_action":
      return "ambiguous next action";
    case "blocked":
      return "blocked";
    case "confirmation_required":
      return "confirmation required";
    case "dry_run_required":
      return "dry-run required";
    case "failed":
      return "action failed";
    case "failed_unexpected":
      return "unexpected action failure";
    case "final_prose":
      return "final answer received";
    case "invalid_input":
      return "invalid input";
    case "invalid_or_unsupported_envelope":
      return "invalid or unsupported action envelope";
    case "max_action_count_reached":
      return "maximum action count reached";
    case "not_allowed_for_auto_continuation":
      return "auto-continuation policy blocked";
    case "paused":
      return "paused";
    case "policy_blocked":
      return "policy blocked";
    case "precondition_failed":
      return "precondition failed";
    case "protocol_error":
      return "action protocol error";
    case "repeated_request_fingerprint":
      return "repeated capability/input";
    case "repeated_request_id":
      return "repeated request id";
    case "restricted_capability":
      return "restricted capability";
    case "safety_stop":
      return "safety stop";
    case "thread_unavailable":
      return "Codex thread unavailable";
    case "unavailable":
      return "capability unavailable";
  }
}

function queueStartRunMayContinue(
  request: HobitAgentActionRequest,
  result: HobitAgentActionResult,
) {
  const input = recordValue(request.input);
  const output = recordValue(result.output);
  return Boolean(
    request.confirmationToken === QUEUE_START_RUN_CONFIRMATION_TOKEN &&
      stringField(input, "taskId") &&
      stringField(input, "executorWidgetId") &&
      (stringField(output, "runId") ||
        stringField(recordField(output, "queueLinkedMetadata"), "runId")),
  );
}

function queueResultNextAction(output: unknown): HobitNextAction | null {
  const nextAction = recordField(recordValue(output), "nextAction");
  return nextAction ? (nextAction as HobitNextAction) : null;
}

function queueResultNextSuggestedCapability(output: unknown) {
  const root = recordValue(output);
  return firstString([
    stringField(root, "nextSuggestedCapability") ||
      stringField(recordField(root, "item"), "nextSuggestedCapability") ||
      firstString(
        arrayField(root, "createdItems").map((item) =>
          stringField(recordValue(item), "nextSuggestedCapability"),
        ),
      ) ||
      firstString(
        arrayField(root, "items").map((item) =>
          stringField(recordValue(item), "nextSuggestedCapability"),
        ),
      ) ||
      null,
  ]);
}

function workspaceAgentBrokerContinuationSafety(
  output: unknown,
): WorkspaceAgentBrokerContinuationSafety {
  const root = recordValue(output);
  const hidden = recordField(root, "hiddenSideEffectFlags");
  return {
    didDelete:
      booleanField(root, "didDelete") ||
      booleanField(root, "wouldDelete") ||
      booleanField(hidden, "didDelete"),
    didLaunchShell:
      booleanField(root, "didLaunchShell") ||
      booleanField(root, "didLaunchCodexShell") ||
      booleanField(hidden, "didLaunchShell"),
    didMutateGit:
      booleanField(root, "didMutateGit") ||
      booleanField(root, "wouldCallGit") ||
      booleanField(hidden, "didMutateGit"),
    didRollback:
      booleanField(root, "didRollback") ||
      booleanField(root, "wouldRollback") ||
      booleanField(hidden, "didRollback"),
    didRunValidation:
      booleanField(root, "didRunValidation") ||
      booleanField(root, "wouldRunValidation") ||
      booleanField(hidden, "didRunValidation"),
    didStartTerminal:
      booleanField(root, "didStartTerminal") ||
      booleanField(root, "didLaunchTerminal") ||
      booleanField(root, "wouldLaunchTerminal") ||
      booleanField(hidden, "didLaunchTerminal"),
  };
}

function collectTaskIds(
  output: Record<string, unknown> | null,
  nextAction: HobitNextAction | null,
): string[] {
  return compactStringList(
    [
      stringField(recordValue(nextAction?.input), "taskId"),
      stringField(output, "taskId"),
      stringField(output, "queueItemId"),
      stringField(recordField(output, "aggregate"), "taskId"),
      ...stringArrayField(output, "createdTaskIds"),
      stringField(recordField(output, "item"), "taskId"),
      stringField(recordField(output, "lifecycle"), "taskId"),
      ...arrayField(output, "createdItems").map((item) =>
        stringField(recordValue(item), "id"),
      ),
      ...arrayField(output, "items").map((item) =>
        stringField(recordValue(item), "taskId"),
      ),
    ],
    ID_LIMIT,
  );
}

function collectExecutorWidgetIds(
  output: Record<string, unknown> | null,
  nextAction: HobitNextAction | null,
): string[] {
  return compactStringList(
    [
      stringField(recordValue(nextAction?.input), "executorWidgetId"),
      stringField(output, "executorWidgetId"),
      stringField(recordField(output, "queueLinkedMetadata"), "executorWidgetId"),
      stringField(recordField(output, "item"), "assignedExecutorWidgetId"),
      ...arrayField(output, "availableExecutors").map((item) =>
        stringField(recordValue(item), "executorWidgetId"),
      ),
      ...arrayField(output, "items").map((item) =>
        stringField(recordValue(item), "assignedExecutorWidgetId"),
      ),
    ],
    ID_LIMIT,
  );
}

function collectEvidenceBundleIds(
  output: Record<string, unknown> | null,
  nextAction: HobitNextAction | null,
): string[] {
  return compactStringList(
    [
      stringField(recordValue(nextAction?.input), "evidenceBundleId"),
      stringField(output, "evidenceBundleId"),
      stringField(recordField(output, "backendEvidenceBundle"), "bundleId"),
      stringField(recordField(output, "evidenceBundle"), "bundleId"),
    ],
    ID_LIMIT,
  );
}

function collectMessageIds(
  output: Record<string, unknown> | null,
  nextAction: HobitNextAction | null,
): string[] {
  return compactStringList(
    [
      stringField(recordValue(nextAction?.input), "messageId"),
      stringField(output, "messageId"),
      stringField(output, "existingReviewMessageId"),
      stringField(recordField(output, "latestReviewMessage"), "messageId"),
    ],
    ID_LIMIT,
  );
}

function collectBlockers(output: Record<string, unknown> | null): string[] {
  return compactStringList(
    [
      stringField(output, "blockerMessage"),
      ...stringArrayField(output, "blockerReasons"),
      ...blockerMessages(arrayField(output, "blockers")),
      ...blockerMessages(arrayField(recordField(output, "aggregate"), "blockers")),
      ...stringArrayField(recordField(output, "item"), "blockerReasons"),
      ...arrayField(output, "items").flatMap((item) =>
        stringArrayField(recordValue(item), "blockerReasons"),
      ),
      ...arrayField(output, "createdItems").flatMap((item) =>
        stringArrayField(
          recordField(recordValue(item), "readiness"),
          "blockerReasons",
        ),
      ),
    ],
    BLOCKER_LIMIT,
  );
}

function collectQueueState(
  output: Record<string, unknown> | null,
  nextSuggestedCapability: string | null,
): WorkspaceAgentBrokerContinuationQueueState | null {
  const sources = [
    output,
    recordField(output, "aggregate"),
    recordField(output, "item"),
    recordField(output, "lifecycle"),
    recordValue(arrayField(output, "items")[0]),
  ];
  const ticketState = firstStringFromSources(sources, "ticketState");
  const workerRunState = firstStringFromSources(sources, "workerRunState");
  const reviewState = firstStringFromSources(sources, "reviewState");
  const evidenceState = firstStringFromSources(sources, "evidenceState");
  const validationState = firstStringFromSources(sources, "validationState");
  const commitState = firstStringFromSources(sources, "commitState");
  const dependencyState = firstStringFromSources(sources, "dependencyState");
  const latestRun = compactRecordFields(
    firstRecordFieldFromSources(sources, "latestRun"),
    [
      "runId",
      "runLinkId",
      "executorWidgetId",
      "source",
      "status",
      "reviewStatus",
      "validationStatus",
      "startedAt",
      "completedAt",
      "finalDetailAvailable",
    ],
  );
  const evidenceSummary = compactRecordFields(
    firstRecordFieldFromSources(sources, "evidenceSummary"),
    ["available", "source", "summary", "notDurableReason"],
  );
  const durableFlags = compactBooleanRecord(
    firstRecordFieldFromSources(sources, "durableFlags"),
  );
  const blockers = collectBlockers(output);

  if (
    !ticketState &&
    !workerRunState &&
    !reviewState &&
    !evidenceState &&
    !validationState &&
    !commitState &&
    !dependencyState &&
    !latestRun &&
    !evidenceSummary &&
    !durableFlags &&
    blockers.length === 0
  ) {
    return null;
  }

  return {
    blockers,
    commitState,
    dependencyState,
    durableFlags,
    evidenceState,
    evidenceSummary,
    latestRun,
    nextSuggestedCapability,
    reviewState,
    ticketState,
    validationState,
    workerRunState,
  };
}

function blockerMessages(values: readonly unknown[]): string[] {
  return values
    .map((item) => stringField(recordValue(item), "message"))
    .filter((item): item is string => Boolean(item));
}

function firstStringFromSources(
  sources: readonly (Record<string, unknown> | null)[],
  fieldName: string,
) {
  return firstString(sources.map((source) => stringField(source, fieldName)));
}

function firstRecordFieldFromSources(
  sources: readonly (Record<string, unknown> | null)[],
  fieldName: string,
): Record<string, unknown> | null {
  for (const source of sources) {
    const record = recordField(source, fieldName);
    if (record) {
      return record;
    }
  }

  return null;
}

function compactRecordFields(
  record: Record<string, unknown> | null,
  fieldNames: readonly string[],
): Record<string, string | boolean | null> | null {
  if (!record) {
    return null;
  }

  const compacted: Record<string, string | boolean | null> = {};
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (typeof value === "string") {
      compacted[fieldName] = compactText(value, SUMMARY_CHAR_LIMIT);
    } else if (typeof value === "boolean") {
      compacted[fieldName] = value;
    } else if (value === null) {
      compacted[fieldName] = null;
    }
  }

  return Object.keys(compacted).length > 0 ? compacted : null;
}

function compactBooleanRecord(
  record: Record<string, unknown> | null,
): Record<string, boolean> | null {
  if (!record) {
    return null;
  }

  const compacted = Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, boolean] =>
      typeof entry[1] === "boolean",
    ),
  );

  return Object.keys(compacted).length > 0 ? compacted : null;
}

function notDoneMessages(safety: WorkspaceAgentBrokerContinuationSafety) {
  return [
    safety.didRunValidation ? null : "No validation run.",
    safety.didMutateGit ? null : "No Git mutation.",
    safety.didRollback ? null : "No rollback.",
    safety.didDelete ? null : "No delete.",
    safety.didLaunchShell ? null : "No shell command.",
    safety.didStartTerminal ? null : "No Terminal launch.",
  ].filter((item): item is string => Boolean(item));
}

function boundResultContext(
  context: WorkspaceAgentBrokerContinuationResultContext,
): WorkspaceAgentBrokerContinuationResultContext {
  const json = JSON.stringify(context);
  if (json.length <= CONTINUATION_CONTEXT_CHAR_LIMIT) {
    return context;
  }

  return {
    ...context,
    blockers: context.blockers.slice(0, 3),
    notDone: context.notDone.slice(0, 4),
    summary: compactText(context.summary, 120),
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function compactStringList(
  values: readonly (string | null | undefined)[],
  limit: number,
) {
  const seen = new Set<string>();
  const compacted: string[] = [];

  for (const value of values) {
    const compactedValue = compactText(value ?? "", SUMMARY_CHAR_LIMIT);
    if (!compactedValue || seen.has(compactedValue)) {
      continue;
    }

    seen.add(compactedValue);
    compacted.push(compactedValue);
    if (compacted.length >= limit) {
      break;
    }
  }

  return compacted;
}

function compactText(value: string, limit: number): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= limit) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, limit - 3))}...`;
}

function firstString(values: readonly (string | null | undefined)[]) {
  return values.find((value): value is string => Boolean(value?.trim())) ?? null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function recordField(
  value: Record<string, unknown> | null,
  fieldName: string,
): Record<string, unknown> | null {
  return recordValue(value?.[fieldName]);
}

function arrayField(
  value: Record<string, unknown> | null,
  fieldName: string,
): unknown[] {
  const field = value?.[fieldName];
  return Array.isArray(field) ? field : [];
}

function stringField(
  value: Record<string, unknown> | null,
  fieldName: string,
): string | null {
  const field = value?.[fieldName];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function numberField(
  value: Record<string, unknown> | null,
  fieldName: string,
): number | null {
  const field = value?.[fieldName];
  return typeof field === "number" ? field : null;
}

function stringArrayField(
  value: Record<string, unknown> | null,
  fieldName: string,
): string[] {
  const field = value?.[fieldName];
  return Array.isArray(field)
    ? field.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function booleanField(
  value: Record<string, unknown> | null,
  fieldName: string,
): boolean {
  return value?.[fieldName] === true;
}
