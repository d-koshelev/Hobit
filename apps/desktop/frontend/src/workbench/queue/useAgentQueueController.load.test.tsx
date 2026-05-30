import {
  createQueueHarness,
  flushControllerLoad,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController load and defaults", () => {
  it("defaults old queue tasks into the Queue + Workers foundation model", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Legacy task" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.selectedTask?.dependsOn).toEqual([]);
    expect(hook.result.current.selectedTask?.priority).toBe(0);
    expect(hook.result.current.selectedTask?.orderIndex).toBe(0);
    expect(hook.result.current.ordering.orderLabel).toBe("1 of 1");
    expect(hook.result.current.selectedTask?.queueTagName).toBe("Default");
    expect(hook.result.current.selectedTask?.validationStatus).toBe(
      "not_started",
    );
    expect(hook.result.current.selectedTask?.itemType).toBe("implementation");
    expect(hook.result.current.foundation.queueTags[0]?.queueTagId).toBe(
      "default",
    );
    expect(hook.result.current.foundation.queueTags[0]?.queueTagName).toBe(
      "Default",
    );
    expect(hook.result.current.foundation.queueTags[0]?.status).toBe("running");
    expect(hook.result.current.foundation.queueTags[0]?.taskCount).toBe(1);
    expect(hook.result.current.foundation.workers[0]?.name).toBe(
      "Agent Executor 1",
    );
    expect(hook.result.current.foundation.workers[0]?.scope).toEqual({
      kind: "all",
    });
    expect(hook.result.current.foundation.workers[0]?.status).toBe("idle");
    expect(hook.result.current.foundation.workers[0]?.workerId).toBe(
      "executor-1",
    );

    hook.unmount();
  });

  it("defaults old queue tasks to no worker execution reports", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Legacy task" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.selectedTask?.workerExecutionReports).toEqual([]);
    expect(hook.result.current.workerReport.latestReport).toBeNull();

    hook.unmount();
  });

  it("creates default persisted workers for a legacy workspace with no workers", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(harness.createWorkerRequests[0]?.enabled).toBe(true);
    expect(harness.createWorkerRequests[0]?.name).toBe("Agent Executor 1");
    expect(harness.createWorkerRequests[0]?.scopeKind).toBe("all");
    expect(harness.createWorkerRequests[0]?.workerId).toBe("executor-1");
    expect(hook.result.current.foundation.workers[0]?.enabled).toBe(true);
    expect(hook.result.current.foundation.workers[0]?.name).toBe(
      "Agent Executor 1",
    );
    expect(hook.result.current.foundation.workers[0]?.workerId).toBe(
      "executor-1",
    );

    hook.unmount();
  });
});
