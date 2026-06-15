import { createHobitAgentCapabilityRegistry } from "../capabilities/registry";
import type { HobitAgentCapabilityRegistry } from "../capabilities/types";
import { HOBIT_WORKSPACE_AGENT_ROLE } from "./roles";
import type {
  HobitAgentAppContext,
  HobitAgentRole,
  HobitAgentSurfaceContext,
  HobitAgentWorkspaceContext,
} from "./types";

export function createDefaultHobitAgentAppContext({
  capabilityRegistry = createHobitAgentCapabilityRegistry(),
  currentPrompt = "",
  role = HOBIT_WORKSPACE_AGENT_ROLE,
  surface,
  workspace,
}: {
  capabilityRegistry?: HobitAgentCapabilityRegistry;
  currentPrompt?: string;
  role?: HobitAgentRole;
  surface?: Partial<HobitAgentSurfaceContext>;
  workspace: Partial<HobitAgentWorkspaceContext> & { workspaceId: string };
}): HobitAgentAppContext {
  return {
    appName: "Hobit",
    capabilityManifest: capabilityRegistry,
    currentPrompt,
    policyConstraints: [
      "App actions before Codex or shell.",
      "Product actions must use typed app capabilities.",
      "Product actions must not inspect source files.",
      "Do not use shell or Codex for product actions.",
      "Queue item creation must use Queue capabilities.",
      "Codex and shell are restricted capabilities.",
    ],
    productCenter: "Workbench",
    role,
    surface: {
      surfaceId: "workspace-agent",
      title: "Workspace Agent",
      widgetDefinitionId: "interactive-agent",
      widgetInstanceId: surface?.widgetInstanceId ?? null,
    },
    workspace: {
      queueSingletonKey: "workspace-queue",
      workbenchId: workspace.workbenchId ?? null,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName ?? null,
      workspaceRoot: workspace.workspaceRoot ?? null,
    },
  };
}

export function createWorkspaceAgentAppContext(
  input: Parameters<typeof createDefaultHobitAgentAppContext>[0],
): HobitAgentAppContext {
  return createDefaultHobitAgentAppContext({
    ...input,
    role: HOBIT_WORKSPACE_AGENT_ROLE,
  });
}
