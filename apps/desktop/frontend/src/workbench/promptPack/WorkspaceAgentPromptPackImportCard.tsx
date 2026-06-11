import { useMemo, useState } from "react";

import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import {
  ActionFact,
  QueueTextarea,
} from "../WorkspaceAgentQueueActionCardShared";
import {
  PROMPT_PACK_IN_MEMORY_SOURCE_ADAPTER,
  PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER,
  promptPackPreviewFromFileEntries,
  promptPackPreviewFromSourceText,
} from "./promptPackImportPreview";
import type {
  PromptPackFileEntry,
  PromptPackImportPreviewModel,
  PromptPackMaterializationResult,
} from "./promptPackModel";
import { PromptPackImportPreviewCard } from "./promptPackImportPreviewComponent";
import { PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS } from "./promptPackSourceAdapter";

export type WorkspaceAgentPromptPackImportState = {
  readonly id: string;
  readonly isCancelled?: boolean;
  readonly result?: PromptPackMaterializationResult;
  readonly sourceEntries?: readonly PromptPackFileEntry[];
  readonly sourcePath?: string;
  readonly sourceText: string;
  readonly sourceUnavailableReason?: string;
};

export type CreateQueueItemsFromPromptPackPreview = (
  preview: PromptPackImportPreviewModel,
) => Promise<PromptPackMaterializationResult>;

type WorkspaceAgentPromptPackImportCardProps = {
  createQueueItemsFromPromptPackPreview?: CreateQueueItemsFromPromptPackPreview;
  importState: WorkspaceAgentPromptPackImportState;
  onCancel: (importId: string) => void;
  onOpenQueueItem?: (queueItemId: string) => void;
  onPatch: (
    importId: string,
    patch: Partial<WorkspaceAgentPromptPackImportState>,
  ) => void;
  onReadPromptPackSource?: (request: {
    path: string;
  }) => Promise<readonly PromptPackFileEntry[]>;
  onSelectPromptPackFolder?: () => Promise<string | null>;
};

export function WorkspaceAgentPromptPackImportCard({
  createQueueItemsFromPromptPackPreview,
  importState,
  onCancel,
  onOpenQueueItem,
  onPatch,
  onReadPromptPackSource,
  onSelectPromptPackFolder,
}: WorkspaceAgentPromptPackImportCardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isReadingSource, setIsReadingSource] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const preview = useMemo(
    () =>
      importState.sourceEntries
        ? promptPackPreviewFromFileEntries(importState.sourceEntries)
        : promptPackPreviewFromSourceText(importState.sourceText),
    [importState.sourceEntries, importState.sourceText],
  );
  const result = importState.result;
  const firstCreatedTask = result?.createdTasks[0];
  const createDisabledReason = promptPackImportCreateDisabledReason({
    bridgeAvailable: Boolean(createQueueItemsFromPromptPackPreview),
    importState,
    isCreating,
    preview,
    result,
  });
  const canCreate = !createDisabledReason;

  async function createQueueItems() {
    if (!preview || !canCreate || !createQueueItemsFromPromptPackPreview) {
      return;
    }

    setIsCreating(true);
    setCopyStatus(null);
    try {
      const materialized = await createQueueItemsFromPromptPackPreview(preview);
      onPatch(importState.id, { result: materialized });
    } catch (error) {
      onPatch(importState.id, {
        result: promptPackImportActionFailureResult(error),
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function browsePromptPackFolder() {
    if (!onSelectPromptPackFolder || result || importState.isCancelled) {
      return;
    }

    setCopyStatus(null);
    try {
      const selectedPath = await onSelectPromptPackFolder();
      if (!selectedPath) {
        return;
      }
      onPatch(importState.id, {
        sourceEntries: undefined,
        sourcePath: selectedPath,
        sourceUnavailableReason: undefined,
      });
    } catch (error) {
      onPatch(importState.id, {
        sourceEntries: undefined,
        sourceUnavailableReason: errorToMessage(
          error,
          "Folder picker failed. No Queue items were created.",
        ),
      });
    }
  }

  async function readPromptPackSource() {
    const sourcePath = importState.sourcePath?.trim();
    if (
      !sourcePath ||
      !onReadPromptPackSource ||
      isReadingSource ||
      result ||
      importState.isCancelled
    ) {
      return;
    }

    setIsReadingSource(true);
    setCopyStatus(null);
    try {
      const entries = await onReadPromptPackSource({ path: sourcePath });
      onPatch(importState.id, {
        sourceEntries: entries,
        sourceUnavailableReason: undefined,
      });
    } catch (error) {
      onPatch(importState.id, {
        sourceEntries: undefined,
        sourceUnavailableReason: errorToMessage(
          error,
          "Prompt-pack source could not be read. No Queue items were created.",
        ),
      });
    } finally {
      setIsReadingSource(false);
    }
  }

  async function copyImportSummary() {
    setCopyStatus(null);
    const summary = promptPackImportSummary(preview, result);
    if (!summary.trim()) {
      setCopyStatus("No import summary to copy.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable. No Queue action ran.");
      return;
    }

    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("Import summary copied. No Queue action ran.");
    } catch {
      setCopyStatus("Copy failed. No Queue action ran.");
    }
  }

  return (
    <section
      aria-label="Workspace Chat prompt-pack import"
      className="workspace-agent-queue-action-card workspace-agent-queue-intent-card"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">queue.importPromptPack</p>
          <h4 className="coordinator-proposal-title">Import prompt pack</h4>
          <p className="coordinator-proposal-note">
            Read a local folder/file source in desktop, or paste a prompt-batch
            JSON manifest or one numbered Markdown prompt.
          </p>
        </div>
        <Badge
          variant={
            importState.isCancelled
              ? "neutral"
              : result
                ? result.ok
                  ? "success"
                  : "error"
                : preview?.importAvailable
                  ? "info"
                  : "warning"
          }
        >
          {importState.isCancelled
            ? "Cancelled"
            : result
              ? result.ok
                ? "Created"
                : "Failed"
              : preview?.importAvailable
                ? "Preview ready"
                : "Needs source"}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact
          label="Folder/file source"
          value={
            onReadPromptPackSource
              ? PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS.label
              : "Unavailable"
          }
        />
        <ActionFact
          label="Zip source"
          value={PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER.message}
        />
        <ActionFact
          label="Preview source"
          value={
            preview
              ? importState.sourceEntries
                ? `${PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS.label} (${importState.sourceEntries.length.toString()} files)`
                : PROMPT_PACK_IN_MEMORY_SOURCE_ADAPTER.label
              : importState.sourcePath
                ? "Pending path source read"
                : "No pasted source"
          }
        />
        {importState.sourcePath ? (
          <ActionFact label="Requested source" value={importState.sourcePath} />
        ) : null}
        <ActionFact
          label="Create behavior"
          value="Creates draft Queue items only; no run, Autorun, validation, commit, or push starts."
        />
      </dl>

      {result || importState.isCancelled ? null : (
        <div className="coordinator-proposal-section">
          <label className="coordinator-proposal-section-label" htmlFor={`${importState.id}-source-path`}>
            Prompt-pack folder/file path
          </label>
          <div className="coordinator-proposal-actions">
            <input
              aria-label="Prompt-pack folder/file path"
              className="input"
              id={`${importState.id}-source-path`}
              onChange={(event) =>
                onPatch(importState.id, {
                  sourceEntries: undefined,
                  sourcePath: event.target.value,
                  sourceUnavailableReason: undefined,
                })
              }
              placeholder="C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack"
              type="text"
              value={importState.sourcePath ?? ""}
            />
            <Button
              disabled={!onSelectPromptPackFolder || isReadingSource}
              onClick={() => void browsePromptPackFolder()}
              title={
                onSelectPromptPackFolder
                  ? "Select a prompt-pack folder path. Reading still requires the separate preview action."
                  : "Folder picker unavailable in this runtime."
              }
              variant="secondary"
            >
              Browse folder
            </Button>
            <Button
              disabled={
                !onReadPromptPackSource ||
                !importState.sourcePath?.trim() ||
                isReadingSource
              }
              onClick={() => void readPromptPackSource()}
              title={readSourceDisabledReason({
                importState,
                isReadingSource,
                readerAvailable: Boolean(onReadPromptPackSource),
              })}
              variant="primary"
            >
              {isReadingSource ? "Reading" : "Read source preview"}
            </Button>
          </div>
        </div>
      )}

      {importState.sourcePath &&
      !preview &&
      !result &&
      !importState.isCancelled ? (
        <p className="workspace-agent-queue-intent-validation" role="status">
          Preview-source unavailable: {importState.sourcePath} has not produced
          readable prompt-pack entries.{" "}
          {importState.sourceUnavailableReason ??
            readSourceDisabledReason({
              importState,
              isReadingSource,
              readerAvailable: Boolean(onReadPromptPackSource),
            })}
        </p>
      ) : null}

      {importState.sourcePath &&
      preview &&
      importState.sourceEntries &&
      !result &&
      !importState.isCancelled ? (
        <p className="coordinator-proposal-note" role="status">
          Source preview loaded from {importState.sourcePath}. Prompt bodies are
          available in memory only until Queue item creation is explicitly
          confirmed.
        </p>
      ) : null}

      {result || importState.isCancelled ? null : (
        <QueueTextarea
          label="Prompt-pack source"
          onChange={(sourceText) =>
            onPatch(importState.id, {
              sourceEntries: undefined,
              sourceText,
              sourceUnavailableReason: undefined,
            })
          }
          value={importState.sourceText}
        />
      )}

      {importState.isCancelled && !result ? (
        <p className="workspace-agent-queue-intent-validation" role="status">
          Import was cancelled. No Queue items were created.
        </p>
      ) : (
        <PromptPackImportPreviewCard
          actions={
            result
              ? undefined
              : {
                  cancel: {
                    disabled: Boolean(importState.isCancelled) || isCreating,
                    label: "Cancel",
                    onClick: () => onCancel(importState.id),
                  },
                  create: {
                    disabled: Boolean(createDisabledReason),
                    disabledReason: createDisabledReason,
                    isPending: isCreating,
                    label: "Create Queue items",
                    onClick: () => void createQueueItems(),
                  },
                }
          }
          preview={preview}
        />
      )}

      {result ? (
        <PromptPackImportResult
          onCopyImportSummary={() => void copyImportSummary()}
          onOpenQueueItem={onOpenQueueItem}
          result={result}
        />
      ) : null}

      {result ? (
        <div className="coordinator-proposal-actions">
          <Button
            disabled={!firstCreatedTask || !onOpenQueueItem}
            onClick={() =>
              firstCreatedTask
                ? onOpenQueueItem?.(firstCreatedTask.queueItemId)
                : undefined
            }
            variant="primary"
          >
            Open Queue
          </Button>
          <Button
            disabled={!firstCreatedTask || !onOpenQueueItem}
            onClick={() =>
              firstCreatedTask
                ? onOpenQueueItem?.(firstCreatedTask.queueItemId)
                : undefined
            }
            variant="secondary"
          >
            Open created task
          </Button>
          <Button onClick={() => void copyImportSummary()} variant="ghost">
            Copy import summary
          </Button>
        </div>
      ) : null}
      {copyStatus ? (
        <p className="coordinator-proposal-note" role="status">
          {copyStatus}
        </p>
      ) : null}
      <p className="coordinator-proposal-note">
        Import is explicit. Preview, source editing, copying, and opening Queue
        links do not create, run, assign, validate, finalize, commit, or push.
      </p>
    </section>
  );
}

function readSourceDisabledReason({
  importState,
  isReadingSource,
  readerAvailable,
}: {
  importState: WorkspaceAgentPromptPackImportState;
  isReadingSource: boolean;
  readerAvailable: boolean;
}) {
  if (isReadingSource) {
    return "Prompt-pack source is being read.";
  }
  if (!readerAvailable) {
    return "Typed prompt-pack folder/file reader is unavailable in this runtime.";
  }
  if (!importState.sourcePath?.trim()) {
    return "Enter or browse for a prompt-pack folder/file path before reading preview.";
  }
  return "Read README.md, prompt-batch.json, and numbered Markdown prompts into the preview only.";
}

function promptPackImportCreateDisabledReason({
  bridgeAvailable,
  importState,
  isCreating,
  preview,
  result,
}: {
  bridgeAvailable: boolean;
  importState: WorkspaceAgentPromptPackImportState;
  isCreating: boolean;
  preview: PromptPackImportPreviewModel | null;
  result: PromptPackMaterializationResult | undefined;
}) {
  if (result) {
    return "Import already created Queue items.";
  }
  if (importState.isCancelled) {
    return "Import was cancelled. No Queue items will be created.";
  }
  if (isCreating) {
    return "Queue items are being created.";
  }
  if (!bridgeAvailable) {
    return "Workspace Agent prompt-pack Queue create action is unavailable. No Queue items can be created from this import card.";
  }
  if (!preview) {
    return "Paste prompt-pack source before creating Queue items.";
  }
  if (!preview.importAvailable) {
    return (
      preview.errors[0]?.message ??
      "Prompt-pack preview has blocking errors. No Queue items can be created."
    );
  }
  return null;
}

function PromptPackImportResult({
  onCopyImportSummary,
  onOpenQueueItem,
  result,
}: {
  onCopyImportSummary: () => void;
  onOpenQueueItem?: (queueItemId: string) => void;
  result: PromptPackMaterializationResult;
}) {
  return (
    <div
      aria-label="Prompt-pack import result"
      className="coordinator-proposal-section"
    >
      <p className="coordinator-proposal-section-label">Created Queue items</p>
      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact
          label="Created count"
          value={result.createdTasks.length.toString()}
        />
        <ActionFact
          label="Dependency links"
          value={dependencyLinkSummary(result)}
        />
        <ActionFact label="Run status" value="No tasks started" />
      </dl>
      {result.createdTasks.length ? (
        <ul className="workspace-agent-queue-action-card-list">
          {result.createdTasks.map((task) => (
            <li key={task.queueItemId}>
              {task.itemId}: {task.title} ({task.queueItemId}){" "}
              <Button
                disabled={!onOpenQueueItem}
                onClick={() => onOpenQueueItem?.(task.queueItemId)}
                variant="ghost"
              >
                Open task
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="coordinator-proposal-note">
          No Queue items were created.
        </p>
      )}
      <PromptPackMaterializationDiagnostics
        emptyLabel="No dependency links were created."
        label="Created dependency links"
        values={result.dependencyLinksCreated.map(
          (link) =>
            `${link.dependentItemId} -> ${link.dependencyItemId}: created (${link.dependentQueueItemId ?? "unknown dependent Queue id"} depends on ${link.dependencyQueueItemId ?? "unknown dependency Queue id"})`,
        )}
      />
      <PromptPackMaterializationDiagnostics
        emptyLabel="No dependency links were skipped."
        label="Skipped dependency links"
        values={result.dependencyLinksSkipped.map(
          (link) =>
            `${link.dependentItemId} -> ${link.dependencyItemId}: ${link.message ?? "skipped"}`,
        )}
      />
      <PromptPackMaterializationDiagnostics
        emptyLabel="No import warnings."
        label="Warnings"
        values={result.warnings.map((warning) => warning.message)}
      />
      <PromptPackMaterializationDiagnostics
        emptyLabel="No import errors."
        label="Errors"
        values={result.errors.map((error) => error.message)}
      />
      <details className="workspace-agent-queue-action-details">
        <summary>Import summary</summary>
        <pre>{promptPackImportSummary(null, result)}</pre>
        <Button onClick={onCopyImportSummary} variant="ghost">
          Copy import summary
        </Button>
      </details>
    </div>
  );
}

function PromptPackMaterializationDiagnostics({
  emptyLabel,
  label,
  values,
}: {
  emptyLabel: string;
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="coordinator-proposal-section">
      <p className="coordinator-proposal-section-label">{label}</p>
      {values.length ? (
        <ul className="workspace-agent-queue-action-card-list">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="coordinator-proposal-note">{emptyLabel}</p>
      )}
    </div>
  );
}

function promptPackImportSummary(
  preview: PromptPackImportPreviewModel | null,
  result: PromptPackMaterializationResult | undefined,
) {
  const lines = [
    "Prompt-pack import summary",
    preview ? `Pack: ${preview.pack.name} (${preview.pack.id})` : null,
    preview ? `Preview items: ${preview.selectedItems.length.toString()}` : null,
    result
      ? `Created Queue items: ${result.createdTasks.length.toString()}`
      : null,
    ...((result?.createdTasks ?? []).map(
      (task) => `- ${task.itemId}: ${task.title} (${task.queueItemId})`,
    )),
    result
      ? `Dependency links created: ${result.dependencyLinksCreated.length.toString()}`
      : null,
    result
      ? `Dependency links skipped: ${result.dependencyLinksSkipped.length.toString()}`
      : null,
    result ? `Warnings: ${result.warnings.length.toString()}` : null,
    result ? `Errors: ${result.errors.length.toString()}` : null,
    "No tasks started.",
    "No Queue run, Autorun, validation, commit, push, rollback, or Terminal action was started by import.",
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function dependencyLinkSummary(result: PromptPackMaterializationResult) {
  return `${result.dependencyLinksCreated.length.toString()} created, ${result.dependencyLinksSkipped.length.toString()} skipped`;
}

function promptPackImportActionFailureResult(
  error: unknown,
): PromptPackMaterializationResult {
  return {
    createdTasks: [],
    dependencyLinksCreated: [],
    dependencyLinksSkipped: [],
    errors: [
      {
        code: "import_blocked",
        message: errorToMessage(
          error,
          "Prompt-pack Queue creation failed before Queue items were created.",
        ),
      },
    ],
    ok: false,
    warnings: [],
  };
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
