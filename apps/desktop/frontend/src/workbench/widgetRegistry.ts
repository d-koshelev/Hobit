import type { WidgetDefinition, WidgetDefinitionId } from "./types";

export const AGENT_QUEUE_WIDGET_DEFINITION_ID = "agent-queue";
export const AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY =
  "agent-queue-placeholder";
export const AGENT_RUN_WIDGET_DEFINITION_ID = "agent-run";
export const AGENT_RUN_PLACEHOLDER_COMPONENT_KEY = "agent-run-placeholder";
export const GIT_WIDGET_DEFINITION_ID = "git";
export const GIT_PLACEHOLDER_COMPONENT_KEY = "git-placeholder";
export const INTERACTIVE_AGENT_WIDGET_DEFINITION_ID = "interactive-agent";
export const INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY =
  "interactive-agent-placeholder";
export const NOTES_WIDGET_DEFINITION_ID = "notes";
export const NOTES_PLACEHOLDER_COMPONENT_KEY = "notes-placeholder";
export const RUNBOOK_WIDGET_DEFINITION_ID = "runbook";
export const RUNBOOK_PLACEHOLDER_COMPONENT_KEY = "runbook-placeholder";
export const TERMINAL_WIDGET_DEFINITION_ID = "terminal";
export const TERMINAL_PLACEHOLDER_COMPONENT_KEY = "terminal-placeholder";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: AGENT_RUN_WIDGET_DEFINITION_ID,
    title: "Agent Executor",
    category: "core",
    description:
      "Runs one explicit task and shows execution, logs, result, changed files, and validation.",
    defaultTitle: "Agent Executor",
    defaultConfig: {},
    componentKey: AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Preview surface for queued tasks and executor history; dispatch is not implemented.",
    defaultTitle: "Agent Queue",
    defaultConfig: {},
    componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    title: "Interactive Agent",
    category: "core",
    description:
      "Preview surface for manual long-running agent chat/work with no Queue integration.",
    defaultTitle: "Interactive Agent",
    defaultConfig: {},
    componentKey: INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: RUNBOOK_WIDGET_DEFINITION_ID,
    title: "Runbook",
    category: "workflow",
    description:
      "Preview surface for procedural steps with explicit operator-managed state.",
    defaultTitle: "Runbook",
    defaultConfig: {},
    componentKey: RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
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
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    category: "tool",
    description: "One-shot local command widget for the desktop shell.",
    defaultTitle: "Terminal",
    defaultConfig: {},
    componentKey: TERMINAL_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "notes",
    description: "Workspace-local notes list and editor.",
    defaultTitle: "Notes",
    defaultConfig: {},
    componentKey: NOTES_PLACEHOLDER_COMPONENT_KEY,
  },
];

export const userFacingWidgetDefinitionIds = new Set<WidgetDefinitionId>(
  widgetRegistry.map((definition) => definition.id),
);

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}

export function isUserFacingWidgetDefinition(id: WidgetDefinitionId) {
  return userFacingWidgetDefinitionIds.has(id);
}
