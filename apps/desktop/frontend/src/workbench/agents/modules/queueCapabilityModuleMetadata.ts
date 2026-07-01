import {
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
  type QueueCapabilityBacking,
  type QueueCapabilityContract,
  type QueueCapabilityRiskClass,
} from "../capabilities/queueCapabilityContracts";
import type {
  ModuleCapabilityBackingStatus,
  ModuleCapabilityReference,
  ModuleConfirmationRequirement,
  ModuleUiDependencyPolicy,
} from "./moduleControlSurface";

export type QueueModuleCapabilityMetadata =
  ModuleCapabilityReference<QueueCapabilityRiskClass>;

export const QUEUE_MODULE_CAPABILITIES =
  buildQueueModuleCapabilityMetadata();

export const QUEUE_MODULE_CAPABILITY_IDS = QUEUE_MODULE_CAPABILITIES.map(
  (capability) => capability.capabilityId,
);

export const QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS =
  queueModuleCapabilityIdsByBacking("backend_backed");

export const QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS =
  queueModuleCapabilityIdsByBacking("transitional_frontend_overlay");

export const QUEUE_MODULE_CONFIRMATION_REQUIREMENTS =
  buildQueueModuleConfirmationRequirements();

export const QUEUE_MODULE_RISK_CLASSES = uniqueQueueRiskClasses();

export function buildQueueModuleCapabilityMetadata(
  contracts: readonly QueueCapabilityContract[] =
    QUEUE_CAPABILITY_CONTRACT_INVENTORY,
): QueueModuleCapabilityMetadata[] {
  return contracts.map(queueCapabilityContractToModuleCapabilityMetadata);
}

export function queueCapabilityContractToModuleCapabilityMetadata(
  contract: QueueCapabilityContract,
): QueueModuleCapabilityMetadata {
  const requiredIdFields = requiredQueueIdFields(contract);
  const actorPolicy =
    contract.trustedContextFields.length > 0
      ? {
          defaultActor: "runtime_agent" as const,
          notes: [
            "Trusted actor context is supplied by the runtime/backend bridge; the model must not invent these fields.",
          ],
          trustedContextFields: contract.trustedContextFields,
        }
      : undefined;

  return {
    ...(actorPolicy ? { actorPolicy } : {}),
    autoContinuationSafe: contract.autoContinuationSafe,
    backingStatus: moduleBackingStatusForQueueBacking(contract.backing),
    capabilityId: contract.capabilityId,
    confirmation: {
      required: contract.confirmation.required,
      ...(contract.confirmation.required
        ? {
            tokenField: contract.confirmation.field,
            tokenValue: contract.confirmation.value,
          }
        : {}),
    },
    confirmationRequirement: contract.confirmationRequirement,
    notes: notesForQueueBacking(contract.backing),
    readOnly: contract.readOnly,
    requiredIdFields,
    riskClass: contract.riskClass,
    uiDependencyPolicy: uiDependencyPolicyForQueueBacking(contract.backing),
  };
}

export function queueModuleCapabilityIdsByBacking(
  backing: QueueCapabilityBacking,
  contracts: readonly QueueCapabilityContract[] =
    QUEUE_CAPABILITY_CONTRACT_INVENTORY,
) {
  return contracts
    .filter((contract) => contract.backing === backing)
    .map((contract) => contract.capabilityId);
}

export function buildQueueModuleConfirmationRequirements(
  contracts: readonly QueueCapabilityContract[] =
    QUEUE_CAPABILITY_CONTRACT_INVENTORY,
): ModuleConfirmationRequirement[] {
  return contracts
    .filter(
      (contract) =>
        contract.confirmationRequirement !== "none" ||
        contract.confirmation.required,
    )
    .map((contract) => ({
      capabilityId: contract.capabilityId,
      notes: contract.confirmation.required
        ? [
            "Confirmation is a top-level structured action-request field. Prose confirmation is insufficient.",
          ]
        : ["Operator review is recommended by capability metadata."],
      requirement: contract.confirmationRequirement,
      ...(contract.confirmation.required
        ? {
            tokenField: contract.confirmation.field,
            tokenValue: contract.confirmation.value,
          }
        : {}),
    }));
}

export function uniqueQueueRiskClasses(
  contracts: readonly QueueCapabilityContract[] =
    QUEUE_CAPABILITY_CONTRACT_INVENTORY,
): QueueCapabilityRiskClass[] {
  return Array.from(
    new Set(contracts.map((contract) => contract.riskClass)),
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

function requiredQueueIdFields(contract: QueueCapabilityContract): readonly string[] {
  return Object.entries(contract.requiredIds)
    .filter(([, required]) => required)
    .map(([fieldName]) => fieldName)
    .sort();
}
