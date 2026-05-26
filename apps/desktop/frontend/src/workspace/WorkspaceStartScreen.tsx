import type { FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import { StatusDot } from "../design-system/StatusDot";
import { ThemePicker } from "../theme/ThemePicker";
import type { AppThemeController } from "../theme/useAppTheme";
import type { WorkspaceStartSelection } from "./selection";
import { useWorkspaceFlow } from "./useWorkspaceFlow";
import { WorkspaceRecentItem } from "./WorkspaceRecentItem";

type WorkspaceStartScreenProps = {
  onOpenWorkspace: (selection: WorkspaceStartSelection) => void;
  theme: AppThemeController;
};

export function WorkspaceStartScreen({
  onOpenWorkspace,
  theme,
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
    setSelectedPresetId,
    setWorkspaceName,
    workbenchPresets,
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
          <div className="workspace-start-header-actions">
            <ThemePicker theme={theme} />
            <Badge variant="neutral">Workspace Shell</Badge>
          </div>
        </header>

        <div className="workspace-start-layout">
          <form className="workspace-start-primary" onSubmit={submitWorkspace}>
            <div className="workspace-start-copy">
              <h1 className="workspace-start-title" id="workspace-start-title">
                New Workspace
              </h1>
              <p className="workspace-start-text">
                Name a workspace and start with Workspace Agent and Notes.
                Add Queue, Executor, Git, Terminal, or JDBC only when this work
                needs them.
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
              <legend className="workspace-label">Start mode</legend>
              <div className="preset-choice-list">
                {workbenchPresets.map((preset) => {
                  const isSelected = preset.id === selectedPreset.id;
                  const isEmptyPreset = preset.widgets.length === 0;

                  return (
                    <label
                      className={
                        isSelected
                          ? "preset-choice preset-choice-selected"
                          : "preset-choice"
                      }
                      key={preset.id}
                    >
                      <input
                        checked={isSelected}
                        disabled={isCreatingWorkspace}
                        name="workspace-preset"
                        onChange={() => setSelectedPresetId(preset.id)}
                        type="radio"
                        value={preset.id}
                      />
                      <span className="preset-choice-copy">
                        <span className="preset-choice-title">
                          {isEmptyPreset
                            ? "Start empty"
                            : "Start with Workspace Agent"}
                        </span>
                        <span className="preset-choice-text">
                          {isEmptyPreset
                            ? "Advanced manual mode with no default widgets. Use the Widget Catalog after opening."
                            : "Creates Workspace Agent and Notes as the default MVP workspace."}
                        </span>
                      </span>
                      <Badge variant={isSelected ? "success" : "neutral"}>
                        {isSelected ? <StatusDot variant="success" /> : null}
                        {isSelected
                          ? "Selected"
                          : isEmptyPreset
                            ? "Manual"
                            : "Default"}
                      </Badge>
                    </label>
                  );
                })}
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
