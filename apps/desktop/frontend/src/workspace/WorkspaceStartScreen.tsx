import type { FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import { StatusDot } from "../design-system/StatusDot";
import type { WorkspaceStartSelection } from "./selection";
import { useWorkspaceFlow } from "./useWorkspaceFlow";
import { WorkspaceRecentItem } from "./WorkspaceRecentItem";

type WorkspaceStartScreenProps = {
  onOpenWorkspace: (selection: WorkspaceStartSelection) => void;
};

export function WorkspaceStartScreen({
  onOpenWorkspace,
}: WorkspaceStartScreenProps) {
  const {
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
  } = useWorkspaceFlow({ onOpenWorkspace });

  function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createWorkspace();
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
          <Badge variant="neutral">Workspace Shell</Badge>
        </header>

        <div className="workspace-start-layout">
          <form className="workspace-start-primary" onSubmit={submitWorkspace}>
            <div className="workspace-start-copy">
              <h1 className="workspace-start-title" id="workspace-start-title">
                New Workspace
              </h1>
              <p className="workspace-start-text">
                Name a workspace and open a clean AI Workbench shell for the
                task in front of you.
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
              <div
                aria-label="Selected preset"
                className="preset-choice"
                role="group"
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
              </div>
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
                  Loading recent workspaces...
                </p>
              </div>
            ) : recentWorkspaces.length > 0 ? (
              <div className="workspace-recent-list">
                {recentWorkspaces.map((workspace) => (
                  <WorkspaceRecentItem
                    isDeleting={deletingWorkspaceId === workspace.id}
                    isDisabled={isCreatingWorkspace}
                    isOpening={openingWorkspaceId === workspace.id}
                    key={workspace.id}
                    onDeleteWorkspace={deleteRecentWorkspace}
                    onOpenWorkspace={(workspace) =>
                      void openRecentWorkspace(workspace)
                    }
                    workspace={workspace}
                  />
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
