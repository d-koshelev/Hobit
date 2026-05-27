import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { isTauriRuntime } from "../workspace/tauriEnvironment";
import type {
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
} from "../workspace/types";
import {
  GitStatusErrorNotice,
} from "./GitPlaceholderSections";
import { GitWidgetCommitPanel } from "./GitWidgetCommitPanel";
import {
  aheadBehindLabel,
  branchLabel,
  gitChangedFileGroups,
  gitChangedFilePathLabel,
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
  gitFrameStatusView,
  gitStatusErrorViewFromCategory,
  gitStatusErrorViewFromUnknown,
  gitStatusSummary,
  type GitStatusErrorView,
} from "./gitStatusViewModel";
import type { WidgetRenderProps } from "./types";

type GitTab = "changes" | "diff" | "history" | "commit";

export function GitPlaceholderWidget({
  directWorkGitReviewRequest,
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onDirectWorkGitReviewStatusChange,
  onCreateGitCommit,
  onGetGitFileDiff,
  onGetGitLog,
  onGetGitRepositoryStatus,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const repositoryRootInputId = useId();
  const [repositoryRootDraft, setRepositoryRootDraft] = useState("");
  const [gitStatus, setGitStatus] = useState<GitRepositoryStatus | null>(null);
  const [statusRepositoryRoot, setStatusRepositoryRoot] = useState<
    string | null
  >(null);
  const [statusError, setStatusError] = useState<GitStatusErrorView | null>(
    null,
  );
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<GitTab>("changes");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<GitFileDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [gitLog, setGitLog] = useState<GitLog | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const handledDirectWorkGitReviewRequestIdRef = useRef<number | null>(null);
  const supportsDesktopGitReads = isTauriRuntime();
  const canReadGitStatus =
    supportsDesktopGitReads && Boolean(onGetGitRepositoryStatus);
  const repositoryRoot = repositoryRootDraft.trim();
  const hasRepositoryRootDraft = repositoryRoot.length > 0;
  const canRefreshStatus =
    canReadGitStatus && hasRepositoryRootDraft && !isRefreshingStatus;

  useEffect(() => {
    if (
      !directWorkGitReviewRequest ||
      handledDirectWorkGitReviewRequestIdRef.current ===
        directWorkGitReviewRequest.id
    ) {
      return;
    }

    handledDirectWorkGitReviewRequestIdRef.current =
      directWorkGitReviewRequest.id;
    setRepositoryRootDraft(directWorkGitReviewRequest.repositoryRoot);
    void refreshStatusForRoot(
      directWorkGitReviewRequest.repositoryRoot,
      directWorkGitReviewRequest.id,
      directWorkGitReviewRequest.sourceWidgetInstanceId,
    );
  }, [directWorkGitReviewRequest]);

  async function refreshStatus() {
    await refreshStatusForRoot(repositoryRoot);
  }

  async function refreshStatusAfterCommit() {
    if (statusRepositoryRoot) {
      await refreshStatusForRoot(statusRepositoryRoot);
    }
  }

  async function createGitCommit(request: {
    commitMessage: string;
    includedFiles: string[];
    repoRoot: string;
  }) {
    if (!onCreateGitCommit) {
      throw new Error("Git commit creation is unavailable in this runtime.");
    }

    return onCreateGitCommit(instance.id, request);
  }

  async function refreshStatusForRoot(
    requestedRepositoryRoot: string,
    directWorkRequestId?: number,
    sourceWidgetInstanceId?: string,
  ) {
    if (isRefreshingStatus) {
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        requestedRepositoryRoot,
        "Git status is already refreshing",
      );
      return;
    }

    const nextRepositoryRoot = requestedRepositoryRoot.trim();

    if (!nextRepositoryRoot) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("not-configured"));
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        nextRepositoryRoot,
        "Repository root is not configured",
      );
      return;
    }

    if (!supportsDesktopGitReads) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("unsupported-browser"));
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        nextRepositoryRoot,
        "Desktop/Tauri shell is required for real Git reads",
      );
      return;
    }

    if (!onGetGitRepositoryStatus) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("unavailable"));
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        nextRepositoryRoot,
        "Git status reader is unavailable",
      );
      return;
    }

    setIsRefreshingStatus(true);
    setStatusError(null);
    setGitStatus(null);
    setStatusRepositoryRoot(null);

    try {
      const status = await onGetGitRepositoryStatus(
        instance.id,
        nextRepositoryRoot,
      );

      if (!status) {
        throw new Error("Git status was not returned for this widget.");
      }

      setGitStatus(status);
      setStatusRepositoryRoot(nextRepositoryRoot);
      setSelectedFilePath(null);
      setFileDiff(null);
      setDiffError(null);
      setGitLog(null);
      setHistoryError(null);
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "completed",
        nextRepositoryRoot,
        undefined,
        status,
      );
    } catch (error) {
      const errorView = gitStatusErrorViewFromUnknown(error);
      setStatusError(errorView);
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        nextRepositoryRoot,
        `${errorView.title}: ${errorView.message}`,
      );
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  function updateRepositoryRootDraft(value: string) {
    setRepositoryRootDraft(value);
    setStatusError(null);
    setDiffError(null);
    setHistoryError(null);
  }

  async function selectChangedFile(path: string) {
    setSelectedFilePath(path);
    setActiveTab("diff");
    await loadFileDiff(path);
  }

  async function loadFileDiff(path = selectedFilePath) {
    if (!path || !statusRepositoryRoot) {
      setFileDiff(null);
      return;
    }

    if (!supportsDesktopGitReads || !onGetGitFileDiff) {
      setDiffError("Desktop/Tauri shell is required for Git diff reads.");
      return;
    }

    setIsLoadingDiff(true);
    setDiffError(null);
    setFileDiff(null);

    try {
      const diff = await onGetGitFileDiff(
        instance.id,
        statusRepositoryRoot,
        path,
      );

      if (!diff) {
        throw new Error("Git diff was not returned for this widget.");
      }

      setFileDiff(diff);
    } catch (error) {
      setDiffError(errorToMessage(error));
    } finally {
      setIsLoadingDiff(false);
    }
  }

  async function openHistoryTab() {
    setActiveTab("history");
    if (gitLog || isLoadingHistory || !statusRepositoryRoot) {
      return;
    }

    await loadHistory();
  }

  async function loadHistory() {
    if (!statusRepositoryRoot) {
      setGitLog(null);
      return;
    }

    if (!supportsDesktopGitReads || !onGetGitLog) {
      setHistoryError("Desktop/Tauri shell is required for Git history reads.");
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const log = await onGetGitLog(instance.id, statusRepositoryRoot);

      if (!log) {
        throw new Error("Git history was not returned for this widget.");
      }

      setGitLog(log);
    } catch (error) {
      setHistoryError(errorToMessage(error));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function reportDirectWorkGitReviewStatus(
    requestId: number | undefined,
    sourceWidgetInstanceId: string | undefined,
    state: "completed" | "failed",
    repositoryRoot?: string,
    errorMessage?: string,
    repositoryStatus?: GitRepositoryStatus,
  ) {
    if (requestId === undefined || !sourceWidgetInstanceId) {
      return;
    }

    onDirectWorkGitReviewStatusChange?.({
      errorMessage,
      repositoryRoot,
      repositoryStatus: repositoryStatus ?? null,
      requestId,
      sourceWidgetInstanceId,
      state,
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
      status={gitFrameStatus(gitStatus, statusError, isRefreshingStatus)}
      title={title}
    >
      <GitRepositoryRootPanel
        branch={gitStatus?.branch ?? null}
        canRefreshStatus={canRefreshStatus}
        isRefreshingStatus={isRefreshingStatus}
        onRefreshStatus={refreshStatus}
        onRepositoryRootDraftChange={updateRepositoryRootDraft}
        repositoryRootDraft={repositoryRootDraft}
        repositoryRootInputId={repositoryRootInputId}
        status={gitStatus}
      />

      {!supportsDesktopGitReads ? (
        <p className="git-inline-error">Desktop shell required for Git reads.</p>
      ) : null}

      {isRefreshingStatus ? (
        <p aria-live="polite" className="git-inline-status">
          Refreshing Git status...
        </p>
      ) : null}

      {statusError ? (
        <GitStatusErrorNotice error={statusError} />
      ) : null}

      <GitTabs activeTab={activeTab} onSelectTab={(tab) => {
        if (tab === "history") {
          void openHistoryTab();
          return;
        }
        setActiveTab(tab);
      }} />

      {activeTab === "changes" ? (
        <GitChangesTab
          onSelectFile={(path) => void selectChangedFile(path)}
          selectedFilePath={selectedFilePath}
          status={gitStatus}
        />
      ) : null}

      {activeTab === "diff" ? (
        <GitDiffTab
          diff={fileDiff}
          error={diffError}
          isLoading={isLoadingDiff}
          onRefresh={() => void loadFileDiff()}
          selectedFilePath={selectedFilePath}
        />
      ) : null}

      {activeTab === "history" ? (
        <GitHistoryTab
          error={historyError}
          isLoading={isLoadingHistory}
          log={gitLog}
          onRefresh={() => void loadHistory()}
        />
      ) : null}

      {activeTab === "commit" ? (
        <GitCommitTab
          onCreateGitCommit={createGitCommit}
          onRefreshStatusAfterCommit={refreshStatusAfterCommit}
          repositoryRoot={statusRepositoryRoot}
          status={gitStatus}
        />
      ) : null}

    </WidgetFrame>
  );
}

function gitFrameStatus(
  status: GitRepositoryStatus | null,
  errorMessage: GitStatusErrorView | null,
  isRefreshing: boolean,
) {
  const frameStatus = gitFrameStatusView(status, errorMessage, isRefreshing);

  return <Badge variant={frameStatus.variant}>{frameStatus.label}</Badge>;
}

function GitRepositoryRootPanel({
  branch,
  canRefreshStatus,
  isRefreshingStatus,
  onRefreshStatus,
  onRepositoryRootDraftChange,
  repositoryRootDraft,
  repositoryRootInputId,
  status,
}: {
  branch: GitRepositoryStatus["branch"];
  canRefreshStatus: boolean;
  isRefreshingStatus: boolean;
  onRefreshStatus: () => void;
  onRepositoryRootDraftChange: (value: string) => void;
  repositoryRootDraft: string;
  repositoryRootInputId: string;
  status: GitRepositoryStatus | null;
}) {
  const summary = status ? gitStatusSummary(status) : null;

  return (
    <section aria-label="Git repository" className="git-workflow-header">
      <label className="git-repo-field" htmlFor={repositoryRootInputId}>
        <span className="git-repo-label">Repo path</span>
        <input
          autoComplete="off"
          className="input git-repo-input"
          id={repositoryRootInputId}
          onChange={(event) => onRepositoryRootDraftChange(event.target.value)}
          placeholder="C:\\path\\to\\repository"
          spellCheck={false}
          type="text"
          value={repositoryRootDraft}
        />
      </label>
      <div className="git-header-meta">
        <Badge variant="neutral">{branchLabel(branch)}</Badge>
        <Badge variant={summary?.stateBadgeVariant ?? "neutral"}>
          {summary?.stateLabel ?? "Not loaded"}
        </Badge>
        {branch ? <Badge variant="neutral">{aheadBehindLabel(branch)}</Badge> : null}
      </div>
      <Button disabled={!canRefreshStatus} onClick={onRefreshStatus} variant="primary">
        {isRefreshingStatus ? "Refreshing..." : "Refresh"}
      </Button>
    </section>
  );
}

function GitTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: GitTab;
  onSelectTab: (tab: GitTab) => void;
}) {
  const tabs: Array<{ id: GitTab; label: string }> = [
    { id: "changes", label: "Changes" },
    { id: "diff", label: "Diff" },
    { id: "history", label: "History" },
    { id: "commit", label: "Commit" },
  ];

  return (
    <div aria-label="Git sections" className="git-tab-list" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={activeTab === tab.id}
          className="git-tab"
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function GitChangesTab({
  onSelectFile,
  selectedFilePath,
  status,
}: {
  onSelectFile: (path: string) => void;
  selectedFilePath: string | null;
  status: GitRepositoryStatus | null;
}) {
  if (!status) {
    return <GitEmptyState title="No repository loaded" text="Enter a repo path and refresh." />;
  }

  const groups = gitChangedFileGroups(status.changedFiles).filter(
    (group) => group.files.length > 0,
  );

  return (
    <section className="git-tab-panel" role="tabpanel">
      <div className="git-panel-header">
        <h3 className="git-panel-title">Changes</h3>
        <Badge variant={status.changedFiles.length > 0 ? "warning" : "success"}>
          {status.changedFiles.length} changed files
        </Badge>
      </div>
      {status.changedFiles.length === 0 ? (
        <GitEmptyState title="No local changes" text="Working tree is clean." />
      ) : (
        <div className="git-review-file-groups">
          {groups.map((group) => (
            <section className="git-review-file-group" key={group.key}>
              <div className="git-review-file-group-header">
                <h4 className="git-review-file-group-title">{group.title}</h4>
                <Badge variant={group.badgeVariant}>{group.files.length}</Badge>
              </div>
              <div className="git-review-file-list">
                {group.files.map((file, index) => (
                  <button
                    className={`git-review-file-row${
                      selectedFilePath === file.path ? " git-review-file-row-selected" : ""
                    }`}
                    key={`${file.area}-${file.kind}-${file.path}-${index}`}
                    onClick={() => onSelectFile(file.path)}
                    type="button"
                  >
                    <code className="git-review-file-path">
                      {gitChangedFilePathLabel(file)}
                    </code>
                    <span className="git-review-file-meta">
                      <Badge variant={gitChangeKindBadgeVariant(file.kind)}>
                        {gitChangeKindLabel(file.kind)}
                      </Badge>
                      <Badge variant="neutral">{gitChangeAreaLabel(file.area)}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function GitDiffTab({
  diff,
  error,
  isLoading,
  onRefresh,
  selectedFilePath,
}: {
  diff: GitFileDiff | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  selectedFilePath: string | null;
}) {
  return (
    <section className="git-tab-panel git-diff-panel" role="tabpanel">
      <div className="git-panel-header">
        <div className="git-panel-copy">
          <h3 className="git-panel-title">Diff</h3>
          <p className="git-panel-subtitle">
            {selectedFilePath ?? "Select a changed file"}
          </p>
        </div>
        <Button disabled={!selectedFilePath || isLoading} onClick={onRefresh} variant="secondary">
          {isLoading ? "Loading..." : "Reload diff"}
        </Button>
      </div>
      {!selectedFilePath ? (
        <GitEmptyState title="No file selected" text="Choose a changed file to review its diff." />
      ) : error ? (
        <GitEmptyState title="Diff unavailable" text={error} tone="error" />
      ) : isLoading ? (
        <GitEmptyState title="Loading diff" text="Reading selected-file diff." />
      ) : diff?.patch ? (
        <>
          {diff.errorMessage ? (
            <p className="git-inline-status">{diff.errorMessage}</p>
          ) : null}
          <pre className="git-diff-output">
            <code>{diff.patch}</code>
          </pre>
        </>
      ) : diff ? (
        <GitEmptyState
          title={diff.status === "untracked" ? "Untracked file" : "No diff output"}
          text={diff.errorMessage ?? "Git returned no patch for this file."}
        />
      ) : (
        <GitEmptyState title="No diff loaded" text="Select a changed file from Changes." />
      )}
    </section>
  );
}

function GitHistoryTab({
  error,
  isLoading,
  log,
  onRefresh,
}: {
  error: string | null;
  isLoading: boolean;
  log: GitLog | null;
  onRefresh: () => void;
}) {
  return (
    <section className="git-tab-panel" role="tabpanel">
      <div className="git-panel-header">
        <h3 className="git-panel-title">History</h3>
        <Button disabled={isLoading} onClick={onRefresh} variant="secondary">
          {isLoading ? "Loading..." : "Refresh history"}
        </Button>
      </div>
      {error ? (
        <GitEmptyState title="History unavailable" text={error} tone="error" />
      ) : isLoading ? (
        <GitEmptyState title="Loading history" text="Reading recent commits." />
      ) : !log ? (
        <GitEmptyState title="History not loaded" text="Open History to load recent commits." />
      ) : log.entries.length === 0 ? (
        <GitEmptyState title="No commits" text="Git returned no recent commits." />
      ) : (
        <div className="git-history-list">
          {log.entries.map((entry) => (
            <article className="git-history-row" key={entry.hash}>
              <code className="git-history-hash">{entry.shortHash}</code>
              <div className="git-history-main">
                <h4 className="git-history-subject">{entry.subject}</h4>
                <p className="git-history-meta">
                  {entry.author} · {entry.date}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function GitCommitTab({
  onCreateGitCommit,
  onRefreshStatusAfterCommit,
  repositoryRoot,
  status,
}: {
  onCreateGitCommit: (request: {
    commitMessage: string;
    includedFiles: string[];
    repoRoot: string;
  }) => Promise<GitCommitResponse | null>;
  onRefreshStatusAfterCommit: () => Promise<void>;
  repositoryRoot: string | null;
  status: GitRepositoryStatus | null;
}) {
  if (!status) {
    return (
      <section className="git-tab-panel" role="tabpanel">
        <GitEmptyState title="Commit unavailable" text="Load a repository status first." />
      </section>
    );
  }

  if (status.changedFiles.length === 0) {
    return (
      <section className="git-tab-panel" role="tabpanel">
        <GitEmptyState title="No local changes" text="Nothing to commit." />
      </section>
    );
  }

  return (
    <GitWidgetCommitPanel
      onCreateGitCommit={onCreateGitCommit}
      onRefreshStatusAfterCommit={onRefreshStatusAfterCommit}
      repositoryRoot={repositoryRoot}
      status={status}
    />
  );
}

function GitEmptyState({
  text,
  title,
  tone = "neutral",
}: {
  text: string;
  title: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className={`git-empty-state git-empty-state-${tone}`}>
      <p className="git-empty-title">{title}</p>
      <p className="git-empty-text">{text}</p>
    </div>
  );
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Git operation failed.";
}
