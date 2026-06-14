import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
} from "../widgetRegistry";

export const activeQueueProductSurface = {
  componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  cssNamespaces: ["agent-queue", "agent-queue-v2"],
  route: ["WidgetHost", "AgentQueuePlaceholderWidget", "AgentQueueV2Board"],
  widgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
} as const;

export const queueV2SmokeCompatSurface = {
  barrelExportName: "QueueV2SmokeCompatWidget",
  cssNamespace: "queue-v2",
  userCreatable: false,
  widgetDefinitionId: null,
  widgetV2Kind: "queue-v2",
} as const;

export function isActiveQueueProductWidgetId(definitionId: string) {
  return definitionId === activeQueueProductSurface.widgetDefinitionId;
}

export function isQueueV2SmokeCompatKind(kind: string) {
  return kind === queueV2SmokeCompatSurface.widgetV2Kind;
}
