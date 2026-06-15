import {
  findCapability,
  type HobitAgentCapability,
  type HobitAgentCapabilityRegistry,
} from "../capabilities";
import type { HobitAgentPolicyDecision } from "../capabilities/policy";
import {
  createActionResult,
  createPolicyBlockedActionResult,
  createUnavailableActionResult,
} from "./results";
import type {
  HobitAgentActionBroker,
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionRequestValidation,
  HobitAgentActionResult,
  HobitAgentAuditEvent,
  HobitAgentBrokerResult,
} from "./types";

export type HobitAgentActionBrokerPolicyOptions = {
  allowRestrictedExecuteCapabilities?: boolean;
  requireDryRunBeforeSideEffectingInvoke?: boolean;
};

export type HobitAgentActionBrokerInput = {
  handlers?: HobitAgentActionHandlerMap;
  policy?: HobitAgentActionBrokerPolicyOptions;
  registry: HobitAgentCapabilityRegistry;
};

const DEFAULT_POLICY_OPTIONS: Required<HobitAgentActionBrokerPolicyOptions> = {
  allowRestrictedExecuteCapabilities: false,
  requireDryRunBeforeSideEffectingInvoke: true,
};

export function createHobitAgentActionBroker({
  handlers = {},
  policy,
  registry,
}: HobitAgentActionBrokerInput): HobitAgentActionBroker {
  const policyOptions = {
    ...DEFAULT_POLICY_OPTIONS,
    ...policy,
  };

  return {
    registry,
    invoke<TOutput = unknown>(
      request: HobitAgentActionRequest,
    ): HobitAgentBrokerResult<TOutput> {
      const validationEvents = [
        createBrokerAuditEvent({
          eventName: "capability.validation.started",
          message: `Validating ${request.capabilityId}.`,
          request,
          sideEffectLevel: "read",
        }),
      ];
      const validation = validateActionRequest(request);

      if (!validation.ok) {
        return createBrokerInvalidInputResult({
          auditEvents: [
            ...validationEvents,
            createBrokerAuditEvent({
              eventName: "capability.policy.blocked",
              message: validation.reasons[0] ?? "Action request is invalid.",
              request,
              sideEffectLevel: "read",
            }),
          ],
          reasons: validation.reasons,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      const policyDecision = evaluateBrokerPolicy(
        registry,
        request,
        policyOptions,
      );
      const policyEvent = createBrokerAuditEvent({
        eventName: policyDecision.allowed
          ? "capability.policy.allowed"
          : "capability.policy.blocked",
        message: policyDecision.allowed
          ? `${request.capabilityId} was allowed by broker policy.`
          : policyDecision.reasons[0] ??
            `${request.capabilityId} was blocked by broker policy.`,
        request,
        sideEffectLevel: policyDecision.capability?.sideEffectLevel ?? "read",
      });
      const auditEvents = [...validationEvents, policyEvent];

      if (policyDecision.status === "unavailable") {
        return createBrokerUnavailableResult({
          auditEvents,
          policyDecision,
          reason:
            policyDecision.reasons[0] ??
            `${request.capabilityId} is unavailable.`,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      if (policyDecision.status === "requires_confirmation") {
        return createBrokerNeedsConfirmationResult({
          auditEvents,
          policyDecision,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      if (policyDecision.status === "requires_dry_run") {
        return createBrokerDryRunRequiredResult({
          auditEvents,
          policyDecision,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      if (policyDecision.status === "blocked" || !policyDecision.allowed) {
        return createBrokerPolicyBlockedResult({
          auditEvents,
          policyDecision,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      const handler = handlers[request.capabilityId];
      if (!handler || !policyDecision.capability) {
        return createBrokerUnavailableResult({
          auditEvents: [
            ...auditEvents,
            createBrokerAuditEvent({
              eventName: "capability.invoke.unavailable",
              message: `${request.capabilityId} has no broker handler in this frontend model.`,
              request,
              sideEffectLevel: policyDecision.capability?.sideEffectLevel ?? "read",
            }),
          ],
          policyDecision,
          reason: `${request.capabilityId} is not implemented by this Action Broker MVP.`,
          request,
        }) as HobitAgentBrokerResult<TOutput>;
      }

      try {
        const handlerResult = handler({
          auditEvents,
          capability: policyDecision.capability,
          policyDecision,
          registry,
          request,
        });
        if (isPromiseLike(handlerResult)) {
          const message = `${request.capabilityId} uses an async handler and must be invoked with invokeAsync.`;
          const result = createActionResult({
            auditEvents: [
              createBrokerAuditEvent({
                eventName: "capability.invoke.completed",
                message,
                request,
                sideEffectLevel: policyDecision.capability.sideEffectLevel,
              }),
            ],
            capabilityId: request.capabilityId,
            dryRun: request.dryRun,
            message,
            policyDecision,
            policyReasons: [message],
            requestId: request.requestId,
            status: "failed",
          });

          return {
            policyDecision,
            request,
            result: {
              ...result,
              auditEvents: [...auditEvents, ...result.auditEvents],
            },
            status: "failed",
          } as HobitAgentBrokerResult<TOutput>;
        }

        const result = handlerResult;
        const completedEvent = createBrokerAuditEvent({
          eventName: request.dryRun
            ? "capability.dryRun.completed"
            : "capability.invoke.completed",
          message: result.message,
          request,
          sideEffectLevel: policyDecision.capability.sideEffectLevel,
        });

        return {
          policyDecision,
          request,
          result: {
            ...result,
            auditEvents: [
              ...auditEvents,
              ...result.auditEvents,
              completedEvent,
            ],
            policyDecision,
          } as HobitAgentActionResult<TOutput>,
          status: result.status,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Action handler failed unexpectedly.";
        const result = createActionResult({
          auditEvents: [
            createBrokerAuditEvent({
              eventName: "capability.invoke.completed",
              message,
              request,
              sideEffectLevel: policyDecision.capability.sideEffectLevel,
            }),
          ],
          capabilityId: request.capabilityId,
          dryRun: request.dryRun,
          message,
          policyDecision,
          policyReasons: [message],
          requestId: request.requestId,
          status: "failed",
        });

        return {
          policyDecision,
          request,
          result: {
            ...result,
            auditEvents: [...auditEvents, ...result.auditEvents],
          },
          status: "failed",
        } as HobitAgentBrokerResult<TOutput>;
      }
    },
    invokeAsync<TOutput = unknown>(
      request: HobitAgentActionRequest,
    ): Promise<HobitAgentBrokerResult<TOutput>> {
      return invokeHobitAgentActionBrokerAsync({
        handlers,
        policyOptions,
        registry,
        request,
      });
    },
  };
}

async function invokeHobitAgentActionBrokerAsync<TOutput = unknown>({
  handlers,
  policyOptions,
  registry,
  request,
}: {
  handlers: HobitAgentActionHandlerMap;
  policyOptions: Required<HobitAgentActionBrokerPolicyOptions>;
  registry: HobitAgentCapabilityRegistry;
  request: HobitAgentActionRequest;
}): Promise<HobitAgentBrokerResult<TOutput>> {
  const validationEvents = [
    createBrokerAuditEvent({
      eventName: "capability.validation.started",
      message: `Validating ${request.capabilityId}.`,
      request,
      sideEffectLevel: "read",
    }),
  ];
  const validation = validateActionRequest(request);

  if (!validation.ok) {
    return createBrokerInvalidInputResult({
      auditEvents: [
        ...validationEvents,
        createBrokerAuditEvent({
          eventName: "capability.policy.blocked",
          message: validation.reasons[0] ?? "Action request is invalid.",
          request,
          sideEffectLevel: "read",
        }),
      ],
      reasons: validation.reasons,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  const policyDecision = evaluateBrokerPolicy(
    registry,
    request,
    policyOptions,
  );
  const policyEvent = createBrokerAuditEvent({
    eventName: policyDecision.allowed
      ? "capability.policy.allowed"
      : "capability.policy.blocked",
    message: policyDecision.allowed
      ? `${request.capabilityId} was allowed by broker policy.`
      : policyDecision.reasons[0] ??
        `${request.capabilityId} was blocked by broker policy.`,
    request,
    sideEffectLevel: policyDecision.capability?.sideEffectLevel ?? "read",
  });
  const auditEvents = [...validationEvents, policyEvent];

  if (policyDecision.status === "unavailable") {
    return createBrokerUnavailableResult({
      auditEvents,
      policyDecision,
      reason:
        policyDecision.reasons[0] ??
        `${request.capabilityId} is unavailable.`,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  if (policyDecision.status === "requires_confirmation") {
    return createBrokerNeedsConfirmationResult({
      auditEvents,
      policyDecision,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  if (policyDecision.status === "requires_dry_run") {
    return createBrokerDryRunRequiredResult({
      auditEvents,
      policyDecision,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  if (policyDecision.status === "blocked" || !policyDecision.allowed) {
    return createBrokerPolicyBlockedResult({
      auditEvents,
      policyDecision,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  const handler = handlers[request.capabilityId];
  if (!handler || !policyDecision.capability) {
    return createBrokerUnavailableResult({
      auditEvents: [
        ...auditEvents,
        createBrokerAuditEvent({
          eventName: "capability.invoke.unavailable",
          message: `${request.capabilityId} has no broker handler in this frontend model.`,
          request,
          sideEffectLevel: policyDecision.capability?.sideEffectLevel ?? "read",
        }),
      ],
      policyDecision,
      reason: `${request.capabilityId} is not implemented by this Action Broker MVP.`,
      request,
    }) as HobitAgentBrokerResult<TOutput>;
  }

  try {
    const result = await handler({
      auditEvents,
      capability: policyDecision.capability,
      policyDecision,
      registry,
      request,
    });
    const completedEvent = createBrokerAuditEvent({
      eventName: request.dryRun
        ? "capability.dryRun.completed"
        : "capability.invoke.completed",
      message: result.message,
      request,
      sideEffectLevel: policyDecision.capability.sideEffectLevel,
    });

    return {
      policyDecision,
      request,
      result: {
        ...result,
        auditEvents: [
          ...auditEvents,
          ...result.auditEvents,
          completedEvent,
        ],
        policyDecision,
      } as HobitAgentActionResult<TOutput>,
      status: result.status,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Action handler failed unexpectedly.";
    const result = createActionResult({
      auditEvents: [
        createBrokerAuditEvent({
          eventName: "capability.invoke.completed",
          message,
          request,
          sideEffectLevel: policyDecision.capability.sideEffectLevel,
        }),
      ],
      capabilityId: request.capabilityId,
      dryRun: request.dryRun,
      message,
      policyDecision,
      policyReasons: [message],
      requestId: request.requestId,
      status: "failed",
    });

    return {
      policyDecision,
      request,
      result: {
        ...result,
        auditEvents: [...auditEvents, ...result.auditEvents],
      },
      status: "failed",
    } as HobitAgentBrokerResult<TOutput>;
  }
}

export function validateActionRequest(
  request: Partial<HobitAgentActionRequest>,
): HobitAgentActionRequestValidation {
  const reasons = [
    requiredStringReason(request.requestId, "requestId"),
    requiredStringReason(request.agentId, "agentId"),
    requiredStringReason(request.agentRole ?? request.agentRoleId, "agentRole"),
    requiredStringReason(request.capabilityId, "capabilityId"),
    requiredStringReason(request.createdAt ?? request.requestedAt, "createdAt"),
    typeof request.dryRun === "boolean" ? null : "dryRun must be a boolean.",
    request.input === undefined ? "input is required." : null,
  ].filter((reason): reason is string => Boolean(reason));

  return reasons.length === 0 ? { ok: true, reasons: [] } : { ok: false, reasons };
}

export function evaluateBrokerPolicy(
  registry: HobitAgentCapabilityRegistry,
  request: HobitAgentActionRequest,
  options: HobitAgentActionBrokerPolicyOptions = {},
): HobitAgentPolicyDecision {
  const policyOptions = {
    ...DEFAULT_POLICY_OPTIONS,
    ...options,
  };
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

  const agentRole = request.agentRole ?? request.agentRoleId;
  if (!capability.allowedAgentRoles.includes(agentRole)) {
    return {
      allowed: false,
      capability,
      reasons: [`Role ${agentRole} cannot use ${request.capabilityId}.`],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "blocked",
    };
  }

  if (
    (capability.restricted || capability.sideEffectLevel === "execute") &&
    !policyOptions.allowRestrictedExecuteCapabilities
  ) {
    return {
      allowed: false,
      capability,
      reasons: [
        `${request.capabilityId} is a restricted execute capability and is not a default Hobit app-action path.`,
      ],
      requiresConfirmation: capability.confirmationRequirement === "required",
      requiresDryRun: false,
      status: "blocked",
    };
  }

  if (request.dryRun && !capability.supportsDryRun) {
    return {
      allowed: false,
      capability,
      reasons: [`${request.capabilityId} does not support dry-run.`],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "blocked",
    };
  }

  if (brokerRequiresConfirmation(capability) && !request.confirmationToken) {
    return {
      allowed: false,
      capability,
      reasons: [`${request.capabilityId} requires confirmation.`],
      requiresConfirmation: true,
      requiresDryRun: false,
      status: "requires_confirmation",
    };
  }

  if (
    policyOptions.requireDryRunBeforeSideEffectingInvoke &&
    brokerRequiresDryRunBeforeInvoke(capability) &&
    !request.dryRun
  ) {
    return {
      allowed: false,
      capability,
      reasons: [`${request.capabilityId} requires dry-run before invocation.`],
      requiresConfirmation: false,
      requiresDryRun: true,
      status: "requires_dry_run",
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

export function createBrokerSuccessResult<TOutput = unknown>({
  auditEvents = [],
  message,
  output,
  policyDecision,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  message: string;
  output?: TOutput;
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult<TOutput> {
  const result = createActionResult<TOutput>({
    auditEvents,
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    message,
    output,
    policyDecision,
    requestId: request.requestId,
    status: "succeeded",
  });

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

export function createBrokerUnavailableResult({
  auditEvents = [],
  policyDecision,
  reason,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  policyDecision: HobitAgentPolicyDecision;
  reason: string;
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult {
  const result = {
    ...createUnavailableActionResult({
      capabilityId: request.capabilityId,
      dryRun: request.dryRun,
      policyDecision,
      reason,
      requestId: request.requestId,
    }),
    auditEvents,
  };

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

export function createBrokerPolicyBlockedResult({
  auditEvents = [],
  policyDecision,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult {
  const result = {
    ...createPolicyBlockedActionResult({
      capabilityId: request.capabilityId,
      dryRun: request.dryRun,
      policyDecision,
      reasons: policyDecision.reasons,
      requestId: request.requestId,
    }),
    auditEvents,
  };

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

export function createBrokerNeedsConfirmationResult({
  auditEvents = [],
  policyDecision,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult {
  const result = createActionResult({
    auditEvents,
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    message:
      policyDecision.reasons[0] ??
      `${request.capabilityId} requires confirmation.`,
    policyDecision,
    policyReasons: policyDecision.reasons,
    requestId: request.requestId,
    status: "needs_confirmation",
  });

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

export function createBrokerDryRunRequiredResult({
  auditEvents = [],
  policyDecision,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult {
  const result = createActionResult({
    auditEvents,
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    message:
      policyDecision.reasons[0] ??
      `${request.capabilityId} requires dry-run before invocation.`,
    policyDecision,
    policyReasons: policyDecision.reasons,
    requestId: request.requestId,
    status: "dry_run_required",
  });

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

export function createBrokerInvalidInputResult({
  auditEvents = [],
  reasons,
  request,
}: {
  auditEvents?: HobitAgentAuditEvent[];
  reasons: readonly string[];
  request: HobitAgentActionRequest;
}): HobitAgentBrokerResult {
  const policyDecision: HobitAgentPolicyDecision = {
    allowed: false,
    reasons: [...reasons],
    requiresConfirmation: false,
    requiresDryRun: false,
    status: "blocked",
  };
  const result = createActionResult({
    auditEvents,
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    message: reasons[0] ?? "Action request input is invalid.",
    policyDecision,
    policyReasons: [...reasons],
    requestId: request.requestId,
    status: "invalid_input",
  });

  return {
    policyDecision,
    request,
    result,
    status: result.status,
  };
}

function brokerRequiresConfirmation(capability: HobitAgentCapability): boolean {
  return (
    capability.confirmationRequirement === "required" ||
    capability.sideEffectLevel === "destructive"
  );
}

function brokerRequiresDryRunBeforeInvoke(
  capability: HobitAgentCapability,
): boolean {
  return capability.sideEffectLevel !== "read" && capability.supportsDryRun;
}

function createBrokerAuditEvent({
  eventName,
  message,
  request,
  sideEffectLevel,
}: {
  eventName: string;
  message: string;
  request: HobitAgentActionRequest;
  sideEffectLevel: HobitAgentAuditEvent["sideEffectLevel"];
}): HobitAgentAuditEvent {
  return {
    actorAgentId: request.agentId,
    actorRoleId: request.agentRole ?? request.agentRoleId,
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    eventName,
    message,
    requestId: request.requestId,
    sideEffectLevel,
    timestamp: request.createdAt,
  };
}

function requiredStringReason(value: unknown, fieldName: string): string | null {
  return typeof value === "string" && value.trim()
    ? null
    : `${fieldName} is required.`;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
