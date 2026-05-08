import type { WorkspaceWorkbenchState } from "../workspace/types";
import { emptyWorkbenchPreset } from "./presets";
import type {
  WidgetGeometry,
  WidgetInstance,
  WidgetLayout,
  WidgetLayoutMode,
  WorkbenchPreset,
  WorkbenchPresetId,
} from "./types";

export type WorkbenchWorkspaceView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

export type WorkbenchPresetView = {
  id: WorkbenchPresetId | null;
  title: string;
  description: string | null;
};

export type WorkbenchSurfaceView = {
  id: string | null;
  preset: WorkbenchPresetView;
};

export type WorkbenchSharedStateView = {
  id: string;
  key: string;
  value: string;
  valueKind: string;
};

export type WorkbenchEventView = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
};

export type WorkbenchViewState = {
  workspace: WorkbenchWorkspaceView;
  workbench: WorkbenchSurfaceView;
  widgets: WidgetInstance[];
  sharedStateObjects: WorkbenchSharedStateView[];
  recentEvents: WorkbenchEventView[];
};

type WorkbenchSelectionViewInput = {
  preset: WorkbenchPreset;
  workspace: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    workbenchId: string | null;
  };
};

export function createWorkbenchViewStateFromSelection(
  selection: WorkbenchSelectionViewInput,
): WorkbenchViewState {
  return {
    workspace: {
      id: selection.workspace.id,
      title: selection.workspace.title,
      description: selection.workspace.description,
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
    widgets: [...selection.preset.widgets],
    sharedStateObjects: [],
    recentEvents: [],
  };
}

export function createWorkbenchViewStateFromWorkspaceState(
  state: WorkspaceWorkbenchState,
): WorkbenchViewState {
  return {
    workspace: {
      id: state.workspace.id,
      title: state.workspace.title,
      description: state.workspace.description,
      status: state.workspace.status,
    },
    workbench: {
      id: state.workbench?.id ?? state.workspace.workbenchId,
      preset: {
        id: (state.workbench?.presetOriginId ??
          emptyWorkbenchPreset.id) as WorkbenchPresetId,
        title: emptyWorkbenchPreset.title,
        description: emptyWorkbenchPreset.description,
      },
    },
    widgets: state.widgetInstances.map((widgetInstance, index) => {
      const mode = normalizeWidgetLayoutMode(widgetInstance.layoutMode);
      const dockLayout: WidgetLayout = {
        area: "main",
        mode,
        order: index,
        x: widgetInstance.dockX ?? 0,
        y: widgetInstance.dockY ?? index,
        width: widgetInstance.dockWidth ?? 360,
        height: widgetInstance.dockHeight ?? 240,
      };
      const popout = normalizePopoutGeometry(widgetInstance, dockLayout, mode);

      return {
        id: widgetInstance.id,
        definitionId: widgetInstance.definitionId,
        title: widgetInstance.title,
        config: normalizeWidgetConfig(widgetInstance.config),
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
    recentEvents: state.recentEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      summary: event.summary,
      createdAt: event.createdAt,
    })),
  };
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

function normalizeWidgetConfig(
  config: string | null,
): Record<string, unknown> {
  if (config === null) {
    return {};
  }

  try {
    const parsedConfig: unknown = JSON.parse(config);

    if (isRecord(parsedConfig)) {
      return parsedConfig;
    }

    return { value: parsedConfig };
  } catch {
    return { raw: config };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
