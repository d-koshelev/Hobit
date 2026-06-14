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

export function isQueueWidgetDefinition(definitionId: WidgetDefinitionId) {
  const singletonDefinition = findWorkspaceSingletonDefinition(definitionId);

  return (
    singletonDefinition?.id === AGENT_QUEUE_WIDGET_DEFINITION_ID &&
    singletonDefinition.singletonKey === "workspace-queue"
  );
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
