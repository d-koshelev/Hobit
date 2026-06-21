import { createHobitAgentCapabilityRegistry } from "../capabilities/registry";
import { QUEUE_CAPABILITY_CONTRACT_BY_ID } from "../capabilities/queueCapabilityContracts";
import type { HobitAgentCapabilityId } from "../capabilities/types";
import type {
  HobitModuleId,
  ModuleControlSurface,
} from "./moduleControlSurface";
import { QUEUE_MODULE_CONTROL_SURFACE } from "./queueModuleControlSurface";

export const MODULE_CONTROL_SURFACE_REGISTRY: readonly ModuleControlSurface[] = [
  QUEUE_MODULE_CONTROL_SURFACE,
];

export type ModuleControlSurfaceValidationIssueCode =
  | "backend_transitional_capability_overlap"
  | "capability_id_missing_module_reference"
  | "capability_id_missing_module_contract"
  | "capability_id_missing_manifest"
  | "capability_reference_missing_id"
  | "duplicate_capability_id"
  | "duplicate_module_id"
  | "workflow_id_missing_declaration";

export type ModuleControlSurfaceValidationIssue = {
  capabilityId?: HobitAgentCapabilityId;
  code: ModuleControlSurfaceValidationIssueCode;
  message: string;
  moduleId?: HobitModuleId;
  workflowId?: string;
};

export type ModuleControlSurfaceValidationContext = {
  knownCapabilityIds?: readonly HobitAgentCapabilityId[] | ReadonlySet<HobitAgentCapabilityId>;
  moduleContractCapabilityIds?: Readonly<
    Record<string, readonly HobitAgentCapabilityId[] | ReadonlySet<HobitAgentCapabilityId>>
  >;
};

const DEFAULT_MODULE_CONTROL_SURFACE_VALIDATION_CONTEXT: ModuleControlSurfaceValidationContext =
  {
    knownCapabilityIds: createHobitAgentCapabilityRegistry().capabilities.map(
      (capability) => capability.id,
    ),
    moduleContractCapabilityIds: {
      queue: Array.from(QUEUE_CAPABILITY_CONTRACT_BY_ID.keys()),
    },
  };

export function listModuleControlSurfaces(
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
): ModuleControlSurface[] {
  return [...surfaces];
}

export function getModuleControlSurface(
  moduleId: HobitModuleId,
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
): ModuleControlSurface | undefined {
  return surfaces.find((surface) => surface.moduleId === moduleId);
}

export function hasModuleControlSurface(
  moduleId: HobitModuleId,
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
): boolean {
  return Boolean(getModuleControlSurface(moduleId, surfaces));
}

export function listModuleCapabilityIds(
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
): HobitAgentCapabilityId[] {
  return uniqueStrings(
    surfaces.flatMap((surface) => Array.from(surface.capabilityIds)),
  );
}

export function listModuleWorkflowIds(
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
): string[] {
  return uniqueStrings(
    surfaces.flatMap((surface) => Array.from(surface.workflowIds)),
  );
}

export function validateRegisteredModuleControlSurfaces(): ModuleControlSurfaceValidationIssue[] {
  return validateModuleControlSurfaces(MODULE_CONTROL_SURFACE_REGISTRY);
}

export function validateModuleControlSurfaces(
  surfaces: readonly ModuleControlSurface[] = MODULE_CONTROL_SURFACE_REGISTRY,
  context: ModuleControlSurfaceValidationContext =
    DEFAULT_MODULE_CONTROL_SURFACE_VALIDATION_CONTEXT,
): ModuleControlSurfaceValidationIssue[] {
  const issues: ModuleControlSurfaceValidationIssue[] = [];
  const moduleIds = new Map<HobitModuleId, number>();
  const knownCapabilityIds = toReadonlySet(context.knownCapabilityIds);

  for (const surface of surfaces) {
    const seenCount = moduleIds.get(surface.moduleId) ?? 0;
    moduleIds.set(surface.moduleId, seenCount + 1);
    if (seenCount > 0) {
      issues.push({
        code: "duplicate_module_id",
        message: `Module control surface is registered more than once: ${surface.moduleId}.`,
        moduleId: surface.moduleId,
      });
    }

    validateSingleModuleControlSurface({
      context,
      issues,
      knownCapabilityIds,
      surface,
    });
  }

  return issues;
}

function validateSingleModuleControlSurface({
  context,
  issues,
  knownCapabilityIds,
  surface,
}: {
  context: ModuleControlSurfaceValidationContext;
  issues: ModuleControlSurfaceValidationIssue[];
  knownCapabilityIds?: ReadonlySet<HobitAgentCapabilityId>;
  surface: ModuleControlSurface;
}) {
  const declaredCapabilityIds = new Set(surface.capabilityIds);
  const moduleReferenceIds = new Set(
    surface.capabilities.map((capability) => capability.capabilityId),
  );

  validateDuplicateIds({
    ids: surface.capabilityIds,
    issues,
    moduleId: surface.moduleId,
  });
  validateDuplicateIds({
    ids: surface.capabilities.map((capability) => capability.capabilityId),
    issues,
    moduleId: surface.moduleId,
  });

  for (const capabilityId of categorizedCapabilityIds(surface)) {
    if (!declaredCapabilityIds.has(capabilityId)) {
      issues.push({
        capabilityId,
        code: "capability_id_missing_module_reference",
        message: `${capabilityId} is categorized by ${surface.moduleId} but is missing from capabilityIds.`,
        moduleId: surface.moduleId,
      });
    }
  }

  for (const capabilityId of surface.capabilityIds) {
    if (!moduleReferenceIds.has(capabilityId)) {
      issues.push({
        capabilityId,
        code: "capability_reference_missing_id",
        message: `${capabilityId} is listed by ${surface.moduleId} but has no capability reference.`,
        moduleId: surface.moduleId,
      });
    }
  }

  const transitionalCapabilityIds = new Set(surface.transitionalCapabilityIds);
  for (const capabilityId of surface.backendBackedCapabilityIds) {
    if (transitionalCapabilityIds.has(capabilityId)) {
      issues.push({
        capabilityId,
        code: "backend_transitional_capability_overlap",
        message: `${capabilityId} is both backend-backed and transitional in ${surface.moduleId}.`,
        moduleId: surface.moduleId,
      });
    }
  }

  for (const capabilityId of allModuleCapabilityIds(surface)) {
    if (knownCapabilityIds && !knownCapabilityIds.has(capabilityId)) {
      issues.push({
        capabilityId,
        code: "capability_id_missing_manifest",
        message: `${capabilityId} is listed by ${surface.moduleId} but is missing from the agent capability manifest.`,
        moduleId: surface.moduleId,
      });
    }
  }

  const contractCapabilityIds = toReadonlySet(
    context.moduleContractCapabilityIds?.[surface.moduleId],
  );
  if (contractCapabilityIds) {
    for (const capabilityId of allModuleCapabilityIds(surface)) {
      if (!contractCapabilityIds.has(capabilityId)) {
        issues.push({
          capabilityId,
          code: "capability_id_missing_module_contract",
          message: `${capabilityId} is listed by ${surface.moduleId} but is missing from the module capability contract inventory.`,
          moduleId: surface.moduleId,
        });
      }
    }
  }

  const declaredWorkflowIds = new Set(
    surface.workflows.map((workflow) => workflow.workflowId),
  );
  for (const workflowId of surface.workflowIds) {
    if (!declaredWorkflowIds.has(workflowId)) {
      issues.push({
        code: "workflow_id_missing_declaration",
        message: `${workflowId} is listed by ${surface.moduleId} but has no workflow declaration.`,
        moduleId: surface.moduleId,
        workflowId,
      });
    }
  }
}

function validateDuplicateIds({
  ids,
  issues,
  moduleId,
}: {
  ids: readonly HobitAgentCapabilityId[];
  issues: ModuleControlSurfaceValidationIssue[];
  moduleId: HobitModuleId;
}) {
  const seen = new Set<HobitAgentCapabilityId>();
  const reported = new Set<HobitAgentCapabilityId>();

  for (const capabilityId of ids) {
    if (seen.has(capabilityId) && !reported.has(capabilityId)) {
      issues.push({
        capabilityId,
        code: "duplicate_capability_id",
        message: `${capabilityId} is listed more than once by ${moduleId}.`,
        moduleId,
      });
      reported.add(capabilityId);
    }
    seen.add(capabilityId);
  }
}

function allModuleCapabilityIds(
  surface: ModuleControlSurface,
): HobitAgentCapabilityId[] {
  return uniqueStrings([
    ...surface.capabilityIds,
    ...categorizedCapabilityIds(surface),
    ...surface.capabilities.map((capability) => capability.capabilityId),
  ]);
}

function categorizedCapabilityIds(
  surface: ModuleControlSurface,
): HobitAgentCapabilityId[] {
  return [
    ...surface.backendBackedCapabilityIds,
    ...surface.transitionalCapabilityIds,
    ...surface.unavailableCapabilityIds,
  ];
}

function uniqueStrings<TValue extends string>(values: readonly TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function toReadonlySet<TValue extends string>(
  values?: readonly TValue[] | ReadonlySet<TValue>,
): ReadonlySet<TValue> | undefined {
  if (!values) {
    return undefined;
  }

  if (Array.isArray(values)) {
    return new Set(values);
  }

  return values as ReadonlySet<TValue>;
}
