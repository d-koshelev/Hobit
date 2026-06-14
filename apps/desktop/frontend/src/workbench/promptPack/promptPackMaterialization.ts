import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import {
  WORKSPACE_QUEUE_SINGLETON_ID,
  buildQueueBatchMaterializationResult,
  type QueueTaskDraft,
} from "../queue/queuePromptPackMaterializationModel";
import type {
  PromptPackCreatedQueueTask,
  PromptPackDependencyMaterializationLink,
  PromptPackImportItem,
  PromptPackImportPreviewModel,
  PromptPackMaterializationDiagnostic,
  PromptPackMaterializationResult,
  PromptPackMetadata,
} from "./promptPackModel";

export type MaterializePromptPackPreviewToQueueOptions = {
  bridge?: WorkspaceAgentQueueBridge | null;
  confirmed: boolean;
  currentWorkspaceRoot?: string | null;
  preview: PromptPackImportPreviewModel;
};

type CreatedTaskRecord = PromptPackCreatedQueueTask & {
  item: PromptPackImportItem;
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
  const materialization = buildQueueBatchMaterializationResult({
    defaults: {
      approvalPolicy: queueDefaults?.approvalPolicy ?? null,
      executionWorkspace:
        normalizedExecutionWorkspace(currentWorkspaceRoot) ??
        normalizedExecutionWorkspace(queueDefaults?.executionWorkspace),
      sandbox: queueDefaults?.sandbox ?? null,
    },
    preview,
    queue: {
      id: WORKSPACE_QUEUE_SINGLETON_ID,
      state: "paused",
    },
  });
  const taskDraftByItemId = new Map(
    materialization.batch.tasks.map((task) => [task.source.itemId, task]),
  );

  if (!confirmed) {
    errors.push({
      code: "import_blocked",
      message:
        "Prompt-pack materialization requires an explicit confirmed preview. No Queue items were created.",
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  if (!preview.importAvailable) {
    errors.push({
      code: "import_blocked",
      message:
        preview.errors[0]?.message ??
        "Prompt-pack preview has blocking errors. No Queue items were created.",
    });
    return result({ createdTasks, dependencyLinksCreated, dependencyLinksSkipped, errors, warnings });
  }

  const blockedImportTask = materialization.blockedTasks[0];
  if (blockedImportTask) {
    errors.push({
      code: "import_blocked",
      itemId: blockedImportTask.source.itemId,
      message:
        blockedImportTask.blocker?.message ??
        `Prompt-pack item "${blockedImportTask.source.itemId}" cannot be imported.`,
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

  for (const item of preview.selectedItems) {
    warnings.push(...unsupportedMetadataWarnings(item));
    const taskDraft = taskDraftByItemId.get(item.id);
    const executionWorkspace =
      normalizedExecutionWorkspace(taskDraft?.settings.executionWorkspace) ??
      normalizedExecutionWorkspace(item.executionWorkspace) ??
      normalizedExecutionWorkspace(currentWorkspaceRoot) ??
      normalizedExecutionWorkspace(queueDefaults?.executionWorkspace);

    try {
      const createResult = await bridge.createItem({
        approvalPolicy: taskDraft?.settings.approvalPolicy ?? null,
        codexExecutable: queueDefaults?.codexExecutable ?? null,
        dependencies: [],
        description: materializedDescription(preview.pack, item),
        executionPolicy: taskDraft?.settings.executionPolicy ?? item.queueDraft.executionPolicy,
        executionWorkspace,
        itemType: item.itemType,
        priority: item.priority,
        prompt: materializedPrompt(preview.pack, item, executionWorkspace),
        queueTag: item.tags[0] ? { name: item.tags[0] } : undefined,
        sandbox: taskDraft?.settings.sandbox ?? null,
        status: queueCreateStatusForTask(taskDraft),
        title: materializedTitle(item),
      });

      if (!createResult.ok || !createResult.item) {
        errors.push({
          code: "item_create_failed",
          itemId: item.id,
          message:
            createResult.error?.message ??
            createResult.message ??
            `Queue item creation failed for prompt-pack item "${item.id}".`,
        });
        continue;
      }

      const created = {
        itemId: item.id,
        queueItemId: createResult.item.id,
        title: createResult.item.title,
      };
      createdTasks.push(created);
      createdByItemId.set(item.id, { ...created, item });
    } catch (error) {
      errors.push({
        code: "item_create_failed",
        itemId: item.id,
        message: errorToMessage(
          error,
          `Queue item creation failed for prompt-pack item "${item.id}".`,
        ),
      });
    }
  }

  for (const item of preview.selectedItems) {
    const dependent = createdByItemId.get(item.id);
    if (!dependent || item.dependencies.length === 0) {
      continue;
    }

    const linkedDependencyIds: string[] = [];
    const linkedDependencyRecords: CreatedTaskRecord[] = [];

    for (const dependencyItemId of item.dependencies) {
      const dependency = createdByItemId.get(dependencyItemId);
      if (!dependency) {
        const message = `Dependency "${dependencyItemId}" for prompt-pack item "${item.id}" was not created, so no Queue dependency link was added.`;
        warnings.push({
          code: "dependency_link_skipped",
          dependencyItemId,
          itemId: item.id,
          message,
        });
        warnings.push({
          code: "queue_blocked_status_unsupported",
          dependencyItemId,
          itemId: item.id,
          message:
            "Current Queue create/update actions do not support setting a blocked task state during prompt-pack materialization; the unresolved dependency is reported here instead.",
        });
        dependencyLinksSkipped.push({
          dependencyItemId,
          dependentItemId: item.id,
          dependentQueueItemId: dependent.queueItemId,
          message,
          status: "skipped",
        });
        continue;
      }

      linkedDependencyIds.push(dependency.queueItemId);
      linkedDependencyRecords.push(dependency);
    }

    if (linkedDependencyIds.length === 0) {
      continue;
    }

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
          `Queue dependency update failed for prompt-pack item "${item.id}".`;
        errors.push({
          code: "dependency_link_failed",
          itemId: item.id,
          message,
        });
        for (const dependency of linkedDependencyRecords) {
          dependencyLinksSkipped.push({
            dependencyItemId: dependency.itemId,
            dependencyQueueItemId: dependency.queueItemId,
            dependentItemId: item.id,
            dependentQueueItemId: dependent.queueItemId,
            message,
            status: "skipped",
          });
        }
        continue;
      }

      for (const dependency of linkedDependencyRecords) {
        dependencyLinksCreated.push({
          dependencyItemId: dependency.itemId,
          dependencyQueueItemId: dependency.queueItemId,
          dependentItemId: item.id,
          dependentQueueItemId: dependent.queueItemId,
          status: "created",
        });
      }
    } catch (error) {
      const message = errorToMessage(
        error,
        `Queue dependency update failed for prompt-pack item "${item.id}".`,
      );
      errors.push({
        code: "dependency_link_failed",
        itemId: item.id,
        message,
      });
      for (const dependency of linkedDependencyRecords) {
        dependencyLinksSkipped.push({
          dependencyItemId: dependency.itemId,
          dependencyQueueItemId: dependency.queueItemId,
          dependentItemId: item.id,
          dependentQueueItemId: dependent.queueItemId,
          message,
          status: "skipped",
        });
      }
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

function queueCreateStatusForTask(taskDraft: QueueTaskDraft | undefined) {
  return taskDraft?.humanStatus === "ready"
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

function materializedTitle(item: PromptPackImportItem) {
  return `${item.id}: ${item.title}`.trim();
}

function materializedDescription(
  pack: PromptPackMetadata,
  item: PromptPackImportItem,
) {
  return [
    `Prompt pack: ${pack.name} (${pack.id})`,
    `Prompt item: ${item.id}`,
    item.sourcePath ? `Source path: ${item.sourcePath}` : null,
    item.tags.length > 0 ? `Tags: ${item.tags.join(", ")}` : null,
    item.modelProfile ? `Model profile: ${item.modelProfile}` : null,
    item.reasoningEffort ? `Reasoning effort: ${item.reasoningEffort}` : null,
    item.validatorProfile ? `Validator profile: ${item.validatorProfile}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function materializedPrompt(
  pack: PromptPackMetadata,
  item: PromptPackImportItem,
  executionWorkspace: string | null,
) {
  const lines = [
    "",
    "",
    "Prompt pack materialization metadata",
    `Pack: ${pack.name} (${pack.id})`,
    `Block id: ${item.id}`,
    item.sourcePath ? `Source path: ${item.sourcePath}` : null,
    `Priority: ${item.priority.toString()}`,
    item.tags.length > 0 ? `Tags: ${item.tags.join(", ")}` : null,
    executionWorkspace ? `Execution workspace: ${executionWorkspace}` : null,
    item.modelProfile ? `Model profile: ${item.modelProfile}` : null,
    item.reasoningEffort ? `Reasoning effort: ${item.reasoningEffort}` : null,
    item.validatorProfile ? `Validator profile: ${item.validatorProfile}` : null,
    item.dependencies.length > 0
      ? `Prompt-pack dependencies: ${item.dependencies.join(", ")}`
      : null,
    item.expectedCommitTitle
      ? `Expected commit title: ${item.expectedCommitTitle}`
      : null,
    ...sectionLines("Validation commands", item.validationCommands),
    ...sectionLines("Allowed scope", item.allowedScope),
    ...sectionLines("Forbidden scope", item.forbiddenScope),
    item.suggestedDependencyIds.length > 0
      ? `Suggested dependency ids: ${item.suggestedDependencyIds.join(", ")}`
      : null,
    "Queue dependency links are created after all selected prompt-pack items are created. Imported Queue items must not auto-run.",
    "Do not auto-finalize, auto-commit, auto-push, or run dependent tasks.",
  ].filter((line): line is string => line !== null);

  return `${item.promptBody}${lines.join("\n")}`;
}

function normalizedExecutionWorkspace(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}

function unsupportedMetadataWarnings(
  item: PromptPackImportItem,
): PromptPackMaterializationDiagnostic[] {
  const fields = [
    item.allowedScope.length > 0 ? "allowed scope" : null,
    item.expectedCommitTitle ? "expected commit title" : null,
    item.forbiddenScope.length > 0 ? "forbidden scope" : null,
    item.modelProfile ? "model profile" : null,
    item.numericOrder !== null ? "numeric order" : null,
    item.reasoningEffort ? "reasoning effort" : null,
    item.sourcePath ? "source path" : null,
    item.suggestedDependencyIds.length > 0 ? "suggested dependencies" : null,
    item.tags.length > 1 ? "additional tags" : null,
    item.validationCommands.length > 0 ? "validation commands" : null,
    item.validatorProfile ? "validator profile" : null,
  ].filter((field): field is string => field !== null);

  if (fields.length === 0) {
    return [];
  }

  return [
    {
      code: "queue_metadata_field_unsupported",
      itemId: item.id,
      message: `Queue has no first-class field for ${fields.join(", ")} on prompt-pack item "${item.id}"; materialization preserved this metadata in the Queue prompt body.`,
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
