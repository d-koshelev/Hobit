import type {
  HobitAgentCapability,
  HobitAgentCapabilityExample,
  HobitAgentCapabilityInputSchema,
} from "./types";

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
