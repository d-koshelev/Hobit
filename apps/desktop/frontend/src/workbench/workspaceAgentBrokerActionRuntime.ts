import {
  createHobitAgentActionBroker,
  type HobitAgentActionBrokerPolicyOptions,
  type HobitAgentActionHandlerMap,
  type HobitAgentActionRequest,
  type HobitAgentBrokerResult,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "./agents/broker";
import { createHobitAgentCapabilityRegistry } from "./agents/capabilities";
import type {
  HobitAgentCapability,
  HobitAgentCapabilityRegistry,
} from "./agents/capabilities";
import {
  createQueueAgentActionHandlers,
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import {
  createWorkspaceAgentLiveContextActionHandlers,
  type WorkspaceAgentLiveContextSource,
} from "./agents/adapters/workspaceAgentLiveContextCapabilities";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
  type QueueWorkflowPersistencePort,
  type QueueWorkflowRunnerRuntimeResult,
} from "./agents/modules";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export type WorkspaceAgentHobitActionInvoker = (
  request: HobitAgentActionRequest,
) => Promise<HobitAgentBrokerResult>;

export type WorkspaceAgentQueueWorkflowInvoker = (
  workflowRequestRead: Extract<
    HobitAgentWorkflowRequestEnvelopeReadResult,
    { status: "valid" }
  >,
) => Promise<QueueWorkflowRunnerRuntimeResult>;

export function createWorkspaceAgentHobitActionInvoker({
  policy,
  workspaceAgentLiveContext,
  workspaceAgentQueueBridge,
}: {
  policy?: HobitAgentActionBrokerPolicyOptions;
  workspaceAgentLiveContext?: WorkspaceAgentLiveContextSource | null;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
}): WorkspaceAgentHobitActionInvoker {
  const queueAdapter = createWorkspaceAgentQueueBridgeAdapterApi(
    workspaceAgentQueueBridge,
  );
  const handlers = createWorkspaceAgentHobitActionHandlers({
    queueAdapter,
    workspaceAgentLiveContext,
  });
  const broker = createHobitAgentActionBroker({
    handlers,
    policy: {
      requireDryRunBeforeSideEffectingInvoke: false,
      ...policy,
    },
    registry: createWorkspaceAgentBrokerCapabilityRegistry(handlers),
  });

  return (request) => broker.invokeAsync(request);
}

export function createWorkspaceAgentHobitActionHandlers({
  queueAdapter,
  workspaceAgentLiveContext,
}: {
  queueAdapter: ReturnType<typeof createWorkspaceAgentQueueBridgeAdapterApi>;
  workspaceAgentLiveContext?: WorkspaceAgentLiveContextSource | null;
}): HobitAgentActionHandlerMap {
  return {
    ...createQueueAgentActionHandlers(queueAdapter),
    ...createWorkspaceAgentLiveContextActionHandlers(workspaceAgentLiveContext),
  };
}

export function createWorkspaceAgentBrokerCapabilityRegistry(
  handlers: HobitAgentActionHandlerMap,
): HobitAgentCapabilityRegistry {
  const handlerIds = new Set(Object.keys(handlers));
  const registry = createHobitAgentCapabilityRegistry();

  return {
    ...registry,
    capabilities: registry.capabilities.map((capability) =>
      shouldMarkUnavailableForWorkspaceAgentBroker(capability, handlerIds)
        ? {
            ...capability,
            availability: {
              reason: `${capability.id} is not wired in the Workspace Agent Action Broker surface.`,
              status: "unavailable",
            },
          }
        : capability,
    ),
  };
}

function shouldMarkUnavailableForWorkspaceAgentBroker(
  capability: HobitAgentCapability,
  handlerIds: ReadonlySet<string>,
) {
  return (
    capability.availability.status === "available" &&
    capability.allowedAgentRoles.includes("workspace_agent") &&
    !capability.restricted &&
    !handlerIds.has(capability.id)
  );
}

export function createWorkspaceAgentQueueWorkflowInvoker({
  actorId,
  workflowPersistence,
  workspaceAgentQueueBridge,
  workspaceId,
}: {
  actorId?: string | null;
  workflowPersistence?: QueueWorkflowPersistencePort | null;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
  workspaceId?: string | null;
}): WorkspaceAgentQueueWorkflowInvoker {
  const normalizedActorId = actorId?.trim() || "workspace-agent";

  return (workflowRequestRead) =>
    runQueueWorkflowRunnerRuntimeAdapter({
      actorId: normalizedActorId,
      queueBridge: workspaceAgentQueueBridge,
      workflowPersistence,
      workflowRequestRead,
      workspaceId,
    });
}

export {
  workspaceAgentQueueWorkflowRuntimeResultMessage,
  workspaceAgentHobitActionActivityTitle,
  workspaceAgentHobitActionResultMessage,
  workspaceAgentInvalidActionRequestMessage,
  workspaceAgentInvalidWorkflowRequestMessage,
  workspaceAgentWorkflowRequestMessage,
} from "./agentRuntime/agentActivityRecorder";
