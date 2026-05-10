import type { ComponentType, CSSProperties } from "react";
import { Badge } from "../design-system/Badge";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import type { WidgetInstance, WidgetRenderProps } from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { WidgetSizePresetControls } from "./WidgetSizePresetControls";
import {
  getWidgetDefinition,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
};

type WidgetHostProps = {
  instance: WidgetInstance;
  widgetActions: WorkbenchWidgetInstanceActions;
};

export function WidgetHost({ instance, widgetActions }: WidgetHostProps) {
  const definition = getWidgetDefinition(instance.definitionId);
  const frameActions =
    instance.layout.mode === "docked" ? (
      <WidgetSizePresetControls
        instance={instance}
        onUpdateLayout={widgetActions.updateWidgetLayout}
      />
    ) : undefined;
  const frameStyle = widgetFrameStyle(instance);
  const loadLogs = () => widgetActions.listWidgetLogs(instance.id);

  if (!definition) {
    return (
      <WidgetFrame
        actions={frameActions}
        onLoadLogs={loadLogs}
        style={frameStyle}
        status={<Badge variant="warning">Missing</Badge>}
        subtitle={`Definition "${instance.definitionId}" is not registered.`}
        title={instance.title || "Unknown Widget"}
      >
        <EmptyState
          text="This widget instance cannot render until its definition is available in the frontend registry."
          title="Widget definition missing"
        />
      </WidgetFrame>
    );
  }

  const Component = widgetComponents[definition.componentKey];

  if (!Component) {
    return (
      <WidgetFrame
        actions={frameActions}
        onLoadLogs={loadLogs}
        style={frameStyle}
        status={<Badge variant="warning">Missing</Badge>}
        subtitle={`Component "${definition.componentKey}" is not mapped.`}
        title={instance.title || definition.defaultTitle}
      >
        <EmptyState
          text="This widget definition exists, but the frontend host does not know which React component should render it."
          title="Widget component missing"
        />
      </WidgetFrame>
    );
  }

  return (
    <Component
      config={{ ...definition.defaultConfig, ...instance.config }}
      definition={definition}
      frameActions={frameActions}
      frameStyle={frameStyle}
      instance={instance}
      onLoadLogs={widgetActions.listWidgetLogs}
      onUpdateLayout={widgetActions.updateWidgetLayout}
      onUpdateState={widgetActions.updateWidgetState}
      title={instance.title || definition.defaultTitle}
    />
  );
}

function widgetFrameStyle(instance: WidgetInstance): CSSProperties | undefined {
  if (instance.layout.mode !== "docked") {
    return undefined;
  }

  return {
    height: `${instance.layout.height}px`,
    minHeight: `${instance.layout.height}px`,
    width: `min(100%, ${instance.layout.width}px)`,
  };
}
