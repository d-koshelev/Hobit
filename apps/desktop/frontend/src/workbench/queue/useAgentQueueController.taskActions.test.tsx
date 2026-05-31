import { act } from "react";

import {
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController task actions", () => {
  it("saves priority changes through explicit edit mode and pauses the tag", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        priority: 0,
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.updatePriority("5");
    });
    expect(hook.result.current.isDirty).toBe(false);

    act(() => {
      hook.result.current.editTask.onStart();
    });
    act(() => {
      hook.result.current.updatePriority("5");
    });
    expect(hook.result.current.isDirty).toBe(true);

    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0].priority).toBe(5);
    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.priority).toBe(5);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("inserts created tasks at the top or bottom of the selected queue tag", async () => {
    const harness = createQueueHarness([
      queueTask({
        createdAt: "2026-05-20T10:00:00.000Z",
        queueItemId: "queue-1",
        title: "Existing",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      await hook.result.current.createTask(
        {
          ...hook.result.current.draft,
          prompt: "",
          title: "Top task",
        },
        { insertPosition: "top" },
      );
    });
    expect(hook.result.current.tasks.map((task) => task.title)).toEqual([
      "Top task",
      "Existing",
    ]);

    await act(async () => {
      await hook.result.current.createTask(
        {
          ...hook.result.current.draft,
          prompt: "",
          title: "Bottom task",
        },
        { insertPosition: "bottom" },
      );
    });
    expect(hook.result.current.tasks.map((task) => task.title)).toEqual([
      "Top task",
      "Existing",
      "Bottom task",
    ]);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("cancels explicit edit mode without saving draft changes", async () => {
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
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ prompt: "Discarded prompt" });
    });

    expect(hook.result.current.isDirty).toBe(true);

    act(() => {
      hook.result.current.editTask.onCancel();
    });

    expect(hook.result.current.editTask.isEditing).toBe(false);
    expect(hook.result.current.draft.prompt).toBe("Initial prompt");
    expect(harness.updateRequests).toHaveLength(0);

    hook.unmount();
  });

  it("promotes a draft task to queued through the existing update path without starting work", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Run this local Hobit task",
        queueItemId: "queue-1",
        status: "draft",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.draftPromotion.canPromote).toBe(true);

    await act(async () => {
      hook.result.current.draftPromotion.onPromote();
      await flushHookEffects();
    });

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0].prompt).toBe("Run this local Hobit task");
    expect(harness.updateRequests[0].queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0].status).toBe("queued");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);
    expect(hook.result.current.selectedTask?.status).toBe("queued");
    expect(
      hook.result.current.validationMessage?.startsWith(
        "Task promoted to queued. No Executor run",
      ),
    ).toBe(true);

    hook.unmount();
  });

  it("reloads the selected task when manual Refresh is requested", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);

    await act(async () => {
      await hook.result.current.refreshTasks();
    });
    await flushControllerLoad();

    expect(harness.listRequests).toBe(2);
    expect(harness.getRequests).toEqual(["queue-1", "queue-1"]);

    hook.unmount();
  });

  it("loads an existing task executionPolicy into the editor draft", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "after_previous_success",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.draft.executionPolicy).toBe(
      "after_previous_success",
    );
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("defaults omitted executionPolicy values to manual", async () => {
    const taskWithoutPolicy = queueTask({ queueItemId: "queue-1" });
    delete taskWithoutPolicy.executionPolicy;
    const harness = createQueueHarness([taskWithoutPolicy]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.draft.executionPolicy).toBe("manual");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("creates new task drafts with manual executionPolicy", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();
    await act(async () => {
      await hook.result.current.createTask();
    });
    await flushControllerLoad();

    expect(harness.createRequests).toHaveLength(1);
    expect(harness.createRequests[0].executionPolicy).toBe("manual");
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual([]);
    expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-1");
    expect(hook.result.current.draft.executionPolicy).toBe("manual");

    hook.unmount();
  });

  it("marks executionPolicy changes dirty and saves the policy", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ executionPolicy: "auto" });
    });

    expect(hook.result.current.isDirty).toBe(true);

    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0].executionPolicy).toBe("auto");
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.draft.executionPolicy).toBe("auto");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("updates the selected task and task list from a save response without reloading", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
        title: "Initial title",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({
        description: "Updated details",
        priority: 5,
        prompt: "Updated prompt",
        title: "Updated title",
      });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.selectedTask?.title).toBe("Updated title");
    expect(hook.result.current.tasks[0].priority).toBe(5);
    expect(hook.result.current.tasks[0].prompt).toBe("Updated prompt");
    expect(hook.result.current.tasks[0].description).toBe("Updated details");
    expect(hook.result.current.tasks[0].queueItemId).toBe("queue-1");
    expect(hook.result.current.tasks[0].title).toBe("Updated title");
    expect(hook.result.current.draft.title).toBe("Updated title");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("requires confirmation before deleting a task", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(hook.result.current.deleteTask.isConfirming).toBe(true);
    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("cancels delete confirmation without deleting", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
      hook.result.current.deleteTask.onCancel();
    });

    expect(hook.result.current.deleteTask.isConfirming).toBe(false);
    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("deletes a confirmed task and selects the next task", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued", title: "First" }),
      queueTask({ queueItemId: "queue-2", status: "queued", title: "Second" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });
    await act(async () => {
      hook.result.current.deleteTask.onConfirm();
      await flushControllerLoad();
    });

    expect(harness.deleteRequests).toEqual([{ queueItemId: "queue-1" }]);
    expect(harness.listRequests).toBe(2);
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
    ]);
    expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-2");
    expect(hook.result.current.deleteTask.message).toBe("Queue task deleted.");

    hook.unmount();
  });

  it("blocks delete for running tasks", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "running" }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      "Running tasks cannot be deleted.",
    );

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(harness.deleteRequests).toHaveLength(0);
    expect(hook.result.current.deleteTask.error).toBe(
      "Running tasks cannot be deleted.",
    );

    hook.unmount();
  });

  it("blocks delete while the selected task is waiting for the executor", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(hook.result.current.runner.status).toBe("waiting_for_executor");
    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      "Running tasks cannot be deleted.",
    );

    hook.unmount();
  });
});
