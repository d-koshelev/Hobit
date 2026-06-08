import { describe, expect, it, vi } from "vitest";

import type { DirectWorkStreamEvent } from "../../workspace/types";
import type { AgentRunRequest } from "./agentRuntimeTypes";
import {
  CODEX_AGENT_PROVIDER_ID,
  codexProviderCapabilityWarnings,
  createCodexAgentRuntimeAdapter,
  createCodexProviderCapabilities,
  mapAgentRunRequestToCodexDirectWorkRequest,
  mapDirectWorkFinalEventToAgentRunResult,
  mapDirectWorkStreamEventToAgentRunEvent,
} from "./codexProviderAdapter";

describe("codexProviderAdapter", () => {
  it("reports honest Codex Direct Work capabilities", () => {
    const capabilities = createCodexProviderCapabilities({
      supportsCancellation: true,
    });

    expect(capabilities.providerId).toBe(CODEX_AGENT_PROVIDER_ID);
    expect(capabilities.supportedModes).toEqual(["direct"]);
    expect(capabilities.supportsStreaming).toBe(true);
    expect(capabilities.supportsCancellation).toBe(true);
    expect(capabilities.supportsFileChangeSummary).toBe(false);
    expect(capabilities.toolPolicy).toEqual({
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    });
  });

  it("maps AgentRunRequest to the existing Direct Work request shape", () => {
    expect(
      mapAgentRunRequestToCodexDirectWorkRequest(runRequest(), {
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        codexThreadId: "thread-1",
        executionWorkspace: "C:/repo",
        sandbox: "read_only",
        skipGitRepoCheck: false,
        stderrCapBytes: 2000,
        stdoutCapBytes: 1000,
        timeoutMs: 60_000,
        widgetInstanceId: "agent-widget-1",
      }),
    ).toEqual({
      approvalPolicy: "on_request",
      codexExecutable: "codex.cmd",
      codexThreadId: "thread-1",
      operatorPrompt: "Review the visible changes.",
      repoRoot: "C:/repo",
      sandbox: "read_only",
      skipGitRepoCheck: false,
      stderrCapBytes: 2000,
      stdoutCapBytes: 1000,
      timeoutMs: 60_000,
    });
  });

  it("maps lifecycle events and final results", () => {
    const runningEvent = streamEvent({
      eventKind: "stdout_line",
      line: "working",
    });
    const mappedEvent = mapDirectWorkStreamEventToAgentRunEvent(
      runningEvent,
      2,
    );

    expect(mappedEvent).toMatchObject({
      kind: "response_received",
      lifecycle: "running",
      message: "working",
      runId: "run-1",
      sequence: 2,
      title: "Codex stdout",
    });

    const result = mapDirectWorkFinalEventToAgentRunResult({
      finalEvent: streamEvent({
        eventKind: "completed",
        finalStatus: "completed",
        isFinal: true,
        text: "Done.",
      }),
      request: runRequest(),
      tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: ["Changed-file summaries are unavailable."],
    });

    expect(result).toMatchObject({
      assistantText: "Done.",
      fileChanges: [],
      lifecycle: "completed",
      runId: "run-1",
      validationSuggestions: [
        {
          label: "Capability warning",
          reason: "Changed-file summaries are unavailable.",
          status: "skipped",
        },
      ],
    });
    expect(result.metadata.tokenUsage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("surfaces unsupported capability warnings", () => {
    const warnings = codexProviderCapabilityWarnings(
      runRequest({
        mode: "queue",
        toolPolicy: {
          allowedTools: ["shell"],
          mode: "provider-tools",
          requiresOperatorApproval: true,
        },
      }),
      createCodexProviderCapabilities({ supportsCancellation: false }),
    );

    expect(warnings).toEqual([
      "Codex Direct Work supports direct runs only.",
      "Codex Direct Work adapter does not enable Hobit tool calls.",
      "Cancellation is unavailable for this Codex adapter instance.",
      "Changed-file summaries are not reported by this adapter; use explicit Git/Finder review.",
      "Token usage is reported only when Codex emits usage metadata.",
    ]);
  });

  it("does not invent token counts when Codex usage is absent", () => {
    const result = mapDirectWorkFinalEventToAgentRunResult({
      finalEvent: streamEvent({
        eventKind: "completed",
        finalStatus: "completed",
        isFinal: true,
        text: "Done.",
      }),
      request: runRequest(),
    });

    expect(result.metadata.tokenUsage).toBeNull();
  });

  it("starts only through injected Direct Work actions", async () => {
    const observedEvents: unknown[] = [];
    const observedResults: unknown[] = [];
    const startCodexDirectWorkStream = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: DirectWorkStreamEvent) => void,
      ) => {
        onEvent(streamEvent({ eventKind: "started" }));
        onEvent(
          streamEvent({
            eventKind: "codex_json_event",
            line: JSON.stringify({
              type: "usage",
              usage: {
                input_tokens: 11,
                output_tokens: 7,
                total_tokens: 18,
              },
            }),
            parsedCodexEventType: "usage",
          }),
        );
        onEvent(
          streamEvent({
            eventKind: "completed",
            finalStatus: "completed",
            isFinal: true,
            text: "Complete.",
          }),
        );
        return {
          runId: "run-1",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    const adapter = createCodexAgentRuntimeAdapter({
      cancelCodexDirectWorkRun: vi.fn(),
      startCodexDirectWorkStream,
    });

    const handle = await adapter.startRun(
      runRequest(),
      {
        codexExecutable: "codex",
        executionWorkspace: "C:/repo",
        widgetInstanceId: "agent-widget-1",
      },
      (event) => observedEvents.push(event),
      undefined,
      (result) => observedResults.push(result),
    );

    expect(startCodexDirectWorkStream).toHaveBeenCalledTimes(1);
    expect(startCodexDirectWorkStream.mock.calls[0]?.[0]).toBe(
      "agent-widget-1",
    );
    expect(startCodexDirectWorkStream.mock.calls[0]?.[1]).toMatchObject({
      codexExecutable: "codex",
      operatorPrompt: "Review the visible changes.",
      repoRoot: "C:/repo",
    });
    expect(handle.runId).toBe("run-1");
    expect(observedEvents).toHaveLength(3);
    expect(observedResults).toHaveLength(1);
    expect(observedResults[0]).toMatchObject({
      lifecycle: "completed",
      metadata: {
        tokenUsage: {
          inputTokens: 11,
          outputTokens: 7,
          totalTokens: 18,
        },
      },
    });
  });

  it("returns disabled unsupported state when no stream action exists", async () => {
    const adapter = createCodexAgentRuntimeAdapter({});
    const result = await adapter.startRun(
      runRequest(),
      {
        codexExecutable: "codex",
        executionWorkspace: "C:/repo",
        widgetInstanceId: "agent-widget-1",
      },
      vi.fn(),
    );

    expect(result).toMatchObject({
      errorMessage: "Codex Direct Work stream API is unavailable.",
      lifecycle: "blocked",
      metadata: {
        lifecycle: "blocked",
        providerId: CODEX_AGENT_PROVIDER_ID,
        tokenUsage: null,
      },
    });
  });

  it("reports cancel-not-supported without pretending cancellation worked", async () => {
    const adapter = createCodexAgentRuntimeAdapter({});

    await expect(adapter.cancelRun("agent-widget-1", "run-1")).resolves.toEqual(
      {
        supported: false,
        warnings: [
          "Cancellation is unavailable for this Codex adapter instance.",
        ],
      },
    );
  });
});

function runRequest(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    createdAtMs: 1_000,
    id: "request-1",
    mode: "direct",
    prompt: "Review the visible changes.",
    providerId: CODEX_AGENT_PROVIDER_ID,
    sandboxPolicy: {
      filesystem: "approved-workspace",
      network: "provider-runtime-only",
      requiresExplicitWorkspace: true,
    },
    toolPolicy: {
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    },
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 1200,
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
