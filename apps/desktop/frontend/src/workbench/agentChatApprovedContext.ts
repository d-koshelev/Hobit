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
  componentKey: string;
  definitionId: string;
  definitionTitle: string;
  id: string;
  layoutMode: string;
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
      description:
        "Workspace title, id, status, and active Workbench/preset identity only.",
      id: "workspaceIdentity",
      label: "Include workspace identity",
    },
    {
      description:
        "Widget ids, titles, definitions, component keys, layout modes, and visibility only.",
      id: "widgetInventory",
      label: "Include widget inventory",
    },
    {
      description:
        "Current-session global activity label and detail only.",
      id: "activityStatus",
      label: "Include current activity status",
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
          componentKey: definition?.componentKey ?? "unregistered",
          definitionId: widget.definitionId,
          definitionTitle: definition?.title ?? widget.definitionId,
          id: widget.id,
          layoutMode: widget.layout.mode,
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
      "Operator prompt only. Current-view context metadata is unavailable.",
    );
  }

  const items: AgentChatApprovedContextSnapshotItem[] = [];

  if (selection.workspaceIdentity) {
    items.push({
      lines: [
        `Workspace: ${availableContext.workspace.title} (${availableContext.workspace.id})`,
        `Workspace status: ${availableContext.workspace.status}`,
        `Workbench: ${availableContext.workbench.presetTitle} (${availableContext.workbench.id ?? "no persisted workbench id"})`,
      ],
      sourceId: "workspaceIdentity",
      title: "Workspace identity",
    });
  }

  if (selection.widgetInventory) {
    items.push({
      lines: widgetInventoryLines(availableContext.widgetInventory),
      sourceId: "widgetInventory",
      title: "Widget inventory",
    });
  }

  if (selection.activityStatus) {
    items.push({
      lines: [
        `Activity: ${availableContext.activityStatus.label} - ${availableContext.activityStatus.detail}`,
        `Activity kind: ${availableContext.activityStatus.kind}`,
      ],
      sourceId: "activityStatus",
      title: "Current activity status",
    });
  }

  if (items.length === 0) {
    return emptyContextSnapshot(
      "Operator prompt only. No workspace context approved.",
    );
  }

  const sourceLabels = items.map((item) => item.title);

  return {
    items,
    sourceLabels,
    status: "approved",
    summary: `Approved current-view context: ${sourceLabels.join(", ")}.`,
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
  if (widgetInventory.length === 0) {
    return ["No widget instances are currently present in this Workbench."];
  }

  return [
    `${widgetInventory.length} widget instance(s) in the current Workbench.`,
    ...widgetInventory.map((widget) =>
      [
        `${widget.title} (${widget.id})`,
        `type ${widget.definitionTitle}`,
        `component ${widget.componentKey}`,
        `layout ${widget.layoutMode}`,
        widget.visible ? "visible" : "hidden",
      ].join("; "),
    ),
  ];
}
