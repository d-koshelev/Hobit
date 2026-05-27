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
  onToggleActivityPanel,
  theme,
  viewState,
}: WorkbenchTopBarProps) {
  const presetId = viewState.workbench.preset.id ?? "";
  const presetTitle = viewState.workbench.preset.title;
  const isLayoutLocked = layoutMode === "locked";
  const layoutModeLabel = isLayoutLocked ? "Layout locked" : "Layout unlocked";
  const layoutModeDescription = isLayoutLocked
    ? "Layout locked. Activate to unlock widget move and resize."
    : "Layout unlocked. Widgets can be moved and resized. Activate to lock layout.";

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

        <Badge
          aria-label={`Workspace ${viewState.workspace.title}`}
          className="workspace-pill"
          variant="neutral"
        >
          <span className="workspace-context-title">
            {viewState.workspace.title}
          </span>
        </Badge>

        <Select aria-label="Current workbench preset" value={presetId} disabled>
          <option value={presetId}>{presetTitle}</option>
        </Select>
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
        <ThemePicker theme={theme} />
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
