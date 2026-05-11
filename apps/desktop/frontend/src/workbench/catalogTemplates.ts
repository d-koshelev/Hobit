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
  futureWidgetDefinitionId?: string;
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
    id: "agent-chat",
    title: "Agent Chat",
    category: "core",
    description: "Static placeholder for future operational agent chat.",
    status: "available",
    capabilitySummary: [
      "Operational agent chat placeholder",
      "Agent runtime not implemented",
      "Workspace context access not implemented",
    ],
    futureWidgetDefinitionId: "agent-chat",
  },
  {
    id: "template-library",
    title: "Template Library",
    category: "workflow",
    description:
      "Static placeholder for future Request and Response template management.",
    status: "available",
    capabilitySummary: [
      "Request and Response template placeholder",
      "Template storage and editing not implemented",
      "Request generation and response validation not implemented",
    ],
    futureWidgetDefinitionId: "template-library",
  },
  {
    id: "notes",
    title: "Notes",
    category: "productivity",
    description: "Markdown notes with global and workspace-local scopes.",
    status: "available",
    capabilitySummary: [
      "Markdown documents",
      "Global and workspace scopes",
      "Explicit knowledge promotion",
    ],
    futureWidgetDefinitionId: "notes",
  },
  {
    id: "todo-list",
    title: "To-do List",
    category: "productivity",
    description: "Lightweight checklist for a workspace.",
    status: "planned",
    capabilitySummary: [
      "Workspace checklist",
      "Completion state",
      "Focused task tracking",
    ],
  },
  {
    id: "terminal",
    title: "Terminal",
    category: "tools",
    description: "Static placeholder for the planned command execution surface.",
    status: "available",
    capabilitySummary: [
      "Terminal runtime placeholder",
      "Widget-local logs panel",
      "Command execution not implemented",
    ],
    futureWidgetDefinitionId: "terminal",
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
    id: "git",
    title: "Git",
    category: "codebase",
    description: "Static placeholder for future repository review and control.",
    status: "available",
    capabilitySummary: [
      "Git review placeholder",
      "Repository access not implemented",
      "Git commands not implemented",
    ],
    futureWidgetDefinitionId: "git",
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
