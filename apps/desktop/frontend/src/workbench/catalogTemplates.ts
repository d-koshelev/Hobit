import type {
  WidgetCategory,
  WidgetDefinitionId,
  WidgetLayoutDefaults,
} from "./types";
import {
  AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  FINDER_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  JDBC_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  RUNBOOK_WIDGET_DEFINITION_ID,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
  getWidgetLayoutDefaults,
} from "./widgetRegistry";

export type WidgetCatalogCategory =
  | "agents"
  | "knowledge"
  | "developer-tools"
  | "operations";

export type WidgetCatalogTemplateAvailability = "available" | "disabled";
export type WidgetCatalogReadiness = "ready" | "preview" | "planned";

export type WidgetCatalogTemplate = {
  id: string;
  title: string;
  catalogCategory: WidgetCatalogCategory;
  category: WidgetCategory;
  description: string;
  readiness: WidgetCatalogReadiness;
  availability: WidgetCatalogTemplateAvailability;
  layoutDefaults: WidgetLayoutDefaults;
  capabilitySummary: string[];
  futureWidgetDefinitionId?: WidgetDefinitionId;
};

export const widgetCatalogCategoryLabels: Record<WidgetCatalogCategory, string> =
  {
    agents: "Agents",
    knowledge: "Knowledge",
    "developer-tools": "Developer Tools",
    operations: "Operations / Planned",
  };

export const widgetCatalogCategoryDescriptions: Record<
  WidgetCatalogCategory,
  string
> = {
  agents: "Foreground, async, and observable agent work.",
  knowledge: "Saved context and reusable procedures.",
  "developer-tools": "Code, shell, and database surfaces.",
  operations: "Manual procedural work and future operations surfaces.",
};

export const widgetCatalogCategoryOrder: WidgetCatalogCategory[] = [
  "agents",
  "knowledge",
  "developer-tools",
  "operations",
];

export const widgetCatalogReadinessLabels: Record<
  WidgetCatalogReadiness,
  string
> = {
  ready: "Ready / MVP",
  preview: "Preview",
  planned: "Planned",
};

export const widgetCatalogTemplates: WidgetCatalogTemplate[] = [
  {
    id: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    title: "Workspace Agent",
    catalogCategory: "agents",
    category: "core",
    description:
      "Foreground AI agent for chat, coding, reviews, and visible workspace work.",
    readiness: "ready",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    ),
    capabilitySummary: [
      "Chat, planning, coding, and review",
      "Explicit working directory and visible context",
      "No hidden widget tools or automatic queue starts",
    ],
    futureWidgetDefinitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
    title: "Agent Activity",
    catalogCategory: "agents",
    category: "observability",
    description:
      "Readable timeline of current-session agent work.",
    readiness: "ready",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(AGENT_ACTIVITY_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Workspace Agent and Executor activity",
      "Current-session events only",
      "Raw event previews stay collapsed",
    ],
    futureWidgetDefinitionId: AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    catalogCategory: "agents",
    category: "workflow",
    description:
      "Organize async tasks, workers, embedded executor capacity, and executor history.",
    readiness: "preview",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(AGENT_QUEUE_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Manual task planning and assignment",
      "Max, spare, and working executor lanes",
      "Explicit assigned-task starts",
    ],
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
  },
  {
    id: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Knowledge / Skills",
    catalogCategory: "knowledge",
    category: "knowledge",
    description: "Workspace and global documents plus reusable procedures.",
    readiness: "ready",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(SKILL_LIBRARY_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Skills and workspace/global documents",
      "Plain text or Markdown import",
      "Workspace Agent document retrieval is visible",
    ],
    futureWidgetDefinitionId: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  },
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    catalogCategory: "knowledge",
    category: "notes",
    description: "Capture workspace notes and context.",
    readiness: "ready",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(NOTES_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Create, list, edit, and pin notes",
      "Explicit Save action",
      "Plain source text remains the record",
    ],
    futureWidgetDefinitionId: NOTES_WIDGET_DEFINITION_ID,
  },
  {
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    catalogCategory: "developer-tools",
    category: "tool",
    description:
      "Run local terminal commands from an explicit working directory.",
    readiness: "ready",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(TERMINAL_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Classic terminal surface",
      "Explicit shell and working directory",
      "Session-only output buffer",
    ],
    futureWidgetDefinitionId: TERMINAL_WIDGET_DEFINITION_ID,
  },
  {
    id: FINDER_WIDGET_DEFINITION_ID,
    title: "Finder",
    catalogCategory: "developer-tools",
    category: "codebase",
    description:
      "Navigate an explicitly approved project root with Finder-style columns.",
    readiness: "preview",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(FINDER_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Explicit root selection",
      "Column navigation for folders and files",
      "Read-only selected-file preview placeholder",
    ],
    futureWidgetDefinitionId: FINDER_WIDGET_DEFINITION_ID,
  },
  {
    id: JDBC_WIDGET_DEFINITION_ID,
    title: "Database / JDBC",
    catalogCategory: "developer-tools",
    category: "database",
    description:
      "Preview non-secret connection profiles and bounded mock read-only SQL.",
    readiness: "preview",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(JDBC_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Workspace-local connector metadata",
      "Explicit mock read-only query runs",
      "No credentials, writes, or production database execution",
    ],
    futureWidgetDefinitionId: JDBC_WIDGET_DEFINITION_ID,
  },
  {
    id: RUNBOOK_WIDGET_DEFINITION_ID,
    title: "Runbook",
    catalogCategory: "operations",
    category: "workflow",
    description: "Track manual procedural steps and local notes.",
    readiness: "preview",
    availability: "available",
    layoutDefaults: getWidgetLayoutDefaults(RUNBOOK_WIDGET_DEFINITION_ID),
    capabilitySummary: [
      "Built-in sample runbook",
      "Manual step states",
      "No step execution or builder yet",
    ],
    futureWidgetDefinitionId: RUNBOOK_WIDGET_DEFINITION_ID,
  },
];
