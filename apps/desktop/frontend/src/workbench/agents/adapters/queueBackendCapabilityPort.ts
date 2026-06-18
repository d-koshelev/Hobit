import type {
  AckAgentQueueReviewMessageRequest,
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  CreateAgentQueueReviewMessageRequest,
  GetAgentQueueItemAggregateRequest,
  GetAgentQueueWorkerEvidenceBundleRequest,
  RecordAgentQueueWorkerFinishedRequest,
} from "../../../workspace/types";

export type QueueBackendCapabilityPort = {
  ackReviewMessage: (
    request: Omit<AckAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCommandResult>;
  createReviewMessage: (
    request: Omit<CreateAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCreateMessageResult>;
  getItemAggregate: (
    request: Omit<GetAgentQueueItemAggregateRequest, "workspaceId">,
  ) => Promise<AgentQueueItemAggregate | null>;
  getWorkerEvidenceBundle: (
    request: Omit<GetAgentQueueWorkerEvidenceBundleRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerEvidenceQueryResult>;
  listItemAggregates: () => Promise<AgentQueueItemAggregate[]>;
  recordWorkerFinished: (
    request: Omit<RecordAgentQueueWorkerFinishedRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerFinishedCommandResult>;
};

export function createQueueBackendCapabilityPort(
  candidate: Partial<QueueBackendCapabilityPort> | null | undefined,
): QueueBackendCapabilityPort | null {
  if (!candidate) {
    return null;
  }

  if (
    typeof candidate.ackReviewMessage !== "function" &&
    typeof candidate.createReviewMessage !== "function" &&
    typeof candidate.getItemAggregate !== "function" &&
    typeof candidate.getWorkerEvidenceBundle !== "function" &&
    typeof candidate.listItemAggregates !== "function" &&
    typeof candidate.recordWorkerFinished !== "function"
  ) {
    return null;
  }

  return {
    ackReviewMessage: (request) =>
      candidate.ackReviewMessage
        ? candidate.ackReviewMessage(request)
        : unavailable("Queue review command API is unavailable."),
    createReviewMessage: (request) =>
      candidate.createReviewMessage
        ? candidate.createReviewMessage(request)
        : unavailable("Queue review command API is unavailable."),
    getItemAggregate: (request) =>
      candidate.getItemAggregate
        ? candidate.getItemAggregate(request)
        : unavailable("Queue aggregate lifecycle read API is unavailable."),
    getWorkerEvidenceBundle: (request) =>
      candidate.getWorkerEvidenceBundle
        ? candidate.getWorkerEvidenceBundle(request)
        : unavailable("Queue worker evidence read API is unavailable."),
    listItemAggregates: () =>
      candidate.listItemAggregates
        ? candidate.listItemAggregates()
        : unavailable("Queue aggregate list read API is unavailable."),
    recordWorkerFinished: (request) =>
      candidate.recordWorkerFinished
        ? candidate.recordWorkerFinished(request)
        : unavailable("Queue worker evidence command API is unavailable."),
  };
}

function unavailable(message: string): Promise<never> {
  return Promise.reject(new Error(message));
}
