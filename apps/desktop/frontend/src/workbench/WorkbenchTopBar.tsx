import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";
import type { WorkbenchPreset } from "./types";

type WorkbenchTopBarProps = {
  preset: WorkbenchPreset;
};

export function WorkbenchTopBar({ preset }: WorkbenchTopBarProps) {
  return (
    <header className="workbench-topbar">
      <div className="brand" aria-label="Hobit AI Workbench">
        <div className="brand-mark" aria-hidden="true">
          H
        </div>
        <div className="brand-copy">
          <div className="brand-name">Hobit</div>
          <div className="brand-subtitle">AI Workbench</div>
        </div>
      </div>

      <div className="topbar-controls">
        <label className="control-group">
          <span className="control-label">Preset</span>
          <Select aria-label="Current preset" value={preset.id} disabled>
            <option value={preset.id}>{preset.title}</option>
          </Select>
        </label>
        <Badge variant="info">
          <StatusDot variant="info" />
          Local mock
        </Badge>
        <Button disabled variant="primary">
          + Add Widget
        </Button>
      </div>
    </header>
  );
}
