import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";
import type { WorkbenchViewState } from "./viewState";

type WorkbenchTopBarProps = {
  onOpenWidgetCatalog: () => void;
  viewState: WorkbenchViewState;
};

export function WorkbenchTopBar({
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
