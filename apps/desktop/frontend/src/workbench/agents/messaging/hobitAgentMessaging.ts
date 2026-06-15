import type { HobitAgentId } from "../runtime/hobitMultiAgentRuntime";

export type HobitAgentMessageId = string;

export type HobitAgentMessageKind =
  | "system"
  | "agent"
  | "self_test"
  | "capability_result";

export type HobitAgentMessageDirection = "sent" | "received";

export type HobitAgentMessageStatus =
  | "sent"
  | "received"
  | "delivered"
  | "failed";

export type HobitAgentMessage = {
  body: string;
  correlationId?: string;
  createdAt: string;
  failureReason?: string;
  fromAgentId: HobitAgentId;
  kind: HobitAgentMessageKind;
  messageId: HobitAgentMessageId;
  status: HobitAgentMessageStatus;
  threadId?: string;
  toAgentId: HobitAgentId;
};

export type HobitAgentMessageThread = {
  agentIds: HobitAgentId[];
  createdAt: string;
  messages: HobitAgentMessage[];
  threadId: string;
  updatedAt: string;
};

export type HobitAgentHistoryEvent = {
  agentId: HobitAgentId;
  createdAt: string;
  direction: HobitAgentMessageDirection;
  eventId: string;
  kind: "message";
  message: HobitAgentMessage;
};

export type HobitAgentHistory = {
  agentId: HobitAgentId;
  events: HobitAgentHistoryEvent[];
  maxEvents: number;
};

export type HobitAgentHistoryQuery = {
  agentId: HobitAgentId;
  direction?: HobitAgentMessageDirection;
  kind?: HobitAgentMessageKind;
  limit?: number;
  threadId?: string;
};

export type HobitAgentHistoryResult = {
  agentId: HobitAgentId;
  events: HobitAgentHistoryEvent[];
  limit: number;
  status: "ok";
  totalAvailable: number;
  truncated: boolean;
};

export type HobitAgentMessagingResult =
  | {
      histories: HobitAgentHistory[];
      message: HobitAgentMessage;
      ok: true;
      status: "sent" | "received" | "delivered";
    }
  | {
      error: {
        agentId?: HobitAgentId;
        code: "agent_not_found" | "blocked";
        message: string;
      };
      histories: HobitAgentHistory[];
      message: HobitAgentMessage;
      ok: false;
      status: "failed";
    };

export function createAgentHistory({
  agentId,
  events = [],
  maxEvents = 50,
}: {
  agentId: HobitAgentId;
  events?: readonly HobitAgentHistoryEvent[];
  maxEvents?: number;
}): HobitAgentHistory {
  return {
    agentId,
    events: [...events].slice(-normalizeLimit(maxEvents, 50)),
    maxEvents: normalizeLimit(maxEvents, 50),
  };
}

export function createAgentMessage({
  body,
  correlationId,
  createdAt,
  fromAgentId,
  kind = "agent",
  messageId,
  status = "sent",
  threadId,
  toAgentId,
}: {
  body: string;
  correlationId?: string;
  createdAt: string;
  fromAgentId: HobitAgentId;
  kind?: HobitAgentMessageKind;
  messageId?: HobitAgentMessageId;
  status?: HobitAgentMessageStatus;
  threadId?: string;
  toAgentId: HobitAgentId;
}): HobitAgentMessage {
  return {
    body,
    ...(correlationId ? { correlationId } : {}),
    createdAt,
    fromAgentId,
    kind,
    messageId:
      messageId ??
      `${fromAgentId}:to:${toAgentId}:at:${createdAt}:kind:${kind}`,
    status,
    ...(threadId ? { threadId } : {}),
    toAgentId,
  };
}

export function sendAgentMessage({
  histories,
  maxHistoryEvents,
  message,
  registeredAgentIds,
}: {
  histories: readonly HobitAgentHistory[];
  maxHistoryEvents?: number;
  message: HobitAgentMessage;
  registeredAgentIds: readonly HobitAgentId[];
}): HobitAgentMessagingResult {
  if (!registeredAgentIds.includes(message.toAgentId)) {
    const failed = markMessageFailed(
      message,
      `Agent ${message.toAgentId} is not registered.`,
    );

    return {
      error: {
        agentId: message.toAgentId,
        code: "agent_not_found",
        message: `Agent ${message.toAgentId} is not registered.`,
      },
      histories: appendHistoryForAgent(histories, message.fromAgentId, {
        direction: "sent",
        maxHistoryEvents,
        message: failed,
      }),
      message: failed,
      ok: false,
      status: "failed",
    };
  }

  const sent = { ...message, status: "sent" as const };
  const withSenderHistory = appendHistoryForAgent(histories, sent.fromAgentId, {
    direction: "sent",
    maxHistoryEvents,
    message: sent,
  });
  const withReceiverHistory = appendHistoryForAgent(
    withSenderHistory,
    sent.toAgentId,
    {
      direction: "received",
      maxHistoryEvents,
      message: { ...sent, status: "received" },
    },
  );

  return {
    histories: withReceiverHistory,
    message: sent,
    ok: true,
    status: "sent",
  };
}

export function receiveAgentMessage({
  histories,
  maxHistoryEvents,
  message,
}: {
  histories: readonly HobitAgentHistory[];
  maxHistoryEvents?: number;
  message: HobitAgentMessage;
}): HobitAgentMessagingResult {
  const received = { ...message, status: "received" as const };

  return {
    histories: appendHistoryForAgent(histories, received.toAgentId, {
      direction: "received",
      maxHistoryEvents,
      message: received,
    }),
    message: received,
    ok: true,
    status: "received",
  };
}

export function markMessageDelivered(
  message: HobitAgentMessage,
): HobitAgentMessage {
  return {
    ...message,
    failureReason: undefined,
    status: "delivered",
  };
}

export function markMessageFailed(
  message: HobitAgentMessage,
  failureReason: string,
): HobitAgentMessage {
  return {
    ...message,
    failureReason,
    status: "failed",
  };
}

export function appendAgentHistoryEvent(
  history: HobitAgentHistory,
  event: HobitAgentHistoryEvent,
): HobitAgentHistory {
  return createAgentHistory({
    agentId: history.agentId,
    events: [...history.events, cloneHistoryEvent(event)],
    maxEvents: history.maxEvents,
  });
}

export function getBoundedAgentHistory(
  history: HobitAgentHistory,
  query: HobitAgentHistoryQuery,
): HobitAgentHistoryResult {
  const matchingEvents = history.events.filter((event) => {
    const sameAgent = event.agentId === query.agentId;
    const sameDirection = query.direction
      ? event.direction === query.direction
      : true;
    const sameKind = query.kind ? event.message.kind === query.kind : true;
    const sameThread = query.threadId
      ? event.message.threadId === query.threadId
      : true;

    return sameAgent && sameDirection && sameKind && sameThread;
  });

  return createAgentHistoryResult({
    agentId: query.agentId,
    events: matchingEvents,
    limit: query.limit ?? history.maxEvents,
  });
}

export function createAgentHistoryResult({
  agentId,
  events,
  limit = 50,
}: {
  agentId: HobitAgentId;
  events: readonly HobitAgentHistoryEvent[];
  limit?: number;
}): HobitAgentHistoryResult {
  const boundedLimit = normalizeLimit(limit, 50);
  const totalAvailable = events.length;
  const boundedEvents = [...events].slice(-boundedLimit).map(cloneHistoryEvent);

  return {
    agentId,
    events: boundedEvents,
    limit: boundedLimit,
    status: "ok",
    totalAvailable,
    truncated: totalAvailable > boundedEvents.length,
  };
}

function appendHistoryForAgent(
  histories: readonly HobitAgentHistory[],
  agentId: HobitAgentId,
  {
    direction,
    maxHistoryEvents,
    message,
  }: {
    direction: HobitAgentMessageDirection;
    maxHistoryEvents?: number;
    message: HobitAgentMessage;
  },
): HobitAgentHistory[] {
  const existing =
    histories.find((candidate) => candidate.agentId === agentId) ??
    createAgentHistory({
      agentId,
      maxEvents: maxHistoryEvents,
    });
  const history = appendAgentHistoryEvent(existing, {
    agentId,
    createdAt: message.createdAt,
    direction,
    eventId: `${agentId}:${direction}:${message.messageId}`,
    kind: "message",
    message,
  });
  const others = histories.filter((candidate) => candidate.agentId !== agentId);

  return [...others, history].sort((left, right) =>
    left.agentId.localeCompare(right.agentId),
  );
}

function cloneHistoryEvent(
  event: HobitAgentHistoryEvent,
): HobitAgentHistoryEvent {
  return {
    ...event,
    message: { ...event.message },
  };
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}
