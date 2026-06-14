import type {
  SmartQueueBlockerKind,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";
import {
  computeDependencyGate,
  computeHumanQueueStatus,
  type SmartQueueBlocker,
  type SmartQueueDependency,
  type SmartQueueDependencyGate,
  type SmartQueueHumanStatus,
  type SmartQueueTaskInput,
} from "./smartQueueEligibility";

export const SMART_QUEUE_WORKSPACE_QUEUE_ID = "workspace-queue";
export const SMART_QUEUE_WORKSPACE_QUEUE_SINGLETON_KEY = "workspace-queue";

export type SmartQueuePromptPackSettings = {
  readonly approvalPolicy?: string | null;
  readonly codexExecutable?: string | null;
  readonly commitPolicy?: unknown;
  readonly executionWorkspace?: string | null;
  readonly model?: string | null;
  readonly provider?: string | null;
  readonly reasoning?: string | null;
  readonly sandbox?: string | null;
  readonly validationPolicy?: unknown;
  readonly [settingName: string]: unknown;
};

export type SmartQueuePromptDependencyReference =
  | string
  | number
  | {
      readonly promptId?: string;
      readonly promptNumber?: number;
    };

export type SmartQueuePromptInput = {
  readonly promptId?: string;
  readonly promptNumber?: number;
  readonly title: string;
  readonly body: string;
  readonly dependencies?: readonly SmartQueuePromptDependencyReference[];
  readonly requiredSettings?: readonly string[];
  readonly settings?: SmartQueuePromptPackSettings;
  readonly sourceName?: string | null;
  readonly sourcePath?: string | null;
};

export type SmartQueuePromptPackInput = {
  readonly sourcePackId?: string;
  readonly sourceName?: string | null;
  readonly sourcePath?: string | null;
  readonly defaultSettings?: SmartQueuePromptPackSettings;
  readonly prompts: readonly SmartQueuePromptInput[];
  readonly requiredSettings?: readonly string[];
};

export type SmartQueueMaterializedDependency = {
  readonly dependencyId: string;
  readonly downstreamTaskId: string;
  readonly kind: "blocks_start";
  readonly sourceDependencyReference: string;
  readonly sourceDownstreamPromptId: string;
  readonly upstreamTaskId: string;
};

export type SmartQueueMaterializationIssue = {
  readonly affectedTaskIds: readonly string[];
  readonly code:
    | "circular_dependency"
    | "missing_config"
    | "missing_dependency"
    | "missing_prompt";
  readonly message: string;
  readonly reason: string;
  readonly sourcePromptId?: string;
};

export type SmartQueueMaterializedTask = {
  readonly blockedReason?: string;
  readonly blockers: readonly SmartQueueBlocker[];
  readonly dependencyGate: SmartQueueDependencyGate;
  readonly humanStatus: SmartQueueHumanStatus;
  readonly lifecycle: SmartQueueTaskInput["lifecycle"];
  readonly order: number;
  readonly prompt: string;
  readonly queueId: typeof SMART_QUEUE_WORKSPACE_QUEUE_ID;
  readonly requestedDependencyReferences: readonly string[];
  readonly settings: SmartQueuePromptPackSettings;
  readonly source: {
    readonly packId: string;
    readonly packName: string | null;
    readonly packPath: string | null;
    readonly promptId: string;
    readonly promptNumber: number;
    readonly sourceName: string | null;
    readonly sourcePath: string | null;
  };
  readonly taskId: string;
  readonly title: string;
  readonly upstreamTaskIds: readonly string[];
  readonly wouldStart: false;
};

export type SmartQueueMaterializationPreview = {
  readonly dependencies: readonly SmartQueueMaterializedDependency[];
  readonly issues: readonly SmartQueueMaterializationIssue[];
  readonly queue: {
    readonly queueId: typeof SMART_QUEUE_WORKSPACE_QUEUE_ID;
    readonly singleton: true;
    readonly singletonKey: typeof SMART_QUEUE_WORKSPACE_QUEUE_SINGLETON_KEY;
    readonly scope: "workspace";
  };
  readonly summary: {
    readonly blockedTaskCount: number;
    readonly dependencyCount: number;
    readonly readyTaskCount: number;
    readonly taskCount: number;
    readonly waitingDependencyCount: number;
  };
  readonly tasks: readonly SmartQueueMaterializedTask[];
  readonly wouldStartTasks: false;
};

type PromptRecord = {
  readonly input: SmartQueuePromptInput;
  readonly order: number;
  readonly sourcePromptId: string;
  readonly sourcePromptNumber: number;
  readonly taskId: string;
};

type ValidationBlocker = {
  readonly kind: SmartQueueBlockerKind;
  readonly reason: string;
};

export function materializeSmartQueuePromptPack(
  input: SmartQueuePromptPackInput,
): SmartQueueMaterializationPreview {
  const packId = input.sourcePackId?.trim() || "prompt-pack";
  const promptRecords = input.prompts.map((prompt, index) =>
    promptRecord(prompt, index, packId),
  );
  const promptRefToTaskId = promptReferenceMap(promptRecords);
  const validationBlockersByTaskId = new Map<string, ValidationBlocker[]>();
  const issues: SmartQueueMaterializationIssue[] = [];

  for (const record of promptRecords) {
    addPromptValidationIssues({
      input,
      issues,
      promptRefToTaskId,
      record,
      validationBlockersByTaskId,
    });
  }

  const dependencies = materializedDependencies(promptRecords, promptRefToTaskId);
  const cycleTaskIds = circularTaskIds(
    promptRecords.map((record) => record.taskId),
    dependencies,
  );

  for (const taskId of cycleTaskIds) {
    const record = promptRecords.find((candidate) => candidate.taskId === taskId);
    addValidationBlocker(validationBlockersByTaskId, taskId, {
      kind: "missing_config",
      reason: "circular dependency",
    });
    issues.push({
      affectedTaskIds: [taskId],
      code: "circular_dependency",
      message: `Prompt "${record?.sourcePromptId ?? taskId}" is part of a circular dependency.`,
      reason: "Blocked: circular dependency",
      sourcePromptId: record?.sourcePromptId,
    });
  }

  const eligibilityTasks = promptRecords.map((record) => {
    const validationBlockers = validationBlockersByTaskId.get(record.taskId) ?? [];

    return {
      blockers: validationBlockers.map((blocker): SmartQueueBlocker => ({
        kind: blocker.kind,
        reason: blocker.reason,
        taskId: record.taskId,
      })),
      lifecycle: validationBlockers.length > 0 ? "blocked" : "ready",
      taskId: record.taskId,
      title: record.input.title,
    } satisfies SmartQueueTaskInput;
  });
  const eligibilityDependencies = dependencies.map(
    (dependency): SmartQueueDependency => ({
      dependencyId: dependency.dependencyId,
      downstreamTaskId: dependency.downstreamTaskId,
      kind: "blocks_start",
      upstreamTaskId: dependency.upstreamTaskId,
    }),
  );
  const taskById = new Map(eligibilityTasks.map((task) => [task.taskId, task]));
  const tasks = promptRecords.map((record) => {
    const task = taskById.get(record.taskId);
    if (!task) {
      throw new Error(`Missing materialized task ${record.taskId}`);
    }

    const dependencyGate = computeDependencyGate(
      task,
      eligibilityTasks,
      eligibilityDependencies,
    );
    const validationBlockers = validationBlockersByTaskId.get(record.taskId) ?? [];
    const humanStatus =
      validationBlockers.length > 0
        ? blockedHumanStatus(validationBlockers[0]?.reason)
        : computeHumanQueueStatus(task, dependencyGate);
    const upstreamTaskIds = dependencies
      .filter((dependency) => dependency.downstreamTaskId === record.taskId)
      .map((dependency) => dependency.upstreamTaskId);

    return {
      blockedReason:
        humanStatus.status === "blocked" ? humanStatus.text : undefined,
      blockers: task.blockers ?? [],
      dependencyGate,
      humanStatus,
      lifecycle: task.lifecycle,
      order: record.order,
      prompt: record.input.body,
      queueId: SMART_QUEUE_WORKSPACE_QUEUE_ID,
      requestedDependencyReferences: dependencyReferences(record.input),
      settings: mergeSettings(input.defaultSettings, record.input.settings),
      source: {
        packId,
        packName: input.sourceName ?? null,
        packPath: input.sourcePath ?? null,
        promptId: record.sourcePromptId,
        promptNumber: record.sourcePromptNumber,
        sourceName: record.input.sourceName ?? null,
        sourcePath: record.input.sourcePath ?? null,
      },
      taskId: record.taskId,
      title: record.input.title,
      upstreamTaskIds,
      wouldStart: false,
    } satisfies SmartQueueMaterializedTask;
  });

  return {
    dependencies,
    issues,
    queue: {
      queueId: SMART_QUEUE_WORKSPACE_QUEUE_ID,
      scope: "workspace",
      singleton: true,
      singletonKey: SMART_QUEUE_WORKSPACE_QUEUE_SINGLETON_KEY,
    },
    summary: summarize(tasks, dependencies),
    tasks,
    // Materialization creates the Queue graph only. The scheduler/Active gate
    // owns execution and no task is started by this pure model.
    wouldStartTasks: false,
  };
}

function addPromptValidationIssues({
  input,
  issues,
  promptRefToTaskId,
  record,
  validationBlockersByTaskId,
}: {
  readonly input: SmartQueuePromptPackInput;
  readonly issues: SmartQueueMaterializationIssue[];
  readonly promptRefToTaskId: ReadonlyMap<string, string>;
  readonly record: PromptRecord;
  readonly validationBlockersByTaskId: Map<string, ValidationBlocker[]>;
}) {
  if (!record.input.body.trim()) {
    addValidationBlocker(validationBlockersByTaskId, record.taskId, {
      kind: "missing_prompt",
      reason: "missing prompt",
    });
    issues.push({
      affectedTaskIds: [record.taskId],
      code: "missing_prompt",
      message: `Prompt "${record.sourcePromptId}" is missing prompt text.`,
      reason: "Blocked: missing prompt",
      sourcePromptId: record.sourcePromptId,
    });
  }

  const settings = mergeSettings(input.defaultSettings, record.input.settings);
  const missingSetting = requiredSettings(input, record).find(
    (settingName) => !hasSetting(settings, settingName),
  );

  if (missingSetting) {
    addValidationBlocker(validationBlockersByTaskId, record.taskId, {
      kind: "missing_config",
      reason: "missing config",
    });
    issues.push({
      affectedTaskIds: [record.taskId],
      code: "missing_config",
      message: `Prompt "${record.sourcePromptId}" is missing required Queue setting "${missingSetting}".`,
      reason: "Blocked: missing config",
      sourcePromptId: record.sourcePromptId,
    });
  }

  const missingDependency = dependencyReferences(record.input).find(
    (dependencyRef) => !promptRefToTaskId.has(dependencyRef),
  );

  if (missingDependency !== undefined) {
    addValidationBlocker(validationBlockersByTaskId, record.taskId, {
      kind: "missing_config",
      reason: "missing dependency",
    });
    issues.push({
      affectedTaskIds: [record.taskId],
      code: "missing_dependency",
      message: `Prompt "${record.sourcePromptId}" depends on missing prompt "${missingDependency}".`,
      reason: "Blocked: missing dependency",
      sourcePromptId: record.sourcePromptId,
    });
  }
}

function materializedDependencies(
  promptRecords: readonly PromptRecord[],
  promptRefToTaskId: ReadonlyMap<string, string>,
): SmartQueueMaterializedDependency[] {
  return promptRecords.flatMap((record) =>
    dependencyReferences(record.input).flatMap((dependencyRef) => {
      const upstreamTaskId = promptRefToTaskId.get(dependencyRef);

      if (!upstreamTaskId) {
        return [];
      }

      return [
        {
          dependencyId: `${upstreamTaskId}->${record.taskId}`,
          downstreamTaskId: record.taskId,
          kind: "blocks_start" as const,
          sourceDependencyReference: dependencyRef,
          sourceDownstreamPromptId: record.sourcePromptId,
          upstreamTaskId,
        },
      ];
    }),
  );
}

function promptRecord(
  input: SmartQueuePromptInput,
  index: number,
  packId: string,
): PromptRecord {
  const sourcePromptNumber = input.promptNumber ?? index + 1;
  const sourcePromptId =
    input.promptId?.trim() || padPromptNumber(sourcePromptNumber);

  return {
    input,
    order: index + 1,
    sourcePromptId,
    sourcePromptNumber,
    taskId: queueTaskId(packId, sourcePromptId),
  };
}

function promptReferenceMap(promptRecords: readonly PromptRecord[]) {
  const promptRefToTaskId = new Map<string, string>();

  for (const record of promptRecords) {
    promptRefToTaskId.set(record.sourcePromptId, record.taskId);
    promptRefToTaskId.set(String(record.sourcePromptNumber), record.taskId);
    promptRefToTaskId.set(padPromptNumber(record.sourcePromptNumber), record.taskId);
  }

  return promptRefToTaskId;
}

function dependencyReferences(input: SmartQueuePromptInput) {
  return (input.dependencies ?? []).map(formatDependencyReference);
}

function formatDependencyReference(reference: SmartQueuePromptDependencyReference) {
  if (typeof reference === "number") {
    return String(reference);
  }

  if (typeof reference === "string") {
    return reference;
  }

  if (reference.promptId?.trim()) {
    return reference.promptId.trim();
  }

  if (reference.promptNumber !== undefined) {
    return String(reference.promptNumber);
  }

  return "";
}

function addValidationBlocker(
  blockersByTaskId: Map<string, ValidationBlocker[]>,
  taskId: string,
  blocker: ValidationBlocker,
) {
  const blockers = blockersByTaskId.get(taskId) ?? [];

  if (
    !blockers.some(
      (candidate) =>
        candidate.kind === blocker.kind && candidate.reason === blocker.reason,
    )
  ) {
    blockers.push(blocker);
  }

  blockersByTaskId.set(taskId, blockers);
}

function circularTaskIds(
  taskIds: readonly string[],
  dependencies: readonly SmartQueueMaterializedDependency[],
) {
  const upstreamIdsByTaskId = new Map<string, string[]>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const affectedTaskIds = new Set<string>();
  const stack: string[] = [];

  for (const dependency of dependencies) {
    const upstreamIds = upstreamIdsByTaskId.get(dependency.downstreamTaskId) ?? [];
    upstreamIds.push(dependency.upstreamTaskId);
    upstreamIdsByTaskId.set(dependency.downstreamTaskId, upstreamIds);
  }

  const visit = (taskId: string) => {
    if (visiting.has(taskId)) {
      const cycleStart = stack.indexOf(taskId);
      for (const affectedTaskId of stack.slice(cycleStart)) {
        affectedTaskIds.add(affectedTaskId);
      }
      affectedTaskIds.add(taskId);
      return;
    }

    if (visited.has(taskId)) {
      return;
    }

    visiting.add(taskId);
    stack.push(taskId);

    for (const upstreamTaskId of upstreamIdsByTaskId.get(taskId) ?? []) {
      visit(upstreamTaskId);
    }

    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const taskId of taskIds) {
    visit(taskId);
  }

  return [...affectedTaskIds];
}

function mergeSettings(
  defaults: SmartQueuePromptPackSettings | undefined,
  overrides: SmartQueuePromptPackSettings | undefined,
): SmartQueuePromptPackSettings {
  const merged: Record<string, unknown> = { ...(defaults ?? {}) };

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

function requiredSettings(
  input: SmartQueuePromptPackInput,
  record: PromptRecord,
) {
  return [...(input.requiredSettings ?? []), ...(record.input.requiredSettings ?? [])];
}

function hasSetting(settings: SmartQueuePromptPackSettings, settingName: string) {
  const value = settings[settingName];

  return value !== undefined && value !== null && String(value).trim() !== "";
}

function blockedHumanStatus(reason = "needs intervention"): SmartQueueHumanStatus {
  return {
    label: `Blocked: ${reason}`,
    status: "blocked" satisfies SmartQueueTaskHumanStatus,
    text: `Blocked: ${reason}`,
  };
}

function summarize(
  tasks: readonly SmartQueueMaterializedTask[],
  dependencies: readonly SmartQueueMaterializedDependency[],
) {
  return {
    blockedTaskCount: tasks.filter((task) => task.humanStatus.status === "blocked")
      .length,
    dependencyCount: dependencies.length,
    readyTaskCount: tasks.filter((task) => task.humanStatus.status === "ready")
      .length,
    taskCount: tasks.length,
    waitingDependencyCount: tasks.filter(
      (task) => task.humanStatus.status === "waiting_dependency",
    ).length,
  };
}

function queueTaskId(packId: string, sourcePromptId: string) {
  return `queue-task-${slug(packId)}-${slug(sourcePromptId)}`;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function padPromptNumber(promptNumber: number) {
  return String(promptNumber).padStart(3, "0");
}
