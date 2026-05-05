import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Select } from "../design-system/Select";
import { StatusDot } from "../design-system/StatusDot";

export function WorkbenchTopBar() {
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
        <Select aria-label="Current preset" value="minimal" disabled>
          <option value="minimal">Minimal Workbench</option>
        </Select>
        <Badge variant="info">
          <StatusDot variant="info" />
          Local mock session
        </Badge>
        <Button disabled variant="primary">
          + Add Widget
        </Button>
      </div>
    </header>
  );
}
