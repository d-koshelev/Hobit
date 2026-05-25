import type { CSSProperties } from "react";
import { Button } from "../design-system/Button";

type WorkbenchEmptyCanvasProps = {
  canvasGridStyle: CSSProperties;
  canvasLabel: string;
  canvasShellClass: string;
  onOpenWidgetCatalog: () => void;
  onStartCoordinatorWorkspace: () => void;
};

export function WorkbenchEmptyCanvas({
  canvasGridStyle,
  canvasLabel,
  canvasShellClass,
  onOpenWidgetCatalog,
  onStartCoordinatorWorkspace,
}: WorkbenchEmptyCanvasProps) {
  return (
    <section
      className={canvasShellClass}
      aria-label={canvasLabel}
      style={canvasGridStyle}
    >
      <div className="canvas-stack">
        <div className="empty-workbench" aria-label="Empty workbench">
          <div className="empty-workbench-content">
            <h1 className="empty-workbench-title">Your workbench is empty</h1>
            <p className="empty-workbench-text">
              Start with Coordinator Chat and Notes, or add individual widgets
              for a manual workbench.
            </p>
            <div className="empty-workbench-actions">
              <Button onClick={onStartCoordinatorWorkspace} variant="primary">
                Add Coordinator + Notes
              </Button>
              <Button onClick={onOpenWidgetCatalog} variant="secondary">
                + Add Widget
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
