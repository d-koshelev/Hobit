import type { HobitAgentCapability } from "./types";

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
      "Queue item title, prompt, status, priority, dependencies, and task-scoped run settings.",
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
      "List of Queue item creation requests and optional dependency links.",
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
