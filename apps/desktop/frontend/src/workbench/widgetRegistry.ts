import type {
  WidgetDefinition,
  WidgetDefinitionId,
  WidgetLayoutDefaults,
} from "./types";

export const AGENT_ACTIVITY_WIDGET_DEFINITION_ID = "agent-activity";
export const AGENT_ACTIVITY_COMPONENT_KEY = "agent-activity-widget";
export const AGENT_QUEUE_WIDGET_DEFINITION_ID = "agent-queue";
// Saved-widget-compatible active Agent Queue product route. WidgetHost maps
// this component key to AgentQueuePlaceholderWidget, which renders the root
// AgentQueueV2Board surface.
export const AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY =
  "agent-queue-placeholder";
export const AGENT_RUN_WIDGET_DEFINITION_ID = "agent-run";
export const AGENT_RUN_PLACEHOLDER_COMPONENT_KEY = "agent-run-placeholder";
// Deprecated compatibility identity only. Git must not be offered as a normal
// product catalog widget; Workspace Git APIs own current Git reads.
export const GIT_WIDGET_DEFINITION_ID = "git";
export const GIT_PLACEHOLDER_COMPONENT_KEY = "git-placeholder";
export const FINDER_WIDGET_DEFINITION_ID = "finder";
export const FINDER_WIDGET_COMPONENT_KEY = "finder-widget";
export const JDBC_WIDGET_DEFINITION_ID = "database-jdbc";
export const JDBC_WIDGET_COMPONENT_KEY = "database-jdbc-widget";
export const INTERACTIVE_AGENT_WIDGET_DEFINITION_ID = "interactive-agent";
export const INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY =
  "interactive-agent-placeholder";
export const NOTES_WIDGET_DEFINITION_ID = "notes";
export const NOTES_PLACEHOLDER_COMPONENT_KEY = "notes-placeholder";
export const RUNBOOK_WIDGET_DEFINITION_ID = "runbook";
export const RUNBOOK_PLACEHOLDER_COMPONENT_KEY = "runbook-placeholder";
export const SKILL_LIBRARY_WIDGET_DEFINITION_ID = "skill-library";
export const SKILL_LIBRARY_COMPONENT_KEY = "skill-library-widget";
export const TERMINAL_WIDGET_DEFINITION_ID = "terminal";
export const TERMINAL_PLACEHOLDER_COMPONENT_KEY = "terminal-placeholder";

export const FALLBACK_WIDGET_LAYOUT_DEFAULTS: WidgetLayoutDefaults = {
  defaultWidth: 360,
  defaultHeight: 240,
  minWidth: 336,
  minHeight: 240,
};

export const widgetLayoutDefaultsByDefinitionId: Record<
  WidgetDefinitionId,
  WidgetLayoutDefaults
> = {
  [AGENT_ACTIVITY_WIDGET_DEFINITION_ID]: {
    defaultWidth: 600,
    defaultHeight: 600,
    minWidth: 480,
    minHeight: 432,
  },
  [AGENT_QUEUE_WIDGET_DEFINITION_ID]: {
    defaultWidth: 1160,
    defaultHeight: 680,
    minWidth: 720,
    minHeight: 432,
  },
  [AGENT_RUN_WIDGET_DEFINITION_ID]: {
    defaultWidth: 672,
    defaultHeight: 600,
    minWidth: 576,
    minHeight: 480,
  },
  [GIT_WIDGET_DEFINITION_ID]: {
    defaultWidth: 768,
    defaultHeight: 600,
    minWidth: 576,
    minHeight: 456,
  },
  [FINDER_WIDGET_DEFINITION_ID]: {
    defaultWidth: 840,
    defaultHeight: 600,
    minWidth: 672,
    minHeight: 432,
  },
  [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID]: {
    defaultWidth: 840,
    defaultHeight: 672,
    minWidth: 672,
    minHeight: 480,
  },
  [JDBC_WIDGET_DEFINITION_ID]: {
    defaultWidth: 768,
    defaultHeight: 600,
    minWidth: 576,
    minHeight: 456,
  },
  [NOTES_WIDGET_DEFINITION_ID]: {
    defaultWidth: 480,
    defaultHeight: 552,
    minWidth: 384,
    minHeight: 432,
  },
  [RUNBOOK_WIDGET_DEFINITION_ID]: {
    defaultWidth: 600,
    defaultHeight: 552,
    minWidth: 432,
    minHeight: 384,
  },
  [SKILL_LIBRARY_WIDGET_DEFINITION_ID]: {
    defaultWidth: 744,
    defaultHeight: 600,
    minWidth: 576,
    minHeight: 480,
  },
  [TERMINAL_WIDGET_DEFINITION_ID]: {
    defaultWidth: 816,
    defaultHeight: 600,
    minWidth: 672,
    minHeight: 432,
  },
};

export const productWidgetDefinitions: WidgetDefinition[] = [
  {
    id: AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
    title: "Agent Activity",
    category: "observability",
    description: "Readable timeline of current-session agent work.",
    defaultTitle: "Agent Activity",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[AGENT_ACTIVITY_WIDGET_DEFINITION_ID],
    componentKey: AGENT_ACTIVITY_COMPONENT_KEY,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Preview surface for promoted async tasks, workers, embedded executor capacity, and executor run history.",
    defaultTitle: "Agent Queue",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[AGENT_QUEUE_WIDGET_DEFINITION_ID],
    componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
    singleton: true,
    singletonScope: "workspace",
    singletonKey: "workspace-queue",
  },
  {
    id: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    title: "Workspace Agent",
    category: "core",
    description:
      "Foreground AI agent for chat, coding, reviews, and visible workspace work.",
    defaultTitle: "Workspace Agent",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[
        INTERACTIVE_AGENT_WIDGET_DEFINITION_ID
      ],
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
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[RUNBOOK_WIDGET_DEFINITION_ID],
    componentKey: RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Knowledge / Skills",
    category: "knowledge",
    description: "Workspace and global documents plus reusable procedures.",
    defaultTitle: "Knowledge / Skills",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[SKILL_LIBRARY_WIDGET_DEFINITION_ID],
    componentKey: SKILL_LIBRARY_COMPONENT_KEY,
  },
  {
    id: FINDER_WIDGET_DEFINITION_ID,
    title: "Finder",
    category: "codebase",
    description:
      "Column-based project file navigation from an explicit approved root.",
    defaultTitle: "Finder",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[FINDER_WIDGET_DEFINITION_ID],
    componentKey: FINDER_WIDGET_COMPONENT_KEY,
  },
  {
    id: JDBC_WIDGET_DEFINITION_ID,
    title: "Database / JDBC",
    category: "database",
    description:
      "Preview non-secret connection profiles and bounded mock read-only queries.",
    defaultTitle: "Database / JDBC",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[JDBC_WIDGET_DEFINITION_ID],
    componentKey: JDBC_WIDGET_COMPONENT_KEY,
  },
  {
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    category: "tool",
    description:
      "Classic terminal surface for explicit desktop working directories.",
    defaultTitle: "Terminal",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[TERMINAL_WIDGET_DEFINITION_ID],
    componentKey: TERMINAL_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "notes",
    description: "Capture workspace notes and context.",
    defaultTitle: "Notes",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[NOTES_WIDGET_DEFINITION_ID],
    componentKey: NOTES_PLACEHOLDER_COMPONENT_KEY,
  },
];

// Compatibility definitions stay registered only so persisted widget instances
// and old workspace data can resolve. They are excluded from normal product
// catalog insertion and the current product canvas path.
export const compatibilityWidgetDefinitions: WidgetDefinition[] = [
  {
    id: AGENT_RUN_WIDGET_DEFINITION_ID,
    title: "Agent Executor",
    category: "core",
    description:
      "Compatibility-only supporting Direct Work detail surface for existing agent-run instances.",
    defaultTitle: "Agent Executor",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[AGENT_RUN_WIDGET_DEFINITION_ID],
    componentKey: AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  },
  {
    id: GIT_WIDGET_DEFINITION_ID,
    title: "Git",
    category: "codebase",
    description:
      "Internal/deprecated compatibility surface. Workspace Git APIs own current Git functionality.",
    defaultTitle: "Git",
    defaultConfig: {},
    layoutDefaults:
      widgetLayoutDefaultsByDefinitionId[GIT_WIDGET_DEFINITION_ID],
    componentKey: GIT_PLACEHOLDER_COMPONENT_KEY,
  },
];

export const widgetRegistry: WidgetDefinition[] = [
  ...productWidgetDefinitions,
  ...compatibilityWidgetDefinitions,
];

export const internalDeprecatedWidgetDefinitionIds = new Set<WidgetDefinitionId>([
  GIT_WIDGET_DEFINITION_ID,
]);

export const internalCompatibilityWidgetDefinitionIds =
  new Set<WidgetDefinitionId>([
    AGENT_RUN_WIDGET_DEFINITION_ID,
    GIT_WIDGET_DEFINITION_ID,
  ]);

export const userFacingWidgetDefinitionIds = new Set<WidgetDefinitionId>(
  widgetRegistry
    .filter(
      (definition) =>
        !internalCompatibilityWidgetDefinitionIds.has(definition.id),
    )
    .map((definition) => definition.id),
);

export function getWidgetDefinition(id: WidgetDefinitionId) {
  return widgetRegistry.find((definition) => definition.id === id);
}

export function findWorkspaceSingletonDefinition(id: WidgetDefinitionId) {
  const definition = getWidgetDefinition(id);

  if (
    definition?.singleton !== true ||
    definition.singletonScope !== "workspace" ||
    !definition.singletonKey
  ) {
    return undefined;
  }

  return definition;
}

export function getWidgetLayoutDefaults(id: WidgetDefinitionId) {
  return widgetLayoutDefaultsByDefinitionId[id] ?? FALLBACK_WIDGET_LAYOUT_DEFAULTS;
}

export function isUserFacingWidgetDefinition(id: WidgetDefinitionId) {
  return userFacingWidgetDefinitionIds.has(id);
}
