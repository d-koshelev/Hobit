import {
  createHobitAgentCapabilityRegistry,
  findCapability,
} from "../capabilities/registry";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  validateQueueCapabilityNextAction,
} from "../capabilities/queueCapabilityContracts";
import type {
  HobitAgentCapabilityInputSchema,
  HobitAgentCapabilityRegistry,
} from "../capabilities/types";
import type {
  HobitModuleId,
  ModuleControlSurface,
} from "../modules/moduleControlSurface";
import {
  MODULE_CONTROL_SURFACE_REGISTRY,
  resolveModuleControlSurfaceCapability,
} from "../modules/moduleControlSurfaceRegistry";
import type {
  HobitNextAction,
  HobitNextActionSource,
  HobitNextActionUnavailable,
  HobitNextActionUnavailableReasonCode,
  HobitNextActionValidationResult,
} from "./types";

export type HobitNextActionValidationOptions = {
  moduleSurfaces?: readonly ModuleControlSurface[];
  registry?: HobitAgentCapabilityRegistry;
};

const NEXT_ACTION_TOP_LEVEL_FIELDS = new Set([
  "autoContinuationSafe",
  "capabilityId",
  "confirmation",
  "confirmationRequired",
  "input",
  "moduleId",
  "reason",
  "reasonCode",
  "reasonMessage",
  "requiresConfirmation",
  "riskClass",
  "source",
  "targetIds",
]);

const NEXT_ACTION_SOURCES = new Set<HobitNextActionSource>([
  "backend_aggregate",
  "capability_result",
  "policy",
  "workflow_runner",
]);

const TARGET_ID_FIELDS = new Set([
  "evidenceBundleId",
  "executorWidgetId",
  "messageId",
  "runId",
  "taskId",
]);

const CONFIRMATION_METADATA_FIELDS = new Set([
  "required",
  "tokenField",
  "tokenValuePresent",
]);

export function validateHobitNextAction(
  candidate: unknown,
  options: HobitNextActionValidationOptions = {},
): HobitNextActionValidationResult {
  if (!isRecord(candidate)) {
    return invalidNextAction({
      missingRequiredInputs: [],
      reasonCode: "invalid_next_action_payload",
      reasons: ["nextAction must be an object."],
    });
  }

  const topLevelReasons = unsupportedFields(
    candidate,
    NEXT_ACTION_TOP_LEVEL_FIELDS,
    "nextAction",
  );
  const capabilityId =
    typeof candidate.capabilityId === "string"
      ? candidate.capabilityId.trim()
      : "";
  const moduleId =
    typeof candidate.moduleId === "string" && candidate.moduleId.trim()
      ? candidate.moduleId.trim()
      : null;

  if (candidate.moduleId !== undefined && !moduleId) {
    topLevelReasons.push("nextAction.moduleId must be a non-empty string.");
  }
  if (!capabilityId) {
    return invalidNextAction({
      capabilityId: null,
      missingRequiredInputs: ["capabilityId"],
      moduleId,
      reasonCode: "missing_required_input",
      reasons: [
        ...topLevelReasons,
        "nextAction.capabilityId is required.",
      ],
    });
  }

  const registry = options.registry ?? createHobitAgentCapabilityRegistry();
  const capability = findCapability(registry, capabilityId);
  const reasons = [...topLevelReasons];
  const missingRequiredInputs: string[] = [];

  if (!capability) {
    return invalidNextAction({
      capabilityId,
      missingRequiredInputs,
      moduleId,
      reasonCode: "invalid_next_action_payload",
      reasons: [
        ...reasons,
        `nextAction capability is not registered: ${capabilityId}.`,
      ],
    });
  }

  const moduleResolution = resolveModuleControlSurfaceCapability({
    capabilityId,
    moduleId: moduleId as HobitModuleId | null,
    surfaces: options.moduleSurfaces ?? MODULE_CONTROL_SURFACE_REGISTRY,
  });
  if (!moduleResolution.ok) {
    reasons.push(...moduleResolution.reasons);
  }
  const resolvedModuleId = moduleResolution.ok ? moduleResolution.moduleId : moduleId;
  const moduleCapability = moduleResolution.ok
    ? moduleResolution.capability
    : null;

  const input = candidate.input;
  if (!isRecord(input)) {
    missingRequiredInputs.push("input");
    reasons.push("nextAction.input must be an object.");
  } else if (capability.inputSchema) {
    const schemaValidation = validateInputAgainstSchema({
      capabilityId,
      input,
      schema: capability.inputSchema,
    });
    reasons.push(...schemaValidation.reasons);
    missingRequiredInputs.push(...schemaValidation.missingRequiredInputs);
  }

  if (
    candidate.requiresConfirmation !== undefined &&
    typeof candidate.requiresConfirmation !== "boolean"
  ) {
    reasons.push("nextAction.requiresConfirmation must be a boolean.");
  }
  if (
    candidate.autoContinuationSafe !== undefined &&
    typeof candidate.autoContinuationSafe !== "boolean"
  ) {
    reasons.push("nextAction.autoContinuationSafe must be a boolean.");
  }

  const source =
    typeof candidate.source === "string" ? candidate.source : null;
  if (
    candidate.source !== undefined &&
    (!source || !NEXT_ACTION_SOURCES.has(source as HobitNextActionSource))
  ) {
    reasons.push(
      `nextAction.source must be one of ${Array.from(NEXT_ACTION_SOURCES).join(", ")}.`,
    );
  }

  reasons.push(...validateConfirmationMetadata(candidate.confirmation));
  reasons.push(...validateConfirmationRequired(candidate.confirmationRequired));
  reasons.push(...validateTargetIds(candidate.targetIds));

  if (moduleCapability) {
    if (
      candidate.riskClass !== undefined &&
      candidate.riskClass !== moduleCapability.riskClass
    ) {
      reasons.push(
        `nextAction.riskClass must be ${moduleCapability.riskClass} for ${capabilityId}.`,
      );
    }
    const confirmationRequired =
      moduleCapability.confirmation?.required ||
      moduleCapability.confirmationRequirement === "required";
    if (confirmationRequired && candidate.requiresConfirmation !== true) {
      reasons.push(`${capabilityId} must declare requiresConfirmation=true.`);
    }
    if (
      !confirmationRequired &&
      moduleCapability.confirmationRequirement === "none" &&
      candidate.requiresConfirmation === true
    ) {
      reasons.push(`${capabilityId} must not require confirmation.`);
    }
    if (candidate.autoContinuationSafe === true && confirmationRequired) {
      reasons.push(
        `${capabilityId} cannot be auto-continuation safe while confirmation is required.`,
      );
    }
  }

  if (QUEUE_CAPABILITY_CONTRACT_BY_ID.has(capabilityId)) {
    const queueValidation = validateQueueCapabilityNextAction(candidate);
    if (!queueValidation.ok) {
      reasons.push(...queueValidation.reasons);
      missingRequiredInputs.push(...queueValidation.missingRequiredFields);
    }
  }

  return reasons.length === 0
    ? {
        capabilityId,
        missingRequiredInputs: [],
        moduleId: resolvedModuleId ?? null,
        ok: true,
        reasons: [],
      }
    : invalidNextAction({
        capabilityId,
        missingRequiredInputs,
        moduleId: resolvedModuleId ?? null,
        reasonCode: "invalid_next_action_payload",
        reasons,
      });
}

export function hobitNextActionAgreesWithSuggestion({
  nextAction,
  nextSuggestedCapability,
}: {
  nextAction?: HobitNextAction | null;
  nextSuggestedCapability?: string | null;
}): boolean {
  return (
    !nextAction ||
    !nextSuggestedCapability ||
    nextAction.capabilityId === nextSuggestedCapability
  );
}

export function readHobitNextActionUnavailable(
  output: unknown,
): HobitNextActionUnavailable | null {
  const root = recordValue(output);
  const explicit = recordField(root, "nextActionUnavailable");
  if (explicit) {
    const reasonCode = stringField(explicit, "reasonCode");
    const reasonMessage = stringField(explicit, "reasonMessage");
    if (reasonCode && reasonMessage) {
      return compactUnavailable({
        ambiguousCandidateIds: stringArrayField(
          explicit,
          "ambiguousCandidateIds",
        ),
        invalidPayloadReason:
          stringField(explicit, "invalidPayloadReason") ?? undefined,
        missingRequiredInputs: stringArrayField(
          explicit,
          "missingRequiredInputs",
        ),
        reasonCode: reasonCode as HobitNextActionUnavailableReasonCode,
        reasonMessage,
      });
    }
  }

  const legacyReasonCode = stringField(root, "nextActionUnavailableCode");
  const legacyReasonMessage = stringField(root, "nextActionUnavailableReason");
  const missingRequiredInputs = stringArrayField(root, "missingNextActionInput");
  const ambiguousCandidateIds = stringArrayField(root, "candidateTaskIds");
  if (
    legacyReasonCode ||
    legacyReasonMessage ||
    missingRequiredInputs.length > 0 ||
    ambiguousCandidateIds.length > 0
  ) {
    return compactUnavailable({
      ambiguousCandidateIds,
      missingRequiredInputs,
      reasonCode: (legacyReasonCode ??
        (missingRequiredInputs.length > 0
          ? "missing_required_input"
          : "next_action_unavailable")) as HobitNextActionUnavailableReasonCode,
      reasonMessage:
        legacyReasonMessage ??
        "A typed nextAction is unavailable for this result.",
    });
  }

  return null;
}

export function createHobitNextActionUnavailable({
  ambiguousCandidateIds = [],
  invalidPayloadReason,
  missingRequiredInputs = [],
  reasonCode,
  reasonMessage,
}: HobitNextActionUnavailable): HobitNextActionUnavailable {
  return compactUnavailable({
    ambiguousCandidateIds,
    invalidPayloadReason,
    missingRequiredInputs,
    reasonCode,
    reasonMessage,
  });
}

function validateInputAgainstSchema({
  capabilityId,
  input,
  schema,
}: {
  capabilityId: string;
  input: Record<string, unknown>;
  schema: HobitAgentCapabilityInputSchema;
}) {
  const reasons: string[] = [];
  const missingRequiredInputs: string[] = [];
  const acceptedFields = new Set(schema.acceptedFields.map(topLevelFieldName));
  for (const fieldName of Object.keys(input)) {
    if (!acceptedFields.has(fieldName)) {
      reasons.push(`${fieldName} is not supported by ${capabilityId}.`);
    }
  }
  for (const fieldName of schema.requiredFields
    .filter((fieldName) => !fieldName.startsWith("top-level "))
    .map(topLevelFieldName)) {
    if (!hasPresentInputValue(input, fieldName)) {
      missingRequiredInputs.push(fieldName);
      reasons.push(`${fieldName} is required by ${capabilityId}.`);
    }
  }

  return {
    missingRequiredInputs: uniqueStrings(missingRequiredInputs),
    reasons,
  };
}

function validateConfirmationMetadata(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return ["nextAction.confirmation must be an object."];
  }
  const reasons = unsupportedFields(
    value,
    CONFIRMATION_METADATA_FIELDS,
    "nextAction.confirmation",
  );
  if (value.required !== undefined && typeof value.required !== "boolean") {
    reasons.push("nextAction.confirmation.required must be a boolean.");
  }
  if (value.tokenField !== undefined && typeof value.tokenField !== "string") {
    reasons.push("nextAction.confirmation.tokenField must be a string.");
  }
  if (
    value.tokenValuePresent !== undefined &&
    typeof value.tokenValuePresent !== "boolean"
  ) {
    reasons.push(
      "nextAction.confirmation.tokenValuePresent must be a boolean.",
    );
  }
  return reasons;
}

function validateConfirmationRequired(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return ["nextAction.confirmationRequired must be an object."];
  }
  const reasons = unsupportedFields(
    value,
    new Set(["field", "value"]),
    "nextAction.confirmationRequired",
  );
  if (typeof value.field !== "string" || !value.field.trim()) {
    reasons.push("nextAction.confirmationRequired.field must be a string.");
  }
  if (typeof value.value !== "string" || !value.value.trim()) {
    reasons.push("nextAction.confirmationRequired.value must be a string.");
  }
  return reasons;
}

function validateTargetIds(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return ["nextAction.targetIds must be an object."];
  }
  const reasons = unsupportedFields(value, TARGET_ID_FIELDS, "nextAction.targetIds");
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (
      TARGET_ID_FIELDS.has(fieldName) &&
      (typeof fieldValue !== "string" || !fieldValue.trim())
    ) {
      reasons.push(`nextAction.targetIds.${fieldName} must be a string.`);
    }
  }
  return reasons;
}

function unsupportedFields(
  value: Record<string, unknown>,
  acceptedFields: ReadonlySet<string>,
  owner: string,
) {
  return Object.keys(value)
    .filter((fieldName) => !acceptedFields.has(fieldName))
    .map((fieldName) => `${owner}.${fieldName} is not supported.`);
}

function invalidNextAction({
  capabilityId,
  missingRequiredInputs,
  moduleId,
  reasonCode,
  reasons,
}: {
  capabilityId?: string | null;
  missingRequiredInputs: readonly string[];
  moduleId?: string | null;
  reasonCode: HobitNextActionUnavailableReasonCode;
  reasons: readonly string[];
}): HobitNextActionValidationResult {
  const uniqueReasons = uniqueStrings(reasons);
  return {
    ...(capabilityId !== undefined ? { capabilityId } : {}),
    invalidPayloadReason: uniqueReasons[0],
    missingRequiredInputs: uniqueStrings(missingRequiredInputs),
    ...(moduleId !== undefined ? { moduleId } : {}),
    ok: false,
    reasonCode,
    reasons: uniqueReasons,
  };
}

function compactUnavailable({
  ambiguousCandidateIds = [],
  invalidPayloadReason,
  missingRequiredInputs = [],
  reasonCode,
  reasonMessage,
}: HobitNextActionUnavailable): HobitNextActionUnavailable {
  return {
    ...(ambiguousCandidateIds.length > 0
      ? { ambiguousCandidateIds: uniqueStrings(ambiguousCandidateIds) }
      : {}),
    ...(invalidPayloadReason ? { invalidPayloadReason } : {}),
    ...(missingRequiredInputs.length > 0
      ? { missingRequiredInputs: uniqueStrings(missingRequiredInputs) }
      : {}),
    reasonCode,
    reasonMessage,
  };
}

function topLevelFieldName(fieldName: string) {
  const topLevel = fieldName.split(".")[0] ?? fieldName;
  return topLevel.endsWith("[]") ? topLevel.slice(0, -2) : topLevel;
}

function hasPresentInputValue(input: Record<string, unknown>, fieldName: string) {
  if (!Object.prototype.hasOwnProperty.call(input, fieldName)) {
    return false;
  }

  const value = input[fieldName];
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === "string" ? Boolean(value.trim()) : value != null;
}

function recordField(
  value: Record<string, unknown> | null,
  fieldName: string,
): Record<string, unknown> | null {
  return recordValue(value?.[fieldName]);
}

function stringField(value: Record<string, unknown> | null, fieldName: string) {
  const fieldValue = value?.[fieldName];
  return typeof fieldValue === "string" && fieldValue.trim()
    ? fieldValue.trim()
    : null;
}

function stringArrayField(
  value: Record<string, unknown> | null,
  fieldName: string,
) {
  const fieldValue = value?.[fieldName];
  return Array.isArray(fieldValue)
    ? compactStringList(
        fieldValue.map((item) => (typeof item === "string" ? item : null)),
      )
    : [];
}

function compactStringList(values: readonly (string | null | undefined)[]) {
  return uniqueStrings(values.map((value) => value?.trim() ?? "").filter(Boolean));
}

function uniqueStrings<TValue extends string>(values: readonly TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
