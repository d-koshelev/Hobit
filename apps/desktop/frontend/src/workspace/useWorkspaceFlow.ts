import { useEffect, useState } from "react";
import {
  defaultWorkbenchPreset,
  workbenchPresets,
} from "../workbench/presets";
import { applyPresetWidgetsToWorkspaceState } from "../workbench/presetWidgetSetup";
import { createWorkbenchViewStateFromWorkspaceState } from "../workbench/viewState";
import {
  createWorkspace as createWorkspaceCommand,
  deleteWorkspace as deleteWorkspaceCommand,
  getWorkspaceWorkbenchState,
  listWorkspaces,
  openWorkspace as openWorkspaceCommand,
  selectWorkspaceDirectory,
} from "./workspaceApi";
import type { WorkspaceStartSelection } from "./selection";
import type { WorkspaceSummary } from "./types";

export const DEFAULT_WORKSPACE_NAME = "Untitled";

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
  const [isSelectingWorkspaceDirectory, setIsSelectingWorkspaceDirectory] =
    useState(false);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
    null,
  );
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(
    defaultWorkbenchPreset.id,
  );
  const [selectedWorkspaceRootPath, setSelectedWorkspaceRootPath] = useState<
    string | null
  >(null);
  const selectedPreset =
    workbenchPresets.find((preset) => preset.id === selectedPresetId) ??
    defaultWorkbenchPreset;

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
    const workspaceRootPath = normalizeWorkspaceRoot(selectedWorkspaceRootPath);

    if (!workspaceRootPath) {
      setErrorMessage("Choose a workspace folder before creating a Workspace.");
      return;
    }

    setIsCreatingWorkspace(true);
    setErrorMessage(null);

    try {
      const workspace = await createWorkspaceCommand({
        title: workspaceTitle,
        description: null,
        rootPath: workspaceRootPath,
      });
      const session = await openWorkspaceCommand(workspace.id);

      if (!session) {
        setErrorMessage("Workspace could not be opened.");
        return;
      }

      let workbenchState = await getWorkspaceWorkbenchState(workspace.id);

      if (!workbenchState) {
        setErrorMessage("Workbench state could not be loaded.");
        return;
      }

      workbenchState = await applyPresetWidgetsToWorkspaceState(
        workbenchState,
        selectedPreset,
      );

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

  async function chooseWorkspaceDirectory() {
    setIsSelectingWorkspaceDirectory(true);
    setErrorMessage(null);

    try {
      const selectedDirectory = normalizeWorkspaceRoot(
        await selectWorkspaceDirectory(),
      );

      if (selectedDirectory) {
        setSelectedWorkspaceRootPath(selectedDirectory);
      }
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setIsSelectingWorkspaceDirectory(false);
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
    chooseWorkspaceDirectory,
    deleteRecentWorkspace,
    deletingWorkspaceId,
    errorMessage,
    isCreatingWorkspace,
    isLoadingWorkspaces,
    isSelectingWorkspaceDirectory,
    openingWorkspaceId,
    openRecentWorkspace,
    recentWorkspaces,
    selectedPreset,
    selectedWorkspaceRootPath,
    setSelectedPresetId,
    setWorkspaceName,
    workbenchPresets,
    workspaceName,
  };
}

function normalizeWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
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
