import type { WidgetDefinitionId } from "./types";
import {
  AGENT_CHAT_WIDGET_DEFINITION_ID,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

export type WidgetCatalogCategory =
  | "core"
  | "workflow"
  | "productivity"
  | "tools"
  | "data"
  | "codebase"
  | "design";

export type WidgetCatalogTemplateStatus = "planned" | "available";

export type WidgetCatalogTemplate = {
  id: string;
  title: string;
  category: WidgetCatalogCategory;
  description: string;
  status: WidgetCatalogTemplateStatus;
  capabilitySummary: string[];
  futureWidgetDefinitionId?: WidgetDefinitionId;
};

export const widgetCatalogCategoryLabels: Record<
  WidgetCatalogCategory,
  string
> = {
  core: "Core",
  workflow: "Workflow",
  productivity: "Productivity",
  tools: "Tools",
  data: "Data",
  codebase: "Codebase",
  design: "Design",
};

export const widgetCatalogCategoryOrder: WidgetCatalogCategory[] = [
  "core",
  "workflow",
  "productivity",
  "tools",
  "data",
  "codebase",
  "design",
];

export const plannedWidgetCatalogTemplates: WidgetCatalogTemplate[] = [
  {
    id: "agent-cli",
    title: "Agent CLI",
    category: "core",
    description: "Direct prompt surface for agent interaction.",
    status: "planned",
    capabilitySummary: [
      "Operator prompt surface",
      "Agent activity context",
      "Approval-aware proposals",
    ],
  },
  {
    id: AGENT_RUN_WIDGET_DEFINITION_ID,
    title: "Agent Monitoring",
    category: "core",
    description:
      "Static preview of future Overview Log, Result Report, and Raw trace views for one execution.",
    status: "available",
    capabilitySummary: [
      "Static observability preview",
      "Runtime and streaming not implemented",
      "Parsing and validation not implemented",
    ],
    futureWidgetDefinitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_CHAT_WIDGET_DEFINITION_ID,
    title: "Agent Chat",
    category: "core",
    description: "Static placeholder for future operational agent chat.",
    status: "available",
    capabilitySummary: [
      "Operational agent chat placeholder",
      "Agent runtime not implemented",
      "Workspace context access not implemented",
    ],
    futureWidgetDefinitionId: AGENT_CHAT_WIDGET_DEFINITION_ID,
  },
  {
    id: TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Template Library",
    category: "workflow",
    description:
      "Static previews for future Request, Response, and Coordinator workflow templates.",
    status: "available",
    capabilitySummary: [
      "Request, Response, and workflow previews",
      "Template storage and editing not implemented",
      "Request generation, response capture, and validation not implemented",
    ],
    futureWidgetDefinitionId: TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Static preview of the future agent command queue, history, and review inbox.",
    status: "available",
    capabilitySummary: [
      "Static command queue and review preview",
      "Queue storage and automatic execution not implemented",
      "Response capture, validation, and Git mutation not implemented",
    ],
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
  },
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "productivity",
    description: "Persisted single-draft notes surface.",
    status: "available",
    capabilitySummary: [
      "One saved body draft",
      "Explicit Save action",
      "Notebook tabs, checklists, and todos not implemented",
    ],
    futureWidgetDefinitionId: NOTES_WIDGET_DEFINITION_ID,
  },
  {
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    category: "tools",
    description: "Static placeholder for the planned command execution surface.",
    status: "available",
    capabilitySummary: [
      "Terminal runtime placeholder",
      "Widget-local logs panel",
      "Command execution not implemented",
    ],
    futureWidgetDefinitionId: TERMINAL_WIDGET_DEFINITION_ID,
  },
  {
    id: "script-runner",
    title: "Script Runner",
    category: "tools",
    description:
      "Run an explicitly configured local script with predefined arguments when the operator presses Run.",
    status: "planned",
    capabilitySummary: [
      "Operator-controlled script execution planned",
      "No hidden execution",
      "No script runtime available yet",
    ],
  },
  {
    id: "database-jdbc",
    title: "Database / JDBC",
    category: "data",
    description: "Database connection, SQL runner, and result grid.",
    status: "planned",
    capabilitySummary: [
      "Connection configuration",
      "SQL execution surface",
      "Result grid output",
    ],
  },
  {
    id: "jira",
    title: "JIRA",
    category: "workflow",
    description: "Future read-only-first issue and work tracking context.",
    status: "planned",
    capabilitySummary: [
      "Issue and work tracking context",
      "Read-only first",
      "Operator-approved updates only later",
    ],
  },
  {
    id: "confluence",
    title: "Confluence",
    category: "productivity",
    description: "Future read-only-first documentation and knowledge context.",
    status: "planned",
    capabilitySummary: [
      "Documentation and knowledge context",
      "Read-only first",
      "Operator-approved updates only later",
    ],
  },
  {
    id: GIT_WIDGET_DEFINITION_ID,
    title: "Git",
    category: "codebase",
    description:
      "Read-only manual status snapshot for an explicit transient repository root.",
    status: "available",
    capabilitySummary: [
      "Manual desktop read-only status refresh",
      "Grouped changed files summary",
      "Git mutations, diff, log, and persistence not implemented",
    ],
    futureWidgetDefinitionId: GIT_WIDGET_DEFINITION_ID,
  },
  {
    id: "image-edit",
    title: "Image Edit",
    category: "design",
    description:
      "Image selection, prompt-based edit request, and generated results.",
    status: "planned",
    capabilitySummary: [
      "Image selection",
      "Prompted edit request",
      "Generated result variants",
    ],
  },
];
