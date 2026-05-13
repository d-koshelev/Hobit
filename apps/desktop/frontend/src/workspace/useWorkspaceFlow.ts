import { useEffect, useState } from "react";
import { emptyWorkbenchPreset } from "../workbench/presets";
import { createWorkbenchViewStateFromWorkspaceState } from "../workbench/viewState";
import {
  createWorkspace as createWorkspaceCommand,
  deleteWorkspace as deleteWorkspaceCommand,
  getWorkspaceWorkbenchState,
  listWorkspaces,
  openWorkspace as openWorkspaceCommand,
} from "./workspaceApi";
import type { WorkspaceStartSelection } from "./selection";
import type { WorkspaceSummary } from "./types";

export const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";

type UseWorkspaceFlowOptions = {
  onOpenWorkspace: (selection: WorkspaceStartSelection) => void;
};

export function useWorkspaceFlow({
  onOpenWorkspace,
}: UseWorkspaceFlowOptions) {
  const [workspaceName, setWorkspaceName] = useState(DEFAULT_WORKSPACE_NAME);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceSummary[]>(
    [],
  );
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
    null,
  );
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedPreset = emptyWorkbenchPreset;

  useEffect(() => {
    let shouldUpdate = true;

    async function loadRecentWorkspaces() {
      setIsLoadingWorkspaces(true);
      setErrorMessage(null);

      try {
        const workspaces = await listWorkspaces();

        if (shouldUpdate) {
          setRecentWorkspaces(workspaces);
        }
      } catch (error) {
        if (shouldUpdate) {
          setErrorMessage(errorToMessage(error));
        }
      } finally {
        if (shouldUpdate) {
          setIsLoadingWorkspaces(false);
        }
      }
    }

    void loadRecentWorkspaces();

    return () => {
      shouldUpdate = false;
    };
  }, []);

  async function createWorkspace() {
    const workspaceTitle = workspaceName.trim() || DEFAULT_WORKSPACE_NAME;

    setIsCreatingWorkspace(true);
    setErrorMessage(null);

    try {
      const workspace = await createWorkspaceCommand({
        title: workspaceTitle,
        description: null,
      });
      const session = await openWorkspaceCommand(workspace.id);

      if (!session) {
        setErrorMessage("Workspace could not be opened.");
        return;
      }

      const workbenchState = await getWorkspaceWorkbenchState(workspace.id);

      if (!workbenchState) {
        setErrorMessage("Workbench state could not be loaded.");
        return;
      }

      onOpenWorkspace({
        preset: selectedPreset,
        session,
        viewState: createWorkbenchViewStateFromWorkspaceState(workbenchState),
        workspace: workbenchState.workspace,
      });
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function openRecentWorkspace(workspace: WorkspaceSummary) {
    setOpeningWorkspaceId(workspace.id);
    setErrorMessage(null);

    try {
      const session = await openWorkspaceCommand(workspace.id);

      if (!session) {
        setErrorMessage("Workspace could not be opened.");
        return;
      }

      const workbenchState = await getWorkspaceWorkbenchState(workspace.id);

      if (!workbenchState) {
        setErrorMessage("Workbench state could not be loaded.");
        return;
      }

      onOpenWorkspace({
        preset: selectedPreset,
        session,
        viewState: createWorkbenchViewStateFromWorkspaceState(workbenchState),
        workspace: workbenchState.workspace,
      });
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setOpeningWorkspaceId(null);
    }
  }

  async function deleteRecentWorkspace(workspace: WorkspaceSummary) {
    setDeletingWorkspaceId(workspace.id);
    setErrorMessage(null);

    try {
      const response = await deleteWorkspaceCommand({
        workspaceId: workspace.id,
      });

      if (!response.deleted) {
        throw new Error("Workspace deletion did not complete.");
      }

      setRecentWorkspaces(response.remainingWorkspaces);
    } finally {
      setDeletingWorkspaceId(null);
    }
  }

  function clearError() {
    setErrorMessage(null);
  }

  return {
    clearError,
    createWorkspace,
    deleteRecentWorkspace,
    deletingWorkspaceId,
    errorMessage,
    isCreatingWorkspace,
    isLoadingWorkspaces,
    openingWorkspaceId,
    openRecentWorkspace,
    recentWorkspaces,
    selectedPreset,
    setWorkspaceName,
    workspaceName,
  };
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Workspace command failed.";
}
