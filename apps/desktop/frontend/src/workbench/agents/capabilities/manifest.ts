import type {
  HobitAgentCapability,
  HobitAgentCapabilityExample,
  HobitAgentCapabilityInputSchema,
} from "./types";
import {
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "./queueCapabilityContracts";
import { QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES } from "./queueDogfoodLifecycleCapabilityManifest";

const QUEUE_CREATE_ITEM_EXAMPLE_INPUT = {
  prompt: "Review the current workspace state and report one safe next step.",
  status: "draft",
  title: "Test Queue item",
} as const;

const QUEUE_CREATE_ITEMS_EXAMPLE_INPUT = {
  items: [QUEUE_CREATE_ITEM_EXAMPLE_INPUT],
} as const;

const QUEUE_CREATE_DEPENDENT_ITEM_EXAMPLE_INPUT = {
  dependsOn: ["queue-upstream-task-id"],
  prompt: "Run only after the upstream Queue task reaches accepted completion.",
  status: "draft",
  title: "Dependent Queue item",
} as const;

const WORKSPACE_CONTEXT_GET_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["includeQueueControl", "includeWidgetSummary"],
  fieldDescriptions: {
    includeQueueControl:
      "Optional boolean. When true, include typed Queue control state if the live Queue bridge can read it.",
    includeWidgetSummary:
      "Optional boolean. When true, include bounded counts for live workbench widgets and Agent Executor widgets.",
  },
  invalidInputGuidance: [
    "Use this capability for live Workspace/Workbench context discovery before Queue smoke.",
    "Do not use agent.status.read for Queue live context discovery.",
    "Do not provide UI text, task titles, file paths, transcript text, prompt-pack ids, or prose hints as input.",
  ],
  requiredFields: [],
  shape:
    '{"includeQueueControl":"boolean optional","includeWidgetSummary":"boolean optional"}',
};

const WORKBENCH_WIDGETS_LIST_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["definitionIdFilter", "visibleOnly", "includeTitles"],
  fieldDescriptions: {
    definitionIdFilter:
      "Optional exact widget definition id filter. Use agent-run to list Agent Executor widgets.",
    includeTitles:
      "Optional boolean. When true, include display titles for operator-readable context only.",
    visibleOnly:
      "Optional boolean. Defaults to true so recommended executor selection uses visible workbench widgets.",
  },
  invalidInputGuidance: [
    "Agent Executor identity is definitionId === \"agent-run\" only.",
    "Do not infer executorWidgetId from title, widget order, UI text, file path, transcript text, or prose.",
    "When multiple Agent Executor widgets are returned, do not choose one unless a later typed policy explicitly disambiguates it.",
  ],
  requiredFields: [],
  shape:
    '{"definitionIdFilter":"string optional exact widget definition id","visibleOnly":"boolean optional default true","includeTitles":"boolean optional"}',
};

const QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS = {
  dependsOn:
    "Optional upstream Queue task ids. Use explicit task ids returned by queue.createItem(s), queue.items.list, or queue.lifecycle.get.",
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
    "dependsOn",
    "source",
    "sourceMetadata",
    "id",
  ],
  fieldDescriptions: QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS,
  invalidInputGuidance: [
    "Queue item creation requires both title and prompt.",
    "The prompt is the runnable task instruction, not just a display description.",
    "Use dependsOn only for explicit upstream Queue task ids returned by typed Queue results.",
    "Do not infer dependencies from title, prompt, item order, prose, or prompt-pack ids.",
    "Do not use body, text, content, operatorPrompt, initialState, dependencies, depends_on, queueTag, or priority for Queue create action input.",
    "If the user explicitly asks for a test, dummy, or example Queue item, create a safe placeholder prompt.",
    "If the user asks for a real Queue item but does not provide task content, ask a concise clarification instead of emitting an invalid action request.",
    "Do not use shell, Codex, or source-code inspection to invent product action data.",
    "Do not auto-run workers.",
  ],
  requiredFields: ["title", "prompt"],
  shape:
    '{"title":"string required","prompt":"string required","status":"draft|queued|ready optional","description":"string optional","dependsOn":"string[] optional explicit upstream task ids","source":"object optional","sourceMetadata":"object optional","id":"string optional"}',
};

const QUEUE_CREATE_ITEMS_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: [
    "items",
    "items[].title",
    "items[].prompt",
    "items[].status",
    "items[].description",
    "items[].dependsOn",
    "items[].source",
    "items[].sourceMetadata",
    "items[].id",
    "source",
  ],
  fieldDescriptions: {
    items:
      "Required non-empty array of Queue item creation inputs. Every item requires title and prompt.",
    "items[].dependsOn":
      QUEUE_CREATE_ITEM_FIELD_DESCRIPTIONS.dependsOn,
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
    '{"items":[{"title":"string required","prompt":"string required","status":"draft|queued|ready optional","description":"string optional","dependsOn":"string[] optional explicit upstream task ids","source":"object optional","sourceMetadata":"object optional","id":"string optional"}],"source":"object optional"}',
};

const QUEUE_CREATE_ITEM_EXAMPLES: HobitAgentCapabilityExample[] = [
  {
    description: "Create one safe test Queue item.",
    exampleActionRequest: {
      capabilityId: "queue.createItem",
      dryRun: false,
      input: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
      requestId: "queue-create-item-1",
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
      requestId: "queue-create-item-preview-1",
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEM_EXAMPLE_INPUT,
  },
  {
    description:
      "Create one downstream Queue item with an explicit upstream task id returned by a typed Queue result.",
    exampleActionRequest: {
      capabilityId: "queue.createItem",
      dryRun: false,
      input: QUEUE_CREATE_DEPENDENT_ITEM_EXAMPLE_INPUT,
      requestId: "queue-create-dependent-item-1",
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_DEPENDENT_ITEM_EXAMPLE_INPUT,
  },
];

const QUEUE_CREATE_ITEMS_EXAMPLES: HobitAgentCapabilityExample[] = [
  {
    description: "Create one or more safe test Queue items.",
    exampleActionRequest: {
      capabilityId: "queue.createItems",
      dryRun: false,
      input: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
      requestId: "queue-create-items-1",
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
      requestId: "queue-create-items-preview-1",
      type: "hobit.action.request",
    },
    exampleInput: QUEUE_CREATE_ITEMS_EXAMPLE_INPUT,
  },
  {
    description:
      "Create one downstream Queue item in a batch payload with an explicit upstream task id already returned by a typed Queue result.",
    exampleActionRequest: {
      capabilityId: "queue.createItems",
      dryRun: false,
      input: {
        items: [QUEUE_CREATE_DEPENDENT_ITEM_EXAMPLE_INPUT],
      },
      requestId: "queue-create-dependent-items-1",
      type: "hobit.action.request",
    },
    exampleInput: {
      items: [QUEUE_CREATE_DEPENDENT_ITEM_EXAMPLE_INPUT],
    },
  },
];

const QUEUE_ITEMS_LIST_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["limit", "taskId"],
  fieldDescriptions: {
    limit:
      "Optional maximum number of backend aggregate Queue task summaries to return. Range: 1-50.",
    taskId: "Optional explicit Queue task id to filter one aggregate item.",
  },
  invalidInputGuidance: [
    "Use taskId only when an explicit Queue task id is already available from a prior typed result.",
    "Do not infer taskId from task title, prompt text, file paths, final message, or natural-language content.",
  ],
  requiredFields: [],
  shape: '{"limit":"number optional 1-50","taskId":"string optional"}',
};

const QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS = [
  "queue_mutation",
  "queue_control_set",
  "queue_item_create",
  "queue_item_update",
  "workflow_invocation",
  "workflow_execution",
  "worker_start",
  "auto_run_workers",
  "queue_autorun",
  "run_link_create",
  "evidence_mutation",
  "review_mutation",
  "finalization_mutation",
  "codex_run",
  "shell_command",
  "terminal_launch",
  "git_mutation",
  "validation_execution",
  "rollback_execution",
  "dom_scraping",
  "ui_text_id_inference",
  "prose_id_inference",
  "raw_confirmation_token",
] as const;

const QUEUE_WORKFLOW_GET_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId", "workflowRunId"],
  fieldDescriptions: {
    workflowRunId:
      "Required explicit workflow run id returned by queue.workflow.list, workflow start, or another typed workflow result.",
    workspaceId:
      "Optional exact workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "workflowRunId is required.",
    "Use queue.workflow.list first when workflowRunId was lost.",
    "Do not infer workflowRunId from UI text, task titles, task order, prompt text, file paths, transcript text, or prose.",
    "This action reads one workflow run summary only. It never invokes workflows, starts workers, mutates Queue state, records evidence, creates/ACKs reviews, or finalizes tasks.",
  ],
  requiredFields: ["workflowRunId"],
  shape:
    '{"workspaceId":"string optional exact current workspace id","workflowRunId":"string required explicit workflow run id"}',
};

const QUEUE_WORKFLOW_LIST_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId", "status", "workflowId", "limit"],
  fieldDescriptions: {
    limit: "Optional maximum workflow run summaries to return. Range: 1-50.",
    status:
      "Optional exact workflow run status filter: created, running, paused, blocked, completed, failed, or cancelled.",
    workflowId: "Optional exact declared Queue workflow id filter.",
    workspaceId:
      "Optional exact workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "Use this when workflowRunId was lost during smoke/debug work.",
    "Do not supply task titles, UI text, prompt text, transcript text, file paths, or prose hints.",
    "This action reads bounded workflow run summaries only. It never invokes workflows, starts workers, mutates Queue state, or creates Queue tasks.",
  ],
  requiredFields: [],
  shape:
    '{"workspaceId":"string optional exact current workspace id","status":"created|running|paused|blocked|completed|failed|cancelled optional","workflowId":"string optional exact workflow id","limit":"number optional 1-50"}',
};

const QUEUE_WORKFLOW_GET_REPORT_SCHEMA: HobitAgentCapabilityInputSchema = {
  ...QUEUE_WORKFLOW_GET_SCHEMA,
  invalidInputGuidance: [
    "workflowRunId is required.",
    "Use queue.workflow.getReport to recover continuation ids such as taskIds, runIds, evidenceBundleIds, messageIds, completionDecisionIds, and failureDecisionIds.",
    "Do not infer ids from UI text, task titles, task order, prompt text, file paths, transcript text, or prose.",
    "This action reads the bounded persisted workflow report and action summaries only. It never exposes raw provider transcript or raw confirmationToken.",
  ],
};

const QUEUE_WORKFLOW_PLAN_RESUME_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId", "workflowRunId", "expectedVersion"],
  fieldDescriptions: {
    expectedVersion:
      "Optional exact workflow run version. If supplied, mismatches return a read-only resume blocker.",
    workflowRunId:
      "Required explicit workflow run id returned by queue.workflow.list, workflow start, or another typed workflow result.",
    workspaceId:
      "Optional exact workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "workflowRunId is required.",
    "Call queue.workflow.planResume before continuation when resuming smoke/debug work.",
    "Do not infer workflowRunId or version from UI text, task titles, prompt text, transcript text, file paths, or prose.",
    "This action is read-only. It plans resume state and blockers but never executes workflow steps, starts workers, or mutates Queue state.",
  ],
  requiredFields: ["workflowRunId"],
  shape:
    '{"workspaceId":"string optional exact current workspace id","workflowRunId":"string required explicit workflow run id","expectedVersion":"number optional non-negative integer"}',
};

const QUEUE_WORKFLOW_READ_ACTION_LOG_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId", "workflowRunId", "limit", "status"],
  fieldDescriptions: {
    limit: "Optional maximum action summaries to return. Range: 1-50.",
    status: "Optional exact workflow action status filter.",
    workflowRunId:
      "Required explicit workflow run id returned by queue.workflow.list, workflow start, or another typed workflow result.",
    workspaceId:
      "Optional exact workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "workflowRunId is required.",
    "Use queue.workflow.readActionLog to debug idempotency/action issues from persisted action summaries.",
    "Do not infer workflowRunId from UI text, task titles, prompt text, transcript text, file paths, or prose.",
    "This action reads bounded action summaries only. It never exposes raw logs, raw provider transcript, or raw confirmationToken.",
  ],
  requiredFields: ["workflowRunId"],
  shape:
    '{"workspaceId":"string optional exact current workspace id","workflowRunId":"string required explicit workflow run id","limit":"number optional 1-50","status":"string optional exact action status"}',
};

const QUEUE_CONTROL_GET_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId"],
  fieldDescriptions: {
    workspaceId:
      "Optional explicit workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "Use workspace.context.get first when the current workspace id is unknown.",
    "Do not infer workspaceId from UI text, task titles, file paths, transcript text, or prose.",
    "This action reads Queue control state only. It never enables Queue, starts workers, starts Queue Autorun, creates tasks, or starts Direct Work.",
  ],
  requiredFields: [],
  shape: '{"workspaceId":"string optional exact current workspace id"}',
};

const QUEUE_CONTROL_SET_MANUAL_ENABLED_SCHEMA: HobitAgentCapabilityInputSchema = {
  acceptedFields: ["workspaceId", "expectedVersion", "reason"],
  fieldDescriptions: {
    expectedVersion:
      "Optional exact backend Queue control state version. If supplied, mismatches return version_conflict.",
    reason:
      "Optional bounded reason string. This is stored only as Queue control metadata.",
    workspaceId:
      "Optional explicit workspace id. If supplied, it must match the current live Workspace context.",
  },
  invalidInputGuidance: [
    "Use queue.control.get before this action when version-aware smoke setup is needed.",
    "Do not supply actorId, task ids, workflow ids, executor ids, run ids, confirmationToken, prose confirmation, UI text, file paths, transcript text, or task titles.",
    "This action sets backend Queue control state to manual_enabled only. It never starts workers, dispatches a scheduler, starts Queue Autorun, creates run links, mutates Queue tasks, records evidence, creates or ACKs reviews, finalizes tasks, invokes workflows, launches Terminal/shell/Git/validation/rollback, or starts downstream work.",
  ],
  requiredFields: [],
  shape:
    '{"workspaceId":"string optional exact current workspace id","expectedVersion":"number optional non-negative integer","reason":"string optional max 240 chars"}',
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
      `Optional Direct Work approval policy. Supported exactly: ${QUEUE_RUN_APPROVAL_POLICY_VALUES.join(", ")}.`,
    codexExecutable:
      "Optional explicit Codex executable path/name. Empty or whitespace values are invalid.",
    sandbox:
      `Optional Direct Work sandbox. Supported exactly: ${QUEUE_RUN_SANDBOX_VALUES.join(", ")}.`,
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
    `{"taskId":"string required","codexExecutable":"string optional","workspaceRoot":"string optional","sandbox":"${QUEUE_RUN_SANDBOX_VALUES.join("|")} optional","approvalPolicy":"${QUEUE_RUN_APPROVAL_POLICY_VALUES.join("|")} optional"}`,
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
    "Compatibility path only. New live Queue smoke setup should use queue.control.get followed by queue.control.setManualEnabled.",
    "This action enables Queue scheduling state only; it does not create tasks, update readiness, start Queue Autorun, or start Direct Work.",
    "When an older Queue capability result says nextSuggestedCapability is queue.enable, this capability remains available for compatibility before queue.item.startRun.",
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
    `${QUEUE_START_RUN_CONFIRMATION_FIELD} is required as a top-level action-request field with exact value "${QUEUE_START_RUN_CONFIRMATION_TOKEN}" after explicit operator confirmation.`,
    "Do not put confirmationToken inside input.",
    "Do not infer confirmation from prose such as I confirm.",
    "Do not infer taskId or executorWidgetId from task title, prompt text, file paths, final message, or natural-language content.",
    "Use queue.items.list first when ids are missing.",
    "Queue control must already be manual_enabled. New live smoke setup should call queue.control.get then queue.control.setManualEnabled; older queue.enable nextActions remain compatibility-only.",
    "This action starts exactly one explicit Queue-linked Direct Work run and does not run validation, Git, rollback, Terminal, Queue Autorun, or dependent tasks.",
  ],
  requiredFields: ["taskId", "executorWidgetId"],
  shape:
    `{"${QUEUE_START_RUN_CONFIRMATION_FIELD}":"${QUEUE_START_RUN_CONFIRMATION_TOKEN} top-level required after operator confirmation","input":{"taskId":"string required","executorWidgetId":"string required","queueId":"string optional"}}`,
};

const QUEUE_RUN_CONTROL_EXAMPLES: Record<string, HobitAgentCapabilityExample[]> = {
  "queue.control.get": [
    {
      description: "Read backend Queue control state for the current workspace.",
      exampleActionRequest: {
        capabilityId: "queue.control.get",
        dryRun: false,
        input: {},
        requestId: "queue-control-get-1",
        type: "hobit.action.request",
      },
      exampleInput: {},
    },
  ],
  "queue.control.setManualEnabled": [
    {
      description:
        "Set backend Queue control state to manual_enabled without starting workers or scheduler dispatch.",
      exampleActionRequest: {
        capabilityId: "queue.control.setManualEnabled",
        dryRun: false,
        input: {
          expectedVersion: 2,
          reason: "prepare_manual_queue_smoke",
        },
        requestId: "queue-control-set-manual-enabled-1",
        type: "hobit.action.request",
      },
      exampleInput: {
        expectedVersion: 2,
        reason: "prepare_manual_queue_smoke",
      },
    },
  ],
  "queue.enable": [
    {
      description:
        "Compatibility path for older Queue enable nextActions without starting a task.",
      exampleActionRequest: {
        capabilityId: "queue.enable",
        dryRun: false,
        input: {},
        requestId: "queue-enable-1",
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
        requestId: "queue-promote-draft-1",
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
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        dryRun: false,
        input: {
          executorWidgetId: "executor-widget-id",
          taskId: "queue-task-id",
        },
        requestId: "queue-start-run-1",
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
        requestId: "queue-run-settings-1",
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
        requestId: "queue-items-list-1",
        type: "hobit.action.request",
      },
      exampleInput: { limit: 25 },
    },
  ],
  "queue.workflow.get": [
    {
      description: "Read one Queue workflow run summary by explicit workflowRunId.",
      exampleActionRequest: {
        capabilityId: "queue.workflow.get",
        dryRun: false,
        input: { workflowRunId: "workflow-run-id" },
        requestId: "queue-workflow-get-1",
        type: "hobit.action.request",
      },
      exampleInput: { workflowRunId: "workflow-run-id" },
    },
  ],
  "queue.workflow.list": [
    {
      description: "List recent Queue workflow runs to recover a lost workflowRunId.",
      exampleActionRequest: {
        capabilityId: "queue.workflow.list",
        dryRun: false,
        input: { limit: 10 },
        requestId: "queue-workflow-list-1",
        type: "hobit.action.request",
      },
      exampleInput: { limit: 10 },
    },
  ],
  "queue.workflow.getReport": [
    {
      description:
        "Read a bounded workflow report and continuation ids for one workflow run.",
      exampleActionRequest: {
        capabilityId: "queue.workflow.getReport",
        dryRun: false,
        input: { workflowRunId: "workflow-run-id" },
        requestId: "queue-workflow-get-report-1",
        type: "hobit.action.request",
      },
      exampleInput: { workflowRunId: "workflow-run-id" },
    },
  ],
  "queue.workflow.planResume": [
    {
      description: "Plan read-only workflow resume state before continuation.",
      exampleActionRequest: {
        capabilityId: "queue.workflow.planResume",
        dryRun: false,
        input: {
          expectedVersion: 3,
          workflowRunId: "workflow-run-id",
        },
        requestId: "queue-workflow-plan-resume-1",
        type: "hobit.action.request",
      },
      exampleInput: {
        expectedVersion: 3,
        workflowRunId: "workflow-run-id",
      },
    },
  ],
  "queue.workflow.readActionLog": [
    {
      description:
        "Read bounded workflow action summaries for idempotency/action debugging.",
      exampleActionRequest: {
        capabilityId: "queue.workflow.readActionLog",
        dryRun: false,
        input: {
          limit: 25,
          workflowRunId: "workflow-run-id",
        },
        requestId: "queue-workflow-read-action-log-1",
        type: "hobit.action.request",
      },
      exampleInput: {
        limit: 25,
        workflowRunId: "workflow-run-id",
      },
    },
  ],
};

export const HOBIT_AGENT_INITIAL_CAPABILITIES: HobitAgentCapability[] = [
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.workspace.context.get.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read the current live Workspace/Workbench context already held by the running app, with optional Queue control and widget summary reads.",
    forbiddenSideEffects: [
      "dom_scraping",
      "local_storage_truth",
      "transcript_inference",
      "queue_mutation",
      "queue_item_create",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "workspace.context.get",
    inputSchemaDescription:
      "Optional booleans includeQueueControl and includeWidgetSummary. No prose or UI-derived fields are accepted.",
    inputSchema: WORKSPACE_CONTEXT_GET_SCHEMA,
    outputSchemaDescription:
      "Current workspaceId, workspaceRootPath, workbenchId, availability booleans, runtime mode, optional Queue control state, optional widget counts, and missing capability blockers.",
    ownerSurface: "Workbench",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Get Workspace Context",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.workbench.widgets.list.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read a bounded list of live Workbench widget instances and discover Agent Executor widgets by definitionId === \"agent-run\".",
    forbiddenSideEffects: [
      "dom_scraping",
      "ui_text_id_inference",
      "title_id_inference",
      "widget_order_id_inference",
      "queue_mutation",
      "queue_item_create",
      "auto_run_workers",
      "queue_autorun",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "workbench.widgets.list",
    inputSchemaDescription:
      "Optional exact definitionIdFilter, visibleOnly, and includeTitles. Agent Executor discovery uses definitionId only.",
    inputSchema: WORKBENCH_WIDGETS_LIST_SCHEMA,
    outputSchemaDescription:
      "Bounded widget instance summaries, Agent Executor widget summaries, recommendedExecutorWidgetId only when exactly one safe executor exists, and no/ambiguous executor blockers.",
    ownerSurface: "Workbench",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "List Workbench Widgets",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.control.get.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read typed backend-owned Queue control state for the current workspace through the existing Queue control bridge.",
    forbiddenSideEffects: [
      "queue_control_set",
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
    id: "queue.control.get",
    inputSchemaDescription:
      "Optional exact workspaceId. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_CONTROL_GET_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.control.get"],
    outputSchemaDescription:
      "Workspace id, status disabled/manual_enabled, version, updatedAt, updatedByActorId, reason, backendOwned flag, and explicit no-worker/no-mutation flags.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Get Queue Control",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.control.setManualEnabled.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "recommended",
    defaultForProductActions: true,
    description:
      "Set backend-owned Queue control state to manual_enabled through the typed Queue control bridge without starting workers or scheduler dispatch.",
    forbiddenSideEffects: [
      "queue_item_create",
      "queue_item_update",
      "queue_task_mutation",
      "run_link_create",
      "worker_start",
      "scheduler_dispatch",
      "queue_autorun",
      "downstream_start",
      "workflow_invocation",
      "evidence_mutation",
      "review_mutation",
      "finalization_mutation",
      "codex_run",
      "shell_command",
      "terminal_launch",
      "git_mutation",
      "validation_execution",
      "rollback_execution",
    ],
    id: "queue.control.setManualEnabled",
    inputSchemaDescription:
      "Optional exact workspaceId, expectedVersion, and bounded reason. No ids, actorId, or confirmation/prose fields are accepted.",
    inputSchema: QUEUE_CONTROL_SET_MANUAL_ENABLED_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.control.setManualEnabled"],
    outputSchemaDescription:
      "Workspace id, resultStatus succeeded/already_in_state/invalid_input/workspace_not_found/version_conflict/failed_unexpected, bounded controlState, and explicit no-worker/no-scheduler/no-task/no-evidence/no-review/no-finalization/no-workflow flags.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "write",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Set Queue Manual Control",
  },
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
      "Queue item title and runnable prompt are required. Optional fields: status, description, dependsOn, source, sourceMetadata, id.",
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
      "A non-empty items array is required. Every item requires title and runnable prompt. Optional item fields: status, description, dependsOn, source, sourceMetadata, id.",
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
      "Read bounded singleton Workspace Queue task summaries from backend/Tauri authoritative aggregate DTOs with explicit task ids, state dimensions, blockers, nextActions, latest run, durability, and available executor ids.",
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
      "Optional limit and optional explicit taskId. Returns bounded product-facing backend aggregate summaries, not raw internal JSON or frontend Queue board state.",
    inputSchema: QUEUE_ITEMS_LIST_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.items.list"],
    outputSchemaDescription:
      "Bounded backend aggregate Queue task summaries with taskId, title, ticket/worker/review/evidence/validation/commit/dependency states, blockers, nextActions, latestRun, durableFlags, and available executor widget ids.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "List Queue Items",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.workflow.get.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read one workspace-scoped Queue workflow run summary through the existing backend/Tauri workflow read API.",
    forbiddenSideEffects: [...QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS],
    id: "queue.workflow.get",
    inputSchemaDescription:
      "workflowRunId is required. Optional exact workspaceId must match current Workspace context. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_WORKFLOW_GET_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.workflow.get"],
    outputSchemaDescription:
      "Workflow run id, workflow id, request id, status, phase/currentStep, timestamps, bounded variable/slot summaries, explicit continuation refs by slot, blockers, missing capabilities, and no-mutation flags.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Get Queue Workflow Run",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: ["hobit.agent.capability.queue.workflow.list.requested"],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read bounded workspace-scoped Queue workflow run summaries through the existing backend/Tauri workflow list API.",
    forbiddenSideEffects: [...QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS],
    id: "queue.workflow.list",
    inputSchemaDescription:
      "Optional exact workspaceId, status, workflowId, and bounded limit. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_WORKFLOW_LIST_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.workflow.list"],
    outputSchemaDescription:
      "Bounded workflow run summaries with workflowRunId, workflowId, requestId, status, phase/currentStep, updatedAt, continuation refs by slot, total, and truncated flag.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "List Queue Workflow Runs",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.workflow.getReport.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read a bounded workspace-scoped Queue workflow report and continuation refs from the existing backend/Tauri workflow report API.",
    forbiddenSideEffects: [...QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS],
    id: "queue.workflow.getReport",
    inputSchemaDescription:
      "workflowRunId is required. Optional exact workspaceId must match current Workspace context. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_WORKFLOW_GET_REPORT_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.workflow.getReport"],
    outputSchemaDescription:
      "Workflow run status, phase/currentStep, task/run/evidence/message/completion/failure decision ids by slot, blockers, resume status, action count summary, bounded action summaries, bounded report summary, and no raw provider transcript or raw confirmationToken.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Get Queue Workflow Report",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.workflow.planResume.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read a workspace-scoped Queue workflow resume plan from the existing backend/Tauri read-only resume planner.",
    forbiddenSideEffects: [...QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS],
    id: "queue.workflow.planResume",
    inputSchemaDescription:
      "workflowRunId is required. Optional exact workspaceId and expectedVersion. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_WORKFLOW_PLAN_RESUME_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.workflow.planResume"],
    outputSchemaDescription:
      "Resume status, nextPhase/nextStep, blockers, requiredFreshGrant, requiredConfirmation, continuation refs by slot, task snapshots, worker orphan/start-state blockers, and no-mutation flags.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Plan Queue Workflow Resume",
  },
  {
    allowedAgentRoles: ["workspace_agent", "test_harness"],
    auditEventNames: [
      "hobit.agent.capability.queue.workflow.readActionLog.requested",
    ],
    availability: { status: "available" },
    confirmationRequirement: "none",
    defaultForProductActions: true,
    description:
      "Read bounded Queue workflow action summaries by projecting the existing backend/Tauri workflow report action ledger.",
    forbiddenSideEffects: [...QUEUE_WORKFLOW_READ_FORBIDDEN_SIDE_EFFECTS],
    id: "queue.workflow.readActionLog",
    inputSchemaDescription:
      "workflowRunId is required. Optional exact workspaceId, bounded limit, and exact action status filter. No prose or UI-derived fields are accepted.",
    inputSchema: QUEUE_WORKFLOW_READ_ACTION_LOG_SCHEMA,
    examples: QUEUE_RUN_CONTROL_EXAMPLES["queue.workflow.readActionLog"],
    outputSchemaDescription:
      "Bounded action summaries with actionType, status, idempotencyKey, safe target/result refs, blocker code/message, timestamps, total, truncated flag, and no raw logs or raw confirmationToken.",
    ownerSurface: "Agent Queue",
    restricted: false,
    sideEffectLevel: "read",
    supportsDryRun: true,
    supportsSelfTest: true,
    title: "Read Queue Workflow Action Log",
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
      "Start exactly one explicit Queue-linked Direct Work run for a supplied taskId and executorWidgetId through existing assigned-task start plumbing after Queue has been explicitly enabled.",
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
      `taskId and executorWidgetId are required in input. Top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD}="${QUEUE_START_RUN_CONFIRMATION_TOKEN}" is required after explicit operator confirmation; prose confirmation is insufficient.`,
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
