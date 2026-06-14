import { AGENT_QUEUE_WIDGET_DEFINITION_ID } from "../widgetRegistry";

export type QueueSingletonRepairWidget = {
  createdAt?: string | null;
  definitionId: string;
  dockX?: number | null;
  dockY?: number | null;
  id: string;
  isVisible?: boolean;
  layout?: {
    order?: number | null;
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

type RankedQueueView<T extends QueueSingletonRepairWidget> = {
  index: number;
  widget: T;
};

export function identifyQueueViews<T extends QueueSingletonRepairWidget>(
  widgets: readonly T[],
): T[] {
  return widgets.filter(
    (widget) => widget.definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID,
  );
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
  const canHideDuplicates = duplicateQueueViews.every(canHideQueueView);

  return {
    canonicalQueueView,
    duplicateQueueViewIds: [...duplicateQueueViewIds],
    duplicateQueueViews,
    queueViews,
    repairKind: canHideDuplicates ? "hide-duplicates" : "identify-only",
    repairedWidgets: widgets.map((widget) =>
      duplicateQueueViewIds.has(widget.id) && canHideDuplicates
        ? hideQueueView(widget)
        : widget,
    ),
  };
}

function compareQueueViewRank<T extends QueueSingletonRepairWidget>(
  left: RankedQueueView<T>,
  right: RankedQueueView<T>,
) {
  return (
    compareBooleans(isVisible(left.widget), isVisible(right.widget)) ||
    compareNumbers(createdAtRank(left.widget), createdAtRank(right.widget)) ||
    compareNumbers(layoutOrderRank(left.widget), layoutOrderRank(right.widget)) ||
    compareNumbers(dockYRank(left.widget), dockYRank(right.widget)) ||
    compareNumbers(dockXRank(left.widget), dockXRank(right.widget)) ||
    left.widget.id.localeCompare(right.widget.id) ||
    left.index - right.index
  );
}

function canHideQueueView(widget: QueueSingletonRepairWidget) {
  return (
    typeof widget.isVisible === "boolean" || typeof widget.visible === "boolean"
  );
}

function hideQueueView<T extends QueueSingletonRepairWidget>(widget: T): T {
  return {
    ...widget,
    ...(typeof widget.isVisible === "boolean" ? { isVisible: false } : {}),
    ...(typeof widget.visible === "boolean" ? { visible: false } : {}),
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

function layoutOrderRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.layout?.order);
}

function dockYRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.dockY);
}

function dockXRank(widget: QueueSingletonRepairWidget) {
  return finiteNumberOrInfinity(widget.dockX);
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
