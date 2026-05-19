import {
  createGitCommit,
  getGitRepositoryStatus,
} from "../workspace/workspaceApi";
import type {
  CreateGitCommitRequest,
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

  return {
    createGitCommit: createGitCommitForWidget,
    getGitRepositoryStatus: loadGitRepositoryStatus,
  };
}
