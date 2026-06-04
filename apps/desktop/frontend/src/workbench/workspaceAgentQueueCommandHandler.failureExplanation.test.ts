import { describe, expect, it, vi } from "vitest";

import { runWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandHandler";
import {
  autonomousResult,
  countsFixture,
  itemResult,
  queueBridge,
  queueItemSnapshot,
  queueSnapshot,
  snapshotResult,
} from "./workspaceAgentQueueCommandHandler.testHelpers";

describe("workspaceAgentQueueCommandHandler failure explanations", () => {
  it("explains failed Queue evidence without creating or running work", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          itemCounts: countsFixture({
            failed: 1,
            total: 1,
          }),
          items: [
            queueItemSnapshot({
              coordinatorStatus: "awaiting_coordinator_review",
              evidenceSummary: {
                reviewStatus: "review_needed",
                runRefs: ["run-failed"],
                status: "available",
                validationStatus: "failed",
              },
              executionStatus: "failed",
              id: "Q-FAILED",
              reportSummary: {
                errorMessage: "typecheck exited with code 2",
                failedCommand:
                  "npm.cmd run typecheck --prefix apps/desktop/frontend",
                status: "report_ready",
                summary: "Worker report summary: frontend typecheck failed.",
                validationSummary:
                  "Validation result: failed. Validation commands already reported: npm.cmd run typecheck --prefix apps/desktop/frontend.",
              },
              runLinks: [
                {
                  completedAt: "2026-06-02T12:10:00.000Z",
                  directWorkRunId: "run-failed",
                  executorWidgetId: "executor-1",
                  linkId: "link-1",
                  reviewStatus: "review_needed",
                  source: "manual",
                  startedAt: "2026-06-02T12:00:00.000Z",
                  status: "failed",
                  validationStatus: "failed",
                },
              ],
              status: "failed",
              title: "Fix frontend typecheck",
              validationStatus: "failed",
            }),
          ],
          selectedItem: null,
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("why it failed", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(result.handled).toBe(true);
    expect(getSnapshot).toHaveBeenCalledWith({ includeSelectedItem: true });
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Queue item: Q-FAILED - Fix frontend typecheck.",
    );
    expect(result.body).toContain("Execution status: failed.");
    expect(result.body).toContain(
      "Coordinator/review status: awaiting_coordinator_review.",
    );
    expect(result.body).toContain(
      "Result/evidence status: report report_ready, evidence available.",
    );
    expect(result.body).toContain(
      "Failed command: npm.cmd run typecheck --prefix apps/desktop/frontend.",
    );
    expect(result.body).toContain(
      "Error message: typecheck exited with code 2.",
    );
    expect(result.body).toContain(
      "Worker report / final response summary: Worker report summary: frontend typecheck failed.",
    );
    expect(result.body).toContain(
      "Validation summary: Validation result: failed.",
    );
    expect(result.body).toContain("Suggested next action:");
    expect(result.body).not.toContain("validate.ps1");
  });

  it("uses the selected failed Queue item when explaining failure evidence", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const selectedItem = queueItemSnapshot({
      evidenceSummary: {
        reviewStatus: null,
        runRefs: [],
        status: "missing",
        validationStatus: "failed",
      },
      id: "Q-SELECTED",
      reportSummary: {
        status: "evidence_missing",
        summary: "Execution is complete but no safe run evidence is linked.",
      },
      status: "completed",
      title: "Selected failed validation",
      validationStatus: "failed",
    });
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          items: [
            queueItemSnapshot({
              id: "Q-OLDER",
              reportSummary: {
                errorMessage: "older failure",
                status: "report_ready",
              },
              status: "failed",
              title: "Older failed item",
              updatedAt: "2026-06-02T10:00:00.000Z",
            }),
            selectedItem,
          ],
          selectedItem,
          selectedItemId: "Q-SELECTED",
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("why did it fail", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Queue item: Q-SELECTED - Selected failed validation.",
    );
    expect(result.body).toContain(
      "Result/evidence status: report evidence_missing, evidence missing.",
    );
    expect(result.body).toContain(
      "do not rerun validation unless explicitly requested",
    );
    expect(result.body).not.toContain("validate.ps1");
  });

  it("reports missing failure evidence without recreating validation", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          items: [
            queueItemSnapshot({
              id: "Q-DRAFT",
              status: "draft",
              title: "Draft item",
            }),
          ],
          selectedItem: queueItemSnapshot({
            id: "Q-DRAFT",
            status: "draft",
            title: "Draft item",
          }),
          selectedItemId: "Q-DRAFT",
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("what failed", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain("Queue item: Q-DRAFT - Draft item.");
    expect(result.body).toContain(
      "No failure evidence is available for this item.",
    );
    expect(result.body).toContain(
      "Open/refresh the Queue report or select the failed item.",
    );
    expect(result.body).not.toContain("validate.ps1");
  });
});
