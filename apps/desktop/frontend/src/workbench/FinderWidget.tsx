import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import {
  createWorkspaceGitCommit,
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  getWorkspaceGitStatus,
  pushWorkspaceGit,
} from "../workspace/workspaceGitApi";
import type {
  GitCommitResponse,
  GitFileChange,
  GitLog,
  GitLogEntry,
  GitPushResponse,
  GitRepositoryStatus,
} from "../workspace/types";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";
import {
  buildFinderCommitCandidates,
  buildFinderCommitMessage,
  buildGitChangeByPath,
  changeForEntry,
  compareFinderEntries,
  entryMatchesChangedFilter,
  errorToReadableMessage,
  finderEntryKindLabel,
  finderGitAreaLabel,
  finderGitBadgeVariant,
  finderGitDiffContextText,
  finderGitKindLabel,
  finderGitStatusMarker,
  finderKnowledgeQueueTaskRequest,
  formatGitCount,
  formatPreviewSize,
  getFinderGitPushBlocker,
  getFinderKnowledgeTaskBlocker,
  hasDirtyPreview,
  loadFilePreview,
  normalizeFinderPath,
  readDirectoryEntries,
  type FinderColumn,
  type FinderCommitCandidate,
  type FinderDirectoryHandle,
  type FinderEntry,
  type FinderFileHandle,
  type FinderFilePreview,
  type FinderGitDiffPreviewState,
  type FinderGitHistoryState,
  type FinderGitStatusState,
  type FinderHandle,
  type FinderPaneId,
  type FinderPaneState,
  type FinderPaneStates,
  type FinderPreviewMode,
  type FinderPreviewPaneState,
  type FinderRootState,
  type FinderSelectedItem,
  type FinderViewMode,
} from "./FinderWidget.helpers";

const MAX_GIT_DIFF_PATCH_BYTES = 96 * 1024;
const MAX_GIT_HISTORY_ENTRIES = 30;

const DEFAULT_FINDER_PANE_STATES: FinderPaneStates = {
  columns: "normal",
  commit: "normal",
  git: "normal",
  history: "normal",
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
  onCreateAgentQueueTask,
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
  const [paneStates, setPaneStates] = useState<FinderPaneStates>({
    ...DEFAULT_FINDER_PANE_STATES,
  });
  const [knowledgeTaskMessage, setKnowledgeTaskMessage] = useState<
    string | null
  >(null);
  const [knowledgeTaskError, setKnowledgeTaskError] = useState<string | null>(
    null,
  );
  const [isCreatingKnowledgeTask, setIsCreatingKnowledgeTask] = useState(false);

  const selectedPath = selectedItem
    ? selectedItem.pathSegments.join("/")
    : root?.label ?? "No root selected";
  const knowledgeTaskBlocker = getFinderKnowledgeTaskBlocker({
    filePreview,
    onCreateAgentQueueTask,
    selectedItem,
  });
  const changedFiles = gitStatus.status?.changedFiles ?? [];
  const changeByPath = buildGitChangeByPath(changedFiles);
  const hasMaximizedPane = Object.values(paneStates).some(
    (paneState) => paneState === "maximized",
  );
  const canUseDirectoryPicker =
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function";

  useEffect(() => {
    setKnowledgeTaskMessage(null);
    setKnowledgeTaskError(null);
  }, [selectedPath]);

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

  async function createFinderGitCommit(request: {
    commitMessage: string;
    includedFiles: string[];
    repoRoot: string;
  }) {
    return createWorkspaceGitCommit(request);
  }

  async function refreshGitAfterCommit(repoRoot = root?.gitRoot ?? null) {
    if (!repoRoot) {
      return;
    }

    await refreshGitStatusForRoot(repoRoot);
    await loadGitHistoryForRoot(repoRoot);
  }

  async function pushFinderGit(request: {
    expectedAhead?: number | null;
    expectedBehind?: number | null;
    expectedBranch: string;
    expectedUpstream: string;
    operatorConfirmed: boolean;
    repoRoot: string;
  }) {
    return pushWorkspaceGit(request);
  }

  async function refreshGitAfterPush(repoRoot = root?.gitRoot ?? null) {
    if (!repoRoot) {
      return;
    }

    await refreshGitStatusForRoot(repoRoot);
    await loadGitHistoryForRoot(repoRoot);
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

  async function createKnowledgeTaskFromSelection() {
    if (!selectedItem || !onCreateAgentQueueTask || knowledgeTaskBlocker) {
      setKnowledgeTaskError(
        knowledgeTaskBlocker ?? "Select a Finder file or folder first.",
      );
      return;
    }

    setIsCreatingKnowledgeTask(true);
    setKnowledgeTaskMessage(null);
    setKnowledgeTaskError(null);

    try {
      const task = await onCreateAgentQueueTask(
        finderKnowledgeQueueTaskRequest({
          rootLabel: root?.label ?? "Approved Finder root",
          selectedItem,
        }),
      );
      setKnowledgeTaskMessage(
        `Queue task ${task.queueItemId} created. It was not assigned or run.`,
      );
    } catch (error) {
      setKnowledgeTaskError(
        `Unable to create Knowledge Queue task: ${errorToReadableMessage(
          error,
        )}`,
      );
    } finally {
      setIsCreatingKnowledgeTask(false);
    }
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

  function setPaneState(paneId: FinderPaneId, state: FinderPaneState) {
    setPaneStates((currentStates) => ({
      ...currentStates,
      [paneId]: state,
    }));
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
      <div
        className={[
          "finder-widget",
          hasMaximizedPane ? "finder-widget-has-maximized-pane" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
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

        {rootError ? (
          <section aria-label="Finder runtime status" className="finder-error">
            <p className="finder-title">Preview unavailable</p>
            <p className="finder-text">{rootError}</p>
          </section>
        ) : null}

        <FinderKnowledgeSourcePanel
          blocker={knowledgeTaskBlocker}
          error={knowledgeTaskError}
          isCreating={isCreatingKnowledgeTask}
          message={knowledgeTaskMessage}
          onCreateTask={() => void createKnowledgeTaskFromSelection()}
          selectedItem={selectedItem}
        />

        <div aria-label="Finder panes" className="finder-pane-layout">
          <FinderPaneShell
            onMaximize={() => setPaneState("columns", "maximized")}
            onMinimize={() => setPaneState("columns", "minimized")}
            onRestore={() => setPaneState("columns", "normal")}
            state={paneStates.columns}
            subtitle={
              columns.length > 0
                ? `${columns.length} visible folder columns`
                : "Approves and lists one root at a time"
            }
            title="Columns view"
          >
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
          </FinderPaneShell>

          <FinderPaneShell
            onMaximize={() => setPaneState("git", "maximized")}
            onMinimize={() => setPaneState("git", "minimized")}
            onRestore={() => setPaneState("git", "normal")}
            state={paneStates.git}
            subtitle={
              gitStatus.status
                ? `${changedFiles.length} changed files in latest snapshot`
                : "Read-only status for the approved root"
            }
            title="Git panel"
          >
            <FinderGitStatusPanel
              changedFiles={changedFiles}
              error={gitStatus.error}
              loading={gitStatus.loading}
              onChangeViewMode={setViewMode}
              status={gitStatus.status}
              viewMode={viewMode}
            />
          </FinderPaneShell>

          <FinderPaneShell
            onMaximize={() => setPaneState("commit", "maximized")}
            onMinimize={() => setPaneState("commit", "minimized")}
            onRestore={() => setPaneState("commit", "normal")}
            state={paneStates.commit}
            subtitle="Explicit selected-file commit controls"
            title="Commit panel"
          >
            <FinderGitManualCommitPanel
              onCreateCommit={createFinderGitCommit}
              onRefreshAfterCommit={() => refreshGitAfterCommit()}
              repositoryRoot={root?.gitRoot ?? null}
              status={gitStatus.status}
            />
            <FinderGitManualPushPanel
              onPush={pushFinderGit}
              onRefreshAfterPush={() => refreshGitAfterPush()}
              repositoryRoot={root?.gitRoot ?? null}
              status={gitStatus.status}
            />
          </FinderPaneShell>

          <FinderPaneShell
            onMaximize={() => setPaneState("history", "maximized")}
            onMinimize={() => setPaneState("history", "minimized")}
            onRestore={() => setPaneState("history", "normal")}
            state={paneStates.history}
            subtitle={
              gitHistory.log
                ? `${gitHistory.log.entries.length} commits loaded`
                : "Read-only recent commit history"
            }
            title="History panel"
          >
            <FinderGitHistoryPanel
              history={gitHistory}
              onRefreshHistory={() => void loadGitHistoryForRoot()}
              onSelectHistoryEntry={(hash) =>
                setGitHistory((currentHistory) => ({
                  ...currentHistory,
                  selectedHash: hash,
                }))
              }
            />
          </FinderPaneShell>
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

function FinderPaneShell({
  children,
  onMaximize,
  onMinimize,
  onRestore,
  state,
  subtitle,
  title,
}: {
  children: ReactNode;
  onMaximize: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  state: FinderPaneState;
  subtitle: string;
  title: string;
}) {
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";

  return (
    <section
      aria-label={`Finder ${title}`}
      className={["finder-pane", `finder-pane-${state}`].join(" ")}
    >
      <header className="finder-pane-header">
        <div className="finder-scope-copy">
          <p className="finder-title">{title}</p>
          <p className="finder-text">{subtitle}</p>
        </div>
        <div className="finder-pane-actions">
          <Badge variant="neutral">{finderPaneStateLabel(state)}</Badge>
          {isMinimized ? (
            <Button
              aria-label={`Restore ${title}`}
              onClick={onRestore}
              variant="ghost"
            >
              Restore pane
            </Button>
          ) : (
            <Button
              aria-label={`Minimize ${title}`}
              onClick={onMinimize}
              variant="ghost"
            >
              Minimize pane
            </Button>
          )}
          {isMaximized ? (
            <Button
              aria-label={`Return ${title} to normal size`}
              onClick={onRestore}
              variant="ghost"
            >
              Normal pane
            </Button>
          ) : (
            <Button
              aria-label={`Maximize ${title}`}
              onClick={onMaximize}
              variant="ghost"
            >
              Maximize pane
            </Button>
          )}
        </div>
      </header>
      <div className="finder-pane-body">{children}</div>
    </section>
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
                  {preview.content
                    ? cappedPreviewText(
                        preview.content,
                        RENDER_MEMORY_CAPS.knowledgePreviewChars,
                      )
                    : "File is empty."}
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

function FinderKnowledgeSourcePanel({
  blocker,
  error,
  isCreating,
  message,
  onCreateTask,
  selectedItem,
}: {
  blocker: string | null;
  error: string | null;
  isCreating: boolean;
  message: string | null;
  onCreateTask: () => void;
  selectedItem: FinderSelectedItem | null;
}) {
  const selectedLabel = selectedItem
    ? selectedItem.pathSegments.join("/")
    : "No file or folder selected";

  return (
    <section
      aria-label="Finder Knowledge source"
      className="finder-knowledge-source"
    >
      <div className="finder-scope-copy">
        <p className="finder-title">Knowledge source</p>
        <p className="finder-text">
          {selectedItem
            ? `${finderEntryKindLabel(selectedItem.kind)}: ${selectedLabel}`
            : selectedLabel}
        </p>
      </div>
      <div className="finder-source-actions">
        <Badge variant={selectedItem ? "info" : "neutral"}>
          {selectedItem ? finderEntryKindLabel(selectedItem.kind) : "No selection"}
        </Badge>
        <Badge variant="neutral">Manual Queue</Badge>
        <Button
          disabled={Boolean(blocker) || isCreating}
          onClick={onCreateTask}
          title={blocker ?? "Create a manual Queue task from the selected source."}
          variant="secondary"
        >
          {isCreating ? "Creating task" : "Create Knowledge task"}
        </Button>
      </div>
      {blocker ? <p className="finder-column-state">{blocker}</p> : null}
      {message ? <p className="finder-preview-message">{message}</p> : null}
      {error ? <p className="finder-preview-error">{error}</p> : null}
    </section>
  );
}

function finderPaneStateLabel(state: FinderPaneState) {
  switch (state) {
    case "maximized":
      return "Maximized";
    case "minimized":
      return "Minimized";
    case "normal":
      return "Normal";
  }
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
        {patch
          ? cappedPreviewText(patch, RENDER_MEMORY_CAPS.evidenceRawDetailsChars)
          : "No patch preview returned for this file."}
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
    <div aria-label="Finder Git status" className="finder-git-status">
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
    </div>
  );
}

function FinderGitManualCommitPanel({
  onCreateCommit,
  onRefreshAfterCommit,
  repositoryRoot,
  status,
}: {
  onCreateCommit: (request: {
    commitMessage: string;
    includedFiles: string[];
    repoRoot: string;
  }) => Promise<GitCommitResponse>;
  onRefreshAfterCommit: () => Promise<void>;
  repositoryRoot: string | null;
  status: GitRepositoryStatus | null;
}) {
  const candidates = useMemo(
    () => buildFinderCommitCandidates(status?.changedFiles ?? []),
    [status?.changedFiles],
  );
  const candidateKey = candidates
    .map((candidate) => candidate.path)
    .join("\n");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [commitTitle, setCommitTitle] = useState("");
  const [commitBody, setCommitBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<GitCommitResponse | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const selectedCandidates = candidates.filter((candidate) =>
    selectedPaths.includes(candidate.path),
  );
  const selectedFiles = selectedCandidates.map((candidate) => candidate.path);
  const allCandidatesSelected =
    candidates.length > 0 && selectedFiles.length === candidates.length;
  const changedFileCount = status?.changedFiles.length ?? 0;
  const excludedFileCount = changedFileCount - candidates.length;
  const shouldRender = Boolean(
    commitError ||
      commitResult ||
      (repositoryRoot && status && changedFileCount > 0),
  );

  useEffect(() => {
    setSelectedPaths(candidates.map((candidate) => candidate.path));
    setIsOpen(false);
    setIsConfirming(false);
    setFieldError(null);
    setCommitError(null);
    setRefreshError(null);
  }, [candidateKey]);

  if (!shouldRender) {
    return null;
  }

  function updateCommitTitle(value: string) {
    setCommitTitle(value);
    setFieldError(null);
  }

  function updateCommitBody(value: string) {
    setCommitBody(value);
    setFieldError(null);
  }

  function toggleSelectedPath(path: string) {
    setSelectedPaths((currentPaths) =>
      currentPaths.includes(path)
        ? currentPaths.filter((currentPath) => currentPath !== path)
        : [...currentPaths, path],
    );
    setIsConfirming(false);
    setCommitError(null);
  }

  function startConfirmation() {
    setCommitError(null);
    setCommitResult(null);
    setRefreshError(null);

    if (!commitTitle.trim()) {
      setFieldError("Enter a commit title before confirming.");
      setIsConfirming(false);
      return;
    }

    if (selectedFiles.length === 0) {
      setFieldError("Select at least one changed file to include.");
      setIsConfirming(false);
      return;
    }

    setFieldError(null);
    setIsConfirming(true);
  }

  async function confirmCommit() {
    if (!repositoryRoot || !commitTitle.trim() || selectedFiles.length === 0) {
      setIsConfirming(false);
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setCommitResult(null);
    setRefreshError(null);

    try {
      const result = await onCreateCommit({
        commitMessage: buildFinderCommitMessage(commitTitle, commitBody),
        includedFiles: selectedFiles,
        repoRoot: repositoryRoot,
      });

      setCommitResult(result);
      setIsConfirming(false);

      if (result.status === "committed") {
        try {
          await onRefreshAfterCommit();
        } catch (error) {
          setRefreshError(errorToReadableMessage(error));
        }
      }
    } catch (error) {
      setCommitError(errorToReadableMessage(error));
      setIsConfirming(false);
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <section
      aria-label="Finder manual Git commit"
      className="finder-git-manual-commit"
    >
      <div className="finder-git-commit-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Manual commit</p>
          <p className="finder-text">
            {candidates.length > 0
              ? `${candidates.length} selectable changed files`
              : "No selectable changed files in this status snapshot."}
          </p>
        </div>
        <div className="finder-git-commit-actions">
          <Badge variant="warning">Local only</Badge>
          {repositoryRoot && candidates.length > 0 ? (
            <Button
              disabled={isCommitting}
              onClick={() => {
                setIsOpen((currentValue) => !currentValue);
                setIsConfirming(false);
              }}
              variant={isOpen ? "ghost" : "secondary"}
            >
              {isOpen ? "Close" : "Commit"}
            </Button>
          ) : null}
        </div>
      </div>

      {excludedFileCount > 0 ? (
        <p className="finder-text">
          {excludedFileCount} changed paths were excluded because they were not
          safe repo-relative file paths.
        </p>
      ) : null}

      {repositoryRoot && candidates.length > 0 && isOpen ? (
        <>
          <div className="finder-git-commit-fields">
            <label className="finder-git-commit-field">
              <span className="finder-title">Commit title</span>
              <input
                aria-label="Commit title"
                className="input"
                disabled={isCommitting}
                onChange={(event) => updateCommitTitle(event.target.value)}
                placeholder="Short local commit title"
                type="text"
                value={commitTitle}
              />
            </label>
            <label className="finder-git-commit-field">
              <span className="finder-title">Commit body</span>
              <textarea
                aria-label="Commit body"
                className="input finder-git-commit-body"
                disabled={isCommitting}
                onChange={(event) => updateCommitBody(event.target.value)}
                placeholder="Optional details"
                spellCheck
                value={commitBody}
              />
            </label>
          </div>

          <div className="finder-git-commit-selection-header">
            <div className="finder-scope-copy">
              <p className="finder-title">Diff summary</p>
              <p className="finder-text">
                Selected changed files from the latest Git status snapshot.
              </p>
            </div>
            <div className="finder-git-commit-actions">
              <Badge variant="neutral">{selectedFiles.length} selected</Badge>
              <Button
                disabled={allCandidatesSelected || isCommitting}
                onClick={() =>
                  setSelectedPaths(candidates.map((candidate) => candidate.path))
                }
                variant="ghost"
              >
                Select all
              </Button>
              <Button
                disabled={selectedFiles.length === 0 || isCommitting}
                onClick={() => setSelectedPaths([])}
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="finder-git-commit-file-list" role="list">
            {candidates.map((candidate) => (
              <FinderGitCommitFileRow
                candidate={candidate}
                checked={selectedPaths.includes(candidate.path)}
                disabled={isCommitting}
                key={candidate.path}
                onToggle={toggleSelectedPath}
              />
            ))}
          </div>

          {fieldError ? (
            <p className="finder-preview-error">{fieldError}</p>
          ) : null}

          {isConfirming ? (
            <FinderGitCommitConfirmation
              commitBody={commitBody}
              commitTitle={commitTitle.trim()}
              isCommitting={isCommitting}
              onBack={() => setIsConfirming(false)}
              onConfirm={() => void confirmCommit()}
              repositoryRoot={repositoryRoot}
              selectedCandidates={selectedCandidates}
            />
          ) : (
            <Button
              disabled={isCommitting || selectedFiles.length === 0}
              onClick={startConfirmation}
              variant="primary"
            >
              {isCommitting ? "Committing" : "Commit selected files"}
            </Button>
          )}
        </>
      ) : null}

      {commitError ? (
        <div className="finder-git-commit-result finder-git-commit-result-error">
          <p className="finder-title">Commit failed</p>
          <p className="finder-text">{commitError}</p>
        </div>
      ) : null}

      {commitResult ? (
        <FinderGitCommitResult
          refreshError={refreshError}
          result={commitResult}
        />
      ) : null}
    </section>
  );
}

function FinderGitManualPushPanel({
  onPush,
  onRefreshAfterPush,
  repositoryRoot,
  status,
}: {
  onPush: (request: {
    expectedAhead?: number | null;
    expectedBehind?: number | null;
    expectedBranch: string;
    expectedUpstream: string;
    operatorConfirmed: boolean;
    repoRoot: string;
  }) => Promise<GitPushResponse>;
  onRefreshAfterPush: () => Promise<void>;
  repositoryRoot: string | null;
  status: GitRepositoryStatus | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<GitPushResponse | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const branch = status?.branch ?? null;
  const pushBlocker = getFinderGitPushBlocker(repositoryRoot, status);
  const ahead = branch?.ahead ?? 0;
  const behind = branch?.behind ?? 0;

  function toggleOpen() {
    setIsOpen((current) => !current);
    setIsConfirming(false);
    setPushError(null);
    setRefreshError(null);
  }

  function startConfirmation() {
    setPushError(null);
    setRefreshError(null);
    setPushResult(null);

    if (pushBlocker) {
      setPushError(pushBlocker);
      return;
    }

    setIsConfirming(true);
  }

  async function confirmPush() {
    if (!repositoryRoot || !branch?.name || !branch.upstream || pushBlocker) {
      setPushError(pushBlocker ?? "Git push requires a safe branch and upstream.");
      return;
    }

    setIsPushing(true);
    setPushError(null);
    setPushResult(null);
    setRefreshError(null);

    try {
      const result = await onPush({
        expectedAhead: branch.ahead,
        expectedBehind: branch.behind,
        expectedBranch: branch.name,
        expectedUpstream: branch.upstream,
        operatorConfirmed: true,
        repoRoot: repositoryRoot,
      });
      setPushResult(result);
      setIsConfirming(false);
      try {
        await onRefreshAfterPush();
      } catch (error) {
        setRefreshError(errorToReadableMessage(error));
      }
    } catch (error) {
      setPushError(errorToReadableMessage(error));
    } finally {
      setIsPushing(false);
    }
  }

  return (
    <section aria-label="Finder Git manual push" className="finder-git-commit-panel">
      <div className="finder-git-commit-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Manual push</p>
          <p className="finder-text">
            Push local commits to the visible upstream only.
          </p>
        </div>
        <Button disabled={!status || isPushing} onClick={toggleOpen} variant="secondary">
          {isOpen ? "Close" : "Push"}
        </Button>
      </div>

      {isOpen ? (
        <>
          <div className="finder-git-commit-result-grid">
            <FinderGitCommitFact
              label="Branch"
              value={branch?.name ?? "Not loaded"}
            />
            <FinderGitCommitFact
              label="Upstream"
              value={branch?.upstream ?? "Unknown"}
            />
            <FinderGitCommitFact label="Ahead" value={formatGitCount(branch?.ahead)} />
            <FinderGitCommitFact label="Behind" value={formatGitCount(branch?.behind)} />
          </div>

          {pushBlocker ? (
            <p className="finder-preview-error">{pushBlocker}</p>
          ) : null}

          {isConfirming && branch?.name && branch.upstream ? (
            <div className="finder-git-commit-confirmation">
              <div className="finder-git-commit-header">
                <div className="finder-scope-copy">
                  <p className="finder-title">Confirm push</p>
                  <p className="finder-text">
                    This will push {ahead} local commit{ahead === 1 ? "" : "s"} to{" "}
                    {branch.upstream}.
                  </p>
                </div>
                <Badge variant="warning">Network mutation</Badge>
              </div>
              <FinderGitCommitFact label="Repository root" value={<code>{repositoryRoot}</code>} />
              <FinderGitCommitFact label="Branch" value={branch.name} />
              <FinderGitCommitFact label="Upstream" value={branch.upstream} />
              <FinderGitCommitFact label="Ahead / behind" value={`${ahead} / ${behind}`} />
              <ul className="finder-git-commit-warning-list">
                <li>No force push will be performed.</li>
                <li>No reset, clean, stash, checkout, or branch management is performed.</li>
                <li>Push is blocked if the branch snapshot changes before execution.</li>
              </ul>
              <div className="finder-git-commit-actions">
                <Button disabled={isPushing} onClick={() => setIsConfirming(false)} variant="secondary">
                  Back
                </Button>
                <Button disabled={isPushing} onClick={() => void confirmPush()} variant="primary">
                  {isPushing ? "Pushing" : "Push"}
                </Button>
              </div>
            </div>
          ) : (
            <Button disabled={Boolean(pushBlocker) || isPushing} onClick={startConfirmation} variant="primary">
              {isPushing ? "Pushing" : "Push upstream"}
            </Button>
          )}
        </>
      ) : null}

      {pushError ? (
        <div className="finder-git-commit-result finder-git-commit-result-error">
          <p className="finder-title">Push failed</p>
          <p className="finder-text">{pushError}</p>
        </div>
      ) : null}

      {pushResult ? (
        <FinderGitPushResult refreshError={refreshError} result={pushResult} />
      ) : null}
    </section>
  );
}

function FinderGitPushResult({
  refreshError,
  result,
}: {
  refreshError: string | null;
  result: GitPushResponse;
}) {
  return (
    <div
      aria-live="polite"
      className="finder-git-commit-result finder-git-commit-result-success"
    >
      <div className="finder-git-commit-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Push completed</p>
          <p className="finder-text">
            Pushed {result.branch} to {result.upstream}.
          </p>
        </div>
        <Badge variant="success">{result.status}</Badge>
      </div>
      <div className="finder-git-commit-result-grid">
        <FinderGitCommitFact label="Remote" value={result.remote} />
        <FinderGitCommitFact label="Remote branch" value={result.remoteBranch} />
        <FinderGitCommitFact label="Ahead / behind" value={`${result.ahead} / ${result.behind}`} />
      </div>
      {refreshError ? (
        <p className="finder-text">
          Push succeeded, but Git refresh failed: {refreshError}
        </p>
      ) : null}
    </div>
  );
}

function FinderGitCommitFileRow({
  candidate,
  checked,
  disabled,
  onToggle,
}: {
  candidate: FinderCommitCandidate;
  checked: boolean;
  disabled: boolean;
  onToggle: (path: string) => void;
}) {
  return (
    <label
      className={`finder-git-commit-file-row${
        checked ? " finder-git-commit-file-row-selected" : ""
      }`}
    >
      <input
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(candidate.path)}
        type="checkbox"
      />
      <span className="finder-git-commit-file-main">
        <code className="finder-changed-file-path">{candidate.path}</code>
        <span className="finder-changed-file-meta">
          {candidate.areas.map((area) => (
            <Badge key={area} variant="neutral">
              {finderGitAreaLabel(area)}
            </Badge>
          ))}
          {candidate.kinds.map((kind) => (
            <Badge key={kind} variant={finderGitBadgeVariant(kind)}>
              {finderGitKindLabel(kind)}
            </Badge>
          ))}
        </span>
      </span>
    </label>
  );
}

function FinderGitCommitConfirmation({
  commitBody,
  commitTitle,
  isCommitting,
  onBack,
  onConfirm,
  repositoryRoot,
  selectedCandidates,
}: {
  commitBody: string;
  commitTitle: string;
  isCommitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  repositoryRoot: string;
  selectedCandidates: FinderCommitCandidate[];
}) {
  return (
    <div className="finder-git-commit-confirmation">
      <div className="finder-git-commit-header">
        <div className="finder-scope-copy">
          <p className="finder-title">Confirm local commit</p>
          <p className="finder-text">
            Selected files will be staged for this local commit.
          </p>
        </div>
        <Badge variant="warning">No push</Badge>
      </div>
      <FinderGitCommitFact label="Repository root" value={<code>{repositoryRoot}</code>} />
      <FinderGitCommitFact label="Commit title" value={commitTitle} />
      {commitBody.trim() ? (
        <FinderGitCommitFact
          label="Commit body"
          value={
            <pre className="finder-git-commit-message">
              {cappedPreviewText(
                commitBody.trim(),
                RENDER_MEMORY_CAPS.transcriptPayloadChars,
              )}
            </pre>
          }
        />
      ) : null}
      <div className="finder-git-commit-confirmation-files">
        <p className="finder-title">
          Selected files ({selectedCandidates.length})
        </p>
        {selectedCandidates.map((candidate) => (
          <code className="finder-changed-file-path" key={candidate.path}>
            {candidate.path}
          </code>
        ))}
      </div>
      <ul className="finder-git-commit-warning-list">
        <li>Local commit only. No push will be performed.</li>
        <li>Only the selected files are sent to the commit API.</li>
        <li>No reset, clean, stash, checkout, or restore is performed.</li>
      </ul>
      <div className="finder-git-commit-actions">
        <Button disabled={isCommitting} onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button disabled={isCommitting} onClick={onConfirm} variant="primary">
          {isCommitting ? "Committing" : "Commit"}
        </Button>
      </div>
    </div>
  );
}

function FinderGitCommitResult({
  refreshError,
  result,
}: {
  refreshError: string | null;
  result: GitCommitResponse;
}) {
  const isSuccess = result.status === "committed";

  return (
    <div
      aria-live="polite"
      className={`finder-git-commit-result finder-git-commit-result-${
        isSuccess ? "success" : "error"
      }`}
    >
      <div className="finder-git-commit-header">
        <div className="finder-scope-copy">
          <p className="finder-title">
            {isSuccess ? "Commit created" : "Commit failed"}
          </p>
          <p className="finder-text">
            {isSuccess
              ? "Local Git commit completed."
              : (result.errorMessage ?? "Git reported a commit failure.")}
          </p>
        </div>
        <Badge variant={isSuccess ? "success" : "error"}>{result.status}</Badge>
      </div>
      <div className="finder-git-commit-result-grid">
        <FinderGitCommitFact
          label="Commit hash"
          value={result.commitHash ? <code>{result.commitHash}</code> : "Not returned"}
        />
        <FinderGitCommitFact label="Branch" value={result.branch ?? "Not returned"} />
        <FinderGitCommitFact label="Included files" value={result.includedFiles.length} />
      </div>
      {refreshError ? (
        <p className="finder-text">
          Commit succeeded, but Git refresh failed: {refreshError}
        </p>
      ) : null}
    </div>
  );
}

function FinderGitCommitFact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="finder-git-commit-fact">
      <span className="finder-title">{label}</span>
      <span className="finder-text">{value}</span>
    </div>
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
