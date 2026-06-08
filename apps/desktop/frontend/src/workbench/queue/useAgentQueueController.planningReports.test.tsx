import { act } from "react";
import { vi } from "vitest";
import { createWorkspaceGitCommit } from "../../workspace/workspaceGitApi";
import type {
  AgentQueueCoordinatorStatus,
  AgentQueueTaskStatus,
  AgentQueueWorkerExecutionReport,
  GitCommitResponse,
} from "../../workspace/types";

import {
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

vi.mock("../../workspace/workspaceGitApi", () => ({
  createWorkspaceGitCommit: vi.fn(),
}));

const createWorkspaceGitCommitMock = vi.mocked(createWorkspaceGitCommit);

describe("useAgentQueueController planning and reports", () => {
  beforeEach(() => {
    createWorkspaceGitCommitMock.mockReset();
  });

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
    expect(selectedTask?.closureState).toBe("closure_required");
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

  it("applies explicit coordinator finalization actions without starting runtime work", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Review completed work",
        queueItemId: "queue-1",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.coordinatorFinalization.onMarkReadyForFinalization();
      await flushHookEffects();
    });

    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "ready_for_finalization",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");

    hook.unmount();

    const finalizeHarness = createQueueHarness([
      queueTask({
        prompt: "Review completed work",
        queueItemId: "queue-1",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    ]);
    const finalizeHook = renderQueueController(finalizeHarness);

    await flushControllerLoad();

    await act(async () => {
      finalizeHook.result.current.coordinatorFinalization.onFinalize();
      await flushHookEffects();
    });

    expect(finalizeHook.result.current.selectedTask?.coordinatorStatus).toBe(
      "finalized",
    );
    expect(finalizeHook.result.current.selectedTask?.status).toBe("completed");
    expect(finalizeHook.result.current.selectedTask?.validationStatus).toBe(
      "passed",
    );
    expect(harness.updateRequests).toHaveLength(1);
    expect(finalizeHarness.updateRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);
    expect(finalizeHarness.startRequests).toHaveLength(0);
    expect(finalizeHarness.autorunStartRequests).toHaveLength(0);

    finalizeHook.unmount();
  });

  it("keeps changed-file report closure in review when an explicit commit is still required", async () => {
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
          likelyFilesOrAreas: ["apps/desktop/frontend/src/workbench/Queue.tsx"],
          planId: "plan-1",
          risk: "medium",
          source: "heuristic",
          status: "planned",
          steps: ["Implement"],
          workerId: "executor-1",
        },
        prompt: "Review changed-file report",
        queueItemId: "queue-1",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.workerReport.onAttachDemoReport();
    });

    await act(async () => {
      hook.result.current.coordinatorFinalization.onFinalize();
      await flushHookEffects();
    });

    expect(hook.result.current.selectedTask?.closureState).toBe(
      "commit_required",
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "ready_for_finalization",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(
      hook.result.current.coordinatorFinalization.message?.includes(
        "No commit was created",
      ),
    ).toBe(true);
    expect(harness.updateRequests[0]?.status).toBe("review_needed");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("creates an explicit local commit for the selected report-ready Queue item", async () => {
    const report: AgentQueueWorkerExecutionReport = {
      changedFiles: ["src/queue.ts", "src/queue.test.ts"],
      commandsRun: [],
      createdAt: "2026-05-20T10:02:00.000Z",
      errors: [],
      itemId: "queue-1",
      reportId: "report-1",
      reportStatus: "completed",
      summary: "Report-ready implementation with changed files.",
      validationCommandsSuggested: [],
      validationResult: "passed",
      warnings: [],
      workerId: "executor-1",
    };
    createWorkspaceGitCommitMock.mockResolvedValue(
      gitCommitResponse({
        commitHash: "abc1234",
        commitMessage: "[QUEUE queue-1] Implement Queue commit",
        includedFiles: ["src/queue.ts", "src/queue.test.ts"],
        repoRoot: "C:/repo",
      }),
    );
    const harness = createQueueHarness([
      queueTask({
        executionWorkspace: "C:/repo",
        prompt: "Review changed-file report",
        queueItemId: "queue-1",
        status: "review_needed",
        title: "Implement Queue commit",
        validationStatus: "needs_review",
        workerExecutionReports: [report],
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.coordinatorFinalization.onCommitResult();
      await flushHookEffects();
    });

    expect(createWorkspaceGitCommitMock.mock.calls[0]?.[0]).toEqual({
      commitMessage: "[QUEUE queue-1] Implement Queue commit",
      includedFiles: ["src/queue.ts", "src/queue.test.ts"],
      repoRoot: "C:/repo",
    });
    expect(hook.result.current.selectedTask?.closureState).toBe(
      "commit_created",
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "ready_for_finalization",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(
      hook.result.current.selectedTask?.workerExecutionReports?.[0]?.commitHash,
    ).toBe("abc1234");
    expect(
      hook.result.current.coordinatorFinalization.message?.includes(
        "Commit created abc1234. Closure outcome commit_created.",
      ),
    ).toBe(true);
    expect(harness.updateRequests[0]?.status).toBe("review_needed");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("keeps the selected Queue item unfinalized when result commit creation fails", async () => {
    const report: AgentQueueWorkerExecutionReport = {
      changedFiles: ["src/queue.ts"],
      commandsRun: [],
      createdAt: "2026-05-20T10:02:00.000Z",
      errors: [],
      itemId: "queue-1",
      reportId: "report-1",
      reportStatus: "completed",
      summary: "Report-ready implementation with changed files.",
      validationCommandsSuggested: [],
      validationResult: "passed",
      warnings: [],
      workerId: "executor-1",
    };
    createWorkspaceGitCommitMock.mockResolvedValue(
      gitCommitResponse({
        commitHash: null,
        errorMessage: "staged files outside selected set",
        status: "failed",
      }),
    );
    const harness = createQueueHarness([
      queueTask({
        closureState: "commit_required",
        executionWorkspace: "C:/repo",
        prompt: "Review changed-file report",
        queueItemId: "queue-1",
        status: "review_needed",
        title: "Implement Queue commit",
        validationStatus: "needs_review",
        workerExecutionReports: [report],
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.coordinatorFinalization.onCommitResult();
      await flushHookEffects();
    });

    expect(hook.result.current.selectedTask?.closureState).toBe(
      "commit_required",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(
      hook.result.current.selectedTask?.coordinatorStatus === "finalized",
    ).toBe(false);
    expect(
      hook.result.current.coordinatorFinalization.message?.includes(
        "The Queue item was not finalized.",
      ),
    ).toBe(true);
    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("accepts a no-change report without creating a commit or starting runtime work", async () => {
    const noChangeReport: AgentQueueWorkerExecutionReport = {
      changedFiles: [],
      commandsRun: [],
      createdAt: "2026-05-20T10:02:00.000Z",
      errors: [],
      itemId: "queue-1",
      reportId: "report-1",
      reportStatus: "completed",
      summary: "Report-ready no-change task.",
      validationCommandsSuggested: [],
      validationResult: "passed",
      warnings: [],
      workerId: "executor-1",
    };
    const harness = createQueueHarness([
      queueTask({
        prompt: "Review no-change report",
        queueItemId: "queue-1",
        status: "review_needed",
        validationStatus: "needs_review",
        workerExecutionReports: [noChangeReport],
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.coordinatorFinalization.onAcceptWithoutCommit();
      await flushHookEffects();
    });

    expect(hook.result.current.selectedTask?.closureState).toBe(
      "no_change_accepted",
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "finalized",
    );
    expect(hook.result.current.selectedTask?.status).toBe("completed");
    expect(hook.result.current.selectedTask?.validationStatus).toBe("passed");
    expect(
      hook.result.current.coordinatorFinalization.message?.includes(
        "No file changes; no commit created.",
      ),
    ).toBe(true);
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("marks coordinator needs changes, rollback, blocked, and failed as model-only decisions", async () => {
    await expectCoordinatorDecision("onMarkNeedsChanges", {
      coordinatorStatus: "needs_changes",
      status: "review_needed",
    });
    await expectCoordinatorDecision("onMarkRollbackRequired", {
      coordinatorStatus: "rollback_required",
      messageIncludes: "No rollback",
      status: "review_needed",
    });
    await expectCoordinatorDecision("onMarkBlocked", {
      coordinatorStatus: "blocked",
      status: "review_needed",
    });
    await expectCoordinatorDecision("onMarkFailedRejected", {
      coordinatorStatus: "failed",
      status: "failed",
    });
  });

  it("creates an explicit queued follow-up item and leaves the source unfinalized", async () => {
    const harness = createQueueHarness([
      queueTask({
        approvalPolicy: "on_request",
        codexExecutable: "codex-custom",
        executionPolicy: "auto",
        executionWorkspace: "C:/source-workspace",
        prompt: "Needs follow-up",
        queueItemId: "queue-1",
        queueTagId: "implementation",
        queueTagName: "Implementation",
        sandbox: "workspace_write",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.coordinatorFinalization.onCreateFollowUp();
      await flushHookEffects();
    });

    expect(harness.createRequests[0]?.executionPolicy).toBe("manual");
    expect(harness.createRequests[0]?.approvalPolicy).toBe("on_request");
    expect(harness.createRequests[0]?.codexExecutable).toBe("codex-custom");
    expect(harness.createRequests[0]?.executionWorkspace).toBe(
      "C:/source-workspace",
    );
    expect(harness.createRequests[0]?.itemType).toBe("follow_up");
    expect(harness.createRequests[0]?.queueTagId).toBe("implementation");
    expect(harness.createRequests[0]?.queueTagName).toBe("Implementation");
    expect(harness.createRequests[0]?.sandbox).toBe("workspace_write");
    expect(harness.createRequests[0]?.status).toBe("queued");
    expect(harness.createRequests[0]?.validationStatus).toBe("not_started");
    expect(
      harness.createRequests[0]?.prompt.includes(
        "Source failure summary: status=review_needed; validation=needs_review; coordinator=not_reported",
      ),
    ).toBe(true);
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0]?.queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0]?.status).toBe("review_needed");
    expect(harness.updateRequests[0]?.validationStatus).toBe("needs_review");
    expect(
      hook.result.current.tasks.find((task) => task.queueItemId === "queue-1")
        ?.coordinatorStatus,
    ).toBe("follow_up_required");
    expect(
      hook.result.current.tasks.find((task) => task.queueItemId === "queue-1")
        ?.closureState,
    ).toBe("follow_up_created");
    expect(hook.result.current.tasks.find(
      (task) => task.queueItemId !== "queue-1",
    )?.itemType).toBe("follow_up");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("generates a local plan preview without starting Executor, Codex, or Autorun", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt:
          "Update apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx and run npm.cmd run test --prefix apps/desktop/frontend.",
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

async function expectCoordinatorDecision(
  actionName:
    | "onMarkBlocked"
    | "onMarkFailedRejected"
    | "onMarkNeedsChanges"
    | "onMarkRollbackRequired",
  expected: {
    coordinatorStatus: AgentQueueCoordinatorStatus;
    messageIncludes?: string;
    status: AgentQueueTaskStatus;
  },
) {
  const harness = createQueueHarness([
    queueTask({
      prompt: "Needs coordinator decision",
      queueItemId: "queue-1",
      status: "review_needed",
    }),
  ]);
  const hook = renderQueueController(harness);

  await flushControllerLoad();

  await act(async () => {
    hook.result.current.coordinatorFinalization[actionName]();
    await flushHookEffects();
  });

  expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
    expected.coordinatorStatus,
  );
  expect(hook.result.current.selectedTask?.status).toBe(expected.status);
  if (expected.messageIncludes) {
    expect(
      hook.result.current.coordinatorFinalization.message?.includes(
        expected.messageIncludes,
      ),
    ).toBe(true);
  }
  expect(harness.startRequests).toHaveLength(0);
  expect(harness.autorunStartRequests).toHaveLength(0);

  hook.unmount();
}

function gitCommitResponse(
  overrides: Partial<GitCommitResponse> = {},
): GitCommitResponse {
  return {
    autoCommit: false,
    branch: "main",
    cleanPerformed: false,
    commandSummary: [],
    commitHash: "abc1234",
    commitMessage: "[QUEUE queue-1] Implement Queue commit",
    durationMs: 10,
    errorMessage: null,
    exitCode: 0,
    forcePushPerformed: false,
    includedFiles: ["src/queue.ts"],
    operatorConfirmedRequired: true,
    pushPerformed: false,
    repoRoot: "C:/repo",
    resetPerformed: false,
    status: "committed",
    stderr: "",
    stdout: "",
    ...overrides,
  };
}
