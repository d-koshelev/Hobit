export type WidgetV2Id = string;

export type WidgetV2Kind =
  | "queue-v2"
  | "knowledge-v2"
  | "workspace-agent-v2"
  | "terminal-v2"
  | "finder-v2"
  | "notes-v2"
  | (string & {});

export type WidgetV2Capability =
  | "read-visible-context"
  | "render-primary-surface"
  | "dispatch-typed-action"
  | "show-status"
  | "show-activity"
  | "show-inspector"
  | "show-overlay"
  | (string & {});

export type WidgetV2LayoutKind = "minimal" | "operational" | "full" | "expert";

export type WidgetV2ManifestStatus = "planned" | "experimental" | "available";

export type WidgetV2ProductOwnerDomain =
  | "agent-queue"
  | "knowledge"
  | "workspace-agent"
  | "terminal"
  | "finder"
  | "notes"
  | (string & {});

export type WidgetV2PanelSlot =
  | "header"
  | "toolbar"
  | "primary"
  | "left-rail"
  | "right-inspector"
  | "bottom-drawer"
  | "overlay";

export interface WidgetV2ActionIntent {
  readonly type: string;
  readonly label: string;
  readonly description?: string;
  readonly requiresApproval?: boolean;
  readonly risk?: "none" | "low" | "medium" | "high";
}

export interface WidgetV2RuntimeContextValue {
  readonly workspaceId: string;
  readonly workbenchId: string;
  readonly widgetInstanceId: WidgetV2Id;
  readonly displayLevel: WidgetV2LayoutKind;
  readonly presentationState?: "docked" | "floating";
  readonly platformCapabilities?: readonly string[];
  readonly featureFlags?: readonly string[];
}

export interface WidgetV2StatusSummary {
  readonly label: string;
  readonly tone: "neutral" | "ready" | "working" | "warning" | "error";
  readonly detail?: string;
}

export interface WidgetV2Manifest {
  readonly kind: WidgetV2Kind;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly productRole: string;
  readonly capabilities: readonly WidgetV2Capability[];
  readonly layoutKind: WidgetV2LayoutKind;
  readonly supportedLayoutKinds: readonly WidgetV2LayoutKind[];
  readonly status: WidgetV2ManifestStatus;
  readonly productOwnerDomain: WidgetV2ProductOwnerDomain;
  readonly safetyBoundaries: readonly string[];
  readonly requiredPanelSlots: readonly WidgetV2PanelSlot[];
  readonly optionalPanelSlots?: readonly WidgetV2PanelSlot[];
  readonly actions?: readonly WidgetV2ActionIntent[];
  readonly statusSummary?: WidgetV2StatusSummary;
  readonly domainBoundary?: string;
  readonly safeContextSummary?: string;
  readonly runtimeLimitations?: readonly string[];
  readonly nonGoals?: readonly string[];
}
