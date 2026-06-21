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
import { QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES } from "../capabilities/queueDogfoodLifecycleCapabilityManifest";
import {
  getModuleControlSurface,
  hasModuleControlSurface,
  listModuleCapabilityIds,
  listModuleControlSurfaces,
  listModuleWorkflowIds,
  MODULE_CONTROL_SURFACE_REGISTRY,
  resolveModuleControlSurfaceCapability,
  QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
  QUEUE_MODULE_CAPABILITIES,
  QUEUE_MODULE_CAPABILITY_IDS,
  QUEUE_MODULE_CONFIRMATION_REQUIREMENTS,
  QUEUE_MODULE_CONTROL_SURFACE,
  QUEUE_MODULE_RISK_CLASSES,
  QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
  queueCapabilityContractToModuleCapabilityMetadata,
  validateModuleControlSurfaces,
  validateRegisteredModuleControlSurfaces,
  type ModuleControlSurface,
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
  it("registers Queue as the first module control surface", () => {
    expect(MODULE_CONTROL_SURFACE_REGISTRY).toEqual([
      QUEUE_MODULE_CONTROL_SURFACE,
    ]);
    expect(listModuleControlSurfaces()).toEqual([
      QUEUE_MODULE_CONTROL_SURFACE,
    ]);
    expect(listModuleControlSurfaces()[0]).toBe(QUEUE_MODULE_CONTROL_SURFACE);
  });

  it("retrieves Queue by module id and returns undefined for unknown modules", () => {
    expect(getModuleControlSurface("queue")).toBe(
      QUEUE_MODULE_CONTROL_SURFACE,
    );
    expect(hasModuleControlSurface("queue")).toBe(true);
    expect(getModuleControlSurface("unknown-module")).toBeUndefined();
    expect(hasModuleControlSurface("unknown-module")).toBe(false);
  });

  it("resolves Queue nextAction capability metadata through the module registry", () => {
    expect(
      resolveModuleControlSurfaceCapability({
        capabilityId: "queue.review.ack",
        moduleId: "queue",
      }),
    ).toMatchObject({
      capability: {
        capabilityId: "queue.review.ack",
        riskClass: "review",
      },
      moduleId: "queue",
      ok: true,
    });

    expect(
      resolveModuleControlSurfaceCapability({
        capabilityId: "queue.review.ack",
        moduleId: "unknown-module",
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "unknown_module",
    });

    expect(
      resolveModuleControlSurfaceCapability({
        capabilityId: "agent.status.read",
        moduleId: "queue",
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "unknown_module_capability_pair",
    });
  });

  it("lists registered module capability and workflow ids", () => {
    expect(listModuleCapabilityIds()).toEqual(
      QUEUE_MODULE_CONTROL_SURFACE.capabilityIds,
    );
    expect(listModuleCapabilityIds()).toContain("queue.items.list");
    expect(listModuleCapabilityIds()).toContain("queue.review.getEvidenceBundle");
    expect(listModuleWorkflowIds()).toEqual([]);
  });

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

  it("derives Queue module metadata from Queue capability contracts", () => {
    expect(QUEUE_MODULE_CONTROL_SURFACE.capabilities).toBe(
      QUEUE_MODULE_CAPABILITIES,
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds).toBe(
      QUEUE_MODULE_CAPABILITY_IDS,
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.confirmationRequirements).toBe(
      QUEUE_MODULE_CONFIRMATION_REQUIREMENTS,
    );
    expect(QUEUE_MODULE_CONTROL_SURFACE.riskClasses).toBe(
      QUEUE_MODULE_RISK_CLASSES,
    );
    expect(QUEUE_MODULE_CAPABILITIES).toEqual(
      QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) =>
        queueCapabilityContractToModuleCapabilityMetadata(contract),
      ),
    );
  });

  it("represents exact Queue backend-backed capabilities", () => {
    expect(sortedStrings(QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS)).toEqual(
      sortedStrings(EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES),
    );
    expect(
      sortedStrings(QUEUE_MODULE_CONTROL_SURFACE.backendBackedCapabilityIds),
    ).toEqual(
      sortedStrings(EXPECTED_BACKEND_BACKED_QUEUE_CAPABILITIES),
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
    expect(sortedStrings(QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS)).toEqual(
      sortedStrings(EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES),
    );
    expect(
      sortedStrings(QUEUE_MODULE_CONTROL_SURFACE.transitionalCapabilityIds),
    ).toEqual(
      sortedStrings(EXPECTED_TRANSITIONAL_QUEUE_CAPABILITIES),
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

  it("preserves Queue risk, confirmation, required-id, and actor metadata", () => {
    for (const contract of QUEUE_CAPABILITY_CONTRACT_INVENTORY) {
      const moduleCapability = requiredModuleCapability(contract.capabilityId);
      const requiredIdFields = Object.entries(contract.requiredIds)
        .filter(([, required]) => required)
        .map(([fieldName]) => fieldName)
        .sort();

      expect(moduleCapability.riskClass, contract.capabilityId).toBe(
        contract.riskClass,
      );
      expect(moduleCapability.confirmationRequirement, contract.capabilityId).toBe(
        contract.confirmationRequirement,
      );
      expect(moduleCapability.confirmation, contract.capabilityId).toMatchObject({
        required: contract.confirmation.required,
      });
      expect(moduleCapability.autoContinuationSafe, contract.capabilityId).toBe(
        contract.autoContinuationSafe,
      );
      expect(moduleCapability.readOnly, contract.capabilityId).toBe(
        contract.readOnly,
      );
      expect(moduleCapability.requiredIdFields, contract.capabilityId).toEqual(
        requiredIdFields,
      );

      if (contract.confirmation.required) {
        expect(moduleCapability.confirmation, contract.capabilityId).toMatchObject(
          {
            tokenField: contract.confirmation.field,
            tokenValue: contract.confirmation.value,
          },
        );
      }

      if (contract.trustedContextFields.length > 0) {
        expect(moduleCapability.actorPolicy, contract.capabilityId).toMatchObject(
          {
            defaultActor: "runtime_agent",
            trustedContextFields: contract.trustedContextFields,
          },
        );
      } else {
        expect(moduleCapability.actorPolicy, contract.capabilityId).toBeUndefined();
      }
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
    const lifecycleManifestIds = new Set(
      QUEUE_DOGFOOD_LIFECYCLE_CAPABILITIES.map((capability) => capability.id),
    );

    expect(QUEUE_MODULE_CONTROL_SURFACE.capabilityIds.length).toBeGreaterThan(0);
    for (const capabilityId of QUEUE_MODULE_CONTROL_SURFACE.capabilityIds) {
      expect(manifestIds.has(capabilityId), capabilityId).toBe(true);
      expect(
        contractIds.has(capabilityId) || lifecycleManifestIds.has(capabilityId),
        capabilityId,
      ).toBe(true);
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
    expect(validateRegisteredModuleControlSurfaces()).toEqual([]);
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

  it("keeps ModuleControlSurface compact and stable", () => {
    expect(Object.keys(QUEUE_MODULE_CONTROL_SURFACE).sort()).toEqual([
      "actorContextPolicy",
      "apiPort",
      "backendBackedCapabilityIds",
      "backendOwner",
      "backingStatus",
      "capabilities",
      "capabilityIds",
      "compatibilityNotes",
      "confirmationRequirements",
      "contractTestRequirements",
      "displayName",
      "moduleId",
      "riskClasses",
      "serviceOwner",
      "summary",
      "tauriSurface",
      "transitionalCapabilityIds",
      "uiDependencyPolicy",
      "unavailableCapabilityIds",
      "version",
      "workflowIds",
      "workflows",
    ]);
    const allowedCapabilityKeys = new Set([
      "actorPolicy",
      "autoContinuationSafe",
      "backingStatus",
      "capabilityId",
      "confirmation",
      "confirmationRequirement",
      "notes",
      "readOnly",
      "requiredIdFields",
      "riskClass",
      "uiDependencyPolicy",
    ]);

    for (const capability of QUEUE_MODULE_CONTROL_SURFACE.capabilities) {
      for (const key of Object.keys(capability)) {
        expect(allowedCapabilityKeys.has(key), key).toBe(true);
      }
      expect(Object.keys(capability).length).toBeLessThanOrEqual(
        allowedCapabilityKeys.size,
      );
    }
  });

  it("does not import Queue UI, Queue visual shell, or stale evidence capability ids", () => {
    const moduleSources = [
      "workbench/agents/modules/moduleControlSurface.ts",
      "workbench/agents/modules/moduleControlSurfaceRegistry.ts",
      "workbench/agents/modules/queueCapabilityModuleMetadata.ts",
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
    expect(JSON.stringify(MODULE_CONTROL_SURFACE_REGISTRY)).not.toContain(
      "queue.lifecycle.getEvidenceBundle",
    );
  });

  it("detects duplicate module ids in the pure validation helper", () => {
    const issues = validateModuleControlSurfaces([
      QUEUE_MODULE_CONTROL_SURFACE,
      QUEUE_MODULE_CONTROL_SURFACE,
    ]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "duplicate_module_id",
        moduleId: "queue",
      }),
    );
  });

  it("detects duplicate capability ids in the pure validation helper", () => {
    const duplicateCapabilityId = QUEUE_MODULE_CONTROL_SURFACE.capabilityIds[0];
    const duplicateSurface: ModuleControlSurface = {
      ...QUEUE_MODULE_CONTROL_SURFACE,
      capabilityIds: [
        ...QUEUE_MODULE_CONTROL_SURFACE.capabilityIds,
        duplicateCapabilityId,
      ],
    };
    const issues = validateModuleControlSurfaces([duplicateSurface]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        capabilityId: duplicateCapabilityId,
        code: "duplicate_capability_id",
        moduleId: "queue",
      }),
    );
  });

  it("detects backend-backed and transitional capability overlap in validation", () => {
    const overlappingCapabilityId =
      QUEUE_MODULE_CONTROL_SURFACE.backendBackedCapabilityIds[0];
    const overlappingSurface: ModuleControlSurface = {
      ...QUEUE_MODULE_CONTROL_SURFACE,
      transitionalCapabilityIds: [
        ...QUEUE_MODULE_CONTROL_SURFACE.transitionalCapabilityIds,
        overlappingCapabilityId,
      ],
    };
    const issues = validateModuleControlSurfaces([overlappingSurface]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        capabilityId: overlappingCapabilityId,
        code: "backend_transitional_capability_overlap",
        moduleId: "queue",
      }),
    );
  });

  it("detects missing manifest and contract capability ids in validation", () => {
    const staleCapabilityId = "queue.lifecycle.getEvidenceBundle";
    const staleSurface: ModuleControlSurface = {
      ...QUEUE_MODULE_CONTROL_SURFACE,
      capabilities: [
        ...QUEUE_MODULE_CONTROL_SURFACE.capabilities,
        {
          backingStatus: "backend_backed",
          capabilityId: staleCapabilityId,
          confirmationRequirement: "none",
          riskClass: "read",
          uiDependencyPolicy: "none",
        },
      ],
      capabilityIds: [
        ...QUEUE_MODULE_CONTROL_SURFACE.capabilityIds,
        staleCapabilityId,
      ],
    };
    const issues = validateModuleControlSurfaces([staleSurface]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        capabilityId: staleCapabilityId,
        code: "capability_id_missing_manifest",
        moduleId: "queue",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        capabilityId: staleCapabilityId,
        code: "capability_id_missing_module_contract",
        moduleId: "queue",
      }),
    );
  });

  it("detects workflow ids missing declarations in validation", () => {
    const workflowSurface: ModuleControlSurface = {
      ...QUEUE_MODULE_CONTROL_SURFACE,
      workflowIds: ["queue.workflow.future"],
      workflows: [],
    };
    const issues = validateModuleControlSurfaces([workflowSurface]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "workflow_id_missing_declaration",
        moduleId: "queue",
        workflowId: "queue.workflow.future",
      }),
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

function sortedStrings(values: readonly string[]) {
  return [...values].sort();
}

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}
