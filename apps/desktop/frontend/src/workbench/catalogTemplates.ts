import type { WidgetDefinitionId } from "./types";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  JDBC_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  RUNBOOK_WIDGET_DEFINITION_ID,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

export type WidgetCatalogCategory =
  | "core"
  | "workflow"
  | "productivity"
  | "tools"
  | "codebase"
  | "database"
  | "knowledge";

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
      "Codex Direct Work requires an explicit execution workspace",
      "Explicit prompt, sandbox, and approval policy",
      "No auto-commit, push, automatic dispatch, or Git mutation",
    ],
    futureWidgetDefinitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
  },
  {
    id: GIT_WIDGET_DEFINITION_ID,
    title: "Git",
    category: "codebase",
    description:
      "Developer Git review panel for status, changes, selected-file diff, history, and explicit local commit.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Desktop read-only status, diff, and history",
      "Grouped changed-file review",
      "Explicit local commit only; no push, reset, clean, or stash",
    ],
    futureWidgetDefinitionId: GIT_WIDGET_DEFINITION_ID,
  },
  {
    id: TERMINAL_WIDGET_DEFINITION_ID,
    title: "Terminal",
    category: "tools",
    description:
      "Classic manual terminal surface for explicit desktop PTY sessions.",
    section: "ready",
    status: "available",
    capabilitySummary: [
      "Explicit working directory and shell",
      "Session-only output buffer",
      "Advanced PTY settings and one-shot fallback are collapsed",
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
    id: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    title: "Skill Library",
    category: "knowledge",
    description:
      "Workspace-local library for operator-authored reusable work instructions.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Create, edit, list, and delete Skill records",
      "Workspace-local and operator-authored",
      "Not sent to Workspace Agent automatically",
    ],
    futureWidgetDefinitionId: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  },
  {
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
    category: "workflow",
    description:
      "Organizes tasks and executor history with explicit assigned-task starts.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Manual task planning and assignment",
      "Explicit assigned-task start only",
      "No automatic acceptance or Git mutation",
    ],
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
  },
  {
    id: JDBC_WIDGET_DEFINITION_ID,
    title: "Database / JDBC",
    category: "database",
    description:
      "Controlled database connector surface. Configure connector metadata now; SQL execution, EXPLAIN, formatting, and AI query assistance are pending.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Workspace-local connector metadata",
      "No credentials, SQL execution, EXPLAIN, or result grid",
      "Future Workspace Agent proxy through approved read-only capabilities",
    ],
    futureWidgetDefinitionId: JDBC_WIDGET_DEFINITION_ID,
  },
  {
    id: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    title: "Workspace Agent",
    category: "core",
    description:
      "Foreground interactive AI agent for planning, task drafting, and result review.",
    section: "preview",
    status: "available",
    capabilitySummary: [
      "Plan work, draft tasks, review results",
      "Independent current-session context and working directory",
      "No hidden widget tools or workspace actions",
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
