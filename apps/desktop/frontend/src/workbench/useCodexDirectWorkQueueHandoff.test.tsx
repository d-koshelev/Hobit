import { useRef, useState } from "react";
import { act } from "react";

import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveLogEntryKind,
  CodexDirectWorkLiveRun,
} from "./CodexDirectWorkLiveLog";
import type { CodexDirectWorkRequestDraft } from "./CodexDirectWorkTypes";
import type { DirectWorkRunHandoff } from "./types";
import {
  flushHookEffects,
  renderHook,
} from "./test-utils/renderHook";
import { useCodexDirectWorkQueueHandoff } from "./useCodexDirectWorkQueueHandoff";

const baseHandoff: DirectWorkRunHandoff = {
  executorWidgetInstanceId: "executor-1",
  id: 1,
  queueItemId: "queue-1",
  repoRoot: "/repo",
  runId: "run-1",
  startedAt: "2026-05-20T10:00:00.000Z",
  taskTitle: "Queue task",
  workbenchId: "workbench-1",
  workspaceId: "workspace-1",
};

type AttachCall = {
  onEvent: (event: DirectWorkStreamEvent) => void;
  runId: string;
  widgetInstanceId: string;
};

type HarnessOptions = {
  disableAttach?: boolean;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
  initialActiveStreamingRunId?: string | null;
  initialIsRunning?: boolean;
  initialLiveRun?: CodexDirectWorkLiveRun | null;
  onAttachToCodexDirectWorkStream?: (
    widgetInstanceId: string,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<{ runId: string; status: string; stopListening: () => void } | null>;
  onGetAgentExecutorRunDetail?: (
    widgetInstanceId: string,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
};

function createHarnessState() {
  return {
    attachCalls: [] as AttachCall[],
    clearedRunStateCount: 0,
    finalStates: [] as Array<{ finalStatus: string; handoff: DirectWorkRunHandoff }>,
    gitReviewRequests: [] as Array<string | null | undefined>,
    localLogs: [] as Array<{
      detail?: string;
      kind: CodexDirectWorkLiveLogEntryKind;
      runId?: string;
      status?: string | null;
      text: string;
      tone: CodexDirectWorkLiveLogEntry["tone"];
    }>,
    recordedEvents: [] as DirectWorkStreamEvent[],
    refreshedHistoryCount: 0,
    stoppedStreamCount: 0,
  };
}

function useQueueHandoffHarness(
  options: HarnessOptions,
  state: ReturnType<typeof createHarnessState>,
) {
  const activeRequestRef = useRef<CodexDirectWorkRequestDraft | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const stopStreamListeningRef = useRef<(() => void) | null>(null);
  const [activeStreamingRunId, setActiveStreamingRunId] = useState<
    string | null
  >(options.initialActiveStreamingRunId ?? null);
  const [isRunning, setIsRunning] = useState(
    options.initialIsRunning ?? false,
  );
  const [isStopRequesting, setIsStopRequesting] = useState(false);
  const [liveRun, setLiveRun] = useState<CodexDirectWorkLiveRun | null>(
    options.initialLiveRun ?? null,
  );
  const [queueRunSource, setQueueRunSource] =
    useState<DirectWorkRunHandoff | null>(null);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runInfoNotice, setRunInfoNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [validationRepositoryRoot, setValidationRepositoryRoot] = useState<
    string | null
  >(null);

  useCodexDirectWorkQueueHandoff({
    activeRequestRef,
    activeStreamingRunId,
    appendLocalLiveLogEntry: (
      kind,
      text,
      tone,
      detail,
      status,
      runId,
    ) => {
      state.localLogs.push({ detail, kind, runId, status, text, tone });
    },
    clearRunState: () => {
      state.clearedRunStateCount += 1;
    },
    directWorkRunHandoff: options.directWorkRunHandoff,
    isRunning,
    liveRun,
    onAttachToCodexDirectWorkStream: options.disableAttach
      ? undefined
      : options.onAttachToCodexDirectWorkStream ??
        ((widgetInstanceId, runId, onEvent) => {
          state.attachCalls.push({ onEvent, runId, widgetInstanceId });
          return Promise.resolve({
            runId,
            status: "running",
            stopListening: () => undefined,
          });
        }),
    onGetAgentExecutorRunDetail: options.onGetAgentExecutorRunDetail,
    onQueueRunFinalState: (handoff, finalStatus) => {
      state.finalStates.push({ finalStatus, handoff });
    },
    recordStreamEvent: (event) => {
      state.recordedEvents.push(event);
    },
    refreshRunHistory: () => {
      state.refreshedHistoryCount += 1;
    },
    requestGitReviewForRepositoryRoot: (repositoryRoot) => {
      state.gitReviewRequests.push(repositoryRoot);
    },
    runStartedAtRef,
    setActiveStreamingRunId,
    setIsRunning,
    setIsStopRequesting,
    setLiveRun,
    setQueueRunSource,
    setRunErrorMessage,
    setRunInfoNotice,
    setValidationRepositoryRoot,
    stopActiveStreamListening: () => {
      state.stoppedStreamCount += 1;
    },
    stopStreamListeningRef,
    widgetInstanceId: "executor-1",
  });

  return {
    activeRequest: activeRequestRef.current,
    activeStreamingRunId,
    isRunning,
    isStopRequesting,
    liveRun,
    queueRunSource,
    runErrorMessage,
    runInfoNotice,
    validationRepositoryRoot,
  };
}

describe("useCodexDirectWorkQueueHandoff", () => {
  let originalSetTimeout: typeof window.setTimeout;
  let originalClearTimeout: typeof window.clearTimeout;

  beforeEach(() => {
    originalSetTimeout = window.setTimeout;
    originalClearTimeout = window.clearTimeout;
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  });

  it("attaches an assigned Queue task to an available Direct Work run", async () => {
    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      { directWorkRunHandoff: baseHandoff },
    );

    await flushHookEffects();

    expect(state.attachCalls).toHaveLength(1);
    expect(state.attachCalls[0].widgetInstanceId).toBe("executor-1");
    expect(state.attachCalls[0].runId).toBe("run-1");
    expect(hook.result.current.isRunning).toBe(true);
    expect(hook.result.current.activeStreamingRunId).toBe("run-1");
    expect(hook.result.current.liveRun?.runId).toBe("run-1");
    expect(hook.result.current.queueRunSource?.queueItemId).toBe("queue-1");
    expect(hook.result.current.activeRequest?.repoRoot).toBe("/repo");
    expect(state.localLogs[0].kind).toBe("queue_handoff_attached");

    hook.unmount();
  });

  it("does not create duplicate handoff state for the same handoff id", async () => {
    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      { directWorkRunHandoff: baseHandoff },
    );

    await flushHookEffects();

    hook.rerender({ directWorkRunHandoff: { ...baseHandoff } });
    await flushHookEffects();

    expect(state.attachCalls).toHaveLength(1);
    expect(state.clearedRunStateCount).toBe(1);

    hook.unmount();
  });

  it("handles missing handoff data and unavailable attachment safely", async () => {
    const missingState = createHarnessState();
    const missingHook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, missingState),
      { directWorkRunHandoff: null },
    );

    await flushHookEffects();

    expect(missingState.attachCalls).toHaveLength(0);
    expect(missingHook.result.current.runErrorMessage).toBeNull();

    missingHook.unmount();

    const unavailableState = createHarnessState();
    const unavailableHook = renderHook(
      (options: HarnessOptions) =>
        useQueueHandoffHarness(options, unavailableState),
      {
        disableAttach: true,
        directWorkRunHandoff: baseHandoff,
      },
    );

    await flushHookEffects();

    expect(unavailableState.attachCalls).toHaveLength(0);
    expect(unavailableHook.result.current.runErrorMessage).toBe(
      "Codex Direct Work stream attachment is unavailable.",
    );

    unavailableHook.unmount();
  });

  it("does not attach a Queue-started run over an active Executor run", async () => {
    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      {
        directWorkRunHandoff: baseHandoff,
        initialActiveStreamingRunId: "other-run",
      },
    );

    await flushHookEffects();

    expect(state.attachCalls).toHaveLength(0);
    expect(hook.result.current.runInfoNotice?.title).toBe(
      "Queue run handoff ignored",
    );

    hook.unmount();
  });

  it("ignores stale stream final events for another run", async () => {
    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      { directWorkRunHandoff: baseHandoff },
    );

    await flushHookEffects();

    act(() => {
      state.attachCalls[0].onEvent({
        ...streamEvent("other-run", "completed", true),
      });
      state.attachCalls[0].onEvent(streamEvent("run-1", "completed", true));
    });

    expect(state.recordedEvents).toHaveLength(2);
    expect(state.finalStates).toHaveLength(1);
    expect(state.finalStates[0].finalStatus).toBe("completed");

    hook.unmount();
  });

  it("recovers a final stored result without duplicating recovery state", async () => {
    let recoveryCallback: TimerHandler | null = null;
    window.setTimeout = ((handler: TimerHandler) => {
      recoveryCallback = handler;
      return 1;
    }) as typeof window.setTimeout;

    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      {
        directWorkRunHandoff: baseHandoff,
        onGetAgentExecutorRunDetail: () =>
          Promise.resolve(runDetail("run-1", "completed")),
      },
    );

    await flushHookEffects();

    await act(async () => {
      if (typeof recoveryCallback === "function") {
        recoveryCallback();
      }
      await Promise.resolve();
    });
    await act(async () => {
      if (typeof recoveryCallback === "function") {
        recoveryCallback();
      }
      await Promise.resolve();
    });

    expect(state.finalStates).toHaveLength(1);
    expect(state.finalStates[0].finalStatus).toBe("completed");
    expect(hook.result.current.liveRun?.status).toBe("completed");
    expect(hook.result.current.isRunning).toBe(false);
    expect(hook.result.current.activeStreamingRunId).toBeNull();
    expect(hook.result.current.validationRepositoryRoot).toBe("/repo");
    expect(state.refreshedHistoryCount).toBe(1);
    expect(state.gitReviewRequests).toEqual(["/repo"]);

    hook.unmount();
  });

  it("does not recover mismatched or non-final stored run detail", async () => {
    let recoveryCallback: TimerHandler | null = null;
    window.setTimeout = ((handler: TimerHandler) => {
      recoveryCallback = handler;
      return 1;
    }) as typeof window.setTimeout;

    const state = createHarnessState();
    const hook = renderHook(
      (options: HarnessOptions) => useQueueHandoffHarness(options, state),
      {
        directWorkRunHandoff: baseHandoff,
        onGetAgentExecutorRunDetail: () =>
          Promise.resolve(runDetail("other-run", "completed")),
      },
    );

    await flushHookEffects();

    await act(async () => {
      if (typeof recoveryCallback === "function") {
        recoveryCallback();
      }
      await Promise.resolve();
    });

    expect(state.finalStates).toHaveLength(0);
    expect(hook.result.current.isRunning).toBe(true);
    expect(hook.result.current.activeStreamingRunId).toBe("run-1");

    hook.unmount();
  });
});

function streamEvent(
  runId: string,
  eventKind: DirectWorkStreamEvent["eventKind"],
  isFinal: boolean,
): DirectWorkStreamEvent {
  return {
    elapsedMs: 100,
    errorMessage: null,
    eventKind,
    exitCode: eventKind === "completed" ? 0 : null,
    failedStage: null,
    finalStatus: null,
    isFinal,
    line: null,
    parsedCodexEventType: null,
    runId,
    status: eventKind,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "executor-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
  };
}

function runDetail(runId: string, status: string): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "done",
    logs: [],
    resultContent: "done",
    resultId: "result-1",
    resultPayload: JSON.stringify({ status }),
    resultStatus: status,
    resultSummary: "done",
    stderrPreview: "",
    stdoutPreview: "",
    summary: {
      commandKind: "codex_direct_work",
      durationMs: 1000,
      finishedAt: "2026-05-20T10:00:01.000Z",
      hasResult: true,
      logCount: 1,
      mode: "direct_work",
      repoRoot: "/repo",
      resultType: "codex_direct_work",
      runId,
      startedAt: "2026-05-20T10:00:00.000Z",
      status,
      title: "Queue task",
      validationProfile: null,
      validationStatus: null,
    },
    validationProfile: null,
    validationStatus: null,
  };
}
