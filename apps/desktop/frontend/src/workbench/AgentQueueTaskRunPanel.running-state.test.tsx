import { describe, expect, it } from "vitest";

import {
  autonomousController,
  detailsBySummary,
  executionSectionText,
  latestRunController,
  renderDetailsPanel,
  renderPanel,
  runActivityController,
  runController,
  sectionText,
} from "./AgentQueueTaskRunPanel.test-utils";
import {
  queueTask,
  runLink,
} from "./AgentQueueTaskRunPanel.test-fixtures";

describe("AgentQueueTaskRunPanel running state", () => {
  it("keeps manual Run task visible when Autonomous Queue is idle", () => {
    renderDetailsPanel({
      run: {
        ...runController(),
        canStart: true,
        executorSelectionMessage:
          "Local executor selected automatically: Local executor visible.",
        readinessMessage: null,
        repoRootDraft: "C:\\repo",
      },
      selectedTask: {
        ...queueTask(),
        approvalPolicy: "never",
        codexExecutable: "codex",
        executionWorkspace: "C:\\repo",
        sandbox: "read_only",
        status: "ready",
      },
    });

    const nextActionText = sectionText("Next action");

    expect(nextActionText).toContain("Run task");
    expect(nextActionText).toContain("Ready");
  });

  it("shows autonomous ownership instead of manual Run task while Autonomous Queue is active", () => {
    renderDetailsPanel({
      autonomous: autonomousController({
        status: "running",
      }),
      run: {
        ...runController(),
        canStart: true,
        executorSelectionMessage:
          "Local executor selected automatically: Local executor visible.",
        readinessMessage: null,
        repoRootDraft: "C:\\repo",
      },
      selectedTask: {
        ...queueTask(),
        approvalPolicy: "never",
        codexExecutable: "codex",
        executionWorkspace: "C:\\repo",
        sandbox: "read_only",
        status: "ready",
      },
    });

    const nextActionText = sectionText("Next action");

    expect(nextActionText).toContain("Queued for autonomous execution");
    expect(nextActionText).toContain("Autonomous runner will start this task.");
    expect(nextActionText).not.toContain("Run task");
  });

  it("shows running state without pre-run readiness blockers", () => {
    renderPanel({
      currentSelection: "",
      hasExecutorSlots: false,
      includeAdvancedDetails: false,
      latestRun: latestRunController(runLink({
        completedAt: null,
        directWorkRunId: "run_active_123456",
        executorWidgetId: "queue_owned_executor",
        startedAt: "2026-05-22T10:00:00.000Z",
        status: "running",
      })),
      run: {
        ...runController(),
        readinessMessage: "Local executor unavailable.",
        repoRootDraft: "",
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "running",
      },
    });

    const executionText = executionSectionText();

    expect(executionText).toContain("Agent activity");
    expect(executionText).toContain("Running - waiting for final response.");
    expect(executionText).toContain("Live events are shown in Activity.");
    expect(executionText).not.toContain("queue_owned_executor");
    expect(executionText).not.toContain("run_active_123456");
    expect(executionText).toContain("Refresh status");
    expect(executionText).not.toContain("Local executor unavailable");
    expect(executionText).not.toContain("Select local executor");
    expect(executionText).not.toContain("Assign");
    expect(executionText).not.toContain("Run task");
    expect(executionText).not.toContain("Before run");
    expect(executionText).not.toContain("Promote to queued");
    expect(executionText).not.toContain("Assignment locked");
  });

  it("prioritizes running status over selected-item pre-run blockers", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      status: "running" as const,
    };

    renderDetailsPanel({
      latestRun: latestRunController(runLink({
        completedAt: null,
        directWorkRunId: "run_active_123456",
        executorWidgetId: "queue_owned_executor",
        startedAt: "2026-05-22T10:00:00.000Z",
        status: "running",
      })),
      runActivity: runActivityController({
        currentMessage: "Running command: git status --short --branch",
        currentStage: "Running commands",
        lastCommand: "git status --short --branch",
        lastCommandStatus: "Running",
        rawEvents: [
          {
            codexThreadId: null,
            elapsedMs: 1000,
            errorMessage: null,
            eventKind: "codex_json_event",
            exitCode: null,
            failedStage: null,
            finalStatus: null,
            isFinal: false,
            line: "{\"type\":\"item.started\"}",
            parsedCodexEventType: "item.started",
            runId: "run_active_123456",
            status: null,
            stderrPreview: null,
            text: null,
            widgetInstanceId: "queue_owned_executor",
            workbenchId: "workbench-1",
            workspaceId: "workspace-1",
          },
        ],
        recentEvents: [
          {
            command: "git status --short --branch",
            id: "event-command",
            runId: "run_active_123456",
            severity: "info",
            sourceKind: "agent-executor",
            sourceLabel: "Queue local executor",
            sourceWidgetInstanceId: "queue_owned_executor",
            status: "running",
            summary: "Running git status --short --branch",
            timestamp: 1,
            timestampLabel: "1s",
            title: "Ran command",
            workspaceId: "workspace-1",
          },
        ],
        statusLine: "Running - waiting for final response.",
      }),
      run: {
        ...runController(),
        readinessMessage: "Local executor unavailable.",
        repoRootDraft: "",
      },
      selectedTask,
      tasks: [selectedTask],
    });

    const overviewText = sectionText("Selected task overview");
    const activityText = sectionText("Activity");
    const resultText = sectionText("Result / Evidence");
    const developerDetails = detailsBySummary("Developer details");

    expect(overviewText).toContain("Agent is working on this task.");
    expect(overviewText).toContain("Running");
    expect(overviewText).toContain("Current stage: Running commands.");
    expect(overviewText).not.toContain("queue_owned_executor");
    expect(overviewText).not.toContain("run_active_123456");
    expect(activityText).toContain("Running - waiting for final response.");
    expect(activityText).toContain("Current stageRunning commands");
    expect(activityText).toContain("Current eventRunning command: git status --short --branch");
    expect(activityText).toContain("Last commandgit status --short --branch");
    expect(activityText).toContain("Command statusRunning");
    expect(activityText).toContain("Refresh status");
    expect(resultText).toContain("Result will appear here when the run completes.");
    expect(document.body.textContent).not.toContain("Report pending");
    expect(document.body.textContent).not.toContain("Waiting for worker report");
    expect(document.body.textContent).not.toContain(
      "The local executor has not reported a final result yet",
    );
    expect(document.body.textContent).not.toContain("Coordinator decision");
    expect(document.body.textContent).not.toContain("Actions and settings");
    expect(document.body.textContent).not.toContain("Run task");
    expect(overviewText).not.toContain("Local executor unavailable");
    expect(activityText).not.toContain("Local executor unavailable");
    expect(resultText).not.toContain("Local executor unavailable");
    expect(developerDetails?.open).toBe(false);
    expect(developerDetails?.textContent).toContain("Raw Direct Work events");
  });
});
