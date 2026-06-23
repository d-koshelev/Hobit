// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads repo docs and source in Vitest only.
import { existsSync, readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  createHobitAgentCapabilityRegistry as createRegistryFromPublicIndex,
  createSelfTestInstruction as createSelfTestInstructionFromPublicIndex,
  createWorkspaceAgentCapabilityInstructionBlock as createInstructionBlockFromPublicIndex,
  HOBIT_TEST_AGENT_A as TEST_AGENT_A_FROM_PUBLIC_INDEX,
  HOBIT_AGENT_INITIAL_CAPABILITIES as INITIAL_CAPABILITIES_FROM_PUBLIC_INDEX,
  createAgentMessage as createAgentMessageFromPublicIndex,
  createAgentRuntimeState as createAgentRuntimeStateFromPublicIndex,
  listWidgetContracts as listWidgetContractsFromPublicIndex,
} from "./index";
import {
  createHobitAgentCapabilityRegistry as createRegistryFromCapabilitiesIndex,
  HOBIT_AGENT_INITIAL_CAPABILITIES as INITIAL_CAPABILITIES_FROM_CAPABILITIES_INDEX,
} from "./capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
  queueCapabilityNextActionAgreesWithSuggestion,
  validateQueueCapabilityNextAction,
} from "./capabilities/queueCapabilityContracts";
import {
  createActionRequest as createActionRequestFromBrokerIndex,
  readHobitAgentActionRequestEnvelope,
} from "./broker";
import {
  buildWorkspaceAgentCapabilityContext as buildContextFromContextIndex,
} from "./context";
import { createSelfTestReport as createSelfTestReportFromSelfTestIndex } from "./selfTest";
import { HOBIT_AGENT_INITIAL_CAPABILITIES as INITIAL_CAPABILITIES_FROM_COMPAT_MANIFEST } from "./hobitAgentCapabilityManifest";
import {
  HOBIT_WORKSPACE_AGENT_ROLE,
  assertCapabilityDoesNotAllowForbiddenSideEffects,
  canAgentUseCapability,
  createActionRequest,
  createCapabilityInstructionBlock,
  createDefaultHobitAgentAppContext,
  createHobitAgentCapabilityRegistry,
  createPolicyBlockedActionResult,
  createUnavailableActionResult,
  createWorkspaceAgentAppContext,
  evaluateCapabilityPolicy,
  findCapability,
  listAvailableCapabilities,
  requiresConfirmation,
} from "./hobitAgentCapabilityRuntime";
import {
  buildWorkspaceAgentCapabilityContext,
  buildWorkspaceAgentCapabilityRuntimeSeam,
  createWorkspaceAgentCapabilityInstructionBlock,
  createWorkspaceAgentPromptWithCapabilityContext,
  getWorkspaceAgentCapabilityManifest,
} from "./workspaceAgentCapabilityContext";

describe("hobitAgentCapabilityRuntime docs", () => {
  it("keeps the capability runtime docs present and honest about current boundaries", () => {
    const reviewDoc = doc("HOBIT_AGENT_CAPABILITY_RUNTIME_REVIEW.md");
    const contractDoc = doc("HOBIT_AGENT_CAPABILITY_RUNTIME.md");

    expect(reviewDoc).toContain("Current Workspace Agent Architecture");
    expect(reviewDoc).toContain("regex routing must not be used");
    expect(reviewDoc).toContain("workspaceAgentQueueBridge.ts");
    expect(reviewDoc).toContain("queue/agentQueueWidgetApi.ts");
    expect(reviewDoc).toContain("promptPack/promptPackMaterialization.ts");
    expect(contractDoc).toContain("Capability Registry");
    expect(contractDoc).toContain("Module Ownership");
    expect(contractDoc).toContain("context/");
    expect(contractDoc).toContain("capabilities/");
    expect(contractDoc).toContain("broker/");
    expect(contractDoc).toContain("queue.createItems");
    expect(contractDoc).toContain("codex.runTask");
    expect(contractDoc).toContain("Action Broker MVP");
    expect(contractDoc).toContain("Queue Capability Adapter MVP");
    expect(contractDoc).toContain(
      "Queue create action input is intentionally strict",
    );
    expect(contractDoc).toContain(
      "test, dummy, or example Queue item requests can use a safe placeholder prompt",
    );
    expect(contractDoc).not.toMatch(/durable backend runtime is implemented/i);
    expect(contractDoc).not.toMatch(/backend scheduler is implemented/i);
  });
});

describe("hobitAgentCapabilityRuntime module structure", () => {
  it("exposes public runtime helpers from the new agent barrel and module barrels", () => {
    const registry = createRegistryFromPublicIndex();
    const capabilityRegistry = createRegistryFromCapabilitiesIndex();
    const context = buildContextFromContextIndex({
      currentPrompt: "Create Queue work.",
      workspaceId: "workspace-1",
    });
    const request = createActionRequestFromBrokerIndex({
      agentRoleId: "workspace_agent",
      capabilityId: "queue.createItems",
      dryRun: true,
    });
    const report = createSelfTestReportFromSelfTestIndex({
      request: {
        agentRoleId: "workspace_agent",
        capabilityIds: ["queue.selfTest"],
        dryRun: true,
        requestId: "self-test",
      },
      results: [],
    });

    expect(registry.version).toBe("hobit-agent-capability-runtime.v0");
    expect(capabilityRegistry.capabilities.map((capability) => capability.id)).toContain(
      "queue.createItems",
    );
    expect(context.surface.widgetDefinitionId).toBe("interactive-agent");
    expect(request).toMatchObject({
      agentRoleId: "workspace_agent",
      capabilityId: "queue.createItems",
    });
    expect(report.summary.total).toBe(0);
    expect(
      listWidgetContractsFromPublicIndex().map((contract) => contract.widgetId),
    ).toEqual([
      "agent-queue",
      "interactive-agent",
      "notes",
      "skill-library",
      "terminal",
    ]);
    expect(createSelfTestInstructionFromPublicIndex().id).toBe(
      "hobit.agent.selfTest",
    );
    expect(
      createInstructionBlockFromPublicIndex({
        currentPrompt: "Plan Queue work.",
        workspaceId: "workspace-1",
      }),
    ).toContain("Compact capability manifest:");
    expect(INITIAL_CAPABILITIES_FROM_PUBLIC_INDEX).toBe(
      INITIAL_CAPABILITIES_FROM_CAPABILITIES_INDEX,
    );
    expect(INITIAL_CAPABILITIES_FROM_COMPAT_MANIFEST).toBe(
      INITIAL_CAPABILITIES_FROM_CAPABILITIES_INDEX,
    );
  });

  it("keeps compatibility runtime imports wired to the split modules", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const publicRegistry = createRegistryFromPublicIndex();

    expect(registry).toEqual(publicRegistry);
    expect(getWorkspaceAgentCapabilityManifest()).toEqual(publicRegistry);
    expect(findCapability(registry, "queue.createItem")).toMatchObject({
      ownerSurface: "Agent Queue",
      sideEffectLevel: "write",
    });
  });

  it("exposes runtime and messaging homes without product execution", () => {
    const state = createAgentRuntimeStateFromPublicIndex({
      workspaceId: "workspace-1",
    });
    const message = createAgentMessageFromPublicIndex({
      body: "status",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      toAgentId: "test.agentB",
    });

    expect(frontendFileExists("workbench/agents/runtime/index.ts")).toBe(true);
    expect(frontendFileExists("workbench/agents/messaging/index.ts")).toBe(true);
    expect(frontendFileExists("workbench/agents/widgets/index.ts")).toBe(true);
    expect(frontendFileExists("workbench/agents/adapters/index.ts")).toBe(true);
    expect(state).toMatchObject({
      agents: [],
      workspaceId: "workspace-1",
    });
    expect(TEST_AGENT_A_FROM_PUBLIC_INDEX.agentId).toBe("test.agentA");
    expect(message).toMatchObject({
      fromAgentId: "test.agentA",
      messageId: "message-1",
      toAgentId: "test.agentB",
    });
    expect(frontendSource("workbench/agents/adapters/index.ts")).toContain(
      "createQueueAgentActionHandlers",
    );
  });

  it("does not add regex routing modules under the agent runtime structure", () => {
    const agentFiles = collectFrontendFiles("workbench/agents")
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => !path.includes("hobitAgentCapabilityRuntime.test"));
    const suspiciousFiles = agentFiles.filter((path) =>
      /regex|route|routing|classifier|parser/i.test(path),
    );
    const suspiciousSource = agentFiles.filter((path) => {
      const source = frontendSource(path);

      return (
        source.includes("new RegExp") ||
        source.includes("classifyWorkspaceAgentProductIntent") ||
        source.includes("parseWorkspaceAgentQueueCommand") ||
        source.includes("workspaceAgentProductIntentRouting")
      );
    });

    expect(suspiciousFiles).toEqual([]);
    expect(suspiciousSource).toEqual([]);
  });
});

describe("hobitAgentCapabilityRuntime context", () => {
  it("creates default Hobit app context for Workspace Agent", () => {
    const context = createDefaultHobitAgentAppContext({
      currentPrompt: "Create Queue items for this work.",
      surface: { widgetInstanceId: "agent-1" },
      workspace: {
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
        workspaceName: "Runtime foundation",
      },
    });

    expect(context.appName).toBe("Hobit");
    expect(context.productCenter).toBe("Workbench");
    expect(context.role.primaryDuty).toBe("product_action_orchestrator");
    expect(context.role.allowedDefaultExecutionPath).toBe(
      "typed_app_capabilities",
    );
    expect(context.workspace).toMatchObject({
      queueSingletonKey: "workspace-queue",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });
    expect(context.surface).toMatchObject({
      surfaceId: "workspace-agent",
      title: "Workspace Agent",
      widgetDefinitionId: "interactive-agent",
      widgetInstanceId: "agent-1",
    });
  });

  it("generates an instruction block that tells the agent it is inside Hobit", () => {
    const context = createWorkspaceAgentAppContext({
      currentPrompt: "Add these tasks to Queue.",
      workspace: { workspaceId: "workspace-1" },
    });
    const instructionBlock = createCapabilityInstructionBlock(context);

    expect(instructionBlock).toContain("You are inside Hobit");
    expect(instructionBlock).toContain(
      "You are operating from the Workspace Agent surface.",
    );
    expect(instructionBlock).toContain(
      "operational brain and product-action orchestrator",
    );
    expect(instructionBlock).toContain("Compact capability manifest:");
    expect(instructionBlock).toContain("queue.targetSingletonQueue");
    expect(instructionBlock).toContain("queue.createItems");
    expect(instructionBlock).toContain("queue.preparePromptPackPreview");
    expect(instructionBlock).toContain("queue.importPromptPack");
    expect(instructionBlock).toContain("queue.selfTest");
    expect(instructionBlock).toContain("agent.status.read");
    expect(instructionBlock).toContain("agent.history.read");
    expect(instructionBlock).toContain("agent.message.send");
    expect(instructionBlock).toContain("agent.capabilities.read");
    expect(instructionBlock).toContain("agent.selfTest.run");
    expect(instructionBlock).toContain("codex.runTask");
    expect(instructionBlock).toContain("workspace.shell.runCommand");
    expect(instructionBlock).toContain("availability=unavailable");
    expect(instructionBlock).toContain(
      "Use typed Hobit app capabilities before Codex or shell.",
    );
    expect(instructionBlock).toContain(
      "App and product actions must use typed Hobit capabilities.",
    );
    expect(instructionBlock).toContain(
      "Do not use shell or Codex for product actions.",
    );
    expect(instructionBlock).toContain(
      "Do not inspect source files for product actions.",
    );
    expect(instructionBlock).toContain(
      "Queue item creation is a Queue capability.",
    );
    expect(instructionBlock).toContain("Queue create action schemas:");
    expect(instructionBlock).toContain("required=title,prompt");
    expect(instructionBlock).toContain(
      "Queue item prompt is required",
    );
    expect(instructionBlock).toContain("runnable task instruction");
    expect(instructionBlock).toContain("dependsOn:string[]");
    expect(instructionBlock).toContain(
      "create upstream first, then create downstream",
    );
    expect(instructionBlock).toContain(
      "Do not infer dependencies from order,title,prompt,prose",
    );
    expect(instructionBlock).toContain(
      "test, dummy, or example Queue item",
    );
    expect(instructionBlock).toContain("ask a concise clarification");
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.createItem"',
    );
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.createItems"',
    );
    expect(instructionBlock).toContain("Run-control fields:");
    expect(instructionBlock).toContain(
      "never infer taskId, runId, evidenceBundleId, messageId, or executorWidgetId",
    );
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.items.list"',
    );
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.item.updateRunSettings"',
    );
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.item.promoteDraft"',
    );
    expect(instructionBlock).toContain('"capabilityId":"queue.enable"');
    expect(instructionBlock).toContain(
      '"capabilityId":"queue.item.startRun"',
    );
    expect(instructionBlock).toContain('"prompt":"Review the current workspace state and report one safe next step."');
    expect(instructionBlock).toContain('"title":"Test Queue item"');
    expect(instructionBlock).toContain(
      "Codex and shell are restricted capabilities",
    );
    expect(instructionBlock).toContain('"type":"hobit.action.request"');
    expect(instructionBlock).toContain('"type":"hobit.workflow.request"');
    expect(instructionBlock).toContain('"type":"hobit.final.answer"');
    expect(instructionBlock).toContain(
      "Workflow requests are validation/classification only",
    );
    expect(instructionBlock).toContain("prose is not workflow input");
    expect(instructionBlock).toContain(
      "Workflow grant authorizes only permission/scope",
    );
    expect(instructionBlock).toContain(
      "Workflow inputs configure data such as runSettings",
    );
    expect(instructionBlock).toContain("Never put runSettings");
    expect(instructionBlock).toContain("grant.scope taskIds");
    expect(instructionBlock).toContain(
      "confirmationToken in grant is permission metadata only",
    );
    expect(instructionBlock).toContain("do not emit action lists");
    expect(instructionBlock).toContain(
      "Intermediate prose is not a capability call",
    );
    expect(instructionBlock).toContain("Do not write awaiting capability result");
    expect(instructionBlock).not.toMatch(/wait\s+for\s+(?:a\s+)?capability\s+result/i);
    expect(instructionBlock).toContain("After hobit.action.result");
    expect(instructionBlock).toContain("prefer returned nextAction");
    expect(instructionBlock).toContain("nextAction.capabilityId");
    expect(instructionBlock).toContain("do not rename fields");
    expect(instructionBlock).toContain(
      "do not guess ids, fields, or actions from nextSuggestedCapability alone",
    );
    expect(instructionBlock).toContain(
      `top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD}="${QUEUE_START_RUN_CONFIRMATION_TOKEN}"`,
    );
    expect(instructionBlock).toContain(
      `sandbox=${QUEUE_RUN_SANDBOX_VALUES.join("|")}`,
    );
    expect(instructionBlock).toContain(
      `approvalPolicy=${QUEUE_RUN_APPROVAL_POLICY_VALUES.join("|")}`,
    );
    expect(instructionBlock).toContain("fresh requestId");
    expect(instructionBlock).not.toContain('"allowedAgentRoles"');
    expect(instructionBlock).not.toContain('"grant":{"runSettings"');
    expect(instructionBlock).not.toContain('"grant":{"tasks"');
    expect(instructionBlock.length).toBeLessThan(11000);
    expect(instructionBlock).not.toContain('"capabilities"');
  });

  it("builds the Workspace Agent capability runtime seam with structured broker action requests", () => {
    const seam = buildWorkspaceAgentCapabilityRuntimeSeam({
      currentPrompt: "Create Queue items from this visible prompt.",
      widgetInstanceId: "agent-1",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceName: "Capability seam",
      workspaceRoot: "C:/repo",
    });

    expect(seam.appContext.currentPrompt).toBe(
      "Create Queue items from this visible prompt.",
    );
    expect(seam.appContext.workspace).toMatchObject({
      queueSingletonKey: "workspace-queue",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceName: "Capability seam",
      workspaceRoot: "C:/repo",
    });
    expect(seam.appContext.surface).toMatchObject({
      surfaceId: "workspace-agent",
      widgetDefinitionId: "interactive-agent",
      widgetInstanceId: "agent-1",
    });
    expect(seam.brokerBoundary).toEqual({
      expectedRequest: "structured_hobit_action_request",
      status: "implemented",
    });
    expect(seam.instructionBlock).toContain("You are inside Hobit");
    expect(seam.instructionBlock).toContain("queue.createItems");
    expect(seam.instructionBlock).toContain("codex.runTask");
    expect(seam.instructionBlock).toContain("Workflow grant authorizes");
    expect(seam.instructionBlock).toContain("Workspace root: C:/repo.");
  });

  it("exposes Workspace Agent context helpers over the capability manifest", () => {
    const manifest = getWorkspaceAgentCapabilityManifest();
    const context = buildWorkspaceAgentCapabilityContext({
      capabilityRegistry: manifest,
      currentPrompt: "Add Queue work.",
      workspaceId: "workspace-1",
    });
    const instructionBlock =
      createWorkspaceAgentCapabilityInstructionBlock(context);

    expect(context.capabilityManifest.version).toBe(
      "hobit-agent-capability-runtime.v0",
    );
    expect(
      context.capabilityManifest.capabilities.map(
        (capability) => capability.id,
      ),
    ).toContain("queue.createItem");
    expect(
      context.capabilityManifest.capabilities.map(
        (capability) => capability.id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "agent.status.read",
        "agent.history.read",
        "agent.message.send",
        "agent.capabilities.read",
        "agent.selfTest.run",
      ]),
    );
    expect(instructionBlock).toContain("Compact capability manifest:");
    expect(instructionBlock).toContain("Codex and shell are restricted capabilities");
  });

  it("does not include stale unregistered capability ids in Workspace Agent instructions", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const registeredCapabilityIds = new Set(
      registry.capabilities.map((capability) => capability.id),
    );
    const instructionBlock = createWorkspaceAgentCapabilityInstructionBlock({
      currentPrompt: "Run Queue smoke.",
      workspaceId: "workspace-1",
    });
    const mentionedCapabilityIds = Array.from(
      instructionBlock.matchAll(
        /\b(?:agent|codex|queue|workspace\.shell)\.[A-Za-z0-9.]+/g,
      ),
    )
      .map((match) => match[0].replace(/[.,;:]+$/, ""))
      .filter(
        (capabilityId) =>
          capabilityId !== "codex.cmd" &&
          capabilityId !== "queue.autonomyGrant",
      );

    expect(mentionedCapabilityIds.length).toBeGreaterThan(0);
    for (const capabilityId of mentionedCapabilityIds) {
      expect(registeredCapabilityIds.has(capabilityId), capabilityId).toBe(true);
    }
  });

  it("keeps Queue capability schemas and examples on canonical action fields", () => {
    const queueCapabilities = INITIAL_CAPABILITIES_FROM_CAPABILITIES_INDEX.filter(
      (capability) => capability.id.startsWith("queue."),
    );
    const badFieldNames = [
      "approval_policy",
      "depends_on",
      "dependencies",
      "reviewMessageId",
    ];

    expect(queueCapabilities.length).toBeGreaterThan(0);
    for (const capability of queueCapabilities) {
      const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capability.id);
      expect(contract, capability.id).toBeDefined();
      expect(contract?.riskClass, capability.id).toBeTruthy();

      for (const example of capability.examples ?? []) {
        const exampleInput = example.exampleInput as Record<string, unknown>;
        const actionInput = example.exampleActionRequest.input as Record<
          string,
          unknown
        >;
        const serialized = JSON.stringify({
          actionInput,
          exampleInput,
        });

        expect(example.exampleActionRequest.type).toBe("hobit.action.request");
        expect(example.exampleActionRequest.capabilityId).toBe(capability.id);
        expect(actionInput).not.toHaveProperty("confirmationToken");
        for (const badFieldName of badFieldNames) {
          expect(serialized, `${capability.id} example`).not.toContain(
            `"${badFieldName}"`,
          );
        }
      }
    }

    const ackNextAction = {
      autoContinuationSafe: true,
      capabilityId: "queue.review.ack",
      input: { messageId: "review-message-id", taskId: "task-id" },
      requiresConfirmation: false,
    };

    expect(validateQueueCapabilityNextAction(ackNextAction)).toEqual({
      missingRequiredFields: [],
      ok: true,
      reasons: [],
    });
    expect(
      validateQueueCapabilityNextAction({
        ...ackNextAction,
        input: { reviewMessageId: "review-message-id", taskId: "task-id" },
      }).ok,
    ).toBe(false);
    expect(
      queueCapabilityNextActionAgreesWithSuggestion({
        nextAction: ackNextAction,
        nextSuggestedCapability: "queue.review.ack",
      }),
    ).toBe(true);
    expect(
      queueCapabilityNextActionAgreesWithSuggestion({
        nextAction: ackNextAction,
        nextSuggestedCapability: "queue.item.markDone",
      }),
    ).toBe(false);
  });

  it("keeps transitional and finalizing Queue capabilities explicitly gated", () => {
    const transitionalCapabilities = [
      "queue.coordinator.addFollowUpPrompt",
      "queue.coordinator.approveValidation",
      "queue.item.block",
    ];
    const finalizingCapabilities = ["queue.item.markDone", "queue.item.fail"];

    for (const capabilityId of transitionalCapabilities) {
      const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
      expect(contract, capabilityId).toBeDefined();
      expect(contract?.backing, capabilityId).toBe(
        "transitional_frontend_overlay",
      );
      expect(contract?.autoContinuationSafe, capabilityId).toBe(false);
      expect(contract?.riskClass, capabilityId).not.toBe("read");
    }

    for (const capabilityId of finalizingCapabilities) {
      const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId);
      expect(contract, capabilityId).toBeDefined();
      expect(contract?.backing, capabilityId).toBe("backend_backed");
      expect(contract?.autoContinuationSafe, capabilityId).toBe(false);
      expect(contract?.confirmation.required, capabilityId).toBe(true);
    }
  });

  it("wraps Direct Work prompts with Hobit capability context and action request instructions", () => {
    const prompt = createWorkspaceAgentPromptWithCapabilityContext({
      currentPrompt: "Refactor the Workspace Agent prompt path.",
      widgetInstanceId: "agent-1",
      workspaceId: "workspace-1",
      workspaceRoot: "C:/repo",
    });

    expect(prompt).toContain("[Hobit capability context]");
    expect(prompt).toContain("You are inside Hobit");
    expect(prompt).toContain("Use typed Hobit app capabilities before Codex or shell.");
    expect(prompt).toContain('"type":"hobit.action.request"');
    expect(prompt).toContain('"type":"hobit.workflow.request"');
    expect(prompt).toContain('"type":"hobit.final.answer"');
    expect(prompt).toContain("Use a fresh requestId");
    expect(prompt).toContain("no workflow runner executes");
    expect(prompt).toContain("inputs.runSettings");
    expect(prompt).toContain("inputs.tasks[].dependsOnSlots");
    expect(prompt).toContain("After hobit.action.result");
    expect(prompt).toContain("prefer returned nextAction");
    expect(prompt).toContain("do not rename fields");
    expect(prompt).toContain("Do not infer workflow inputs");
    expect(prompt).toContain("Intermediate prose is not a capability call.");
    expect(prompt).toContain("Do not write awaiting capability result");
    expect(prompt).toContain("When a Hobit app capability is needed");
    expect(prompt).toContain("Queue item creation is a Queue capability.");
    expect(prompt).toContain("Queue item prompt is required");
    expect(prompt).toContain('"capabilityId":"queue.createItem"');
    expect(prompt).toContain('"capabilityId":"queue.createItems"');
    expect(prompt).toContain("Do not inspect source files for product actions.");
    expect(prompt).toContain("Do not execute app actions through shell, Codex");
    expect(prompt).toContain("codex.runTask (restricted)");
    expect(prompt).toContain("workspace.shell.runCommand (restricted)");
    expect(prompt).toContain("User request:\nRefactor the Workspace Agent prompt path.");
    expect(prompt.length).toBeLessThan(8000);
    expect(prompt).not.toContain("the app validates availability only");
    expect(prompt).not.toContain('"capabilityManifest"');
  });
});

describe("Workspace Agent active path cleanup", () => {
  it("does not import the deleted regex product routing or Queue command parser", () => {
    const source = frontendSource("workbench/InteractiveAgentPlaceholderWidget.tsx");

    expect(source).not.toContain("workspaceAgentProductIntentRouting");
    expect(source).not.toContain("workspaceAgentQueueCommandHandler");
    expect(source).not.toContain("classifyWorkspaceAgentProductIntent");
    expect(source).not.toContain("runWorkspaceAgentQueueCommand");
    expect(source).not.toContain("parseWorkspaceAgentQueueCommand");
  });

  it("removes the phrase-routing modules instead of preserving regex classification", () => {
    expect(frontendFileExists("workbench/workspaceAgentProductIntentRouting.ts")).toBe(
      false,
    );
    expect(frontendFileExists("workbench/workspaceAgentQueueCommandParser.ts")).toBe(
      false,
    );
    expect(
      frontendFileExists("workbench/workspaceAgentQueueCommandHandler.ts"),
    ).toBe(false);
  });
});

describe("hobitAgentCapabilityRuntime capabilities", () => {
  it("declares Queue capabilities as typed in-app capabilities", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const queueCreateItems = requiredCapability(registry, "queue.createItems");
    const queueCapabilities = registry.capabilities
      .filter((capability) => capability.id.startsWith("queue."))
      .map((capability) => capability.id);

    expect(queueCapabilities).toEqual([
      "queue.control.get",
      "queue.coordinator.addFollowUpPrompt",
      "queue.coordinator.approveValidation",
      "queue.createItem",
      "queue.createItems",
      "queue.enable",
      "queue.importPromptPack",
      "queue.item.block",
      "queue.item.fail",
      "queue.item.markDone",
      "queue.item.promoteDraft",
      "queue.item.startRun",
      "queue.item.updateRunSettings",
      "queue.items.list",
      "queue.lifecycle.agentFinished",
      "queue.lifecycle.get",
      "queue.preparePromptPackPreview",
      "queue.review.ack",
      "queue.review.createMessage",
      "queue.review.getEvidenceBundle",
      "queue.selfTest",
      "queue.targetSingletonQueue",
    ]);
    expect(queueCreateItems.ownerSurface).toBe("Agent Queue");
    expect(queueCreateItems.sideEffectLevel).toBe("write");
    expect(queueCreateItems.defaultForProductActions).toBe(true);
    expect(queueCreateItems.supportsDryRun).toBe(true);
    expect(queueCreateItems.description).toContain("typed in-app Queue APIs");
    expect(requiredCapability(registry, "queue.items.list")).toMatchObject({
      confirmationRequirement: "none",
      sideEffectLevel: "read",
    });
    expect(
      requiredCapability(registry, "queue.item.updateRunSettings").inputSchema
        ?.requiredFields,
    ).toEqual(["taskId"]);
    expect(
      requiredCapability(registry, "queue.item.startRun").inputSchema
        ?.requiredFields,
    ).toEqual(["taskId", "executorWidgetId"]);
    expect(requiredCapability(registry, "queue.item.startRun")).toMatchObject({
      confirmationRequirement: "required",
      restricted: false,
      sideEffectLevel: "execute",
      supportsDryRun: false,
    });
    expect(requiredCapability(registry, "queue.item.markDone")).toMatchObject({
      confirmationRequirement: "required",
      restricted: false,
      sideEffectLevel: "write",
      supportsDryRun: false,
    });
    expect(
      requiredCapability(registry, "queue.item.markDone").inputSchema,
    ).toMatchObject({
      acceptedFields: [
        "taskId",
        "reason",
        "runId",
        "messageId",
        "reviewMessageId",
      ],
      requiredFields: ["taskId", "top-level confirmationToken"],
    });
    expect(requiredCapability(registry, "queue.item.fail")).toMatchObject({
      confirmationRequirement: "required",
      restricted: false,
      sideEffectLevel: "write",
      supportsDryRun: false,
    });
    expect(
      requiredCapability(registry, "queue.item.fail").inputSchema,
    ).toMatchObject({
      acceptedFields: [
        "taskId",
        "reason",
        "runId",
        "evidenceBundleId",
        "messageId",
        "reviewMessageId",
      ],
      requiredFields: ["taskId", "reason", "top-level confirmationToken"],
    });
    expect(
      assertCapabilityDoesNotAllowForbiddenSideEffects(queueCreateItems, [
        "duplicate_queue_view",
        "auto_run_workers",
        "queue_autorun",
      ]),
    ).toBe(true);

    expect(
      assertCapabilityDoesNotAllowForbiddenSideEffects(
        requiredCapability(registry, "queue.lifecycle.agentFinished"),
        ["git_mutation", "worker_start", "validation_execution"],
      ),
    ).toBe(true);
  });

  it("declares exact Queue create schemas and valid action-request examples", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const queueCreateItem = requiredCapability(registry, "queue.createItem");
    const queueCreateItems = requiredCapability(registry, "queue.createItems");
    const createItemExample = requiredMutationExample(queueCreateItem);
    const createItemsExample = requiredMutationExample(queueCreateItems);

    expect(queueCreateItem.inputSchema?.requiredFields).toEqual([
      "title",
      "prompt",
    ]);
    expect(queueCreateItem.inputSchema?.acceptedFields).toEqual([
      "title",
      "prompt",
      "status",
      "description",
      "dependsOn",
      "source",
      "sourceMetadata",
      "id",
    ]);
    expect(queueCreateItems.inputSchema?.requiredFields).toEqual([
      "items",
      "items[].title",
      "items[].prompt",
    ]);
    expect(queueCreateItems.inputSchema?.acceptedFields).toContain(
      "items[].title",
    );
    expect(queueCreateItems.inputSchema?.acceptedFields).toContain(
      "items[].prompt",
    );
    expect(queueCreateItems.inputSchema?.acceptedFields).toContain(
      "items[].dependsOn",
    );
    expect(queueCreateItem.inputSchema?.shape).toContain('"dependsOn"');
    expect(queueCreateItems.inputSchema?.shape).toContain('"dependsOn"');
    expect(queueCreateItem.inputSchema?.shape).not.toContain('"dependencies"');
    expect(queueCreateItems.inputSchema?.shape).not.toContain('"dependencies"');
    expect(createItemExample.exampleActionRequest).toMatchObject({
      capabilityId: "queue.createItem",
      dryRun: false,
      input: {
        prompt:
          "Review the current workspace state and report one safe next step.",
        status: "draft",
        title: "Test Queue item",
      },
      requestId: expect.any(String),
      type: "hobit.action.request",
    });
    expect(createItemsExample.exampleActionRequest).toMatchObject({
      capabilityId: "queue.createItems",
      dryRun: false,
      input: {
        items: [
          expect.objectContaining({
            prompt:
              "Review the current workspace state and report one safe next step.",
            title: "Test Queue item",
          }),
        ],
      },
      requestId: expect.any(String),
      type: "hobit.action.request",
    });
    expect(
      Array.isArray(
        (
          createItemsExample.exampleActionRequest.input as {
            items?: unknown;
          }
        ).items,
      ),
    ).toBe(true);

    for (const example of [createItemExample, createItemsExample]) {
      const serializedExample = JSON.stringify(example.exampleActionRequest);

      expect(serializedExample).toContain('"prompt"');
      expect(serializedExample).toContain('"requestId"');
      expect(serializedExample).not.toContain('"body"');
      expect(serializedExample).not.toContain('"text"');
      expect(serializedExample).not.toContain('"content"');
      expect(serializedExample).not.toContain('"operatorPrompt"');
      expect(readHobitAgentActionRequestEnvelope(serializedExample)).toMatchObject({
        requestIdSource: "explicit",
        status: "valid",
      });
    }

    const dependentCreateExample = queueCreateItem.examples?.find((example) =>
      example.description.includes("explicit upstream task id"),
    );
    const dependentBatchExample = queueCreateItems.examples?.find((example) =>
      example.description.includes("explicit upstream task id"),
    );

    expect(JSON.stringify(dependentCreateExample?.exampleActionRequest)).toContain(
      '"dependsOn"',
    );
    expect(JSON.stringify(dependentBatchExample?.exampleActionRequest)).toContain(
      '"dependsOn"',
    );
    expect(JSON.stringify(dependentCreateExample?.exampleActionRequest)).not.toContain(
      '"dependencies"',
    );
    expect(JSON.stringify(dependentBatchExample?.exampleActionRequest)).not.toContain(
      '"dependencies"',
    );
  });

  it("declares Queue run-control schemas and valid action-request examples", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const list = requiredCapability(registry, "queue.items.list");
    const settings = requiredCapability(
      registry,
      "queue.item.updateRunSettings",
    );
    const promote = requiredCapability(registry, "queue.item.promoteDraft");
    const enable = requiredCapability(registry, "queue.enable");
    const start = requiredCapability(registry, "queue.item.startRun");

    expect(list.inputSchema?.acceptedFields).toEqual(["limit", "taskId"]);
    expect(settings.inputSchema?.acceptedFields).toEqual([
      "taskId",
      "codexExecutable",
      "workspaceRoot",
      "sandbox",
      "approvalPolicy",
    ]);
    expect(promote.inputSchema?.acceptedFields).toEqual(["taskId"]);
    expect(enable.inputSchema?.acceptedFields).toEqual([]);
    expect(start.inputSchema?.acceptedFields).toEqual([
      "taskId",
      "executorWidgetId",
      "queueId",
    ]);
    expect(settings.inputSchema?.shape).toContain(
      QUEUE_RUN_SANDBOX_VALUES.join("|"),
    );
    expect(settings.inputSchema?.shape).toContain(
      QUEUE_RUN_APPROVAL_POLICY_VALUES.join("|"),
    );
    expect(start.inputSchema?.shape).toContain(
      `${QUEUE_START_RUN_CONFIRMATION_FIELD}":"${QUEUE_START_RUN_CONFIRMATION_TOKEN}`,
    );
    expect(settings.inputSchema?.acceptedFields).not.toContain("dependsOn");
    expect(start.inputSchema?.acceptedFields).not.toContain("operatorPrompt");
    expect(requiredMutationExample(start).exampleActionRequest).toMatchObject({
      capabilityId: "queue.item.startRun",
      confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      input: {
        executorWidgetId: "executor-widget-id",
        taskId: "queue-task-id",
      },
      type: "hobit.action.request",
    });

    for (const capability of [list, settings, promote, enable, start]) {
      const serializedExample = JSON.stringify(
        capability.examples?.[0]?.exampleActionRequest,
      );

      expect(serializedExample).toContain('"type":"hobit.action.request"');
      expect(serializedExample).toContain('"requestId"');
      expect(readHobitAgentActionRequestEnvelope(serializedExample)).toMatchObject({
        requestIdSource: "explicit",
        status: "valid",
      });
    }

    const settingsExampleJson = JSON.stringify(
      requiredMutationExample(settings).exampleActionRequest,
    );
    expect(settingsExampleJson).toContain('"sandbox":"workspace_write"');
    expect(settingsExampleJson).toContain('"approvalPolicy":"on_request"');
    for (const invalidValue of [
      "workspace-write",
      "workspaceWrite",
      "on-request",
      "onRequest",
      '"default"',
    ]) {
      expect(settings.inputSchema?.shape).not.toContain(invalidValue);
      expect(settingsExampleJson).not.toContain(invalidValue);
    }
  });

  it("keeps Queue capability contracts, examples, and instructions id-consistent", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const registeredQueueIds = new Set(
      registry.capabilities
        .filter((capability) => capability.id.startsWith("queue."))
        .map((capability) => capability.id),
    );
    const instructionBlock = createCapabilityInstructionBlock(
      createDefaultHobitAgentAppContext({
        workspace: { workspaceId: "workspace-1" },
      }),
    );
    const exampleIds = registry.capabilities.flatMap((capability) =>
      (capability.examples ?? []).map(
        (example) => example.exampleActionRequest.capabilityId,
      ),
    );
    const instructionQueueIds = Array.from(
      instructionBlock.matchAll(/queue(?:\.[A-Za-z0-9]+)+/g),
    )
      .map((match) => match[0])
      .filter((capabilityId) => capabilityId !== "queue.autonomyGrant");

    for (const contract of QUEUE_CAPABILITY_CONTRACT_INVENTORY) {
      expect(registeredQueueIds.has(contract.capabilityId), contract.capabilityId).toBe(
        true,
      );
      for (const nextCapabilityId of contract.nextSuggestedCapabilities) {
        expect(registeredQueueIds.has(nextCapabilityId), nextCapabilityId).toBe(
          true,
        );
      }
      if (contract.requiredIds.taskId) {
        expect(contract.fieldPolicies.taskId).toBeDefined();
      }
      if (contract.requiredIds.runId) {
        expect(contract.fieldPolicies.runId).toBeDefined();
      }
      if (contract.requiredIds.executorWidgetId) {
        expect(contract.fieldPolicies.executorWidgetId).toBeDefined();
      }
      if (contract.requiredIds.messageId) {
        expect(contract.fieldPolicies.messageId).toBeDefined();
      }
    }

    for (const capabilityId of [...exampleIds, ...instructionQueueIds]) {
      expect(registeredQueueIds.has(capabilityId), capabilityId).toBe(true);
    }

    expect(exampleIds).not.toContain("queue.lifecycle.getEvidenceBundle");
    expect(instructionBlock).not.toContain("queue.lifecycle.getEvidenceBundle");
    for (const capability of registry.capabilities) {
      for (const example of capability.examples ?? []) {
        expect(Array.isArray(example.exampleActionRequest)).toBe(false);
        expect(example.exampleActionRequest.type).toBe("hobit.action.request");
      }
    }
  });

  it("declares agent runtime APIs as typed model capabilities", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const agentCapabilities = registry.capabilities
      .filter((capability) => capability.id.startsWith("agent."))
      .map((capability) => capability.id);

    expect(agentCapabilities).toEqual([
      "agent.capabilities.read",
      "agent.history.read",
      "agent.message.send",
      "agent.selfTest.run",
      "agent.status.read",
    ]);
    for (const capabilityId of agentCapabilities) {
      const capability = requiredCapability(registry, capabilityId);

      expect(capability.ownerSurface).toBe("Multi-Agent Runtime");
      expect(capability.defaultForProductActions).toBe(false);
      expect(capability.allowedAgentRoles).toContain("workspace_agent");
      expect(capability.restricted).toBe(false);
    }
  });

  it("declares Codex and shell as restricted execute capabilities, not default app-action paths", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const codex = requiredCapability(registry, "codex.runTask");
    const shell = requiredCapability(registry, "workspace.shell.runCommand");

    expect(codex.sideEffectLevel).toBe("execute");
    expect(codex.restricted).toBe(true);
    expect(codex.defaultForProductActions).toBe(false);
    expect(codex.confirmationRequirement).toBe("required");
    expect(codex.supportsSelfTest).toBe(false);
    expect(shell.sideEffectLevel).toBe("execute");
    expect(shell.restricted).toBe(true);
    expect(shell.defaultForProductActions).toBe(false);
    expect(shell.availability.status).toBe("unavailable");
    expect(shell.confirmationRequirement).toBe("required");
  });

  it("lists available and self-test capabilities without overclaiming shell availability", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const availableIds = listAvailableCapabilities(
      registry,
      "workspace_agent",
    ).map((capability) => capability.id);

    expect(availableIds).toContain("queue.createItems");
    expect(availableIds).toContain("codex.runTask");
    expect(availableIds).not.toContain("workspace.shell.runCommand");
    expect(availableIds).not.toContain("notes.create");
    expect(availableIds).not.toContain("terminal.open");
    expect(availableIds).not.toContain("knowledge.search");
  });
});

describe("hobitAgentCapabilityRuntime policy", () => {
  it("allows Workspace Agent to use Queue createItems", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capability = requiredCapability(registry, "queue.createItems");
    const request = createActionRequest({
      agentRoleId: HOBIT_WORKSPACE_AGENT_ROLE.id,
      capabilityId: capability.id,
      dryRun: true,
    });

    expect(canAgentUseCapability(HOBIT_WORKSPACE_AGENT_ROLE, capability)).toBe(
      true,
    );
    expect(evaluateCapabilityPolicy(registry, request)).toMatchObject({
      allowed: true,
      status: "allowed",
    });
  });

  it("requires confirmation for destructive capabilities when declared", () => {
    const registry = createHobitAgentCapabilityRegistry([
      {
        ...requiredCapability(createHobitAgentCapabilityRegistry(), "queue.createItems"),
        confirmationRequirement: "required",
        id: "queue.clearAllItems",
        sideEffectLevel: "destructive",
      },
    ]);
    const destructive = requiredCapability(registry, "queue.clearAllItems");
    const decision = evaluateCapabilityPolicy(
      registry,
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "queue.clearAllItems",
      }),
    );

    expect(requiresConfirmation(destructive)).toBe(true);
    expect(decision).toMatchObject({
      allowed: false,
      requiresConfirmation: true,
      status: "requires_confirmation",
    });
  });

  it("restricts execute capabilities behind confirmation", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const decision = evaluateCapabilityPolicy(
      registry,
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "codex.runTask",
      }),
    );

    expect(decision).toMatchObject({
      allowed: false,
      requiresConfirmation: true,
      status: "requires_confirmation",
    });
    expect(decision.reasons.join(" ")).toContain("restricted");
  });

  it("returns structured unavailable and policy-blocked results", () => {
    const unavailable = createUnavailableActionResult({
      capabilityId: "missing.capability",
      reason: "Capability is unavailable.",
    });
    const blocked = createPolicyBlockedActionResult({
      capabilityId: "codex.runTask",
      reasons: ["Codex is not the default product-action path."],
    });

    expect(unavailable).toMatchObject({
      ok: false,
      status: "unavailable",
      unavailableReason: "Capability is unavailable.",
    });
    expect(blocked).toMatchObject({
      ok: false,
      policyReasons: ["Codex is not the default product-action path."],
      status: "policy_blocked",
    });
  });
});

function requiredCapability(
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>,
  capabilityId: string,
) {
  const capability = findCapability(registry, capabilityId);
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }
  return capability;
}

function requiredMutationExample(
  capability: ReturnType<typeof requiredCapability>,
) {
  const example = capability.examples?.find(
    (candidate) => !candidate.exampleActionRequest.dryRun,
  );

  if (!example) {
    throw new Error(`Missing mutation example for ${capability.id}`);
  }

  return example;
}

function doc(name: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/../../../docs/${name}`, "utf8");
}

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}

function frontendFileExists(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return existsSync(`${cwd}/src/${path}`);
}

function collectFrontendFiles(path: string): string[] {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();
  const root = `${cwd}/src/${path}`;

  return collectFiles(root).map((file) =>
    file.replace(`${cwd}/src/`, "").replace(/\\/g, "/"),
  );
}

function collectFiles(path: string): string[] {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  }).filter((file: string) => file.startsWith(`${cwd}/src/`));
}
