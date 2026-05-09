import type { ComponentType } from "react";
import { Badge } from "../design-system/Badge";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import type { WidgetInstance, WidgetRenderProps } from "./types";
import {
  getWidgetDefinition,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> = {
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
};

type WidgetHostProps = {
  instance: WidgetInstance;
};

export function WidgetHost({ instance }: WidgetHostProps) {
  const definition = getWidgetDefinition(instance.definitionId);

  if (!definition) {
    return (
      <WidgetFrame
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
      instance={instance}
      title={instance.title || definition.defaultTitle}
    />
  );
}
