import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "./agents/broker";
import type { HobitAgentCapability } from "./agents/capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
  validateQueueCapabilityNextAction,
  type QueueCapabilityRiskClass,
  type QueueCapabilityNextAction,
} from "./agents/capabilities/queueCapabilityContracts";

export const WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS = 16;

const CONTINUATION_CONTEXT_CHAR_LIMIT = 2600;
const CONTINUATION_PROMPT_CHAR_LIMIT = 3600;
const SUMMARY_CHAR_LIMIT = 220;
const ID_LIMIT = 8;
const BLOCKER_LIMIT = 6;

const DEFAULT_AUTO_CONTINUATION_RISK_CLASSES = new Set<QueueCapabilityRiskClass>(
  ["read", "setup", "review"],
);

const RESTRICTED_CAPABILITY_IDS = new Set([
  "codex.runTask",
  "workspace.shell.runCommand",
]);

const RESTRICTED_CAPABILITY_PREFIXES = [
  "git.",
  "terminal.",
  "workspace.terminal.",
  "rollback.",
  "validation.",
  "workspace.shell.",
  "codex.",
];

export type WorkspaceAgentBrokerContinuationStopReason =
  | "broker_unavailable"
  | "confirmation_required"
  | "dry_run_required"
  | "failed"
  | "final_prose"
  | "invalid_input"
  | "invalid_or_unsupported_envelope"
  | "max_action_count_reached"
  | "not_allowed_for_auto_continuation"
  | "policy_blocked"
  | "protocol_error"
  | "repeated_request_fingerprint"
  | "repeated_request_id"
  | "restricted_capability"
  | "safety_stop"
  | "thread_unavailable"
  | "unavailable";

export type WorkspaceAgentBrokerContinuationState = {
  actionCount: number;
  chainId: string;
  maxActions: number;
  protocolRepairAttempted: boolean;
  seenRequestFingerprints: readonly string[];
  seenRequestIds: readonly string[];
  workflowGrant: WorkspaceAgentQueueWorkflowGrant | null;
};

export type WorkspaceAgentQueueWorkflowGrant = {
  allowedRiskClasses: readonly QueueCapabilityRiskClass[];
  grantId: string;
  maxActions?: number;
  type: "queue.workflow.grant";
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
  didLaunchShell: boolean;
  didMutateGit: boolean;
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
  nextAction: QueueCapabilityNextAction | null;
  nextSuggestedCapability: string | null;
  notDone: string[];
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
  workflowGrant = null,
}: {
  chainId: string;
  maxActions?: number;
  workflowGrant?: unknown;
}): WorkspaceAgentBrokerContinuationState {
  const structuredGrant = normalizeWorkspaceAgentQueueWorkflowGrant(workflowGrant);
  return {
    actionCount: 0,
    chainId,
    maxActions: structuredGrant?.maxActions
      ? Math.min(maxActions, structuredGrant.maxActions)
      : maxActions,
    protocolRepairAttempted: false,
    seenRequestFingerprints: [],
    seenRequestIds: [],
    workflowGrant: structuredGrant,
  };
}

export function normalizeWorkspaceAgentQueueWorkflowGrant(
  candidate: unknown,
): WorkspaceAgentQueueWorkflowGrant | null {
  if (!recordValue(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  if (record.type !== "queue.workflow.grant") {
    return null;
  }

  const grantId = typeof record.grantId === "string" ? record.grantId.trim() : "";
  const allowedRiskClasses = Array.isArray(record.allowedRiskClasses)
    ? record.allowedRiskClasses.filter(isQueueCapabilityRiskClass)
    : [];
  const maxActions =
    typeof record.maxActions === "number" &&
    Number.isInteger(record.maxActions) &&
    record.maxActions > 0
      ? record.maxActions
      : undefined;

  if (!grantId || allowedRiskClasses.length === 0) {
    return null;
  }

  return {
    allowedRiskClasses: [...new Set(allowedRiskClasses)],
    grantId,
    ...(maxActions ? { maxActions } : {}),
    type: "queue.workflow.grant",
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
  const terminalStatusReason = stopReasonForActionStatus(result.status);
  if (terminalStatusReason) {
    return {
      shouldContinue: false,
      stopReason: terminalStatusReason,
    };
  }

  const capabilityClass = classifyWorkspaceAgentBrokerContinuationCapability(
    capability ?? result.capabilityId,
    state.workflowGrant,
  );
  if (capabilityClass.kind === "restricted") {
    return {
      shouldContinue: false,
      stopReason: "restricted_capability",
    };
  }

  const safety = workspaceAgentBrokerContinuationSafety(result.output);
  if (
    safety.didLaunchShell ||
    safety.didMutateGit ||
    safety.didRunValidation ||
    safety.didStartTerminal
  ) {
    return {
      shouldContinue: false,
      stopReason: "safety_stop",
    };
  }

  if (state.actionCount >= state.maxActions) {
    return {
      shouldContinue: false,
      stopReason: "max_action_count_reached",
    };
  }

  const nextAction = queueResultNextAction(result.output);
  if (nextAction) {
    const validation = validateQueueCapabilityNextAction(nextAction);
    if (!validation.ok) {
      return {
        shouldContinue: false,
        stopReason: "invalid_input",
      };
    }

    const nextCapabilityClass =
      classifyWorkspaceAgentBrokerContinuationCapability(
        nextAction.capabilityId,
        state.workflowGrant,
      );
    if (nextCapabilityClass.kind === "restricted") {
      return {
        shouldContinue: false,
        stopReason: "restricted_capability",
      };
    }
    if (nextAction.requiresConfirmation || nextAction.confirmationRequired) {
      return {
        shouldContinue: false,
        stopReason: "confirmation_required",
      };
    }
    if (!nextAction.autoContinuationSafe) {
      return {
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      };
    }
    if (nextCapabilityClass.kind !== "allowed") {
      return {
        shouldContinue: false,
        stopReason: "not_allowed_for_auto_continuation",
      };
    }

    return { shouldContinue: true };
  }

  if (queueResultHasNextSuggestedCapability(result.output)) {
    return {
      shouldContinue: false,
      stopReason: "not_allowed_for_auto_continuation",
    };
  }

  if (capabilityClass.kind === "allowed") {
    return { shouldContinue: true };
  }

  if (
    capabilityClass.kind === "queue_start_run" &&
    queueStartRunMayContinue(request, result)
  ) {
    return { shouldContinue: true };
  }

  return {
    shouldContinue: false,
    stopReason: "not_allowed_for_auto_continuation",
  };
}

export function classifyWorkspaceAgentBrokerContinuationCapability(
  capabilityOrId: HobitAgentCapability | string,
  workflowGrant: WorkspaceAgentQueueWorkflowGrant | null = null,
):
  | { kind: "allowed"; reason: null }
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
    return { kind: "queue_start_run", reason: null };
  }

  const queueContract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
  if (queueContract) {
    if (
      queueContract.autoContinuationSafe &&
      !queueContract.confirmation.required &&
      riskClassAllowsAutoContinuation(queueContract.riskClass, workflowGrant)
    ) {
      return { kind: "allowed", reason: null };
    }

    return {
      kind: "not_allowed",
      reason: `${capabilityId} risk class ${queueContract.riskClass} is not allowed for broker auto-continuation.`,
    };
  }

  return {
    kind: "not_allowed",
    reason: `${capabilityId} is not allowed for broker auto-continuation.`,
  };
}

function riskClassAllowsAutoContinuation(
  riskClass: QueueCapabilityRiskClass,
  workflowGrant: WorkspaceAgentQueueWorkflowGrant | null,
) {
  return (
    DEFAULT_AUTO_CONTINUATION_RISK_CLASSES.has(riskClass) ||
    Boolean(workflowGrant?.allowedRiskClasses.includes(riskClass))
  );
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

export function createWorkspaceAgentBrokerActionResultContext({
  request,
  result,
  stopReason,
  summary,
}: {
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult;
  stopReason?: WorkspaceAgentBrokerContinuationStopReason;
  summary: string;
}): WorkspaceAgentBrokerContinuationResultContext {
  const output = recordValue(result.output);
  const safety = workspaceAgentBrokerContinuationSafety(result.output);
  const nextAction = queueResultNextAction(result.output);
  const validNextAction =
    nextAction && validateQueueCapabilityNextAction(nextAction).ok
      ? nextAction
      : null;
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
    nextSuggestedCapability,
    notDone: notDoneMessages(safety),
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
      "Do not emit action lists. Use a fresh requestId for each envelope. Do not repeat a previous request id or same capability/input.",
      "Prefer returned nextAction when present. Use nextAction.capabilityId and nextAction.input exactly; do not rename fields.",
      "If nextAction is unavailable, ask or stop with the blocker. Do not guess from nextSuggestedCapability alone.",
      "If the result is blocked, unavailable, confirmation_required, failed, invalid, or policy blocked, stop and report that plainly.",
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
  return stableStringify({
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
    case "failed":
      return "failed";
  }
}

export function stopReasonLabel(
  reason: WorkspaceAgentBrokerContinuationStopReason,
): string {
  switch (reason) {
    case "broker_unavailable":
      return "Action Broker unavailable";
    case "confirmation_required":
      return "confirmation required";
    case "dry_run_required":
      return "dry-run required";
    case "failed":
      return "action failed";
    case "final_prose":
      return "final answer received";
    case "invalid_input":
      return "invalid input";
    case "invalid_or_unsupported_envelope":
      return "invalid or unsupported action envelope";
    case "max_action_count_reached":
      return "maximum action count reached";
    case "not_allowed_for_auto_continuation":
      return "capability is not allowed for auto-continuation";
    case "policy_blocked":
      return "policy blocked";
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

function queueResultNextAction(output: unknown): QueueCapabilityNextAction | null {
  const nextAction = recordField(recordValue(output), "nextAction");
  return nextAction ? (nextAction as QueueCapabilityNextAction) : null;
}

function queueResultHasNextSuggestedCapability(output: unknown) {
  const root = recordValue(output);
  return Boolean(
    stringField(root, "nextSuggestedCapability") ||
      stringField(recordField(root, "item"), "nextSuggestedCapability") ||
      arrayField(root, "createdItems").some((item) =>
        Boolean(stringField(recordValue(item), "nextSuggestedCapability")),
      ) ||
      arrayField(root, "items").some((item) =>
        Boolean(stringField(recordValue(item), "nextSuggestedCapability")),
      ),
  );
}

function workspaceAgentBrokerContinuationSafety(
  output: unknown,
): WorkspaceAgentBrokerContinuationSafety {
  const root = recordValue(output);
  const hidden = recordField(root, "hiddenSideEffectFlags");
  return {
    didLaunchShell:
      booleanField(root, "didLaunchShell") ||
      booleanField(root, "didLaunchCodexShell") ||
      booleanField(hidden, "didLaunchShell"),
    didMutateGit:
      booleanField(root, "didMutateGit") ||
      booleanField(root, "wouldCallGit") ||
      booleanField(hidden, "didMutateGit"),
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
  nextAction: QueueCapabilityNextAction | null,
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
  nextAction: QueueCapabilityNextAction | null,
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
  nextAction: QueueCapabilityNextAction | null,
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
  nextAction: QueueCapabilityNextAction | null,
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
