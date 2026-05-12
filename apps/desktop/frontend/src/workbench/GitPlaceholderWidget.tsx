import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { isTauriRuntime } from "../workspace/tauriEnvironment";
import type { GitRepositoryStatus } from "../workspace/types";
import {
  GitPlannedReviewActions,
  GitPlannedReviewAreas,
  GitRepositoryRootPanel,
  GitStatusCard,
  GitStatusErrorNotice,
  GitStatusNotice,
} from "./GitPlaceholderSections";
import {
  gitFrameStatusView,
  gitStatusErrorViewFromCategory,
  gitStatusErrorViewFromUnknown,
  plannedGitActions,
  plannedGitReviewCards,
  type GitStatusErrorView,
} from "./gitStatusViewModel";
import type { WidgetRenderProps } from "./types";

export function GitPlaceholderWidget({
  directWorkGitReviewRequest,
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onDirectWorkGitReviewStatusChange,
  onGetGitRepositoryStatus,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const repositoryRootInputId = useId();
  const repositoryRootTitleId = useId();
  const [repositoryRootDraft, setRepositoryRootDraft] = useState("");
  const [gitStatus, setGitStatus] = useState<GitRepositoryStatus | null>(null);
  const [statusRepositoryRoot, setStatusRepositoryRoot] = useState<
    string | null
  >(null);
  const [statusError, setStatusError] = useState<GitStatusErrorView | null>(
    null,
  );
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
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
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "completed",
      );
    } catch (error) {
      const errorView = gitStatusErrorViewFromUnknown(error);
      setStatusError(errorView);
      reportDirectWorkGitReviewStatus(
        directWorkRequestId,
        sourceWidgetInstanceId,
        "failed",
        `${errorView.title}: ${errorView.message}`,
      );
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  function updateRepositoryRootDraft(value: string) {
    setRepositoryRootDraft(value);
    setStatusError(null);
  }

  function reportDirectWorkGitReviewStatus(
    requestId: number | undefined,
    sourceWidgetInstanceId: string | undefined,
    state: "completed" | "failed",
    errorMessage?: string,
  ) {
    if (requestId === undefined || !sourceWidgetInstanceId) {
      return;
    }

    onDirectWorkGitReviewStatusChange?.({
      errorMessage,
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
        canRefreshStatus={canRefreshStatus}
        hasRepositoryRootDraft={hasRepositoryRootDraft}
        isRefreshingStatus={isRefreshingStatus}
        onRefreshStatus={refreshStatus}
        onRepositoryRootDraftChange={updateRepositoryRootDraft}
        repositoryRootDraft={repositoryRootDraft}
        repositoryRootInputId={repositoryRootInputId}
        repositoryRootTitleId={repositoryRootTitleId}
        supportsDesktopGitReads={supportsDesktopGitReads}
      />

      {!supportsDesktopGitReads ? (
        <GitStatusNotice
          message="Browser/Vite fallback keeps the widget insertable, but real Git status reads require the Tauri desktop shell."
          title="Desktop Git reads unavailable"
          variant="info"
        />
      ) : null}

      {isRefreshingStatus ? (
        <GitStatusNotice
          ariaLive
          message="Reading a read-only Git status snapshot from the explicit repository root."
          title="Refreshing snapshot"
          variant="info"
        />
      ) : null}

      {statusError ? (
        <GitStatusErrorNotice error={statusError} />
      ) : null}

      {gitStatus && statusRepositoryRoot ? (
        <GitStatusCard
          repositoryRoot={statusRepositoryRoot}
          status={gitStatus}
        />
      ) : null}

      {supportsDesktopGitReads && !gitStatus && !statusError && !isRefreshingStatus ? (
        <GitStatusNotice
          message={
            hasRepositoryRootDraft
              ? "Ready to read one manual snapshot. Hobit will not poll, watch, persist, or mutate this repository."
              : "Enter an explicit local repository path before reading Git status."
          }
          title={
            hasRepositoryRootDraft
              ? "No status snapshot loaded"
              : "Repository root not configured"
          }
          variant="neutral"
        />
      ) : null}

      <GitPlannedReviewAreas cards={plannedGitReviewCards} />

      <GitPlannedReviewActions actions={plannedGitActions} />
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
