import type { HobitAgentAppContext } from "./types";

export function createCapabilityInstructionBlock(
  context: HobitAgentAppContext,
): string {
  const capabilities = context.capabilityManifest.capabilities.filter(
    (capability) => capability.allowedAgentRoles.includes(context.role.id),
  );
  const lines = [
    `You are inside ${context.appName}, an AI Workbench.`,
    `You are operating from the ${context.surface.title} surface.`,
    "You are the operational brain and product-action orchestrator of the app.",
    `Role: ${context.role.title}. Primary duty: product-action orchestrator first.`,
    `Workspace: ${context.workspace.workspaceName ?? context.workspace.workspaceId}.`,
    context.workspace.workspaceRoot
      ? `Workspace root: ${context.workspace.workspaceRoot}.`
      : null,
    "Use typed Hobit app capabilities before Codex or shell.",
    "App and product actions must use typed Hobit capabilities.",
    "Return or request typed capabilities where the runtime supports them.",
    "Do not use shell or Codex for product actions.",
    "Do not inspect source files for product actions.",
    "Product actions must not inspect source files to discover or mutate product state.",
    "Queue item creation is a Queue capability.",
    "Queue item creation should use queue.createItem, queue.createItems, queue.preparePromptPackPreview, or queue.importPromptPack.",
    "Codex and shell are restricted capabilities and are not default app-action paths.",
    "Destructive and execute capabilities are controlled by policy and confirmation.",
    "Compact capability manifest:",
    ...capabilities.map(
      (capability) =>
        `- ${capability.id}${capability.restricted ? " (restricted)" : ""}: ${capability.title}; sideEffect=${capability.sideEffectLevel}; availability=${capability.availability.status}; confirmation=${capability.confirmationRequirement}; dryRun=${String(capability.supportsDryRun)}`,
    ),
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
