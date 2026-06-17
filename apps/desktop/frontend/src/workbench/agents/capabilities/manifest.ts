import type {
  HobitAgentCapability,
  HobitAgentCapabilityExample,
  HobitAgentCapabilityInputSchema,
} from "./types";
import { QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES } from "./queueDogfoodLifecycleCapabilityManifest";

const QUEUE_CREATE_ITEM_EXAMPLE_INPUT = {
  prompt: "Review the current workspace state and report one safe next step.",
  status: "draft",
  title: "Test Queue item",
} as const;

const QUEUE_CREATE_ITEMS_EXAMPLE_INPUT = {
  items: [QUEUE_CREATE_ITEM_EXAMPLE_INPUT],
} as const;

const QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS = {
  dependencies:
    "Optional dependency Queue item ids. Use dependencies, not dependsOn.",
  description:
    "Optional display/context description. This does not replace prompt.",
  id: "Optional caller-provided Queue item id.",
  prompt:
    "Required runnable task instruction. This is the task text the future operator or executor will work from.",
  source: "Optional source metadata object for the request.",
  sourceMetadata: "Optional per-item source metadata object.",
  status:
    "Optional initial Queue item status. Use draft for safe placeholders; ready and queued normalize to queued.",
  title: "Required short display title for the Queue item.",
} as const;

const QUEUE_CREATE_ITEM_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "title",
    "prompt",
    "status",
    "description",
    "dependencies",
    "source",
    "sourceMetadata",
    "id",
  ],
  fieldDescriptions: QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS,
  invalidInputGuidance: [
    "Queue item creation requires both title and prompt.",
    "The prompt is the runnable task instruction, not just a display description.",
    "Do not use body, text, content, operatorPrompt, initialState, dependsOn, queueTag, or priority for Queue create action input.",
    "If the user explicitly asks for a test, dummy, or example Queue item, create a safe placeholder prompt.",
    "If the user asks for a real Queue item but does not provide task content, ask a concise clarification instead of emitting an invalid action request.",
    "Do not use shell, Codex, or source-code inspection to invent product action data.",
    "Do not auto-run workers.",
  ],
  requiredFields: ["title", "prompt"],
  shape:
    '{"title":"string required","prompt":"string required","status":"draft|queued|ready optional","description":"string optional","dependencies":"string[] optional","source":"object optional","sourceMetadata":"object optional","id":"string optional"}',
};

const QUEUE_CREATE_ITEMS_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "items",
    "items[].title",
    "items[].prompt",
    "items[].status",
    "items[].description",
    "items[].dependencies",
    "items[].source",
    "items[].sourceMetadata",
    "items[].id",
    "source",
  ],
  fieldDescriptions: {
    items:
      "Required non-empty array of Queue item creation inputs. Every item requires title and prompt.",
    "items[].dependencies":
      QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.dependencies,
    "items[].description": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.description,
    "items[].id": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.id,
    "items[].prompt": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.prompt,
    "items[].source": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.source,
    "items[].sourceMetadata":
      QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.sourceMetadata,
    "items[].status": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.status,
    "items[].title": QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.title,
    source: "Optional batch source metadata object.",
  },
  invalidInputGuidance: QUEUE_CREATE_ITEM_SCHEMA.invalidInputGuidance,
  requiredFields: ["items", "items[].title", "items[].prompt"],
  shape:
    '{"items":[{"title":"string required","prompt":"string required","status":"draft|queued|ready optional","description":"string optional","dependencies":"string[] optional","source":"object optional","sourceMetadata":"object optional","id":"string optional"}],"source":"object optional"}',
};

const QUEUE_CREATE_ITEM_EXAMPLES: HobitAgentCapabilityExample[] = [
  {
    description: "Create one safe test Queue item.",
    exampleActionRequest: {
      capabilityId: "queue.createItem",
      dryRun: false,
      input: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
  },
  {
    description: "Preview one safe test Queue item without mutation.",
    exampleActionRequest: {
      capabilityId: "queue.createItem",
      dryRun: true,
      input: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
  },
];

const QUEUE_CREATE_ITEMS_EXAMPLES: HobitAgentCapabilityExample[] = [
  {
    description: "Create one or more safe test Queue items.",
    exampleActionRequest: {
      capabilityId: "queue.createItems",
      dryRun: false,
      input: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
  },
  {
    description: "Preview one or more safe test Queue items without mutation.",
    exampleActionRequest: {
      capabilityId: "queue.createItems",
      dryRun: true,
      input: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
  },
];

const QUEUE_ITEMS_LIST_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["limit", "taskId"],
  fieldDescriptions: {
    limit: "Optional maximum number of Queue task summaries to return. Range: 1-50.",
    taskId: "Optional explicit Queue task id to read one task.",
  },
  invalidInputGuidance: [
    "Use taskId only when an explicit Queue task id is already available from a prior typed result.",
    "Do not infer taskId from task title, prompt text, file paths, final message, or natural-language content.",
  ],
  requiredFields: [],
  shape: '{"limit":"number optional 1-50","taskId":"string optional"}',
};

const QUEUE_UPDATE_RUN_SETTINGS_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "taskId",
    "codexExecutable",
    "workspaceRoot",
    "sandbox",
    "approvalPolicy",
  ],
  fieldDescriptions: {
    approvalPolicy:
      "Optional Direct Work approval policy. Supported: never, on_request, untrusted.",
    codexExecutable:
      "Optional explicit Codex executable path/name. Empty or whitespace values are invalid.",
    sandbox:
      "Optional Direct Work sandbox. Supported: danger_full_access, read_only, workspace_write.",
    taskId:
      "Required explicit Queue task id from queue.createItem(s) or queue.items.list.",
    workspaceRoot: "Optional explicit execution workspace/root path.",
  },
  invalidInputGuidance: [
    "taskId is required.",
    "At least one run setting must be supplied.",
    "Do not infer taskId from task title, prompt text, file paths, final message, or natural-language content.",
    "This action updates only supplied run settings and does not promote, enable Queue, or start work.",
  ],
  requiredFields: ["taskId"],
  shape:
    '{"taskId":"string required","codexExecutable":"string optional","workspaceRoot":"string optional","sandbox":"danger_full_access|read_only|workspace_write optional","approvalPolicy":"never|on_request|untrusted optional"}',
};

const QUEUE_PROMOTE_DRAFT_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId"],
  fieldDescriptions: {
    taskId:
      "Required explicit Queue task id from queue.createItem(s) or queue.items.list.",
  },
  invalidInputGuidance: [
    "taskId is required.",
    "Only promote when the typed readiness result says the Draft can be promoted.",
    "Do not infer taskId from task title, prompt text, file paths, final message, or natural-language content.",
    "This action queues a valid Draft and does not enable Queue or start work.",
  ],
  requiredFields: ["taskId"],
  shape: '{"taskId":"string required"}',
};

const QUEUE_ENABLE_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [],
  fieldDescriptions: {},
  invalidInputGuidance: [
    "Use an empty input object.",
    "This action enables Queue scheduling state only; it does not create tasks, update readiness, start Queue Autorun, or start Direct Work.",
  ],
  requiredFields: [],
  shape: "{}",
};

const QUEUE_START_RUN_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["taskId", "executorWidgetId", "queueId"],
  fieldDescriptions: {
    executorWidgetId:
      "Required explicit Agent Executor or Queue-owned local executor widget id from queue.items.list.",
    queueId: "Optional singleton Queue target id if already available.",
    taskId:
      "Required explicit Queue task id from queue.createItem(s), queue.items.list, or queue.item.promoteDraft.",
  },
  invalidInputGuidance: [
    "taskId is required.",
    "executorWidgetId is required.",
    "Do not infer taskId or executorWidgetId from task title, prompt text, file paths, final message, or natural-language content.",
    "Use queue.items.list first when ids are missing.",
    "This action starts exactly one explicit Queue-linked Direct Work run and does not run validation, Git, rollback, Terminal, Queue Autorun, or dependent tasks.",
  ],
  requiredFields: ["taskId", "executorWidgetId"],
  shape:
    '{"taskId":"string required","executorWidgetId":"string required","queueId":"string optional"}',
};

const QUEUE_RUN_CONTROL_EXAMPLES: Record<string, HobitAgentCapabilityExample[]> = {
  "queue.enable": [
    {
      description: "Enable Queue scheduling state without starting a task.",
      exampleActionRequest: {
        capabilityId: "queue.enable",
        dryRun: false,
        input: {},
        type: "hobit.action.request",
      },
      exampleInput: {},
    },
  ],
  "queue.item.promoteDraft": [
    {
      description: "Promote one readiness-valid Draft Queue task.",
      exampleActionRequest: {
        capabilityId: "queue.item.promoteDraft",
        dryRun: false,
        input: { taskId: "queue-task-id" },
        type: "hobit.action.request",
      },
      exampleInput: { taskId: "queue-task-id" },
    },
  ],
  "queue.item.startRun": [
    {
      description: "Start one explicit Queue-linked Direct Work run.",
      exampleActionRequest: {
        capabilityId: "queue.item.startRun",
        confirmationToken: "operator-confirmed",
        dryRun: false,
        input: {
          executorWidgetId: "executor-widget-id",
          taskId: "queue-task-id",
        },
        type: "hobit.action.request",
      },
      exampleInput: {
        executorWidgetId: "executor-widget-id",
        taskId: "queue-task-id",
      },
    },
  ],
  "queue.item.updateRunSettings": [
    {
      description: "Set Queue task Direct Work run settings.",
      exampleActionRequest: {
        capabilityId: "queue.item.updateRunSettings",
        dryRun: false,
        input: {
          approvalPolicy: "on_request",
          codexExecutable: "codex.cmd",
          sandbox: "workspace_write",
          taskId: "queue-task-id",
          workspaceRoot: "C:/path/to/workspace",
        },
        type: "hobit.action.request",
      },
      exampleInput: {
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        sandbox: "workspace_write",
        taskId: "queue-task-id",
        workspaceRoot: "C:/path/to/workspace",
      },
    },
  ],
  "queue.items.list": [
    {
      description: "List bounded Queue task summaries and explicit ids.",
      exampleActionRequest: {
        capabilityId: "queue.items.list",
        dryRun: false,
        input: { limit: 25 },
        type: "hobit.action.request",
      },
      exampleInput: { limit: 25 },
    },
  ],
};

export const HOBIT_AGENT_INITIAL_CAPABILITIES: HobitAgentCapability[] = [
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.createItem.requested",
      "queue.itemCreated",
    ],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Create one Queue item through the typed in-app singleton Workspace Queue API.",
    forbiddenSideEffects: [
      "duplicate_queue_view",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.createItem",
    inputSchemaDescription:
      "Queue item title and runnable prompt are required. Optional fields: status, description, dependencies, source, sourceMetadata, id.",
    inputSchema: QUEUE_CREATE_ITEM_SCHEMA,
    examples: QUEUE_CREATE_ITEM_EXAMPLES,
    outputSchemaDescription:
      "Structured Queue action result with created item snapshot and Queue events.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Create Queue Item",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.createItems.requested",
      "queue.itemCreated",
    ],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Create multiple Queue items through typed in-app Queue APIs targeting the singleton Workspace Queue.",
    forbiddenSideEffects: [
      "duplicate_queue_view",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.createItems",
    inputSchemaDescription:
      "A non-empty items array is required. Every item requires title and runnable prompt. Optional item fields: status, description, dependencies, source, sourceMetadata, id.",
    inputSchema: QUEUE_CREATE_ITEMS_SCHEMA,
    examples: QUEUE_CREATE_ITEMS_EXAMPLES,
    outputSchemaDescription:
      "Structured batch result with created Queue item snapshots, dependency link results, warnings, and Queue events.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Create Queue Items",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.items.list.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read bounded singleton Workspace Queue task summaries with explicit task ids, readiness, blockers, and available executor ids.",
    forbiddenSideEffects: [
      "queue_mutation",
      "queue_item_create",
      "duplicate_queue_view",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "queue.items.list",
    inputSchemaDescription:
      "Optional limit and optional explicit taskId. Returns bounded product-facing task summaries, not raw internal JSON.",
    inputSchema: QUEUE_ITEMS_LIST_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.items.list"],
    outputSchemaDescription:
      "Bounded Queue task summaries with taskId, title, status, readiness, blockers, and available executor widget ids.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "List Queue Items",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.item.updateRunSettings.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Update only supplied Direct Work run settings on one explicit Queue task id through the typed Queue update path.",
    forbiddenSideEffects: [
      "queue_item_create",
      "queue_status_promotion",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "queue.item.updateRunSettings",
    inputSchemaDescription:
      "taskId is required. Optional supplied settings: codexExecutable, workspaceRoot, sandbox, approvalPolicy.",
    inputSchema: QUEUE_UPDATE_RUN_SETTINGS_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.item.updateRunSettings"],
    outputSchemaDescription:
      "Updated task readiness summary with applied fields and next suggested typed capability.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Update Queue Run Settings",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.item.promoteDraft.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Promote one explicit readiness-valid Draft Queue task to queued through the existing Queue update path.",
    forbiddenSideEffects: [
      "queue_item_create",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
      "dogfood_review_lifecycle_mutation",
    ],
    id: "queue.item.promoteDraft",
    inputSchemaDescription: "taskId is required.",
    inputSchema: QUEUE_PROMOTE_DRAFT_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.item.promoteDraft"],
    outputSchemaDescription:
      "Task readiness summary after promotion or product-facing readiness blockers.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Promote Queue Draft",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.enable.requested"],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Enable singleton Workspace Queue scheduling state through existing Queue controls without starting Direct Work or Queue Autorun.",
    forbiddenSideEffects: [
      "queue_item_create",
      "queue_item_update",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "queue.enable",
    inputSchemaDescription: "No input fields. Use an empty object.",
    inputSchema: QUEUE_ENABLE_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.enable"],
    outputSchemaDescription:
      "Queue enabled state plus blockers. This action reports didStartWorkers=false and didAutoRunWorkers=false.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Enable Queue",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.item.startRun.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "required",
    defaultForProductActions: true,
    description:
      "Start exactly one explicit Queue-linked Direct Work run for a supplied taskId and executorWidgetId through existing assigned-task start plumbing.",
    forbiddenSideEffects: [
      "task_id_inference",
      "executor_id_inference",
      "raw_codex_run_fallback",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
      "dependent_start",
      "auto_review_action",
      "queue_autorun",
    ],
    id: "queue.item.startRun",
    inputSchemaDescription:
      "taskId and executorWidgetId are required. queueId is optional when already available.",
    inputSchema: QUEUE_START_RUN_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.item.startRun"],
    outputSchemaDescription:
      "Direct Work run id, Queue task id, executor widget id, and Queue-linked metadata on success; blockers otherwise.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "execute",
    supportsDryRun: false,
    supportsSelfTest: true,
    title: "Start Queue Task Run",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.preparePromptPackPreview.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Build a prompt-pack preview and Smart Queue materialization without creating Queue items.",
    forbiddenSideEffects: [
      "queue_item_create",
      "duplicate_queue_view",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.preparePromptPackPreview",
    inputSchemaDescription:
      "Explicit prompt-pack source text or typed prompt-pack entries supplied by the operator.",
    outputSchemaDescription:
      "Prompt-pack preview with selected items, validation diagnostics, and Smart Queue materialization.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Prepare Prompt-Pack Preview",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.importPromptPack.requested",
      "queue.itemCreated",
    ],
    availability: { status: "available" },
    confirmationRequirement: "required",
    defaultForProductActions: true,
    description:
      "Create Queue items from an explicitly confirmed prompt-pack preview through the typed Queue bridge.",
    forbiddenSideEffects: [
      "duplicate_queue_view",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.importPromptPack",
    inputSchemaDescription:
      "Confirmed prompt-pack preview, selected item ids, and optional task-scoped Queue defaults.",
    outputSchemaDescription:
      "Prompt-pack materialization result with created Queue items, dependency links, warnings, and errors.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Import Prompt Pack",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.targetSingletonQueue.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Resolve the singleton Workspace Queue target without creating another Queue view.",
    forbiddenSideEffects: [
      "duplicate_queue_view",
      "queue_item_create",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.targetSingletonQueue",
    inputSchemaDescription:
      "Workspace id and optional current Queue widget instance id.",
    outputSchemaDescription:
      "Singleton Queue target metadata using key workspace-queue.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Target Singleton Queue",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.selfTest.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Run safe Queue capability self-test checks through dry-run or model-only paths.",
    forbiddenSideEffects: [
      "queue_item_create_without_dry_run",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "queue.selfTest",
    inputSchemaDescription:
      "Self-test request with dry-run flag and selected Queue capability ids.",
    outputSchemaDescription:
      "Self-test report with passed, failed, skipped, and blocked counts.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Queue Self-Test",
  },
  ...QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES,
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.workspaceAgent.selfTest.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Run safe Workspace Agent capability-manifest and policy self-test checks.",
    forbiddenSideEffects: [
      "codex_run",
      "shell_command",
      "queue_item_create_without_dry_run",
      "terminal_launch",
      "git_mutation",
    ],
    id: "workspaceAgent.selfTest",
    inputSchemaDescription:
      "Self-test request with current Workspace Agent role and capability manifest.",
    outputSchemaDescription:
      "Self-test report with capability availability and policy checks.",
    ownerSurface: "Workspace Agent",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Workspace Agent Self-Test",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.runtime.agent.status.read.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Read an in-app agent status through the pure Multi-Agent Runtime API.",
    forbiddenSideEffects: [
      "app_control_action",
      "broker_execution",
      "codex_run",
      "queue_mutation",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "agent.status.read",
    inputSchemaDescription: "Target agent id.",
    outputSchemaDescription: "Target agent id and current runtime status.",
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Read Agent Status",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.runtime.agent.history.read.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Read bounded in-app agent history through the pure Multi-Agent Runtime API.",
    forbiddenSideEffects: [
      "app_control_action",
      "broker_execution",
      "codex_run",
      "queue_mutation",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "agent.history.read",
    inputSchemaDescription:
      "Target agent id plus optional history limit, direction, kind, and thread id.",
    outputSchemaDescription:
      "Bounded audited history result with truncation metadata.",
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Read Agent History",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.runtime.agent.message.send.requested"],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: false,
    description:
      "Send a typed internal message to another registered in-app agent.",
    forbiddenSideEffects: [
      "app_control_action",
      "codex_run",
      "queue_mutation",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "agent.message.send",
    inputSchemaDescription:
      "Sender agent id, receiver agent id, message body, timestamp, kind, and optional thread or correlation id.",
    outputSchemaDescription:
      "Structured typed message result and sender/receiver history updates.",
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Send Agent Message",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.runtime.agent.capabilities.read.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Read another registered in-app agent capability manifest.",
    forbiddenSideEffects: [
      "app_control_action",
      "broker_execution",
      "codex_run",
      "queue_mutation",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "agent.capabilities.read",
    inputSchemaDescription: "Target agent id.",
    outputSchemaDescription:
      "Capability manifest with typed capability metadata and policy fields.",
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Read Agent Capabilities",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.runtime.agent.selfTest.run.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: false,
    description:
      "Run safe model-level self-test checks without shell, Codex, app API mutation, or broker execution.",
    forbiddenSideEffects: [
      "app_control_action",
      "broker_execution",
      "codex_run",
      "queue_mutation",
      "shell_command",
      "terminal_launch",
      "git_mutation",
    ],
    id: "agent.selfTest.run",
    inputSchemaDescription: "Selected model self-test ids and dry-run flag.",
    outputSchemaDescription:
      "Safe dry-run self-test result with structured evidence.",
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Run Agent Self-Test",
  },
  {
    allowedAgentRoles: ["workspace_agent"],
    auditEventNames: ["hobit.agent.capability.codex.runTask.requested"],
    availability: { status: "available" },
    confirmationRequirement: "required",
    defaultForProductActions: false,
    description:
      "Restricted explicit Codex Direct Work execution capability. It is not the default path for Hobit product actions.",
    forbiddenSideEffects: [
      "product_action_default_path",
      "hidden_execution",
      "auto_commit",
      "auto_push",
      "git_mutation_without_explicit_capability",
      "queue_autorun_without_explicit_capability",
    ],
    id: "codex.runTask",
    inputSchemaDescription:
      "Explicit operator prompt, working directory, sandbox, approval policy, and Codex executable.",
    outputSchemaDescription:
      "Direct Work run status, capped logs, final result, and activity events.",
    ownerSurface: "Agent Executor / Workspace Agent Direct Work",
    restricted: true,
    sideEffectLevel: "execute",
    supportsDryRun: false,
    supportsSelfTest: false,
    title: "Run Codex Task",
  },
  {
    allowedAgentRoles: ["workspace_agent"],
    auditEventNames: [
      "hobit.agent.capability.workspace.shell.runCommand.requested",
    ],
    availability: {
      reason:
        "No general Workspace Agent shell capability is wired. Terminal remains an explicit operator-controlled widget.",
      status: "unavailable",
    },
    confirmationRequirement: "required",
    defaultForProductActions: false,
    description:
      "Restricted explicit shell execution capability. It is not available as a Workspace Agent product-action path in this foundation.",
    forbiddenSideEffects: [
      "product_action_default_path",
      "hidden_execution",
      "terminal_launch",
      "git_mutation_without_explicit_capability",
      "queue_autorun_without_explicit_capability",
    ],
    id: "workspace.shell.runCommand",
    inputSchemaDescription:
      "Explicit command, argv, working directory, timeout, and output cap.",
    outputSchemaDescription:
      "Structured command status and capped stdout/stderr when a future capability is available.",
    ownerSurface: "Terminal",
    restricted: true,
    sideEffectLevel: "execute",
    supportsDryRun: false,
    supportsSelfTest: false,
    title: "Run Shell Command",
  },
];
