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
    expect(executionText).toContain("View report");
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
    const nextActionText = sectionText("Next action");
    const resultText = sectionText("Result / Evidence");

    expect(overviewText).toContain("Execution complete. Result ready.");
    expect(overviewText).toContain("Awaiting review");
    expect(resultText).toContain("Report ready");
    expect(resultText).toContain("Report ready");
    expect(nextActionText).toContain("Review report and make coordinator decision");
    expect(nextActionText).toContain("Request changes");
    expect(nextActionText).toContain("Create follow-up");
    expect(nextActionText).toContain("Finalize / Accept");
    expect(resultText).not.toContain("Local executor unavailable");
    expect(nextActionText).not.toContain("Select local executor");
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

  it("surfaces Queue-generated draft Knowledge packs as actionable review items", async () => {
    const createKnowledgeDocument = vi.fn(async (request) => ({
      ...request,
      createdAt: "2026-05-22T10:02:00.000Z",
      knowledgeDocumentId: "doc_queue_1",
      scope: request.scope ?? "workspace",
      catalogItemType: request.catalogItemType ?? "documentation_knowledge",
      lifecycleStatus: request.lifecycleStatus ?? "active",
      quickSummary: request.quickSummary ?? "",
      sourceKind: request.sourceKind ?? "",
      sourceRef: request.sourceRef ?? "",
      updatedAt: "2026-05-22T10:02:00.000Z",
      workspaceId: "ws_1",
    }));
    const createSkill = vi.fn(async (request) => ({
      ...request,
      createdAt: "2026-05-22T10:02:00.000Z",
      skillId: "skill_queue_1",
      updatedAt: "2026-05-22T10:02:00.000Z",
      workspaceId: "ws_1",
    }));
    const recordKnowledgeDraftReview = vi.fn(async (request) => ({
      ...request,
      createdAt: request.reviewedAt,
      reviewId: `review_${request.proposedItemId}`,
      updatedAt: request.reviewedAt,
      workspaceId: "ws_1",
    }));
    const report = workerReport({
      rawReportPreview: JSON.stringify({
        draftPackId: "pack_queue_1",
        packTitle: "Generated Knowledge Pack",
        proposedItems: [
          {
            draftItemId: "draft_doc",
            fullContent: "Review generated Queue drafts in Knowledge / Skills.",
            quickSummary: "Queue draft review is explicit.",
            suggestedScope: "workspace-local",
            suggestedTags: ["queue", "knowledge"],
            suggestedType: "documentation_knowledge",
            title: "Queue draft review",
          },
          {
            draftItemId: "draft_skill",
            fullContent: "Inspect the Queue result before accepting it.",
            quickSummary: "Use when reviewing generated Queue drafts.",
            suggestedTags: "queue, review",
            suggestedType: "skill",
            title: "Review Queue draft packs",
          },
          {
            draftItemId: "draft_reject",
            fullContent: "This proposed item should remain unaccepted.",
            quickSummary: "Reject this generated draft.",
            suggestedType: "known_issue",
            title: "Rejected Queue draft",
          },
        ],
        queueItemId: "task_1",
      }),
      reportStatus: "completed",
    });
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onCreateSkill: createSkill,
      onRecordKnowledgeDraftReview: recordKnowledgeDraftReview,
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    const resultText = sectionText("Result / Evidence");

    expect(resultText).toContain("Knowledge draft pack");
    expect(resultText).toContain("Generated Knowledge Pack contains 3 draft item");
    expect(resultText).toContain("Queue draft review");
    expect(resultText).toContain("Review Queue draft packs");
    expect(resultText).toContain("Rejected Queue draft");
    expect(resultText).toContain(
      "Accepting creates Knowledge / Skills records only for selected items.",
    );
    expect(buttonByText("Copy draft payload")).toBeDefined();
    expect(buttonByText("Accept as Knowledge Document")).toBeDefined();
    expect(buttonByText("Accept as Skill")).toBeDefined();
    expect(buttonByText("Reject / leave unaccepted")).toBeDefined();

    await clickButtonAsync("Accept as Knowledge Document");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogItemType: "documentation_knowledge",
        content: "Review generated Queue drafts in Knowledge / Skills.",
        enabled: true,
        lifecycleStatus: "active",
        quickSummary: "Queue draft review is explicit.",
        scope: "workspace",
        sourceKind: "queue_draft",
        sourceLabel: "Queue task task_1",
        sourceRef: "queue:task_1;draft:draft_doc",
        tags: "queue, knowledge",
        title: "Queue draft review",
      }),
    );
    expect(recordKnowledgeDraftReview).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedKnowledgeDocumentId: "doc_queue_1",
        acceptedSkillId: null,
        action: "accepted",
        draftPackId: "pack_queue_1",
        proposedItemId: "draft_doc",
        proposedItemKey:
          "pack_queue_1|draft_doc|queue:task_1;draft:draft_doc",
        sourceFingerprint: "queue:task_1|pack:pack_queue_1|source:Queue task task_1",
        sourceQueueItemId: "task_1",
      }),
    );

    await clickButtonAsync("Accept as Skill");

    expect(createSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        prerequisites: "Queue task task_1\nSource ref: queue:task_1;draft:draft_skill",
        reviewStatus: "reviewed",
        steps: "Inspect the Queue result before accepting it.",
        tags: "queue, review",
        title: "Review Queue draft packs",
        whenToUse: "Use when reviewing generated Queue drafts.",
      }),
    );
    expect(recordKnowledgeDraftReview).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedKnowledgeDocumentId: null,
        acceptedSkillId: "skill_queue_1",
        action: "accepted",
        draftPackId: "pack_queue_1",
        proposedItemId: "draft_skill",
      }),
    );

    await clickButtonAsync("Reject / leave unaccepted");

    expect(sectionText("Result / Evidence")).toContain("Accepted");
    expect(sectionText("Result / Evidence")).toContain("Rejected for this review");
    expect(sectionText("Result / Evidence")).toContain("Not saved as Knowledge");
    expect(createKnowledgeDocument).toHaveBeenCalledTimes(1);
    expect(createSkill).toHaveBeenCalledTimes(1);
    expect(recordKnowledgeDraftReview).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedKnowledgeDocumentId: null,
        acceptedSkillId: null,
        action: "rejected",
        draftPackId: "pack_queue_1",
        proposedItemId: "draft_reject",
        rejectionReason: null,
      }),
    );
    expect(recordKnowledgeDraftReview).toHaveBeenCalledTimes(3);
  });

  it("reloads existing Queue draft review ledger decisions without creating hidden Knowledge", async () => {
    const createKnowledgeDocument = vi.fn();
    const createSkill = vi.fn();
    const listKnowledgeDraftReviews = vi.fn(async () => [
      {
        acceptedKnowledgeDocumentId: "doc_existing_1",
        acceptedSkillId: null,
        action: "accepted" as const,
        createdAt: "2026-05-22T10:02:00.000Z",
        draftPackId: "pack_queue_reopen",
        proposedItemId: "draft_doc",
        proposedItemKey:
          "pack_queue_reopen|draft_doc|queue:task_1;draft:draft_doc",
        rejectionReason: null,
        reviewedAt: "2026-05-22T10:02:00.000Z",
        reviewId: "review_existing_doc",
        sourceFingerprint:
          "queue:task_1|pack:pack_queue_reopen|source:Queue task task_1",
        sourceQueueItemId: "task_1",
        sourceRunId: null,
        updatedAt: "2026-05-22T10:02:00.000Z",
        workspaceId: "ws_1",
      },
      {
        acceptedKnowledgeDocumentId: null,
        acceptedSkillId: null,
        action: "rejected" as const,
        createdAt: "2026-05-22T10:03:00.000Z",
        draftPackId: "pack_queue_reopen",
        proposedItemId: "draft_reject",
        proposedItemKey:
          "pack_queue_reopen|draft_reject|queue:task_1;draft:draft_reject",
        rejectionReason: null,
        reviewedAt: "2026-05-22T10:03:00.000Z",
        reviewId: "review_existing_reject",
        sourceFingerprint:
          "queue:task_1|pack:pack_queue_reopen|source:Queue task task_1",
        sourceQueueItemId: "task_1",
        sourceRunId: null,
        updatedAt: "2026-05-22T10:03:00.000Z",
        workspaceId: "ws_1",
      },
    ]);
    const report = workerReport({
      rawReportPreview: JSON.stringify({
        draftPackId: "pack_queue_reopen",
        packTitle: "Reopened Knowledge Pack",
        proposedItems: [
          {
            draftItemId: "draft_doc",
            fullContent: "Already accepted draft.",
            quickSummary: "Already accepted.",
            suggestedType: "documentation_knowledge",
            title: "Accepted draft",
          },
          {
            draftItemId: "draft_reject",
            fullContent: "Already rejected draft.",
            quickSummary: "Already rejected.",
            suggestedType: "known_issue",
            title: "Rejected draft",
          },
        ],
        queueItemId: "task_1",
      }),
      reportStatus: "completed",
    });
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onCreateSkill: createSkill,
      onListKnowledgeDraftReviews: listKnowledgeDraftReviews,
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    await flushAsync();

    const resultText = sectionText("Result / Evidence");

    expect(listKnowledgeDraftReviews).toHaveBeenCalledWith({
      draftPackId: "pack_queue_reopen",
      sourceFingerprint:
        "queue:task_1|pack:pack_queue_reopen|source:Queue task task_1",
    });
    expect(resultText).toContain("Accepted");
    expect(resultText).toContain("Rejected for this review");
    expect(createKnowledgeDocument).not.toHaveBeenCalled();
    expect(createSkill).not.toHaveBeenCalled();
  });

  it("shows draft acceptance as unavailable when Queue lacks Knowledge create callbacks", () => {
    const report = workerReport({
      rawReportPreview: JSON.stringify({
        draftPackId: "pack_queue_unavailable",
        packTitle: "Unavailable Knowledge Pack",
        proposedItems: [
          {
            draftItemId: "draft_doc_unavailable",
            fullContent: "This draft cannot be accepted without the Knowledge API.",
            quickSummary: "Knowledge accept needs a create callback.",
            suggestedType: "documentation_knowledge",
            title: "Unavailable Knowledge draft",
          },
          {
            draftItemId: "draft_skill_unavailable",
            fullContent: "This skill draft cannot be accepted without the Skill API.",
            quickSummary: "Skill accept needs a create callback.",
            suggestedType: "skill",
            title: "Unavailable Skill draft",
          },
        ],
        queueItemId: "task_1",
      }),
      reportStatus: "completed",
    });
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "completed" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    const acceptDocument = buttonByText("Accept as Knowledge Document");
    const acceptSkill = buttonByText("Accept as Skill");
    const resultText = sectionText("Result / Evidence");

    expect(acceptDocument?.disabled).toBe(true);
    expect(acceptSkill?.disabled).toBe(true);
    expect(resultText).toContain(
      "Accept unavailable: Knowledge Document create API is not available in this Queue widget.",
    );
    expect(resultText).toContain(
      "Accept unavailable: Skill create API is not available in this Queue widget.",
    );
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
    const contextText = sectionText("Attached Queue task context");
    const activityText = sectionText("Activity");
    const resultText = sectionText("Result / Evidence");
    const nextActionText = sectionText("Next action");
    const fullResponse = detailsBySummary("Full response");
    const rawDirectWorkDetails = detailsBySummary("Raw Direct Work details");
    const developerDetails = detailsBySummary("Developer details");
    const overviewIndex = document.body.textContent?.indexOf("Overview") ?? -1;
    const nextActionIndex =
      document.body.textContent?.indexOf("Next action") ?? -1;
    const contextIndex =
      document.body.textContent?.indexOf("Context") ?? -1;
    const activityIndex =
      document.body.textContent?.indexOf("Activity") ?? -1;
    const resultIndex =
      document.body.textContent?.indexOf("Result / Evidence") ?? -1;
    const developerIndex =
      document.body.textContent?.lastIndexOf("Developer details") ?? -1;

    expect(overviewText).toContain("Execution complete");
    expect(overviewText).toContain("Awaiting review");
    expect(contextText).toContain("Task prompt");
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
    expect(nextActionText).toContain("Review report and make coordinator decision");
    expect(nextActionText).toContain("Request changes");
    expect(nextActionText).toContain("Create follow-up");
    expect(nextActionText).not.toContain("Finalize / Accept item");
    expect(activityText).toContain("Run completed");
    expect(activityText).toContain("Completed - final response received.");
    expect(activityText).toContain("Completed");
    expect(fullResponse).toBeUndefined();
    expect(rawDirectWorkDetails?.open).toBe(false);
    expect(developerDetails?.open).toBe(false);
    expect(overviewIndex).toBeGreaterThanOrEqual(0);
    expect(nextActionIndex).toBeGreaterThan(overviewIndex);
    expect(contextIndex).toBeGreaterThan(nextActionIndex);
    expect(resultIndex).toBeGreaterThan(contextIndex);
    expect(activityIndex).toBeGreaterThan(resultIndex);
    expect(developerIndex).toBeGreaterThan(activityIndex);
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
    expect(preview?.textContent).toContain("[Preview capped]");
    expect(fullResponse?.open).toBe(false);

    expect(fullResponse?.textContent).not.toContain(hiddenTail);

    act(() => {
      if (fullResponse) {
        fullResponse.open = true;
        fullResponse.dispatchEvent(new Event("toggle", { bubbles: true }));
      }
    });

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
    const activityText = sectionText("Activity");
    const resultText = sectionText("Result / Evidence");
    const nextActionText = sectionText("Next action");

    expect(overviewText).toContain("Execution complete");
    expect(overviewText).toContain("Result pending");
    expect(overviewText).not.toContain("Evidence missing");
    expect(overviewText).not.toContain("Review not ready");
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
    expect(nextActionText).toContain("Resolve finished run result");
    expect(nextActionText).toContain("Result not loaded");
    expect(nextActionText).not.toContain("Evidence missing");
    expect(nextActionText).toContain("Review is not ready");
    expect(resultText).toContain("Result not loaded");
    expect(resultText).toContain("Run result is not loaded");
    expect(resultText).not.toContain("Review is not ready");
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

async function clickButtonAsync(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text && !candidate.disabled,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
