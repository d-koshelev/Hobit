import type { WidgetDefinition, WidgetDefinitionId } from "./types";

export const NOTES_WIDGET_DEFINITION_ID = "notes";
export const NOTES_PLACEHOLDER_COMPONENT_KEY = "notes-placeholder";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "notes",
    description: "Persisted placeholder for future workspace notes.",
    defaultTitle: "Notes",
    defaultConfig: {},
    componentKey: NOTES_PLACEHOLDER_COMPONENT_KEY,
  },
];

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}
