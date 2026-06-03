import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  getWorkspaceGitStatus,
} from "../workspace/workspaceGitApi";
import type {
  GitFileChange,
  GitFileDiff,
  GitLog,
  GitLogEntry,
  GitRepositoryStatus,
} from "../workspace/types";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const MAX_DIRECTORY_ENTRIES = 200;
const MAX_FILE_PREVIEW_BYTES = 100 * 1024;
const MAX_GIT_DIFF_PATCH_BYTES = 96 * 1024;
const MAX_GIT_DIFF_ATTACHMENT_CHARS = 6_000;
const MAX_GIT_HISTORY_ENTRIES = 30;

type FinderEntryKind = "directory" | "file";

type FinderWritableFile = {
  close: () => Promise<void> | void;
  write: (content: string) => Promise<void> | void;
};

type FinderFileHandle = {
  createWritable?: () => Promise<FinderWritableFile>;
  getFile?: () => Promise<File>;
  kind: "file";
  name: string;
};

type FinderDirectoryHandle = {
  entries?: () => AsyncIterableIterator<[string, FinderHandle]>;
  kind: "directory";
  name: string;
  values?: () => AsyncIterableIterator<FinderHandle>;
};

type FinderHandle = FinderDirectoryHandle | FinderFileHandle;

type FinderEntry = {
  handle: FinderHandle;
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

type FinderColumn = {
  capped: boolean;
  entries: FinderEntry[];
  error: string | null;
  handle: FinderDirectoryHandle;
  loading: boolean;
  pathSegments: string[];
};

type FinderSelectedItem = {
  handle: FinderHandle;
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

type FinderRootState = {
  gitRoot: string | null;
  handle: FinderDirectoryHandle | null;
  label: string;
  listingAvailable: boolean;
};

type FinderPreviewPaneState = "hidden" | "minimized" | "normal" | "maximized";

type FinderViewMode = "all" | "changed";

type FinderPreviewMode = "content" | "git";

type FinderFilePreview = {
  canEdit: boolean;
  capped: boolean;
  content: string;
  draft: string;
  editMode: boolean;
  error: string | null;
  handle: FinderFileHandle;
  loading: boolean;
  name: string;
  path: string;
  savedMessage: string | null;
  saving: boolean;
  sizeBytes: number | null;
};

type FinderGitStatusState = {
  error: string | null;
  loading: boolean;
  status: GitRepositoryStatus | null;
};

type FinderGitDiffPreviewState = {
  attachedMessage: string | null;
  diff: GitFileDiff | null;
  error: string | null;
  loading: boolean;
  path: string | null;
};

type FinderGitHistoryState = {
  error: string | null;
  loading: boolean;
  log: GitLog | null;
  selectedHash: string | null;
};

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FinderDirectoryHandle>;
  }
}

export function FinderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onAttachContextToCoordinator,
  onLoadLogs,
  onSelectWorkspaceDirectory,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [columns, setColumns] = useState<FinderColumn[]>([]);
  const [root, setRoot] = useState<FinderRootState | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [isOpeningRoot, setIsOpeningRoot] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinderSelectedItem | null>(
    null,
  );
  const [filePreview, setFilePreview] = useState<FinderFilePreview | null>(
    null,
  );
  const [previewPaneState, setPreviewPaneState] =
    useState<FinderPreviewPaneState>("hidden");
  const [previewMode, setPreviewMode] = useState<FinderPreviewMode>("content");
  const [viewMode, setViewMode] = useState<FinderViewMode>("all");
  const [gitStatus, setGitStatus] = useState<FinderGitStatusState>({
    error: null,
    loading: false,
    status: null,
  });
  const [gitDiffPreview, setGitDiffPreview] =
    useState<FinderGitDiffPreviewState>({
      attachedMessage: null,
      diff: null,
      error: null,
      loading: false,
      path: null,
    });
  const [gitHistory, setGitHistory] = useState<FinderGitHistoryState>({
    error: null,
    loading: false,
    log: null,
    selectedHash: null,
  });

  const selectedPath = selectedItem
    ? selectedItem.pathSegments.join("/")
    : root?.label ?? "No root selected";
  const changedFiles = gitStatus.status?.changedFiles ?? [];
  const changeByPath = buildGitChangeByPath(changedFiles);
  const canUseDirectoryPicker =
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function";

  async function openRoot() {
    if (isOpeningRoot) {
      return;
    }

    setRootError(null);
    setIsOpeningRoot(true);
    setSelectedItem(null);
    setFilePreview(null);
    setPreviewPaneState("hidden");
    setPreviewMode("content");
    resetGitDiffPreview();
    setGitStatus({
      error: null,
      loading: false,
      status: null,
    });
    resetGitHistory();
    setViewMode("all");

    try {
      if (canUseDirectoryPicker && window.showDirectoryPicker) {
        const directoryHandle = await window.showDirectoryPicker();
        const rootLabel = directoryHandle.name || "Selected root";
        setRoot({
          gitRoot: rootLabel,
          handle: directoryHandle,
          label: rootLabel,
          listingAvailable: true,
        });
        setColumns([
          {
            capped: false,
            entries: [],
            error: null,
            handle: directoryHandle,
            loading: true,
            pathSegments: [],
          },
        ]);
        await loadColumn(directoryHandle, [], 0);
        await refreshGitStatusForRoot(rootLabel);
        await loadGitHistoryForRoot(rootLabel);
        return;
      }

      if (onSelectWorkspaceDirectory) {
        const selectedDirectory = await onSelectWorkspaceDirectory();
        if (selectedDirectory) {
          setRoot({
            gitRoot: selectedDirectory,
            handle: null,
            label: selectedDirectory,
            listingAvailable: false,
          });
          setColumns([]);
          setRootError(
            "Directory listing is unavailable in this frontend runtime.",
          );
          await refreshGitStatusForRoot(selectedDirectory);
          await loadGitHistoryForRoot(selectedDirectory);
        }
        return;
      }

      setRootError("Directory picker is unavailable in this runtime.");
    } catch (error) {
      setColumns([]);
      setRoot(null);
      setRootError(`Open root failed: ${errorToReadableMessage(error)}`);
    } finally {
      setIsOpeningRoot(false);
    }
  }

  async function refreshGitStatusForRoot(repoRoot = root?.gitRoot ?? null) {
    if (!repoRoot) {
      setGitStatus({
        error: "Git status requires an approved local root path.",
        loading: false,
        status: null,
      });
      return;
    }

    setGitStatus((currentStatus) => ({
      ...currentStatus,
      error: null,
      loading: true,
    }));

    try {
      const status = await getWorkspaceGitStatus({ repoRoot });
      setGitStatus({
        error: null,
        loading: false,
        status,
      });
    } catch (error) {
      setGitStatus({
        error: errorToReadableMessage(error),
        loading: false,
        status: null,
      });
    }
  }

  async function loadGitDiffForPath(path: string, repoRoot = root?.gitRoot ?? null) {
    if (!repoRoot) {
      setGitDiffPreview({
        attachedMessage: null,
        diff: null,
        error: "Git diff requires an approved local root path.",
        loading: false,
        path,
      });
      return;
    }

    setGitDiffPreview({
      attachedMessage: null,
      diff: null,
      error: null,
      loading: true,
      path,
    });

    try {
      const diff = await getWorkspaceGitFileDiff({
        maxPatchBytes: MAX_GIT_DIFF_PATCH_BYTES,
        path,
        repoRoot,
      });
      setGitDiffPreview((currentDiff) =>
        currentDiff.path === path
          ? {
              attachedMessage: null,
              diff,
              error: diff.errorMessage,
              loading: false,
              path,
            }
          : currentDiff,
      );
    } catch (error) {
      setGitDiffPreview((currentDiff) =>
        currentDiff.path === path
          ? {
              attachedMessage: null,
              diff: null,
              error: errorToReadableMessage(error),
              loading: false,
              path,
            }
          : currentDiff,
      );
    }
  }

  async function loadGitHistoryForRoot(repoRoot = root?.gitRoot ?? null) {
    if (!repoRoot) {
      setGitHistory({
        error: "Git history requires an approved local root path.",
        loading: false,
        log: null,
        selectedHash: null,
      });
      return;
    }

    setGitHistory((currentHistory) => ({
      ...currentHistory,
      error: null,
      loading: true,
    }));

    try {
      const log = await getWorkspaceGitLog({
        limit: MAX_GIT_HISTORY_ENTRIES,
        repoRoot,
      });
      setGitHistory((currentHistory) => {
        const selectedHash =
          currentHistory.selectedHash &&
          log.entries.some((entry) => entry.hash === currentHistory.selectedHash)
            ? currentHistory.selectedHash
            : (log.entries[0]?.hash ?? null);

        return {
          error: null,
          loading: false,
          log,
          selectedHash,
        };
      });
    } catch (error) {
      setGitHistory({
        error: errorToReadableMessage(error),
        loading: false,
        log: null,
        selectedHash: null,
      });
    }
  }

  async function loadColumn(
    directoryHandle: FinderDirectoryHandle,
    pathSegments: string[],
    columnIndex: number,
  ) {
    try {
      const { capped, entries } = await readDirectoryEntries(
        directoryHandle,
        pathSegments,
      );

      setColumns((currentColumns) => {
        const nextColumns = currentColumns.slice(0, columnIndex + 1);
        nextColumns[columnIndex] = {
          capped,
          entries,
          error: null,
          handle: directoryHandle,
          loading: false,
          pathSegments,
        };
        return nextColumns;
      });
    } catch (error) {
      setColumns((currentColumns) => {
        const nextColumns = currentColumns.slice(0, columnIndex + 1);
        nextColumns[columnIndex] = {
          capped: false,
          entries: [],
          error: errorToReadableMessage(error),
          handle: directoryHandle,
          loading: false,
          pathSegments,
        };
        return nextColumns;
      });
    }
  }

  async function selectEntry(entry: FinderEntry, columnIndex: number) {
    const nextPath = entry.pathSegments.join("/");
    if (hasDirtyPreview(filePreview) && filePreview?.path !== nextPath) {
      setFilePreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              error: "Save or cancel the current edit before changing selection.",
            }
          : currentPreview,
      );
      setPreviewPaneState((currentState) =>
        currentState === "hidden" ? "normal" : currentState,
      );
      return;
    }

    setSelectedItem({
      handle: entry.handle,
      kind: entry.kind,
      name: entry.name,
      pathSegments: entry.pathSegments,
    });

    if (entry.kind !== "directory") {
      setColumns((currentColumns) => currentColumns.slice(0, columnIndex + 1));
      await openFilePreview(entry);
      return;
    }

    setFilePreview(null);
    setPreviewPaneState("hidden");
    setPreviewMode("content");
    resetGitDiffPreview();

    const directoryHandle = entry.handle as FinderDirectoryHandle;
    const nextColumnIndex = columnIndex + 1;
    setColumns((currentColumns) => [
      ...currentColumns.slice(0, nextColumnIndex),
      {
        capped: false,
        entries: [],
        error: null,
        handle: directoryHandle,
        loading: true,
        pathSegments: entry.pathSegments,
      },
    ]);
    await loadColumn(directoryHandle, entry.pathSegments, nextColumnIndex);
  }

  async function openFilePreview(entry: FinderEntry) {
    const fileHandle = entry.handle as FinderFileHandle;
    const path = entry.pathSegments.join("/");
    const gitChange = changeByPath.get(normalizeFinderPath(path)) ?? null;
    const repoRoot = root?.gitRoot ?? null;
    setPreviewPaneState("normal");
    setPreviewMode("content");
    resetGitDiffPreview(path);
    setFilePreview({
      canEdit: false,
      capped: false,
      content: "",
      draft: "",
      editMode: false,
      error: null,
      handle: fileHandle,
      loading: true,
      name: entry.name,
      path,
      savedMessage: null,
      saving: false,
      sizeBytes: null,
    });

    try {
      const loadedPreview = await loadFilePreview(fileHandle);
      setFilePreview((currentPreview) =>
        currentPreview?.path === path
          ? {
              ...currentPreview,
              ...loadedPreview,
              draft: loadedPreview.content,
              loading: false,
            }
          : currentPreview,
      );
    } catch (error) {
      setFilePreview((currentPreview) =>
        currentPreview?.path === path
          ? {
              ...currentPreview,
              canEdit: false,
              content: "",
              draft: "",
              error: errorToReadableMessage(error),
              loading: false,
            }
          : currentPreview,
      );
    }

    if (gitChange) {
      await loadGitDiffForPath(path, repoRoot);
    }
  }

  function closePreview() {
    if (hasDirtyPreview(filePreview)) {
      setFilePreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              error: "Save or cancel the current edit before closing preview.",
            }
          : currentPreview,
      );
      return;
    }

    setPreviewPaneState("hidden");
  }

  function startEdit() {
    setFilePreview((currentPreview) =>
      currentPreview && currentPreview.canEdit && !currentPreview.loading
        ? {
            ...currentPreview,
            editMode: true,
            error: null,
            savedMessage: null,
          }
        : currentPreview,
    );
  }

  function updateDraft(draft: string) {
    setFilePreview((currentPreview) =>
      currentPreview ? { ...currentPreview, draft, savedMessage: null } : null,
    );
  }

  function cancelEdit() {
    setFilePreview((currentPreview) =>
      currentPreview
        ? {
            ...currentPreview,
            draft: currentPreview.content,
            editMode: false,
            error: null,
            savedMessage: null,
          }
        : currentPreview,
    );
  }

  async function saveEdit() {
    if (!filePreview || !hasDirtyPreview(filePreview)) {
      return;
    }

    if (
      selectedItem?.kind !== "file" ||
      selectedItem.pathSegments.join("/") !== filePreview.path
    ) {
      setFilePreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              error: "Save rejected because the selected file changed.",
            }
          : currentPreview,
      );
      return;
    }

    if (!filePreview.handle.createWritable) {
      setFilePreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              error: "Saving is unavailable for this file handle.",
            }
          : currentPreview,
      );
      return;
    }

    setFilePreview((currentPreview) =>
      currentPreview
        ? { ...currentPreview, error: null, savedMessage: null, saving: true }
        : currentPreview,
    );

    try {
      const writable = await filePreview.handle.createWritable();
      await writable.write(filePreview.draft);
      await writable.close();
      setFilePreview((currentPreview) =>
        currentPreview?.path === filePreview.path
          ? {
              ...currentPreview,
              content: filePreview.draft,
              draft: filePreview.draft,
              editMode: false,
              error: null,
              savedMessage: "Saved",
              saving: false,
              sizeBytes: new Blob([filePreview.draft]).size,
            }
          : currentPreview,
      );
    } catch (error) {
      setFilePreview((currentPreview) =>
        currentPreview?.path === filePreview.path
          ? {
              ...currentPreview,
              error: `Save failed: ${errorToReadableMessage(error)}`,
              saving: false,
            }
          : currentPreview,
      );
    }
  }

  function showGitDiffPreview() {
    if (!filePreview) {
      return;
    }

    setPreviewMode("git");
    if (
      !gitDiffPreview.loading &&
      (gitDiffPreview.path !== filePreview.path || !gitDiffPreview.diff)
    ) {
      void loadGitDiffForPath(filePreview.path);
    }
  }

  function attachGitDiffToWorkspaceAgent() {
    const change = filePreview
      ? changeByPath.get(normalizeFinderPath(filePreview.path)) ?? null
      : null;

    if (
      !filePreview ||
      !gitDiffPreview.diff ||
      !onAttachContextToCoordinator
    ) {
      return;
    }

    onAttachContextToCoordinator({
      contextText: finderGitDiffContextText({
        change,
        diff: gitDiffPreview.diff,
        rootLabel: root?.label ?? "Approved Finder root",
      }),
      sourceLabel: "Finder / Git diff",
    });
    setGitDiffPreview((currentDiff) =>
      currentDiff.path === filePreview.path
        ? {
            ...currentDiff,
            attachedMessage:
              "Git diff attached to Workspace Agent as visible context.",
          }
        : currentDiff,
    );
  }

  function resetGitDiffPreview(path: string | null = null) {
    setGitDiffPreview({
      attachedMessage: null,
      diff: null,
      error: null,
      loading: false,
      path,
    });
  }

  function resetGitHistory() {
    setGitHistory({
      error: null,
      loading: false,
      log: null,
      selectedHash: null,
    });
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Preview</Badge>}
      subtitle={root ? selectedPath : "Explicit root required"}
      title={title}
    >
      <div className="finder-widget">
        <section aria-label="Finder root scope" className="finder-scope">
          <div className="finder-scope-copy">
            <p className="finder-title">Workspace root</p>
            <p className="finder-text">
              {root
                ? root.label
                : "Choose a local root before listing files or folders."}
            </p>
          </div>
          <div className="finder-scope-actions">
            <Badge variant={root?.listingAvailable ? "success" : "neutral"}>
              {root?.listingAvailable ? "Root open" : "No root"}
            </Badge>
            <Button
              disabled={!root?.gitRoot || gitStatus.loading}
              onClick={() => void refreshGitStatusForRoot()}
              variant="secondary"
            >
              {gitStatus.loading ? "Reading Git" : "Refresh Git"}
            </Button>
            <Button
              disabled={isOpeningRoot}
              onClick={() => void openRoot()}
              variant="secondary"
            >
              {isOpeningRoot ? "Opening" : "Open root"}
            </Button>
          </div>
        </section>

        <FinderGitStatusPanel
          changedFiles={changedFiles}
          error={gitStatus.error}
          history={gitHistory}
          loading={gitStatus.loading}
          onChangeViewMode={setViewMode}
          onRefreshHistory={() => void loadGitHistoryForRoot()}
          onSelectHistoryEntry={(hash) =>
            setGitHistory((currentHistory) => ({
              ...currentHistory,
              selectedHash: hash,
            }))
          }
          status={gitStatus.status}
          viewMode={viewMode}
        />

        {rootError ? (
          <section aria-label="Finder runtime status" className="finder-error">
            <p className="finder-title">Preview unavailable</p>
            <p className="finder-text">{rootError}</p>
          </section>
        ) : null}

        <div className="finder-layout">
          <section aria-label="Finder columns" className="finder-column-strip">
            {columns.length === 0 ? (
              <div className="finder-empty">
                <p className="finder-title">No columns yet.</p>
                <p className="finder-text">
                  The first column appears after an approved root can be listed.
                </p>
              </div>
            ) : (
              columns.map((column, columnIndex) => (
                <FinderColumnView
                  column={column}
                  key={column.pathSegments.join("/") || "root"}
                  onSelectEntry={(entry) =>
                    void selectEntry(entry, columnIndex)
                  }
                  changeByPath={changeByPath}
                  changedFiles={changedFiles}
                  selectedItem={selectedItem}
                  viewMode={viewMode}
                />
              ))
            )}
          </section>
        </div>

        {filePreview && previewPaneState !== "hidden" ? (
          <FinderFloatingPreview
            canAttachGitDiff={Boolean(onAttachContextToCoordinator)}
            gitChange={
              changeByPath.get(normalizeFinderPath(filePreview.path)) ?? null
            }
            gitDiffPreview={gitDiffPreview}
            onCancelEdit={cancelEdit}
            onAttachGitDiffToWorkspaceAgent={attachGitDiffToWorkspaceAgent}
            onClose={closePreview}
            onMaximize={() => setPreviewPaneState("maximized")}
            onMinimize={() => setPreviewPaneState("minimized")}
            onRestore={() => setPreviewPaneState("normal")}
            onShowContentPreview={() => setPreviewMode("content")}
            onShowGitDiff={showGitDiffPreview}
            onRefreshGitDiff={() => void loadGitDiffForPath(filePreview.path)}
            onSave={() => void saveEdit()}
            onStartEdit={startEdit}
            onUpdateDraft={updateDraft}
            preview={filePreview}
            previewMode={previewMode}
            state={previewPaneState}
          />
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function FinderFloatingPreview({
  canAttachGitDiff,
  gitChange,
  gitDiffPreview,
  onCancelEdit,
  onAttachGitDiffToWorkspaceAgent,
  onClose,
  onMaximize,
  onMinimize,
  onRefreshGitDiff,
  onRestore,
  onSave,
  onShowContentPreview,
  onShowGitDiff,
  onStartEdit,
  onUpdateDraft,
  preview,
  previewMode,
  state,
}: {
  canAttachGitDiff: boolean;
  gitChange: GitFileChange | null;
  gitDiffPreview: FinderGitDiffPreviewState;
  onCancelEdit: () => void;
  onAttachGitDiffToWorkspaceAgent: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onRefreshGitDiff: () => void;
  onRestore: () => void;
  onSave: () => void;
  onShowContentPreview: () => void;
  onShowGitDiff: () => void;
  onStartEdit: () => void;
  onUpdateDraft: (draft: string) => void;
  preview: FinderFilePreview;
  previewMode: FinderPreviewMode;
  state: FinderPreviewPaneState;
}) {
  const isDirty = hasDirtyPreview(preview);
  const showBody = state !== "minimized";
  const isGitMode = previewMode === "git";

  return (
    <section
      aria-label="Finder floating file preview"
      className={[
        "finder-floating-preview",
        `finder-floating-preview-${state}`,
      ].join(" ")}
    >
      <header className="finder-floating-preview-header">
        <div className="finder-preview-copy">
          <p className="finder-title">{preview.name}</p>
          <p className="finder-text">{preview.path}</p>
        </div>
        <div className="finder-preview-toolbar">
          {preview.loading ? <Badge variant="neutral">Loading</Badge> : null}
          {preview.savedMessage ? (
            <Badge variant="success">{preview.savedMessage}</Badge>
          ) : null}
          {isDirty ? <Badge variant="warning">Unsaved</Badge> : null}
          {preview.capped ? <Badge variant="warning">Capped</Badge> : null}
          {state === "minimized" ? (
            <Button onClick={onRestore} variant="ghost">
              Restore
            </Button>
          ) : (
            <Button onClick={onMinimize} variant="ghost">
              Minimize
            </Button>
          )}
          {state === "maximized" ? (
            <Button onClick={onRestore} variant="ghost">
              Normal
            </Button>
          ) : (
            <Button onClick={onMaximize} variant="ghost">
              Maximize
            </Button>
          )}
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      </header>

      {showBody ? (
        <>
          <div className="finder-preview-meta">
            <span>{formatPreviewSize(preview.sizeBytes)}</span>
            <span>
              {preview.canEdit
                ? "Editable text file"
                : "Read-only or unsupported edit target"}
            </span>
            {gitChange ? (
              <span>
                Git: {finderGitKindLabel(gitChange.kind)} /{" "}
                {finderGitAreaLabel(gitChange.area)}
              </span>
            ) : (
              <span>Git: no selected-file change</span>
            )}
          </div>

          <div className="finder-preview-tabs" role="group" aria-label="Finder preview mode">
            <Button
              onClick={onShowContentPreview}
              variant={!isGitMode ? "primary" : "secondary"}
            >
              Content
            </Button>
            <Button
              disabled={!gitChange}
              onClick={onShowGitDiff}
              title={
                gitChange
                  ? "Show the selected file Git diff."
                  : "No Git change is loaded for this selected file."
              }
              variant={isGitMode ? "primary" : "secondary"}
            >
              Git
            </Button>
          </div>

          {preview.error ? (
            <p className="finder-preview-error">{preview.error}</p>
          ) : null}

          <div className="finder-preview-body">
            {isGitMode ? (
              <FinderGitDiffPreview
                change={gitChange}
                diffState={gitDiffPreview}
              />
            ) : preview.loading ? (
              <p className="finder-column-state">Loading selected file...</p>
            ) : preview.editMode ? (
              <textarea
                aria-label="Finder file edit draft"
                className="finder-preview-editor"
                onChange={(event) => onUpdateDraft(event.target.value)}
                spellCheck={false}
                value={preview.draft}
              />
            ) : (
              <pre className="finder-preview-content">
                {preview.content || "File is empty."}
              </pre>
            )}
          </div>

          <div className="finder-preview-actions">
            {isGitMode ? (
              <>
                <Button
                  disabled={!gitChange || gitDiffPreview.loading}
                  onClick={onRefreshGitDiff}
                  variant="secondary"
                >
                  {gitDiffPreview.loading ? "Reading diff" : "Refresh diff"}
                </Button>
                {canAttachGitDiff ? (
                  <Button
                    disabled={!gitDiffPreview.diff || gitDiffPreview.loading}
                    onClick={onAttachGitDiffToWorkspaceAgent}
                    title="Attach the visible bounded diff context to Workspace Agent. Does not send automatically."
                    variant="secondary"
                  >
                    Attach to Workspace Agent
                  </Button>
                ) : null}
              </>
            ) : preview.editMode ? (
              <>
                <Button
                  disabled={!isDirty || preview.saving}
                  onClick={onSave}
                  variant="primary"
                >
                  {preview.saving ? "Saving" : "Save"}
                </Button>
                <Button
                  disabled={preview.saving}
                  onClick={onCancelEdit}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                disabled={!preview.canEdit || preview.loading}
                onClick={onStartEdit}
                variant="secondary"
              >
                Edit
              </Button>
            )}
          </div>
          {gitDiffPreview.attachedMessage && isGitMode ? (
            <p className="finder-preview-message">
              {gitDiffPreview.attachedMessage}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FinderGitDiffPreview({
  change,
  diffState,
}: {
  change: GitFileChange | null;
  diffState: FinderGitDiffPreviewState;
}) {
  if (!change) {
    return (
      <div className="finder-git-diff-empty">
        <p className="finder-title">No selected-file Git diff.</p>
        <p className="finder-text">
          Select a changed file from this approved root to preview its bounded
          read-only patch.
        </p>
      </div>
    );
  }

  if (diffState.loading) {
    return <p className="finder-column-state">Reading selected-file diff...</p>;
  }

  if (diffState.error && !diffState.diff) {
    return <p className="finder-preview-error">{diffState.error}</p>;
  }

  if (!diffState.diff) {
    return (
      <div className="finder-git-diff-empty">
        <p className="finder-title">Diff not loaded.</p>
        <p className="finder-text">Use Refresh diff to load this file patch.</p>
      </div>
    );
  }

  const patch = diffState.diff.patch || diffState.diff.errorMessage;

  return (
    <div className="finder-git-diff-preview">
      <div
        aria-label="Finder Git diff summary"
        className="finder-git-diff-summary"
      >
        <span className="finder-title">Diff summary</span>
        <Badge variant={finderGitBadgeVariant(change.kind)}>
          {finderGitKindLabel(change.kind)}
        </Badge>
        <Badge variant="neutral">{finderGitAreaLabel(change.area)}</Badge>
        <Badge variant="neutral">{diffState.diff.status}</Badge>
        {diffState.diff.patchTruncated ? (
          <Badge variant="warning">Diff capped</Badge>
        ) : null}
      </div>
      {diffState.error ? (
        <p className="finder-preview-error">{diffState.error}</p>
      ) : null}
      <p className="finder-title">Patch preview</p>
      <pre className="finder-preview-content finder-git-diff-patch">
        {patch || "No patch preview returned for this file."}
      </pre>
    </div>
  );
}

function FinderColumnView({
  changeByPath,
  changedFiles,
  column,
  onSelectEntry,
  selectedItem,
  viewMode,
}: {
  changeByPath: Map<string, GitFileChange>;
  changedFiles: GitFileChange[];
  column: FinderColumn;
  onSelectEntry: (entry: FinderEntry) => void;
  selectedItem: FinderSelectedItem | null;
  viewMode: FinderViewMode;
}) {
  const columnLabel =
    column.pathSegments.length === 0
      ? "Root"
      : column.pathSegments[column.pathSegments.length - 1];
  const entries =
    viewMode === "changed"
      ? column.entries.filter((entry) =>
          entryMatchesChangedFilter(entry, changedFiles),
        )
      : column.entries;

  return (
    <section className="finder-column" aria-label={`${columnLabel} entries`}>
      <header className="finder-column-header">
        <p className="finder-column-title">{columnLabel}</p>
        {column.capped ? <Badge variant="warning">Capped</Badge> : null}
      </header>
      {column.loading ? <p className="finder-column-state">Loading...</p> : null}
      {column.error ? (
        <p className="finder-column-state finder-column-error">{column.error}</p>
      ) : null}
      {!column.loading && !column.error && entries.length === 0 ? (
        <p className="finder-column-state">
          {viewMode === "changed" ? "No changed files here." : "Empty folder."}
        </p>
      ) : null}
      <div className="finder-entry-list" role="list">
        {entries.map((entry) => {
          const isSelected =
            selectedItem?.pathSegments.join("/") ===
            entry.pathSegments.join("/");
          const change = changeForEntry(entry, changeByPath, changedFiles);

          return (
            <button
              aria-pressed={isSelected}
              className={[
                "finder-entry",
                isSelected ? "finder-entry-selected" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              key={`${entry.kind}:${entry.pathSegments.join("/")}`}
              onClick={() => onSelectEntry(entry)}
              type="button"
            >
              <span className="finder-entry-kind">
                {entry.kind === "directory" ? "Folder" : "File"}
              </span>
              <span className="finder-entry-name">{entry.name}</span>
              {change ? (
                <Badge
                  className="finder-entry-status"
                  variant={finderGitBadgeVariant(change.kind)}
                >
                  {finderGitStatusMarker(change.kind)}
                </Badge>
              ) : null}
              {entry.kind === "directory" ? (
                <span className="finder-entry-arrow" aria-hidden="true">
                  &gt;
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FinderGitStatusPanel({
  changedFiles,
  error,
  history,
  loading,
  onChangeViewMode,
  onRefreshHistory,
  onSelectHistoryEntry,
  status,
  viewMode,
}: {
  changedFiles: GitFileChange[];
  error: string | null;
  history: FinderGitHistoryState;
  loading: boolean;
  onChangeViewMode: (viewMode: FinderViewMode) => void;
  onRefreshHistory: () => void;
  onSelectHistoryEntry: (hash: string) => void;
  status: GitRepositoryStatus | null;
  viewMode: FinderViewMode;
}) {
  const branchLabel = status?.branch?.name ?? "No branch loaded";
  const statusLabel = loading
    ? "Reading"
    : status
      ? status.workingTree.isClean
        ? "Clean"
        : "Dirty"
      : "Not loaded";

  return (
    <section aria-label="Finder Git status" className="finder-git-status">
      <div className="finder-git-status-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Git status</p>
          <p className="finder-text">{branchLabel}</p>
        </div>
        <div className="finder-git-status-actions">
          <Badge
            variant={
              loading
                ? "info"
                : status?.workingTree.isClean
                  ? "success"
                  : status
                    ? "warning"
                    : "neutral"
            }
          >
            {statusLabel}
          </Badge>
          <Badge variant={changedFiles.length > 0 ? "warning" : "neutral"}>
            {changedFiles.length} changed
          </Badge>
          <div className="finder-view-toggle" role="group" aria-label="Finder file view">
            <Button
              onClick={() => onChangeViewMode("all")}
              variant={viewMode === "all" ? "primary" : "secondary"}
            >
              All files
            </Button>
            <Button
              disabled={!status}
              onClick={() => onChangeViewMode("changed")}
              variant={viewMode === "changed" ? "primary" : "secondary"}
            >
              Changed files
            </Button>
          </div>
        </div>
      </div>
      {error ? <p className="finder-preview-error">{error}</p> : null}
      {changedFiles.length > 0 ? (
        <div className="finder-changed-file-list" role="list">
          {changedFiles.map((file, index) => (
            <div
              className="finder-changed-file-row"
              key={`${file.area}:${file.kind}:${file.path}:${index}`}
              role="listitem"
            >
              <code className="finder-changed-file-path">
                {file.originalPath ? `${file.originalPath} -> ${file.path}` : file.path}
              </code>
              <span className="finder-changed-file-meta">
                <Badge variant={finderGitBadgeVariant(file.kind)}>
                  {finderGitKindLabel(file.kind)}
                </Badge>
                <Badge variant="neutral">{finderGitAreaLabel(file.area)}</Badge>
              </span>
            </div>
          ))}
        </div>
      ) : status && !loading ? (
        <p className="finder-column-state">No changed files in this Git snapshot.</p>
      ) : null}
      <FinderGitHistoryPanel
        history={history}
        onRefreshHistory={onRefreshHistory}
        onSelectHistoryEntry={onSelectHistoryEntry}
      />
    </section>
  );
}

function FinderGitHistoryPanel({
  history,
  onRefreshHistory,
  onSelectHistoryEntry,
}: {
  history: FinderGitHistoryState;
  onRefreshHistory: () => void;
  onSelectHistoryEntry: (hash: string) => void;
}) {
  const entries = history.log?.entries ?? null;
  const selectedEntry =
    entries?.find((entry) => entry.hash === history.selectedHash) ??
    entries?.[0] ??
    null;

  return (
    <section aria-label="Finder Git history" className="finder-git-history">
      <div className="finder-git-history-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Recent commits</p>
          <p className="finder-text">
            {entries
              ? `${entries.length} commits loaded`
              : "Read-only history for the approved root."}
          </p>
        </div>
        <Button
          disabled={history.loading}
          onClick={onRefreshHistory}
          variant="secondary"
        >
          {history.loading ? "Reading history" : "Refresh history"}
        </Button>
      </div>

      {history.error ? (
        <p className="finder-preview-error">{history.error}</p>
      ) : null}

      {history.loading ? (
        <p className="finder-column-state">Reading recent commits...</p>
      ) : entries && entries.length === 0 ? (
        <p className="finder-column-state">Git returned no recent commits.</p>
      ) : entries ? (
        <div className="finder-git-history-layout">
          <div className="finder-git-history-list" role="list">
            {entries.map((entry) => (
              <button
                aria-pressed={entry.hash === selectedEntry?.hash}
                className={[
                  "finder-git-history-row",
                  entry.hash === selectedEntry?.hash
                    ? "finder-git-history-row-selected"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={entry.hash}
                onClick={() => onSelectHistoryEntry(entry.hash)}
                type="button"
              >
                <code className="finder-git-history-hash">
                  {entry.shortHash}
                </code>
                <span className="finder-git-history-main">
                  <span className="finder-git-history-title">
                    {entry.subject}
                  </span>
                  <span className="finder-git-history-meta">
                    {entry.author} / {entry.date}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <FinderGitCommitDetails entry={selectedEntry} />
        </div>
      ) : (
        <p className="finder-column-state">
          Open a root or refresh history to list recent commits.
        </p>
      )}
    </section>
  );
}

function FinderGitCommitDetails({ entry }: { entry: GitLogEntry | null }) {
  if (!entry) {
    return (
      <div className="finder-git-commit-details">
        <p className="finder-title">Commit details</p>
        <p className="finder-text">Select a commit to inspect its metadata.</p>
      </div>
    );
  }

  return (
    <div className="finder-git-commit-details">
      <p className="finder-title">Commit details</p>
      <dl className="finder-git-commit-detail-list">
        <div>
          <dt>Hash</dt>
          <dd>
            <code>{entry.hash}</code>
          </dd>
        </div>
        <div>
          <dt>Title</dt>
          <dd>{entry.subject}</dd>
        </div>
        <div>
          <dt>Author/date</dt>
          <dd>
            {entry.author} / {entry.date}
          </dd>
        </div>
      </dl>
      <p className="finder-text">
        Changed files and diff summary are not available for this selected
        commit.
      </p>
    </div>
  );
}

async function readDirectoryEntries(
  directoryHandle: FinderDirectoryHandle,
  pathSegments: string[],
) {
  const handles: FinderHandle[] = [];
  let capped = false;

  for await (const handle of iterateDirectoryHandles(directoryHandle)) {
    handles.push(handle);
    if (handles.length > MAX_DIRECTORY_ENTRIES) {
      capped = true;
      handles.pop();
      break;
    }
  }

  const entries = handles
    .map((handle) => ({
      handle,
      kind: handle.kind,
      name: handle.name,
      pathSegments: [...pathSegments, handle.name],
    }))
    .sort(compareFinderEntries);

  return { capped, entries };
}

async function loadFilePreview(fileHandle: FinderFileHandle) {
  if (!fileHandle.getFile) {
    throw new Error("File preview is unavailable in this runtime.");
  }

  const file = await fileHandle.getFile();
  const capped = file.size > MAX_FILE_PREVIEW_BYTES;
  const previewBlob = capped ? file.slice(0, MAX_FILE_PREVIEW_BYTES) : file;
  const content = await previewBlob.text();

  if (content.includes("\u0000")) {
    throw new Error("Binary file preview is unsupported.");
  }

  return {
    canEdit: !capped && typeof fileHandle.createWritable === "function",
    capped,
    content,
    error: capped
      ? "Preview is capped; editing is disabled for this file."
      : null,
    sizeBytes: file.size,
  };
}

async function* iterateDirectoryHandles(directoryHandle: FinderDirectoryHandle) {
  if (directoryHandle.values) {
    for await (const handle of directoryHandle.values()) {
      yield handle;
    }
    return;
  }

  if (directoryHandle.entries) {
    for await (const [, handle] of directoryHandle.entries()) {
      yield handle;
    }
    return;
  }

  throw new Error("Directory entries are unavailable in this runtime.");
}

function hasDirtyPreview(preview: FinderFilePreview | null) {
  return Boolean(preview?.editMode && preview.draft !== preview.content);
}

function formatPreviewSize(sizeBytes: number | null) {
  if (sizeBytes === null) {
    return "Size unavailable";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${Math.ceil(sizeBytes / 1024)} KB`;
}

function compareFinderEntries(first: FinderEntry, second: FinderEntry) {
  if (first.kind !== second.kind) {
    return first.kind === "directory" ? -1 : 1;
  }

  return first.name.localeCompare(second.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function buildGitChangeByPath(changedFiles: GitFileChange[]) {
  const changesByPath = new Map<string, GitFileChange>();

  for (const file of changedFiles) {
    changesByPath.set(normalizeFinderPath(file.path), file);
    if (file.originalPath) {
      changesByPath.set(normalizeFinderPath(file.originalPath), file);
    }
  }

  return changesByPath;
}

function changeForEntry(
  entry: FinderEntry,
  changeByPath: Map<string, GitFileChange>,
  changedFiles: GitFileChange[],
) {
  const entryPath = normalizeFinderPath(entry.pathSegments.join("/"));
  const exactChange = changeByPath.get(entryPath);

  if (exactChange) {
    return exactChange;
  }

  if (entry.kind !== "directory") {
    return null;
  }

  const directoryPrefix = `${entryPath}/`;

  return (
    changedFiles.find((file) =>
      normalizeFinderPath(file.path).startsWith(directoryPrefix),
    ) ?? null
  );
}

function entryMatchesChangedFilter(
  entry: FinderEntry,
  changedFiles: GitFileChange[],
) {
  const entryPath = normalizeFinderPath(entry.pathSegments.join("/"));

  if (entry.kind === "file") {
    return changedFiles.some(
      (file) =>
        normalizeFinderPath(file.path) === entryPath ||
        (file.originalPath
          ? normalizeFinderPath(file.originalPath) === entryPath
          : false),
    );
  }

  const directoryPrefix = `${entryPath}/`;

  return changedFiles.some((file) => {
    const filePath = normalizeFinderPath(file.path);
    const originalPath = file.originalPath
      ? normalizeFinderPath(file.originalPath)
      : null;

    return (
      filePath.startsWith(directoryPrefix) ||
      Boolean(originalPath?.startsWith(directoryPrefix))
    );
  });
}

function normalizeFinderPath(path: string) {
  return path.split("\\").join("/");
}

function finderGitStatusMarker(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "U";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "conflicted":
      return "!";
    case "modified":
      return "M";
    default:
      return "?";
  }
}

function finderGitKindLabel(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "Added";
    case "deleted":
      return "Deleted";
    case "modified":
      return "Modified";
    case "renamed":
      return "Renamed";
    case "copied":
      return "Copied";
    case "untracked":
      return "Untracked";
    case "conflicted":
      return "Conflicted";
    default:
      return "Unknown";
  }
}

function finderGitAreaLabel(area: string) {
  switch (area.toLowerCase()) {
    case "staged":
      return "Staged";
    case "unstaged":
      return "Unstaged";
    case "untracked":
      return "Untracked";
    default:
      return "Unknown";
  }
}

function finderGitBadgeVariant(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "success";
    case "conflicted":
      return "error";
    case "deleted":
    case "untracked":
      return "warning";
    case "modified":
    case "renamed":
    case "copied":
      return "info";
    default:
      return "neutral";
  }
}

function finderGitDiffContextText({
  change,
  diff,
  rootLabel,
}: {
  change: GitFileChange | null;
  diff: GitFileDiff;
  rootLabel: string;
}) {
  const patch = diff.patch ?? diff.errorMessage ?? "No patch preview returned.";
  const patchExcerpt = truncateText(patch, MAX_GIT_DIFF_ATTACHMENT_CHARS);

  return [
    "Finder selected-file Git diff",
    `Root: ${rootLabel}`,
    `Path: ${diff.path}`,
    `Diff status: ${diff.status}`,
    change
      ? `Change: ${finderGitKindLabel(change.kind)} / ${finderGitAreaLabel(
          change.area,
        )}`
      : "Change: unknown",
    `Patch capped by backend: ${diff.patchTruncated ? "yes" : "no"}`,
    "Patch preview:",
    patchExcerpt,
  ].join("\n");
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n[Finder diff attachment capped]`;
}

function errorToReadableMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}
