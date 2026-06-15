// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads repo docs and source in Vitest only.
import { existsSync, readFileSync } from "fs";

import { describe, expect, it } from "vitest";

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
    expect(contractDoc).toContain("queue.createItems");
    expect(contractDoc).toContain("codex.runTask");
    expect(contractDoc).not.toMatch(/durable backend runtime is implemented/i);
    expect(contractDoc).not.toMatch(/backend scheduler is implemented/i);
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
    expect(instructionBlock).toContain("Available capabilities:");
    expect(instructionBlock).toContain("queue.createItems");
    expect(instructionBlock).toContain("queue.importPromptPack");
    expect(instructionBlock).toContain("codex.runTask");
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
    expect(instructionBlock).toContain(
      "Codex and shell are restricted capabilities",
    );
  });

  it("builds the Workspace Agent capability runtime seam without broker execution", () => {
    const seam = buildWorkspaceAgentCapabilityRuntimeSeam({
      currentPrompt: "Create Queue items from this visible prompt.",
      widgetInstanceId: "agent-1",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceName: "Capability seam",
    });

    expect(seam.appContext.currentPrompt).toBe(
      "Create Queue items from this visible prompt.",
    );
    expect(seam.appContext.workspace).toMatchObject({
      queueSingletonKey: "workspace-queue",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
      workspaceName: "Capability seam",
    });
    expect(seam.appContext.surface).toMatchObject({
      surfaceId: "workspace-agent",
      widgetDefinitionId: "interactive-agent",
      widgetInstanceId: "agent-1",
    });
    expect(seam.brokerBoundary).toEqual({
      expectedRequest: "typed_hobit_capability_request",
      status: "not_implemented",
    });
    expect(seam.instructionBlock).toContain("You are inside Hobit");
    expect(seam.instructionBlock).toContain("queue.createItems");
    expect(seam.instructionBlock).toContain("codex.runTask");
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
    expect(instructionBlock).toContain("Available capabilities:");
    expect(instructionBlock).toContain("Codex and shell are restricted capabilities");
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
      "queue.createItem",
      "queue.createItems",
      "queue.importPromptPack",
      "queue.preparePromptPackPreview",
      "queue.selfTest",
      "queue.targetSingletonQueue",
    ]);
    expect(queueCreateItems.ownerSurface).toBe("Agent Queue");
    expect(queueCreateItems.sideEffectLevel).toBe("write");
    expect(queueCreateItems.defaultForProductActions).toBe(true);
    expect(queueCreateItems.supportsDryRun).toBe(true);
    expect(queueCreateItems.description).toContain("typed in-app Queue APIs");
    expect(
      assertCapabilityDoesNotAllowForbiddenSideEffects(queueCreateItems, [
        "duplicate_queue_view",
        "auto_run_workers",
        "queue_autorun",
      ]),
    ).toBe(true);
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
