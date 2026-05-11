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
    id: "agent-run",
    title: "Agent Run",
    category: "core",
    description:
      "Static preview of future Raw Log, Overview Log, and Result Report views.",
    status: "available",
    capabilitySummary: [
      "Static observability preview",
      "Runtime and streaming not implemented",
      "Parsing and validation not implemented",
    ],
    futureWidgetDefinitionId: "agent-run",
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
      "Static previews for future Request, Response, and Coordinator workflow templates.",
    status: "available",
    capabilitySummary: [
      "Request, Response, and workflow previews",
      "Template storage and editing not implemented",
      "Request generation, response capture, and validation not implemented",
    ],
    futureWidgetDefinitionId: "template-library",
  },
  {
    id: "agent-queue",
    title: "Agent Queue",
    category: "workflow",
    description:
      "Static preview of the future operator review inbox for agent blocks.",
    status: "available",
    capabilitySummary: [
      "Static queue and review inbox preview",
      "Queue storage and automatic execution not implemented",
      "Response capture, validation, and Git mutation not implemented",
    ],
    futureWidgetDefinitionId: "agent-queue",
  },
  {
    id: "notes",
    title: "Notes",
    category: "productivity",
    description: "Persisted single-draft notes surface.",
    status: "available",
    capabilitySummary: [
      "One saved body draft",
      "Explicit Save action",
      "Notebook tabs and scopes not implemented",
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
    description:
      "Read-only manual status snapshot for an explicit transient repository root.",
    status: "available",
    capabilitySummary: [
      "Manual desktop read-only status refresh",
      "Grouped changed files summary",
      "Git mutations, diff, log, and persistence not implemented",
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
