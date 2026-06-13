import { describe, expect, it } from "vitest";

import type { WorkbenchViewState } from "./types";
import { currentWorkspaceRootFromViewState } from "./workspaceCurrentRoot";

describe("currentWorkspaceRootFromViewState", () => {
  it("prefers the typed workspace root over compatibility shared state", () => {
    expect(
      currentWorkspaceRootFromViewState(
        viewState({
          rootPath: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
          sharedStateObjects: [
            {
              id: "shared-root",
              key: "current_workspace_root",
              value: "C:/other",
              valueKind: "path",
            },
          ],
        }),
      ),
    ).toBe("C:/Users/Dmitry/Documents/prj/Hobit_fixed");
  });

  it("uses explicit shared current root when typed workspace root is absent", () => {
    expect(
      currentWorkspaceRootFromViewState(
        viewState({
          rootPath: null,
          sharedStateObjects: [
            {
              id: "shared-root",
              key: "current_workspace_root",
              value: "C:/repo",
              valueKind: "path",
            },
          ],
        }),
      ),
    ).toBe("C:/repo");
  });

  it("does not treat home or relative placeholders as workspace roots", () => {
    expect(
      currentWorkspaceRootFromViewState(
        viewState({
          rootPath: "~",
          sharedStateObjects: [
            {
              id: "shared-root",
              key: "workspace.root",
              value: ".",
              valueKind: "path",
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});

function viewState({
  rootPath,
  sharedStateObjects = [],
}: {
  rootPath?: string | null;
  sharedStateObjects?: WorkbenchViewState["sharedStateObjects"];
}): WorkbenchViewState {
  return {
    recentEvents: [],
    sharedStateObjects,
    widgets: [],
    workbench: {
      id: "workbench-1",
      preset: {
        description: null,
        id: "preset",
        title: "Preset",
      },
    },
    workspace: {
      description: null,
      id: "workspace-1",
      rootPath,
      status: "active",
      title: "Workspace",
    },
  };
}
