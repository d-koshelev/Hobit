import type { WorkspaceWorkbenchState } from "../workspace/types";
import { workbenchPresetForOriginOrWidgets } from "./presets";
import { computeDuplicateQueueViewRepair } from "./queue/queueSingletonViewRepair";
import type {
  WidgetGeometry,
  WidgetLayout,
  WidgetLayoutMode,
  WorkbenchPreset,
  WorkbenchPresetId,
  WorkbenchViewState,
} from "./types";
import { getWidgetLayoutDefaults } from "./widgetRegistry";

type WorkbenchSelectionViewInput = {
  preset: WorkbenchPreset;
  workspace: {
    id: string;
    title: string;
    description: string | null;
    rootPath?: string | null;
    status: string;
    workbenchId: string | null;
  };
};

export function createWorkbenchViewStateFromSelection(
  selection: WorkbenchSelectionViewInput,
): WorkbenchViewState {
  const queueRepair = computeDuplicateQueueViewRepair(selection.preset.widgets);
  const widgets = queueRepair.repairedWidgets;

  return {
    workspace: {
      id: selection.workspace.id,
      title: selection.workspace.title,
      description: selection.workspace.description,
      rootPath: normalizedWorkspaceRoot(selection.workspace.rootPath),
      status: selection.workspace.status,
    },
    workbench: {
      id: selection.workspace.workbenchId,
      preset: {
        id: selection.preset.id,
        title: selection.preset.title,
        description: selection.preset.description,
      },
    },
    widgets: widgets.map((widget) => ({
      ...widget,
      layout: widgetLayoutWithDefaults(widget.definitionId, widget.layout),
    })),
    sharedStateObjects: [],
    recentEvents: [],
  };
}

export function createWorkbenchViewStateFromWorkspaceState(
  state: WorkspaceWorkbenchState,
): WorkbenchViewState {
  const queueRepair = computeDuplicateQueueViewRepair(state.widgetInstances);
  const widgetInstances = queueRepair.repairedWidgets;
  const preset = workbenchPresetForOriginOrWidgets({
    presetOriginId: state.workbench?.presetOriginId,
    widgetDefinitionIds: widgetInstances.map(
      (widgetInstance) => widgetInstance.definitionId,
    ),
  });

  return {
    workspace: {
      id: state.workspace.id,
      title: state.workspace.title,
      description: state.workspace.description,
      rootPath: normalizedWorkspaceRoot(state.workspace.rootPath),
      status: state.workspace.status,
    },
    workbench: {
      id: state.workbench?.id ?? state.workspace.workbenchId,
      preset: {
        id: preset.id as WorkbenchPresetId | null,
        title: preset.title,
        description: preset.description,
      },
    },
    widgets: widgetInstances.map((widgetInstance, index) => {
      const mode = normalizeWidgetLayoutMode(widgetInstance.layoutMode);
      const layoutDefaults = getWidgetLayoutDefaults(
        widgetInstance.definitionId,
      );
      const dockLayout: WidgetLayout = {
        area: "main",
        mode,
        order: index,
        x: widgetInstance.dockX ?? 0,
        y: widgetInstance.dockY ?? index,
        width: widgetInstance.dockWidth ?? 360,
        height: widgetInstance.dockHeight ?? 240,
        minWidth: layoutDefaults?.minWidth,
        minHeight: layoutDefaults?.minHeight,
      };
      const popout = normalizePopoutGeometry(widgetInstance, dockLayout, mode);

      return {
        id: widgetInstance.id,
        definitionId: widgetInstance.definitionId,
        title: widgetInstance.title,
        config: normalizeJsonRecord(widgetInstance.config),
        state: normalizeJsonRecord(widgetInstance.state),
        layout: popout ? { ...dockLayout, popout } : dockLayout,
        visible: widgetInstance.isVisible,
      };
    }),
    sharedStateObjects: state.sharedStateObjects.map((stateObject) => ({
      id: stateObject.id,
      key: stateObject.key,
      value: stateObject.value,
      valueKind: stateObject.valueKind,
    })),
    recentEvents: withQueueViewRepairNote(
      state.recentEvents.map((event) => ({
        id: event.id,
        kind: event.kind,
        summary: event.summary,
        createdAt: event.createdAt,
      })),
      queueRepair,
    ),
  };
}

function withQueueViewRepairNote(
  recentEvents: WorkbenchViewState["recentEvents"],
  queueRepair: ReturnType<typeof computeDuplicateQueueViewRepair>,
): WorkbenchViewState["recentEvents"] {
  if (queueRepair.duplicateQueueViewIds.length === 0) {
    return recentEvents;
  }
  const repairEventId = queueViewRepairEventId(queueRepair);

  if (recentEvents.some((event) => event.id === repairEventId)) {
    return recentEvents;
  }

  return [
    ...recentEvents,
    {
      createdAt: new Date().toISOString(),
      id: repairEventId,
      kind: "queue_view_repair",
      summary:
        "Duplicate Agent Queue views were quarantined. Queue tasks were preserved.",
    },
  ];
}

function queueViewRepairEventId(
  queueRepair: ReturnType<typeof computeDuplicateQueueViewRepair>,
) {
  const canonicalId = queueRepair.canonicalQueueView?.id ?? "none";
  const duplicateIds = [...queueRepair.duplicateQueueViewIds].sort().join("_");

  return `queue-view-repair:${canonicalId}:${duplicateIds}`;
}

function normalizeWidgetLayoutMode(layoutMode: string): WidgetLayoutMode {
  if (layoutMode === "popped-out" || layoutMode === "popped_out") {
    return "popped-out";
  }

  if (layoutMode === "minimized") {
    return "minimized";
  }

  return "docked";
}

function widgetLayoutWithDefaults(
  definitionId: string,
  layout: WidgetLayout,
): WidgetLayout {
  const layoutDefaults = getWidgetLayoutDefaults(definitionId);

  return {
    ...layout,
    minWidth: layout.minWidth ?? layoutDefaults?.minWidth,
    minHeight: layout.minHeight ?? layoutDefaults?.minHeight,
  };
}

function normalizePopoutGeometry(
  widgetInstance: WorkspaceWorkbenchState["widgetInstances"][number],
  dockLayout: WidgetLayout,
  mode: WidgetLayoutMode,
): (WidgetGeometry & { alwaysOnTop: boolean }) | undefined {
  const hasPopoutState =
    mode === "popped-out" ||
    widgetInstance.alwaysOnTop ||
    widgetInstance.popoutX !== null ||
    widgetInstance.popoutY !== null ||
    widgetInstance.popoutWidth !== null ||
    widgetInstance.popoutHeight !== null;

  if (!hasPopoutState) {
    return undefined;
  }

  return {
    x: widgetInstance.popoutX ?? dockLayout.x,
    y: widgetInstance.popoutY ?? dockLayout.y,
    width: widgetInstance.popoutWidth ?? dockLayout.width,
    height: widgetInstance.popoutHeight ?? dockLayout.height,
    alwaysOnTop: widgetInstance.alwaysOnTop,
  };
}

function normalizeJsonRecord(value: string | null): Record<string, unknown> {
  if (value === null) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (isRecord(parsedValue)) {
      return parsedValue;
    }

    return { value: parsedValue };
  } catch {
    return { raw: value };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
