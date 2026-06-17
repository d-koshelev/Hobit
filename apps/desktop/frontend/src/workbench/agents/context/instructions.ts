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
  const queueRunControlInstructionLines =
    createQueueRunControlCapabilityInstructionLines(capabilities);
  const compactManifestCapabilities = capabilities.filter(
    (capability) => !isQueueLifecycleCapabilityId(capability.id),
  );
  const lines = [
    `You are inside ${context.appName}, an AI Workbench.`,
    `You are operating from the ${context.surface.title} surface.`,
    "You are the operational brain and product-action orchestrator.",
    `Role: ${context.role.title}. Primary duty: product-action orchestrator first.`,
    `Workspace: ${context.workspace.workspaceName ?? context.workspace.workspaceId}.`,
    context.workspace.workspaceRoot
      ? `Workspace root: ${context.workspace.workspaceRoot}.`
      : null,
    "Use typed Hobit app capabilities before Codex or shell.",
    "App and product actions must use typed Hobit capabilities.",
    'When needed emit one JSON envelope: {"type":"hobit.action.request","capabilityId":"<id>","dryRun":false,"input":{...}}.',
    "One envelope only; do not emit action lists.",
    "After hobit.action.result, continue with returned taskId/runId/executorWidgetId or final prose; never infer missing ids.",
    "Stop on blocked, unavailable, confirmation_required, policy_blocked, failed, invalid, repeated, or max actions.",
    "Do not use shell or Codex for product actions. Do not execute app actions through shell, Codex, Git, Terminal, rollback, or validation.",
    "Do not inspect source files for product actions.",
    "Queue item creation is a Queue capability.",
    "Queue item creation should use queue.createItems.",
    "Prompt-pack flows use queue.preparePromptPackPreview or queue.importPromptPack.",
    ...queueCreateInstructionLines,
    ...queueRunControlInstructionLines,
    ...queueLifecycleInstructionLines,
    "Codex and shell are restricted capabilities and are not default app-action paths.",
    "Execute/destructive capabilities require policy and confirmation.",
    `Compact capability manifest: ${compactManifestCapabilities
      .map(
        (capability) =>
          `${capability.id}${capability.restricted ? " (restricted)" : ""}${
            capability.availability.status === "unavailable"
              ? "; availability=unavailable"
              : ""
          }`,
      )
      .join(", ")}.`,
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
      ? "agentFinished(evidenceBundle or taskId,outcome,finalAgentMessage)"
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
  return [
    "Queue lifecycle schemas:",
    requiredInputLine,
    'Lifecycle example: {"type":"hobit.action.request","capabilityId":"queue.lifecycle.agentFinished","dryRun":false,"input":{"taskId":"queue-task-id","outcome":"completed","finalAgentMessage":"Done."}}',
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
        ? `- ${capability.id}: required=${capability.inputSchema.requiredFields.join(",")}`
        : `- ${capability.id}: ${capability.inputSchemaDescription}`,
    ),
    "Queue item prompt is required; prompt is the runnable task instruction.",
    "Use title,prompt only; body,text,content,operatorPrompt,initialState,dependsOn,queueTag,priority do not satisfy create input.",
    "For a test, dummy, or example Queue item, create a safe placeholder prompt.",
    "If a real Queue item lacks task content, ask a concise clarification.",
    "Do not auto-run workers.",
    ...exampleLines,
  ];
}

function createQueueRunControlCapabilityInstructionLines(
  capabilities: readonly HobitAgentCapability[],
) {
  const capabilityIds = [
    "queue.items.list",
    "queue.item.updateRunSettings",
    "queue.item.promoteDraft",
    "queue.enable",
    "queue.item.startRun",
  ];
  const runControlCapabilities = capabilityIds
    .map((capabilityId) =>
      capabilities.find((capability) => capability.id === capabilityId),
    )
    .filter((capability): capability is HobitAgentCapability =>
      Boolean(capability),
    );

  if (runControlCapabilities.length === 0) {
    return [];
  }

  const examples = runControlCapabilities.flatMap((capability) =>
    (capability.examples ?? []).slice(0, 1).map(
      (example) =>
        `Example ${capability.id}: ${JSON.stringify(
          example.exampleActionRequest,
        )}`,
    ),
  );

  return [
    "Queue run-control is typed only; never infer taskId or executorWidgetId from prose, titles, prompts, paths, final messages, or source text.",
    "Run-control fields: list(limit?,taskId?); settings(taskId,codexExecutable?,workspaceRoot?,sandbox?,approvalPolicy?); promote(taskId); enable({}); start(taskId,executorWidgetId,queueId?).",
    "Use queue.items.list when ids are missing; settings/promote/enable do not start; start requires confirmation and no codex.runTask fallback.",
    ...examples,
  ];
}
