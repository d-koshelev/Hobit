import { Button } from "../design-system/Button";
import { Panel } from "../design-system/Panel";
import type { WidgetInstance, WidgetInstanceId } from "./types";
import { widgetGhostStyle } from "./workbenchLayoutGeometry";

type WorkbenchWidgetGhostProps = {
  instance: WidgetInstance;
  onDockBack: (widgetInstanceId: WidgetInstanceId) => void;
};

export function WorkbenchWidgetGhost({
  instance,
  onDockBack,
}: WorkbenchWidgetGhostProps) {
  return (
    <Panel
      aria-label={`${instance.title} floating widget placeholder`}
      className="widget-ghost"
      style={widgetGhostStyle(instance)}
    >
      <div className="widget-ghost-copy">
        <h2 className="widget-ghost-title">{instance.title}</h2>
        <p className="widget-ghost-status">Floating in workspace</p>
      </div>
      <Button onClick={() => onDockBack(instance.id)} variant="secondary">
        Dock back
      </Button>
    </Panel>
  );
}
