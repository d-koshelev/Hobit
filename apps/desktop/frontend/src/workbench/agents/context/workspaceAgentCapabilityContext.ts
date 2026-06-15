import { createHobitAgentCapabilityRegistry } from "../capabilities/registry";
import type { HobitAgentCapabilityRegistry } from "../capabilities/types";
import {
  createDefaultHobitAgentAppContext,
  createWorkspaceAgentAppContext,
} from "./appContext";
import { createCapabilityInstructionBlock } from "./instructions";
import type { HobitAgentAppContext } from "./types";

export type WorkspaceAgentCapabilityContextInput = {
  capabilityRegistry?: HobitAgentCapabilityRegistry;
  currentPrompt: string;
  widgetInstanceId?: string | null;
  workbenchId?: string | null;
  workspaceId: string;
  workspaceName?: string | null;
};

export type WorkspaceAgentCapabilityRuntimeSeam = {
  appContext: HobitAgentAppContext;
  brokerBoundary: {
    expectedRequest: "typed_hobit_capability_request";
    status: "not_implemented";
  };
  instructionBlock: string;
};

export function getWorkspaceAgentCapabilityManifest(
  capabilityRegistry?: HobitAgentCapabilityRegistry,
): HobitAgentCapabilityRegistry {
  return capabilityRegistry ?? createHobitAgentCapabilityRegistry();
}

export function buildWorkspaceAgentCapabilityContext({
  capabilityRegistry,
  currentPrompt,
  widgetInstanceId = null,
  workbenchId = null,
  workspaceId,
  workspaceName = null,
}: WorkspaceAgentCapabilityContextInput): HobitAgentAppContext {
  return createWorkspaceAgentAppContext({
    capabilityRegistry: getWorkspaceAgentCapabilityManifest(capabilityRegistry),
    currentPrompt,
    surface: { widgetInstanceId },
    workspace: {
      workbenchId,
      workspaceId,
      workspaceName,
    },
  });
}

export function createWorkspaceAgentCapabilityInstructionBlock(
  input: HobitAgentAppContext | WorkspaceAgentCapabilityContextInput,
): string {
  const context = isHobitAgentAppContext(input)
    ? input
    : buildWorkspaceAgentCapabilityContext(input);

  return createCapabilityInstructionBlock(context);
}

export function buildWorkspaceAgentCapabilityRuntimeSeam(
  input: WorkspaceAgentCapabilityContextInput,
): WorkspaceAgentCapabilityRuntimeSeam {
  const appContext = buildWorkspaceAgentCapabilityContext(input);

  return {
    appContext,
    brokerBoundary: {
      expectedRequest: "typed_hobit_capability_request",
      status: "not_implemented",
    },
    instructionBlock: createWorkspaceAgentCapabilityInstructionBlock(appContext),
  };
}

function isHobitAgentAppContext(
  value: HobitAgentAppContext | WorkspaceAgentCapabilityContextInput,
): value is HobitAgentAppContext {
  return "appName" in value && value.appName === "Hobit";
}

export { createDefaultHobitAgentAppContext };
