import agentRuntimeSource from "./agentRuntime.ts?raw";

import { describe, expect, it } from "vitest";

import type { AgentProviderTurnRequest } from "./agentProvider";
import {
  createFakeAgentProvider,
  fakeAgentProviderScriptForScenario,
  startAgentRuntimeTurn,
  type AgentRuntimeEvent,
} from ".";
import type { FakeAgentProviderScenario } from "./fakeAgentProvider";

describe("AgentRuntime", () => {
  it("runs a fake provider final answer turn and emits normalized events", async () => {
    const { events, handle } = await runFakeScenario("final_answer");

    expect(handle?.runId).toBe("fake-run-1:request-1");
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "run_started",
        "provider_event",
        "protocol_output_classified",
        "final_answer",
        "run_finished",
      ]),
    );
    expect(findEvent(events, "final_answer")).toMatchObject({
      finalAnswer: "Fake provider final answer.",
      protocolResult: { kind: "final_answer" },
    });
    expect(handle?.getResult()).toMatchObject({
      finalOutputText: expect.stringContaining("hobit.final.answer"),
      protocolResult: { kind: "final_answer" },
      stopReason: "completed",
    });
  });

  it("classifies fake provider action requests without invoking a broker", async () => {
    const { events, handle } = await runFakeScenario("valid_action_request");

    expect(findEvent(events, "action_request")).toMatchObject({
      protocolResult: {
        actionRequest: { capabilityId: "queue.items.list" },
        kind: "action_request",
      },
    });
    expect(handle?.getResult().protocolResult).toMatchObject({
      kind: "action_request",
    });
  });

  it("classifies fake provider workflow requests without executing workflows", async () => {
    const { events, handle } = await runFakeScenario("valid_workflow_request");

    expect(findEvent(events, "workflow_request")).toMatchObject({
      protocolResult: {
        kind: "workflow_request",
        workflowRequest: {
          moduleId: "queue",
          workflowId: "dependency_acceptance_smoke",
        },
      },
    });
    expect(handle?.getResult().protocolResult).toMatchObject({
      kind: "workflow_request",
    });
  });

  it("classifies invalid provider output as invalid protocol output", async () => {
    const { events, handle } = await runFakeScenario("invalid_action_request");

    expect(findEvent(events, "invalid_protocol_output")).toMatchObject({
      protocolResult: {
        kind: "invalid_action_request",
      },
    });
    expect(handle?.getResult().protocolResult).toMatchObject({
      kind: "invalid_action_request",
    });
  });

  it("surfaces provider error runs without broker execution", async () => {
    const { events, handle } = await runFakeScenario("error");

    expect(findEvent(events, "provider_error")).toMatchObject({
      errorMessage: "Fake provider failed.",
    });
    expect(handle?.getResult()).toMatchObject({
      protocolResult: null,
      stopReason: "provider_error",
    });
  });

  it("surfaces cancellation and stopped terminal events", async () => {
    const cancelled = await runFakeScenario("cancelled");
    const stopped = await runFakeScenario("stopped");

    expect(findEvent(cancelled.events, "cancelled")).toMatchObject({
      message: "Fake provider cancelled.",
    });
    expect(cancelled.handle?.getResult().stopReason).toBe("cancelled");
    expect(findEvent(stopped.events, "stopped")).toMatchObject({
      message: "Fake provider stopped.",
    });
    expect(stopped.handle?.getResult().stopReason).toBe("stopped");
  });

  it("preserves provider run handle metadata and delegates cancellation", async () => {
    const provider = createFakeAgentProvider({
      providerId: "fake-preserve",
      providerThreadId: "thread-preserve",
      runId: "run-preserve",
      script: fakeAgentProviderScriptForScenario("final_answer"),
    });
    const events: AgentRuntimeEvent[] = [];
    const handle = await startAgentRuntimeTurn(
      {
        provider,
        protocol: { mode: "typed_capability_action" },
        request: turnRequest({ id: "turn-preserve" }),
      },
      (event) => events.push(event),
    );

    expect(handle?.providerId).toBe("fake-preserve");
    expect(handle?.providerRunHandle).toMatchObject({
      providerId: "fake-preserve",
      runId: "run-preserve:turn-preserve",
    });
    expect(handle?.getResult()).toMatchObject({
      providerId: "fake-preserve",
      providerThreadId: "thread-preserve",
      requestId: "turn-preserve",
      runId: "run-preserve:turn-preserve",
    });
    await expect(handle?.cancel()).resolves.toMatchObject({
      providerId: "fake-preserve",
      runId: "run-preserve:turn-preserve",
      status: "requested",
    });
    expect(events[0]).toMatchObject({
      providerId: "fake-preserve",
      providerThreadId: "thread-preserve",
      requestId: "turn-preserve",
    });
  });

  it("stays independent from React, Queue UI, visual shell, broker execution, and backend calls", () => {
    const forbiddenFragments = [
      "react",
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "widgetV2/queueV2",
      "queue/details",
      "ModuleShell",
      "tokens.css",
      "widget.css",
      "workspaceAgentBrokerActionRuntime",
      "createHobitAgentActionBroker",
      "invokeAsync",
      "@tauri-apps",
      "DirectWorkStream",
      "createCodexAgentProvider",
      "createCodexWorkerProvider",
    ];

    for (const fragment of forbiddenFragments) {
      expect(agentRuntimeSource).not.toContain(fragment);
    }
  });
});

async function runFakeScenario(scenario: FakeAgentProviderScenario) {
  const events: AgentRuntimeEvent[] = [];
  const handle = await startAgentRuntimeTurn(
    {
      provider: createFakeAgentProvider({
        script: fakeAgentProviderScriptForScenario(scenario),
      }),
      protocol: { mode: "typed_capability_action" },
      request: turnRequest(),
    },
    (event) => events.push(event),
  );

  return { events, handle };
}

function findEvent<TType extends AgentRuntimeEvent["type"]>(
  events: readonly AgentRuntimeEvent[],
  type: TType,
): Extract<AgentRuntimeEvent, { type: TType }> {
  const event = events.find(
    (candidate): candidate is Extract<AgentRuntimeEvent, { type: TType }> =>
      candidate.type === type,
  );
  if (!event) {
    throw new Error(`Expected AgentRuntime event ${type}.`);
  }
  return event;
}

function turnRequest(
  overrides: Partial<AgentProviderTurnRequest> = {},
): AgentProviderTurnRequest {
  return {
    approvalPolicy: "never",
    createdAtMs: 1_000,
    id: "request-1",
    mode: "direct",
    prompt: "Review visible context.",
    providerThreadId: null,
    sandbox: "workspace_write",
    widgetInstanceId: "widget-1",
    workingDirectory: "C:/repo",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
