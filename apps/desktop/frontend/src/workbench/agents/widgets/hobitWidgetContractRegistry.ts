import {
  createUnavailableWidgetContractLookupResult,
  createWidgetAgentContract,
  createWidgetCapabilityContract,
  createWidgetSelfTestInstruction,
  type HobitWidgetAgentContract,
  type HobitWidgetCapabilityContract,
  type HobitWidgetContractLookupResult,
  type HobitWidgetId,
} from "./hobitWidgetAgentContract";

const queueSelfTestInstruction = createWidgetSelfTestInstruction({
  body: [
    "Run the Agent Queue widget contract self-test through safe model or dry-run checks.",
    "Confirm the singleton Workspace Queue target is used.",
    "Confirm create and import capabilities do not start workers, Agent Executor, Terminal, Git, or rollback execution.",
    "Return structured passed, failed, skipped, or blocked evidence.",
  ].join(" "),
  id: "agent-queue.selfTest",
  title: "Agent Queue widget self-test",
});

const workspaceAgentSelfTestInstruction = createWidgetSelfTestInstruction({
  body: [
    "Run the Workspace Agent widget contract self-test through safe model checks.",
    "Confirm available product actions are represented as typed capabilities.",
    "Confirm app actions are not routed through regex phrase matching.",
    "Confirm Codex and shell are restricted capabilities, not default product-action paths.",
    "Return structured passed, failed, skipped, or blocked evidence.",
  ].join(" "),
  id: "interactive-agent.selfTest",
  title: "Workspace Agent widget self-test",
});

export const AGENT_QUEUE_WIDGET_AGENT_CONTRACT = createWidgetAgentContract({
  availability: { status: "available" },
  capabilities: [
    queueCapability({
      auditEventNames: [
        "hobit.widget.agentQueue.createItem.requested",
        "queue.itemCreated",
      ],
      capabilityId: "queue.createItem",
      confirmationRequirement: "recommended",
      description:
        "Create one Queue item through the typed singleton Workspace Queue API.",
      forbiddenSideEffects: queueCreateForbiddenSideEffects(),
      inputSchemaDescription:
        "Queue item title, prompt, optional description, status, priority, dependencies, and task-scoped run settings.",
      outputSchemaDescription:
        "Structured Queue action result with created item snapshot, safety class, message, and Queue events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Create Queue Item",
    }),
    queueCapability({
      auditEventNames: [
        "hobit.widget.agentQueue.createItems.requested",
        "queue.itemCreated",
      ],
      capabilityId: "queue.createItems",
      confirmationRequirement: "recommended",
      description:
        "Create multiple Queue items through typed Queue APIs targeting the singleton Workspace Queue.",
      forbiddenSideEffects: queueCreateForbiddenSideEffects(),
      inputSchemaDescription:
        "Batch of Queue item creation requests plus optional dependency links and prompt-pack materialization refs.",
      outputSchemaDescription:
        "Structured batch result with created item snapshots, dependency link results, warnings, errors, and Queue events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Create Queue Items",
    }),
    queueCapability({
      auditEventNames: [
        "hobit.widget.agentQueue.preparePromptPackPreview.requested",
      ],
      capabilityId: "queue.preparePromptPackPreview",
      confirmationRequirement: "none",
      description:
        "Prepare a prompt-pack preview and Smart Queue materialization without creating Queue items.",
      forbiddenSideEffects: [
        "queue_item_create",
        ...queueCreateForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Explicit prompt-pack source text or typed prompt-pack entries supplied by the operator.",
      outputSchemaDescription:
        "Prompt-pack preview with selected items, validation diagnostics, dependency graph, and Smart Queue materialization.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Prepare Prompt-Pack Preview",
    }),
    queueCapability({
      auditEventNames: [
        "hobit.widget.agentQueue.importPromptPack.requested",
        "queue.itemCreated",
      ],
      capabilityId: "queue.importPromptPack",
      confirmationRequirement: "required",
      description:
        "Create Queue items from an explicitly confirmed prompt-pack preview.",
      forbiddenSideEffects: queueCreateForbiddenSideEffects(),
      inputSchemaDescription:
        "Confirmed prompt-pack preview, selected item ids, dependency graph, and optional task-scoped Queue defaults.",
      outputSchemaDescription:
        "Prompt-pack materialization result with created Queue items, dependency links, warnings, and errors.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Import Prompt Pack",
    }),
    queueCapability({
      auditEventNames: [
        "hobit.widget.agentQueue.targetSingletonQueue.requested",
      ],
      capabilityId: "queue.targetSingletonQueue",
      confirmationRequirement: "none",
      description:
        "Resolve or focus the singleton Workspace Queue target without creating another Queue widget view.",
      forbiddenSideEffects: [
        "duplicate_queue_view",
        "queue_item_create",
        "auto_run_workers",
        "queue_autorun",
      ],
      inputSchemaDescription:
        "Workspace id and optional current Queue widget instance id.",
      outputSchemaDescription:
        "Singleton Queue target metadata using the saved-compatible agent-queue identity.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Target Singleton Queue",
    }),
    queueCapability({
      auditEventNames: ["hobit.widget.agentQueue.setMode.requested"],
      capabilityId: "queue.setMode",
      confirmationRequirement: "recommended",
      description:
        "Set the visible Queue operating mode where the current Queue surface exposes mode controls.",
      forbiddenSideEffects: [
        "auto_run_workers_without_operator_arming",
        "backend_durable_scheduler",
        "server_worker_start",
        "terminal_launch",
        "git_mutation",
      ],
      inputSchemaDescription:
        "Requested Queue mode and operator-visible reason.",
      outputSchemaDescription:
        "Structured mode update result or unavailable result when mode controls are not wired.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Set Queue Mode",
    }),
    queueCapability({
      auditEventNames: ["hobit.widget.agentQueue.selfTest.requested"],
      capabilityId: "queue.selfTest",
      confirmationRequirement: "none",
      description:
        "Run safe Queue widget contract checks through model-only or dry-run paths.",
      forbiddenSideEffects: [
        "queue_item_create_without_dry_run",
        "auto_run_workers",
        "queue_autorun",
        "codex_run",
        "shell_command",
        "terminal_launch",
        "git_mutation",
        "rollback_execution",
      ],
      inputSchemaDescription:
        "Self-test request with dry-run flag, selected Queue capability ids, and expected hidden side-effect assertions.",
      outputSchemaDescription:
        "Self-test report with passed, failed, skipped, and blocked counts plus structured evidence.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Queue Self-Test",
    }),
  ],
  expectedResultDescription:
    "Agent Queue self-tests report singleton targeting, preview/import safety, create-without-run guarantees, and unsupported rollback execution as structured evidence.",
  hiddenSideEffectAssertions: [
    "no_duplicate_queue_view",
    "no_worker_start",
    "no_queue_autorun",
    "no_terminal_launch",
    "no_git_mutation",
    "no_rollback_execution",
  ],
  ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
  ownerSurface: "Agent Queue / QueueV2",
  productDescription:
    "Agent Queue is the singleton workspace Queue. It creates and imports Queue items, shows task states and dependencies, and supports Smart Queue status, decision, retry, assistance, and rollback proposal views where implemented. Queue item creation must not auto-run workers, must not create a duplicate Queue view, and rollback execution is not implemented. Backend durable scheduler/persistence is not implemented by this widget contract foundation.",
  selfTestCases: [
    {
      capabilityId: "queue.targetSingletonQueue",
      caseId: "queue:singleton-target",
      expectedResultDescription:
        "The agent can identify the singleton Queue target and must not create a duplicate Queue view.",
      hiddenSideEffectAssertions: ["no_duplicate_queue_view"],
      title: "Singleton Queue Target",
    },
    {
      capabilityId: "queue.createItems",
      caseId: "queue:create-items-dry-run",
      expectedResultDescription:
        "A batch create self-test uses dry-run or model evidence and confirms no task execution starts.",
      hiddenSideEffectAssertions: [
        "no_worker_start",
        "no_queue_autorun",
        "no_codex_run",
      ],
      title: "Create Items Dry-Run",
    },
    {
      capabilityId: "queue.preparePromptPackPreview",
      caseId: "queue:prompt-pack-preview",
      expectedResultDescription:
        "Prompt-pack preview returns materialization evidence without creating Queue items.",
      hiddenSideEffectAssertions: ["no_queue_item_create"],
      title: "Prompt-Pack Preview",
    },
    {
      capabilityId: "queue.selfTest",
      caseId: "queue:rollback-not-implemented",
      expectedResultDescription:
        "Rollback proposal state may be inspected where present, but rollback execution is not reported as implemented.",
      hiddenSideEffectAssertions: ["no_rollback_execution"],
      title: "Rollback Execution Not Implemented",
    },
  ],
  selfTestInstruction: queueSelfTestInstruction,
  title: "Agent Queue",
  widgetId: "agent-queue",
});

export const WORKSPACE_AGENT_WIDGET_AGENT_CONTRACT = createWidgetAgentContract({
  availability: { status: "available" },
  capabilities: [
    workspaceAgentCapability({
      auditEventNames: [
        "hobit.widget.workspaceAgent.selfTest.requested",
      ],
      capabilityId: "workspaceAgent.selfTest",
      confirmationRequirement: "none",
      description:
        "Run safe Workspace Agent contract checks over manifest, context, activity, and restricted execution policy.",
      forbiddenSideEffects: workspaceAgentForbiddenSideEffects(),
      inputSchemaDescription:
        "Self-test request with current role, visible context summary, and selected Workspace Agent capability ids.",
      outputSchemaDescription:
        "Self-test report with passed, failed, skipped, and blocked counts plus evidence.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Workspace Agent Self-Test",
    }),
    workspaceAgentCapability({
      auditEventNames: [
        "hobit.widget.workspaceAgent.capabilities.read.requested",
      ],
      capabilityId: "workspaceAgent.capabilities.read",
      confirmationRequirement: "none",
      description:
        "Read the current agent-readable Hobit capability manifest for typed product-action selection.",
      forbiddenSideEffects: workspaceAgentForbiddenSideEffects(),
      inputSchemaDescription:
        "Workspace Agent role and current surface scope.",
      outputSchemaDescription:
        "Capability manifest with schema, policy, side-effect, confirmation, dry-run, preview, availability, and audit metadata.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Read Capability Manifest",
    }),
    workspaceAgentCapability({
      auditEventNames: [
        "hobit.widget.workspaceAgent.context.read.requested",
      ],
      capabilityId: "workspaceAgent.context.read",
      confirmationRequirement: "none",
      description:
        "Read only visible or explicitly approved Workspace Agent context.",
      forbiddenSideEffects: [
        "hidden_context_read",
        "filesystem_scan",
        ...workspaceAgentForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Current Workspace id, widget instance id, visible transcript summary, and explicit attached context refs.",
      outputSchemaDescription:
        "Bounded visible context snapshot and warnings for unavailable or blocked context.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Read Visible Context",
    }),
    workspaceAgentCapability({
      auditEventNames: [
        "hobit.widget.workspaceAgent.activity.read.requested",
      ],
      capabilityId: "workspaceAgent.activity.read",
      confirmationRequirement: "none",
      description:
        "Read current-session Workspace Agent activity events without reading stored Executor detail automatically.",
      forbiddenSideEffects: workspaceAgentForbiddenSideEffects(),
      inputSchemaDescription:
        "Widget instance id and optional current run id.",
      outputSchemaDescription:
        "Current-session activity event summaries and unavailable/empty states.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Read Activity",
    }),
    workspaceAgentCapability({
      auditEventNames: [
        "hobit.widget.workspaceAgent.message.submit.requested",
      ],
      capabilityId: "workspaceAgent.message.submit",
      confirmationRequirement: "recommended",
      description:
        "Submit a visible operator message to the Workspace Agent surface. Product actions must be selected as typed capabilities and brokered, not regex-routed.",
      forbiddenSideEffects: [
        "regex_product_action_routing",
        "codex_run_as_default_product_action",
        "shell_command_as_default_product_action",
        "hidden_context_read",
        "queue_auto_dispatch",
        "terminal_launch",
        "git_mutation",
      ],
      inputSchemaDescription:
        "Visible operator message, visible attachments, provider selection state, and optional selected typed capability proposal.",
      outputSchemaDescription:
        "Transcript message, proposal/review card data, provider status, or unavailable/blocked result.",
      sideEffectLevel: "write",
      supportsDryRun: false,
      supportsPreview: true,
      title: "Submit Message",
    }),
    workspaceAgentCapability({
      auditEventNames: ["hobit.widget.workspaceAgent.codex.runTask.requested"],
      capabilityId: "codex.runTask",
      confirmationRequirement: "required",
      description:
        "Restricted explicit Codex Direct Work capability already represented in the global manifest. It is not the default path for Hobit product actions.",
      forbiddenSideEffects: [
        "product_action_default_path",
        "hidden_execution",
        "auto_commit",
        "auto_push",
        "shell_command",
        "terminal_launch",
        "git_mutation_without_explicit_capability",
      ],
      inputSchemaDescription:
        "Explicit operator prompt, working directory, sandbox, approval policy, and Codex executable.",
      outputSchemaDescription:
        "Direct Work run status, capped activity/log/result metadata, and visible failure/unavailable states.",
      sideEffectLevel: "execute",
      supportsDryRun: false,
      supportsPreview: false,
      title: "Run Codex Task",
    }),
  ],
  expectedResultDescription:
    "Workspace Agent self-tests report manifest readability, visible-context-only reads, activity readability, non-regex product-action architecture, and restricted Codex behavior.",
  hiddenSideEffectAssertions: [
    "no_hidden_context_read",
    "no_regex_product_action_routing",
    "no_codex_default_product_action",
    "no_shell_default_product_action",
    "no_queue_auto_dispatch",
  ],
  ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
  ownerSurface: "Workspace Agent",
  productDescription:
    "Workspace Agent is the in-app agent surface with transcript, composer, and activity. It receives Hobit app context and the capability manifest, acts as a product-action orchestrator first, and uses Codex or shell only through restricted capabilities for explicit execution requests. Full Action Broker execution is not implemented by this foundation, hard Stop behavior may remain unavailable in some current paths, and app actions must not be regex-routed.",
  selfTestCases: [
    {
      capabilityId: "workspaceAgent.capabilities.read",
      caseId: "workspace-agent:capability-manifest",
      expectedResultDescription:
        "The agent can read typed capabilities and policy metadata without running actions.",
      hiddenSideEffectAssertions: ["no_product_action_execution"],
      title: "Capability Manifest Read",
    },
    {
      capabilityId: "workspaceAgent.context.read",
      caseId: "workspace-agent:visible-context",
      expectedResultDescription:
        "The context read uses only visible or explicitly approved context.",
      hiddenSideEffectAssertions: ["no_hidden_context_read"],
      title: "Visible Context Read",
    },
    {
      capabilityId: "workspaceAgent.activity.read",
      caseId: "workspace-agent:activity-read",
      expectedResultDescription:
        "Activity read returns current-session event evidence without starting or stopping runs.",
      hiddenSideEffectAssertions: ["no_codex_run", "no_stop_request"],
      title: "Activity Read",
    },
    {
      capabilityId: "workspaceAgent.selfTest",
      caseId: "workspace-agent:no-regex-routing",
      expectedResultDescription:
        "Product action architecture is typed capability selection plus Action Broker validation, not text regex routing.",
      hiddenSideEffectAssertions: ["no_regex_product_action_routing"],
      title: "No Regex Routing",
    },
  ],
  selfTestInstruction: workspaceAgentSelfTestInstruction,
  title: "Workspace Agent",
  widgetId: "interactive-agent",
});

export const FUTURE_WIDGET_AGENT_CONTRACT_PLACEHOLDERS =
  createFutureWidgetPlaceholders();

const ACTIVE_WIDGET_AGENT_CONTRACTS = [
  AGENT_QUEUE_WIDGET_AGENT_CONTRACT,
  WORKSPACE_AGENT_WIDGET_AGENT_CONTRACT,
] as const;

export function listWidgetContracts({
  includePlaceholders = false,
}: {
  includePlaceholders?: boolean;
} = {}): HobitWidgetAgentContract[] {
  const contracts = includePlaceholders
    ? [
        ...ACTIVE_WIDGET_AGENT_CONTRACTS,
        ...FUTURE_WIDGET_AGENT_CONTRACT_PLACEHOLDERS,
      ]
    : [...ACTIVE_WIDGET_AGENT_CONTRACTS];

  return [...contracts].sort((left, right) =>
    left.widgetId.localeCompare(right.widgetId),
  );
}

export function findWidgetContract(
  widgetId: HobitWidgetId,
  {
    includePlaceholders = false,
  }: {
    includePlaceholders?: boolean;
  } = {},
): HobitWidgetContractLookupResult {
  const contract =
    listWidgetContracts({ includePlaceholders }).find(
      (candidate) => candidate.widgetId === widgetId,
    ) ?? null;

  if (!contract) {
    return createUnavailableWidgetContractLookupResult({
      unavailableReason: `Widget contract ${widgetId} is not registered in the active Widget Agent Contract registry.`,
      widgetId,
    });
  }

  if (contract.availability.status === "unavailable") {
    return createUnavailableWidgetContractLookupResult({
      unavailableReason: contract.availability.unavailableReason,
      widgetId,
    });
  }

  return { contract, status: "found" };
}

function queueCapability(
  capability: Omit<HobitWidgetCapabilityContract, "availability">,
) {
  return createWidgetCapabilityContract({
    ...capability,
    availability: { status: "available" },
  });
}

function workspaceAgentCapability(
  capability: Omit<HobitWidgetCapabilityContract, "availability">,
) {
  return createWidgetCapabilityContract({
    ...capability,
    availability: { status: "available" },
  });
}

function queueCreateForbiddenSideEffects() {
  return [
    "duplicate_queue_view",
    "auto_run_workers",
    "queue_autorun",
    "agent_executor_run",
    "codex_run",
    "shell_command",
    "terminal_launch",
    "git_mutation",
    "rollback_execution",
    "backend_durable_scheduler",
    "server_worker_start",
  ];
}

function workspaceAgentForbiddenSideEffects() {
  return [
    "hidden_context_read",
    "product_action_execution",
    "queue_item_create",
    "queue_auto_dispatch",
    "codex_run",
    "shell_command",
    "terminal_launch",
    "git_mutation",
  ];
}

function createFutureWidgetPlaceholders(): HobitWidgetAgentContract[] {
  return [
    futurePlaceholder("skill-library", "Knowledge / Skills"),
    futurePlaceholder("notes", "Notes"),
    futurePlaceholder("terminal", "Terminal"),
  ];
}

function futurePlaceholder(
  widgetId: HobitWidgetId,
  title: string,
): HobitWidgetAgentContract {
  const instruction = createWidgetSelfTestInstruction({
    body: `${title} widget contract is not implemented in this foundation block. Return skipped self-test evidence and do not infer capabilities.`,
    id: `${widgetId}.selfTest.placeholder`,
    title: `${title} placeholder self-test`,
  });

  return createWidgetAgentContract({
    availability: {
      status: "unavailable",
      unavailableReason:
        "Widget Agent Contract is not implemented yet; this placeholder is skipped.",
    },
    capabilities: [],
    expectedResultDescription:
      "Self-test is skipped until the widget exposes a complete agent-readable contract.",
    hiddenSideEffectAssertions: ["no_capability_inference"],
    ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
    ownerSurface: title,
    productDescription:
      `${title} is a future Widget Agent Contract target. This placeholder does not claim product capability completeness.`,
    selfTestCases: [
      {
        capabilityId: `${widgetId}.selfTest`,
        caseId: `${widgetId}:placeholder-skipped`,
        expectedResultDescription:
          "Skipped because the widget contract is not implemented yet.",
        hiddenSideEffectAssertions: ["no_capability_inference"],
        title: "Placeholder Skipped",
      },
    ],
    selfTestInstruction: instruction,
    title,
    widgetId,
  });
}
