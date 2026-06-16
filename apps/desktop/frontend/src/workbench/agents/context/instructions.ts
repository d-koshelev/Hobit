import type { HobitAgentAppContext } from "./types";
import type { HobitAgentCapability } from "../capabilities/types";

export function createCapabilityInstructionBlock(
  context: HobitAgentAppContext,
): string {
  const capabilities = context.capabilityManifest.capabilities.filter(
    (capability) => capability.allowedAgentRoles.includes(context.role.id),
  );
  const queueCreateInstructionLines =
    createQueueCreateCapabilityInstructionLines(capabilities);
  const queueLifecycleInstructionLines =
    createQueueLifecycleCapabilityInstructionLines(capabilities);
  const compactManifestCapabilities = capabilities.filter(
    (capability) => !isQueueLifecycleCapabilityId(capability.id),
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
    "If you need a Hobit app capability, emit exactly one structured Hobit action request JSON envelope.",
    'Envelope schema: {"type":"hobit.action.request","capabilityId":"<capabilityId>","dryRun":false,"input":{...},"reason":"optional","requestId":"optional","confirmationToken":"optional"}.',
    "Normal explanation text is allowed when no Hobit app action is needed.",
    "Do not use shell or Codex for product actions.",
    "Do not execute app actions through shell or Codex.",
    "Do not inspect source files for product actions.",
    "Product actions must not inspect source files to discover or mutate product state.",
    "Queue item creation is a Queue capability.",
    "Queue item creation should use queue.createItems.",
    "Prompt-pack Queue flows should use queue.preparePromptPackPreview or queue.importPromptPack.",
    ...queueCreateInstructionLines,
    ...queueLifecycleInstructionLines,
    "Codex and shell are restricted capabilities and are not default app-action paths.",
    "Destructive and execute capabilities are controlled by policy and confirmation.",
    "Compact capability manifest:",
    ...compactManifestCapabilities.map(
      (capability) =>
        `- ${capability.id}${capability.restricted ? " (restricted)" : ""}; availability=${capability.availability.status}`,
    ),
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function isQueueLifecycleCapabilityId(capabilityId: string) {
  return (
    capabilityId.startsWith("queue.coordinator.") ||
    capabilityId.startsWith("queue.item.") ||
    capabilityId.startsWith("queue.lifecycle.") ||
    capabilityId.startsWith("queue.review.")
  );
}

function createQueueLifecycleCapabilityInstructionLines(
  capabilities: readonly HobitAgentCapability[],
) {
  const lifecycleIds = [
    "queue.lifecycle.agentFinished",
    "queue.review.createMessage",
    "queue.review.ack",
    "queue.coordinator.approveValidation",
    "queue.coordinator.addFollowUpPrompt",
    "queue.item.markDone",
    "queue.item.block",
    "queue.item.fail",
    "queue.lifecycle.get",
    "queue.review.getEvidenceBundle",
  ];
  const lifecycleCapabilities = lifecycleIds
    .map((capabilityId) =>
      capabilities.find((capability) => capability.id === capabilityId),
    )
    .filter((capability): capability is HobitAgentCapability =>
      Boolean(capability),
    );

  if (lifecycleCapabilities.length === 0) {
    return [];
  }

  const presentCapabilityIds = new Set(
    lifecycleCapabilities.map((capability) => capability.id),
  );
  const requiredInputLine = [
    presentCapabilityIds.has("queue.lifecycle.agentFinished")
      ? "agentFinished(taskId,outcome,finalAgentMessage)"
      : null,
    presentCapabilityIds.has("queue.review.createMessage")
      ? "createMessage(taskId,coordinatorAgentId)"
      : null,
    presentCapabilityIds.has("queue.review.ack")
      ? "ack(taskId,messageId,coordinatorAgentId)"
      : null,
    presentCapabilityIds.has("queue.coordinator.approveValidation")
      ? "approveValidation(taskId,coordinatorAgentId)"
      : null,
    presentCapabilityIds.has("queue.coordinator.addFollowUpPrompt")
      ? "addFollowUpPrompt(taskId,coordinatorAgentId,prompt)"
      : null,
    presentCapabilityIds.has("queue.item.markDone")
      ? "markDone(taskId,coordinatorAgentId,validationApproved:true)"
      : null,
    presentCapabilityIds.has("queue.item.block")
      ? "block(taskId,coordinatorAgentId,reason)"
      : null,
    presentCapabilityIds.has("queue.item.fail")
      ? "fail(taskId,coordinatorAgentId,reason)"
      : null,
    presentCapabilityIds.has("queue.lifecycle.get") ? "get(taskId?)" : null,
    presentCapabilityIds.has("queue.review.getEvidenceBundle")
      ? "getEvidenceBundle(taskId)"
      : null,
  ].filter((item): item is string => Boolean(item)).join("; ");
  const agentFinishedExample = lifecycleCapabilities
    .find((capability) => capability.id === "queue.lifecycle.agentFinished")
    ?.examples?.[0]?.exampleActionRequest;

  return [
    "Queue lifecycle actions: typed only, no natural-language routing; dryRun previews; dryRun=false mutates frontend overlay only; no backend, worker, validation, Git, Terminal, rollback, shell, or Codex.",
    "Queue lifecycle schemas:",
    requiredInputLine,
    agentFinishedExample
      ? `Queue lifecycle example: ${JSON.stringify(agentFinishedExample)}`
      : null,
  ].filter((line): line is string => Boolean(line));
}

function createQueueCreateCapabilityInstructionLines(
  capabilities: readonly HobitAgentCapability[],
) {
  const queueCreateCapabilities = ["queue.createItem", "queue.createItems"]
    .map((capabilityId) =>
      capabilities.find((capability) => capability.id === capabilityId),
    )
    .filter((capability): capability is HobitAgentCapability =>
      Boolean(capability),
    );

  if (queueCreateCapabilities.length === 0) {
    return [];
  }

  const exampleLines = queueCreateCapabilities.flatMap((capability) => {
    const example = capability.examples?.find(
      (candidate) => !candidate.exampleActionRequest.dryRun,
    );

    return example
      ? [
          `Example ${capability.id}: ${JSON.stringify(
            example.exampleActionRequest,
          )}`,
        ]
      : [];
  });

  return [
    "Queue create action schemas:",
    ...queueCreateCapabilities.map((capability) =>
      capability.inputSchema
        ? `- ${capability.id}: required=${capability.inputSchema.requiredFields.join(",")}; shape=${capability.inputSchema.shape}`
        : `- ${capability.id}: ${capability.inputSchemaDescription}`,
    ),
    "Queue item prompt is required; Queue item creation requires both title and prompt.",
    "The prompt is the runnable task instruction, not just a display description.",
    "Use prompt exactly; body, text, content, operatorPrompt, initialState, dependsOn, queueTag, and priority do not satisfy Queue create input.",
    "If the user explicitly asks for a test, dummy, or example Queue item, create a safe placeholder prompt.",
    "If the user asks for a real Queue item but does not provide task content, ask a concise clarification instead of emitting an invalid action request.",
    "Do not use shell, Codex, or source-code inspection to invent Queue product action data.",
    "Do not auto-run workers.",
    "Queue create action examples:",
    ...exampleLines,
    "Dry-run previews use the same Queue create input shape with dryRun=true.",
  ];
}
