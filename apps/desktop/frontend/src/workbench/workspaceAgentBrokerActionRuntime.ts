import {
  createHobitAgentActionBroker,
  type HobitAgentActionBrokerPolicyOptions,
  type HobitAgentActionRequest,
  type HobitAgentBrokerResult,
} from "./agents/broker";
import { createHobitAgentCapabilityRegistry } from "./agents/capabilities";
import {
  createQueueAgentActionHandlers,
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export type WorkspaceAgentHobitActionInvoker = (
  request: HobitAgentActionRequest,
) => Promise<HobitAgentBrokerResult>;

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

export {
  workspaceAgentHobitActionActivityTitle,
  workspaceAgentHobitActionResultMessage,
  workspaceAgentInvalidActionRequestMessage,
  workspaceAgentInvalidWorkflowRequestMessage,
  workspaceAgentWorkflowRequestMessage,
} from "./agentRuntime/agentActivityRecorder";
