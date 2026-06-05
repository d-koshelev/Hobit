import { act } from "react";

import {
  createQueueHarness,
  flushControllerLoad,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController tag actions", () => {
  it("pauses a queue tag for coordinator review when a task is edited", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ prompt: "Updated prompt" });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.validationStatus).toBe(
      "needs_review",
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "awaiting_coordinator_review",
    );
    expect(hook.result.current.validationMessage).toBe(
      "Editing paused this queue tag until coordinator review.",
    );
    expect(hook.result.current.run.readinessMessage).toBe(
      "Resume this queue tag before running the selected task.",
    );
    expect(hook.result.current.foundation.globalStatus).toBe("started");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("resumes a paused queue tag without starting workers or queue execution", async () => {
    const harness = createQueueHarness([
      queueTask({ prompt: "Initial prompt", queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ prompt: "Updated prompt" });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });

    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );

    act(() => {
      hook.result.current.foundation.onResumeQueueTag("default");
    });

    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      false,
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "not_reported",
    );
    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("creates an empty queue tag without starting workers or queue execution", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      expect(hook.result.current.foundation.onCreateQueueTag("Review")).toBe(
        true,
      );
    });

    expect(
      hook.result.current.foundation.queueTags.some(
        (tag) =>
          tag.queueTagId === "review" &&
          tag.queueTagName === "Review" &&
          tag.taskCount === 0,
      ),
    ).toBe(true);
    expect(hook.result.current.foundation.tagManagementMessage).toBe(
      'Queue tag "Review" created.',
    );
    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("updates queue tag color for the current session without mutating task order or execution", async () => {
    const harness = createQueueHarness([
      queueTask({ orderIndex: 0, queueItemId: "queue-1" }),
      queueTask({ orderIndex: 1, queueItemId: "queue-2" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    const beforeOrder = hook.result.current.tasks.map((task) => task.queueItemId);

    act(() => {
      expect(
        hook.result.current.foundation.onSetQueueTagColor(
          "default",
          "queue-flow-tag-5",
        ),
      ).toBe(true);
    });

    expect(hook.result.current.foundation.queueTags[0]?.colorToken).toBe(
      "queue-flow-tag-5",
    );
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual(
      beforeOrder,
    );
    expect(hook.result.current.foundation.tagManagementMessage).toBe(
      "Queue tag color updated for this Hobit session. Current tag storage does not persist colors yet.",
    );
    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("rejects empty and duplicate queue tag names", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      expect(hook.result.current.foundation.onCreateQueueTag(" ")).toBe(false);
    });
    expect(hook.result.current.foundation.tagManagementError).toBe(
      "Queue tag name is required.",
    );

    act(() => {
      expect(hook.result.current.foundation.onCreateQueueTag("Default")).toBe(
        false,
      );
    });
    expect(hook.result.current.foundation.tagManagementError).toBe(
      'Queue tag "Default" already exists.',
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("renames a queue tag while preserving the stable tag id on tasks and workers", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Run this",
        queueItemId: "queue-1",
        queueTagId: "default",
        queueTagName: "Default",
        status: "queued",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "default",
        queueTagName: "Default",
      });
    });
    await act(async () => {
      expect(
        await hook.result.current.foundation.onRenameQueueTag(
          "default",
          "Primary",
        ),
      ).toBe(true);
    });

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0].queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0].queueTagId).toBe("default");
    expect(harness.updateRequests[0].queueTagName).toBe("Primary");
    expect(hook.result.current.selectedTask?.queueTagId).toBe("default");
    expect(hook.result.current.selectedTask?.queueTagName).toBe("Primary");
    expect(hook.result.current.foundation.queueTags[0]?.queueTagName).toBe(
      "Primary",
    );
    expect(hook.result.current.foundation.workers[0].scope).toEqual({
      kind: "queue_tag",
      queueTagId: "default",
      queueTagName: "Primary",
    });
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("deletes an empty queue tag and reassigns scoped workers to all queues", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onCreateQueueTag("Review");
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "review",
        queueTagName: "Review",
      });
    });

    expect(hook.result.current.foundation.workers[0].scope).toEqual({
      kind: "queue_tag",
      queueTagId: "review",
      queueTagName: "Review",
    });

    act(() => {
      expect(hook.result.current.foundation.onDeleteQueueTag("review")).toBe(
        true,
      );
    });

    expect(
      hook.result.current.foundation.queueTags.some(
        (tag) => tag.queueTagId === "review",
      ),
    ).toBe(false);
    expect(hook.result.current.foundation.workers[0].scope).toEqual({
      kind: "all",
    });
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks deleting a non-empty queue tag without reassigning items", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      expect(hook.result.current.foundation.onDeleteQueueTag("default")).toBe(
        false,
      );
    });

    expect(hook.result.current.foundation.tagManagementError).toBe(
      "Reassign items before deleting this queue tag.",
    );
    expect(hook.result.current.tasks).toHaveLength(1);
    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("marks a scoped worker paused when its queue tag is paused", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "default",
        queueTagName: "Default",
      });
      hook.result.current.foundation.onPauseQueueTag("default");
    });

    expect(hook.result.current.foundation.workers[0].status).toBe("paused");
    expect(hook.result.current.run.readinessMessage).toBe(
      "Resume this queue tag before running the selected task.",
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("pauses both previous and target tags when an edited task moves tags", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        queueTagId: "default",
        queueTagName: "Default",
        status: "queued",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "default",
        queueTagName: "Default",
      });
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ queueTagName: "Review" });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });

    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.foundation.pausedQueueTagIds.has("review")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.queueTagName).toBe("Review");
    expect(harness.clearRequests).toEqual([{ queueItemId: "queue-1" }]);
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBeNull();

    hook.unmount();
  });
});
