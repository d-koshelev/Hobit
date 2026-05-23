import type { CSSProperties } from "react";
import { Button } from "../design-system/Button";

type WorkbenchEmptyCanvasProps = {
  canvasGridStyle: CSSProperties;
  canvasLabel: string;
  canvasShellClass: string;
  onOpenWidgetCatalog: () => void;
};

export function WorkbenchEmptyCanvas({
  canvasGridStyle,
  canvasLabel,
  canvasShellClass,
  onOpenWidgetCatalog,
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
              Add widgets to compose your AI workspace.
            </p>
            <Button onClick={onOpenWidgetCatalog} variant="primary">
              + Add Widget
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
