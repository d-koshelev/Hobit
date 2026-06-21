import type {
  HobitAgentCapabilityId,
  HobitAgentConfirmationRequirement,
} from "../capabilities/types";

export type HobitModuleId = "queue" | (string & {});

export type ModuleControlSurfaceBackingStatus =
  | "backend_backed"
  | "mixed"
  | "planned"
  | "transitional"
  | "unavailable";

export type ModuleCapabilityBackingStatus =
  | "backend_backed"
  | "bridge_backed"
  | "model_preview"
  | "transitional_controller"
  | "unavailable";

export type ModuleWorkflowBackingStatus =
  | "implemented"
  | "planned"
  | "unavailable";

export type ModuleUiDependencyPolicy =
  | "none"
  | "render_only"
  | "transitional_controller";

export type ModuleApiPortMetadata = {
  name: string;
  owner: "backend_domain" | "frontend_bridge" | "none";
  path?: string;
  notes?: readonly string[];
};

export type ModuleTauriSurfaceMetadata = {
  commands: readonly string[];
  notes?: readonly string[];
};

export type ModuleActorContextPolicy = {
  defaultActor: "none" | "operator" | "runtime_agent" | "workspace_agent";
  notes?: readonly string[];
  trustedContextFields: readonly string[];
};

export type ModuleConfirmationRequirement = {
  capabilityId?: HobitAgentCapabilityId;
  notes?: readonly string[];
  requirement: HobitAgentConfirmationRequirement;
  tokenField?: string;
  tokenValue?: string;
  workflowId?: string;
};

export type ModuleCapabilityReference<TRiskClass extends string = string> = {
  backingStatus: ModuleCapabilityBackingStatus;
  capabilityId: HobitAgentCapabilityId;
  confirmationRequirement: HobitAgentConfirmationRequirement;
  notes?: readonly string[];
  riskClass: TRiskClass;
  uiDependencyPolicy: ModuleUiDependencyPolicy;
};

export type ModuleWorkflowReference<TRiskClass extends string = string> = {
  backingStatus: ModuleWorkflowBackingStatus;
  confirmationRequirement: HobitAgentConfirmationRequirement;
  notes?: readonly string[];
  riskClasses: readonly TRiskClass[];
  uiDependencyPolicy: ModuleUiDependencyPolicy;
  workflowId: string;
};

export type ModuleControlSurface<TRiskClass extends string = string> = {
  actorContextPolicy: ModuleActorContextPolicy;
  apiPort?: ModuleApiPortMetadata;
  backendBackedCapabilityIds: readonly HobitAgentCapabilityId[];
  backendOwner?: string;
  backingStatus: ModuleControlSurfaceBackingStatus;
  capabilities: readonly ModuleCapabilityReference<TRiskClass>[];
  capabilityIds: readonly HobitAgentCapabilityId[];
  compatibilityNotes: readonly string[];
  confirmationRequirements: readonly ModuleConfirmationRequirement[];
  contractTestRequirements: readonly string[];
  displayName: string;
  moduleId: HobitModuleId;
  riskClasses: readonly TRiskClass[];
  serviceOwner?: string;
  summary: string;
  tauriSurface?: ModuleTauriSurfaceMetadata;
  transitionalCapabilityIds: readonly HobitAgentCapabilityId[];
  uiDependencyPolicy: ModuleUiDependencyPolicy;
  unavailableCapabilityIds: readonly HobitAgentCapabilityId[];
  version: string;
  workflowIds: readonly string[];
  workflows: readonly ModuleWorkflowReference<TRiskClass>[];
};
