import type { WidgetDefinitionId } from "./types";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  RUNBOOK_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

export type WidgetCatalogCategory =
  | "core"
  | "workflow"
  | "productivity"
  | "tools"
  | "codebase";

export type WidgetCatalogTemplateStatus = "available";
export type WidgetCatalogSection = "ready" | "preview";

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
  };

export const widgetCatalogSectionDescriptions: Record<
  WidgetCatalogSection,
  string
> = {
  ready: "Current kept workbench surfaces.",
  preview: "Near-term placeholders that do not execute work yet.",
};

export const widgetCatalogSectionOrder: WidgetCatalogSection[] = [
  "ready",
  "preview",
];

export const widgetCatalogTemplates: WidgetCatalogTemplate[] = [
  {
    id: AGENT_RUN_WIDGET_DEFINITION_ID,
    title: "Agent Executor",
    category: "core",
    description:
      "Runs one task and shows live execution, logs, result, changed files, and validation.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Current provider is Codex CLI",
      "Explicit prompt, repository root, sandbox, and approval policy",
      "No auto-commit, push, queue execution, or Git mutation",
    ],
    futureWidgetDefinitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
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
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
    category: "productivity",
    description: "Workspace-local multi-note capture surface.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Create, list, edit, and pin workspace notes",
      "Explicit Save action",
      "Autosave, tags, archive, and delete not implemented",
    ],
    futureWidgetDefinitionId: NOTES_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Organizes tasks and executor history; execution dispatch is not implemented yet.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Review and history foundation only",
      "No dispatch or queue execution",
      "No automatic acceptance or Git mutation",
    ],
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
  },
  {
    id: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    title: "Coordinator Chat",
    category: "core",
    description:
      "Primary operator chat for planning, asking, and coordinating work through widget capabilities.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Local chat placeholder",
      "No AI provider connected yet",
      "No widget tools or workspace actions yet",
    ],
    futureWidgetDefinitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  },
  {
    id: RUNBOOK_WIDGET_DEFINITION_ID,
    title: "Runbook",
    category: "workflow",
    description:
      "Step-based procedural work placeholder with explicit step states.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Pending, running, done, failed, skipped, and blocked states",
      "Notes and evidence direction per step",
      "Editing, builders, and agent-assisted steps are future work",
    ],
    futureWidgetDefinitionId: RUNBOOK_WIDGET_DEFINITION_ID,
  },
];
