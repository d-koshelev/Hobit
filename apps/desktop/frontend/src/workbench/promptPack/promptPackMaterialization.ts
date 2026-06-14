import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import {
  SMART_QUEUE_WORKSPACE_QUEUE_ID,
  type SmartQueueMaterializedTask,
  type SmartQueueMaterializationIssue,
  type SmartQueueMaterializationPreview,
  type SmartQueuePromptPackSettings,
} from "../queue/smartQueuePromptPackMaterialization";
import type {
  PromptPackCreatedQueueTask,
  PromptPackDependencyMaterializationLink,
  PromptPackImportPreviewModel,
  PromptPackMaterializationDiagnostic,
  PromptPackMaterializationResult,
} from "./promptPackModel";
import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";

export type MaterializePromptPackPreviewToQueueOptions = {
  bridge?: WorkspaceAgentQueueBridge | null;
  confirmed: boolean;
  currentWorkspaceRoot?: string | null;
  preview: PromptPackImportPreviewModel;
};

type CreatedTaskRecord = PromptPackCreatedQueueTask & {
  task: SmartQueueMaterializedTask;
};

export async function materializePromptPackPreviewToQueue({
  bridge,
  confirmed,
  currentWorkspaceRoot,
  preview,
}: MaterializePromptPackPreviewToQueueOptions): Promise<PromptPackMaterializationResult> {
  const createdTasks: PromptPackCreatedQueueTask[] = [];
  const createdByItemId = new Map<string, CreatedTaskRecord>();
  const dependencyLinksCreated: PromptPackDependencyMaterializationLink[] = [];
  const dependencyLinksSkipped: PromptPackDependencyMaterializationLink[] = [];
  const warnings: PromptPackMaterializationDiagnostic[] = [];
  const errors: PromptPackMaterializationDiagnostic[] = [];
  const queueDefaults = bridge?.getRunSettingsDefaults?.() ?? null;
  const materialization = preview.smartQueueMaterialization;
  const unsafeIssue = blockingMaterializationIssue(materialization);
  const materializationTaskById = new Map(
    materialization.tasks.map((task) => [task.taskId, task]),
  );

  if (!confirmed) {
    errors.push({
      code: "import_blocked",
      message:
        "Prompt-pack materialization requires an explicit confirmed preview. No Queue items were created.",
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  if (materialization.queue.queueId !== SMART_QUEUE_WORKSPACE_QUEUE_ID) {
    errors.push({
      code: "import_blocked",
      message:
        'Cannot create Queue items: prompt-pack import must target the singleton Workspace Queue.',
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  if (!preview.importAvailable) {
    errors.push({
      code: "import_blocked",
      message: cannotCreateMessage(
        preview.errors[0]?.message ??
          "Prompt-pack preview has blocking errors.",
      ),
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  if (unsafeIssue) {
    errors.push({
      code: "import_blocked",
      itemId: unsafeIssue.sourcePromptId,
      message: cannotCreateMessage(issueShortReason(unsafeIssue)),
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  const invalidEdge = materialization.dependencies.find(
    (dependency) =>
      !materializationTaskById.has(dependency.upstreamTaskId) ||
      !materializationTaskById.has(dependency.downstreamTaskId),
  );
  if (invalidEdge) {
    errors.push({
      code: "import_blocked",
      itemId: invalidEdge.sourceDownstreamPromptId,
      message: cannotCreateMessage("dependency graph cannot be represented"),
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  if (!bridge) {
    errors.push({
      code: "import_blocked",
      message:
        "Workspace Agent Queue bridge is unavailable. No Queue items were created.",
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  for (const task of [...materialization.tasks].sort((left, right) => left.order - right.order)) {
    warnings.push(...unsupportedMetadataWarnings(task));
    const executionWorkspace =
      normalizedExecutionWorkspace(task.settings.executionWorkspace) ??
      normalizedExecutionWorkspace(currentWorkspaceRoot) ??
      normalizedExecutionWorkspace(queueDefaults?.executionWorkspace);

    try {
      const createResult = await bridge.createItem({
        approvalPolicy:
          normalizeApprovalPolicy(task.settings.approvalPolicy) ??
          queueDefaults?.approvalPolicy ??
          null,
        codexExecutable:
          stringSetting(task.settings.codexExecutable) ??
          queueDefaults?.codexExecutable ??
          null,
        dependencies: [],
        description: materializedDescription(task),
        executionPolicy: normalizeExecutionPolicy(task.settings.executionPolicy),
        executionWorkspace,
        itemType: normalizeItemType(task.settings.itemType),
        priority: numberSetting(task.settings.priority) ?? 3,
        prompt: materializedPrompt(task, executionWorkspace),
        queueTag: firstTag(task.settings.tags)
          ? { name: firstTag(task.settings.tags) }
          : undefined,
        sandbox:
          normalizeSandbox(task.settings.sandbox) ?? queueDefaults?.sandbox ?? null,
        status: queueCreateStatusForTask(task),
        title: materializedTitle(task),
      });

      if (!createResult.ok || !createResult.item) {
        errors.push({
          code: "item_create_failed",
          itemId: task.source.promptId,
          message:
            createResult.error?.message ??
            createResult.message ??
            `Queue item creation failed for prompt-pack item "${task.source.promptId}".`,
        });
        continue;
      }

      const created = {
        itemId: task.source.promptId,
        queueItemId: createResult.item.id,
        title: createResult.item.title,
      };
      createdTasks.push(created);
      createdByItemId.set(task.source.promptId, { ...created, task });
    } catch (error) {
      errors.push({
        code: "item_create_failed",
        itemId: task.source.promptId,
        message: errorToMessage(
          error,
          `Queue item creation failed for prompt-pack item "${task.source.promptId}".`,
        ),
      });
    }
  }

  for (const dependency of materialization.dependencies) {
    const upstreamTask = materializationTaskById.get(dependency.upstreamTaskId);
    const downstreamTask = materializationTaskById.get(dependency.downstreamTaskId);
    if (!upstreamTask || !downstreamTask) {
      continue;
    }

    const dependent = createdByItemId.get(downstreamTask.source.promptId);
    if (!dependent) {
      continue;
    }

    const upstream = createdByItemId.get(upstreamTask.source.promptId);
    if (!upstream) {
      const message = `Dependency "${upstreamTask.source.promptId}" for prompt-pack item "${downstreamTask.source.promptId}" was not created, so no Queue dependency link was added.`;
      warnings.push({
        code: "dependency_link_skipped",
        dependencyItemId: upstreamTask.source.promptId,
        itemId: downstreamTask.source.promptId,
        message,
      });
      warnings.push({
        code: "queue_blocked_status_unsupported",
        dependencyItemId: upstreamTask.source.promptId,
        itemId: downstreamTask.source.promptId,
        message:
          "Current Queue create/update actions do not support setting a blocked task state during prompt-pack materialization; the unresolved dependency is reported here instead.",
      });
      dependencyLinksSkipped.push({
        dependencyItemId: upstreamTask.source.promptId,
        dependentItemId: downstreamTask.source.promptId,
        dependentQueueItemId: dependent.queueItemId,
        message,
        status: "skipped",
      });
      continue;
    }

    const existingDependencyIds = dependencyLinksCreated
      .filter((link) => link.dependentItemId === downstreamTask.source.promptId)
      .map((link) => link.dependencyQueueItemId)
      .filter((queueItemId): queueItemId is string => Boolean(queueItemId));
    const linkedDependencyIds = [...existingDependencyIds, upstream.queueItemId];

    try {
      const updateResult = await bridge.updateItem({
        itemId: dependent.queueItemId,
        patch: {
          dependencies: linkedDependencyIds,
        },
        reason:
          "Materialize prompt-pack dependency links after creating all selected Queue items.",
      });

      if (!updateResult.ok) {
        const message =
            updateResult.error?.message ??
            updateResult.message ??
          `Queue dependency update failed for prompt-pack item "${downstreamTask.source.promptId}".`;
        errors.push({
          code: "dependency_link_failed",
          itemId: downstreamTask.source.promptId,
          message,
        });
        dependencyLinksSkipped.push({
          dependencyItemId: upstream.itemId,
          dependencyQueueItemId: upstream.queueItemId,
          dependentItemId: downstreamTask.source.promptId,
          dependentQueueItemId: dependent.queueItemId,
          message,
          status: "skipped",
        });
        continue;
      }

      dependencyLinksCreated.push({
        dependencyItemId: upstream.itemId,
        dependencyQueueItemId: upstream.queueItemId,
        dependentItemId: downstreamTask.source.promptId,
        dependentQueueItemId: dependent.queueItemId,
        status: "created",
      });
    } catch (error) {
      const message = errorToMessage(
        error,
        `Queue dependency update failed for prompt-pack item "${downstreamTask.source.promptId}".`,
      );
      errors.push({
        code: "dependency_link_failed",
        itemId: downstreamTask.source.promptId,
        message,
      });
      dependencyLinksSkipped.push({
        dependencyItemId: upstream.itemId,
        dependencyQueueItemId: upstream.queueItemId,
        dependentItemId: downstreamTask.source.promptId,
        dependentQueueItemId: dependent.queueItemId,
        message,
        status: "skipped",
      });
    }
  }

  return result({
    createdTasks,
    dependencyLinksCreated,
    dependencyLinksSkipped,
    errors,
    warnings,
  });
}

function queueCreateStatusForTask(task: SmartQueueMaterializedTask) {
  return task.humanStatus.status === "ready"
    ? ("queued" as const)
    : ("draft" as const);
}

function result({
  createdTasks,
  dependencyLinksCreated,
  dependencyLinksSkipped,
  errors,
  warnings,
}: Omit<PromptPackMaterializationResult, "ok">): PromptPackMaterializationResult {
  return {
    createdTasks,
    dependencyLinksCreated,
    dependencyLinksSkipped,
    errors,
    ok: errors.length === 0,
    warnings,
  };
}

function materializedTitle(task: SmartQueueMaterializedTask) {
  return `${task.source.promptId}: ${task.title}`.trim();
}

function materializedDescription(task: SmartQueueMaterializedTask) {
  return [
    `Prompt pack: ${task.source.packName ?? "Prompt Pack"} (${task.source.packId})`,
    `Prompt item: ${task.source.promptId}`,
    `Prompt number: ${task.source.promptNumber.toString()}`,
    task.source.sourcePath ? `Source path: ${task.source.sourcePath}` : null,
    listSetting(task.settings.tags).length > 0
      ? `Tags: ${listSetting(task.settings.tags).join(", ")}`
      : null,
    task.settings.model ? `Model profile: ${String(task.settings.model)}` : null,
    task.settings.reasoning
      ? `Reasoning effort: ${String(task.settings.reasoning)}`
      : null,
    validationProfile(task.settings)
      ? `Validator profile: ${validationProfile(task.settings)}`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function materializedPrompt(
  task: SmartQueueMaterializedTask,
  executionWorkspace: string | null,
) {
  const validationPolicy = validationPolicySetting(task.settings);
  const commitPolicy = commitPolicySetting(task.settings);
  const allowedScope = listSetting(task.settings.allowedScope);
  const forbiddenScope = listSetting(task.settings.forbiddenScope);
  const tags = listSetting(task.settings.tags);
  const lines = [
    "",
    "",
    "Prompt pack materialization metadata",
    `Pack: ${task.source.packName ?? "Prompt Pack"} (${task.source.packId})`,
    `Block id: ${task.source.promptId}`,
    `Prompt number: ${task.source.promptNumber.toString()}`,
    task.source.sourcePath ? `Source path: ${task.source.sourcePath}` : null,
    `Priority: ${(numberSetting(task.settings.priority) ?? 3).toString()}`,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
    executionWorkspace ? `Execution workspace: ${executionWorkspace}` : null,
    task.settings.model ? `Model profile: ${String(task.settings.model)}` : null,
    task.settings.reasoning
      ? `Reasoning effort: ${String(task.settings.reasoning)}`
      : null,
    validationPolicy?.profile
      ? `Validator profile: ${String(validationPolicy.profile)}`
      : null,
    task.requestedDependencyReferences.length > 0
      ? `Prompt-pack dependencies: ${task.requestedDependencyReferences.join(", ")}`
      : null,
    commitPolicy?.expectedCommitTitle
      ? `Expected commit title: ${String(commitPolicy.expectedCommitTitle)}`
      : null,
    ...sectionLines("Validation commands", validationPolicy?.commands ?? []),
    ...sectionLines("Allowed scope", allowedScope),
    ...sectionLines("Forbidden scope", forbiddenScope),
    `Smart Queue task id: ${task.taskId}`,
    `Smart Queue human status: ${task.humanStatus.label}`,
    `Smart Queue dependency gate: ${task.dependencyGate.gate}`,
    "Queue dependency links are created from the Smart Queue materialized graph after all selected prompt-pack items are created. Imported Queue items must not auto-run.",
    "Do not auto-finalize, auto-commit, auto-push, or run dependent tasks.",
  ].filter((line): line is string => line !== null);

  return `${task.prompt}${lines.join("\n")}`;
}

function normalizedExecutionWorkspace(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}

function unsupportedMetadataWarnings(
  task: SmartQueueMaterializedTask,
): PromptPackMaterializationDiagnostic[] {
  const validationPolicy = validationPolicySetting(task.settings);
  const commitPolicy = commitPolicySetting(task.settings);
  const fields = [
    listSetting(task.settings.allowedScope).length > 0 ? "allowed scope" : null,
    commitPolicy?.expectedCommitTitle ? "expected commit title" : null,
    listSetting(task.settings.forbiddenScope).length > 0
      ? "forbidden scope"
      : null,
    task.settings.model ? "model profile" : null,
    task.source.promptNumber ? "numeric order" : null,
    task.settings.reasoning ? "reasoning effort" : null,
    task.source.sourcePath ? "source path" : null,
    listSetting(task.settings.tags).length > 1 ? "additional tags" : null,
    validationPolicy?.commands?.length ? "validation commands" : null,
    validationPolicy?.profile ? "validator profile" : null,
  ].filter((field): field is string => field !== null);

  if (fields.length === 0) {
    return [];
  }

  return [
    {
      code: "queue_metadata_field_unsupported",
      itemId: task.source.promptId,
      message: `Queue has no first-class field for ${fields.join(", ")} on prompt-pack item "${task.source.promptId}"; Smart Queue materialization preserved this metadata in the Queue prompt body.`,
    },
  ];
}

function sectionLines(title: string, values: readonly string[]) {
  return values.length > 0 ? [title, ...values.map((value) => `- ${value}`)] : [];
}

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function blockingMaterializationIssue(
  materialization: SmartQueueMaterializationPreview,
) {
  return materialization.issues.find((issue) =>
    [
      "circular_dependency",
      "missing_config",
      "missing_dependency",
      "missing_prompt",
    ].includes(issue.code),
  );
}

function issueShortReason(issue: SmartQueueMaterializationIssue) {
  switch (issue.code) {
    case "circular_dependency":
      return "circular dependency";
    case "missing_config":
      return "missing required settings";
    case "missing_dependency":
      return "missing dependency";
    case "missing_prompt":
      return "missing prompt";
    default:
      return issue.reason || issue.message;
  }
}

function cannotCreateMessage(reason: string) {
  const cleanReason = reason.trim().replace(/^Cannot create Queue items:\s*/i, "");
  return `Cannot create Queue items: ${cleanReason}`;
}

function stringSetting(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberSetting(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function listSetting(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function firstTag(value: unknown) {
  return listSetting(value)[0] ?? null;
}

function validationPolicySetting(settings: SmartQueuePromptPackSettings) {
  const value = settings.validationPolicy;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as { commands?: unknown; profile?: unknown };
  return {
    commands: listSetting(record.commands),
    profile: stringSetting(record.profile),
  };
}

function validationProfile(settings: SmartQueuePromptPackSettings) {
  return validationPolicySetting(settings)?.profile ?? null;
}

function commitPolicySetting(settings: SmartQueuePromptPackSettings) {
  const value = settings.commitPolicy;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as { expectedCommitTitle?: unknown; mode?: unknown };
  return {
    expectedCommitTitle: stringSetting(record.expectedCommitTitle),
    mode: stringSetting(record.mode),
  };
}

function normalizeExecutionPolicy(
  value: unknown,
): AgentQueueTaskExecutionPolicy {
  const normalized = stringSetting(value);
  return normalized === "auto" || normalized === "after_previous_success"
    ? normalized
    : "manual";
}

function normalizeItemType(value: unknown): AgentQueueTaskItemType {
  const normalized = stringSetting(value);
  return normalized === "diff_review" ||
    normalized === "follow_up" ||
    normalized === "validation"
    ? normalized
    : "implementation";
}

function normalizeApprovalPolicy(
  value: unknown,
): DirectWorkApprovalPolicy | null {
  const normalized = stringSetting(value)?.replace(/-/g, "_");
  return normalized === "never" ||
    normalized === "on_request" ||
    normalized === "untrusted"
    ? normalized
    : null;
}

function normalizeSandbox(value: unknown): DirectWorkSandbox | null {
  const normalized = stringSetting(value)?.replace(/-/g, "_");
  return normalized === "danger_full_access" ||
    normalized === "read_only" ||
    normalized === "workspace_write"
    ? normalized
    : null;
}
