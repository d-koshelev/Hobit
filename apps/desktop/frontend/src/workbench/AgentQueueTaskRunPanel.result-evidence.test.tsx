import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  buttonByText,
  clickFirstButton,
  detailsBySummary,
  executionSectionText,
  latestRunController,
  renderDetailsPanel,
  renderPanel,
  runActivityController,
  runController,
  runEvidenceController,
  runHistoryController,
  sectionText,
  workerReportController,
} from "./AgentQueueTaskRunPanel.test-utils";
import {
  queueTask,
  runDetail,
  runLink,
  workerReport,
} from "./AgentQueueTaskRunPanel.test-fixtures";

describe("AgentQueueTaskRunPanel result and evidence", () => {
  it("shows latest run status and source without raw payload fields", () => {
    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: "2026-05-22T10:01:00.000Z",
        directWorkRunId: "run_safe_123456",
        reviewStatus: "review_needed",
        source: "manual",
        status: "completed",
      })),
    });

    expect(document.body.textContent).toContain("completed");
    expect(document.body.textContent).toContain("manual");
    expect(document.body.textContent).not.toContain("stdout");
    expect(document.body.textContent).not.toContain("stderr");
    expect(document.body.textContent).not.toContain("final response");
    expect(document.body.textContent).not.toContain("diff");
    expect(document.body.textContent).not.toContain("repo_root");
    expect(document.body.textContent).not.toContain("operatorPrompt");
    expect(document.body.textContent).not.toContain("payloadJson");
  });

  it("shows recent safe run history status, source, and compact run ref", () => {
    renderPanel({
      latestRun: latestRunController(runLink({ status: "failed" })),
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_safe_recent_123456",
          linkId: "link_recent",
          source: "autorun",
          status: "failed",
        }),
      ]),
    });

    expect(document.body.textContent).toContain("Run history");
    expect(document.body.textContent).toContain("failed");
    expect(document.body.textContent).toContain("autorun");
    expect(document.body.textContent).toContain("Run 123456");
    expect(document.body.textContent).not.toContain("stdout");
    expect(document.body.textContent).not.toContain("final response");
    expect(document.body.textContent).not.toContain("diff");
  });

  it("limits run history to the latest three rows", () => {
    renderPanel({
      latestRun: latestRunController(runLink({ directWorkRunId: "run_1" })),
      runHistory: runHistoryController([
        runLink({ directWorkRunId: "run_1", linkId: "link_1" }),
        runLink({ directWorkRunId: "run_2", linkId: "link_2" }),
        runLink({ directWorkRunId: "run_3", linkId: "link_3" }),
        runLink({ directWorkRunId: "run_4", linkId: "link_4" }),
      ]),
    });

    expect(document.body.textContent).toContain("Showing latest 3 of 4 total runs.");
    expect(document.body.textContent).toContain("Run run1");
    expect(document.body.textContent).toContain("Run run2");
    expect(document.body.textContent).toContain("Run run3");
    expect(document.body.textContent).not.toContain("Run run4");
  });

  it("opens the owning Executor from the latest run using only safe refs", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: null,
        directWorkRunId: "run_safe_123456",
        reviewStatus: null,
        source: "autorun",
        status: "running",
      })),
      onOpenAgentExecutorRun,
    });

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open run detail",
    );

    act(() => {
      openButtons[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenAgentExecutorRun).toHaveBeenCalledWith({
      executorWidgetInstanceId: "executor_visible",
      runId: "run_safe_123456",
    });
  });

  it("opens the owning Executor from a history row using only safe refs", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      onOpenAgentExecutorRun,
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_history_safe_123456",
          linkId: "link_history",
        }),
      ]),
    });

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open run detail",
    );

    act(() => {
      openButtons[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenAgentExecutorRun).toHaveBeenCalledWith({
      executorWidgetInstanceId: "executor_visible",
      runId: "run_history_safe_123456",
    });
  });

  it("shows report-ready state without run or assignment controls", () => {
    renderPanel({
      currentSelection: "",
      hasExecutorSlots: false,
      includeAdvancedDetails: false,
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_done_123456",
        executorWidgetId: "queue_owned_executor",
        reviewStatus: "review_needed",
        status: "completed",
      })),
      run: {
        ...runController(),
        readinessMessage: "Local executor unavailable.",
        repoRootDraft: "",
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "completed",
        workerExecutionReports: [workerReport()],
      },
    });

    const executionText = executionSectionText();

    expect(executionText).toContain("Report ready");
    expect(executionText).toContain("Awaiting coordinator review");
    expect(executionText).toContain("View report");
    expect(executionText).toContain("Result stateReport ready");
    expect(executionText).toContain("Review stateAwaiting coordinator review");
    expect(executionText).not.toContain("queue_owned_executor");
    expect(executionText).not.toContain("run_done_123456");
    expect(executionText).not.toContain("Local executor unavailable");
    expect(executionText).not.toContain("Select local executor");
    expect(executionText).not.toContain("Assign");
    expect(executionText).not.toContain("Run task");
    expect(executionText).not.toContain("Before run");
    expect(executionText).not.toContain("Promote to queued");
  });

  it("shows completed reported tasks as awaiting coordinator review", () => {
    const report = workerReport();
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_done_123456",
        executorWidgetId: "queue_owned_executor",
        reviewStatus: "review_needed",
        status: "completed",
      })),
      run: {
        ...runController(),
        readinessMessage: "Local executor unavailable.",
        repoRootDraft: "",
      },
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    const overviewText = sectionText("Selected task overview");
    const resultText = sectionText("Result / Evidence");
    const decisionText = sectionText("Coordinator decision");

    expect(overviewText).toContain(
      "Next: review report and make coordinator decision.",
    );
    expect(resultText).toContain("Report ready");
    expect(resultText).toContain("Report ready");
    expect(decisionText).toContain("Awaiting coordinator review");
    expect(decisionText).toContain("Accept result");
    expect(decisionText).toContain("Request changes");
    expect(decisionText).toContain("Create follow-up");
    expect(decisionText).not.toContain("Finalize / Accept");
    expect(resultText).not.toContain("Local executor unavailable");
    expect(decisionText).not.toContain("Select local executor");
    expect(resultText).not.toContain("Before run");
  });

  it("shows worker report final response before secondary metadata", () => {
    const report = workerReport({
      rawReportPreview: "# AGENTS.md",
      reportStatus: "completed",
      validationResult: "passed",
    });
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        directWorkRunId: "run_done_123456",
        executorWidgetId: "queue_owned_executor",
        reviewStatus: "review_needed",
        status: "completed",
      })),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    const resultText = sectionText("Result / Evidence");
    const finalResponse = document.querySelector(".agent-queue-final-response-text");
    const reportMetadata = detailsBySummary("Report metadata");

    expect(resultText).toContain("Report ready");
    expect(resultText).toContain("Final response");
    expect(finalResponse?.textContent?.trim()).toBe("# AGENTS.md");
    expect(resultText).toContain("Files changed by this runNone");
    expect(resultText).toContain("StatusPassed");
    expect(resultText).toContain("Validationpassed");
    expect(resultText).not.toContain("No commands reported");
    expect(resultText.indexOf("Final response")).toBeLessThan(
      resultText.indexOf("Files changed by this run"),
    );
    expect(resultText.indexOf("Files changed by this run")).toBeLessThan(
      resultText.indexOf("StatusPassed"),
    );
    expect(resultText.indexOf("StatusPassed")).toBeLessThan(
      resultText.indexOf("Report metadata"),
    );
    expect(reportMetadata?.open).toBe(false);
  });

  it("shows completed Direct Work output as report evidence without finalizing", () => {
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
      run: {
        ...runController(),
        readinessMessage: "Local executor unavailable.",
        repoRootDraft: "",
      },
      runActivity: runActivityController({
        currentMessage: "Run completed.",
        currentStage: "Report ready",
        recentEvents: [
          {
            id: "event-completed",
            runId: "run_done_123456",
            severity: "success",
            sourceKind: "agent-executor",
            sourceLabel: "Queue local executor",
            sourceWidgetInstanceId: "queue_owned_executor",
            status: "completed",
            summary: "Agent run completed.",
            timestamp: 1,
            timestampLabel: "1s",
            title: "Completed run",
            workspaceId: "workspace-1",
          },
        ],
        statusLine: "Completed - final response received.",
      }),
      runEvidence: runEvidenceController(runDetail({
        finalMessage: "Final Direct Work response visible to coordinator.",
        resultPayload: JSON.stringify({
          agents_md: "# AGENTS.md",
          command_summary: ["codex", "exec", "--json"],
          changed_files: [],
          git_status_summary: "main...origin/main [ahead 1]",
          status: "completed",
          working_directory: "C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed",
        }),
        resultSummary: "Codex Direct Work stream completed",
      })),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const overviewText = sectionText("Selected task overview");
    const promptText = sectionText("Prompt summary");
    const activityText = sectionText("Agent activity");
    const resultText = sectionText("Result / Evidence");
    const decisionText = sectionText("Coordinator decision");
    const fullResponse = detailsBySummary("Full response");
    const rawDirectWorkDetails = detailsBySummary("Raw Direct Work details");
    const developerDetails = detailsBySummary("Developer details");
    const overviewIndex = document.body.textContent?.indexOf("Overview") ?? -1;
    const promptIndex =
      document.body.textContent?.indexOf("Prompt summary") ?? -1;
    const activityIndex =
      document.body.textContent?.indexOf("Agent activity") ?? -1;
    const resultIndex =
      document.body.textContent?.indexOf("Result / Evidence") ?? -1;
    const decisionIndex =
      document.body.textContent?.indexOf("Coordinator decision") ?? -1;
    const developerIndex =
      document.body.textContent?.lastIndexOf("Developer details") ?? -1;

    expect(overviewText).toContain("Execution complete");
    expect(overviewText).toContain("Awaiting coordinator review");
    expect(promptText).toContain("Prompt");
    expect(resultText).toContain("Report ready");
    expect(resultText).toContain("Final response");
    expect(resultText).toContain("StatusPassed");
    expect(resultText).toContain("Git statusmain...origin/main [ahead 1]");
    expect(resultText).toContain("Files changed by this runNone");
    expect(resultText).toContain("Final Direct Work response visible to coordinator.");
    expect(resultText).not.toContain("Working directory");
    expect(resultText).not.toContain("AGENTS.md first line");
    expect(resultText).not.toContain("codex exec --json");
    expect(resultText.indexOf("Final response")).toBeLessThan(
      resultText.indexOf("Files changed by this run"),
    );
    expect(resultText.indexOf("Files changed by this run")).toBeLessThan(
      resultText.indexOf("StatusPassed"),
    );
    expect(resultText).not.toContain(
      "Evidence summary for coordinator review. Raw output is collapsed below.",
    );
    expect(resultText).not.toContain("Command summary:");
    expect(resultText).not.toContain("No commands reported");
    expect(resultText).not.toContain(
      "Execution completion is evidence for coordinator review.",
    );
    expect(resultText).not.toContain("No report");
    expect(resultText).not.toContain("No worker report");
    expect(decisionText).toContain("Awaiting coordinator review");
    expect(decisionText).toContain("Accept result");
    expect(decisionText).toContain("Request changes");
    expect(decisionText).toContain("Create follow-up");
    expect(decisionText).not.toContain("Finalize / Accept item");
    expect(activityText).toContain("Run completed");
    expect(activityText).toContain("Completed - final response received.");
    expect(activityText).toContain("Report ready");
    expect(fullResponse).toBeUndefined();
    expect(rawDirectWorkDetails?.open).toBe(false);
    expect(developerDetails?.open).toBe(false);
    expect(overviewIndex).toBeGreaterThanOrEqual(0);
    expect(promptIndex).toBeGreaterThan(overviewIndex);
    expect(activityIndex).toBeGreaterThan(promptIndex);
    expect(resultIndex).toBeGreaterThan(activityIndex);
    expect(decisionIndex).toBeGreaterThan(resultIndex);
    expect(developerIndex).toBeGreaterThan(decisionIndex);
  });

  it("shows a short Direct Work final response fully in Result / Evidence", () => {
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
      runEvidence: runEvidenceController(runDetail({
        finalMessage: "# AGENTS.md",
        resultPayload: JSON.stringify({
          changed_files: [],
          status: "completed",
        }),
      })),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const resultText = sectionText("Result / Evidence");
    const finalResponse = document.querySelector(".agent-queue-final-response-text");

    expect(resultText).toContain("Report ready");
    expect(resultText).toContain("Final response");
    expect(finalResponse?.textContent?.trim()).toBe("# AGENTS.md");
    expect(resultText).toContain("Files changed by this runNone");
    expect(detailsBySummary("Full response")).toBeUndefined();
  });

  it("previews a long Direct Work final response with collapsed full response", () => {
    const hiddenTail = "full response tail stays in details";
    const longResponse = `Result start\n${"A".repeat(820)}\n${hiddenTail}`;
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
      runEvidence: runEvidenceController(runDetail({
        finalMessage: longResponse,
        resultPayload: JSON.stringify({
          changed_files: [],
          status: "completed",
        }),
      })),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const preview = document.querySelector(".agent-queue-final-response-text");
    const fullResponse = detailsBySummary("Full response");

    expect(preview?.textContent).toContain("Result start");
    expect(preview?.textContent).not.toContain(hiddenTail);
    expect(preview?.textContent?.trim().endsWith("...")).toBe(true);
    expect(fullResponse?.open).toBe(false);
    expect(fullResponse?.textContent).toContain(hiddenTail);
  });

  it("shows completed tasks without evidence as not ready for coordinator review", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      prompt: [
        "Hobit Queue UX block: Q-UX-08B",
        "",
        "Mode:",
        "frontend-only right rail state/copy fix",
        "",
        "Objective:",
        "Fix contradictory post-run states in the Agent Queue selected-item right rail. Keep runtime unchanged.",
        "",
        "Expected report:",
        "* Status",
        "* Files changed",
      ].join("\n"),
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
        error: "Direct Work result was not found.",
        isLoading: false,
      }),
      runActivity: runActivityController({
        currentMessage: "Run completed.",
        currentStage: "Report ready",
        recentEvents: [
          {
            id: "event-completed-missing-evidence",
            runId: "run_done_123456",
            severity: "success",
            sourceKind: "agent-executor",
            sourceLabel: "Queue local executor",
            sourceWidgetInstanceId: "queue_owned_executor",
            status: "completed",
            summary: "Agent run completed.",
            timestamp: 1,
            timestampLabel: "1s",
            title: "Completed run",
            workspaceId: "workspace-1",
          },
        ],
        statusLine: "Completed - final response received.",
      }),
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(null),
    });

    const overviewText = sectionText("Selected task overview");
    const activityText = sectionText("Agent activity");
    const resultText = sectionText("Result / Evidence");

    expect(overviewText).toContain("Execution complete");
    expect(overviewText).toContain("Evidence missing");
    expect(overviewText).toContain("Review not ready");
    expect(overviewText).not.toContain("Awaiting coordinator review");
    const promptSummaryText =
      document.querySelector(".agent-queue-prompt-preview-text")?.textContent ??
      "";

    expect(promptSummaryText).toContain("Hobit Queue UX block: Q-UX-08B");
    expect(promptSummaryText).toContain("Mode: frontend-only right rail state/copy fix");
    expect(promptSummaryText).toContain(
      "Objective: Fix contradictory post-run states in the Agent Queue selected-item right rail.",
    );
    expect(promptSummaryText).not.toContain("Expected report");
    expect(promptSummaryText).not.toContain("Files changed");
    expect(detailsBySummary("Full prompt")?.open).toBe(false);
    expect(resultText).toContain("Evidence missing");
    expect(resultText).toContain("No run evidence attached");
    expect(resultText).toContain("Review is not ready");
    expect(resultText).toContain("Direct Work result was not found.");
    expect(resultText).not.toContain("Report ready");
    expect(activityText).toContain("Report ready");
    expect(activityText).toContain("Run completed");
    expect(document.body.textContent).not.toContain("Coordinator decision");
    expect(buttonByText("Accept result")).toBeUndefined();
    expect(buttonByText("Create follow-up")).toBeDefined();
    expect(detailsBySummary("Developer details")?.open).toBe(false);
  });

  it("renders worker report evidence without finalizing the task", () => {
    const report = workerReport({
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
      commandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
      commitHash: "abc1234",
      errors: ["One focused test still fails."],
      followUpRecommendation: "Create a follow-up/sub-block for the failing test.",
      rollbackRecommendation: "Review before any rollback decision.",
      validationCommandsSuggested: ["npm.cmd run test --prefix apps/desktop/frontend"],
      warnings: ["Diff review is still required."],
    });
    const onAttachDemoReport = vi.fn();
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "queued" as const,
      validationStatus: "not_started" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report, onAttachDemoReport),
    });

    expect(document.body.textContent).toContain("Worker execution report");
    expect(document.body.textContent).toContain("Reported");
    expect(document.body.textContent).toContain("Awaiting review");
    expect(document.body.textContent).toContain("Worker report summary");
    expect(document.body.textContent).toContain("QueueReport.tsx");
    expect(document.body.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );
    expect(document.body.textContent).toContain("Diff review is still required.");
    expect(document.body.textContent).toContain("One focused test still fails.");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain(
      "Follow-up/sub-block recommendation",
    );
    expect(document.body.textContent).toContain("Rollback recommendation");
    expect(document.body.textContent).toContain(
      "Worker reports do not finalize Queue item status.",
    );
    expect(document.body.textContent).toContain("Queued");
    expect(document.body.textContent).toContain("Not started");

    clickFirstButton("Attach another report");

    expect(onAttachDemoReport).toHaveBeenCalledTimes(1);
  });
});
