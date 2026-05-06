import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";
import type { WorkbenchPreset } from "./types";

type WorkbenchTopBarProps = {
  onOpenWidgetCatalog: () => void;
  preset: WorkbenchPreset;
  workspaceTitle: string;
};

export function WorkbenchTopBar({
  onOpenWidgetCatalog,
  preset,
  workspaceTitle,
}: WorkbenchTopBarProps) {
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
          <span className="workspace-context-title">{workspaceTitle}</span>
        </Badge>

        <Select aria-label="Current workbench preset" value={preset.id} disabled>
          <option value={preset.id}>{preset.title}</option>
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
