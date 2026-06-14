import type {
  PromptPackImportItem,
  PromptPackMetadata,
} from "../promptPack/promptPackModel";
import {
  materializeSmartQueuePromptPack,
  type SmartQueueMaterializationPreview,
  type SmartQueuePromptInput,
  type SmartQueuePromptPackInput,
  type SmartQueuePromptPackSettings,
} from "./smartQueuePromptPackMaterialization";

export type PromptPackPreviewForSmartQueueMaterialization = {
  readonly pack: PromptPackMetadata;
  readonly selectedItems: readonly PromptPackImportItem[];
};

export type SmartQueuePromptPackPreviewAdapterOptions = {
  readonly defaultSettings?: SmartQueuePromptPackSettings;
};

export function promptPackPreviewToSmartQueuePromptPackInput(
  preview: PromptPackPreviewForSmartQueueMaterialization,
  options: SmartQueuePromptPackPreviewAdapterOptions = {},
): SmartQueuePromptPackInput {
  return {
    defaultSettings: options.defaultSettings,
    prompts: preview.selectedItems.map(promptPackItemToSmartQueuePrompt),
    sourceName: preview.pack.name,
    sourcePackId: preview.pack.id,
    sourcePath: preview.pack.sourcePaths[0] ?? null,
  };
}

export function buildSmartQueueMaterializationFromPromptPackPreview(
  preview: PromptPackPreviewForSmartQueueMaterialization,
  options: SmartQueuePromptPackPreviewAdapterOptions = {},
): SmartQueueMaterializationPreview {
  return materializeSmartQueuePromptPack(
    promptPackPreviewToSmartQueuePromptPackInput(preview, options),
  );
}

function promptPackItemToSmartQueuePrompt(
  item: PromptPackImportItem,
  index: number,
): SmartQueuePromptInput {
  return {
    body: item.promptBody,
    dependencies: item.dependencies,
    promptId: item.id,
    promptNumber: item.numericOrder ?? index + 1,
    settings: promptPackItemSettings(item),
    sourceName: item.sourcePath ? item.sourcePath.split("/").pop() ?? null : null,
    sourcePath: item.sourcePath,
    title: item.title,
  };
}

function promptPackItemSettings(
  item: PromptPackImportItem,
): SmartQueuePromptPackSettings {
  return withoutUndefined({
    allowedScope: item.allowedScope,
    commitPolicy: item.expectedCommitTitle
      ? {
          expectedCommitTitle: item.expectedCommitTitle,
          mode: "operator_review",
        }
      : undefined,
    executionPolicy: item.queueDraft.executionPolicy,
    executionWorkspace: item.executionWorkspace ?? undefined,
    forbiddenScope: item.forbiddenScope,
    itemType: item.itemType,
    model: item.modelProfile ?? undefined,
    priority: item.priority,
    reasoning: item.reasoningEffort ?? undefined,
    tags: item.tags,
    validationPolicy:
      item.validationCommands.length > 0 || item.validatorProfile
        ? {
            commands: item.validationCommands,
            profile: item.validatorProfile,
          }
        : undefined,
  });
}

function withoutUndefined(
  settings: Record<string, unknown>,
): SmartQueuePromptPackSettings {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  );
}
