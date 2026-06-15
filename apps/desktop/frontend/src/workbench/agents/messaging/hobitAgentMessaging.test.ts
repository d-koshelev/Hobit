import { describe, expect, it } from "vitest";

import {
  createAgentHistory,
  createAgentHistoryResult,
  createAgentMessage,
  getBoundedAgentHistory,
  markMessageDelivered,
  markMessageFailed,
  receiveAgentMessage,
  sendAgentMessage,
  type HobitAgentHistory,
} from "./hobitAgentMessaging";

describe("hobitAgentMessaging", () => {
  it("lets Agent A send a typed message to Agent B", () => {
    const histories = initialHistories();
    const message = createAgentMessage({
      body: "Inspect your status.",
      correlationId: "correlation-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      threadId: "thread-1",
      toAgentId: "test.agentB",
    });
    const result = sendAgentMessage({
      histories,
      message,
      registeredAgentIds: ["test.agentA", "test.agentB"],
    });

    expect(result.ok).toBe(true);
    expect(result.message).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      status: "sent",
      toAgentId: "test.agentB",
    });

    const agentBHistory = requiredHistory(result.histories, "test.agentB");
    expect(agentBHistory.events).toHaveLength(1);
    expect(agentBHistory.events[0]?.direction).toBe("received");
    expect(agentBHistory.events[0]?.message.body).toBe("Inspect your status.");
  });

  it("lets Agent B reply to Agent A", () => {
    const sentToB = sendAgentMessage({
      histories: initialHistories(),
      message: createAgentMessage({
        body: "Ping",
        createdAt: "2026-01-01T00:00:00.000Z",
        fromAgentId: "test.agentA",
        messageId: "message-1",
        threadId: "thread-1",
        toAgentId: "test.agentB",
      }),
      registeredAgentIds: ["test.agentA", "test.agentB"],
    });
    const reply = sendAgentMessage({
      histories: sentToB.histories,
      message: createAgentMessage({
        body: "Status is idle.",
        createdAt: "2026-01-01T00:00:01.000Z",
        fromAgentId: "test.agentB",
        messageId: "message-2",
        threadId: "thread-1",
        toAgentId: "test.agentA",
      }),
      registeredAgentIds: ["test.agentA", "test.agentB"],
    });

    expect(reply.ok).toBe(true);
    const agentAHistory = requiredHistory(reply.histories, "test.agentA");
    expect(agentAHistory.events.map((event) => event.direction)).toEqual([
      "sent",
      "received",
    ]);
    expect(agentAHistory.events[1]?.message.body).toBe("Status is idle.");
  });

  it("marks messages delivered or failed without mutating the original", () => {
    const message = createAgentMessage({
      body: "Deliver me.",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      toAgentId: "test.agentB",
    });
    const delivered = markMessageDelivered(message);
    const failed = markMessageFailed(message, "receiver blocked");

    expect(message.status).toBe("sent");
    expect(delivered.status).toBe("delivered");
    expect(failed).toMatchObject({
      failureReason: "receiver blocked",
      status: "failed",
    });
  });

  it("records an explicit receive event", () => {
    const message = createAgentMessage({
      body: "Received through internal API.",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      toAgentId: "test.agentB",
    });
    const result = receiveAgentMessage({
      histories: initialHistories(),
      message,
    });

    expect(result.ok).toBe(true);
    expect(requiredHistory(result.histories, "test.agentB").events[0]).toMatchObject({
      direction: "received",
      message: {
        fromAgentId: "test.agentA",
        status: "received",
        toAgentId: "test.agentB",
      },
    });
  });

  it("returns a structured failure for a missing receiver", () => {
    const result = sendAgentMessage({
      histories: initialHistories(),
      message: createAgentMessage({
        body: "Missing target.",
        createdAt: "2026-01-01T00:00:00.000Z",
        fromAgentId: "test.agentA",
        messageId: "message-1",
        toAgentId: "test.missing",
      }),
      registeredAgentIds: ["test.agentA", "test.agentB"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        agentId: "test.missing",
        code: "agent_not_found",
        message: "Agent test.missing is not registered.",
      });
    }
    expect(result.message.status).toBe("failed");
    expect(requiredHistory(result.histories, "test.agentA").events[0]).toMatchObject({
      direction: "sent",
      message: {
        failureReason: "Agent test.missing is not registered.",
        status: "failed",
      },
    });
    expect(requiredHistory(result.histories, "test.agentB").events).toHaveLength(0);
  });

  it("bounds history query results deterministically", () => {
    const history = ["message-1", "message-2", "message-3"].reduce(
      (current, messageId) => {
        const sent = sendAgentMessage({
          histories: [current],
          message: createAgentMessage({
            body: messageId,
            createdAt: `2026-01-01T00:00:${messageId.slice(-1)}.000Z`,
            fromAgentId: "test.agentA",
            messageId,
            toAgentId: "test.agentB",
          }),
          registeredAgentIds: ["test.agentA", "test.agentB"],
        });

        return requiredHistory(sent.histories, "test.agentA");
      },
      createAgentHistory({ agentId: "test.agentA", maxEvents: 2 }),
    );

    expect(history.events.map((event) => event.message.messageId)).toEqual([
      "message-2",
      "message-3",
    ]);
    expect(
      getBoundedAgentHistory(history, {
        agentId: "test.agentA",
        limit: 1,
      }).events.map((event) => event.message.messageId),
    ).toEqual(["message-3"]);
    expect(
      createAgentHistoryResult({
        agentId: "test.agentA",
        events: history.events,
        limit: 1,
      }),
    ).toMatchObject({
      limit: 1,
      totalAvailable: 2,
      truncated: true,
    });
  });

  it("does not require or represent shell or Codex for agent messages", () => {
    const message = createAgentMessage({
      body: "Plain internal message.",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromAgentId: "test.agentA",
      messageId: "message-1",
      toAgentId: "test.agentB",
    });
    const serialized = JSON.stringify(message).toLowerCase();

    expect(serialized).not.toContain("codex");
    expect(serialized).not.toContain("shell");
    expect(serialized).not.toContain("terminal");
  });
});

function initialHistories(): HobitAgentHistory[] {
  return [
    createAgentHistory({ agentId: "test.agentA", maxEvents: 10 }),
    createAgentHistory({ agentId: "test.agentB", maxEvents: 10 }),
  ];
}

function requiredHistory(
  histories: readonly HobitAgentHistory[],
  agentId: string,
) {
  const history = histories.find((candidate) => candidate.agentId === agentId);
  if (!history) {
    throw new Error(`Missing history for ${agentId}`);
  }

  return history;
}
