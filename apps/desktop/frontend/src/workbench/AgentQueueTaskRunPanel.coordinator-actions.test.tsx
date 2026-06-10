import { describe, expect, it, vi } from "vitest";

import {
  buttonByText,
  clickFirstButton,
  latestRunController,
  renderDetailsPanel,
  renderPanel,
  runHistoryController,
  sectionText,
  workerReportController,
} from "./AgentQueueTaskRunPanel.test-utils";
import {
  queueTask,
  reportActionCard,
  runLink,
  workerReport,
} from "./AgentQueueTaskRunPanel.test-fixtures";

describe("AgentQueueTaskRunPanel coordinator actions", () => {
  it("attaches latest run safe metadata to Coordinator without raw output fields", () => {
    const onAttachContextToCoordinator = vi.fn();

    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: "2026-05-22T10:01:00.000Z",
        directWorkRunId: "run_safe_latest_123456",
        reviewStatus: "review_needed",
        source: "manual",
        status: "completed",
        validationStatus: "passed",
      })),
      onAttachContextToCoordinator,
    });

    clickFirstButton("Attach to Workspace Agent");

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Queue latest run");
    expect(request.contextText).toContain("Queue run metadata");
    expect(request.contextText).toContain("Queue task: Task (task_1)");
    expect(request.contextText).toContain("run_safe_latest_123456");
    expect(request.contextText).toContain("Source: manual");
    expect(request.contextText).toContain("Status: completed");
    expect(request.contextText).toContain("Validation: passed");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repo_root|operatorPrompt|payloadJson|secret/i,
    );
  });

  it("attaches run history row safe metadata to Coordinator", () => {
    const onAttachContextToCoordinator = vi.fn();

    renderPanel({
      onAttachContextToCoordinator,
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_history_safe_123456",
          linkId: "link_history",
          source: "autorun",
          status: "failed",
        }),
      ]),
    });

    clickFirstButton("Attach to Workspace Agent");

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Queue run history row");
    expect(request.contextText).toContain("Queue run metadata");
    expect(request.contextText).toContain("run_history_safe_123456");
    expect(request.contextText).toContain("Source: autorun");
    expect(request.contextText).toContain("Status: failed");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repo_root|operatorPrompt|payloadJson|secret/i,
    );
  });

  it("hides coordinator finalization before worker evidence exists", () => {
    renderDetailsPanel();

    const finalizationDetails = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details"),
    ).find((details) =>
      details.querySelector("summary")?.textContent?.includes(
        "Coordinator finalization",
      ),
    );

    expect(finalizationDetails).toBeUndefined();
    expect(document.body.textContent).not.toContain("Coordinator decision");
    expect(buttonByText("Accept result")).toBeUndefined();
  });

  it("renders explicit coordinator finalization actions", () => {
    const report = workerReport();
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "ready_for_finalization" as const,
      status: "review_needed" as const,
      validationStatus: "needs_review" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    const decisionText = sectionText("Next action");

    expect(decisionText).toContain("Review report and make coordinator decision");
    expect(decisionText).toContain("Closure required");
    expect(decisionText).toContain("Mark ready for finalization");
    expect(decisionText).toContain("Accept without commit");
    expect(decisionText).toContain("Finalize / Accept");
    expect(decisionText).toContain("Request changes");
    expect(decisionText).toContain("Create follow-up");
    expect(decisionText).toContain("Follow-up required");
  });

  it("shows create diff review action and source linkage without starting execution", () => {
    const report = workerReport({
      commitHash: "abc1234",
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
    });
    const onCreateDiffReview = vi.fn();
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "queued" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      diffReview: {
        canCreate: true,
        linkedReviewTasks: [
          {
            ...queueTask(),
            diffReview: {
              reviewMode: "diff_vs_report",
              reviewTargetSummary: "Task; commit abc1234",
              sourceCommitHash: "abc1234",
              sourceItemId: "task_1",
              sourceReportId: "report-1",
            },
            itemType: "diff_review",
            queueItemId: "diff-review-1",
            status: "queued",
            title: "Diff review: Task",
          },
        ],
        message: null,
        onCreate: onCreateDiffReview,
      },
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    clickFirstButton("Developer details");

    expect(document.body.textContent).toContain("Create diff review item");
    expect(document.body.textContent).toContain("Diff review requested");
    expect(document.body.textContent).toContain(
      "Source item remains pending coordinator review",
    );

    clickFirstButton("Create diff review item");

    expect(onCreateDiffReview).toHaveBeenCalledTimes(1);
  });

  it("sends worker report action cards to Workspace Chat and records linkage", () => {
    const report = workerReport({
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
      warnings: ["Diff review is still required."],
      errors: ["One focused test still fails."],
    });
    const onShown = vi.fn();
    const onShowQueueReportInWorkspaceChat = vi.fn();
    const selectedTask = {
      ...queueTask(),
      workerExecutionReports: [report],
    };
    const card = reportActionCard();

    renderDetailsPanel({
      onShowQueueReportInWorkspaceChat,
      reportActionCard: {
        diffReviewReportCard: null,
        latestShownCardId: null,
        message: null,
        onShown,
        workerReportCard: card,
      },
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    clickFirstButton("Developer details");

    expect(document.body.textContent).toContain("Not shown in Chat");

    clickFirstButton("Show in Workspace Chat");

    expect(onShowQueueReportInWorkspaceChat).toHaveBeenCalledWith(card);
    expect(onShown).toHaveBeenCalledWith(card.cardId);
  });

  it("shows diff review source metadata on diff review items", () => {
    const sourceTask = {
      ...queueTask(),
      queueItemId: "source-task",
      title: "Source implementation",
    };
    const selectedTask = {
      ...queueTask(),
      diffReview: {
        reviewMode: "diff_vs_report" as const,
        reviewTargetSummary: "Source implementation; commit abc1234",
        sourceCommitHash: "abc1234",
        sourceItemId: "source-task",
        sourceReportId: "report-1",
      },
      itemType: "diff_review" as const,
      queueItemId: "diff-review-task",
      status: "queued" as const,
      title: "Review source diff",
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [sourceTask, selectedTask],
    });

    clickFirstButton("Developer details");

    expect(document.body.textContent).toContain("Diff review source");
    expect(document.body.textContent).toContain(
      "Source implementation (source-task)",
    );
    expect(document.body.textContent).toContain("report-1");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain("Diff vs report");
    expect(document.body.textContent).toContain("Open source item");
  });
});
