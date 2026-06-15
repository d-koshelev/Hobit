import {
  createAgentMessage,
  sendAgentMessage,
} from "../messaging";
import {
  getAgentCapabilityManifest,
  getAgentStatus,
  listAgents,
  type HobitAgentRuntimeState,
} from "../runtime";
import {
  createActionResult,
  createNoHiddenSideEffectFlags,
} from "./results";
import type {
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "./types";

export type HobitAgentTestActionHandlerInput = {
  runtimeState: HobitAgentRuntimeState;
};

export function createHobitAgentTestActionHandlers({
  runtimeState,
}: HobitAgentTestActionHandlerInput): HobitAgentActionHandlerMap {
  return {
    "agent.capabilities.read": ({ request }) => {
      const targetAgentId = readStringInput(request.input, "targetAgentId");
      if (!targetAgentId) {
        return invalidHandlerInput(request, "targetAgentId is required.");
      }

      const result = getAgentCapabilityManifest(runtimeState, targetAgentId);
      if (!result.ok) {
        return failedHandlerResult(request, result.error.message);
      }

      return createActionResult({
        auditEvents: [],
        capabilityId: request.capabilityId,
        dryRun: request.dryRun,
        message: `Read capability manifest for ${targetAgentId}.`,
        output: {
          agentId: result.agentId,
          capabilityManifest: result.capabilityManifest,
        },
        requestId: request.requestId,
      });
    },
    "agent.message.send": ({ request }) => {
      const fromAgentId = readStringInput(request.input, "fromAgentId");
      const toAgentId = readStringInput(request.input, "toAgentId");
      const body = readStringInput(request.input, "body");
      if (!fromAgentId || !toAgentId || !body) {
        return invalidHandlerInput(
          request,
          "fromAgentId, toAgentId, and body are required.",
        );
      }

      const message = createAgentMessage({
        body,
        createdAt: request.createdAt,
        fromAgentId,
        kind: "agent",
        messageId:
          readStringInput(request.input, "messageId") ??
          `${request.requestId}:message`,
        threadId: readStringInput(request.input, "threadId") ?? undefined,
        toAgentId,
      });
      const preview = sendAgentMessage({
        histories: runtimeState.histories,
        maxHistoryEvents: runtimeState.maxHistoryEvents,
        message,
        registeredAgentIds: listAgents(runtimeState).map((agent) => agent.agentId),
      });

      if (!preview.ok) {
        return failedHandlerResult(request, preview.error.message);
      }

      return createActionResult({
        auditEvents: [],
        capabilityId: request.capabilityId,
        dryRun: request.dryRun,
        message: `Dry-run message send from ${fromAgentId} to ${toAgentId}.`,
        output: {
          message: preview.message,
          wouldAppendReceiverHistory: true,
          wouldAppendSenderHistory: true,
          wouldSendMessage: true,
        },
        requestId: request.requestId,
      });
    },
    "agent.status.read": ({ request }) => {
      const targetAgentId = readStringInput(request.input, "targetAgentId");
      if (!targetAgentId) {
        return invalidHandlerInput(request, "targetAgentId is required.");
      }

      const result = getAgentStatus(runtimeState, targetAgentId);
      if (!result.ok) {
        return failedHandlerResult(request, result.error.message);
      }

      return createActionResult({
        auditEvents: [],
        capabilityId: request.capabilityId,
        dryRun: request.dryRun,
        message: `Read status for ${targetAgentId}.`,
        output: {
          agentId: result.agentId,
          status: result.status,
        },
        requestId: request.requestId,
      });
    },
    "queue.createItems": ({ request }) => {
      const items = readArrayInput(request.input, "items");

      return createActionResult({
        auditEvents: [],
        capabilityId: request.capabilityId,
        dryRun: request.dryRun,
        message:
          "Dry-run Queue item creation preview. No Queue mutation or worker start is represented.",
        output: {
          wouldAutoRunWorkers: false,
          wouldCreateDuplicateQueueView: false,
          wouldCreateItems: items.length,
          wouldTargetSingletonQueue: true,
        },
        requestId: request.requestId,
      });
    },
  };
}

function failedHandlerResult(
  request: HobitAgentActionRequest,
  message: string,
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    requestId: request.requestId,
    status: "failed",
  });
}

function invalidHandlerInput(
  request: HobitAgentActionRequest,
  message: string,
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    requestId: request.requestId,
    status: "invalid_input",
  });
}

function readStringInput(input: unknown, key: string): string | null {
  if (!isRecord(input) || typeof input[key] !== "string") {
    return null;
  }

  const value = input[key].trim();
  return value ? value : null;
}

function readArrayInput(input: unknown, key: string): unknown[] {
  if (!isRecord(input) || !Array.isArray(input[key])) {
    return [];
  }

  return [...input[key]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
