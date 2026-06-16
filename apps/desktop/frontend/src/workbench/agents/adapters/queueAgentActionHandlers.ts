import type { HobitAgentActionHandlerMap } from "../broker/types";
import type { QueueAgentAdapterApi } from "./queueAgentCapabilityTypes";
import { createQueueAgentActionHandlers as createQueueBaseActionHandlers } from "./queueAgentCapabilities";
import { createQueueAgentDogfoodLifecycleActionHandlers } from "./queueAgentDogfoodLifecycleCapabilities";

export function createQueueAgentActionHandlers(
  adapterApi: QueueAgentAdapterApi,
): HobitAgentActionHandlerMap {
  return {
    ...createQueueBaseActionHandlers(adapterApi),
    ...createQueueAgentDogfoodLifecycleActionHandlers(adapterApi),
  };
}
