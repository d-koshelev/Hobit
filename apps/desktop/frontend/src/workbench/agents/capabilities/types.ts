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
