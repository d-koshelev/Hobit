export type {
  WidgetV2ActionIntent,
  WidgetV2Capability,
  WidgetV2Id,
  WidgetV2Kind,
  WidgetV2LayoutKind,
  WidgetV2Manifest,
  WidgetV2ManifestStatus,
  WidgetV2PanelSlot,
  WidgetV2ProductOwnerDomain,
  WidgetV2RuntimeContextValue,
  WidgetV2StatusSummary,
} from "./widgetV2Types";

export {
  WidgetV2BottomDrawer,
  WidgetV2Header,
  WidgetV2LeftRail,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "./WidgetV2Shell";

export {
  assertUniqueWidgetV2Kinds,
  validateWidgetV2Manifest,
} from "./widgetV2Manifest";
export type { WidgetV2ManifestValidationResult } from "./widgetV2Manifest";

export {
  getAvailableWidgetV2Manifests,
  getWidgetV2Manifest,
  getWidgetV2ManifestsByStatus,
  validateWidgetV2Registry,
  widgetV2Manifests,
  widgetV2Registry,
} from "./widgetV2Registry";
export type { WidgetV2Registry } from "./widgetV2Registry";

// Smoke/compat export only. Product Agent Queue rendering stays on the
// saved-compatible agent-queue WidgetHost route:
// WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board.
export { QueueV2SmokeCompatWidget } from "./queueV2";
export { KnowledgeV2Header, KnowledgeV2Widget } from "./knowledgeV2";
export type { KnowledgeV2WidgetProps } from "./knowledgeV2";
export { WorkspaceAgentV2Widget } from "./workspaceAgentV2";
