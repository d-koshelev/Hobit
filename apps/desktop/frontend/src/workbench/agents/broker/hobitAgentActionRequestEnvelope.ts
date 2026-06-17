import { createActionRequest } from "./results";
import type { HobitAgentActionRequest } from "./types";
import type { HobitAgentRoleId } from "../context/types";
import type { HobitAgentId } from "../runtime/hobitMultiAgentRuntime";

export const HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE =
  "hobit.action.request" as const;

export type HobitAgentActionRequestEnvelope = {
  capabilityId: string;
  confirmationToken?: string | null;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  requestId?: string | null;
  type: typeof HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE;
};

export type HobitAgentActionRequestEnvelopeRequestIdSource =
  | "blank"
  | "explicit"
  | "missing";

export type HobitAgentActionRequestEnvelopeReadResult =
  | {
      envelope: HobitAgentActionRequestEnvelope;
      requestIdSource: HobitAgentActionRequestEnvelopeRequestIdSource;
      source: "direct_json" | "embedded_json" | "fenced_json";
      status: "valid";
    }
  | {
      message: string;
      reasons: string[];
      status: "invalid";
    }
  | {
      status: "none";
    };

type JsonCandidate = {
  source: "direct_json" | "embedded_json" | "fenced_json";
  text: string;
  treatParseFailureAsInvalid: boolean;
};

type FencedBlock = {
  body: string;
  language: string;
};

export function readHobitAgentActionRequestEnvelope(
  text: string,
): HobitAgentActionRequestEnvelopeReadResult {
  const actionListValidation = rejectTopLevelActionList(text);
  if (actionListValidation) {
    return actionListValidation;
  }

  const candidates = collectJsonCandidates(text);

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);

    if (parsed.status === "invalid") {
      return parsed;
    }

    if (parsed.status === "none") {
      continue;
    }

    const validation = validateHobitActionRequestEnvelope(parsed.value);
    if (validation.status === "valid") {
      return {
        envelope: validation.envelope,
        requestIdSource: validation.requestIdSource,
        source: candidate.source,
        status: "valid",
      };
    }

    if (recordHasHobitActionType(parsed.value)) {
      return validation;
    }
  }

  return { status: "none" };
}

export function createHobitAgentActionRequestFromEnvelope({
  agentId,
  agentRoleId = "workspace_agent",
  createdAt,
  derivedRequestId,
  envelope,
}: {
  agentId: HobitAgentId;
  agentRoleId?: HobitAgentRoleId;
  createdAt: string;
  derivedRequestId?: string | null;
  envelope: HobitAgentActionRequestEnvelope;
}): HobitAgentActionRequest {
  const explicitRequestId = envelope.requestId?.trim() || null;
  const fallbackRequestId =
    derivedRequestId?.trim() || `${envelope.capabilityId}:workspace-agent-action`;

  return createActionRequest({
    agentId,
    agentRoleId,
    capabilityId: envelope.capabilityId,
    confirmationToken: envelope.confirmationToken ?? null,
    createdAt,
    dryRun: envelope.dryRun,
    input: envelope.input,
    reason: envelope.reason ?? null,
    rawRequestId: envelope.requestId ?? null,
    requestId: explicitRequestId ?? fallbackRequestId,
    requestIdSource: explicitRequestId ? "explicit" : "derived",
  });
}

function collectJsonCandidates(text: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const seen = new Set<string>();
  const trimmed = text.trim();

  if (looksLikeJsonObject(trimmed)) {
    addCandidate(candidates, seen, {
      source: "direct_json",
      text: trimmed,
      treatParseFailureAsInvalid: true,
    });
  }

  for (const block of collectFencedBlocks(text)) {
    const body = block.body.trim();
    if (!body) {
      continue;
    }

    if (isStructuredFenceLanguage(block.language) || looksLikeJsonObject(body)) {
      addCandidate(candidates, seen, {
        source: "fenced_json",
        text: body,
        treatParseFailureAsInvalid: isStructuredFenceLanguage(block.language),
      });
    }
  }

  for (const objectText of collectBalancedJsonObjectText(text)) {
    if (objectText === trimmed) {
      continue;
    }

    addCandidate(candidates, seen, {
      source: "embedded_json",
      text: objectText,
      treatParseFailureAsInvalid: false,
    });
  }

  return candidates;
}

function rejectTopLevelActionList(
  text: string,
): Extract<HobitAgentActionRequestEnvelopeReadResult, { status: "invalid" }> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.some((item) => recordHasHobitActionType(item))
    ) {
      return invalidEnvelope([
        "Action lists are not supported. Emit exactly one hobit.action.request envelope.",
      ]);
    }
  } catch {
    return null;
  }

  return null;
}

function addCandidate(
  candidates: JsonCandidate[],
  seen: Set<string>,
  candidate: JsonCandidate,
) {
  const key = `${candidate.source}:${candidate.text}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  candidates.push(candidate);
}

function parseJsonCandidate(
  candidate: JsonCandidate,
):
  | { status: "none" }
  | { status: "parsed"; value: unknown }
  | { message: string; reasons: string[]; status: "invalid" } {
  try {
    return {
      status: "parsed",
      value: JSON.parse(candidate.text) as unknown,
    };
  } catch {
    return candidate.treatParseFailureAsInvalid
      ? invalidEnvelope(["Envelope JSON is invalid."])
      : { status: "none" };
  }
}

function validateHobitActionRequestEnvelope(
  value: unknown,
): HobitAgentActionRequestEnvelopeReadResult {
  if (!isRecord(value)) {
    return invalidEnvelope(["Envelope must be a JSON object."]);
  }

  const reasons = [
    value.type === HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE
      ? null
      : "Envelope type must be hobit.action.request.",
    requiredString(value.capabilityId, "capabilityId"),
    typeof value.dryRun === "boolean" ? null : "dryRun must be a boolean.",
    Object.prototype.hasOwnProperty.call(value, "input")
      ? null
      : "input is required.",
    optionalString(value.reason, "reason"),
    optionalString(value.requestId, "requestId"),
    optionalString(value.confirmationToken, "confirmationToken"),
  ].filter((reason): reason is string => Boolean(reason));

  if (reasons.length > 0) {
    return invalidEnvelope(reasons);
  }

  const capabilityId =
    typeof value.capabilityId === "string" ? value.capabilityId.trim() : "";
  const dryRun = typeof value.dryRun === "boolean" ? value.dryRun : false;
  const requestIdSource = requestIdSourceForEnvelope(value);

  return {
    envelope: {
      capabilityId,
      confirmationToken: optionalTrimmed(value.confirmationToken),
      dryRun,
      input: value.input,
      reason: optionalTrimmed(value.reason),
      requestId: optionalTrimmed(value.requestId),
      type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
    },
    requestIdSource,
    source: "direct_json",
    status: "valid",
  };
}

function invalidEnvelope(
  reasons: string[],
): Extract<HobitAgentActionRequestEnvelopeReadResult, { status: "invalid" }> {
  return {
    message: "Invalid Hobit action request",
    reasons,
    status: "invalid",
  };
}

function collectFencedBlocks(text: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const fenceStart = text.indexOf("```", searchFrom);
    if (fenceStart < 0) {
      break;
    }

    const contentStart = fenceStart + 3;
    const headerEnd = text.indexOf("\n", contentStart);
    if (headerEnd < 0) {
      break;
    }

    const fenceEnd = text.indexOf("```", headerEnd + 1);
    if (fenceEnd < 0) {
      break;
    }

    blocks.push({
      body: text.slice(headerEnd + 1, fenceEnd),
      language: text.slice(contentStart, headerEnd).trim().toLowerCase(),
    });
    searchFrom = fenceEnd + 3;
  }

  return blocks;
}

function collectBalancedJsonObjectText(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
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
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function looksLikeJsonObject(text: string) {
  return text.startsWith("{") && text.endsWith("}");
}

function isStructuredFenceLanguage(language: string) {
  return (
    language === "json" ||
    language === "hobit-action" ||
    language === "hobit-action-request" ||
    language === "hobit.action.request"
  );
}

function recordHasHobitActionType(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;
  return (
    typeof type === "string" &&
    (type === HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE ||
      type.startsWith("hobit.action."))
  );
}

function requiredString(value: unknown, fieldName: string) {
  return typeof value === "string" && value.trim()
    ? null
    : `${fieldName} is required.`;
}

function optionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? null : `${fieldName} must be a string.`;
}

function optionalTrimmed(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requestIdSourceForEnvelope(
  value: Record<string, unknown>,
): HobitAgentActionRequestEnvelopeRequestIdSource {
  if (!Object.prototype.hasOwnProperty.call(value, "requestId")) {
    return "missing";
  }

  return typeof value.requestId === "string" && value.requestId.trim()
    ? "explicit"
    : "blank";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
