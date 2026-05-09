export type WidgetCatalogCategory =
  | "core"
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
  productivity: "Productivity",
  tools: "Tools",
  data: "Data",
  codebase: "Codebase",
  design: "Design",
};

export const widgetCatalogCategoryOrder: WidgetCatalogCategory[] = [
  "core",
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
    description: "Command execution surface with widget-local logs and results.",
    status: "planned",
    capabilitySummary: [
      "Command input",
      "Widget-local console",
      "Structured command results",
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
    id: "git",
    title: "Git",
    category: "codebase",
    description: "Repository status, branches, diffs, and commit context.",
    status: "planned",
    capabilitySummary: [
      "Repository status",
      "Branch and diff context",
      "Commit-aware workflow",
    ],
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
