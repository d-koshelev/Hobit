import brokerActionRuntimeSource from "./workspaceAgentBrokerActionRuntime.ts?raw";
import continuationSource from "./workspaceAgentBrokerContinuation.ts?raw";
import liveWorkbenchContextSource from "./workspaceAgentLiveWorkbenchContext.ts?raw";
import liveContextSource from "./agents/adapters/workspaceAgentLiveContextCapabilities.ts?raw";
import queueAdapterSource from "./agents/adapters/queueAgentCapabilities.ts?raw";
import moduleRegistrySource from "./agents/modules/moduleControlSurfaceRegistry.ts?raw";
import workbenchModuleSurfaceSource from "./agents/modules/workbenchModuleControlSurface.ts?raw";

import { describe, expect, it } from "vitest";

import {
  createActionRequest,
  evaluateBrokerPolicy,
  type HobitAgentActionHandlerMap,
} from "./agents/broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  type HobitAgentCapability,
} from "./agents/capabilities";
import { QUEUE_CAPABILITY_CONTRACT_BY_ID } from "./agents/capabilities/queueCapabilityContracts";
import {
  createQueueAgentActionHandlers,
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import { createWorkspaceAgentLiveContextActionHandlers } from "./agents/adapters/workspaceAgentLiveContextCapabilities";
import {
  resolveModuleControlSurfaceCapability,
  validateRegisteredModuleControlSurfaces,
} from "./agents/modules";
import { createWorkspaceAgentCapabilityInstructionBlock } from "./agents/context/workspaceAgentCapabilityContext";
import {
  createDefaultQueueAutonomyPolicy,
  createQueueAutonomyPolicy,
  classifyWorkspaceAgentBrokerContinuationCapability,
  type QueueAutonomyGrant,
} from "./workspaceAgentBrokerContinuation";
import {
  createWorkspaceAgentBrokerCapabilityRegistry,
  createWorkspaceAgentHobitActionHandlers,
} from "./workspaceAgentBrokerActionRuntime";

const REQUIRED_LIVE_QUEUE_SMOKE_CAPABILITY_IDS = [
  "workspace.context.get",
  "workbench.widgets.list",
  "queue.control.get",
  "queue.control.setManualEnabled",
  "queue.workflow.get",
  "queue.workflow.list",
  "queue.workflow.getReport",
  "queue.workflow.planResume",
  "queue.workflow.readActionLog",
] as const;

const REQUIRED_READ_CAPABILITY_IDS = [
  "workspace.context.get",
  "workbench.widgets.list",
  "queue.control.get",
  "queue.workflow.get",
  "queue.workflow.list",
  "queue.workflow.getReport",
  "queue.workflow.planResume",
  "queue.workflow.readActionLog",
] as const;

describe("Workspace Agent capability registry consistency", () => {
  it("registers live Queue smoke capabilities across manifest, module metadata, handlers, and continuation policy", () => {
    const manifest = createHobitAgentCapabilityRegistry();
    const handlers = workspaceAgentBrokerHandlers();

    expect(validateRegisteredModuleControlSurfaces()).toEqual([]);

    for (const capabilityId of REQUIRED_LIVE_QUEUE_SMOKE_CAPABILITY_IDS) {
      const manifestCapability = requiredCapability(manifest, capabilityId);
      const moduleResolution = resolveModuleControlSurfaceCapability({
        capabilityId,
      });

      expect(manifestCapability.availability.status, capabilityId).toBe(
        "available",
      );
      expect(handlers, capabilityId).toHaveProperty(capabilityId);
      expect(moduleResolution, capabilityId).toMatchObject({
        capabilityId,
        ok: true,
      });
      if (!moduleResolution.ok) {
        throw new Error(`Missing module metadata for ${capabilityId}.`);
      }

      const expectedModuleId = capabilityId.startsWith("queue.")
        ? "queue"
        : "workbench";
      expect(moduleResolution.moduleId, capabilityId).toBe(expectedModuleId);
      expect(moduleResolution.capability.riskClass, capabilityId).not.toBe(
        "unknown",
      );
      expect(moduleResolution.capability.confirmationRequirement, capabilityId)
        .toBe(
          capabilityId === "queue.control.setManualEnabled"
            ? "recommended"
            : "none",
        );

      if (capabilityId === "queue.control.setManualEnabled") {
        expect(manifestCapability.sideEffectLevel).toBe("write");
        expect(moduleResolution.capability).toMatchObject({
          autoContinuationSafe: true,
          readOnly: false,
          riskClass: "setup",
        });
      } else {
        expect(manifestCapability.sideEffectLevel, capabilityId).toBe("read");
        expect(moduleResolution.capability).toMatchObject({
          autoContinuationSafe: true,
          readOnly: true,
          riskClass: "read",
        });
      }
    }
  });

  it("keeps broker-advertised Workspace Agent capabilities aligned with registered handlers and module metadata", () => {
    const handlers = workspaceAgentBrokerHandlers();
    const brokerRegistry = createWorkspaceAgentBrokerCapabilityRegistry(
      handlers,
    );

    for (const capability of brokerRegistry.capabilities.filter(
      isAvailableWorkspaceAgentBrokerCapability,
    )) {
      expect(handlers, capability.id).toHaveProperty(capability.id);
      expect(
        resolveModuleControlSurfaceCapability({
          capabilityId: capability.id,
        }),
        capability.id,
      ).toMatchObject({ ok: true });
    }

    for (const capabilityId of Object.keys(handlers)) {
      expect(
        resolveModuleControlSurfaceCapability({
          capabilityId,
        }),
        capabilityId,
      ).toMatchObject({ ok: true });
    }

    expect(handlers).not.toHaveProperty("queue.workflow.invoke");
  });

  it("allows read-only discovery and workflow debug reads without grants or confirmations", () => {
    for (const capabilityId of REQUIRED_READ_CAPABILITY_IDS) {
      const capabilityClass =
        classifyWorkspaceAgentBrokerContinuationCapability(capabilityId);
      const policyDecision = evaluateBrokerPolicy(
        createWorkspaceAgentBrokerCapabilityRegistry(
          workspaceAgentBrokerHandlers(),
        ),
        createActionRequest({
          agentRoleId: "workspace_agent",
          capabilityId,
          input:
            capabilityId === "queue.workflow.get" ||
            capabilityId === "queue.workflow.getReport" ||
            capabilityId === "queue.workflow.planResume" ||
            capabilityId === "queue.workflow.readActionLog"
              ? { workflowRunId: "workflow-run-1" }
              : {},
          requestId: `registry-consistency-${capabilityId}`,
        }),
      );

      expect(capabilityClass, capabilityId).toMatchObject({
        kind: "allowed",
        riskClass: "read",
      });
      expect(policyDecision, capabilityId).toMatchObject({
        allowed: true,
        requiresConfirmation: false,
        requiresDryRun: false,
        status: "allowed",
      });
    }
  });

  it("keeps queue.control.setManualEnabled setup-gated for broker auto-continuation", () => {
    const withoutGrant = classifyWorkspaceAgentBrokerContinuationCapability(
      "queue.control.setManualEnabled",
      createDefaultQueueAutonomyPolicy(),
    );
    const readOnlyGrant = classifyWorkspaceAgentBrokerContinuationCapability(
      "queue.control.setManualEnabled",
      createQueueAutonomyPolicy(queueAutonomyGrant("read_only")),
    );
    const setupGrant = classifyWorkspaceAgentBrokerContinuationCapability(
      "queue.control.setManualEnabled",
      createQueueAutonomyPolicy(queueAutonomyGrant("queue_acceptance_smoke")),
    );

    expect(withoutGrant).toMatchObject({
      kind: "not_allowed",
    });
    expect(readOnlyGrant).toMatchObject({
      kind: "not_allowed",
    });
    expect(setupGrant).toMatchObject({
      kind: "allowed",
      riskClass: "setup",
    });

    const contract = QUEUE_CAPABILITY_CONTRACT_BY_ID.get(
      "queue.control.setManualEnabled",
    );
    expect(contract).toMatchObject({
      autoContinuationSafe: true,
      confirmation: { required: false },
      confirmationRequirement: "recommended",
      readOnly: false,
      riskClass: "setup",
      sideEffectLevel: "write",
    });
  });

  it("keeps agent.status.read out of the Workspace Agent live Queue smoke path", () => {
    const handlers = workspaceAgentBrokerHandlers();
    const brokerRegistry = createWorkspaceAgentBrokerCapabilityRegistry(
      handlers,
    );
    const agentStatusCapability = findCapability(
      brokerRegistry,
      "agent.status.read",
    );
    const policyDecision = evaluateBrokerPolicy(
      brokerRegistry,
      createActionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "agent.status.read",
        input: { agentId: "workspace-agent" },
        requestId: "registry-consistency-agent-status-read",
      }),
    );
    const instructionBlock = createWorkspaceAgentCapabilityInstructionBlock({
      currentPrompt: "Run the Queue live smoke discovery and debug path.",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });

    expect(handlers).not.toHaveProperty("agent.status.read");
    expect(agentStatusCapability).toMatchObject({
      availability: {
        status: "unavailable",
      },
    });
    expect(policyDecision).toMatchObject({
      allowed: false,
      status: "unavailable",
    });
    expect(policyDecision.reasons[0]).toContain(
      "agent.status.read is not wired in the Workspace Agent Action Broker surface.",
    );
    expect(instructionBlock).toContain(
      "Queue smoke chain: workspace.context.get, workbench.widgets.list, queue.control.get",
    );
    expect(instructionBlock).toContain("never agent.status.read");
    expect(instructionBlock).toContain(
      "Queue workflow debug reads use typed Queue workflow capabilities only",
    );
    expect(instructionBlock).not.toContain("agent.status.read for Queue");
  });

  it("keeps the capability registry guard away from Queue UI, visual shell, shell/Git/Terminal execution, and prose routing", () => {
    for (const source of [
      brokerActionRuntimeSource,
      continuationSource,
      liveWorkbenchContextSource,
      liveContextSource,
      queueAdapterSource,
      moduleRegistrySource,
      workbenchModuleSurfaceSource,
    ]) {
      expect(source).not.toContain("AgentQueueV2Board");
      expect(source).not.toContain("AgentQueuePlaceholderWidget");
      expect(source).not.toContain("widgetV2/queueV2");
      expect(source).not.toContain("queue/details");
      expect(source).not.toContain("ModuleShell");
      expect(source).not.toContain("tokens.css");
      expect(source).not.toContain("widget.css");
      expect(source).not.toContain("child_process");
      expect(source).not.toContain("spawn(");
      expect(source).not.toContain("execFile(");
      expect(source).not.toContain("runGit");
      expect(source).not.toContain("startTerminal");
      expect(source).not.toContain("executeRollback");
      expect(source).not.toContain("queue.workflow.invoke");
      expect(source).not.toContain("new RegExp");
      expect(source).not.toContain("classifyUserIntent");
      expect(source).not.toContain("window.localStorage");
      expect(source).not.toContain(".localStorage");
      expect(source).not.toContain("querySelector");
      expect(source).not.toContain("innerText");
    }
  });
});

function workspaceAgentBrokerHandlers(): HobitAgentActionHandlerMap {
  const queueAdapter = createWorkspaceAgentQueueBridgeAdapterApi(null);
  return {
    ...createQueueAgentActionHandlers(queueAdapter),
    ...createWorkspaceAgentLiveContextActionHandlers(null),
    ...createWorkspaceAgentHobitActionHandlers({
      queueAdapter,
      workspaceAgentLiveContext: null,
    }),
  };
}

function requiredCapability(
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>,
  capabilityId: string,
) {
  const capability = findCapability(registry, capabilityId);
  if (!capability) {
    throw new Error(`Missing manifest capability ${capabilityId}.`);
  }
  return capability;
}

function isAvailableWorkspaceAgentBrokerCapability(
  capability: HobitAgentCapability,
) {
  return (
    capability.availability.status === "available" &&
    capability.allowedAgentRoles.includes("workspace_agent") &&
    !capability.restricted
  );
}

function queueAutonomyGrant(
  mode: "queue_acceptance_smoke" | "read_only",
): QueueAutonomyGrant {
  return {
    constraints: {
      noDelete: true,
      noDownstreamAutoStart: true,
      noGit: true,
      noRollback: true,
      noTerminal: true,
      noValidationExecution: true,
    },
    mode,
    type: "hobit.queue.autonomyGrant",
  };
}
