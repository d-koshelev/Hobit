import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";
import { ThemePicker } from "../theme/ThemePicker";
import type { AppThemeController } from "../theme/useAppTheme";
import {
  GlobalActivityIndicator,
  type GlobalActivityStatus,
} from "./GlobalActivityIndicator";
import type { WorkbenchLayoutMode, WorkbenchViewState } from "./types";
import {
  normalizeWorkbenchGridSize,
  WORKBENCH_GRID_SIZE_OPTIONS,
  type WorkbenchGridSize,
} from "./workbenchLayoutGeometry";

type WorkbenchTopBarProps = {
  activityPanelId: string;
  activityStatus: GlobalActivityStatus;
  gridSize: WorkbenchGridSize;
  isActivityPanelOpen: boolean;
  isClosingWorkspace?: boolean;
  layoutMode: WorkbenchLayoutMode;
  onCloseWorkspace?: () => void;
  onGridSizeChange: (gridSize: WorkbenchGridSize) => void;
  onLayoutModeChange: (layoutMode: WorkbenchLayoutMode) => void;
  onOpenWidgetCatalog: () => void;
  onRenameWorkspace?: (title: string) => Promise<boolean>;
  onToggleActivityPanel: () => void;
  theme: AppThemeController;
  viewState: WorkbenchViewState;
};

export function WorkbenchTopBar({
  activityPanelId,
  activityStatus,
  gridSize,
  isActivityPanelOpen,
  isClosingWorkspace = false,
  layoutMode,
  onCloseWorkspace,
  onGridSizeChange,
  onLayoutModeChange,
  onOpenWidgetCatalog,
  onRenameWorkspace,
  onToggleActivityPanel,
  theme,
  viewState,
}: WorkbenchTopBarProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [workspaceTitleDraft, setWorkspaceTitleDraft] = useState(
    viewState.workspace.title,
  );
  const [workspaceRenameError, setWorkspaceRenameError] = useState<
    string | null
  >(null);
  const [isWorkspaceRenameSaving, setIsWorkspaceRenameSaving] = useState(false);
  const [isViewControlOpen, setIsViewControlOpen] = useState(false);
  const presetTitle = viewState.workbench.preset.title;
  const isLayoutLocked = layoutMode === "locked";
  const layoutModeLabel = isLayoutLocked ? "Layout locked" : "Layout unlocked";
  const layoutModeDescription = isLayoutLocked
    ? "Layout locked. Activate to unlock widget move and resize."
    : "Layout unlocked. Widgets can be moved and resized. Activate to lock layout.";

  useEffect(() => {
    if (!isRenameOpen) {
      setWorkspaceTitleDraft(viewState.workspace.title);
      setWorkspaceRenameError(null);
    }
  }, [isRenameOpen, viewState.workspace.title]);

  async function submitWorkspaceRename(event: FormEvent) {
    event.preventDefault();

    const nextTitle = workspaceTitleDraft.trim();

    if (!nextTitle) {
      setWorkspaceRenameError("Workspace name is required.");
      return;
    }

    if (nextTitle === viewState.workspace.title) {
      setIsRenameOpen(false);
      return;
    }

    setIsWorkspaceRenameSaving(true);
    setWorkspaceRenameError(null);

    try {
      const wasRenamed = await onRenameWorkspace?.(nextTitle);

      if (wasRenamed) {
        setIsRenameOpen(false);
      } else {
        setWorkspaceRenameError("Unable to rename workspace.");
      }
    } catch (error) {
      setWorkspaceRenameError(errorToMessage(error));
    } finally {
      setIsWorkspaceRenameSaving(false);
    }
  }

  return (
    <header className="workbench-topbar">
      <div className="topbar-left">
        <div className="brand" aria-label="Hobit AI Workbench">
          <div className="brand-mark" aria-hidden="true">
            H
          </div>
          <div className="brand-copy">
            <div className="brand-name">Hobit</div>
            <div className="brand-subtitle">AI Workbench</div>
          </div>
        </div>

        <div className="workspace-identity">
          {isRenameOpen ? (
            <form
              className="workspace-rename-form"
              onSubmit={(event) => void submitWorkspaceRename(event)}
            >
              <input
                aria-label="Workspace name"
                className="input workspace-rename-input"
                disabled={isWorkspaceRenameSaving}
                onChange={(event) =>
                  setWorkspaceTitleDraft(event.currentTarget.value)
                }
                value={workspaceTitleDraft}
              />
              <Button
                disabled={isWorkspaceRenameSaving}
                type="submit"
                variant="secondary"
              >
                {isWorkspaceRenameSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                disabled={isWorkspaceRenameSaving}
                onClick={() => setIsRenameOpen(false)}
                variant="ghost"
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <Badge
                aria-label={`Workspace ${viewState.workspace.title}`}
                className="workspace-pill"
                variant="neutral"
              >
                <span className="workspace-context-title">
                  {viewState.workspace.title}
                </span>
              </Badge>
              <Button
                aria-label={`Rename workspace ${viewState.workspace.title}`}
                className="workspace-rename-action"
                disabled={!onRenameWorkspace}
                onClick={() => setIsRenameOpen(true)}
                variant="ghost"
              >
                Rename
              </Button>
            </>
          )}
          {workspaceRenameError ? (
            <span className="workspace-rename-error" role="alert">
              {workspaceRenameError}
            </span>
          ) : null}
        </div>

        <Badge
          aria-label={`Workbench layout ${presetTitle}`}
          className="workbench-layout-pill"
          variant="neutral"
        >
          <span className="workspace-context-label">Workbench</span>
          <span className="workspace-context-title">{presetTitle}</span>
        </Badge>
        {onCloseWorkspace ? (
          <Button
            className="close-workspace-action"
            disabled={isClosingWorkspace}
            onClick={onCloseWorkspace}
            variant="ghost"
          >
            {isClosingWorkspace ? "Checking..." : "Close workspace"}
          </Button>
        ) : null}
      </div>

      <div className="topbar-right" aria-label="Workbench controls">
        <GlobalActivityIndicator status={activityStatus} />
        <Button
          aria-controls={activityPanelId}
          aria-expanded={isActivityPanelOpen}
          className="global-activity-toggle"
          onClick={onToggleActivityPanel}
          variant={isActivityPanelOpen ? "secondary" : "ghost"}
        >
          Activity
        </Button>
        <div className="workspace-view-control">
          <Button
            aria-expanded={isViewControlOpen}
            className="workspace-view-trigger"
            onClick={() => setIsViewControlOpen((current) => !current)}
            variant={isViewControlOpen ? "secondary" : "ghost"}
          >
            View
          </Button>
          {isViewControlOpen ? (
            <section
              aria-label="Workspace view controls"
              className="workspace-view-panel"
            >
              <ThemePicker theme={theme} />
              <Button
                aria-label={layoutModeDescription}
                aria-pressed={isLayoutLocked}
                className="layout-mode-toggle"
                onClick={() =>
                  onLayoutModeChange(isLayoutLocked ? "editing" : "locked")
                }
                title={layoutModeDescription}
                variant={isLayoutLocked ? "secondary" : "ghost"}
              >
                {layoutModeLabel}
              </Button>
              <label className="grid-size-control">
                <span className="grid-size-label">Grid</span>
                <Select
                  aria-label="Workbench grid size"
                  className="grid-size-select"
                  onChange={(event) =>
                    onGridSizeChange(
                      normalizeWorkbenchGridSize(Number(event.target.value)),
                    )
                  }
                  value={gridSize}
                >
                  {WORKBENCH_GRID_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}px
                    </option>
                  ))}
                </Select>
              </label>
            </section>
          ) : null}
        </div>
        <Badge variant="info">
          <StatusDot variant="info" />
          Local preview
        </Badge>
        <Button onClick={onOpenWidgetCatalog} variant="secondary">
          + Add Widget
        </Button>
      </div>
    </header>
  );
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unable to rename workspace.";
}
