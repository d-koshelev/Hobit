import type {
  HobitModuleId,
  ModuleControlSurface,
} from "../modules/moduleControlSurface";
import {
  MODULE_CONTROL_SURFACE_REGISTRY,
  resolveModuleControlSurfaceWorkflow,
} from "../modules/moduleControlSurfaceRegistry";
import { HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE } from "./hobitAgentActionRequestEnvelope";

export const HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE =
  "hobit.workflow.request" as const;

export type HobitAgentWorkflowRequestEnvelope = {
  grant?: unknown;
  inputs?: unknown;
  metadata?: Record<string, unknown>;
  moduleId: HobitModuleId;
  requestId: string;
  type: typeof HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE;
  workflowId: string;
};

export type HobitAgentWorkflowRequestEnvelopeValidationStatus =
  | "available"
  | "workflow_not_declared"
  | "workflow_unavailable";

export type HobitAgentWorkflowRequestEnvelopeValidationResult =
  | {
      fieldPaths: [];
      moduleId: HobitModuleId;
      ok: true;
      reasonCode?: never;
      reasons: [];
      status: "available";
      workflowId: string;
    }
  | {
      fieldPaths: string[];
      moduleId: HobitModuleId;
      ok: false;
      reasonCode: Exclude<
        HobitAgentWorkflowRequestEnvelopeValidationStatus,
        "available"
      >;
      reasons: string[];
      status: Exclude<
        HobitAgentWorkflowRequestEnvelopeValidationStatus,
        "available"
      >;
      workflowId: string;
    };

export type HobitAgentWorkflowRequestEnvelopeIssueCode =
  | "envelope_mixed_request_types"
  | "envelope_must_be_object"
  | "envelope_top_level_array"
  | "invalid_json"
  | "metadata_invalid"
  | "missing_required_field"
  | "multiple_workflow_requests"
  | "unknown_module"
  | "unsupported_type";

export type HobitAgentWorkflowRequestEnvelopeIssue = {
  code: HobitAgentWorkflowRequestEnvelopeIssueCode;
  fieldPath: string;
  message: string;
};

export type HobitAgentWorkflowRequestEnvelopeReadResult =
  | {
      envelope: HobitAgentWorkflowRequestEnvelope;
      source: "direct_json" | "embedded_json" | "fenced_json";
      status: "valid";
      validation: HobitAgentWorkflowRequestEnvelopeValidationResult;
    }
  | {
      issues: HobitAgentWorkflowRequestEnvelopeIssue[];
      message: string;
      reasons: string[];
      status: "invalid";
    }
  | {
      status: "none";
    };

export type HobitAgentWorkflowRequestEnvelopeValidationOptions = {
  moduleSurfaces?: readonly ModuleControlSurface[];
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

type ParsedWorkflowCandidate = {
  source: JsonCandidate["source"];
  value: unknown;
};

export function readHobitAgentWorkflowRequestEnvelope(
  text: string,
  options: HobitAgentWorkflowRequestEnvelopeValidationOptions = {},
): HobitAgentWorkflowRequestEnvelopeReadResult {
  const topLevelArrayValidation = rejectTopLevelStructuredList(text);
  if (topLevelArrayValidation) {
    return topLevelArrayValidation;
  }

  const candidates = collectJsonCandidates(text);
  if (candidates.length === 0) {
    return looksLikePartialWorkflowJson(text)
      ? invalidEnvelope([
          {
            code: "invalid_json",
            fieldPath: "$",
            message: "Workflow request JSON is invalid.",
          },
        ])
      : { status: "none" };
  }

  const parsedCandidates: ParsedWorkflowCandidate[] = [];
  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed.status === "invalid") {
      return parsed;
    }
    if (parsed.status === "parsed") {
      parsedCandidates.push({
        source: candidate.source,
        value: parsed.value,
      });
    }
  }

  const workflowCandidates = parsedCandidates.filter((candidate) =>
    recordHasExactWorkflowType(candidate.value),
  );
  const actionCandidates = parsedCandidates.filter((candidate) =>
    recordHasExactActionType(candidate.value),
  );
  if (workflowCandidates.length > 0 && actionCandidates.length > 0) {
    return invalidEnvelope([
      {
        code: "envelope_mixed_request_types",
        fieldPath: "$.type",
        message:
          "Mixed hobit.action.request and hobit.workflow.request envelopes are not supported. Emit exactly one envelope.",
      },
    ]);
  }

  if (workflowCandidates.length > 1) {
    return invalidEnvelope([
      {
        code: "multiple_workflow_requests",
        fieldPath: "$",
        message:
          "Multiple workflow request envelopes are not supported. Emit exactly one hobit.workflow.request envelope.",
      },
    ]);
  }

  if (workflowCandidates.length === 0) {
    const workflowishCandidate = parsedCandidates.find((candidate) =>
      recordHasWorkflowRequestType(candidate.value),
    );
    if (workflowishCandidate) {
      return invalidEnvelope([
        {
          code: "unsupported_type",
          fieldPath: "$.type",
          message: "Envelope type must be hobit.workflow.request.",
        },
      ]);
    }

    return { status: "none" };
  }

  const candidate = workflowCandidates[0];
  const validation = validateHobitAgentWorkflowRequestEnvelope(
    candidate.value,
    options,
  );
  if (validation.status === "invalid") {
    return validation;
  }

  return {
    envelope: validation.envelope,
    source: candidate.source,
    status: "valid",
    validation: validation.workflowValidation,
  };
}

export function validateHobitAgentWorkflowRequestEnvelope(
  value: unknown,
  options: HobitAgentWorkflowRequestEnvelopeValidationOptions = {},
):
  | {
      envelope: HobitAgentWorkflowRequestEnvelope;
      status: "valid";
      workflowValidation: HobitAgentWorkflowRequestEnvelopeValidationResult;
    }
  | Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "invalid" }> {
  if (!isRecord(value)) {
    return invalidEnvelope([
      {
        code: "envelope_must_be_object",
        fieldPath: "$",
        message: "Envelope must be a JSON object.",
      },
    ]);
  }

  const issues = [
    value.type === HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE
      ? null
      : {
          code: "unsupported_type" as const,
          fieldPath: "$.type",
          message: "Envelope type must be hobit.workflow.request.",
        },
    requiredStringIssue(value.requestId, "requestId"),
    requiredStringIssue(value.moduleId, "moduleId"),
    requiredStringIssue(value.workflowId, "workflowId"),
    metadataIssue(value.metadata),
  ].filter(
    (issue): issue is HobitAgentWorkflowRequestEnvelopeIssue => Boolean(issue),
  );

  if (issues.length > 0) {
    return invalidEnvelope(issues);
  }

  const requestId = trimmedString(value.requestId);
  const moduleId = trimmedString(value.moduleId) as HobitModuleId;
  const workflowId = trimmedString(value.workflowId);
  const resolution = resolveModuleControlSurfaceWorkflow({
    moduleId,
    surfaces: options.moduleSurfaces ?? MODULE_CONTROL_SURFACE_REGISTRY,
    workflowId,
  });
  if (!resolution.ok && resolution.reasonCode === "unknown_module") {
    return invalidEnvelope([
      {
        code: "unknown_module",
        fieldPath: "$.moduleId",
        message: resolution.reasons[0] ?? "Module control surface is not registered.",
      },
    ]);
  }

  const unavailableReasonCode =
    !resolution.ok && resolution.reasonCode === "workflow_unavailable"
      ? "workflow_unavailable"
      : "workflow_not_declared";
  const workflowValidation: HobitAgentWorkflowRequestEnvelopeValidationResult =
    resolution.ok
      ? {
          fieldPaths: [],
          moduleId,
          ok: true,
          reasons: [],
          status: "available",
          workflowId,
        }
      : {
          fieldPaths: ["$.workflowId"],
          moduleId,
          ok: false,
          reasonCode: unavailableReasonCode,
          reasons: resolution.reasons,
          status: unavailableReasonCode,
          workflowId,
        };

  const envelope: HobitAgentWorkflowRequestEnvelope = {
    ...(Object.prototype.hasOwnProperty.call(value, "grant")
      ? { grant: value.grant }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(value, "inputs")
      ? { inputs: value.inputs }
      : {}),
    ...(isRecord(value.metadata)
      ? { metadata: value.metadata }
      : {}),
    moduleId,
    requestId,
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId,
  };

  return {
    envelope,
    status: "valid",
    workflowValidation,
  };
}

function rejectTopLevelStructuredList(
  text: string,
): Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "invalid" }> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.some(
        (item) =>
          recordHasWorkflowRequestType(item) || recordHasExactActionType(item),
      )
    ) {
      return invalidEnvelope([
        {
          code: "envelope_top_level_array",
          fieldPath: "$",
          message:
            "Workflow request arrays are not supported. Emit exactly one hobit.workflow.request envelope.",
        },
      ]);
    }
  } catch {
    return null;
  }

  return null;
}

function collectJsonCandidates(text: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const seen = new Set<string>();
  const trimmed = text.trim();
  const balancedObjects = collectBalancedJsonObjectText(text);

  if (looksLikeJsonObject(trimmed) && balancedObjects.length <= 1) {
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

  for (const objectText of balancedObjects) {
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

function addCandidate(
  candidates: JsonCandidate[],
  seen: Set<string>,
  candidate: JsonCandidate,
) {
  if (seen.has(candidate.text)) {
    return;
  }

  seen.add(candidate.text);
  candidates.push(candidate);
}

function parseJsonCandidate(
  candidate: JsonCandidate,
):
  | { status: "none" }
  | { status: "parsed"; value: unknown }
  | Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "invalid" }> {
  try {
    return {
      status: "parsed",
      value: JSON.parse(candidate.text) as unknown,
    };
  } catch {
    return candidate.treatParseFailureAsInvalid
      ? invalidEnvelope([
          {
            code: "invalid_json",
            fieldPath: "$",
            message: "Workflow request JSON is invalid.",
          },
        ])
      : { status: "none" };
  }
}

function invalidEnvelope(
  issues: readonly HobitAgentWorkflowRequestEnvelopeIssue[],
): Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "invalid" }> {
  return {
    issues: [...issues],
    message: "Invalid Hobit workflow request",
    reasons: issues.map((issue) =>
      issue.fieldPath === "$"
        ? issue.message
        : `${issue.fieldPath}: ${issue.message}`,
    ),
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

function requiredStringIssue(
  value: unknown,
  fieldName: "moduleId" | "requestId" | "workflowId",
): HobitAgentWorkflowRequestEnvelopeIssue | null {
  return typeof value === "string" && value.trim()
    ? null
    : {
        code: "missing_required_field",
        fieldPath: `$.${fieldName}`,
        message: `${fieldName} is required.`,
      };
}

function metadataIssue(
  value: unknown,
): HobitAgentWorkflowRequestEnvelopeIssue | null {
  if (value === undefined || value === null || isRecord(value)) {
    return null;
  }

  return {
    code: "metadata_invalid",
    fieldPath: "$.metadata",
    message: "metadata must be a JSON object.",
  };
}

function looksLikePartialWorkflowJson(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("{") &&
    trimmed.includes(HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE)
  );
}

function looksLikeJsonObject(text: string) {
  return text.startsWith("{") && text.endsWith("}");
}

function isStructuredFenceLanguage(language: string) {
  return (
    language === "json" ||
    language === "hobit-workflow" ||
    language === "hobit-workflow-request" ||
    language === "hobit.workflow.request"
  );
}

function recordHasExactWorkflowType(value: unknown) {
  return (
    isRecord(value) &&
    value.type === HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE
  );
}

function recordHasWorkflowRequestType(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;
  return (
    typeof type === "string" &&
    (type === HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE ||
      type.startsWith("hobit.workflow.") ||
      type === "hobit.queue.workflowRequest")
  );
}

function recordHasExactActionType(value: unknown) {
  return isRecord(value) && value.type === HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE;
}

function trimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
