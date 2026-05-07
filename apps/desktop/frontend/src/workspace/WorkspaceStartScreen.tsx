import { useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import { StatusDot } from "../design-system/StatusDot";
import { emptyWorkbenchPreset } from "../workbench/presets";
import type { WorkbenchPreset } from "../workbench/types";

const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";

export type WorkspaceStartSelection = {
  preset: WorkbenchPreset;
  workspaceTitle: string;
};

type WorkspaceStartScreenProps = {
  onCreateWorkspace: (selection: WorkspaceStartSelection) => void;
};

export function WorkspaceStartScreen({
  onCreateWorkspace,
}: WorkspaceStartScreenProps) {
  const [workspaceName, setWorkspaceName] = useState(DEFAULT_WORKSPACE_NAME);
  const selectedPreset = emptyWorkbenchPreset;

  function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const workspaceTitle = workspaceName.trim() || DEFAULT_WORKSPACE_NAME;

    onCreateWorkspace({
      preset: selectedPreset,
      workspaceTitle,
    });
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
              <Button type="submit" variant="primary">
                Create Workspace
              </Button>
            </div>
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
            <div className="workspace-recent-empty">
              <p className="workspace-recent-empty-title">
                No recent workspaces yet.
              </p>
              <p className="workspace-recent-empty-text">
                Create a workspace to start building an AI workbench.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
