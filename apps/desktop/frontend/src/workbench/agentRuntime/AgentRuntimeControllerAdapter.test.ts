import adapterSource from "./agentRuntimeControllerAdapter.ts?raw";

import { describe, expect, it } from "vitest";

import type { DirectWorkStreamEvent } from "../../workspace/types";
import {
  buildWorkspaceAgentRuntimeTurnInput,
  createFakeAgentProvider,
  directWorkStreamEventFromAgentRuntimeEvent,
  fakeAgentProviderScriptForScenario,
  resolveAgentRuntimeProtocolOutcome,
  type AgentProviderEvent,
  type AgentRuntimeEvent,
} from ".";

describe("AgentRuntime controller adapter", () => {
  it("builds provider turn input without the React controller owning DTO wiring", () => {
    const signal = new AbortController().signal;
    const provider = createFakeAgentProvider({
      providerDisplayName: "Fake Agent Provider",
      providerId: "fake-provider",
      script: fakeAgentProviderScriptForScenario("final_answer"),
    });

    const built = buildWorkspaceAgentRuntimeTurnInput({
      attachCapabilityContext: true,
      brokerContinuationActive: true,
      currentWorkspaceRoot: "C:/workspace",
      directWorkSandbox: "workspace_write",
      instanceId: "agent-widget-1",
      isBrokerContinuationTurn: false,
      operatorPrompt: "Run Queue smoke.",
      provider,
      providerThreadId: "thread-1",
      repoRoot: "C:/repo",
      requestCreatedAtMs: 1_000,
      requestId: "turn-1",
      signal,
      workspaceScopeId: "workspace-1",
    });

    expect(built.threadStartText).toBe(
      "Continuing Fake Agent Provider thread thread-1.",
    );
    expect(built.startSummaryLabel).toBe("Starting agent turn");
    expect(built.contextLogText).toBe(
      "Hobit capability context attached. Capability manifest attached. Knowledge is not searched automatically; only visible composer text plus capability instructions are sent.",
    );
    expect(built.runtimeInput).toMatchObject({
      provider,
      protocol: { mode: "typed_capability_action" },
      request: {
        approvalPolicy: "never",
        createdAtMs: 1_000,
        id: "turn-1",
        mode: "direct",
        providerThreadId: "thread-1",
        sandbox: "workspace_write",
        widgetInstanceId: "agent-widget-1",
        workingDirectory: "C:/repo",
        workspaceId: "workspace-1",
      },
    });
    expect(built.runtimeInput.providerOptions?.signal).toBe(signal);
    expect(built.runtimeInput.request.prompt).toContain("Run Queue smoke.");
    expect(built.runtimeInput.request.prompt).toContain("hobit.action.request");
  });

  it("builds continuation turns without reattaching capability context", () => {
    const provider = createFakeAgentProvider({
      script: fakeAgentProviderScriptForScenario("final_answer"),
    });

    const built = buildWorkspaceAgentRuntimeTurnInput({
      attachCapabilityContext: false,
      brokerContinuationActive: true,
      directWorkSandbox: "read_only",
      instanceId: "agent-widget-1",
      isBrokerContinuationTurn: true,
      operatorPrompt: "[Hobit broker continuation]",
      provider,
      providerThreadId: "thread-1",
      repoRoot: "C:/repo",
      requestCreatedAtMs: 1_000,
      requestId: "turn-continuation",
      workspaceScopeId: "workspace-1",
    });

    expect(built.startSummaryLabel).toBe("Continuing broker action chain");
    expect(built.contextLogText).toBe(
      "Compact Hobit action result context attached for same-thread continuation. No manual user turn was added.",
    );
    expect(built.runtimeInput.request.prompt).toBe(
      "[Hobit broker continuation]",
    );
    expect(built.runtimeInput.request.sandbox).toBe("read_only");
  });

  it("passes through raw Codex Direct Work events for default compatibility", () => {
    const rawEvent = streamEvent({ eventKind: "started" });
    const mapped = directWorkStreamEventFromAgentRuntimeEvent(
      runtimeProviderEvent({
        providerEvent: {
          ...providerEventBase(),
          rawDirectWorkEvent: rawEvent,
          type: "run_started",
        },
      }),
      fallback(),
    );

    expect(mapped).toBe(rawEvent);
  });

  it("maps provider-neutral events to legacy Direct Work events for current UI state", () => {
    expect(
      directWorkStreamEventFromAgentRuntimeEvent(
        runtimeProviderEvent({
          providerEvent: {
            ...providerEventBase(),
            text: "Fake provider final answer.",
            type: "final_answer",
          },
        }),
        fallback(),
      ),
    ).toMatchObject({
      eventKind: "final_message",
      isFinal: false,
      text: "Fake provider final answer.",
      widgetInstanceId: "agent-widget-1",
      workbenchId: "workspace-agent-provider",
      workspaceId: "workspace-1",
    });

    expect(
      directWorkStreamEventFromAgentRuntimeEvent(
        runtimeProviderEvent({
          providerEvent: {
            ...providerEventBase(),
            elapsedMs: 120,
            finalMessage: "Done.",
            status: "completed",
            type: "run_finished",
          },
        }),
        fallback(),
      ),
    ).toMatchObject({
      elapsedMs: 120,
      eventKind: "completed",
      finalStatus: "completed",
      isFinal: true,
      text: "Done.",
    });

    expect(
      directWorkStreamEventFromAgentRuntimeEvent(
        runtimeProviderEvent({
          providerEvent: {
            ...providerEventBase(),
            message: "Fake provider stopped.",
            type: "stopped",
          },
        }),
        fallback(),
      ),
    ).toMatchObject({
      eventKind: "cancelled",
      finalStatus: "cancelled",
      isFinal: true,
      status: "cancelled",
      text: "Fake provider stopped.",
    });
  });

  it("uses runtime protocol output first and falls back through AgentProtocolRuntime", () => {
    const runtimeOutcome = resolveAgentRuntimeProtocolOutcome({
      fallbackMode: "typed_capability_action",
      fallbackText: "Awaiting queue result.",
      runtimeProtocolOutcome: {
        errors: [],
        finalAnswer: "Runtime final answer.",
        kind: "final_answer",
        rawPreview: "Runtime final answer.",
      },
    });
    expect(runtimeOutcome).toMatchObject({
      finalAnswer: "Runtime final answer.",
      kind: "final_answer",
    });

    const fallbackOutcome = resolveAgentRuntimeProtocolOutcome({
      fallbackMode: "typed_capability_action",
      fallbackText: JSON.stringify({
        capabilityId: "queue.items.list",
        dryRun: false,
        input: { limit: 10 },
        requestId: "request-list",
        type: "hobit.action.request",
      }),
      runtimeProtocolOutcome: null,
    });
    expect(fallbackOutcome).toMatchObject({
      actionRequest: { capabilityId: "queue.items.list" },
      kind: "action_request",
    });
  });

  it("stays independent from React, Queue UI, visual shell, broker execution, backend calls, and workers", () => {
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
      "WorkspaceAgentQueueBridge",
      "WorkerProvider",
      "createCodexWorkerProvider",
      "runAutonomousQueue",
      "startQueueLinkedRun",
    ];

    for (const fragment of forbiddenFragments) {
      expect(adapterSource).not.toContain(fragment);
    }
  });
});

function runtimeProviderEvent({
  providerEvent,
}: {
  providerEvent: AgentProviderEvent;
}): Extract<AgentRuntimeEvent, { type: "provider_event" }> {
  return {
    providerEvent,
    providerId: providerEvent.providerId,
    providerThreadId: providerEvent.providerThreadId ?? null,
    requestId: "turn-1",
    runId: providerEvent.runId,
    timestampMs: providerEvent.timestampMs,
    type: "provider_event",
  };
}

function providerEventBase(): Omit<AgentProviderEvent, "type"> {
  return {
    providerId: "fake-provider",
    providerThreadId: "thread-1",
    runId: "run-1",
    sequence: 1,
    timestampMs: 1_000,
  };
}

function fallback() {
  return {
    providerStoppedMessage: "Fake provider stopped.",
    widgetInstanceId: "agent-widget-1",
    workspaceId: "workspace-1",
  };
}

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 100,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-1",
    status: "running",
    stderrPreview: null,
    text: null,
    widgetInstanceId: "agent-widget-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
