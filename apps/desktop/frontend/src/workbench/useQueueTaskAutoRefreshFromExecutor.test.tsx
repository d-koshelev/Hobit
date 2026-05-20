import { renderHook, flushHookEffects } from "./test-utils/renderHook";
import type { DirectWorkQueueTaskAutoRefreshRequest } from "./types";
import { useQueueTaskAutoRefreshFromExecutor } from "./useQueueTaskAutoRefreshFromExecutor";

const baseAutoRefreshRequest: DirectWorkQueueTaskAutoRefreshRequest = {
  completedAt: "2026-05-20T10:00:01.000Z",
  executorWidgetInstanceId: "executor-1",
  finalStatus: "completed",
  id: 1,
  queueItemId: "queue-1",
  repoRoot: "/repo",
  runId: "run-1",
  startedAt: "2026-05-20T10:00:00.000Z",
  taskTitle: "Queue task",
  workbenchId: "workbench-1",
  workspaceId: "workspace-1",
};

type AutoRefreshHarnessOptions = {
  autoRefreshRequest?: DirectWorkQueueTaskAutoRefreshRequest | null;
  isDirty: boolean;
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  loadErrors?: string[];
  loadRequests: Array<{
    options?: { preserveCurrentOnError?: boolean };
    preferredTaskId?: string | null;
  }>;
  setValidationMessage: (message: string | null) => void;
  validationMessages: Array<string | null>;
};

describe("useQueueTaskAutoRefreshFromExecutor", () => {
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

  it("refreshes the Queue task when Executor final handoff state is requested", async () => {
    const pendingTimers: TimerHandler[] = [];
    window.setTimeout = ((handler: TimerHandler) => {
      pendingTimers.push(handler);
      return pendingTimers.length;
    }) as typeof window.setTimeout;
    const options = autoRefreshOptions(baseAutoRefreshRequest);
    const hook = renderHook(
      (props: AutoRefreshHarnessOptions) =>
        useQueueTaskAutoRefreshFromExecutor(props),
      options,
    );

    await flushHookEffects();
    await runPendingTimers(pendingTimers);

    expect(options.loadRequests).toEqual([
      {
        options: { preserveCurrentOnError: true },
        preferredTaskId: "queue-1",
      },
    ]);
    expect(options.validationMessages).toHaveLength(0);

    hook.unmount();
  });

  it("does not repeatedly refresh the Queue task for the same request id", async () => {
    const pendingTimers: TimerHandler[] = [];
    window.setTimeout = ((handler: TimerHandler) => {
      pendingTimers.push(handler);
      return pendingTimers.length;
    }) as typeof window.setTimeout;
    const options = autoRefreshOptions(baseAutoRefreshRequest);
    const hook = renderHook(
      (props: AutoRefreshHarnessOptions) =>
        useQueueTaskAutoRefreshFromExecutor(props),
      options,
    );

    await flushHookEffects();
    await runPendingTimers(pendingTimers);

    hook.rerender({
      ...options,
      autoRefreshRequest: { ...baseAutoRefreshRequest },
    });
    await flushHookEffects();
    await runPendingTimers(pendingTimers);

    expect(options.loadRequests).toHaveLength(1);

    hook.unmount();
  });

  it("does not refresh for irrelevant Executor state without a final handoff request", async () => {
    const pendingTimers: TimerHandler[] = [];
    window.setTimeout = ((handler: TimerHandler) => {
      pendingTimers.push(handler);
      return pendingTimers.length;
    }) as typeof window.setTimeout;
    const options = autoRefreshOptions(null);
    const hook = renderHook(
      (props: AutoRefreshHarnessOptions) =>
        useQueueTaskAutoRefreshFromExecutor(props),
      options,
    );

    await flushHookEffects();
    await runPendingTimers(pendingTimers);

    expect(options.loadRequests).toHaveLength(0);
    expect(options.validationMessages).toHaveLength(0);

    hook.unmount();
  });

  it("does not refresh when the Queue editor is dirty", async () => {
    const options = autoRefreshOptions(baseAutoRefreshRequest, true);
    const hook = renderHook(
      (props: AutoRefreshHarnessOptions) =>
        useQueueTaskAutoRefreshFromExecutor(props),
      options,
    );

    await flushHookEffects();

    expect(options.loadRequests).toHaveLength(0);
    expect(options.validationMessages).toEqual([
      "Queue auto-refresh failed. Use Refresh to update task status. Save current task before refreshing.",
    ]);

    hook.unmount();
  });

  it("cleans up a pending auto-refresh timer on unmount", async () => {
    const clearedTimerIds: number[] = [];
    window.setTimeout = (() => 7) as typeof window.setTimeout;
    window.clearTimeout = ((timerId?: number) => {
      if (typeof timerId === "number") {
        clearedTimerIds.push(timerId);
      }
    }) as typeof window.clearTimeout;
    const options = autoRefreshOptions(baseAutoRefreshRequest);
    const hook = renderHook(
      (props: AutoRefreshHarnessOptions) =>
        useQueueTaskAutoRefreshFromExecutor(props),
      options,
    );

    await flushHookEffects();
    hook.unmount();

    expect(clearedTimerIds).toEqual([7]);
    expect(options.loadRequests).toHaveLength(0);
  });
});

function autoRefreshOptions(
  autoRefreshRequest: DirectWorkQueueTaskAutoRefreshRequest | null,
  isDirty = false,
): AutoRefreshHarnessOptions {
  const loadErrors: string[] = [];
  const loadRequests: AutoRefreshHarnessOptions["loadRequests"] = [];
  const validationMessages: AutoRefreshHarnessOptions["validationMessages"] =
    [];

  return {
    autoRefreshRequest,
    isDirty,
    loadErrors,
    loadRequests,
    validationMessages,
    loadTasks(preferredTaskId, options) {
      loadRequests.push({ options, preferredTaskId });
      return Promise.resolve(loadErrors.shift() ?? null);
    },
    setValidationMessage(message) {
      validationMessages.push(message);
    },
  };
}

async function runPendingTimers(pendingTimers: TimerHandler[]) {
  while (pendingTimers.length > 0) {
    const timer = pendingTimers.shift();

    if (typeof timer === "function") {
      await timer();
    }
  }
}
