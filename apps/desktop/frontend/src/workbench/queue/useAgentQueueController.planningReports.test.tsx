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
