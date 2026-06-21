import type { HobitAgentAppContext } from "./types";
import type { HobitAgentCapability } from "../capabilities/types";
import {
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../capabilities/queueCapabilityContracts";

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
    'When needed emit one JSON envelope with a fresh requestId: {"type":"hobit.action.request","requestId":"action-1","capabilityId":"<id>","dryRun":false,"input":{...}}.',
    'When finished in action mode emit one final JSON object: {"type":"hobit.final.answer","message":"<final user-facing answer or blocker>"}',
    "One envelope only; do not emit action lists. Use the exact capability id, exact input fields, exact enum values, and a unique requestId.",
    'Workflow requests use a separate generic envelope only when explicitly requested: {"type":"hobit.workflow.request","requestId":"workflow-1","moduleId":"queue","workflowId":"<declared-workflow>","grant":{},"inputs":{}}.',
    "Workflow requests are validation/classification only here; prose is not workflow input, and undeclared workflows are reported instead of executed.",
    "Workflow grant authorizes only permission/scope. Workflow inputs configure data such as runSettings, task slots, prompts, and dependency slot references.",
    "Never put runSettings/tasks/prompts/dependencies/workspaceRoot/codexExecutable/sandbox/approvalPolicy in grant; scope ids only under grant.scope taskIds/runIds/messageIds/evidenceBundleIds/executorWidgetIds; confirmationToken in grant is permission metadata only; hobit.action.request remains separate.",
    "Intermediate prose is not a capability call; emit an envelope or final marker. Do not write awaiting capability result.",
    "After hobit.action.result, prefer returned nextAction: use nextAction.capabilityId and nextAction.input exactly; do not rename fields.",
    "If nextAction is unavailable, ask or stop with the blocker; do not guess ids, fields, or actions from nextSuggestedCapability alone.",
    'Queue bounded autonomy requires structured JSON type "hobit.queue.autonomyGrant"; prose like go, approve, or I confirm is not a grant.',
    "Inside a valid Queue grant, follow schema-valid nextAction exactly. If policy blocks it, finish with hobit.final.answer and the blocker.",
    "Stop on blocked, unavailable, confirmation_required, policy_blocked, failed, invalid, repeated, or max actions.",
    "For commands requiring confirmation, include the exact structured confirmation field after user confirmation; prose alone is insufficient.",
    `Queue required confirmation token: top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD}="${QUEUE_START_RUN_CONFIRMATION_TOKEN}", not inside input.`,
    "Do not use shell or Codex for product actions. Do not execute app actions through shell, Codex, Git, Terminal, rollback, or validation.",
    "Do not inspect source files for product actions.",
    "Queue item creation is a Queue capability.",
    "Queue item creation should use queue.createItems.",
    "Prompt-pack flows use queue.preparePromptPackPreview or queue.importPromptPack.",
    "Queue reads use backend aggregates.",
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
      ? "agentFinished(evidenceBundle or taskId,runId,outcome,finalAgentMessage)"
      : null,
    presentCapabilityIds.has("queue.review.createMessage")
      ? "createMessage(taskId)"
      : null,
    presentCapabilityIds.has("queue.review.ack")
      ? "ack(taskId,messageId)"
      : null,
    presentCapabilityIds.has("queue.coordinator.approveValidation")
      ? "approveValidation(taskId,coordinatorAgentId)"
      : null,
    presentCapabilityIds.has("queue.coordinator.addFollowUpPrompt")
      ? "addFollowUpPrompt(taskId,coordinatorAgentId,prompt)"
      : null,
    presentCapabilityIds.has("queue.item.markDone")
      ? "markDone(taskId) plus top-level confirmationToken=operator-confirmed"
      : null,
    presentCapabilityIds.has("queue.item.block")
      ? "block(taskId,coordinatorAgentId,reason)"
      : null,
    presentCapabilityIds.has("queue.item.fail")
      ? "fail(taskId,reason) plus top-level confirmationToken=operator-confirmed"
      : null,
    presentCapabilityIds.has("queue.lifecycle.get") ? "get(taskId)" : null,
    presentCapabilityIds.has("queue.review.getEvidenceBundle")
      ? "getEvidenceBundle(taskId,runId?)"
      : null,
  ].filter((item): item is string => Boolean(item)).join("; ");
  return [
    "Queue lifecycle schemas are exact structured contracts; do not invent capability ids or ids.",
    requiredInputLine,
    "Review create/ack use trusted runtime/backend actor defaults when coordinatorAgentId is omitted; do not invent actor ids.",
    "ACK does not mean done or failed. queue.item.markDone is the backend accepted-completion command; queue.item.fail is the backend terminal-failure command. Worker failure evidence alone is not terminal failure. Prose confirmation is insufficient and these commands do not run Git, validation, rollback, Terminal, or workers.",
    'Lifecycle example: {"type":"hobit.action.request","requestId":"lifecycle-agent-finished-1","capabilityId":"queue.lifecycle.agentFinished","dryRun":false,"input":{"taskId":"queue-task-id","runId":"worker-run-id","outcome":"completed","finalAgentMessage":"Done."}}',
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

  const exampleIds = queueCreateCapabilities
    .map((capability) => `{"capabilityId":"${capability.id}"}`)
    .join("; ");

  return [
    "Queue create action schemas:",
    ...queueCreateCapabilities.map((capability) =>
      capability.inputSchema
        ? `- ${capability.id}: required=${capability.inputSchema.requiredFields.join(",")}`
        : `- ${capability.id}: ${capability.inputSchemaDescription}`,
    ),
    "Queue item prompt is required; prompt is the runnable task instruction.",
    "Use title,prompt plus optional dependsOn:string[] with explicit upstream Queue task ids returned by typed results.",
    "For dependency smoke, create upstream first, then create downstream with dependsOn:[upstreamTaskId].",
    "Do not infer dependencies from order,title,prompt,prose,or prompt-pack ids.",
    "Do not use body,text,content,operatorPrompt,initialState,dependencies,depends_on,queueTag,priority for Queue create input.",
    "For a test, dummy, or example Queue item, create a safe placeholder prompt.",
    "If a real Queue item lacks task content, ask a concise clarification.",
    "Do not auto-run workers.",
    '{"capabilityId":"queue.createItem","input":{"title":"Test Queue item","prompt":"Review the current workspace state and report one safe next step."}}',
    exampleIds ? `Queue create envelope ids: ${exampleIds}.` : null,
  ].filter((line): line is string => Boolean(line));
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

  const exampleIds = runControlCapabilities
    .map((capability) => `{"capabilityId":"${capability.id}"}`)
    .join("; ");

  return [
    "Queue run-control is typed only; never infer taskId, runId, evidenceBundleId, messageId, or executorWidgetId from prose, titles, prompts, paths, final messages, or source text.",
    `Run settings enums: sandbox=${QUEUE_RUN_SANDBOX_VALUES.join("|")}; approvalPolicy=${QUEUE_RUN_APPROVAL_POLICY_VALUES.join("|")}.`,
    `Run-control fields: list(limit?,taskId?); settings(taskId,codexExecutable?,workspaceRoot?,sandbox?,approvalPolicy?); promote(taskId); enable({}); start(input.taskId,input.executorWidgetId,input.queueId?, top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD}="${QUEUE_START_RUN_CONFIRMATION_TOKEN}").`,
    "Use queue.items.list when ids are missing; settings/promote/enable do not start; start requires confirmation and no codex.runTask fallback.",
    exampleIds ? `Run-control envelope ids: ${exampleIds}.` : null,
  ].filter((line): line is string => Boolean(line));
}
