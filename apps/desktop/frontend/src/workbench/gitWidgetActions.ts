import {
  createGitCommit,
  getGitFileDiff,
  getGitLog,
  getGitRepositoryStatus,
} from "../workspace/workspaceApi";
import type {
  CreateGitCommitRequest,
  GitFileDiff,
  GitLog,
  GitCommitResponse,
  GitRepositoryStatus,
} from "../workspace/types";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";
import {
  requireOpenWorkbench,
  requireWidget,
  type WidgetLogRefreshTokenBumper,
} from "./workbenchWidgetActionContext";

export type GitCommitCreateRequest = Omit<
  CreateGitCommitRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type GitWidgetActions = {
  createGitCommit: (
    widgetInstanceId: WidgetInstanceId,
    request: GitCommitCreateRequest,
  ) => Promise<GitCommitResponse | null>;
  getGitRepositoryStatus: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitRepositoryStatus | null>;
  getGitFileDiff: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
    path: string,
  ) => Promise<GitFileDiff | null>;
  getGitLog: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitLog | null>;
};

type GitWidgetActionOptions = {
  bumpWidgetLogRefreshToken: WidgetLogRefreshTokenBumper;
  viewState: WorkbenchViewState;
};

export function createGitWidgetActions({
  bumpWidgetLogRefreshToken,
  viewState,
}: GitWidgetActionOptions): GitWidgetActions {
  async function loadGitRepositoryStatus(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "refresh Git status",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Git status could not be refreshed for this widget.",
    );

    return getGitRepositoryStatus({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      repositoryRoot,
    });
  }

  async function createGitCommitForWidget(
    widgetInstanceId: WidgetInstanceId,
    request: GitCommitCreateRequest,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "create a Git commit",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Git commit could not be created for this widget.",
    );

    const response = await createGitCommit({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      ...request,
    });

    if (response) {
      bumpWidgetLogRefreshToken(widgetInstanceId);
    }

    return response;
  }

  async function loadGitFileDiff(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
    path: string,
  ) {
    const workbenchId = requireOpenWorkbench(viewState, "read Git diff");
    requireWidget(
      viewState,
      widgetInstanceId,
      "Git diff could not be loaded for this widget.",
    );

    return getGitFileDiff({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      repositoryRoot,
      path,
      maxPatchBytes: 65536,
    });
  }

  async function loadGitLog(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) {
    const workbenchId = requireOpenWorkbench(viewState, "read Git history");
    requireWidget(
      viewState,
      widgetInstanceId,
      "Git history could not be loaded for this widget.",
    );

    return getGitLog({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      repositoryRoot,
      limit: 30,
    });
  }

  return {
    createGitCommit: createGitCommitForWidget,
    getGitFileDiff: loadGitFileDiff,
    getGitLog: loadGitLog,
    getGitRepositoryStatus: loadGitRepositoryStatus,
  };
}
