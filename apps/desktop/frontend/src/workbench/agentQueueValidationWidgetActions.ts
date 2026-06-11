import { runQueueValidationSuite } from "../workspace/workspaceApi";
import type {
  QueueValidationSuiteRun,
  RunQueueValidationSuiteRequest,
} from "../workspace/types";
import type { WorkbenchViewState } from "./types";

export type AgentQueueValidationWidgetActions = {
  runQueueValidationSuite: (
    request: Omit<RunQueueValidationSuiteRequest, "workspaceId">,
  ) => Promise<QueueValidationSuiteRun>;
};

export function createAgentQueueValidationActions(
  viewState: WorkbenchViewState,
): AgentQueueValidationWidgetActions {
  return {
    runQueueValidationSuite: (request) =>
      runQueueValidationSuite({
        ...request,
        workspaceId: viewState.workspace.id,
      }),
  };
}
