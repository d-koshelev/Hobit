import type {
  WidgetDefinition,
  WidgetDefinitionId,
  WidgetInstance,
} from "./types";
import {
  findWorkspaceSingletonDefinition,
  getWidgetDefinition,
} from "./widgetRegistry";

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
