import type { WidgetDefinition, WidgetDefinitionId } from "./types";

export const AGENT_CHAT_WIDGET_DEFINITION_ID = "agent-chat";
export const AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY = "agent-chat-placeholder";
export const GIT_WIDGET_DEFINITION_ID = "git";
export const GIT_PLACEHOLDER_COMPONENT_KEY = "git-placeholder";
export const NOTES_WIDGET_DEFINITION_ID = "notes";
export const NOTES_PLACEHOLDER_COMPONENT_KEY = "notes-placeholder";
export const TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID = "template-library";
export const TEMPLATE_LIBRARY_PLACEHOLDER_COMPONENT_KEY =
  "template-library-placeholder";
export const TERMINAL_WIDGET_DEFINITION_ID = "terminal";
export const TERMINAL_PLACEHOLDER_COMPONENT_KEY = "terminal-placeholder";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: AGENT_CHAT_WIDGET_DEFINITION_ID,
    title: "Agent Chat",
    category: "core",
    description: "Static placeholder for future operational agent chat.",
    defaultTitle: "Agent Chat",
    defaultConfig: {},
    componentKey: AGENT_CHAT_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: GIT_WIDGET_DEFINITION_ID,
    title: "Git",
    category: "codebase",
    description:
      "Manual read-only Git status placeholder for an explicit transient repository root.",
    defaultTitle: "Git",
    defaultConfig: {},
    componentKey: GIT_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "notes",
    description: "Persisted placeholder for future workspace notes.",
    defaultTitle: "Notes",
    defaultConfig: {},
    componentKey: NOTES_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Template Library",
    category: "workflow",
    description:
      "Static Request, Response, and Coordinator workflow preview surface.",
    defaultTitle: "Template Library",
    defaultConfig: {},
    componentKey: TEMPLATE_LIBRARY_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    category: "tool",
    description: "Static placeholder for the future terminal runtime.",
    defaultTitle: "Terminal",
    defaultConfig: {},
    componentKey: TERMINAL_PLACEHOLDER_COMPONENT_KEY,
  },
];

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}
