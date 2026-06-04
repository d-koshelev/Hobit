import { describe, expect, it } from "vitest";

import {
  latestRunController,
  renderDetailsPanel,
  runEvidenceController,
  sectionText,
  workerReportController,
} from "./AgentQueueTaskRunPanel.test-utils";
import {
  queueTask,
  runDetail,
  runLink,
  workerReport,
} from "./AgentQueueTaskRunPanel.test-fixtures";

describe("AgentQueueTaskRunPanel failure and error display", () => {
  it("shows loading result while Direct Work evidence is being fetched", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [],
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_done_123456",
        executorWidgetId: "queue_owned_executor",
        reviewStatus: "review_needed",
        status: "completed",
      })),
      runEvidence: runEvidenceController(null, {
        error: "Unable to load Direct Work result evidence.",
        isLoading: true,
      }),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const reportText = sectionText("Result / Evidence");

    expect(reportText).toContain("Evidence missing");
    expect(reportText).toContain("Loading run result...");
    expect(reportText).not.toContain("Unable to load Direct Work result evidence.");
    expect(reportText).not.toContain("No report");
  });

  it("shows Direct Work evidence errors only after loading fails", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [],
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_done_123456",
        executorWidgetId: "queue_owned_executor",
        reviewStatus: "review_needed",
        status: "completed",
      })),
      runEvidence: runEvidenceController(null, {
        error: "Unable to load Direct Work result evidence.",
        isLoading: false,
      }),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const reportText = sectionText("Result / Evidence");

    expect(reportText).toContain("Evidence missing");
    expect(reportText).toContain("No run evidence attached.");
    expect(reportText).toContain("Unable to load Direct Work result evidence.");
    expect(reportText).toContain("Refresh result");
    expect(reportText).not.toContain("No report");
  });

  it("shows failed Direct Work output visibly as run evidence", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "failed" as const,
      workerExecutionReports: [],
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_failed_123456",
        executorWidgetId: "queue_owned_executor",
        status: "failed",
      })),
      runEvidence: runEvidenceController(runDetail({
        errorMessage: "Codex executable not found.",
        finalMessage: null,
        resultPayload: JSON.stringify({
          command_summary: ["codex", "exec", "--json"],
        }),
        resultStatus: "failed",
        resultSummary: "Codex Direct Work stream failed",
        stderrPreview: "Codex executable not found.",
        stdoutPreview: null,
        summary: {
          ...runDetail().summary,
          status: "failed",
        },
      })),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const decisionText = sectionText("Coordinator decision");
    const reportText = sectionText("Result / Evidence");

    expect(decisionText).toContain("Accept result");
    expect(decisionText).toContain("Request changes");
    expect(decisionText).toContain("Create follow-up");
    expect(reportText).toContain("Run failed");
    expect(reportText).toContain("Failure summary");
    expect(reportText).toContain("StatusFailed");
    expect(reportText).toContain("ErrorCodex executable not found.");
    expect(reportText).toContain("OutputCodex Direct Work stream failed");
    expect(reportText).not.toContain("Failed command");
    expect(reportText).not.toContain("codex exec --json");
    expect(reportText).not.toContain("Final error");
    expect(reportText).not.toContain(
      "Evidence summary for coordinator review. Raw output is collapsed below.",
    );
    expect(reportText).toContain("Codex executable not found.");
    expect(reportText).not.toContain("No report");
  });
});
