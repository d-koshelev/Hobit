import { describe, expect, it, vi } from "vitest";
import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../queue/agentQueueWidgetApiTypes";
import {
  buildDiffReviewQueueItemCreateRequest,
  createDiffReviewQueueItem,
} from "./diffReviewQueueItemCreation";

describe("diffReviewQueueItemCreation", () => {
  it("creates a read-only Diff Review Queue item linked to the source task through the existing create action", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult({
        dependencies: request.dependencies ?? [],
        description: request.description ?? "",
        id: "review-1",
        itemType: request.itemType,
        prompt: request.prompt ?? "",
        title: request.title,
      }),
    );

    const result = await createDiffReviewQueueItem({
      createItem,
      fileChangeSummary: "2 changed file(s): src/queue.ts, src/queue.test.ts",
      now: () => "2026-06-10T12:00:00.000Z",
      report: workerReport(),
      sourceTask: queueTask(),
      validationEvidenceSummary: {
        commandCount: 1,
        errors: [],
        evidenceRefs: [
          {
            commandId: "typecheck",
            evidenceId: "validation-evidence-1",
            fullLogRef: "validation-report-1",
            runId: "validation-run-1",
            status: "passed",
          },
        ],
        failedCount: 0,
        needsReviewCount: 0,
        passedCount: 1,
        severity: "info",
        status: "passed",
        summary: "typecheck passed",
        title: "Validation passed",
        warnings: [],
      },
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem.mock.calls[0]?.[0]).toMatchObject({
      dependencies: ["source-1"],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
      title: "Diff Review - Implement Queue creation",
    });
    expect(createItem.mock.calls[0]?.[0].description).toContain(
      "Source task: source-1",
    );
    expect(createItem.mock.calls[0]?.[0].description).toContain(
      "Review type: diff_vs_report",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Read-only by default.",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Do not modify code",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Source task report summary/ref:",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Validation evidence summary/ref:",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Diff/file-change availability:",
    );
    expect(createItem.mock.calls[0]?.[0].prompt).toContain("Checklist:");
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Expected recommendation format:",
    );
    expect(result).toMatchObject({
      createdReviewTaskId: "review-1",
      createdReviewTaskTitle: "Diff Review - Implement Queue creation",
      metadata: {
        readonlyByDefault: true,
        reviewMode: "diff_vs_report",
        reviewType: "diff_review",
        sourceTaskId: "source-1",
      },
      sourceTaskId: "source-1",
      status: "created",
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "source_link_metadata_unsupported",
    ]);
  });

  it("returns visible warnings for missing diff, validation, report, and unsupported durable metadata", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult({
        dependencies: [],
        id: "review-1",
        title: request.title,
      }),
    );

    const result = await createDiffReviewQueueItem({
      createItem,
      sourceTask: queueTask({ workerExecutionReports: [] }),
    });

    expect(result.status).toBe("created");
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "missing_diff",
      "missing_report",
      "missing_validation",
      "source_link_metadata_unsupported",
      "dependency_relation_unsupported",
    ]);
    expect(result.prompt).toContain("diff unavailable, manual diff required");
    expect(result.prompt).toContain("validation evidence missing");
  });

  it("builds a create request without start, accept, finalize, or dependent unblock actions", () => {
    const built = buildDiffReviewQueueItemCreateRequest({
      fileChangeSummary: "1 file changed",
      report: workerReport(),
      sourceTask: queueTask(),
    });

    expect(built.request).toMatchObject({
      dependencies: ["source-1"],
      executionPolicy: "manual",
      itemType: "diff_review",
      status: "queued",
    });
    expect(JSON.stringify({ ...built.request, prompt: "" })).not.toMatch(
      /start|runAutonomous|finalize|accept|commit|push/i,
    );
    expect(built.request.prompt).toContain("Do not modify code");
    expect(built.request.prompt).toContain("unblock dependents");
  });

  it("reports Queue create failure without pretending a review task was created", async () => {
    const createItem = vi.fn(async () =>
      itemResult({
        error: {
          code: "create_failed",
          message: "Queue create failed",
        },
        item: undefined,
        ok: false,
      }),
    );

    const result = await createDiffReviewQueueItem({
      createItem,
      sourceTask: queueTask(),
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.createdReviewTaskId).toBeNull();
    expect(result.createdReviewTaskTitle).toBeNull();
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "queue_create_failed",
    );
  });
});

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-06-10T11:00:00.000Z",
    description: "Implementation source task.",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    itemType: "implementation",
    priority: 2,
    prompt: "Implement Queue creation.",
    queueItemId: "source-1",
    queueTagId: "implementation",
    queueTagName: "Implementation",
    status: "review_needed",
    title: "Implement Queue creation",
    updatedAt: "2026-06-10T11:30:00.000Z",
    validationStatus: "needs_review",
    workerExecutionReports: [workerReport()],
    workspaceId: "workspace-1",
    ...overrides,
  } as AgentQueueTask;
}

function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: ["src/queue.ts", "src/queue.test.ts"],
    commandsRun: ["npm test"],
    createdAt: "2026-06-10T11:20:00.000Z",
    errors: [],
    itemId: "source-1",
    rawReportPreview: "Implemented Queue creation and tests.",
    reportId: "report-1",
    reportStatus: "completed",
    summary: "Implementation completed with focused Queue changes.",
    validationCommandsRun: ["npm test"],
    validationCommandsSuggested: ["npm test"],
    validationResult: "passed",
    warnings: [],
    workerId: "executor-1",
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetActionResult<QueueWidgetItemSnapshot>> &
    Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item =
    overrides.item === undefined
      ? ({
          blockers: [],
          dependencies: [],
          description: "",
          evidenceSummary: {
            runRefs: [],
            status: "none",
          },
          executionPolicy: "manual",
          executionStatus: "queued",
          id: "review-1",
          itemType: "diff_review",
          priority: 2,
          prompt: "Prompt",
          queueId: "queue",
          queueTag: {
            id: "implementation",
            name: "Implementation",
          },
          reportSummary: {
            status: "none",
          },
          runLinks: [],
          status: "queued",
          title: "Diff Review - Implement Queue creation",
          workspaceId: "workspace-1",
          ...overrides,
        } as QueueWidgetItemSnapshot)
      : overrides.item;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: overrides.message ?? "Created",
    ok: overrides.ok ?? true,
    safetyClass: "safe_create_update",
    ...overrides,
  };
}
