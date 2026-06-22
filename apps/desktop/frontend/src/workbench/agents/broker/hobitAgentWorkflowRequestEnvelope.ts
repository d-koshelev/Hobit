import type {
  HobitModuleId,
  ModuleControlSurface,
  ModuleWorkflowReference,
} from "../modules/moduleControlSurface";
import {
  MODULE_CONTROL_SURFACE_REGISTRY,
  resolveModuleControlSurfaceWorkflow,
} from "../modules/moduleControlSurfaceRegistry";
import {
  QUEUE_MODULE_WORKFLOW_IDS,
  validateQueueWorkflowRequest,
  type QueueWorkflowRequestValidationReasonCode,
} from "../modules";
import { HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE } from "./hobitAgentActionRequestEnvelope";
import {
  validateWorkflowGrantAndInputsSplit,
  type WorkflowGrant,
  type WorkflowGrantInputSplitReasonCode,
  type WorkflowInputs,
} from "./workflowGrantInputSplit";

export const HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE =
  "hobit.workflow.request" as const;

export type HobitAgentWorkflowRequestEnvelopeMetadata = Record<
  string,
  unknown
> & {
  workflowRunId?: string;
};

export type HobitAgentWorkflowRequestEnvelope = {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  metadata?: HobitAgentWorkflowRequestEnvelopeMetadata;
  moduleId: HobitModuleId;
  requestId: string;
  type: typeof HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE;
  workflowId: string;
};

export type HobitAgentWorkflowRequestEnvelopeValidationStatus =
  | "available"
  | "workflow_valid_not_executable"
  | "input_validation_deferred"
  | "workflow_not_declared"
  | "workflow_unavailable";

export type HobitAgentWorkflowRequestEnvelopeValidationResult =
  | {
      fieldPaths: [];
      moduleId: HobitModuleId;
      ok: true;
      reasonCode?: never;
      reasons: string[];
      status: "available" | "workflow_valid_not_executable";
      workflowMetadata: ModuleWorkflowReference;
      workflowId: string;
    }
  | {
      fieldPaths: string[];
      moduleId: HobitModuleId;
      ok: false;
      reasonCode: Exclude<
        HobitAgentWorkflowRequestEnvelopeValidationStatus,
        "available" | "workflow_valid_not_executable"
      >;
      reasons: string[];
      status: Exclude<
        HobitAgentWorkflowRequestEnvelopeValidationStatus,
        "available" | "workflow_valid_not_executable"
      >;
      workflowMetadata?: ModuleWorkflowReference;
      workflowId: string;
    };

export type HobitAgentWorkflowRequestEnvelopeIssueCode =
  | "envelope_mixed_request_types"
  | "envelope_must_be_object"
  | "envelope_top_level_array"
  | "invalid_json"
  | QueueWorkflowRequestValidationReasonCode
  | WorkflowGrantInputSplitReasonCode
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

const splitIssueCodes = new Set<HobitAgentWorkflowRequestEnvelopeIssueCode>([
  "invalid_grant_field",
  "invalid_grant_scope",
  "malformed_grant",
  "malformed_inputs",
  "product_input_in_grant",
]);

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

  const splitValidation = validateWorkflowGrantAndInputsSplit(value);
  if (!splitValidation.valid) {
    return invalidEnvelope(
      splitValidation.issues.map((issue) => ({
        code: issue.reasonCode,
        fieldPath: issue.fieldPath,
        message: issue.message,
      })),
    );
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

  if (resolution.workflow && isDeclaredQueueWorkflow(moduleId, workflowId)) {
    const queueValidation = validateQueueWorkflowRequest({
      ...(splitValidation.grant ? { grant: splitValidation.grant } : {}),
      ...(splitValidation.inputs ? { inputs: splitValidation.inputs } : {}),
      moduleId,
      workflowId,
    });

    if (
      !queueValidation.ok &&
      queueValidation.status !== "input_validation_deferred"
    ) {
      return invalidEnvelope(
        queueValidation.issues.map((issue) => ({
          code: issue.reasonCode,
          fieldPath: issue.fieldPath,
          message: issue.message,
        })),
      );
    }

    const workflowValidation: HobitAgentWorkflowRequestEnvelopeValidationResult =
      queueValidation.ok
        ? {
            fieldPaths: [],
            moduleId,
            ok: true,
            reasons: [...queueValidation.reasons],
            status: "workflow_valid_not_executable",
            workflowMetadata: resolution.workflow,
            workflowId,
          }
        : {
            fieldPaths: [...queueValidation.fieldPaths],
            moduleId,
            ok: false,
            reasonCode: "input_validation_deferred",
            reasons: [...queueValidation.reasons],
            status: "input_validation_deferred",
            workflowMetadata: resolution.workflow,
            workflowId,
          };

    return {
      envelope: buildWorkflowRequestEnvelope({
        moduleId,
        requestId,
        value,
        workflowId,
      }),
      status: "valid",
      workflowValidation,
    };
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
          workflowMetadata: resolution.workflow,
          workflowId,
        }
      : {
          fieldPaths: ["$.workflowId"],
          moduleId,
          ok: false,
          reasonCode: unavailableReasonCode,
          reasons: resolution.reasons,
          status: unavailableReasonCode,
          ...(resolution.workflow
            ? { workflowMetadata: resolution.workflow }
            : {}),
          workflowId,
        };

  return {
    envelope: buildWorkflowRequestEnvelope({
      moduleId,
      requestId,
      value,
      workflowId,
    }),
    status: "valid",
    workflowValidation,
  };
}

function buildWorkflowRequestEnvelope({
  moduleId,
  requestId,
  value,
  workflowId,
}: {
  moduleId: HobitModuleId;
  requestId: string;
  value: Record<string, unknown>;
  workflowId: string;
}): HobitAgentWorkflowRequestEnvelope {
  const hasGrant = Object.prototype.hasOwnProperty.call(value, "grant");
  const hasInputs = Object.prototype.hasOwnProperty.call(value, "inputs");

  return {
    ...(hasGrant ? { grant: value.grant as WorkflowGrant } : {}),
    ...(hasInputs ? { inputs: value.inputs as WorkflowInputs } : {}),
    ...(isRecord(value.metadata)
      ? {
          metadata:
            value.metadata as HobitAgentWorkflowRequestEnvelopeMetadata,
        }
      : {}),
    moduleId,
    requestId,
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId,
  };
}

function isDeclaredQueueWorkflow(moduleId: HobitModuleId, workflowId: string) {
  return (
    moduleId === "queue" &&
    QUEUE_MODULE_WORKFLOW_IDS.includes(workflowId as never)
  );
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
    reasons: issues.map(issueReason),
    status: "invalid",
  };
}

function issueReason(issue: HobitAgentWorkflowRequestEnvelopeIssue) {
  const message = splitIssueCodes.has(issue.code)
    ? `${issue.code}: ${issue.message}`
    : issue.message;

  return issue.fieldPath === "$" ? message : `${issue.fieldPath}: ${message}`;
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
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return {
      code: "metadata_invalid",
      fieldPath: "$.metadata",
      message: "metadata must be a JSON object.",
    };
  }
  if (
    value.workflowRunId !== undefined &&
    (typeof value.workflowRunId !== "string" || !value.workflowRunId.trim())
  ) {
    return {
      code: "metadata_invalid",
      fieldPath: "$.metadata.workflowRunId",
      message: "metadata.workflowRunId must be a non-empty string when present.",
    };
  }

  return null;
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
