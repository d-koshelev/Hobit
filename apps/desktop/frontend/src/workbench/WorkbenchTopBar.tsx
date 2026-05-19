import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";
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
  activityStatus: GlobalActivityStatus;
  gridSize: WorkbenchGridSize;
  layoutMode: WorkbenchLayoutMode;
  onGridSizeChange: (gridSize: WorkbenchGridSize) => void;
  onLayoutModeChange: (layoutMode: WorkbenchLayoutMode) => void;
  onOpenWidgetCatalog: () => void;
  viewState: WorkbenchViewState;
};

export function WorkbenchTopBar({
  activityStatus,
  gridSize,
  layoutMode,
  onGridSizeChange,
  onLayoutModeChange,
  onOpenWidgetCatalog,
  viewState,
}: WorkbenchTopBarProps) {
  const presetId = viewState.workbench.preset.id ?? "";
  const presetTitle = viewState.workbench.preset.title;

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

        <Badge className="workspace-pill" variant="neutral">
          <span className="workspace-context-label">Workspace</span>
          <span className="workspace-context-title">
            {viewState.workspace.title}
          </span>
        </Badge>

        <Select aria-label="Current workbench preset" value={presetId} disabled>
          <option value={presetId}>{presetTitle}</option>
        </Select>
      </div>

      <div className="topbar-right" aria-label="Workbench controls">
        <GlobalActivityIndicator status={activityStatus} />
        <div
          aria-label="Workbench layout mode"
          className="layout-mode-toggle"
          role="group"
        >
          <Button
            aria-pressed={layoutMode === "locked"}
            onClick={() => onLayoutModeChange("locked")}
            variant={layoutMode === "locked" ? "secondary" : "ghost"}
          >
            Layout locked
          </Button>
          <Button
            aria-pressed={layoutMode === "editing"}
            onClick={() => onLayoutModeChange("editing")}
            variant={layoutMode === "editing" ? "secondary" : "ghost"}
          >
            Edit layout
          </Button>
        </div>
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
