import { generateCoordinatorProviderResponse } from "../workspace/workspaceApi";
import type {
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
} from "../workspace/types";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";

export type CoordinatorProviderResponseRequest = Omit<
  GenerateCoordinatorProviderResponseRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type CoordinatorProviderWidgetActions = {
  generateCoordinatorProviderResponse: (
    widgetInstanceId: WidgetInstanceId,
    request: CoordinatorProviderResponseRequest,
  ) => Promise<GenerateCoordinatorProviderResponse | null>;
};

export function createCoordinatorProviderActions(
  viewState: WorkbenchViewState,
): CoordinatorProviderWidgetActions {
  return {
    generateCoordinatorProviderResponse: (widgetInstanceId, request) => {
      const workbenchId = requireOpenWorkbench(
        viewState,
        "request a Workspace Agent provider response",
      );
      return generateCoordinatorProviderResponse({
        workspaceId: viewState.workspace.id,
        workbenchId,
        widgetInstanceId,
        ...request,
      });
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }

  return viewState.workbench.id;
}
