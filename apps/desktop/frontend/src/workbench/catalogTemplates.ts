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
export type WidgetCatalogSection = "ready" | "preview" | "planned";

export type WidgetCatalogTemplate = {
  id: string;
  title: string;
  category: WidgetCatalogCategory;
  description: string;
  section: WidgetCatalogSection;
  status: WidgetCatalogTemplateStatus;
  capabilitySummary: string[];
  futureWidgetDefinitionId?: WidgetDefinitionId;
};

export const widgetCatalogSectionLabels: Record<WidgetCatalogSection, string> =
  {
    ready: "Ready",
    preview: "Preview",
    planned: "Planned",
  };

export const widgetCatalogSectionDescriptions: Record<
  WidgetCatalogSection,
  string
> = {
  ready: "Current demo-ready workbench surfaces.",
  preview: "Useful secondary surfaces for proposal review and product direction.",
  planned: "Future widgets are collapsed by default and not part of the current demo.",
};

export const widgetCatalogSectionOrder: WidgetCatalogSection[] = [
  "ready",
  "preview",
  "planned",
];

export const widgetCatalogTemplates: WidgetCatalogTemplate[] = [
  {
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "productivity",
    description: "Persisted single-draft notes surface.",
    section: "ready",
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
    description: "Desktop one-shot local command runner, not an interactive shell.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Explicit program plus argv",
      "Final stdout/stderr result",
      "No shell, PTY, streaming, or command history",
    ],
    futureWidgetDefinitionId: TERMINAL_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_CHAT_WIDGET_DEFINITION_ID,
    title: "Agent Chat",
    category: "core",
    description:
      "Proposal-only mock with explicit approved current-view context.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Local structured proposal preview",
      "Approved metadata only",
      "No LLM, tools, or mutations",
    ],
    futureWidgetDefinitionId: AGENT_CHAT_WIDGET_DEFINITION_ID,
  },
  {
    id: GIT_WIDGET_DEFINITION_ID,
    title: "Git",
    category: "codebase",
    description:
      "Manual read-only status snapshot for an explicit transient repository root.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Desktop read-only refresh",
      "Grouped changed files summary",
      "No Git mutations, diff, log, or persistence",
    ],
    futureWidgetDefinitionId: GIT_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_RUN_WIDGET_DEFINITION_ID,
    title: "Direct Work / Codex",
    category: "core",
    description:
      "Run Codex on a focused task from Hobit with explicit repo and sandbox inputs.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Run Codex on a focused task from Hobit",
      "Paste prompt and repo root",
      "Supports read-only and workspace-write sandbox",
      "No auto-commit or push",
    ],
    futureWidgetDefinitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Optional review inbox for saved proposal-only Agent Chat results.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Optional needs-review items",
      "Read-only proposal details",
      "No queue execution, approval, or apply flow",
    ],
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
  },
  {
    id: TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Template Library",
    category: "workflow",
    description:
      "Static preview for future request and response template workflows.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Template direction preview",
      "Local generated request preview",
      "No storage, send, executor, or validation",
    ],
    futureWidgetDefinitionId: TEMPLATE_LIBRARY_WIDGET_DEFINITION_ID,
  },
  {
    id: "agent-cli",
    title: "Agent CLI",
    category: "core",
    description: "Future prompt surface for agent interaction.",
    section: "planned",
    status: "planned",
    capabilitySummary: [
      "Future operator prompt surface",
      "Future agent activity context",
      "Not available in this demo",
    ],
  },
  {
    id: "script-runner",
    title: "Script Runner",
    category: "tools",
    description:
      "Run an explicitly configured local script with predefined arguments when the operator presses Run.",
    section: "planned",
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
    section: "planned",
    status: "planned",
    capabilitySummary: [
      "Future connection configuration",
      "Future SQL execution surface",
      "Not available in this demo",
    ],
  },
  {
    id: "jira",
    title: "JIRA",
    category: "workflow",
    description: "Future read-only-first issue and work tracking context.",
    section: "planned",
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
    section: "planned",
    status: "planned",
    capabilitySummary: [
      "Documentation and knowledge context",
      "Read-only first",
      "Operator-approved updates only later",
    ],
  },
  {
    id: "image-edit",
    title: "Image Edit",
    category: "design",
    description:
      "Image selection, prompt-based edit request, and generated results.",
    section: "planned",
    status: "planned",
    capabilitySummary: [
      "Future image selection",
      "Future prompted edit request",
      "Not available in this demo",
    ],
  },
];
