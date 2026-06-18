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
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  trustedContextFields: readonly string[];
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
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.createItem",
      confirmationRequirement: "recommended",
      fieldPolicies: {
        dependencies: "model_optional",
        description: "model_optional",
        id: "model_optional",
        prompt: "model_required",
        source: "model_optional",
        sourceMetadata: "model_optional",
        status: "model_optional",
        title: "model_required",
      },
      nextSuggestedCapabilities: ["queue.item.updateRunSettings"],
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.createItems",
      confirmationRequirement: "recommended",
      fieldPolicies: {
        items: "model_required",
        "items[].dependencies": "model_optional",
        "items[].description": "model_optional",
        "items[].id": "model_optional",
        "items[].prompt": "model_required",
        "items[].source": "model_optional",
        "items[].sourceMetadata": "model_optional",
        "items[].status": "model_optional",
        "items[].title": "model_required",
        source: "model_optional",
      },
      nextSuggestedCapabilities: ["queue.item.updateRunSettings"],
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.enable",
      confirmationRequirement: "recommended",
      fieldPolicies: {},
      nextSuggestedCapabilities: ["queue.enable", "queue.item.startRun"],
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
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "transitional_frontend_overlay",
      capabilityId: "queue.item.fail",
      fieldPolicies: {
        coordinatorAgentId: "model_required",
        decisionId: "model_optional",
        failedAt: "model_optional",
        reason: "model_required",
        taskId: "model_required",
      },
      requiredIds: { taskId: true },
      sideEffectLevel: "write",
    }),
    queueContract({
      autoContinuationSafe: false,
      backing: "transitional_frontend_overlay",
      capabilityId: "queue.item.markDone",
      fieldPolicies: {
        commit: "model_optional",
        completedAt: "model_optional",
        coordinatorAgentId: "model_required",
        decisionId: "model_optional",
        reason: "model_optional",
        taskId: "model_required",
        validationApprovalId: "model_optional",
        validationApproved: "model_required",
        validationSummary: "model_optional",
      },
      requiredIds: { taskId: true },
      sideEffectLevel: "write",
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
      sideEffectLevel: "read",
    }),
    queueContract({
      autoContinuationSafe: false,
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
      sideEffectLevel: "read",
      trustedContextFields: RUNTIME_CONTEXT_FIELDS,
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "model_preview",
      capabilityId: "queue.selfTest",
      fieldPolicies: {},
      readOnly: true,
      sideEffectLevel: "read",
    }),
    queueContract({
      autoContinuationSafe: true,
      backing: "bridge_backed",
      capabilityId: "queue.targetSingletonQueue",
      fieldPolicies: {},
      readOnly: true,
      sideEffectLevel: "read",
    }),
  ] as const;

export const QUEUE_CAPABILITY_CONTRACT_BY_ID = new Map(
  QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => [
    contract.capabilityId,
    contract,
  ]),
);

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
