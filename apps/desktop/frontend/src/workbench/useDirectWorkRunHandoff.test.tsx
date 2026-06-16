import { act } from "react";
import { describe, expect, it } from "vitest";

import { renderHook } from "./test-utils/renderHook";
import { useDirectWorkRunHandoff } from "./useDirectWorkRunHandoff";
import type { DirectWorkRunHandoff } from "./types";
import handoffSource from "./useDirectWorkRunHandoff.ts?raw";

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

describe("useDirectWorkRunHandoff", () => {
  it("handles a final run state once for a queue task and run pair", () => {
    const hook = renderHook(() => useDirectWorkRunHandoff(), undefined);

    act(() => {
      hook.result.current.recordFinalState(baseHandoff, "completed");
    });

    const firstRequest = hook.result.current.queueTaskAutoRefreshRequest;

    expect(firstRequest?.queueItemId).toBe("queue-1");
    expect(firstRequest?.runId).toBe("run-1");
    expect(firstRequest?.finalStatus).toBe("completed");
    expect(firstRequest?.id).toBe(1);
    expect(firstRequest?.queueLinkedMetadata).toMatchObject({
      durable: false,
      executorWidgetId: "executor-1",
      frontendOnly: true,
      queueItemId: "queue-1",
      runId: "run-1",
      source: "queue_handoff",
      workspaceId: "workspace-1",
    });

    act(() => {
      hook.result.current.recordFinalState(baseHandoff, "completed");
    });

    expect(hook.result.current.queueTaskAutoRefreshRequest).toBe(firstRequest);

    hook.unmount();
  });

  it("does not create final completion side effects for handoff progress alone", () => {
    const hook = renderHook(() => useDirectWorkRunHandoff(), undefined);

    act(() => {
      hook.result.current.recordHandoff({
        executorWidgetInstanceId: " executor-1 ",
        queueItemId: "queue-1",
        repoRoot: " /repo ",
        runId: " run-1 ",
        taskTitle: " Queue task ",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      });
    });

    expect(hook.result.current.handoffs["executor-1"]?.runId).toBe("run-1");
    expect(
      hook.result.current.handoffs["executor-1"]?.queueLinkedMetadata,
    ).toMatchObject({
      executorWidgetId: "executor-1",
      queueItemId: "queue-1",
      runId: "run-1",
      source: "queue_handoff",
    });
    expect(hook.result.current.queueTaskAutoRefreshRequest).toBeNull();

    hook.unmount();
  });

  it("allows a new queue run to trigger final handling independently", () => {
    const hook = renderHook(() => useDirectWorkRunHandoff(), undefined);

    act(() => {
      hook.result.current.recordFinalState(baseHandoff, "completed");
    });

    const firstRequest = hook.result.current.queueTaskAutoRefreshRequest;

    act(() => {
      hook.result.current.recordFinalState(
        {
          ...baseHandoff,
          runId: "run-2",
        },
        "failed",
      );
    });

    const secondRequest = hook.result.current.queueTaskAutoRefreshRequest;

    expect(secondRequest?.id).toBe(2);
    expect(secondRequest?.runId).toBe("run-2");
    expect(secondRequest?.finalStatus).toBe("failed");
    expect(secondRequest === firstRequest).toBe(false);

    hook.unmount();
  });

  it("ignores incomplete final-state handoff identifiers", () => {
    const hook = renderHook(() => useDirectWorkRunHandoff(), undefined);

    act(() => {
      hook.result.current.recordFinalState(
        {
          ...baseHandoff,
          queueItemId: " ",
        },
        "completed",
      );
      hook.result.current.recordFinalState(
        {
          ...baseHandoff,
          runId: " ",
        },
        "completed",
      );
    });

    expect(hook.result.current.queueTaskAutoRefreshRequest).toBeNull();

    hook.unmount();
  });

  it("does not call Queue worker evidence ingestion from the metadata seam", () => {
    expect(handoffSource).not.toContain("smartQueueWorkerEvidenceIngestion");
    expect(handoffSource).not.toContain("queue.lifecycle.agentFinished");
    expect(handoffSource).not.toContain("createGitCommit");
    expect(handoffSource).not.toContain("rollback");
    expect(handoffSource).not.toContain("Terminal");
    expect(handoffSource).not.toContain("new RegExp");
    expect(handoffSource).not.toContain(".match(");
  });
});
