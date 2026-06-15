import { listAvailableCapabilities } from "../capabilities/registry";
import type { HobitAgentAppContext } from "./types";

export function createCapabilityInstructionBlock(
  context: HobitAgentAppContext,
): string {
  const availableCapabilities = listAvailableCapabilities(
    context.capabilityManifest,
    context.role.id,
  );
  const lines = [
    `You are inside ${context.appName}, an AI Workbench.`,
    "You are an in-app product-action orchestrator first.",
    `Role: ${context.role.title}. Primary duty: product-action orchestrator first.`,
    "Use typed Hobit app capabilities before Codex or shell.",
    "App and product actions must use typed Hobit capabilities.",
    "Do not use shell or Codex for product actions.",
    "Do not inspect source files for product actions.",
    "Product actions must not inspect source files to discover or mutate product state.",
    "Queue item creation is a Queue capability.",
    "Queue item creation should use queue.createItem, queue.createItems, queue.preparePromptPackPreview, or queue.importPromptPack.",
    "Codex and shell are restricted capabilities and are not default app-action paths.",
    "Available capabilities:",
    ...availableCapabilities.map(
      (capability) =>
        `- ${capability.id}: ${capability.title}; sideEffect=${capability.sideEffectLevel}; confirmation=${capability.confirmationRequirement}; dryRun=${String(capability.supportsDryRun)}`,
    ),
  ];

  return lines.join("\n");
}
