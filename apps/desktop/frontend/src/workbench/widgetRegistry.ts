import type { WidgetDefinition, WidgetDefinitionId } from "./types";

export const widgetRegistry: WidgetDefinition[] = [];

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}
