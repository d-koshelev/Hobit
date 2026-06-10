import { describe, expect, it } from "vitest";

import type { AgentQueueTask, AgentQueueWorkerExecutionReport } from "../../workspace/types";
import {
  buildDiffReviewReportActionCard,
  buildWorkerExecutionReportActionCard,
  diffReviewTaskPromptFromReportCard,
  followUpTaskPromptFromReportCard,
} from "./agentQueueReportActionCardModel";

describe("agentQueueReportActionCardModel", () => {
  it("derives a compact worker execution report action card", () => {
    const card = buildWorkerExecutionReportActionCard({
      dependentTasks: [task({ queueItemId: "dependent-1" })],
      linkedDiffReviewTask: task({
        itemType: "diff_review",
        queueItemId: "diff-review-1",
        status: "queued",
      }),
      report: workerReport(),
      sourceTask: task({
        executionWorkspace: "C:/repo",
        queueItemId: "source-1",
        queueTagName: "Implementation",
        title: "Implement report cards",
      }),
    });

    expect(card.reportKind).toBe("worker_execution");
    expect(card.sourceItemTitle).toContain("Implement report cards");
    expect(card.sourceQueueTag).toBe("Implementation");
    expect(card.reportStatus).toBe("needs_follow_up");
    expect(card.changedFiles).toEqual(["src/report-card.tsx"]);
    expect(card.finalResponse).toBe("Final response preview.");
    expect(card.sourceExecutionWorkspace).toBe("C:/repo");
    expect(card.warnings).toEqual(["Diff review recommended."]);
    expect(card.errors).toEqual(["One validation failed."]);
    expect(card.commitHash).toBe("abc1234");
    expect(card.sourceClosureState).toBe("closure_required");
    expect(card.linkedDiffReviewItemId).toBe("diff-review-1");
    expect(card.dependentItemIds).toEqual(["dependent-1"]);
    expect(card.recommendedActions.map((action) => action.type)).toContain(
      "create_follow_up",
    );
    expect(card.recommendedActions.map((action) => action.type)).toEqual(
      expect.arrayContaining([
        "mark_ready_for_finalization",
        "finalize_accept_item",
        "accept_without_commit",
        "review_changes",
        "mark_needs_changes",
        "mark_follow_up_required",
        "mark_blocked",
        "mark_failed_rejected",
        "mark_rollback_required",
      ]),
    );
  });

  it("enables explicit accept without commit only for no-change reports", () => {
    const noChangeCard = buildWorkerExecutionReportActionCard({
      report: workerReport({
        changedFiles: [],
        commitHash: undefined,
      }),
      sourceTask: task({ queueItemId: "source-1" }),
    });
    const changedFilesCard = buildWorkerExecutionReportActionCard({
      report: workerReport(),
      sourceTask: task({ queueItemId: "source-1" }),
    });

    expect(
      noChangeCard.recommendedActions.find(
        (action) => action.type === "accept_without_commit",
      ),
    ).toMatchObject({
      enabled: true,
      label: "Accept without commit",
    });
    expect(
      changedFilesCard.recommendedActions.find(
        (action) => action.type === "accept_without_commit",
      )?.enabled,
    ).toBe(false);
  });

  it("builds queued follow-up and diff-review prompts without runtime instructions", () => {
    const card = buildWorkerExecutionReportActionCard({
      report: workerReport(),
      sourceTask: task({ queueItemId: "source-1" }),
    });

    expect(followUpTaskPromptFromReportCard(card)).toContain(
      "Follow-up/sub-block from report report-1",
    );
    const diffReviewPrompt = diffReviewTaskPromptFromReportCard(card);
    expect(diffReviewPrompt).toContain("Read-only by default.");
    expect(diffReviewPrompt).toContain("Do not modify code");
    expect(diffReviewPrompt).toContain("Source task report summary/ref:");
    expect(diffReviewPrompt).toContain("Validation evidence summary/ref:");
    expect(diffReviewPrompt).toContain("Expected recommendation format:");
    expect(diffReviewPrompt).not.toMatch(/start executor|run codex|auto-run/i);
  });

  it("represents a diff review item as a report card linked to its source", () => {
    const sourceTask = task({
      queueItemId: "source-1",
      title: "Source implementation",
    });
    const diffReviewTask = task({
      diffReview: {
        reviewMode: "diff_vs_report",
        reviewTargetSummary: "Source implementation; commit abc1234",
        sourceCommitHash: "abc1234",
        sourceItemId: "source-1",
        sourceReportId: "report-1",
      },
      itemType: "diff_review",
      queueItemId: "diff-review-1",
      status: "queued",
    });

    const card = buildDiffReviewReportActionCard({
      diffReviewTask,
      sourceTask,
    });

    expect(card?.reportKind).toBe("diff_review");
    expect(card?.sourceItemId).toBe("source-1");
    expect(card?.linkedDiffReviewItemId).toBe("diff-review-1");
    expect(card?.reportSummary).toContain("Source implementation");
  });
});

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-31T10:00:00.000Z",
    description: "Task description",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 1,
    prompt: "Task prompt",
    queueItemId: "task-1",
    queueTagId: "default",
    queueTagName: "Default",
    status: "queued",
    title: "Task",
    updatedAt: "2026-05-31T10:01:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: ["src/report-card.tsx"],
    commandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
    commitHash: "abc1234",
    createdAt: "2026-05-31T10:02:00.000Z",
    errors: ["One validation failed."],
    followUpRecommendation: "Create a focused follow-up item.",
    itemId: "source-1",
    reportId: "report-1",
    reportStatus: "needs_follow_up",
    rawReportPreview: "Final response preview.",
    rollbackRecommendation: "Review rollback need.",
    summary: "Worker report summary.",
    validationCommandsSuggested: ["npm.cmd run test --prefix apps/desktop/frontend"],
    validationResult: "failed",
    warnings: ["Diff review recommended."],
    workerId: "worker-1",
    ...overrides,
  };
}
