import { selectWorkspaceDirectory } from "../workspace/workspaceApiCore";
import { readPromptPackEntriesFromLocalSource } from "./promptPack";
import type { ReadPromptPackSourceRequest } from "../workspace/types";
import type { PromptPackFileEntry } from "./promptPack";

export type WorkspaceDirectoryWidgetActions = {
  readPromptPackSource: (
    request: ReadPromptPackSourceRequest,
  ) => Promise<PromptPackFileEntry[]>;
  selectWorkspaceDirectory: () => Promise<string | null>;
};

export function createWorkspaceDirectoryActions(): WorkspaceDirectoryWidgetActions {
  return {
    readPromptPackSource: readPromptPackEntriesFromLocalSource,
    selectWorkspaceDirectory,
  };
}
