export type {
  WidgetV2ActionIntent,
  WidgetV2Capability,
  WidgetV2Id,
  WidgetV2Kind,
  WidgetV2LayoutKind,
  WidgetV2Manifest,
  WidgetV2PanelSlot,
  WidgetV2RuntimeContextValue,
  WidgetV2StatusSummary,
} from "./widgetV2Types";

export {
  assertUniqueWidgetV2Kinds,
  validateWidgetV2Manifest,
} from "./widgetV2Manifest";
export type { WidgetV2ManifestValidationResult } from "./widgetV2Manifest";
