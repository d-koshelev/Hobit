import type { DirectWorkGitReviewHandoff } from "../useDirectWorkGitReviewHandoff";
import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type GitActions = Pick<
  WorkbenchWidgetInstanceActions,
  "createGitCommit" | "getGitFileDiff" | "getGitLog" | "getGitRepositoryStatus"
>;

type GitWidgetPropsOptions = {
  actions: GitActions;
  directWorkGitReview: DirectWorkGitReviewHandoff;
};

export function gitWidgetProps({
  actions,
  directWorkGitReview,
}: GitWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    directWorkGitReviewRequest: directWorkGitReview.request,
    onCreateGitCommit: actions.createGitCommit,
    onDirectWorkGitReviewStatusChange: directWorkGitReview.updateStatus,
    onGetGitFileDiff: actions.getGitFileDiff,
    onGetGitLog: actions.getGitLog,
    onGetGitRepositoryStatus: actions.getGitRepositoryStatus,
  };
}
