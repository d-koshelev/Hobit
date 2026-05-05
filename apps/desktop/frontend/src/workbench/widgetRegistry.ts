import type { WidgetDefinition, WidgetDefinitionId } from "./types";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: "terminal",
    title: "Terminal",
    category: "tool",
    description: "Mock terminal surface for the Minimal Workbench preview.",
    defaultTitle: "Terminal Widget",
    defaultConfig: {},
    componentKey: "terminal",
  },
  {
    id: "agent-cli",
    title: "Agent CLI",
    category: "core",
    description: "Mock direct operator surface for agent interaction.",
    defaultTitle: "Agent CLI Widget",
    defaultConfig: {},
    componentKey: "agent-cli",
  },
];

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}
