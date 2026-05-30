import { act } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  StartAgentQueueRunnerSessionRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
} from "../../workspace/types";
import type { DirectWorkRunHandoffInput } from "../types";
import {
  flushHookEffects,
  renderHook,
} from "../test-utils/renderHook";
import {
  getQueueTaskDependencyState,
  validateQueueTaskDependencies,
} from "../agentQueueTaskUiModel";
import { useAgentQueueController } from "./useAgentQueueController";

type AgentQueueControllerOptions = Parameters<
  typeof useAgentQueueController
>[0];

describe("useAgentQueueController executionPolicy draft", () => {
  it("defaults old queue tasks into the Queue + Workers foundation model", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Legacy task" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("saves priority changes through explicit edit mode and pauses the tag", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        priority: 0,
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("moves tasks up, down, top, and bottom without starting execution", async () => {
    const harness = createQueueHarness([
      queueTask({
        createdAt: "2026-05-20T10:00:00.000Z",
        queueItemId: "queue-1",
        title: "First",
      }),
      queueTask({
        createdAt: "2026-05-20T10:01:00.000Z",
        queueItemId: "queue-2",
        title: "Second",
      }),
      queueTask({
        createdAt: "2026-05-20T10:02:00.000Z",
        queueItemId: "queue-3",
        title: "Third",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-1",
      "queue-2",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveDown();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-1",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveToBottom();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-3",
      "queue-1",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveUp();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-1",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveToTop();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-1",
      "queue-2",
      "queue-3",
    ]);
    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(harness.updateRequests).toHaveLength(0);
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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("updates local worker scope without starting queue execution", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Task" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "default",
        queueTagName: "Default",
      });
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.foundation.onStopWorkers();
      hook.result.current.foundation.onStopAndKillRunning();
    });

    expect(hook.result.current.foundation.workers[0].scope).toEqual({
      kind: "queue_tag",
      queueTagId: "default",
      queueTagName: "Default",
    });
    expect(hook.result.current.foundation.globalStatus).toBe(
      "stop_kill_requested",
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("uses explicit global execution state to gate manual run, Autorun, and Sequential Runner", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.onGetAgentQueueRunnerSnapshot = async () => queueRunnerSnapshot();
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return queueRunnerSnapshot({ status: "running" });
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(
      hook.result.current.run.readinessMessage?.includes("Queue is stopped"),
    ).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "Click START before arming Queue Autorun.",
      ),
    ).toBe(true);
    expect(hook.result.current.runner.canStart).toBe(false);
    expect(
      hook.result.current.runner.preconditionMessages.includes(
        "Click START before starting the Sequential Queue Runner.",
      ),
    ).toBe(true);

    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });

    expect(hook.result.current.foundation.globalStatus).toBe("started");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.autorun.canArm).toBe(true);
    expect(hook.result.current.runner.canStart).toBe(true);

    act(() => {
      hook.result.current.foundation.onStopWorkers();
    });

    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(
      hook.result.current.run.readinessMessage?.includes("Queue is stopped"),
    ).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);

    act(() => {
      hook.result.current.foundation.onStopAndKillRunning();
    });

    expect(hook.result.current.foundation.globalStatus).toBe(
      "stop_kill_requested",
    );
    expect(
      hook.result.current.run.readinessMessage?.includes(
        "STOP + KILL RUNNING",
      ),
    ).toBe(true);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "STOP + KILL RUNNING is requested. Review running work or click START before arming Queue Autorun.",
      ),
    ).toBe(true);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      hook.result.current.autorun.onArm();
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("creates default persisted workers for a legacy workspace with no workers", async () => {
    const harness = createQueueHarness([]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("creates, renames, scopes, disables, and deletes worker config without starting execution", async () => {
    const harness = createQueueHarness([]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onCreateQueueTag("Review");
      hook.result.current.foundation.onCreateWorker();
    });
    await flushHookEffects();

    const createdWorker =
      hook.result.current.foundation.workers[
        hook.result.current.foundation.workers.length - 1
      ];
    expect(createdWorker?.name).toBe("Agent Worker 2");

    act(() => {
      hook.result.current.foundation.onRenameWorker(
        createdWorker?.workerId ?? "",
        "Review Worker",
      );
      hook.result.current.foundation.onWorkerScopeChange(
        createdWorker?.workerId ?? "",
        {
          kind: "queue_tag",
          queueTagId: "review",
          queueTagName: "Review",
        },
      );
      hook.result.current.foundation.onWorkerEnabledChange(
        createdWorker?.workerId ?? "",
        false,
      );
    });
    await flushHookEffects();

    const updatedWorker = hook.result.current.foundation.workers.find(
      (worker) => worker.workerId === createdWorker?.workerId,
    );
    expect(updatedWorker?.enabled).toBe(false);
    expect(updatedWorker?.name).toBe("Review Worker");
    expect(updatedWorker?.scope).toEqual({
      kind: "queue_tag",
      queueTagId: "review",
      queueTagName: "Review",
    });

    act(() => {
      hook.result.current.foundation.onDeleteWorker(createdWorker?.workerId ?? "");
    });
    await flushHookEffects();

    expect(
      hook.result.current.foundation.workers.some(
        (worker) => worker.workerId === createdWorker?.workerId,
      ),
    ).toBe(false);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("keeps max executors local, at least one, and blocks silent worker deletion", async () => {
    const harness = createQueueHarness([]);
    harness.replaceWorker(agentQueueWorker({ workerId: "executor-1" }));
    harness.replaceWorker(
      agentQueueWorker({
        displayOrder: 1,
        name: "Agent Executor 2",
        workerId: "executor-2",
      }),
    );
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(3);

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("0");
    });

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(3);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "cannot be lower than 2 configured workers",
      ),
    ).toBe(true);

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("2");
    });

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(2);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "No workers were started or stopped",
      ),
    ).toBe(true);
    expect(harness.deleteWorkerRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("bounds Add worker by max executors without starting Executor or Codex", async () => {
    const harness = createQueueHarness([]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("0");
    });
    await flushHookEffects();

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(1);

    act(() => {
      hook.result.current.foundation.onCreateWorker();
    });

    expect(hook.result.current.foundation.workers).toHaveLength(1);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "Max executors reached",
      ),
    ).toBe(true);
    expect(harness.createWorkerRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks removing a worker assigned to a queue task", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        assignedWorkerId: "executor-1",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onDeleteWorker("executor-1");
    });

    expect(hook.result.current.foundation.tagManagementError).toBe(
      "Clear this worker's task assignment before removing it.",
    );
    expect(harness.deleteWorkerRequests).toHaveLength(0);

    hook.unmount();
  });

  it("pauses a queue tag for coordinator review when a task is edited", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("generates a local plan preview without starting Executor, Codex, or Autorun", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt:
          "Update apps/desktop/frontend/src/workbench/AgentQueueTaskList.tsx and run npm.cmd run test --prefix apps/desktop/frontend.",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.executionPlan.onGenerate();
    });

    expect(hook.result.current.selectedTask?.executionPlanPreview?.status).toBe(
      "planned",
    );
    expect(
      hook.result.current.selectedTask?.executionPlanPreview
        ?.expectedValidationCommands,
    ).toEqual(["npm.cmd run test --prefix apps/desktop/frontend"]);
    expect(
      hook.result.current.selectedTask?.prompt.includes(
        "estimatedToken",
      ),
    ).toBe(false);
    expect(
      hook.result.current.selectedTask?.prompt.includes(
        "npm.cmd run test --prefix apps/desktop/frontend",
      ),
    ).toBe(true);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("marks an existing plan preview stale after explicit task edits", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.executionPlan.onGenerate();
    });
    await flushHookEffects();
    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ prompt: "Updated prompt" });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });

    expect(hook.result.current.selectedTask?.executionPlanPreview?.status).toBe(
      "stale",
    );
    expect(hook.result.current.executionPlan.message?.includes("stale")).toBe(
      true,
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("resumes a paused queue tag without starting workers or queue execution", async () => {
    const harness = createQueueHarness([
      queueTask({ prompt: "Initial prompt", queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("rejects empty and duplicate queue tag names", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("cancels explicit edit mode without saving draft changes", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

  it("reloads the selected task when manual Refresh is requested", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.draft.executionPolicy).toBe("manual");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("creates new task drafts with manual executionPolicy", async () => {
    const harness = createQueueHarness([]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
});

describe("Agent Queue dependency model", () => {
  it("rejects self-dependency, cycles, and missing dependency ids", () => {
    const selfTask = queueTask({
      dependsOn: ["queue-1"],
      queueItemId: "queue-1",
    });

    expect(validateQueueTaskDependencies(selfTask, [selfTask])).toBe(
      "A task cannot depend on itself.",
    );

    const first = queueTask({
      dependsOn: ["queue-2"],
      queueItemId: "queue-1",
      title: "First",
    });
    const second = queueTask({
      dependsOn: ["queue-1"],
      queueItemId: "queue-2",
      title: "Second",
    });

    expect(validateQueueTaskDependencies(first, [first, second])).toBe(
      "Second creates a dependency cycle.",
    );

    const missing = queueTask({
      dependsOn: ["missing-task"],
      queueItemId: "queue-3",
    });

    expect(validateQueueTaskDependencies(missing, [missing])).toBe(
      "missing-task is missing.",
    );
  });

  it("blocks and then allows readiness when a dependency is coordinator accepted", async () => {
    const harness = createQueueHarness([
      queueTask({
        coordinatorStatus: "not_reported",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        dependsOn: ["queue-1"],
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();
    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });

    expect(
      hook.result.current.run.readinessMessage?.includes(
        "Resolve dependencies before running.",
      ),
    ).toBe(true);
    expect(hook.result.current.run.canStart).toBe(false);

    harness.replaceTask(
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
      }),
    );
    await act(async () => {
      await hook.result.current.refreshTasks();
    });
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });
    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);

    hook.unmount();
  });

  it("dependency edits pause the queue tag and do not start Executor work", async () => {
    const harness = createQueueHarness([
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
      }),
      queueTask({
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });

    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ dependsOn: ["queue-1"] });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });

    expect(hook.result.current.selectedTask?.dependsOn).toEqual(["queue-1"]);
    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "awaiting_coordinator_review",
    );
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks Autorun arming when queue dependencies are blocked", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        status: "queued",
        title: "Prerequisite",
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        dependsOn: ["queue-1"],
        executionPolicy: "auto",
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
      }),
    ]);
    harness.options.onGetAgentQueueRunnerSnapshot = async () =>
      queueRunnerSnapshot();
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return queueRunnerSnapshot({ status: "running" });
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();
    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.autorun.canArm).toBe(false);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "Resolve blocked or invalid queue dependencies before arming Queue Autorun.",
      ),
    ).toBe(true);

    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushHookEffects();
    });

    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks deleting a prerequisite while dependent tasks reference it", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        status: "queued",
        title: "Prerequisite",
      }),
      queueTask({
        dependsOn: ["queue-1"],
        queueItemId: "queue-2",
        status: "queued",
        title: "Dependent",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      'Remove dependency from "Dependent" before deleting this task.',
    );

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("computes invalid dependency state for missing dependency ids", () => {
    const task = queueTask({
      dependsOn: ["missing-task"],
      queueItemId: "queue-1",
    });

    const dependencyState = getQueueTaskDependencyState(task, [task]);

    expect(dependencyState.status).toBe("invalid");
    expect(dependencyState.blockedBy).toEqual([
      {
        queueItemId: "missing-task",
        reason: "missing",
        title: "missing-task",
      },
    ]);
  });
});

describe("useAgentQueueController assignment refresh behavior", () => {
  it("updates assignment and selected task from mutation responses without reloading", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });
    await flushControllerLoad();

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBe(
      "executor-1",
    );
    expect(hook.result.current.tasks[0].assignedExecutorWidgetId).toBe(
      "executor-1",
    );
    expect(hook.result.current.assignmentMessage).toBe("Assignment saved.");

    await act(async () => {
      await hook.result.current.clearSelectedTaskAssignment();
    });
    await flushControllerLoad();

    expect(harness.clearRequests).toEqual([{ queueItemId: "queue-1" }]);
    expect(harness.listRequests).toBe(1);
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBeNull();
    expect(hook.result.current.tasks[0].assignedExecutorWidgetId).toBeNull();
    expect(hook.result.current.assignmentMessage).toBe("Assignment cleared.");

    hook.unmount();
  });

  it("prevents assigning a worker scoped to a different queue tag", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        queueTagId: "default",
        queueTagName: "Default",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "review",
        queueTagName: "Review",
      });
    });
    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(hook.result.current.assignmentError).toBe(
      "Selected worker is scoped to another queue tag. Choose a matching worker or change the worker scope.",
    );
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBeNull();

    hook.unmount();
  });

  it("prevents assigning a disabled worker and keeps manual run blocked by routing", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.replaceWorker(
      agentQueueWorker({
        enabled: false,
        workerId: "executor-1",
      }),
    );
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();
    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });

    expect(hook.result.current.run.readinessMessage).toBe("Worker is disabled");
    expect(hook.result.current.run.canStart).toBe(false);

    await act(async () => {
      await hook.result.current.clearSelectedTaskAssignment();
    });
    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(hook.result.current.assignmentError).toBe(
      "Selected worker is disabled. Enable it before assigning new work.",
    );
    expect(harness.startRequests).toHaveLength(0);

    hook.unmount();
  });
});

describe("useAgentQueueController sequential runner", () => {
  let originalSetTimeout: typeof window.setTimeout;

  beforeEach(() => {
    originalSetTimeout = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return 0;
    }) as typeof window.setTimeout;
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
  });

  it("assigns an unassigned auto task before starting it", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.startRequests).toHaveLength(1);
    expect(harness.startRequests[0].queueItemId).toBe("queue-1");
    expect(harness.handoffs).toHaveLength(1);
    expect(hook.result.current.runner.status).toBe("waiting_for_executor");

    hook.unmount();
  });

  it("does not start the same queue task twice while a runner start is in flight", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await flushHookEffects();

    act(() => {
      hook.result.current.runner.onStart();
      hook.result.current.runner.onStart();
    });
    await flushHookEffects();

    expect(harness.startRequests).toHaveLength(1);

    hook.unmount();
  });

  it("does not start the next task after Stop runner is pressed", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run first",
        queueItemId: "queue-1",
        status: "ready",
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run second",
        queueItemId: "queue-2",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.startRequests).toHaveLength(1);

    act(() => {
      hook.result.current.runner.onStop();
      harness.replaceTask(
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run first",
          queueItemId: "queue-1",
          status: "completed",
        }),
      );
      harness.options.queueTaskAutoRefreshRequest = {
        completedAt: "2026-05-20T10:02:00.000Z",
        executorWidgetInstanceId: "executor-1",
        finalStatus: "completed",
        id: 1,
        queueItemId: "queue-1",
        repoRoot: "/repo",
        runId: "run-1",
        startedAt: "2026-05-20T10:01:00.000Z",
        taskTitle: "Queue task",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      };
    });
    hook.rerender(undefined);
    await flushControllerLoad();

    expect(harness.startRequests).toHaveLength(1);
    expect(hook.result.current.runner.status).toBe("stopped");

    hook.unmount();
  });
});

describe("useAgentQueueController run metadata refresh behavior", () => {
  it("refreshes latest run and run history metadata without reloading tasks", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
      harness.runLinkRequests.push(queueItemId);
      return [queueRunLink({ queueTaskId: queueItemId })];
    };
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(harness.runLinkRequests).toEqual(["queue-1"]);
    expect(hook.result.current.latestRun.link?.queueTaskId).toBe("queue-1");
    expect(hook.result.current.runHistory.totalCount).toBe(1);

    await act(async () => {
      hook.result.current.latestRun.onRefresh();
      await flushHookEffects();
    });
    await act(async () => {
      hook.result.current.runHistory.onRefresh();
      await flushHookEffects();
    });

    expect(harness.runLinkRequests).toEqual(["queue-1", "queue-1", "queue-1"]);
    expect(harness.listRequests).toBe(1);
    expect(hook.result.current.latestRun.link?.directWorkRunId).toBe("run-1");
    expect(hook.result.current.runHistory.links).toHaveLength(1);

    hook.unmount();
  });
});

describe("useAgentQueueController Autorun refresh behavior", () => {
  it("keeps Autorun arm task reload behavior unchanged", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const autorunSnapshots: AgentQueueRunnerSnapshot[] = [
      queueRunnerSnapshot(),
      queueRunnerSnapshot({
        activeQueueItemId: "queue-1",
        isActive: true,
        sessionId: "session-1",
        status: "running",
        waitingRunId: "run-autorun",
      }),
    ];
    harness.options.onGetAgentQueueRunnerSnapshot = async () => {
      harness.autorunSnapshotRequests += 1;
      return autorunSnapshots[0];
    };
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return autorunSnapshots[1];
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushControllerLoad();
    });

    expect(harness.autorunSnapshotRequests).toBe(1);
    expect(harness.autorunStartRequests).toHaveLength(1);
    expect(harness.listRequests).toBe(2);
    expect(hook.result.current.autorun.snapshot?.activeQueueItemId).toBe(
      "queue-1",
    );

    hook.unmount();
  });

  it("keeps Queue Autorun blocked when the selected worker has no eligible assigned auto task", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.replaceWorker(agentQueueWorker({ enabled: false }));
    harness.options.onGetAgentQueueRunnerSnapshot = async () => queueRunnerSnapshot();
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return queueRunnerSnapshot({ status: "running" });
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "No assigned auto task is currently eligible for the selected worker.",
      ),
    ).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);

    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushHookEffects();
    });

    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });
});

describe("useAgentQueueController delete task", () => {
  it("requires confirmation before deleting a task", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

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

function createQueueHarness(initialTasks: AgentQueueTask[]) {
  const tasks = new Map<string, AgentQueueTask>(
    initialTasks.map((task) => [task.queueItemId, task]),
  );
  const workers = new Map<string, AgentQueueWorkerConfig>();
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const assignRequests: Array<
    Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">
  > = [];
  const clearRequests: Array<
    Omit<ClearAgentQueueTaskAssignmentRequest, "workspaceId">
  > = [];
  const startRequests: Array<
    Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">
  > = [];
  const autorunStartRequests: Array<
    Omit<StartAgentQueueRunnerSessionRequest, "workspaceId">
  > = [];
  const deleteRequests: Array<Omit<DeleteAgentQueueTaskRequest, "workspaceId">> =
    [];
  const createWorkerRequests: Array<
    Omit<CreateAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const updateWorkerRequests: Array<
    Omit<UpdateAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const deleteWorkerRequests: Array<
    Omit<DeleteAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const getRequests: string[] = [];
  const handoffs: DirectWorkRunHandoffInput[] = [];
  const runLinkRequests: string[] = [];
  let listRequests = 0;
  let autorunSnapshotRequests = 0;
  const options: AgentQueueControllerOptions = {
    agentExecutorSlots: [
      {
        label: "Agent Executor 1",
        widgetInstanceId: "executor-1",
      },
    ],
    onAssignAgentQueueTaskToExecutor: async (
      request: Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">,
    ) => {
      assignRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: request.executorWidgetInstanceId,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onCreateAgentQueueTask: async (
      request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      createRequests.push(request);
      const createdTask = queueTask({
        description: request.description,
        dependsOn: request.dependsOn ?? [],
        executionPolicy: request.executionPolicy ?? "manual",
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        queueItemId: `queue-${tasks.size + 1}`,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus,
      });
      tasks.set(createdTask.queueItemId, createdTask);

      return createdTask;
    },
    onDeleteAgentQueueTask: async (
      request: Omit<DeleteAgentQueueTaskRequest, "workspaceId">,
    ) => {
      deleteRequests.push(request);
      return tasks.delete(request.queueItemId);
    },
    onListAgentQueueWorkers: async () => Array.from(workers.values()),
    onCreateAgentQueueWorker: async (request) => {
      createWorkerRequests.push(request);
      const worker = agentQueueWorker({
        displayOrder: request.displayOrder,
        enabled: request.enabled,
        name: request.name,
        queueTagId: request.queueTagId ?? null,
        queueTagName: request.queueTagName ?? null,
        scopeKind: request.scopeKind,
        workerId: request.workerId ?? `worker-${workers.size + 1}`,
      });
      workers.set(worker.workerId, worker);
      return worker;
    },
    onUpdateAgentQueueWorker: async (request) => {
      updateWorkerRequests.push(request);
      const worker = workers.get(request.workerId);
      if (!worker) {
        return null;
      }
      const updatedWorker = {
        ...worker,
        displayOrder: request.displayOrder,
        enabled: request.enabled,
        name: request.name,
        queueTagId: request.queueTagId ?? null,
        queueTagName: request.queueTagName ?? null,
        scopeKind: request.scopeKind,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      workers.set(updatedWorker.workerId, updatedWorker);
      return updatedWorker;
    },
    onDeleteAgentQueueWorker: async (request) => {
      deleteWorkerRequests.push(request);
      return workers.delete(request.workerId);
    },
    onClearAgentQueueTaskAssignment: async (request) => {
      clearRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: null,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onDirectWorkRunHandoffStarted: (handoff) => {
      handoffs.push(handoff);
    },
    onGetAgentQueueTask: async (queueItemId: string) => {
      getRequests.push(queueItemId);
      return tasks.get(queueItemId) ?? null;
    },
    onListAgentQueueTasks: async () => {
      listRequests += 1;
      return Array.from(tasks.values());
    },
    onStartAssignedAgentQueueTask: async (
      request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
    ): Promise<StartAssignedAgentQueueTaskResponse> => {
      startRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task?.assignedExecutorWidgetId) {
        throw new Error("Queue task must be assigned before start.");
      }

      tasks.set(task.queueItemId, {
        ...task,
        status: "running",
        updatedAt: "2026-05-20T10:01:00.000Z",
      });

      return {
        executorWidgetInstanceId: task.assignedExecutorWidgetId,
        queueItemId: task.queueItemId,
        runId: `run-${startRequests.length.toString()}`,
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: task.workspaceId,
      };
    },
    onUpdateAgentQueueTask: async (
      request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      updateRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        return null;
      }

      const updatedTask: AgentQueueTask = {
        ...task,
        description: request.description,
        dependsOn: request.dependsOn ?? task.dependsOn ?? [],
        executionPolicy:
          request.executionPolicy ?? task.executionPolicy ?? "manual",
        itemType: request.itemType ?? task.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId ?? task.queueTagId,
        queueTagName: request.queueTagName ?? task.queueTagName,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus ?? task.validationStatus,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    queueTaskAutoRefreshRequest: null,
  };

  return {
    assignRequests,
    autorunStartRequests,
    get autorunSnapshotRequests() {
      return autorunSnapshotRequests;
    },
    set autorunSnapshotRequests(value: number) {
      autorunSnapshotRequests = value;
    },
    clearRequests,
    createRequests,
    deleteRequests,
    createWorkerRequests,
    deleteWorkerRequests,
    get getRequests() {
      return getRequests;
    },
    handoffs,
    get listRequests() {
      return listRequests;
    },
    options,
    replaceWorker(worker: AgentQueueWorkerConfig) {
      workers.set(worker.workerId, worker);
    },
    replaceTask(task: AgentQueueTask) {
      tasks.set(task.queueItemId, task);
    },
    startRequests,
    runLinkRequests,
    updateRequests,
    updateWorkerRequests,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    queueItemId: "queue-1",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function agentQueueWorker(
  overrides: Partial<AgentQueueWorkerConfig> = {},
): AgentQueueWorkerConfig {
  return {
    createdAt: "2026-05-20T10:00:00.000Z",
    displayOrder: 0,
    enabled: true,
    name: "Agent Executor 1",
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workerId: "executor-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueRunLink(
  overrides: Partial<AgentQueueTaskRunLinkSummary> = {},
): AgentQueueTaskRunLinkSummary {
  const link: AgentQueueTaskRunLinkSummary = {
    completedAt: null,
    createdAt: "2026-05-20T10:01:00.000Z",
    directWorkRunId: "run-1",
    executorWidgetId: "executor-1",
    linkId: "link-1",
    queueTaskId: "queue-1",
    reviewStatus: "unknown",
    source: "manual",
    startedAt: "2026-05-20T10:01:00.000Z",
    status: "running",
    updatedAt: "2026-05-20T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "workspace-1",
  };

  return {
    ...link,
    ...overrides,
  } as AgentQueueTaskRunLinkSummary;
}

function queueRunnerSnapshot(
  overrides: Partial<AgentQueueRunnerSnapshot> = {},
): AgentQueueRunnerSnapshot {
  return {
    activeQueueItemId: null,
    finalRunStatus: null,
    isActive: false,
    isSessionOnly: true,
    lastReconciledAt: null,
    policy: {
      allowHiddenExecution: false,
      durableResume: false,
      oneTaskAtATime: true,
      requireOperatorStart: true,
      stopOnCancel: true,
      stopOnFailure: true,
      stopOnReviewNeeded: true,
    },
    sessionId: null,
    status: "idle",
    stopReason: null,
    waitingRunId: null,
    ...overrides,
  };
}

async function flushControllerLoad() {
  await flushHookEffects();
  await flushHookEffects();
}
