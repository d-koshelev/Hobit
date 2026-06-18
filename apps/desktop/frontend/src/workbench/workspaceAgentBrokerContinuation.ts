import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "./agents/broker";
import type { HobitAgentCapability } from "./agents/capabilities";
import { QUEUE_START_RUN_CONFIRMATION_TOKEN } from "./agents/capabilities/queueCapabilityContracts";

export const WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS = 16;

const CONTINUATION_CONTEXT_CHAR_LIMIT = 2600;
const CONTINUATION_PROMPT_CHAR_LIMIT = 3600;
const SUMMARY_CHAR_LIMIT = 220;
const ID_LIMIT = 8;
const BLOCKER_LIMIT = 6;

const AUTO_CONTINUATION_ALLOWED_CAPABILITIES = new Set([
  "queue.targetSingletonQueue",
  "queue.items.list",
  "queue.createItem",
  "queue.createItems",
  "queue.item.updateRunSettings",
  "queue.item.promoteDraft",
  "queue.enable",
  "queue.lifecycle.get",
  "queue.review.getEvidenceBundle",
]);

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
    executorWidgetIds: string[];
    runId: string | null;
    taskIds: string[];
  };
  nextSuggestedCapability: string | null;
  notDone: string[];
  requestId: string;
  safety: WorkspaceAgentBrokerContinuationSafety;
  status: string;
  stopReason?: WorkspaceAgentBrokerContinuationStopReason;
  summary: string;
  type: "hobit.action.result";
};

export function createWorkspaceAgentBrokerContinuationState({
  chainId,
  maxActions = WORKSPACE_AGENT_BROKER_CONTINUATION_MAX_ACTIONS,
}: {
  chainId: string;
  maxActions?: number;
}): WorkspaceAgentBrokerContinuationState {
  return {
    actionCount: 0,
    chainId,
    maxActions,
    protocolRepairAttempted: false,
    seenRequestFingerprints: [],
    seenRequestIds: [],
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

  if (AUTO_CONTINUATION_ALLOWED_CAPABILITIES.has(capabilityId)) {
    return { kind: "allowed", reason: null };
  }

  if (capabilityId === "queue.item.startRun") {
    return { kind: "queue_start_run", reason: null };
  }

  return {
    kind: "not_allowed",
    reason: `${capabilityId} is not allowed for broker auto-continuation.`,
  };
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
      executorWidgetIds: compactStringList(
        collectExecutorWidgetIds(output),
        ID_LIMIT,
      ),
      runId: firstString([
        stringField(output, "runId"),
        stringField(recordField(output, "queueLinkedMetadata"), "runId"),
      ]),
      taskIds: compactStringList(collectTaskIds(output), ID_LIMIT),
    },
    nextSuggestedCapability: firstString([
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
    ]),
    notDone: notDoneMessages(safety),
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
      "Do not emit action lists. Use a fresh requestId for each envelope. Do not repeat a previous request id or same capability/input. Use returned taskIds, executorWidgetIds, runId, blockers, and nextSuggestedCapability.",
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

function collectTaskIds(output: Record<string, unknown> | null): string[] {
  return compactStringList(
    [
      stringField(output, "taskId"),
      stringField(output, "queueItemId"),
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
): string[] {
  return compactStringList(
    [
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

function collectBlockers(output: Record<string, unknown> | null): string[] {
  return compactStringList(
    [
      ...stringArrayField(output, "blockerReasons"),
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
