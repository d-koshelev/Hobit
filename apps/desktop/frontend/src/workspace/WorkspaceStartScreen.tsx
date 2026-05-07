import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import { StatusDot } from "../design-system/StatusDot";
import { emptyWorkbenchPreset } from "../workbench/presets";
import type { WorkbenchPreset } from "../workbench/types";
import {
  createWorkspace as createWorkspaceCommand,
  listWorkspaces,
  openWorkspace,
} from "./workspaceApi";
import type { WorkspaceSessionSummary, WorkspaceSummary } from "./workspaceApi";

const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";

export type WorkspaceStartSelection = {
  preset: WorkbenchPreset;
  session: WorkspaceSessionSummary | null;
  workspace: WorkspaceSummary;
};

type WorkspaceStartScreenProps = {
  onOpenWorkspace: (selection: WorkspaceStartSelection) => void;
};

export function WorkspaceStartScreen({
  onOpenWorkspace,
}: WorkspaceStartScreenProps) {
  const [workspaceName, setWorkspaceName] = useState(DEFAULT_WORKSPACE_NAME);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceSummary[]>(
    [],
  );
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
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

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const workspaceTitle = workspaceName.trim() || DEFAULT_WORKSPACE_NAME;

    setIsCreatingWorkspace(true);
    setErrorMessage(null);

    try {
      const workspace = await createWorkspaceCommand({
        title: workspaceTitle,
        description: null,
      });
      const session = await openWorkspace(workspace.id);

      onOpenWorkspace({
        preset: selectedPreset,
        session,
        workspace,
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
      const session = await openWorkspace(workspace.id);

      if (!session) {
        setErrorMessage("Workspace could not be opened.");
        return;
      }

      onOpenWorkspace({
        preset: selectedPreset,
        session,
        workspace,
      });
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setOpeningWorkspaceId(null);
    }
  }

  return (
    <main className="workspace-start-shell">
      <section
        aria-labelledby="workspace-start-title"
        className="workspace-start"
      >
        <header className="workspace-start-header">
          <div className="brand" aria-label="Hobit AI Workbench">
            <div className="brand-mark" aria-hidden="true">
              H
            </div>
            <div className="brand-copy">
              <div className="brand-name">Hobit</div>
              <div className="brand-subtitle">AI Workbench</div>
            </div>
          </div>
        </header>

        <div className="workspace-start-layout">
          <form className="workspace-start-primary" onSubmit={createWorkspace}>
            <div className="workspace-start-copy">
              <h1 className="workspace-start-title" id="workspace-start-title">
                Start a Workspace
              </h1>
              <p className="workspace-start-text">
                Create a workspace to open an empty workbench for the task in
                front of you.
              </p>
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="workspace-name">
                Workspace name
              </label>
              <Input
                disabled={isCreatingWorkspace}
                id="workspace-name"
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                value={workspaceName}
              />
            </div>

            <fieldset className="preset-field">
              <legend className="workspace-label">Preset</legend>
              <button
                aria-pressed="true"
                className="preset-choice"
                type="button"
              >
                <span className="preset-choice-copy">
                  <span className="preset-choice-title">
                    {selectedPreset.title}
                  </span>
                  <span className="preset-choice-text">
                    No default widgets. Compose the workbench when you need
                    capabilities.
                  </span>
                </span>
                <Badge variant="success">
                  <StatusDot variant="success" />
                  Selected
                </Badge>
              </button>
            </fieldset>

            <div className="workspace-start-actions">
              <Button
                disabled={isCreatingWorkspace}
                type="submit"
                variant="primary"
              >
                {isCreatingWorkspace ? "Creating..." : "Create Workspace"}
              </Button>
            </div>

            {errorMessage ? (
              <p className="workspace-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </form>

          <section
            aria-labelledby="recent-workspaces-title"
            className="workspace-recent"
          >
            <div className="workspace-section-heading">
              <h2
                className="workspace-section-title"
                id="recent-workspaces-title"
              >
                Recent Workspaces
              </h2>
            </div>
            {isLoadingWorkspaces ? (
              <div className="workspace-recent-empty">
                <p className="workspace-recent-empty-title">
                  Loading recent workspaces.
                </p>
              </div>
            ) : recentWorkspaces.length > 0 ? (
              <div className="workspace-recent-list">
                {recentWorkspaces.map((workspace) => (
                  <button
                    className="workspace-recent-item"
                    disabled={
                      isCreatingWorkspace || openingWorkspaceId === workspace.id
                    }
                    key={workspace.id}
                    onClick={() => void openRecentWorkspace(workspace)}
                    type="button"
                  >
                    <span className="workspace-recent-item-copy">
                      <span className="workspace-recent-item-title">
                        {workspace.title}
                      </span>
                      {workspace.description ? (
                        <span className="workspace-recent-item-text">
                          {workspace.description}
                        </span>
                      ) : null}
                    </span>
                    <Badge variant="neutral">{workspace.status}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-recent-empty">
                <p className="workspace-recent-empty-title">
                  No recent workspaces yet.
                </p>
                <p className="workspace-recent-empty-text">
                  Create a workspace to start building an AI workbench.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
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
