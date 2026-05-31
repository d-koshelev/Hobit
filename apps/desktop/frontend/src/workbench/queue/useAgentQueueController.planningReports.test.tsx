import { act } from "react";

import {
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController planning and reports", () => {
  it("attaches a worker report as coordinator-review evidence without finalizing or starting work", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPlanPreview: {
          complexity: "medium",
          estimatedMinutesMax: 20,
          estimatedMinutesMin: 10,
          estimatedTokenMax: 2400,
          estimatedTokenMin: 1200,
          expectedValidationCommands: [
            "npm.cmd run typecheck --prefix apps/desktop/frontend",
          ],
          generatedAt: "2026-05-20T10:00:00.000Z",
          itemId: "queue-1",
          likelyFilesOrAreas: [
            "apps/desktop/frontend/src/workbench/AgentQueueTaskDetailsPanel.tsx",
            "Agent Queue model/UI",
          ],
          planId: "plan-1",
          risk: "medium",
          source: "heuristic",
          status: "needs_split",
          steps: ["Inspect", "Implement", "Validate"],
          splitRecommendation: "Create a focused follow-up/sub-block.",
          workerId: "executor-1",
        },
        prompt: "Attach report",
        queueItemId: "queue-1",
        status: "queued",
        validationStatus: "not_started",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.workerReport.onAttachDemoReport();
    });

    const selectedTask = hook.result.current.selectedTask;
    const report = hook.result.current.workerReport.latestReport;

    expect(selectedTask?.status).toBe("queued");
    expect(selectedTask?.validationStatus).toBe("not_started");
    expect(selectedTask?.coordinatorStatus).toBe(
      "awaiting_coordinator_review",
    );
    expect(report?.reportStatus).toBe("needs_follow_up");
    expect(report?.validationResult).toBe("not_run");
    expect(report?.changedFiles).toEqual([
      "apps/desktop/frontend/src/workbench/AgentQueueTaskDetailsPanel.tsx",
    ]);
    expect(report?.validationCommandsSuggested).toEqual([
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    ]);
    expect(report?.followUpRecommendation).toBe(
      "Create a focused follow-up/sub-block.",
    );
    expect(hook.result.current.workerReport.message).toBe(
      "Worker report attached as evidence. Awaiting validation/coordinator review; item status was not finalized.",
    );
    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("creates an independent diff review item from a worker report without execution or source finalization", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Implement Queue UI change",
        queueItemId: "queue-1",
        status: "queued",
        validationStatus: "not_started",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.workerReport.onAttachDemoReport();
    });

    const sourceTask = hook.result.current.selectedTask;
    const sourceReport = hook.result.current.workerReport.latestReport;

    expect(hook.result.current.diffReview.canCreate).toBe(true);

    await act(async () => {
      hook.result.current.diffReview.onCreate();
      await flushHookEffects();
    });

    const createdRequest = harness.createRequests[0];
    const createdTask = hook.result.current.selectedTask;

    expect(createdRequest.executionPolicy).toBe("manual");
    expect(createdRequest.itemType).toBe("diff_review");
    expect(createdRequest.queueTagId).toBe("default");
    expect(createdRequest.queueTagName).toBe("Default");
    expect(createdRequest.status).toBe("queued");
    expect(createdRequest.validationStatus).toBe("not_started");
    expect(createdRequest.dependsOn).toBe(undefined);
    expect(createdRequest.prompt.includes("Inspect the actual git diff")).toBe(
      true,
    );
    expect(
      createdRequest.prompt.includes(
        "Compare the diff to the worker execution report",
      ),
    ).toBe(true);
    expect(createdRequest.prompt.includes("Check Hobit contracts")).toBe(true);
    expect(
      createdRequest.prompt.includes("Do not finalize the source item"),
    ).toBe(true);
    expect(
      /provider|model|thinking|temperature|tokens|reasoning/i.test(
        createdRequest.prompt,
      ),
    ).toBe(false);
    expect(createdTask?.itemType).toBe("diff_review");
    expect(createdTask?.status).toBe("queued");
    expect(createdTask?.dependsOn).toEqual([]);
    expect(createdTask?.diffReview?.reviewMode).toBe("diff_vs_report");
    expect(createdTask?.diffReview?.sourceItemId).toBe("queue-1");
    expect(createdTask?.diffReview?.sourceReportId).toBe(sourceReport?.reportId);
    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });
    expect(
      hook.result.current.foundation.schedulerPlan.itemEligibility.find(
        (item) => item.queueItemId === createdTask?.queueItemId,
      )?.isSchedulable,
    ).toBe(true);
    expect(hook.result.current.tasks.find(
      (task) => task.queueItemId === sourceTask?.queueItemId,
    )?.status).toBe("queued");
    expect(hook.result.current.tasks.find(
      (task) => task.queueItemId === sourceTask?.queueItemId,
    )?.coordinatorStatus).toBe("awaiting_coordinator_review");
    expect(harness.updateRequests).toHaveLength(0);
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
    const hook = renderQueueController(harness);

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
    const hook = renderQueueController(harness);

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
});
