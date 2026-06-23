import type { WidgetInstance } from "./types";
import { getWidgetDefinition } from "./widgetRegistry";

export type WorkspaceAgentLiveWorkbenchWidgetSummary = {
  readonly category: string | null;
  readonly definitionId: string;
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
};

export type WorkspaceAgentLiveWorkbenchContextSnapshot = {
  readonly widgetCount: number;
  readonly widgetInstances: readonly WorkspaceAgentLiveWorkbenchWidgetSummary[];
  readonly workbenchId: string | null;
  readonly workspaceId: string | null;
  readonly workspaceRootPath: string | null;
};

const MAX_LIVE_WORKBENCH_CONTEXT_WIDGETS = 50;

export function createWorkspaceAgentLiveWorkbenchContextSnapshot({
  widgetInstances,
  workbenchId,
  workspaceId,
  workspaceRootPath,
}: {
  readonly widgetInstances: readonly WidgetInstance[];
  readonly workbenchId?: string | null;
  readonly workspaceId?: string | null;
  readonly workspaceRootPath?: string | null;
}): WorkspaceAgentLiveWorkbenchContextSnapshot {
  return {
    widgetCount: widgetInstances.length,
    widgetInstances: widgetInstances
      .slice(0, MAX_LIVE_WORKBENCH_CONTEXT_WIDGETS)
      .map((widget) => {
        const definition = getWidgetDefinition(widget.definitionId);

        return {
          category: definition?.category ?? null,
          definitionId: widget.definitionId,
          id: widget.id,
          title: widget.title,
          visible: widget.visible,
        };
      }),
    workbenchId: normalizedString(workbenchId),
    workspaceId: normalizedString(workspaceId),
    workspaceRootPath: normalizedString(workspaceRootPath),
  };
}

export function normalizedWorkspaceAgentLiveWorkbenchContext(
  snapshot: WorkspaceAgentLiveWorkbenchContextSnapshot | null | undefined,
): WorkspaceAgentLiveWorkbenchContextSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    widgetCount:
      typeof snapshot.widgetCount === "number" && snapshot.widgetCount >= 0
        ? snapshot.widgetCount
        : snapshot.widgetInstances.length,
    widgetInstances: snapshot.widgetInstances.map((widget) => ({
      category: normalizedString(widget.category),
      definitionId: widget.definitionId.trim(),
      id: widget.id.trim(),
      title: widget.title,
      visible: widget.visible,
    })),
    workbenchId: normalizedString(snapshot.workbenchId),
    workspaceId: normalizedString(snapshot.workspaceId),
    workspaceRootPath: normalizedString(snapshot.workspaceRootPath),
  };
}

function normalizedString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
