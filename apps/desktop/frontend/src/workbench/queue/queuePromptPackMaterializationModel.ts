import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  RunCodexDirectWorkRequest,
  SmartQueueBlockerKind,
  SmartQueueDependencyGate,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types";
import type {
  PromptPackDiagnostic,
  PromptPackImportItem,
  PromptPackImportPreviewModel,
} from "../promptPack/promptPackModel";

export const WORKSPACE_QUEUE_SINGLETON_ID = "workspace-queue";

export type PromptPackImportInput = {
  preview: PromptPackImportPreviewModel;
  queue: {
    id: typeof WORKSPACE_QUEUE_SINGLETON_ID;
    state: Extract<SmartQueueState, "active" | "paused">;
  };
  defaults?: {
    approvalPolicy?: RunCodexDirectWorkRequest["approvalPolicy"] | null;
    commitPolicy?: QueuePromptPackCommitPolicy | null;
    executionPolicy?: AgentQueueTaskExecutionPolicy;
    executionWorkspace?: string | null;
    provider?: string | null;
    sandbox?: RunCodexDirectWorkRequest["sandbox"] | null;
    validationPolicy?: QueuePromptPackValidationPolicy | null;
  };
};

export type QueuePromptPackValidationPolicy = {
  commands: string[];
  profile: string | null;
};

export type QueuePromptPackCommitPolicy = {
  expectedCommitTitle: string | null;
  mode: "none" | "operator_review";
};

export type QueuePromptPackTaskSettings = {
  approvalPolicy: RunCodexDirectWorkRequest["approvalPolicy"] | null;
  commitPolicy: QueuePromptPackCommitPolicy;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace: string | null;
  model: string | null;
  provider: string | null;
  reasoning: string | null;
  sandbox: RunCodexDirectWorkRequest["sandbox"] | null;
  validationPolicy: QueuePromptPackValidationPolicy;
};

export type QueueTaskDraft = {
  blocker: QueueTaskDraftBlocker | null;
  dependencyGate: SmartQueueDependencyGate;
  humanStatus: SmartQueueTaskHumanStatus;
  itemType: AgentQueueTaskItemType;
  order: number;
  priority: number;
  prompt: string;
  queueId: typeof WORKSPACE_QUEUE_SINGLETON_ID;
  settings: QueuePromptPackTaskSettings;
  source: QueuePromptPackTaskSource;
  taskId: string;
  title: string;
  upstreamTaskIds: string[];
};

export type QueueDependencyDraft = {
  createdBy: "queue_importer";
  dependencyId: string;
  downstreamTaskId: string;
  kind: "blocks_start";
  sourceDependencyItemId: string;
  sourceDownstreamItemId: string;
  upstreamTaskId: string;
};

export type QueueBatchPreview = {
  batchId: string;
  dependencies: QueueDependencyDraft[];
  productWarnings: string[];
  queue: {
    id: typeof WORKSPACE_QUEUE_SINGLETON_ID;
    isActive: boolean;
    state: Extract<SmartQueueState, "active" | "paused">;
  };
  settingsSummary: QueueBatchSettingsSummary;
  tasks: QueueTaskDraft[];
};

export type QueueBatchMaterializationResult = {
  batch: QueueBatchPreview;
  blockedTasks: QueueTaskDraft[];
  errors: QueueBatchMaterializationValidationIssue[];
  readyCandidates: QueueTaskDraft[];
  waitingDependencyCandidates: QueueTaskDraft[];
  warnings: QueueBatchMaterializationValidationIssue[];
  wouldStartWorkers: false;
};

export type QueueBatchSettingsSummary = {
  approvalPolicies: string[];
  commitPolicies: string[];
  models: string[];
  providers: string[];
  reasoning: string[];
  sandboxes: string[];
  validationProfiles: string[];
};

export type QueueBatchMaterializationValidationIssue = {
  blockerKind?: SmartQueueBlockerKind;
  code:
    | "invalid_dependency"
    | "missing_config"
    | "missing_prompt"
    | "preview_blocked"
    | "queue_active_import_warning"
    | "singleton_queue_required";
  itemId?: string;
  message: string;
};

export type QueueTaskDraftBlocker = {
  kind: Extract<SmartQueueBlockerKind, "missing_config" | "missing_prompt">;
  message: string;
};

export type QueuePromptPackTaskSource = {
  itemId: string;
  packId: string;
  packName: string;
  promptFileOrder: number | null;
  sourcePath: string | null;
  tags: string[];
};

export function buildQueueBatchMaterializationResult(
  input: PromptPackImportInput,
): QueueBatchMaterializationResult {
  const singletonIssue = validateSingletonQueue(input.queue.id);
  const previewIssues = input.preview.errors.map(previewErrorToIssue);
  const taskIdByItemId = new Map(
    input.preview.selectedItems.map((item) => [
      item.id,
      queueTaskId(input.preview.pack.id, item.id),
    ]),
  );
  const invalidDependencyIssues = invalidDependencyErrors(input.preview, taskIdByItemId);
  const tasks = input.preview.selectedItems.map((item, index) =>
    taskDraftFromItem({ input, item, index, taskIdByItemId }),
  );
  const dependencies = dependencyDrafts(input.preview.selectedItems, taskIdByItemId);
  const productWarnings =
    input.queue.state === "active"
      ? [
          "Queue is Active. Eligible imported tasks may start after creation when the scheduler evaluates the completed graph.",
        ]
      : [];
  const warnings = [
    ...productWarnings.map(
      (message): QueueBatchMaterializationValidationIssue => ({
        code: "queue_active_import_warning",
        message,
      }),
    ),
  ];
  const errors = [
    ...(singletonIssue ? [singletonIssue] : []),
    ...previewIssues,
    ...invalidDependencyIssues,
    ...tasks
      .map((task) => task.blocker)
      .filter((blocker): blocker is QueueTaskDraftBlocker => blocker !== null)
      .map((blocker): QueueBatchMaterializationValidationIssue => ({
        blockerKind: blocker.kind,
        code: blocker.kind,
        message: blocker.message,
      })),
  ];
  const batch = {
    batchId: `queue-batch-${input.preview.pack.id}`,
    dependencies,
    productWarnings,
    queue: {
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      isActive: input.queue.state === "active",
      state: input.queue.state,
    },
    settingsSummary: settingsSummary(tasks),
    tasks,
  } satisfies QueueBatchPreview;

  return {
    batch,
    blockedTasks: tasks.filter((task) => task.humanStatus === "blocked"),
    errors,
    readyCandidates: tasks.filter((task) => task.humanStatus === "ready"),
    waitingDependencyCandidates: tasks.filter(
      (task) => task.humanStatus === "waiting_dependency",
    ),
    warnings,
    wouldStartWorkers: false,
  };
}

function taskDraftFromItem({
  input,
  item,
  index,
  taskIdByItemId,
}: {
  input: PromptPackImportInput;
  item: PromptPackImportItem;
  index: number;
  taskIdByItemId: ReadonlyMap<string, string>;
}): QueueTaskDraft {
  const blocker = taskBlocker(item, taskIdByItemId);
  const upstreamTaskIds = item.dependencies
    .map((dependencyId) => taskIdByItemId.get(dependencyId))
    .filter((taskId): taskId is string => Boolean(taskId));
  const hasDependencies = upstreamTaskIds.length > 0;

  return {
    blocker,
    dependencyGate: hasDependencies ? "waiting" : "none",
    humanStatus: blocker
      ? "blocked"
      : hasDependencies
        ? "waiting_dependency"
        : "ready",
    itemType: item.itemType,
    order: item.numericOrder ?? index + 1,
    priority: item.priority,
    prompt: item.queueDraft.prompt || item.promptBody,
    queueId: WORKSPACE_QUEUE_SINGLETON_ID,
    settings: {
      approvalPolicy: input.defaults?.approvalPolicy ?? null,
      commitPolicy: {
        expectedCommitTitle:
          item.expectedCommitTitle ??
          input.defaults?.commitPolicy?.expectedCommitTitle ??
          null,
        mode: commitPolicyMode(item, input.defaults?.commitPolicy),
      },
      executionPolicy:
        item.queueDraft.executionPolicy ??
        input.defaults?.executionPolicy ??
        "manual",
      executionWorkspace:
        item.executionWorkspace ?? input.defaults?.executionWorkspace ?? null,
      model: item.modelProfile,
      provider: input.defaults?.provider ?? null,
      reasoning: item.reasoningEffort,
      sandbox: input.defaults?.sandbox ?? null,
      validationPolicy: {
        commands:
          item.validationCommands.length > 0
            ? item.validationCommands
            : input.defaults?.validationPolicy?.commands ?? [],
        profile:
          item.validatorProfile ??
          input.defaults?.validationPolicy?.profile ??
          null,
      },
    },
    source: {
      itemId: item.id,
      packId: input.preview.pack.id,
      packName: input.preview.pack.name,
      promptFileOrder: item.numericOrder,
      sourcePath: item.sourcePath,
      tags: item.tags,
    },
    taskId: queueTaskId(input.preview.pack.id, item.id),
    title: `${item.id}: ${item.title}`.trim(),
    upstreamTaskIds,
  };
}

function commitPolicyMode(
  item: PromptPackImportItem,
  defaultPolicy: QueuePromptPackCommitPolicy | null | undefined,
): QueuePromptPackCommitPolicy["mode"] {
  if (item.expectedCommitTitle) {
    return "operator_review";
  }

  return defaultPolicy?.mode ?? "none";
}

function taskBlocker(
  item: PromptPackImportItem,
  taskIdByItemId: ReadonlyMap<string, string>,
): QueueTaskDraftBlocker | null {
  if (!item.promptBody.trim() && !item.queueDraft.prompt.trim()) {
    return {
      kind: "missing_prompt",
      message: `Prompt-pack item "${item.id}" is missing prompt text.`,
    };
  }

  const missingDependency = item.dependencies.find(
    (dependencyId) => !taskIdByItemId.has(dependencyId),
  );
  if (missingDependency) {
    return {
      kind: "missing_config",
      message: `Prompt-pack item "${item.id}" depends on missing item "${missingDependency}".`,
    };
  }

  return null;
}

function dependencyDrafts(
  items: readonly PromptPackImportItem[],
  taskIdByItemId: ReadonlyMap<string, string>,
) {
  return items.flatMap((item) =>
    item.dependencies.flatMap((dependencyId) => {
      const upstreamTaskId = taskIdByItemId.get(dependencyId);
      const downstreamTaskId = taskIdByItemId.get(item.id);
      if (!upstreamTaskId || !downstreamTaskId) {
        return [];
      }

      return [
        {
          createdBy: "queue_importer" as const,
          dependencyId: `${upstreamTaskId}->${downstreamTaskId}`,
          downstreamTaskId,
          kind: "blocks_start" as const,
          sourceDependencyItemId: dependencyId,
          sourceDownstreamItemId: item.id,
          upstreamTaskId,
        },
      ];
    }),
  );
}

function invalidDependencyErrors(
  preview: PromptPackImportPreviewModel,
  taskIdByItemId: ReadonlyMap<string, string>,
): QueueBatchMaterializationValidationIssue[] {
  return preview.selectedItems.flatMap((item) =>
    item.dependencies
      .filter((dependencyId) => !taskIdByItemId.has(dependencyId))
      .map((dependencyId) => ({
        blockerKind: "missing_config" as const,
        code: "invalid_dependency" as const,
        itemId: item.id,
        message: `Prompt-pack item "${item.id}" depends on missing or unselected item "${dependencyId}".`,
      })),
  );
}

function previewErrorToIssue(
  diagnostic: PromptPackDiagnostic,
): QueueBatchMaterializationValidationIssue {
  return {
    blockerKind:
      diagnostic.code === "missing_body" ? "missing_prompt" : "missing_config",
    code: "preview_blocked",
    itemId: diagnostic.itemId,
    message: diagnostic.message,
  };
}

function validateSingletonQueue(
  queueId: string,
): QueueBatchMaterializationValidationIssue | null {
  if (queueId === WORKSPACE_QUEUE_SINGLETON_ID) {
    return null;
  }

  return {
    code: "singleton_queue_required",
    message:
      'Prompt-pack Queue materialization must target the singleton Workspace Queue "workspace-queue".',
  };
}

function queueTaskId(packId: string, itemId: string) {
  return `queue-task-${packId}-${itemId}`;
}

function settingsSummary(tasks: readonly QueueTaskDraft[]): QueueBatchSettingsSummary {
  return {
    approvalPolicies: uniqueSettings(
      tasks.map((task) => task.settings.approvalPolicy ?? "default"),
    ),
    commitPolicies: uniqueSettings(
      tasks.map((task) => task.settings.commitPolicy.mode),
    ),
    models: uniqueSettings(tasks.map((task) => task.settings.model ?? "default")),
    providers: uniqueSettings(
      tasks.map((task) => task.settings.provider ?? "default"),
    ),
    reasoning: uniqueSettings(
      tasks.map((task) => task.settings.reasoning ?? "default"),
    ),
    sandboxes: uniqueSettings(tasks.map((task) => task.settings.sandbox ?? "default")),
    validationProfiles: uniqueSettings(
      tasks.map((task) => task.settings.validationPolicy.profile ?? "default"),
    ),
  };
}

function uniqueSettings(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
