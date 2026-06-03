import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { getWorkspaceGitStatus } from "../workspace/workspaceGitApi";
import type { GitFileChange, GitRepositoryStatus } from "../workspace/types";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const MAX_DIRECTORY_ENTRIES = 200;
const MAX_FILE_PREVIEW_BYTES = 100 * 1024;

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
  const [viewMode, setViewMode] = useState<FinderViewMode>("all");
  const [gitStatus, setGitStatus] = useState<FinderGitStatusState>({
    error: null,
    loading: false,
    status: null,
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
    setGitStatus({
      error: null,
      loading: false,
      status: null,
    });
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
    setPreviewPaneState("normal");
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
          loading={gitStatus.loading}
          onChangeViewMode={setViewMode}
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
            onCancelEdit={cancelEdit}
            onClose={closePreview}
            onMaximize={() => setPreviewPaneState("maximized")}
            onMinimize={() => setPreviewPaneState("minimized")}
            onRestore={() => setPreviewPaneState("normal")}
            onSave={() => void saveEdit()}
            onStartEdit={startEdit}
            onUpdateDraft={updateDraft}
            preview={filePreview}
            state={previewPaneState}
          />
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function FinderFloatingPreview({
  onCancelEdit,
  onClose,
  onMaximize,
  onMinimize,
  onRestore,
  onSave,
  onStartEdit,
  onUpdateDraft,
  preview,
  state,
}: {
  onCancelEdit: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  onUpdateDraft: (draft: string) => void;
  preview: FinderFilePreview;
  state: FinderPreviewPaneState;
}) {
  const isDirty = hasDirtyPreview(preview);
  const showBody = state !== "minimized";

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
          </div>

          {preview.error ? (
            <p className="finder-preview-error">{preview.error}</p>
          ) : null}

          <div className="finder-preview-body">
            {preview.loading ? (
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
            {preview.editMode ? (
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
        </>
      ) : null}
    </section>
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
  loading,
  onChangeViewMode,
  status,
  viewMode,
}: {
  changedFiles: GitFileChange[];
  error: string | null;
  loading: boolean;
  onChangeViewMode: (viewMode: FinderViewMode) => void;
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
    </section>
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

function errorToReadableMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}
