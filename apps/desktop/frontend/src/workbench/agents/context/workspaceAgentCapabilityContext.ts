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
  workspaceRoot?: string | null;
};

export type WorkspaceAgentCapabilityRuntimeSeam = {
  appContext: HobitAgentAppContext;
  brokerBoundary: {
    expectedRequest: "structured_hobit_action_request";
    status: "implemented";
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
  workspaceRoot = null,
}: WorkspaceAgentCapabilityContextInput): HobitAgentAppContext {
  return createWorkspaceAgentAppContext({
    capabilityRegistry: getWorkspaceAgentCapabilityManifest(capabilityRegistry),
    currentPrompt,
    surface: { widgetInstanceId },
    workspace: {
      workbenchId,
      workspaceId,
      workspaceName,
      workspaceRoot,
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
      expectedRequest: "structured_hobit_action_request",
      status: "implemented",
    },
    instructionBlock: createWorkspaceAgentCapabilityInstructionBlock(appContext),
  };
}

export function createWorkspaceAgentPromptWithCapabilityContext(
  input: WorkspaceAgentCapabilityContextInput,
): string {
  const seam = buildWorkspaceAgentCapabilityRuntimeSeam(input);

  return [
    "[Hobit capability context]",
    seam.instructionBlock,
    "",
    "Broker execution boundary:",
    "When a Hobit app capability is needed, emit one structured Hobit action request envelope.",
    "Use a fresh requestId for each envelope.",
    'For the final answer in action mode, emit {"type":"hobit.final.answer","message":"<answer or blocker>"}.',
    "After hobit.action.result, emit one next envelope or the final answer marker.",
    "Intermediate prose is not a capability call.",
    "The app validates policy/schema/side effects; use prose when no app action is needed.",
    "",
    "User request:",
    input.currentPrompt.trim(),
  ].join("\n");
}

function isHobitAgentAppContext(
  value: HobitAgentAppContext | WorkspaceAgentCapabilityContextInput,
): value is HobitAgentAppContext {
  return "appName" in value && value.appName === "Hobit";
}

export { createDefaultHobitAgentAppContext };
