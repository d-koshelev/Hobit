import { HOBIT_AGENT_INITIAL_CAPABILITIES } from "./hobitAgentCapabilityManifest";
export { HOBIT_AGENT_INITIAL_CAPABILITIES } from "./hobitAgentCapabilityManifest";

export type HobitAgentRoleId =
  | "workspace_agent"
  | "queue_coordinator"
  | "test_harness";

export type HobitAgentRole = {
  allowedDefaultExecutionPath: "typed_app_capabilities";
  id: HobitAgentRoleId;
  instructions: string[];
  primaryDuty: "product_action_orchestrator";
  title: string;
};

export type HobitAgentWorkspaceContext = {
  queueSingletonKey: "workspace-queue";
  workspaceId: string;
  workspaceName?: string | null;
  workbenchId?: string | null;
};

export type HobitAgentSurfaceContext = {
  surfaceId: "workspace-agent";
  title: "Workspace Agent";
  widgetDefinitionId: "interactive-agent";
  widgetInstanceId?: string | null;
};

export type HobitAgentAppContext = {
  appName: "Hobit";
  capabilityManifest: HobitAgentCapabilityRegistry;
  currentPrompt: string;
  policyConstraints: string[];
  productCenter: "Workbench";
  role: HobitAgentRole;
  surface: HobitAgentSurfaceContext;
  workspace: HobitAgentWorkspaceContext;
};

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

export type HobitAgentActionStatus =
  | "succeeded"
  | "failed"
  | "unavailable"
  | "policy_blocked"
  | "needs_confirmation"
  | "dry_run_required";

export type HobitAgentActionRequest = {
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  requestId: string;
  requestedAt?: string | null;
};

export type HobitAgentAuditEvent = {
  actorRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  eventName: string;
  message: string;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  timestamp?: string | null;
};

export type HobitAgentActionResult<TOutput = unknown> = {
  auditEvents: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  message: string;
  ok: boolean;
  output?: TOutput;
  policyReasons: string[];
  status: HobitAgentActionStatus;
  unavailableReason?: string;
};

export type HobitAgentPolicyDecision = {
  allowed: boolean;
  capability?: HobitAgentCapability;
  reasons: string[];
  requiresConfirmation: boolean;
  requiresDryRun: boolean;
  status:
    | "allowed"
    | "unavailable"
    | "blocked"
    | "requires_confirmation"
    | "requires_dry_run";
};

export type HobitAgentBrokerResult<TOutput = unknown> = {
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult<TOutput>;
};

export const HOBIT_WORKSPACE_AGENT_ROLE: HobitAgentRole = {
  allowedDefaultExecutionPath: "typed_app_capabilities",
  id: "workspace_agent",
  instructions: [
    "Operate Hobit through typed app capabilities before Codex or shell.",
    "Treat Workspace Agent as a product-action orchestrator first.",
    "Do not inspect source files to discover product actions.",
  ],
  primaryDuty: "product_action_orchestrator",
  title: "Workspace Agent",
};


export function createDefaultHobitAgentAppContext({
  capabilityRegistry = createHobitAgentCapabilityRegistry(),
  currentPrompt = "",
  role = HOBIT_WORKSPACE_AGENT_ROLE,
  surface,
  workspace,
}: {
  capabilityRegistry?: HobitAgentCapabilityRegistry;
  currentPrompt?: string;
  role?: HobitAgentRole;
  surface?: Partial<HobitAgentSurfaceContext>;
  workspace: Partial<HobitAgentWorkspaceContext> & { workspaceId: string };
}): HobitAgentAppContext {
  return {
    appName: "Hobit",
    capabilityManifest: capabilityRegistry,
    currentPrompt,
    policyConstraints: [
      "App actions before Codex or shell.",
      "Product actions must use typed app capabilities.",
      "Product actions must not inspect source files.",
      "Queue item creation must use Queue capabilities.",
      "Codex and shell are restricted capabilities.",
    ],
    productCenter: "Workbench",
    role,
    surface: {
      surfaceId: "workspace-agent",
      title: "Workspace Agent",
      widgetDefinitionId: "interactive-agent",
      widgetInstanceId: surface?.widgetInstanceId ?? null,
    },
    workspace: {
      queueSingletonKey: "workspace-queue",
      workbenchId: workspace.workbenchId ?? null,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName ?? null,
    },
  };
}

export function createWorkspaceAgentAppContext(
  input: Parameters<typeof createDefaultHobitAgentAppContext>[0],
): HobitAgentAppContext {
  return createDefaultHobitAgentAppContext({
    ...input,
    role: HOBIT_WORKSPACE_AGENT_ROLE,
  });
}

export function createCapabilityInstructionBlock(
  context: HobitAgentAppContext,
): string {
  const availableCapabilities = listAvailableCapabilities(
    context.capabilityManifest,
    context.role.id,
  );
  const lines = [
    `You are inside ${context.appName}, an AI Workbench.`,
    `Role: ${context.role.title}. Primary duty: product-action orchestrator first.`,
    "Use typed Hobit app capabilities before Codex or shell.",
    "Product actions must not inspect source files to discover or mutate product state.",
    "Queue item creation should use queue.createItem, queue.createItems, queue.preparePromptPackPreview, or queue.importPromptPack.",
    "Codex and shell are restricted capabilities and are not default app-action paths.",
    "Available capabilities:",
    ...availableCapabilities.map(
      (capability) =>
        `- ${capability.id}: ${capability.title}; sideEffect=${capability.sideEffectLevel}; confirmation=${capability.confirmationRequirement}; dryRun=${String(capability.supportsDryRun)}`,
    ),
  ];

  return lines.join("\n");
}

export function createHobitAgentCapabilityRegistry(
  capabilities: readonly HobitAgentCapability[] = HOBIT_AGENT_INITIAL_CAPABILITIES,
): HobitAgentCapabilityRegistry {
  return {
    capabilities: [...capabilities].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    version: "hobit-agent-capability-runtime.v0",
  };
}

export function listAvailableCapabilities(
  registry: HobitAgentCapabilityRegistry,
  roleId?: HobitAgentRoleId,
): HobitAgentCapability[] {
  return registry.capabilities.filter(
    (capability) =>
      capability.availability.status === "available" &&
      (!roleId || capability.allowedAgentRoles.includes(roleId)),
  );
}

export function findCapability(
  registry: HobitAgentCapabilityRegistry,
  capabilityId: HobitAgentCapabilityId,
): HobitAgentCapability | null {
  return (
    registry.capabilities.find((capability) => capability.id === capabilityId) ??
    null
  );
}

export function listSelfTestCapabilities(
  registry: HobitAgentCapabilityRegistry,
  roleId?: HobitAgentRoleId,
): HobitAgentCapability[] {
  return listAvailableCapabilities(registry, roleId).filter(
    (capability) => capability.supportsSelfTest,
  );
}

export function canAgentUseCapability(
  role: HobitAgentRole | HobitAgentRoleId,
  capability: HobitAgentCapability,
): boolean {
  const roleId = typeof role === "string" ? role : role.id;
  return (
    capability.availability.status === "available" &&
    capability.allowedAgentRoles.includes(roleId)
  );
}

export function evaluateCapabilityPolicy(
  registry: HobitAgentCapabilityRegistry,
  request: HobitAgentActionRequest,
): HobitAgentPolicyDecision {
  const capability = findCapability(registry, request.capabilityId);
  if (!capability) {
    return {
      allowed: false,
      reasons: [`Capability ${request.capabilityId} is not registered.`],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "unavailable",
    };
  }

  if (capability.availability.status === "unavailable") {
    return {
      allowed: false,
      capability,
      reasons: [capability.availability.reason],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "unavailable",
    };
  }

  if (!capability.allowedAgentRoles.includes(request.agentRoleId)) {
    return {
      allowed: false,
      capability,
      reasons: [
        `Role ${request.agentRoleId} cannot use ${request.capabilityId}.`,
      ],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "blocked",
    };
  }

  if (requiresDryRun(capability) && !request.dryRun && request.reason === "self-test") {
    return {
      allowed: false,
      capability,
      reasons: [
        `Self-test for ${request.capabilityId} requires dry-run or a test sandbox.`,
      ],
      requiresConfirmation: false,
      requiresDryRun: true,
      status: "requires_dry_run",
    };
  }

  if (requiresConfirmation(capability) && !request.confirmationToken) {
    return {
      allowed: false,
      capability,
      reasons: [
        capability.restricted
          ? `${request.capabilityId} is restricted and requires explicit confirmation.`
          : `${request.capabilityId} requires confirmation.`,
      ],
      requiresConfirmation: true,
      requiresDryRun: false,
      status: "requires_confirmation",
    };
  }

  return {
    allowed: true,
    capability,
    reasons: [],
    requiresConfirmation: false,
    requiresDryRun: false,
    status: "allowed",
  };
}

export function requiresConfirmation(
  capability: HobitAgentCapability,
): boolean {
  return (
    capability.confirmationRequirement === "required" ||
    capability.sideEffectLevel === "destructive"
  );
}

export function requiresDryRun(capability: HobitAgentCapability): boolean {
  return capability.sideEffectLevel !== "read" && capability.supportsDryRun;
}

export function assertCapabilityDoesNotAllowForbiddenSideEffects(
  capability: HobitAgentCapability,
  forbiddenSideEffects: readonly string[],
): true {
  const missing = forbiddenSideEffects.filter(
    (sideEffect) => !capability.forbiddenSideEffects.includes(sideEffect),
  );

  if (missing.length > 0) {
    throw new Error(
      `${capability.id} does not explicitly forbid: ${missing.join(", ")}`,
    );
  }

  return true;
}

export function createActionRequest({
  agentRoleId,
  capabilityId,
  confirmationToken = null,
  dryRun = false,
  input = {},
  reason = null,
  requestedAt = null,
  requestId,
}: {
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input?: unknown;
  reason?: string | null;
  requestedAt?: string | null;
  requestId?: string;
}): HobitAgentActionRequest {
  return {
    agentRoleId,
    capabilityId,
    confirmationToken,
    dryRun,
    input,
    reason,
    requestedAt,
    requestId: requestId ?? `${capabilityId}:request`,
  };
}

export function createActionResult<TOutput = unknown>({
  auditEvents = [],
  capabilityId,
  dryRun = false,
  message,
  output,
  policyReasons = [],
  status = "succeeded",
}: {
  auditEvents?: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  message: string;
  output?: TOutput;
  policyReasons?: string[];
  status?: HobitAgentActionStatus;
}): HobitAgentActionResult<TOutput> {
  return {
    auditEvents,
    capabilityId,
    dryRun,
    message,
    ok: status === "succeeded",
    output,
    policyReasons,
    status,
  };
}

export function createUnavailableActionResult({
  capabilityId,
  message,
  reason,
}: {
  capabilityId: HobitAgentCapabilityId;
  message?: string;
  reason: string;
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun: false,
    message: message ?? reason,
    ok: false,
    policyReasons: [reason],
    status: "unavailable",
    unavailableReason: reason,
  };
}

export function createPolicyBlockedActionResult({
  capabilityId,
  dryRun = false,
  reasons,
}: {
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  reasons: readonly string[];
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun,
    message: reasons[0] ?? "Capability was blocked by policy.",
    ok: false,
    policyReasons: [...reasons],
    status: "policy_blocked",
  };
}
