import type { HobitAgentCapabilityRegistry } from "../capabilities/types";

export type HobitAgentRoleId =
  | "workspace_agent"
  | "queue_coordinator"
  | "test_harness";

export type HobitAgentRole = {
  allowedDefaultExecutionPath: "typed_app_capabilities";
  id: HobitAgentRoleId;
  instructions: string[];
  primaryDuty: "product_action_orchestrator";
  title: string;
};

export type HobitAgentWorkspaceContext = {
  queueSingletonKey: "workspace-queue";
  workspaceId: string;
  workspaceName?: string | null;
  workspaceRoot?: string | null;
  workbenchId?: string | null;
};

export type HobitAgentSurfaceContext = {
  surfaceId: "workspace-agent";
  title: "Workspace Agent";
  widgetDefinitionId: "interactive-agent";
  widgetInstanceId?: string | null;
};

export type HobitAgentAppContext = {
  appName: "Hobit";
  capabilityManifest: HobitAgentCapabilityRegistry;
  currentPrompt: string;
  policyConstraints: string[];
  productCenter: "Workbench";
  role: HobitAgentRole;
  surface: HobitAgentSurfaceContext;
  workspace: HobitAgentWorkspaceContext;
};
