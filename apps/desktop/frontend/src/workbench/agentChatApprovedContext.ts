import type { GlobalActivityStatus } from "./GlobalActivityIndicator";
import type { WorkbenchViewState } from "./types";
import { getWidgetDefinition } from "./widgetRegistry";

export type AgentChatContextSourceId =
  | "workspaceIdentity"
  | "widgetInventory"
  | "activityStatus";

export type AgentChatApprovedContextSelection = Record<
  AgentChatContextSourceId,
  boolean
>;

export type AgentChatContextSourceOption = {
  description: string;
  id: AgentChatContextSourceId;
  label: string;
};

export type AgentChatAvailableContext = {
  activityStatus: {
    detail: string;
    kind: string;
    label: string;
  };
  widgetInventory: readonly AgentChatVisibleWidgetContext[];
  workbench: {
    id: string | null;
    presetId: string | null;
    presetTitle: string;
  };
  workspace: {
    id: string;
    status: string;
    title: string;
  };
};

export type AgentChatVisibleWidgetContext = {
  order: number;
  title: string;
  visible: boolean;
};

export type AgentChatApprovedContextSnapshot = {
  items: readonly AgentChatApprovedContextSnapshotItem[];
  sourceLabels: readonly string[];
  status: "approved" | "none";
  summary: string;
};

export type AgentChatApprovedContextSnapshotItem = {
  lines: readonly string[];
  sourceId: AgentChatContextSourceId;
  title: string;
};

export const agentChatContextSourceOptions: readonly AgentChatContextSourceOption[] =
  [
    {
      description: "Current Workspace name only.",
      id: "workspaceIdentity",
      label: "Use current workspace",
    },
    {
      description: "Names of widgets open in this Workbench.",
      id: "widgetInventory",
      label: "Use open widgets",
    },
    {
      description: "Current-session activity label only.",
      id: "activityStatus",
      label: "Use activity status",
    },
  ];

export const emptyAgentChatApprovedContextSelection: AgentChatApprovedContextSelection =
  {
    activityStatus: false,
    widgetInventory: false,
    workspaceIdentity: false,
  };

export function createAgentChatAvailableContext(
  viewState: WorkbenchViewState,
  activityStatus: GlobalActivityStatus,
): AgentChatAvailableContext {
  return {
    activityStatus: {
      detail: activityStatus.detail,
      kind: activityStatus.kind,
      label: activityStatus.label,
    },
    widgetInventory: viewState.widgets
      .map((widget) => {
        const definition = getWidgetDefinition(widget.definitionId);

        return {
          order: widget.layout.order,
          title:
            widget.title ||
            definition?.defaultTitle ||
            definition?.title ||
            "Untitled widget",
          visible: widget.visible,
        };
      })
      .sort((first, second) => first.order - second.order),
    workbench: {
      id: viewState.workbench.id,
      presetId: viewState.workbench.preset.id,
      presetTitle: viewState.workbench.preset.title,
    },
    workspace: {
      id: viewState.workspace.id,
      status: viewState.workspace.status,
      title: viewState.workspace.title,
    },
  };
}

export function createAgentChatApprovedContextSnapshot(
  availableContext: AgentChatAvailableContext | null,
  selection: AgentChatApprovedContextSelection,
): AgentChatApprovedContextSnapshot {
  if (!availableContext) {
    return emptyContextSnapshot(
      "Operator prompt only. Approved context is unavailable.",
    );
  }

  const items: AgentChatApprovedContextSnapshotItem[] = [];

  if (selection.workspaceIdentity) {
    items.push({
      lines: [`Workspace: ${workspaceTitle(availableContext.workspace.title)}`],
      sourceId: "workspaceIdentity",
      title: "Current workspace",
    });
  }

  if (selection.widgetInventory) {
    items.push({
      lines: widgetInventoryLines(availableContext.widgetInventory),
      sourceId: "widgetInventory",
      title: "Open widgets",
    });
  }

  if (selection.activityStatus) {
    items.push({
      lines: [`Activity: ${availableContext.activityStatus.label}`],
      sourceId: "activityStatus",
      title: "Activity status",
    });
  }

  if (items.length === 0) {
    return emptyContextSnapshot("Operator prompt only. No context selected.");
  }

  const sourceLabels = items.map((item) => item.title);

  return {
    items,
    sourceLabels,
    status: "approved",
    summary: `Approved context: ${sourceLabels.join(", ")}.`,
  };
}

export function isContextSourceSelected(
  selection: AgentChatApprovedContextSelection,
  sourceId: AgentChatContextSourceId,
) {
  return selection[sourceId];
}

function emptyContextSnapshot(summary: string): AgentChatApprovedContextSnapshot {
  return {
    items: [],
    sourceLabels: [],
    status: "none",
    summary,
  };
}

function widgetInventoryLines(
  widgetInventory: readonly AgentChatVisibleWidgetContext[],
) {
  const openWidgetTitles = widgetInventory
    .filter((widget) => widget.visible)
    .map((widget) => widget.title);

  if (openWidgetTitles.length === 0) {
    return ["Open widgets: none"];
  }

  return [`Open widgets: ${openWidgetTitles.join(", ")}`];
}

function workspaceTitle(title: string) {
  return title.trim() || "Untitled Workspace";
}
