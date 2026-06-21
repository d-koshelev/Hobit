import { describe, expect, it, vi } from "vitest";

import type { DirectWorkStreamEvent } from "../../workspace/types";
import agentProviderSource from "./agentProvider.ts?raw";
import codexProviderAdapterSource from "./codexProviderAdapter.ts?raw";
import fakeAgentProviderSource from "./fakeAgentProvider.ts?raw";
import {
  CODEX_AGENT_PROVIDER_ID,
  createCodexAgentProvider,
  createFakeAgentProvider,
  fakeAgentProviderScriptForScenario,
  mapDirectWorkStreamEventToAgentProviderEvent,
} from ".";
import type { AgentProviderTurnRequest } from "./agentProvider";

describe("AgentProvider", () => {
  it("defines a fake provider that emits a final answer without Codex", async () => {
    const provider = createFakeAgentProvider({
      script: fakeAgentProviderScriptForScenario("final_answer"),
    });
    const events: unknown[] = [];

    const handle = await provider.startTurn(turnRequest(), (event) =>
      events.push(event),
    );

    expect(handle?.providerId).toBe("fake-agent-provider");
    expect(events).toEqual([
      expect.objectContaining({ type: "run_started" }),
      expect.objectContaining({
        text: expect.stringContaining("hobit.final.answer"),
        type: "final_answer",
      }),
      expect.objectContaining({ status: "completed", type: "run_finished" }),
    ]);
  });

  it("defines fake provider scripts for action, workflow, error, and stop states", async () => {
    const scenarios = [
      "valid_action_request",
      "invalid_action_request",
      "valid_workflow_request",
      "invalid_workflow_request",
      "error",
      "cancelled",
      "stopped",
    ] as const;

    for (const scenario of scenarios) {
      const events: unknown[] = [];
      await createFakeAgentProvider({
        providerId: `fake-${scenario}`,
        script: fakeAgentProviderScriptForScenario(scenario),
      }).startTurn(turnRequest({ id: scenario }), (event) => events.push(event));

      expect(events[0]).toMatchObject({ type: "run_started" });
      expect(events.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("wraps Codex Direct Work stream starts as the default provider implementation", async () => {
    const startCodexDirectWorkStream = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(streamEvent({ eventKind: "started" }));
        onEvent(
          streamEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Done.",
          }),
        );
        return {
          runId: "run-1",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    const provider = createCodexAgentProvider({
      codexExecutable: "codex.cmd",
      startCodexDirectWorkStream,
    });
    const events: unknown[] = [];

    const handle = await provider.startTurn(
      turnRequest({ providerThreadId: "thread-1" }),
      (event) => events.push(event),
    );

    expect(provider.providerId).toBe(CODEX_AGENT_PROVIDER_ID);
    expect(provider.providerDisplayName).toBe("Codex Direct Work");
    expect(handle?.runId).toBe("run-1");
    expect(startCodexDirectWorkStream).toHaveBeenCalledWith(
      "widget-1",
      expect.objectContaining({
        codexExecutable: "codex.cmd",
        codexThreadId: "thread-1",
        operatorPrompt: "Review visible context.",
        repoRoot: "C:/repo",
      }),
      expect.any(Function),
      undefined,
    );
    expect(events).toEqual([
      expect.objectContaining({
        rawDirectWorkEvent: expect.objectContaining({ eventKind: "started" }),
        type: "run_started",
      }),
      expect.objectContaining({
        rawDirectWorkEvent: expect.objectContaining({ eventKind: "completed" }),
        status: "completed",
        type: "run_finished",
      }),
    ]);
  });

  it("maps Codex structured output to provider-neutral event types", () => {
    expect(
      mapDirectWorkStreamEventToAgentProviderEvent(
        streamEvent({
          eventKind: "final_message",
          text: JSON.stringify({
            capabilityId: "queue.items.list",
            dryRun: false,
            input: {},
            requestId: "request-1",
            type: "hobit.action.request",
          }),
        }),
        1,
      ),
    ).toMatchObject({
      type: "action_request_detected",
    });

    expect(
      mapDirectWorkStreamEventToAgentProviderEvent(
        streamEvent({
          eventKind: "final_message",
          text: JSON.stringify({
            inputs: {},
            moduleId: "queue",
            requestId: "workflow-1",
            type: "hobit.workflow.request",
            workflowId: "dependency_acceptance_smoke",
          }),
        }),
        2,
      ),
    ).toMatchObject({
      type: "workflow_request_detected",
    });
  });

  it("keeps provider files independent from Queue UI and visual shell modules", () => {
    const sources = [
      agentProviderSource,
      fakeAgentProviderSource,
      codexProviderAdapterSource,
    ];
    const forbiddenFragments = [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "queueV2/",
      "QueueV2",
      "ModuleShell",
      "tokens.css",
      "widget.css",
    ];

    for (const source of sources) {
      for (const fragment of forbiddenFragments) {
        expect(source).not.toContain(fragment);
      }
    }
  });
});

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
    widgetInstanceId: "widget-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
