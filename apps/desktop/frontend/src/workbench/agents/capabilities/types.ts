import type { HobitAgentRoleId } from "../context/types";

export type HobitAgentCapabilityId = string;

export type HobitAgentCapabilitySideEffect =
  | "read"
  | "write"
  | "execute"
  | "destructive";

export type HobitAgentConfirmationRequirement =
  | "none"
  | "recommended"
  | "required";

export type HobitAgentCapabilityAvailability =
  | {
      status: "available";
      reason?: never;
    }
  | {
      status: "unavailable";
      reason: string;
    };

export type HobitAgentCapabilityInputSchema = {
  acceptedFields: readonly string[];
  fieldDescriptions: Readonly<Record<string, string>>;
  invalidInputGuidance?: readonly string[];
  requiredFields: readonly string[];
  shape: string;
};

export type HobitAgentCapabilityActionRequestExample = {
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  requestId?: string | null;
  type: "hobit.action.request";
};

export type HobitAgentCapabilityExample = {
  description: string;
  exampleActionRequest: HobitAgentCapabilityActionRequestExample;
  exampleInput: unknown;
};

export type HobitAgentCapability = {
  allowedAgentRoles: HobitAgentRoleId[];
  auditEventNames: string[];
  availability: HobitAgentCapabilityAvailability;
  confirmationRequirement: HobitAgentConfirmationRequirement;
  defaultForProductActions: boolean;
  description: string;
  forbiddenSideEffects: string[];
  id: HobitAgentCapabilityId;
  inputSchemaDescription: string;
  inputSchema?: HobitAgentCapabilityInputSchema;
  examples?: readonly HobitAgentCapabilityExample[];
  outputSchemaDescription: string;
  ownerSurface: string;
  restricted: boolean;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  supportsDryRun: boolean;
  supportsSelfTest: boolean;
  title: string;
};

export type HobitAgentCapabilityRegistry = {
  capabilities: HobitAgentCapability[];
  version: "hobit-agent-capability-runtime.v0";
};
