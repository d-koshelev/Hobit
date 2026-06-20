import type {
  HobitAgentCapabilitySideEffect,
  HobitAgentConfirmationRequirement,
} from "./types";

export const QUEUE_RUN_SANDBOX_VALUES = [
  "read_only",
  "workspace_write",
  "danger_full_access",
] as const;

export const QUEUE_RUN_APPROVAL_POLICY_VALUES = [
  "never",
  "on_request",
  "untrusted",
] as const;

export const QUEUE_START_RUN_CONFIRMATION_FIELD = "confirmationToken" as const;
export const QUEUE_START_RUN_CONFIRMATION_TOKEN =
  "operator-confirmed" as const;

export type QueueCapabilityBacking =
  | "backend_backed"
  | "bridge_backed"
  | "model_preview"
  | "transitional_frontend_overlay";

export type QueueCapabilityRiskClass =
  | "read"
  | "setup"
  | "run_start"
  | "worker_evidence"
  | "review"
  | "final_accept"
  | "terminal_fail"
  | "block"
  | "follow_up"
  | "validation_decision"
  | "forbidden";

export type QueueCapabilityFieldPolicy =
  | "model_required"
  | "model_optional"
  | "model_optional_exact_only"
  | "trusted_context";

export type QueueCapabilityConfirmationContract =
  | {
      field: typeof QUEUE_START_RUN_CONFIRMATION_FIELD;
      required: true;
      value: typeof QUEUE_START_RUN_CONFIRMATION_TOKEN;
    }
  | {
      field: null;
      required: false;
      value: null;
    };

export type QueueCapabilityContract = {
  autoContinuationSafe: boolean;
  backing: QueueCapabilityBacking;
  capabilityId: string;
  confirmation: QueueCapabilityConfirmationContract;
  confirmationRequirement: HobitAgentConfirmationRequirement;
  enumFields: Readonly<Record<string, readonly string[]>>;
  fieldPolicies: Readonly<Record<string, QueueCapabilityFieldPolicy>>;
  implemented: boolean;
  nextSuggestedCapabilities: readonly string[];
  readOnly: boolean;
  registered: true;
  requiredIds: {
    evidenceBundleId: boolean;
    executorWidgetId: boolean;
    messageId: boolean;
    runId: boolean;
    taskId: boolean;
  };
  riskClass: QueueCapabilityRiskClass;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  trustedContextFields: readonly string[];
};

export type QueueCapabilityId = string;

export type QueueCapabilityNextAction = {
  autoContinuationSafe: boolean;
  capabilityId: QueueCapabilityId;
  confirmationRequired?: {
    field: string;
    value: string;
  };
  input: Record<string, unknown>;
  reason?: string;
  requiresConfirmation: boolean;
};

export type QueueCapabilityNextActionValidationResult =
  | {
      ok: true;
      missingRequiredFields: [];
      reasons: [];
    }
  | {
      ok: false;
      missingRequiredFields: string[];
      reasons: string[];
    };

export type QueueCapabilityNextActionBuildResult =
  | {
      nextAction: QueueCapabilityNextAction;
      ok: true;
    }
  | {
      missingRequiredFields: string[];
      ok: false;
      reason: string;
    };

const NO_CONFIRMATION: QueueCapabilityConfirmationContract = {
  field: null,
  required: false,
  value: null,
};

const START_RUN_CONFIRMATION: QueueCapabilityConfirmationContract = {
  field: QUEUE_START_RUN_CONFIRMATION_FIELD,
  required: true,
  value: QUEUE_START_RUN_CONFIRMATION_TOKEN,
};

const NO_IDS = {
  evidenceBundleId: false,
  executorWidgetId: false,
  messageId: false,
  runId: false,
  taskId: false,
} as const;

const RUNTIME_CONTEXT_FIELDS = ["agentId", "requestedAt", "requestId"] as const;
const REVIEW_ACTOR_CONTEXT_FIELDS = [
  ...RUNTIME_CONTEXT_FIELDS,
  "coordinatorAgentId default from request agentId when omitted",
] as const;

export const QUEUE_CAPABILITY_CONTRACT_INVENTORY: readonly QueueCapabilityContract[] =
  [
    queueContract({
      autoContinuationSafe: false,
      backing: "transitional_frontend_overlay",
      capabilityId: "queue.coordinator.addFollowUpPrompt",
      fieldPolicies: {
        coordinatorAgentId: "model_required",
        createdAt: "model_optional",
        followUpPromptId: "model_optional",
        parentAttemptId: "model_optional",
        prompt: "model_required",
        taskId: "model_required",
        threadId: "model_optional",
      },
      requiredIds: { taskId: true },
      riskClass: "follow_up",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "transitional_frontend_overlay",
      capabilityId: "queue.coordinator.approveValidation",
      fieldPolicies: {
        approvedAt: "model_optional",
        coordinatorAgentId: "model_required",
        summary: "model_optional",
        taskId: "model_required",
        validationApprovalId: "model_optional",
      },
      requiredIds: { taskId: true },
      riskClass: "validation_decision",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.createItem",
      confirmationRequirement: "recommended",
      fieldPolicies: {
        description: "model_optional",
        dependsOn: "model_optional",
        id: "model_optional",
        prompt: "model_required",
        source: "model_optional",
        sourceMetadata: "model_optional",
        status: "model_optional",
        title: "model_required",
      },
      nextSuggestedCapabilities: ["queue.item.updateRunSettings"],
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.createItems",
      confirmationRequirement: "recommended",
      fieldPolicies: {
        items: "model_required",
        "items[].description": "model_optional",
        "items[].dependsOn": "model_optional",
        "items[].id": "model_optional",
        "items[].prompt": "model_required",
        "items[].source": "model_optional",
        "items[].sourceMetadata": "model_optional",
        "items[].status": "model_optional",
        "items[].title": "model_required",
        source: "model_optional",
      },
      nextSuggestedCapabilities: ["queue.item.updateRunSettings"],
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.enable",
      confirmationRequirement: "recommended",
      fieldPolicies: {},
      nextSuggestedCapabilities: ["queue.enable", "queue.item.startRun"],
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "bridge_backed",
      capabilityId: "queue.importPromptPack",
      confirmation: START_RUN_CONFIRMATION,
      confirmationRequirement: "required",
      fieldPolicies: {
        fileEntries: "model_optional",
        preview: "model_optional",
        smartQueuePromptPack: "model_optional",
        sourceText: "model_optional",
      },
      nextSuggestedCapabilities: ["queue.item.updateRunSettings"],
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "transitional_frontend_overlay",
      capabilityId: "queue.item.block",
      fieldPolicies: {
        blockedAt: "model_optional",
        coordinatorAgentId: "model_required",
        decisionId: "model_optional",
        reason: "model_required",
        taskId: "model_required",
      },
      requiredIds: { taskId: true },
      riskClass: "block",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "backend_backed",
      capabilityId: "queue.item.fail",
      confirmation: START_RUN_CONFIRMATION,
      confirmationRequirement: "required",
      fieldPolicies: {
        evidenceBundleId: "model_optional_exact_only",
        messageId: "model_optional_exact_only",
        reason: "model_required",
        reviewMessageId: "model_optional_exact_only",
        runId: "model_optional_exact_only",
        taskId: "model_required",
      },
      nextSuggestedCapabilities: [],
      requiredIds: { taskId: true },
      riskClass: "terminal_fail",
      sideEffectLevel: "write",
      trustedContextFields: REVIEW_ACTOR_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "backend_backed",
      capabilityId: "queue.item.markDone",
      confirmation: START_RUN_CONFIRMATION,
      confirmationRequirement: "required",
      fieldPolicies: {
        messageId: "model_optional_exact_only",
        reason: "model_optional",
        reviewMessageId: "model_optional_exact_only",
        runId: "model_optional_exact_only",
        taskId: "model_required",
      },
      nextSuggestedCapabilities: [],
      requiredIds: { taskId: true },
      riskClass: "final_accept",
      sideEffectLevel: "write",
      trustedContextFields: REVIEW_ACTOR_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.item.promoteDraft",
      confirmationRequirement: "recommended",
      fieldPolicies: {
        taskId: "model_required",
      },
      nextSuggestedCapabilities: ["queue.enable", "queue.item.startRun"],
      requiredIds: { taskId: true },
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.item.startRun",
      confirmation: START_RUN_CONFIRMATION,
      confirmationRequirement: "required",
      fieldPolicies: {
        executorWidgetId: "model_required",
        queueId: "model_optional",
        taskId: "model_required",
      },
      requiredIds: { executorWidgetId: true, taskId: true },
      riskClass: "run_start",
      sideEffectLevel: "execute",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.item.updateRunSettings",
      confirmationRequirement: "recommended",
      enumFields: {
        approvalPolicy: QUEUE_RUN_APPROVAL_POLICY_VALUES,
        sandbox: QUEUE_RUN_SANDBOX_VALUES,
      },
      fieldPolicies: {
        approvalPolicy: "model_optional",
        codexExecutable: "model_optional",
        sandbox: "model_optional",
        taskId: "model_required",
        workspaceRoot: "model_optional",
      },
      nextSuggestedCapabilities: [
        "queue.enable",
        "queue.item.promoteDraft",
        "queue.item.startRun",
        "queue.item.updateRunSettings",
      ],
      requiredIds: { taskId: true },
      riskClass: "setup",
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "backend_backed",
      capabilityId: "queue.items.list",
      fieldPolicies: {
        limit: "model_optional",
        taskId: "model_optional",
      },
      nextSuggestedCapabilities: [
        "queue.enable",
        "queue.item.promoteDraft",
        "queue.item.startRun",
        "queue.item.updateRunSettings",
        "queue.review.ack",
        "queue.review.createMessage",
      ],
      readOnly: true,
      riskClass: "read",
      sideEffectLevel: "read",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "backend_backed",
      capabilityId: "queue.lifecycle.agentFinished",
      enumFields: {
        outcome: ["completed", "not_completed", "failed"],
      },
      fieldPolicies: {
        attemptId: "model_optional",
        changedFilesSummary: "model_optional",
        evidenceBundle: "model_optional",
        finalAgentMessage: "model_required",
        finishedAt: "model_optional",
        outcome: "model_required",
        runId: "model_required",
        source: "model_optional",
        taskId: "model_required",
        threadId: "model_optional",
        validationSummary: "model_optional",
        workerId: "model_optional",
      },
      nextSuggestedCapabilities: [
        "queue.lifecycle.get",
        "queue.review.createMessage",
        "queue.review.getEvidenceBundle",
      ],
      requiredIds: { runId: true, taskId: true },
      riskClass: "worker_evidence",
      sideEffectLevel: "write",
      trustedContextFields: RUNTIME_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "backend_backed",
      capabilityId: "queue.lifecycle.get",
      fieldPolicies: {
        taskId: "model_required",
      },
      nextSuggestedCapabilities: [
        "queue.enable",
        "queue.item.promoteDraft",
        "queue.item.startRun",
        "queue.item.updateRunSettings",
        "queue.review.ack",
        "queue.review.createMessage",
        "queue.review.getEvidenceBundle",
      ],
      readOnly: true,
      requiredIds: { taskId: true },
      riskClass: "read",
      sideEffectLevel: "read",
      trustedContextFields: RUNTIME_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "model_preview",
      capabilityId: "queue.preparePromptPackPreview",
      fieldPolicies: {
        fileEntries: "model_optional",
        preview: "model_optional",
        smartQueuePromptPack: "model_optional",
        sourceText: "model_optional",
      },
      nextSuggestedCapabilities: ["queue.importPromptPack"],
      readOnly: true,
      riskClass: "read",
      sideEffectLevel: "read",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "backend_backed",
      capabilityId: "queue.review.ack",
      fieldPolicies: {
        ackId: "model_optional",
        coordinatorAgentId: "model_optional_exact_only",
        messageId: "model_required",
        receivedAt: "model_optional",
        taskId: "model_required",
      },
      nextSuggestedCapabilities: ["queue.lifecycle.get"],
      requiredIds: { messageId: true, taskId: true },
      riskClass: "review",
      sideEffectLevel: "write",
      trustedContextFields: REVIEW_ACTOR_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "backend_backed",
      capabilityId: "queue.review.createMessage",
      fieldPolicies: {
        attemptId: "model_optional",
        changedFilesSummary: "model_optional",
        coordinatorAgentId: "model_optional_exact_only",
        createdAt: "model_optional",
        evidenceBundleId: "model_optional_exact_only",
        evidenceBundle: "model_optional",
        finalAgentMessage: "model_optional",
        messageId: "model_optional",
        runId: "model_optional_exact_only",
        taskId: "model_required",
        validationSummary: "model_optional",
      },
      nextSuggestedCapabilities: ["queue.review.ack"],
      requiredIds: { taskId: true },
      riskClass: "review",
      sideEffectLevel: "write",
      trustedContextFields: REVIEW_ACTOR_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "backend_backed",
      capabilityId: "queue.review.getEvidenceBundle",
      fieldPolicies: {
        runId: "model_optional",
        taskId: "model_required",
      },
      nextSuggestedCapabilities: [
        "queue.lifecycle.get",
        "queue.review.createMessage",
      ],
      readOnly: true,
      requiredIds: { taskId: true },
      riskClass: "read",
      sideEffectLevel: "read",
      trustedContextFields: RUNTIME_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "model_preview",
      capabilityId: "queue.selfTest",
      fieldPolicies: {},
      readOnly: true,
      riskClass: "read",
      sideEffectLevel: "read",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.targetSingletonQueue",
      fieldPolicies: {},
      readOnly: true,
      riskClass: "read",
      sideEffectLevel: "read",
    }),
  ] as const;

export const QUEUE_CAPABILITY_CONTRACT_BY_ID = new Map(
  QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => [
    contract.capabilityId,
    contract,
  ]),
);

export function buildQueueCapabilityNextAction({
  autoContinuationSafe,
  capabilityId,
  input,
  reason,
}: {
  autoContinuationSafe?: boolean;
  capabilityId: QueueCapabilityId;
  input: Record<string, unknown>;
  reason?: string;
}): QueueCapabilityNextActionBuildResult {
  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
  if (!contract) {
    return {
      missingRequiredFields: [],
      ok: false,
      reason: `Queue nextAction capability is not registered: ${capabilityId}.`,
    };
  }

  const requiresConfirmation = contract.confirmation.required;
  const nextAction: QueueCapabilityNextAction = {
    autoContinuationSafe:
      autoContinuationSafe ?? (contract.autoContinuationSafe && !requiresConfirmation),
    capabilityId,
    input,
    ...(contract.confirmation.required && contract.confirmation.field
      ? {
          confirmationRequired: {
            field: contract.confirmation.field,
            value: contract.confirmation.value ?? "",
          },
        }
      : {}),
    ...(reason ? { reason } : {}),
    requiresConfirmation,
  };
  const validation = validateQueueCapabilityNextAction(nextAction);

  return validation.ok
    ? { nextAction, ok: true }
    : {
        missingRequiredFields: validation.missingRequiredFields,
        ok: false,
        reason:
          validation.reasons[0] ??
          `Queue nextAction for ${capabilityId} is not schema-valid.`,
      };
}

export function validateQueueCapabilityNextAction(
  candidate: unknown,
): QueueCapabilityNextActionValidationResult {
  if (!isRecord(candidate)) {
    return invalidNextAction([], ["nextAction must be an object."]);
  }

  const capabilityId =
    typeof candidate.capabilityId === "string"
      ? candidate.capabilityId.trim()
      : "";
  if (!capabilityId) {
    return invalidNextAction(["capabilityId"], [
      "nextAction.capabilityId is required.",
    ]);
  }

  const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
  if (!contract) {
    return invalidNextAction([], [
      `nextAction capability is not registered: ${capabilityId}.`,
    ]);
  }

  const input = candidate.input;
  if (!isRecord(input)) {
    return invalidNextAction(["input"], ["nextAction.input must be an object."]);
  }

  const reasons: string[] = [];
  const missingRequiredFields: string[] = [];
  const acceptedInputFields = acceptedInputFieldNames(contract);
  for (const fieldName of Object.keys(input)) {
    if (!acceptedInputFields.has(fieldName)) {
      reasons.push(`${fieldName} is not supported by ${capabilityId}.`);
    }
  }

  for (const fieldName of requiredInputFieldNames(contract)) {
    if (!hasPresentInputValue(input, fieldName)) {
      missingRequiredFields.push(fieldName);
      reasons.push(`${fieldName} is required by ${capabilityId}.`);
    }
  }

  for (const [fieldName, values] of Object.entries(contract.enumFields)) {
    if (Object.prototype.hasOwnProperty.call(input, fieldName)) {
      const value = input[fieldName];
      if (
        value !== null &&
        value !== undefined &&
        (typeof value !== "string" || !values.includes(value))
      ) {
        reasons.push(
          `${fieldName} must be one of ${values.join(", ")} for ${capabilityId}.`,
        );
      }
    }
  }

  const requiresConfirmation = candidate.requiresConfirmation;
  const autoContinuationSafe = candidate.autoContinuationSafe;
  if (typeof requiresConfirmation !== "boolean") {
    reasons.push("nextAction.requiresConfirmation must be a boolean.");
  }
  if (typeof autoContinuationSafe !== "boolean") {
    reasons.push("nextAction.autoContinuationSafe must be a boolean.");
  }
  if (autoContinuationSafe === true && !contract.autoContinuationSafe) {
    reasons.push(`${capabilityId} is not auto-continuation safe.`);
  }
  if (autoContinuationSafe === true && requiresConfirmation === true) {
    reasons.push(
      `${capabilityId} cannot be auto-continuation safe while confirmation is required.`,
    );
  }

  const confirmation = contract.confirmation;
  const confirmationRequired = candidate.confirmationRequired;
  if (confirmation.required) {
    if (requiresConfirmation !== true) {
      reasons.push(`${capabilityId} must declare requiresConfirmation=true.`);
    }
    if (!isRecord(confirmationRequired)) {
      reasons.push(`${capabilityId} must declare confirmationRequired.`);
    } else {
      if (confirmationRequired.field !== confirmation.field) {
        reasons.push(
          `${capabilityId} confirmation field must be ${confirmation.field}.`,
        );
      }
      if (confirmationRequired.value !== confirmation.value) {
        reasons.push(
          `${capabilityId} confirmation value must be ${confirmation.value}.`,
        );
      }
    }
  } else {
    if (requiresConfirmation !== false) {
      reasons.push(`${capabilityId} must declare requiresConfirmation=false.`);
    }
    if (confirmationRequired !== undefined) {
      reasons.push(
        `${capabilityId} must not declare confirmationRequired because no confirmation is required.`,
      );
    }
  }

  return reasons.length === 0
    ? { missingRequiredFields: [], ok: true, reasons: [] }
    : invalidNextAction(missingRequiredFields, reasons);
}

export function queueCapabilityNextActionAgreesWithSuggestion({
  nextAction,
  nextSuggestedCapability,
}: {
  nextAction?: QueueCapabilityNextAction | null;
  nextSuggestedCapability?: string | null;
}): boolean {
  return (
    !nextAction ||
    !nextSuggestedCapability ||
    nextAction.capabilityId === nextSuggestedCapability
  );
}

function queueContract(
  contract: Omit<
    QueueCapabilityContract,
    | "confirmation"
    | "confirmationRequirement"
    | "enumFields"
    | "implemented"
    | "nextSuggestedCapabilities"
    | "readOnly"
    | "registered"
    | "requiredIds"
    | "trustedContextFields"
  > &
    Partial<
      Pick<
        QueueCapabilityContract,
        | "confirmation"
        | "confirmationRequirement"
        | "enumFields"
        | "nextSuggestedCapabilities"
        | "readOnly"
        | "trustedContextFields"
      >
    > & {
      requiredIds?: Partial<QueueCapabilityContract["requiredIds"]>;
    },
): QueueCapabilityContract {
  const sideEffectLevel = contract.sideEffectLevel;
  return {
    ...contract,
    confirmation: contract.confirmation ?? NO_CONFIRMATION,
    confirmationRequirement:
      contract.confirmationRequirement ??
      (sideEffectLevel === "read" ? "none" : "recommended"),
    enumFields: contract.enumFields ?? {},
    implemented: true,
    nextSuggestedCapabilities: contract.nextSuggestedCapabilities ?? [],
    readOnly: contract.readOnly ?? sideEffectLevel === "read",
    registered: true,
    requiredIds: { ...NO_IDS, ...contract.requiredIds },
    trustedContextFields: contract.trustedContextFields ?? [],
  };
}

function invalidNextAction(
  missingRequiredFields: string[],
  reasons: string[],
): QueueCapabilityNextActionValidationResult {
  return {
    missingRequiredFields: [...new Set(missingRequiredFields)],
    ok: false,
    reasons,
  };
}

function acceptedInputFieldNames(contract: QueueCapabilityContract) {
  return new Set(Object.keys(contract.fieldPolicies).map(topLevelFieldName));
}

function requiredInputFieldNames(contract: QueueCapabilityContract) {
  const required = new Set<string>();
  for (const [fieldName, policy] of Object.entries(contract.fieldPolicies)) {
    if (policy === "model_required") {
      required.add(topLevelFieldName(fieldName));
    }
  }
  for (const [fieldName, requiredId] of Object.entries(contract.requiredIds)) {
    if (requiredId) {
      required.add(fieldName);
    }
  }
  return required;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
