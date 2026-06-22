import {
  createHobitAgentActionBroker,
  type HobitAgentActionBrokerPolicyOptions,
  type HobitAgentActionRequest,
  type HobitAgentBrokerResult,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "./agents/broker";
import { createHobitAgentCapabilityRegistry } from "./agents/capabilities";
import {
  createQueueAgentActionHandlers,
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
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
  workspaceAgentQueueBridge,
}: {
  policy?: HobitAgentActionBrokerPolicyOptions;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
}): WorkspaceAgentHobitActionInvoker {
  const queueAdapter = createWorkspaceAgentQueueBridgeAdapterApi(
    workspaceAgentQueueBridge,
  );
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(queueAdapter),
    policy: {
      requireDryRunBeforeSideEffectingInvoke: false,
      ...policy,
    },
    registry: createHobitAgentCapabilityRegistry(),
  });

  return (request) => broker.invokeAsync(request);
}

export function createWorkspaceAgentQueueWorkflowInvoker({
  actorId,
  workspaceAgentQueueBridge,
}: {
  actorId?: string | null;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
}): WorkspaceAgentQueueWorkflowInvoker {
  const normalizedActorId = actorId?.trim() || "workspace-agent";

  return (workflowRequestRead) =>
    runQueueWorkflowRunnerRuntimeAdapter({
      actorId: normalizedActorId,
      queueBridge: workspaceAgentQueueBridge,
      workflowRequestRead,
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
