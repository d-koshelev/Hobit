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

const BACKEND_REVIEW_FORBIDDEN_SIDE_EFFECTS = [
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

const BACKEND_WORKER_EVIDENCE_FORBIDDEN_SIDE_EFFECTS = [
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
  "Use exact ids returned by typed capability results; do not infer ids from prose, titles, prompts, UI selection, file paths, or final messages.",
  "Use the registered id queue.review.getEvidenceBundle; queue.lifecycle.getEvidenceBundle is not a capability.",
  "queue.lifecycle.get is a backend-authoritative aggregate read and requires taskId.",
  "queue.review.createMessage and queue.review.ack use backend/Tauri review commands and require explicit taskId; ack also requires messageId.",
  "queue.review.createMessage requires durable backend worker evidence. evidenceBundleId is optional exact context; when omitted, the backend selects the latest durable evidence for the explicit taskId/runId and returns the selected evidenceBundleId.",
  "queue.lifecycle.agentFinished uses backend/Tauri worker evidence commands and requires explicit taskId and runId.",
  "queue.review.getEvidenceBundle uses backend/Tauri worker evidence queries and requires explicit taskId.",
  "Review actor fields are trusted context fields; omit coordinatorAgentId unless an exact typed actor id is already available.",
  "queue.item.markDone is a backend/Tauri accepted-completion command. ACK does not mean done; worker completion does not mean done. Use it only after backend aggregate state is in_review with ACKed review and durable evidence.",
  "queue.item.markDone requires top-level confirmationToken=\"operator-confirmed\" after explicit operator confirmation. Prose confirmation is insufficient.",
  "queue.item.fail is a backend/Tauri terminal failure decision. Worker failure evidence does not mean terminal failure; ACK does not mean failure. Use it only after backend aggregate state is in_review with ACKed review and durable evidence.",
  "queue.item.fail requires top-level confirmationToken=\"operator-confirmed\" after explicit operator confirmation plus a visible reason. Prose confirmation is insufficient.",
  "Validation, follow-up, and block lifecycle capabilities remain transitional frontend/controller overlay operations when dryRun=false and are not auto-continuation safe.",
  "Dry-run previews must not mutate lifecycle state or create review messages.",
  "Do not run workers, validation, Git, Terminal, rollback, shell, or Codex from these capabilities.",
] as const;

const AGENT_FINISHED_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "runId",
    "outcome",
    "finalAgentMessage",
    "attemptId",
    "threadId",
    "validationSummary",
    "changedFilesSummary",
    "finishedAt",
    "evidenceBundle",
    "source",
    "workerId",
  ],
  fieldDescriptions: {
    attemptId: "Optional current worker attempt id.",
    changedFilesSummary:
      "Optional changed files summary as a string or string array. Overrides evidence summary display when evidenceBundle is supplied.",
    evidenceBundle:
      "Optional normalized Queue worker evidence bundle. Supplies taskId, runId, attemptId, threadId, outcome, finalAgentMessage, validation, changed files, logs, and evidence summary fields.",
    finalAgentMessage:
      "Required final agent report text unless supplied by evidenceBundle. Explicit value overrides bundle display text.",
    finishedAt: "Optional ISO timestamp; broker request time is used by default.",
    outcome:
      "Required agent outcome unless supplied by evidenceBundle. If both are supplied, it must match the evidence bundle outcome.",
    runId:
      "Required worker run id unless supplied by evidenceBundle.runId. If both are supplied, it must match the evidence bundle runId.",
    source: "Optional worker evidence source label.",
    taskId:
      "Required Queue item id unless supplied by evidenceBundle. If both are supplied, it must match the evidence bundle taskId.",
    threadId:
      "Optional worker thread id. If both this and evidenceBundle.threadId are supplied, they must match.",
    validationSummary:
      "Optional validation summary text. Overrides evidence summary display when evidenceBundle is supplied.",
    workerId: "Optional worker or Workspace Agent id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId or evidenceBundle.taskId", "runId or evidenceBundle.runId"],
  shape:
    '{"taskId":"string required unless evidenceBundle.taskId","runId":"string required unless evidenceBundle.runId","outcome":"completed|not_completed|failed required unless evidenceBundle.outcome","finalAgentMessage":"string required unless evidenceBundle final report/failure/stuck evidence","attemptId":"string optional","threadId":"string optional","evidenceBundle":{"kind":"queue_worker_evidence_bundle","version":1,"taskId":"string","runId":"string","outcome":"completed|not_completed|failed"} optional}',
};

const REVIEW_CREATE_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "coordinatorAgentId",
    "messageId",
    "runId",
    "evidenceBundleId",
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
    coordinatorAgentId:
      "Optional exact actor override only when already available from typed context. Runtime/backend supplies the request actor when omitted.",
    createdAt: "Optional ISO timestamp; broker request time is used by default.",
    evidenceBundle:
      "Optional normalized Queue worker evidence bundle. Review message uses its bounded product evidence summary when supplied.",
    evidenceBundleId:
      "Optional exact durable backend evidence bundle id returned by a typed result. If omitted, backend selects the latest durable evidence for taskId/runId.",
    finalAgentMessage:
      "Optional final report override; current lifecycle report is used by default.",
    messageId: "Optional review message id.",
    runId:
      "Optional exact worker run id returned by a typed result. If supplied, backend validates it against the selected durable evidence.",
    taskId: "Required Queue item id.",
    validationSummary: "Optional validation summary override.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId"],
  shape:
    '{"taskId":"string required","runId":"string optional exact typed id","evidenceBundleId":"string optional exact typed id","coordinatorAgentId":"string optional exact actor only; trusted runtime/backend default when omitted","messageId":"string optional","finalAgentMessage":"string optional","validationSummary":"string optional","changedFilesSummary":"string|string[] optional"}',
};

const REVIEW_ACK_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId", "messageId", "coordinatorAgentId", "ackId", "receivedAt"],
  fieldDescriptions: {
    ackId: "Optional ACK id.",
    coordinatorAgentId:
      "Optional exact actor override only when already available from typed context. Runtime/backend supplies the request actor when omitted.",
    messageId: "Required review message id to ACK.",
    receivedAt: "Optional ISO timestamp; broker request time is used by default.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "messageId"],
  shape:
    '{"taskId":"string required","messageId":"string required","coordinatorAgentId":"string optional exact actor only; trusted runtime/backend default when omitted","ackId":"string optional"}',
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
    "reason",
    "runId",
    "messageId",
    "reviewMessageId",
  ],
  fieldDescriptions: {
    messageId:
      "Optional exact backend review message id returned by typed review results. Prefer reviewMessageId in new requests.",
    reason: "Optional acceptance reason. Does not run validation, Git, rollback, or Terminal.",
    reviewMessageId:
      "Optional exact backend review message id returned by typed review results.",
    runId: "Optional exact worker run id returned by typed backend results.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "top-level confirmationToken"],
  shape:
    '{"taskId":"string required","reason":"string optional","runId":"string optional exact typed id","reviewMessageId":"string optional exact typed id"}; top-level confirmationToken="operator-confirmed" required',
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
    "reason",
    "runId",
    "evidenceBundleId",
    "messageId",
    "reviewMessageId",
  ],
  fieldDescriptions: {
    evidenceBundleId:
      "Optional exact backend evidence bundle id returned by typed results.",
    messageId:
      "Optional exact backend review message id returned by typed review results. Prefer reviewMessageId in new requests.",
    reason: "Required visible failure reason. Does not run validation, Git, rollback, or Terminal.",
    reviewMessageId:
      "Optional exact backend review message id returned by typed review results.",
    runId: "Optional exact worker run id returned by typed backend results.",
    taskId: "Required Queue item id.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId", "reason", "top-level confirmationToken"],
  shape:
    '{"taskId":"string required","reason":"string required","runId":"string optional exact typed id","evidenceBundleId":"string optional exact typed id","reviewMessageId":"string optional exact typed id"}; top-level confirmationToken="operator-confirmed" required',
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
  acceptedFields: ["taskId", "runId"],
  fieldDescriptions: {
    runId: "Optional worker run id to read a specific durable evidence bundle.",
    taskId: "Required explicit Queue item id. Do not infer it from task title, prompt text, file paths, final message, or natural-language content.",
  },
  invalidInputGuidance: COMPACT_GUIDANCE,
  requiredFields: ["taskId"],
  shape: '{"taskId":"string required","runId":"string optional"}',
};

const AGENT_FINISHED_EXAMPLE = {
  attemptId: "attempt-id",
  changedFilesSummary: ["apps/desktop/frontend/src/..."],
  finalAgentMessage: "Implemented the requested changes.",
  outcome: "completed",
  runId: "worker-run-id",
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
    runId: "worker-run-id",
    taskId: "task-id",
    threadId: "thread-id",
    validationOutputPreview: "typecheck passed",
    validationStatus: "passed",
    validationSummary: "typecheck passed",
    version: 1,
  },
} as const;

const REVIEW_ACK_EXAMPLE = {
  messageId: "review-message-id",
  taskId: "task-id",
} as const;

const REVIEW_CREATE_EXAMPLE = {
  taskId: "task-id",
} as const;

const APPROVE_VALIDATION_EXAMPLE = {
  coordinatorAgentId: "workspace-agent",
  summary: "Validation reviewed by the operator.",
  taskId: "task-id",
} as const;

const FOLLOW_UP_EXAMPLE = {
  coordinatorAgentId: "workspace-agent",
  prompt: "Continue in the same thread and fix the failed validation.",
  taskId: "task-id",
} as const;

const MARK_DONE_EXAMPLE = {
  reason: "Operator accepted the ACKed worker evidence.",
  taskId: "task-id",
} as const;

const BLOCK_EXAMPLE = {
  coordinatorAgentId: "workspace-agent",
  reason: "Blocked pending explicit operator input.",
  taskId: "task-id",
} as const;

const FAIL_EXAMPLE = {
  reason: "Operator rejected the ACKed worker evidence.",
  taskId: "task-id",
} as const;

const GET_EXAMPLE = {
  taskId: "task-id",
} as const;

const EVIDENCE_EXAMPLE = {
  runId: "worker-run-id",
  taskId: "task-id",
} as const;

export const QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES: HobitAgentCapability[] = [
  lifecycleCapability({
    auditLabel: "Queue lifecycle agent finished",
    description:
      "Record a worker/agent final report through the backend worker evidence command and move the Queue item to backend awaiting review.",
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
    forbiddenSideEffects: BACKEND_WORKER_EVIDENCE_FORBIDDEN_SIDE_EFFECTS,
    inputSchema: AGENT_FINISHED_SCHEMA,
    output:
      "Backend worker evidence command result with evidenceBundleId, runId, evidenceState, nextActions, blockers, durability, and updated aggregate.",
    title: "Queue Lifecycle Agent Finished",
  }),
  lifecycleCapability({
    auditLabel: "Queue review message created",
    description:
      "Create or preview a backend-owned review message from an awaiting-review Queue item with durable worker evidence. If evidenceBundleId is omitted, backend selects the latest durable evidence for the explicit taskId/runId.",
    examples: [
      envelopeExample(
        "Create a backend review message using trusted actor default.",
        "queue.review.createMessage",
        REVIEW_CREATE_EXAMPLE,
      ),
    ],
    forbiddenSideEffects: BACKEND_REVIEW_FORBIDDEN_SIDE_EFFECTS,
    id: "queue.review.createMessage",
    inputSchema: REVIEW_CREATE_SCHEMA,
    output:
      "Backend review command result with messageId, selected evidenceBundleId/runId, reviewState, nextActions, blockers, durability, updated aggregate, or typed backend blocker states.",
    title: "Create Queue Review Message",
  }),
  lifecycleCapability({
    auditLabel: "Queue review acknowledged",
    description:
      "ACK a backend-owned Queue review message and move the aggregate from review_message_created to in_review.",
    examples: [
      envelopeExample(
        "Acknowledge the Queue review message.",
        "queue.review.ack",
        REVIEW_ACK_EXAMPLE,
      ),
    ],
    forbiddenSideEffects: BACKEND_REVIEW_FORBIDDEN_SIDE_EFFECTS,
    id: "queue.review.ack",
    inputSchema: REVIEW_ACK_SCHEMA,
    output:
      "Backend review command result with messageId, reviewState, nextActions, blockers, durability, and updated aggregate.",
    title: "Acknowledge Queue Review",
  }),
  lifecycleCapability({
    auditLabel: "Queue validation approved",
    description:
      "Record a frontend/controller validation approval placeholder for an in-review Queue item without running validation.",
    examples: [
      envelopeExample(
        "Record a transitional validation approval placeholder.",
        "queue.coordinator.approveValidation",
        APPROVE_VALIDATION_EXAMPLE,
      ),
    ],
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
    confirmationRequirement: "required",
    description:
      "Record backend-owned accepted completion for an in-review ACKed Queue item with durable completed worker evidence. Does not run validation, Git, rollback, Terminal, or workers.",
    examples: [
      envelopeExample(
        "Mark an ACKed Queue item done after explicit structured confirmation.",
        "queue.item.markDone",
        MARK_DONE_EXAMPLE,
      ),
    ],
    forbiddenSideEffects: BACKEND_REVIEW_FORBIDDEN_SIDE_EFFECTS,
    id: "queue.item.markDone",
    inputSchema: MARK_DONE_SCHEMA,
    output:
      "Backend completion command result with durable decision id, ticketState done, reviewState done, nextSuggestedCapability null, blockers on invalid preconditions, and no Git/validation/rollback execution.",
    supportsDryRun: false,
    title: "Mark Queue Item Done",
  }),
  lifecycleCapability({
    auditLabel: "Queue item blocked",
    description:
      "Block an in-review Queue dogfood lifecycle item with a visible coordinator reason.",
    examples: [
      envelopeExample(
        "Block a transitional Queue lifecycle item.",
        "queue.item.block",
        BLOCK_EXAMPLE,
      ),
    ],
    id: "queue.item.block",
    inputSchema: BLOCK_SCHEMA,
    output: "Lifecycle overlay with ticketState blocked.",
    title: "Block Queue Item",
  }),
  lifecycleCapability({
    auditLabel: "Queue item failed",
    confirmationRequirement: "required",
    description:
      "Record backend-owned terminal failure for an in-review ACKed Queue item with durable worker evidence. Does not run validation, Git, rollback, Terminal, or workers.",
    examples: [
      envelopeExample(
        "Fail an ACKed Queue item after explicit structured confirmation.",
        "queue.item.fail",
        FAIL_EXAMPLE,
      ),
    ],
    forbiddenSideEffects: BACKEND_REVIEW_FORBIDDEN_SIDE_EFFECTS,
    id: "queue.item.fail",
    inputSchema: FAIL_SCHEMA,
    output:
      "Backend failure command result with durable decision id, ticketState failure, reviewState failed, nextSuggestedCapability null, blockers on invalid preconditions, and no Git/validation/rollback execution.",
    supportsDryRun: false,
    title: "Fail Queue Item",
  }),
  lifecycleCapability({
    auditLabel: "Queue lifecycle read",
    description:
      "Read one Queue item lifecycle/effective state from the backend/Tauri authoritative aggregate DTO.",
    examples: [
      envelopeExample(
        "Read the backend Queue lifecycle aggregate.",
        "queue.lifecycle.get",
        GET_EXAMPLE,
      ),
    ],
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
      "Read the backend-owned durable worker evidence bundle for a Queue item.",
    examples: [
      envelopeExample(
        "Read the backend worker evidence bundle.",
        "queue.review.getEvidenceBundle",
        EVIDENCE_EXAMPLE,
      ),
    ],
    forbiddenSideEffects: BACKEND_WORKER_EVIDENCE_FORBIDDEN_SIDE_EFFECTS,
    id: "queue.review.getEvidenceBundle",
    inputSchema: EVIDENCE_SCHEMA,
    output: "Backend evidence state, evidenceBundleId, runId, outcome, summary, blockers, nextActions, and updated aggregate when available.",
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
  forbiddenSideEffects = LIFECYCLE_FORBIDDEN_SIDE_EFFECTS,
  confirmationRequirement,
  supportsDryRun = true,
  title,
}: {
  auditLabel: string;
  description: string;
  examples?: readonly HobitAgentCapabilityExample[];
  forbiddenSideEffects?: readonly string[];
  confirmationRequirement?: HobitAgentCapability["confirmationRequirement"];
  id: string;
  inputSchema: HobitAgentCapabilityInputSchema;
  output: string;
  sideEffectLevel?: HobitAgentCapability["sideEffectLevel"];
  supportsDryRun?: boolean;
  title: string;
}): HobitAgentCapability {
  return {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      `hobit.agent.capability.${id}.requested`,
      auditLabel,
    ],
    availability: { status: "available" },
    confirmationRequirement:
      confirmationRequirement ?? (sideEffectLevel === "read" ? "none" : "recommended"),
    defaultForProductActions: true,
    description,
    examples,
    forbiddenSideEffects: [...forbiddenSideEffects],
    id,
    inputSchema,
    inputSchemaDescription: inputSchema.shape,
    outputSchemaDescription: output,
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel,
    supportsDryRun,
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
      ...(capabilityId === "queue.item.markDone" ||
      capabilityId === "queue.item.fail"
        ? { confirmationToken: "operator-confirmed" }
        : {}),
      dryRun: false,
      input,
      requestId: `${capabilityId}:example-1`,
      type: "hobit.action.request",
    },
    exampleInput: input,
  };
}
