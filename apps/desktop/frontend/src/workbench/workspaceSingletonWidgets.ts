import type {
  WidgetDefinition,
  WidgetDefinitionId,
  WidgetInstance,
} from "./types";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  findWorkspaceSingletonDefinition,
  getWidgetDefinition,
} from "./widgetRegistry";

export type QueueSingletonRepairWidget = {
  createdAt?: string | null;
  definitionId: string;
  dockX?: number | null;
  dockY?: number | null;
  id: string;
  isVisible?: boolean;
  layout?: {
    order?: number | null;
    x?: number | null;
    y?: number | null;
  };
  visible?: boolean;
};

export type DuplicateQueueViewRepair<T extends QueueSingletonRepairWidget> = {
  canonicalQueueView: T | null;
  duplicateQueueViewIds: string[];
  duplicateQueueViews: T[];
  queueViews: T[];
  repairKind: "none" | "hide-duplicates" | "identify-only";
  repairedWidgets: T[];
};

export type SingletonWidgetCreateResolution =
  | {
      canCreate: true;
      existingWidget: null;
      existingWidgetId: null;
      kind: "create";
    }
  | {
      canCreate: false;
      existingWidget: WidgetInstance;
      existingWidgetId: WidgetInstance["id"];
      kind: "restore-existing" | "reuse-existing";
    };

type RankedQueueView<T extends QueueSingletonRepairWidget> = {
  index: number;
  widget: T;
};

export function isQueueWidgetDefinition(definitionId: WidgetDefinitionId) {
  const singletonDefinition = findWorkspaceSingletonDefinition(definitionId);

  return (
    singletonDefinition?.id === AGENT_QUEUE_WIDGET_DEFINITION_ID &&
    singletonDefinition.singletonKey === "workspace-queue"
  );
}

export function identifyQueueViews<T extends QueueSingletonRepairWidget>(
  widgets: readonly T[],
): T[] {
  return widgets.filter((widget) => isQueueWidgetDefinition(widget.definitionId));
}

export function selectCanonicalQueueView<T extends QueueSingletonRepairWidget>(
  widgets: readonly T[],
): T | null {
  const queueViews = identifyQueueViews(widgets);

  if (queueViews.length === 0) {
    return null;
  }

  return queueViews
    .map((widget, index) => ({ index, widget }))
    .sort(compareQueueViewRank)[0].widget;
}

export function computeDuplicateQueueViewRepair<
  T extends QueueSingletonRepairWidget,
>(widgets: readonly T[]): DuplicateQueueViewRepair<T> {
  const queueViews = identifyQueueViews(widgets);
  const canonicalQueueView = selectCanonicalQueueView(widgets);

  if (!canonicalQueueView || queueViews.length <= 1) {
    return {
      canonicalQueueView,
      duplicateQueueViewIds: [],
      duplicateQueueViews: [],
      queueViews,
      repairKind: "none",
      repairedWidgets: [...widgets],
    };
  }

  const duplicateQueueViews = queueViews.filter(
    (widget) => widget.id !== canonicalQueueView.id,
  );
  const duplicateQueueViewIds = new Set(
    duplicateQueueViews.map((widget) => widget.id),
  );
  const canRepairVisibility = [canonicalQueueView, ...duplicateQueueViews].every(
    canSetQueueViewVisibility,
  );

  return {
    canonicalQueueView,
    duplicateQueueViewIds: [...duplicateQueueViewIds],
    duplicateQueueViews,
    queueViews,
    repairKind: canRepairVisibility ? "hide-duplicates" : "identify-only",
    repairedWidgets: widgets.map((widget) => {
      if (!canRepairVisibility) {
        return widget;
      }

      if (widget.id === canonicalQueueView.id) {
        return setQueueViewVisibility(widget, true);
      }

      if (duplicateQueueViewIds.has(widget.id)) {
        return setQueueViewVisibility(widget, false);
      }

      return widget;
    }),
  };
}

export function findWorkspaceSingletonWidget(
  widgets: readonly WidgetInstance[],
  definitionId: WidgetDefinitionId,
) {
  const singletonDefinition = findWorkspaceSingletonDefinition(definitionId);

  if (!singletonDefinition) {
    return undefined;
  }

  return widgets
    .filter((widget) => isWidgetInSingletonGroup(widget, singletonDefinition))
    .sort(compareSingletonWidgetRank)[0];
}

export function canCreateWidgetInstance(
  widgets: readonly WidgetInstance[],
  definitionId: WidgetDefinitionId,
) {
  return resolveSingletonWidgetCreate(widgets, definitionId).canCreate;
}

export function resolveSingletonWidgetCreate(
  widgets: readonly WidgetInstance[],
  definitionId: WidgetDefinitionId,
): SingletonWidgetCreateResolution {
  const existingWidget = findWorkspaceSingletonWidget(widgets, definitionId);

  if (!existingWidget) {
    return {
      canCreate: true,
      existingWidget: null,
      existingWidgetId: null,
      kind: "create",
    };
  }

  return {
    canCreate: false,
    existingWidget,
    existingWidgetId: existingWidget.id,
    kind: existingWidget.visible ? "reuse-existing" : "restore-existing",
  };
}

function isWidgetInSingletonGroup(
  widget: WidgetInstance,
  singletonDefinition: WidgetDefinition,
) {
  const widgetDefinition = getWidgetDefinition(widget.definitionId);

  return (
    widgetDefinition?.singleton === true &&
    widgetDefinition.singletonScope === singletonDefinition.singletonScope &&
    widgetDefinition.singletonKey === singletonDefinition.singletonKey
  );
}

function compareSingletonWidgetRank(
  left: WidgetInstance,
  right: WidgetInstance,
) {
  return (
    compareBooleans(left.visible, right.visible) ||
    compareNumbers(layoutOrderRank(left), layoutOrderRank(right)) ||
    compareNumbers(layoutYRank(left), layoutYRank(right)) ||
    compareNumbers(layoutXRank(left), layoutXRank(right)) ||
    left.id.localeCompare(right.id)
  );
}

function compareQueueViewRank<T extends QueueSingletonRepairWidget>(
  left: RankedQueueView<T>,
  right: RankedQueueView<T>,
) {
  return (
    compareBooleans(isVisible(left.widget), isVisible(right.widget)) ||
    compareNumbers(createdAtRank(left.widget), createdAtRank(right.widget)) ||
    compareNumbers(
      queueLayoutOrderRank(left.widget),
      queueLayoutOrderRank(right.widget),
    ) ||
    compareNumbers(
      queueLayoutYRank(left.widget),
      queueLayoutYRank(right.widget),
    ) ||
    compareNumbers(
      queueLayoutXRank(left.widget),
      queueLayoutXRank(right.widget),
    ) ||
    left.widget.id.localeCompare(right.widget.id) ||
    left.index - right.index
  );
}

function canSetQueueViewVisibility(widget: QueueSingletonRepairWidget) {
  return (
    typeof widget.isVisible === "boolean" || typeof widget.visible === "boolean"
  );
}

function setQueueViewVisibility<T extends QueueSingletonRepairWidget>(
  widget: T,
  visible: boolean,
): T {
  return {
    ...widget,
    ...(typeof widget.isVisible === "boolean" ? { isVisible: visible } : {}),
    ...(typeof widget.visible === "boolean" ? { visible } : {}),
  } as T;
}

function isVisible(widget: QueueSingletonRepairWidget) {
  if (typeof widget.isVisible === "boolean") {
    return widget.isVisible;
  }

  if (typeof widget.visible === "boolean") {
    return widget.visible;
  }

  return false;
}

function createdAtRank(widget: QueueSingletonRepairWidget) {
  const timestamp = widget.createdAt ? Date.parse(widget.createdAt) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function queueLayoutOrderRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.layout?.order);
}

function queueLayoutYRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.layout?.y ?? widget.dockY);
}

function queueLayoutXRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.layout?.x ?? widget.dockX);
}

function layoutOrderRank(widget: WidgetInstance) {
  return finiteNumberOrInfinity(widget.layout.order);
}

function layoutYRank(widget: WidgetInstance) {
  return finiteNumberOrInfinity(widget.layout.y);
}

function layoutXRank(widget: WidgetInstance) {
  return finiteNumberOrInfinity(widget.layout.x);
}

function finiteNumberOrInfinity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.POSITIVE_INFINITY;
}

function compareBooleans(left: boolean, right: boolean) {
  if (left === right) {
    return 0;
  }

  return left ? -1 : 1;
}

function compareNumbers(left: number, right: number) {
  return left === right ? 0 : left - right;
}
