import type {
  HobitAgentCapability,
  HobitAgentCapabilityExample,
  HobitAgentCapabilityInputSchema,
} from "./types";

const LIFECYCLE_FORBIDDEN_SIDE_EFFECTS = [
  "backend_durability",
  "storage_schema_change",
  "worker_start",
  "worker_auto_run",
  "queue_autorun",
  "validation_execution",
  "real_commit_execution",
  "git_mutation",
  "rollback_execution",
  "terminal_launch",
  "codex_run",
  "shell_command",
  "duplicate_queue_view",
] as const;

const COMPACT_GUIDANCE = [
  "Use only the documented fields.",
  "queue.lifecycle.get is a backend-authoritative aggregate read and requires taskId.",
  "Write/review/evidence lifecycle capabilities remain transitional frontend/controller overlay operations when dryRun=false.",
  "Dry-run previews must not mutate lifecycle state or create review messages.",
  "Do not run workers, validation, Git, Terminal, rollback, shell, or Codex from these capabilities.",
] as const;

const AGENT_FINISHED_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "outcome",
    "finalAgentMessage",
    "attemptId",
    "threadId",
    "validationSummary",
    "changedFilesSummary",
    "finishedAt",
    "evidenceBundle",
  ],
  fieldDescriptions: {
    attemptId: "Optional current worker attempt id.",
    changedFilesSummary:
      "Optional changed files summary as a string or string array. Overrides evidence summary display when evidenceBundle is supplied.",
    evidenceBundle:
      "Optional normalized Queue worker evidence bundle. Supplies taskId, attemptId, threadId, outcome, finalAgentMessage, validation, changed files, logs, and frontend-only evidence summary.",
    finalAgentMessage:
      "Required final agent report text unless supplied by evidenceBundle. Explicit value overrides bundle display text.",
    finishedAt: "Optional ISO timestamp; broker request time is used by default.",
    outcome:
      "Required agent outcome unless supplied by evidenceBundle. If both are supplied, it must match the evidence bundle outcome.",
    taskId:
      "Required Queue item id unless supplied by evidenceBundle. If both are supplied, it must match the evidence bundle taskId.",
    threadId:
      "Optional worker thread id. If both this and evidenceBundle.threadId are supplied, they must match.",
    validationSummary:
      "Optional validation summary text. Overrides evidence summary display when evidenceBundle is supplied.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId or evidenceBundle.taskId"],
  shape:
    '{"taskId":"string required unless evidenceBundle.taskId","outcome":"completed|not_completed|failed required unless evidenceBundle.outcome","finalAgentMessage":"string required unless evidenceBundle final report/failure/stuck evidence","attemptId":"string optional","threadId":"string optional","evidenceBundle":{"kind":"queue_worker_evidence_bundle","version":1,"taskId":"string","outcome":"completed|not_completed|failed"} optional}',
};

const REVIEW_CREATE_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "messageId",
    "createdAt",
    "attemptId",
    "evidenceBundle",
    "finalAgentMessage",
    "validationSummary",
    "changedFilesSummary",
  ],
  fieldDescriptions: {
    attemptId: "Optional attempt id override.",
    changedFilesSummary:
      "Optional changed files summary as a string or string array.",
    coordinatorAgentId: "Required target coordinator or Workspace Agent id.",
    createdAt: "Optional ISO timestamp; broker request time is used by default.",
    evidenceBundle:
      "Optional normalized Queue worker evidence bundle. Review message uses its bounded product evidence summary when supplied.",
    finalAgentMessage:
      "Optional final report override; current lifecycle report is used by default.",
    messageId: "Optional review message id.",
    taskId: "Required Queue item id.",
    validationSummary: "Optional validation summary override.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","messageId":"string optional","finalAgentMessage":"string optional","validationSummary":"string optional","changedFilesSummary":"string|string[] optional"}',
};

const REVIEW_ACK_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId", "messageId", "coordinatorAgentId", "ackId", "receivedAt"],
  fieldDescriptions: {
    ackId: "Optional ACK id.",
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    messageId: "Required review message id to ACK.",
    receivedAt: "Optional ISO timestamp; broker request time is used by default.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "messageId", "coordinatorAgentId"],
  shape:
    '{"taskId":"string required","messageId":"string required","coordinatorAgentId":"string required","ackId":"string optional"}',
};

const APPROVE_VALIDATION_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "summary",
    "validationApprovalId",
    "approvedAt",
  ],
  fieldDescriptions: {
    approvedAt: "Optional ISO timestamp; broker request time is used by default.",
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    summary: "Optional approval summary.",
    taskId: "Required Queue item id.",
    validationApprovalId: "Optional validation approval id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","summary":"string optional","validationApprovalId":"string optional"}',
};

const FOLLOW_UP_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "prompt",
    "followUpPromptId",
    "createdAt",
    "parentAttemptId",
    "threadId",
  ],
  fieldDescriptions: {
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    createdAt: "Optional ISO timestamp; broker request time is used by default.",
    followUpPromptId: "Optional follow-up prompt id.",
    parentAttemptId: "Optional parent attempt id.",
    prompt: "Required runnable follow-up prompt.",
    taskId: "Required Queue item id.",
    threadId: "Optional thread id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId", "prompt"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","prompt":"string required","followUpPromptId":"string optional","threadId":"string optional"}',
};

const MARK_DONE_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "validationApproved",
    "validationSummary",
    "validationApprovalId",
    "commit",
    "completedAt",
    "decisionId",
    "reason",
  ],
  fieldDescriptions: {
    commit:
      "Optional fake commit metadata object with commitHash, commitTitle, and commitResultId. No Git is executed.",
    completedAt: "Optional ISO timestamp; broker request time is used by default.",
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    decisionId: "Optional done decision id.",
    reason: "Optional coordinator acceptance reason.",
    taskId: "Required Queue item id.",
    validationApprovalId: "Optional validation approval id.",
    validationApproved: "Required true validation approval marker.",
    validationSummary: "Optional validation approval summary.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId", "validationApproved"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","validationApproved":"true required","commit":{"commitHash":"string optional","commitTitle":"string optional"} optional}',
};

const BLOCK_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "reason",
    "decisionId",
    "blockedAt",
  ],
  fieldDescriptions: {
    blockedAt: "Optional ISO timestamp; broker request time is used by default.",
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    decisionId: "Optional coordinator decision id.",
    reason: "Required visible reason.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId", "reason"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","reason":"string required","decisionId":"string optional","blockedAt":"string optional"}',
};

const FAIL_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "reason",
    "decisionId",
    "failedAt",
  ],
  fieldDescriptions: {
    coordinatorAgentId: "Required coordinator or Workspace Agent id.",
    decisionId: "Optional coordinator decision id.",
    failedAt: "Optional ISO timestamp; broker request time is used by default.",
    reason: "Required visible reason.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "coordinatorAgentId", "reason"],
  shape:
    '{"taskId":"string required","coordinatorAgentId":"string required","reason":"string required","decisionId":"string optional","failedAt":"string optional"}',
};

const GET_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId"],
  fieldDescriptions: {
    taskId: "Required explicit Queue item id. Do not infer it from task title, prompt text, file paths, final message, or natural-language content.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId"],
  shape: '{"taskId":"string required"}',
};

const EVIDENCE_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId"],
  fieldDescriptions: {
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId"],
  shape: '{"taskId":"string required"}',
};

const AGENT_FINISHED_EXAMPLE = {
  attemptId: "attempt-id",
  changedFilesSummary: ["apps/desktop/frontend/src/..."],
  finalAgentMessage: "Implemented the requested changes.",
  outcome: "completed",
  taskId: "task-id",
  validationSummary: "typecheck passed",
} as const;

const AGENT_FINISHED_EVIDENCE_EXAMPLE = {
  evidenceBundle: {
    attemptId: "attempt-id",
    changedFiles: [
      { path: "apps/desktop/frontend/src/workbench/queue/example.ts" },
    ],
    finalAgentMessage: "Implemented the requested changes.",
    kind: "queue_worker_evidence_bundle",
    logReference: "frontend://self-test/logs/attempt-id",
    outcome: "completed",
    taskId: "task-id",
    threadId: "thread-id",
    validationOutputPreview: "typecheck passed",
    validationStatus: "passed",
    validationSummary: "typecheck passed",
    version: 1,
  },
} as const;

const REVIEW_ACK_EXAMPLE = {
  coordinatorAgentId: "workspace-agent",
  messageId: "review-message-id",
  taskId: "task-id",
} as const;

const FOLLOW_UP_EXAMPLE = {
  coordinatorAgentId: "workspace-agent",
  prompt: "Continue in the same thread and fix the failed validation.",
  taskId: "task-id",
} as const;

const MARK_DONE_EXAMPLE = {
  commit: {
    commitHash: "fake-hash",
    commitTitle: "frontend: example",
  },
  coordinatorAgentId: "workspace-agent",
  taskId: "task-id",
  validationApproved: true,
} as const;

export const QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES: HobitAgentCapability[] = [
  lifecycleCapability({
    auditLabel: "Queue lifecycle agent finished",
    description:
      "Record a worker/agent final report and move a running Queue dogfood lifecycle item to awaiting review.",
    examples: [
      envelopeExample(
        "Record agent completion and prepare the item for review.",
        "queue.lifecycle.agentFinished",
        AGENT_FINISHED_EXAMPLE,
      ),
      envelopeExample(
        "Record agent completion from a normalized worker evidence bundle.",
        "queue.lifecycle.agentFinished",
        AGENT_FINISHED_EVIDENCE_EXAMPLE,
      ),
    ],
    id: "queue.lifecycle.agentFinished",
    inputSchema: AGENT_FINISHED_SCHEMA,
    output:
      "Lifecycle transition preview or applied frontend overlay with ticketState awaiting_review.",
    title: "Queue Lifecycle Agent Finished",
  }),
  lifecycleCapability({
    auditLabel: "Queue review message created",
    description:
      "Create or preview a review message from the current awaiting-review Queue dogfood lifecycle item.",
    id: "queue.review.createMessage",
    inputSchema: REVIEW_CREATE_SCHEMA,
    output: "Review message plus unchanged or updated lifecycle overlay.",
    title: "Create Queue Review Message",
  }),
  lifecycleCapability({
    auditLabel: "Queue review acknowledged",
    description:
      "ACK a Queue dogfood lifecycle review message and move the item from awaiting review to in review.",
    examples: [
      envelopeExample(
        "Acknowledge the Queue review message.",
        "queue.review.ack",
        REVIEW_ACK_EXAMPLE,
      ),
    ],
    id: "queue.review.ack",
    inputSchema: REVIEW_ACK_SCHEMA,
    output: "Review ACK plus lifecycle overlay with ticketState in_review.",
    title: "Acknowledge Queue Review",
  }),
  lifecycleCapability({
    auditLabel: "Queue validation approved",
    description:
      "Record a frontend/controller validation approval placeholder for an in-review Queue item without running validation.",
    id: "queue.coordinator.approveValidation",
    inputSchema: APPROVE_VALIDATION_SCHEMA,
    output: "Validation approval placeholder plus lifecycle overlay.",
    title: "Approve Queue Validation",
  }),
  lifecycleCapability({
    auditLabel: "Queue follow-up prompt added",
    description:
      "Add a coordinator follow-up prompt and return the same in-review Queue item to running/additional_prompt_running.",
    examples: [
      envelopeExample(
        "Add a follow-up prompt for the same Queue item.",
        "queue.coordinator.addFollowUpPrompt",
        FOLLOW_UP_EXAMPLE,
      ),
    ],
    id: "queue.coordinator.addFollowUpPrompt",
    inputSchema: FOLLOW_UP_SCHEMA,
    output:
      "Follow-up prompt placeholder plus lifecycle overlay with additionalPromptCount incremented.",
    title: "Add Queue Follow-Up Prompt",
  }),
  lifecycleCapability({
    auditLabel: "Queue item marked done",
    description:
      "Mark an in-review completed Queue dogfood lifecycle item done using validation approval and fake commit metadata only.",
    examples: [
      envelopeExample(
        "Mark a reviewed Queue item done with fake commit metadata.",
        "queue.item.markDone",
        MARK_DONE_EXAMPLE,
      ),
    ],
    id: "queue.item.markDone",
    inputSchema: MARK_DONE_SCHEMA,
    output:
      "Lifecycle overlay with ticketState done and no real Git mutation.",
    title: "Mark Queue Item Done",
  }),
  lifecycleCapability({
    auditLabel: "Queue item blocked",
    description:
      "Block an in-review Queue dogfood lifecycle item with a visible coordinator reason.",
    id: "queue.item.block",
    inputSchema: BLOCK_SCHEMA,
    output: "Lifecycle overlay with ticketState blocked.",
    title: "Block Queue Item",
  }),
  lifecycleCapability({
    auditLabel: "Queue item failed",
    description:
      "Fail an in-review Queue dogfood lifecycle item with a visible coordinator reason.",
    id: "queue.item.fail",
    inputSchema: FAIL_SCHEMA,
    output: "Lifecycle overlay with ticketState failure.",
    title: "Fail Queue Item",
  }),
  lifecycleCapability({
    auditLabel: "Queue lifecycle read",
    description:
      "Read one Queue item lifecycle/effective state from the backend/Tauri authoritative aggregate DTO.",
    id: "queue.lifecycle.get",
    inputSchema: GET_SCHEMA,
    output:
      "Backend aggregate state dimensions, blockers, nextActions, latestRun, evidenceSummary, durable flags, and authoritativeBackendAggregate=true.",
    sideEffectLevel: "read",
    title: "Read Queue Lifecycle",
  }),
  lifecycleCapability({
    auditLabel: "Queue review evidence bundle read",
    description:
      "Read the current frontend/controller review evidence bundle for a Queue dogfood lifecycle item.",
    id: "queue.review.getEvidenceBundle",
    inputSchema: EVIDENCE_SCHEMA,
    output: "Final agent message, validation summary, changed files summary, and review messages.",
    sideEffectLevel: "read",
    title: "Read Queue Review Evidence Bundle",
  }),
];

function lifecycleCapability({
  auditLabel,
  description,
  examples = [],
  id,
  inputSchema,
  output,
  sideEffectLevel = "write",
  title,
}: {
  auditLabel: string;
  description: string;
  examples?: readonly HobitAgentCapabilityExample[];
  id: string;
  inputSchema: HobitAgentCapabilityInputSchema;
  output: string;
  sideEffectLevel?: HobitAgentCapability["sideEffectLevel"];
  title: string;
}): HobitAgentCapability {
  return {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      `hobit.agent.capability.${id}.requested`,
      auditLabel,
    ],
    availability: { status: "available" },
    confirmationRequirement: sideEffectLevel === "read" ? "none" : "recommended",
    defaultForProductActions: true,
    description,
    examples,
    forbiddenSideEffects: [...LIFECYCLE_FORBIDDEN_SIDE_EFFECTS],
    id,
    inputSchema,
    inputSchemaDescription: inputSchema.shape,
    outputSchemaDescription: output,
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel,
    supportsDryRun: true,
    supportsSelfTest: false,
    title,
  };
}

function envelopeExample(
  description: string,
  capabilityId: string,
  input: unknown,
): HobitAgentCapabilityExample {
  return {
    description,
    exampleActionRequest: {
      capabilityId,
      dryRun: false,
      input,
      requestId: `${capabilityId}:example-1`,
      type: "hobit.action.request",
    },
    exampleInput: input,
  };
}
