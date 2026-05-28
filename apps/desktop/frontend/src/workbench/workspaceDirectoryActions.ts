import { selectWorkspaceDirectory } from "../workspace/workspaceApiCore";

export type WorkspaceDirectoryWidgetActions = {
  selectWorkspaceDirectory: () => Promise<string | null>;
};

export function createWorkspaceDirectoryActions(): WorkspaceDirectoryWidgetActions {
  return {
    selectWorkspaceDirectory,
  };
}
