import { beforeEach, describe, expect, it, vi } from "vitest";

import { RENDER_MEMORY_CAPS } from "../renderMemoryGuards";
import type {
  DirectWorkStreamEvent,
  StartCodexDirectWorkStreamResponse,
} from "../workspace/types";
import {
  startDirectWorkStreamSession,
  type CodexDirectWorkRunRequest,
} from "./directWorkStreamSessions";

const workspaceApiMock = vi.hoisted(() => ({
  listener: null as ((event: DirectWorkStreamEvent) => void) | null,
  startCodexDirectWorkStream: vi.fn(),
  stopListening: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", () => ({
  listenToDirectWorkStreamEvents: vi.fn(
    async (listener: (event: DirectWorkStreamEvent) => void) => {
      workspaceApiMock.listener = listener;
      return workspaceApiMock.stopListening;
    },
  ),
  startCodexDirectWorkStream: workspaceApiMock.startCodexDirectWorkStream,
}));

const baseRequest: CodexDirectWorkRunRequest = {
  approvalPolicy: "never",
  codexExecutable: "codex",
  codexThreadId: null,
  operatorPrompt: "Run task",
  repoRoot: "C:/repo",
  sandbox: "workspace_write",
  skipGitRepoCheck: true,
  stderrCapBytes: null,
  stdoutCapBytes: null,
  timeoutMs: null,
};

describe("startDirectWorkStreamSession", () => {
  beforeEach(() => {
    workspaceApiMock.listener = null;
    workspaceApiMock.startCodexDirectWorkStream.mockReset();
    workspaceApiMock.stopListening.mockReset();
  });

  it("cleans up a pending listener when start is aborted", async () => {
    let resolveStart = (_response: StartCodexDirectWorkStreamResponse) => {
      // Replaced by the deferred promise below.
    };
    workspaceApiMock.startCodexDirectWorkStream.mockReturnValue(
      new Promise<StartCodexDirectWorkStreamResponse>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const controller = new AbortController();

    const sessionPromise = startDirectWorkStreamSession({
      bumpWidgetLogRefreshToken: vi.fn(),
      onEvent: vi.fn(),
      request: baseRequest,
      signal: controller.signal,
      widgetInstanceId: "widget-1",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });

    await Promise.resolve();
    controller.abort();

    expect(workspaceApiMock.stopListening).toHaveBeenCalledTimes(1);

    resolveStart({ runId: "run-1", status: "started" });

    await expect(sessionPromise).resolves.toBeNull();
    expect(workspaceApiMock.stopListening).toHaveBeenCalledTimes(1);
  });

  it("makes returned stopListening idempotent", async () => {
    workspaceApiMock.startCodexDirectWorkStream.mockResolvedValue({
      runId: "run-1",
      status: "started",
    });
    const bumpWidgetLogRefreshToken = vi.fn();

    const session = await startDirectWorkStreamSession({
      bumpWidgetLogRefreshToken,
      onEvent: vi.fn(),
      request: baseRequest,
      widgetInstanceId: "widget-1",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });

    session?.stopListening();
    session?.stopListening();

    expect(workspaceApiMock.stopListening).toHaveBeenCalledTimes(1);
    expect(bumpWidgetLogRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("caps queued matching events before the active run id is known", async () => {
    let resolveStart = (_response: StartCodexDirectWorkStreamResponse) => {
      // Replaced by the deferred promise below.
    };
    workspaceApiMock.startCodexDirectWorkStream.mockReturnValue(
      new Promise<StartCodexDirectWorkStreamResponse>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const onEvent = vi.fn();

    const sessionPromise = startDirectWorkStreamSession({
      bumpWidgetLogRefreshToken: vi.fn(),
      onEvent,
      request: baseRequest,
      widgetInstanceId: "widget-1",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    });

    await Promise.resolve();

    for (let index = 0; index < RENDER_MEMORY_CAPS.eventRows + 10; index += 1) {
      workspaceApiMock.listener?.(
        directWorkEvent({
          line: `event-${index.toString()}`,
          runId: "run-1",
        }),
      );
    }

    resolveStart({ runId: "run-1", status: "started" });
    const session = await sessionPromise;

    expect(session?.runId).toBe("run-1");
    expect(onEvent).toHaveBeenCalledTimes(RENDER_MEMORY_CAPS.eventRows);
    expect(onEvent.mock.calls[0]?.[0].line).toBe("event-10");
  });
});

function directWorkEvent(
  patch: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 0,
    errorMessage: null,
    eventKind: "stdout_line",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "widget-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...patch,
  };
}
