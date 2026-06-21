// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  createHobitAgentCapabilityRegistry,
  findCapability,
} from "../capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
} from "../capabilities/queueCapabilityContracts";
import {
  QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
  QUEUE_MODULE_CONTROL_SURFACE,
  QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
} from "./index";
import {
  QUEUE_MODULE_CONTROL_SURFACE as QUEUE_MODULE_CONTROL_SURFACE_FROM_PUBLIC_INDEX,
} from "../index";

const EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES = [
  "queue.items.list",
  "queue.lifecycle.get",
  "queue.lifecycle.agentFinished",
  "queue.review.getEvidenceBundle",
  "queue.review.createMessage",
  "queue.review.ack",
  "queue.item.markDone",
  "queue.item.fail",
] as const;

const EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES = [
  "queue.item.block",
  "queue.coordinator.addFollowUpPrompt",
  "queue.coordinator.approveValidation",
] as const;

describe("ModuleControlSurface", () => {
  it("describes Queue as the first agent-facing module control surface", () => {
    expect(QUEUE_MODULE_CONTROL_SURFACE).toMatchObject({
      backingStatus: "mixed",
      displayName: "Agent Queue",
      moduleId: "queue",
      uiDependencyPolicy: "transitional_controller",
      version: "module-control-surface.queue.v0",
    });
    expect(QUEUE_MODULE_CONTROL_SURFACE.summary).toContain(
      "Agent-facing Queue module contract",
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds).toEqual(
      QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => contract.capabilityId),
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE_FROM_PUBLIC_INDEX).toBe(
      QUEUE_MODULE_CONTROL_SURFACE,
    );
  });

  it("represents exact Queue backend-backed capabilities", () => {
    expect(QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS).toEqual(
      EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES,
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.backendBackedCapabilityIds).toEqual(
      EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES,
    );

    for (const capabilityId of EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES) {
      const moduleCapability = requiredModuleCapability(capabilityId);
      expect(moduleCapability).toMatchObject({
        backingStatus: "backend_backed",
        uiDependencyPolicy: "none",
      });
      expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId)).toMatchObject({
        backing: "backend_backed",
        implemented: true,
        registered: true,
      });
    }
  });

  it("represents exact Queue transitional capabilities", () => {
    expect(QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS).toEqual(
      EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES,
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.transitionalCapabilityIds).toEqual(
      EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES,
    );

    for (const capabilityId of EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES) {
      const moduleCapability = requiredModuleCapability(capabilityId);
      expect(moduleCapability).toMatchObject({
        backingStatus: "transitional_controller",
        uiDependencyPolicy: "transitional_controller",
      });
      expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId)).toMatchObject({
        autoContinuationSafe: false,
        backing: "transitional_frontend_overlay",
        registered: true,
      });
    }
  });

  it("keeps Queue module capability ids known to the capability manifest and Queue contracts", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const manifestIds = new Set(
      registry.capabilities.map((capability) => capability.id),
    );
    const contractIds = new Set(
      QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => contract.capabilityId),
    );

    expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds.length).toBeGreaterThan(0);
    for (const capabilityId of QUEUE_MODULE_CONTROL_SURFACE.capabilityIds) {
      expect(manifestIds.has(capabilityId), capabilityId).toBe(true);
      expect(contractIds.has(capabilityId), capabilityId).toBe(true);
      expect(findCapability(registry, capabilityId)).not.toBeNull();
    }
    for (const moduleCapability of QUEUE_MODULE_CONTROL_SURFACE.capabilities) {
      expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds).toContain(
        moduleCapability.capabilityId,
      );
      expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.has(moduleCapability.capabilityId)).toBe(
        true,
      );
    }
  });

  it("keeps backend-backed, transitional, and unavailable lists explicit and disjoint", () => {
    const backendBacked = new Set(
      QUEUE_MODULE_CONTROL_SURFACE.backendBackedCapabilityIds,
    );
    const transitional = new Set(
      QUEUE_MODULE_CONTROL_SURFACE.transitionalCapabilityIds,
    );

    for (const capabilityId of backendBacked) {
      expect(transitional.has(capabilityId), capabilityId).toBe(false);
      expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds).toContain(capabilityId);
    }
    for (const capabilityId of transitional) {
      expect(backendBacked.has(capabilityId), capabilityId).toBe(false);
      expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds).toContain(capabilityId);
    }
    expect(QUEUE_MODULE_CONTROL_SURFACE.unavailableCapabilityIds).toEqual([]);
  });

  it("allows Queue workflow metadata to be empty until a typed workflow runner exists", () => {
    expect(QUEUE_MODULE_CONTROL_SURFACE.workflowIds).toEqual([]);
    expect(QUEUE_MODULE_CONTROL_SURFACE.workflows).toEqual([]);
    expect(QUEUE_MODULE_CONTROL_SURFACE.compatibilityNotes.join(" ")).toContain(
      "Queue workflow metadata is intentionally empty",
    );
  });

  it("makes UI dependency policy explicit for every Queue module capability", () => {
    const policies = new Set(
      QUEUE_MODULE_CONTROL_SURFACE.capabilities.map(
        (capability) => capability.uiDependencyPolicy,
      ),
    );

    expect(QUEUE_MODULE_CONTROL_SURFACE.uiDependencyPolicy).toBe(
      "transitional_controller",
    );
    expect(policies).toEqual(
      new Set(["none", "transitional_controller"]),
    );
    expect(
      QUEUE_MODULE_CONTROL_SURFACE.capabilities.every(
        (capability) => Boolean(capability.uiDependencyPolicy),
      ),
    ).toBe(true);
  });

  it("does not import Queue UI, Queue visual shell, or stale evidence capability ids", () => {
    const moduleSources = [
      "workbench/agents/modules/moduleControlSurface.ts",
      "workbench/agents/modules/queueModuleControlSurface.ts",
      "workbench/agents/modules/index.ts",
    ]
      .map(frontendSource)
      .join("\n");
    const forbiddenSourceFragments = [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "widgetV2/queueV2",
      "queue/details",
      "QueueV2",
      ".css",
      "ModuleShell",
      "ModuleHeader",
    ];

    for (const fragment of forbiddenSourceFragments) {
      expect(moduleSources).not.toContain(fragment);
    }
    expect(JSON.stringify(QUEUE_MODULE_CONTROL_SURFACE)).not.toContain(
      "queue.lifecycle.getEvidenceBundle",
    );
  });
});

function requiredModuleCapability(capabilityId: string) {
  const capability = QUEUE_MODULE_CONTROL_SURFACE.capabilities.find(
    (candidate) => candidate.capabilityId === capabilityId,
  );
  if (!capability) {
    throw new Error(`Missing module capability ${capabilityId}`);
  }

  return capability;
}

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}
