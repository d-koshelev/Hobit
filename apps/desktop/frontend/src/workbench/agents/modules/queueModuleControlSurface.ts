import {
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
  type QueueCapabilityBacking,
  type QueueCapabilityRiskClass,
} from "../capabilities/queueCapabilityContracts";
import type {
  ModuleCapabilityBackingStatus,
  ModuleControlSurface,
  ModuleUiDependencyPolicy,
} from "./moduleControlSurface";

export const QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS = [
  "queue.items.list",
  "queue.lifecycle.get",
  "queue.lifecycle.agentFinished",
  "queue.review.getEvidenceBundle",
  "queue.review.createMessage",
  "queue.review.ack",
  "queue.item.markDone",
  "queue.item.fail",
] as const;

export const QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS = [
  "queue.item.block",
  "queue.coordinator.addFollowUpPrompt",
  "queue.coordinator.approveValidation",
] as const;

export const QUEUE_MODULE_CONTROL_SURFACE: ModuleControlSurface<QueueCapabilityRiskClass> =
  {
    actorContextPolicy: {
      defaultActor: "runtime_agent",
      notes: [
        "Workspace Agent and broker adapters supply trusted actor context; the model must not invent actor ids.",
        "Review actor overrides are accepted only when an exact typed actor id is already available.",
      ],
      trustedContextFields: [
        "agentId",
        "requestedAt",
        "requestId",
        "coordinatorAgentId default from request agentId when omitted",
      ],
    },
    apiPort: {
      name: "QueueBackendCapabilityPort",
      notes: [
        "Backend-backed Queue capabilities use typed backend/Tauri APIs through this port.",
        "Bridge-backed and transitional capabilities remain explicitly classified until moved behind durable backend ownership.",
      ],
      owner: "backend_domain",
      path: "apps/desktop/frontend/src/workbench/agents/adapters/queueBackendCapabilityPort.ts",
    },
    backendBackedCapabilityIds: QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
    backendOwner:
      "Queue backend/domain/storage aggregate, worker evidence, review, accepted completion, and terminal failure services.",
    backingStatus: "mixed",
    capabilities: QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => ({
      backingStatus: moduleBackingStatusForQueueBacking(contract.backing),
      capabilityId: contract.capabilityId,
      confirmationRequirement: contract.confirmationRequirement,
      notes: notesForQueueBacking(contract.backing),
      riskClass: contract.riskClass,
      uiDependencyPolicy: uiDependencyPolicyForQueueBacking(contract.backing),
    })),
    capabilityIds: QUEUE_CAPABILITY_CONTRACT_INVENTORY.map(
      (contract) => contract.capabilityId,
    ),
    compatibilityNotes: [
      "Widget Agent Contracts describe widget-readable product boundaries; they are not executable Module Control Surfaces.",
      "Codex Direct Work is a provider/worker implementation detail, not the module integration architecture.",
      "Queue workflow metadata is intentionally empty until a typed workflow request and runner contract exists.",
      "Transitional Queue capabilities must stay labeled until backend/domain commands replace frontend controller overlays.",
    ],
    confirmationRequirements: QUEUE_CAPABILITY_CONTRACT_INVENTORY.filter(
      (contract) =>
        contract.confirmationRequirement !== "none" ||
        contract.confirmation.required,
    ).map((contract) => ({
      capabilityId: contract.capabilityId,
      notes: contract.confirmation.required
        ? [
            "Confirmation is a top-level structured action-request field. Prose confirmation is insufficient.",
          ]
        : ["Operator review is recommended by capability metadata."],
      requirement: contract.confirmationRequirement,
      ...(contract.confirmation.required
        ? {
            tokenField:
              contract.confirmation.field ??
              QUEUE_START_RUN_CONFIRMATION_FIELD,
            tokenValue:
              contract.confirmation.value ??
              QUEUE_START_RUN_CONFIRMATION_TOKEN,
          }
        : {}),
    })),
    contractTestRequirements: [
      "Queue module capability ids are registered in the global capability manifest.",
      "Queue module capability ids are present in the Queue capability contract inventory.",
      "Backend-backed and transitional capability lists do not overlap.",
      "Backend-backed Queue module capabilities do not import Queue UI files.",
      "No lifecycle-namespaced evidence read alias is present.",
      "Workflow metadata may be empty while no Queue workflow runner is implemented.",
    ],
    displayName: "Agent Queue",
    moduleId: "queue",
    riskClasses: uniqueQueueRiskClasses(),
    serviceOwner: "Agent Queue module",
    summary:
      "Agent-facing Queue module contract describing typed capabilities, backing status, risks, confirmation, actor context, and UI dependency boundaries.",
    tauriSurface: {
      commands: [
        "agent_queue_aggregate_commands",
        "agent_queue_worker_evidence_commands",
        "agent_queue_review_commands",
        "agent_queue_completion_commands",
        "agent_queue_failure_commands",
      ],
      notes: [
        "Tauri surfaces expose backend aggregate, evidence, review, completion, and failure DTOs for backend-backed capabilities.",
      ],
    },
    transitionalCapabilityIds: QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
    uiDependencyPolicy: "transitional_controller",
    unavailableCapabilityIds: [],
    version: "module-control-surface.queue.v0",
    workflowIds: [],
    workflows: [],
  } as const;

function uniqueQueueRiskClasses(): QueueCapabilityRiskClass[] {
  return Array.from(
    new Set(QUEUE_CAPABILITY_CONTRACT_INVENTORY.map((contract) => contract.riskClass)),
  ).sort();
}

function moduleBackingStatusForQueueBacking(
  backing: QueueCapabilityBacking,
): ModuleCapabilityBackingStatus {
  switch (backing) {
    case "backend_backed":
      return "backend_backed";
    case "bridge_backed":
      return "bridge_backed";
    case "model_preview":
      return "model_preview";
    case "transitional_frontend_overlay":
      return "transitional_controller";
  }
}

function uiDependencyPolicyForQueueBacking(
  backing: QueueCapabilityBacking,
): ModuleUiDependencyPolicy {
  switch (backing) {
    case "backend_backed":
    case "model_preview":
      return "none";
    case "bridge_backed":
    case "transitional_frontend_overlay":
      return "transitional_controller";
  }
}

function notesForQueueBacking(backing: QueueCapabilityBacking): readonly string[] {
  switch (backing) {
    case "backend_backed":
      return [
        "Uses backend/domain/Tauri or the typed backend capability port; it must not depend on Queue UI state.",
      ];
    case "bridge_backed":
      return [
        "Uses existing typed frontend bridge compatibility paths; it is not a Queue UI component API.",
      ];
    case "model_preview":
      return ["Uses model-only preview/self-test paths with no product mutation."];
    case "transitional_frontend_overlay":
      return [
        "Uses transitional frontend/controller overlay state and must move to backend/domain ownership later.",
      ];
  }
}
