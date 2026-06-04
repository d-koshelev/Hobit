import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskDetailsPanel } from "./AgentQueueTaskDetailsPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueAutonomousController,
  AgentQueueExecutionPlanController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunActivityController,
  AgentQueueRunController,
  AgentQueueRunEvidenceController,
  AgentQueueRunHistoryController,
  AgentQueueRunnerController,
  AgentQueueWorkerReportController,
} from "./queue/useAgentQueueController";
import {
  queueDependencyStatesByTask,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { getAssignedWorkerRoutingStates } from "./queue/agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
} from "./queue/agentQueueSchedulerModel";
import type { AgentExecutorSlot } from "./types";
import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueReportActionCard,
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("AgentQueueTaskRunPanel latest run summary", () => {
  it("renders a generated plan preview without starting execution", () => {
    const onGenerate = vi.fn();

    renderPanel({
      executionPlan: executionPlanController(planPreview(), onGenerate),
    });

    expect(document.body.textContent).toContain("Plan preview");
    expect(document.body.textContent).toContain("Plan ready");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain("Inspect the current implementation");
    expect(document.body.textContent).toContain(
      "npm.cmd run test --prefix apps/desktop/frontend",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows a no-run state when the selected task has no run link", () => {
    renderPanel({
      latestRun: latestRunController(null),
      runHistory: runHistoryController([]),
    });

    expect(document.body.textContent).toContain("Latest run");
    expect(document.body.textContent).toContain("Run history");
    expect(document.body.textContent).toContain("No runs yet.");
  });

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

  it("shows a compact disabled reason when the owning Executor is not visible", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      executorSlots: [],
      hasExecutorSlots: false,
      latestRun: latestRunController(runLink({
        executorWidgetId: "executor_missing",
      })),
      runHistory: runHistoryController([
        runLink({
          executorWidgetId: "executor_missing",
          linkId: "link_missing",
        }),
      ]),
      onOpenAgentExecutorRun,
    });

    expect(document.body.textContent).toContain(
      "Owning local executor is not visible on this Workbench.",
    );
    expect(document.body.textContent).toContain("Local executor not visible");

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open run detail",
    );

    expect(openButtons).toHaveLength(2);
    expect(openButtons.every((button) => button.disabled)).toBe(true);
    act(() => {
      openButtons.forEach((button) =>
        button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
      );
    });
    expect(onOpenAgentExecutorRun).not.toHaveBeenCalled();
  });

  it("warns and prevents assignment when the selected worker scope does not match the task tag", () => {
    const onAssign = vi.fn();

    renderPanel({
      onAssign,
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        queueTagId: "default",
        queueTagName: "Default",
      },
      workers: [
        {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
          name: "Local executor visible",
          scope: {
            kind: "queue_tag",
            queueTagId: "review",
            queueTagName: "Review",
          },
          status: "idle",
          workerId: "executor_visible",
        },
      ],
    });

    expect(document.body.textContent).toContain(
      "Selected worker is scoped to Review.",
    );
    clickFirstButton("Assign");

    expect(onAssign).not.toHaveBeenCalled();
  });

  it("shows danger_full_access as an explicit unsafe Queue run sandbox", () => {
    renderPanel({
      run: {
        ...runController(),
        readinessMessage: null,
        sandbox: "danger_full_access",
      },
    });

    expect(document.body.textContent).toContain("danger_full_access");
    expect(document.body.textContent).toContain("Unsafe local dev mode.");
    expect(detailsBySummary("Developer details")?.open).toBe(false);
    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe",
    );
    expect(document.body.textContent).toContain(
      "disables Codex sandbox restrictions",
    );
    expect(document.body.textContent).toContain("will still not auto-commit");
  });

  it("shows compact selected-run blocker rows", () => {
    renderPanel({
      currentSelection: "",
      executorSlots: [],
      hasExecutorSlots: false,
      run: {
        ...runController(),
        codexExecutableDraft: "",
        readinessMessage: null,
        repoRootDraft: "",
        sandbox: "read_only",
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "draft",
      },
    });

    expect(document.body.textContent).toContain("Before run");
    expect(document.body.textContent).toContain("Run task");
    expect(document.body.textContent).toContain("Local executor unavailable");
    expect(document.body.textContent).toContain("Set task workspace");
    expect(document.body.textContent).toContain("Set Codex executable");
    expect(document.body.textContent).toContain("read_only");
    expect(document.body.textContent).toContain("Promote to queued");
    expect(document.body.textContent).not.toContain("Enable queue");
    expect(document.body.textContent).not.toContain("Select danger_full_access");
    expect(document.body.textContent).not.toContain(
      "Click Enable before running the selected task.",
    );

    const advancedSettings = detailsBySummary("Execution settings");

    expect(advancedSettings?.open).toBe(true);
    expect(detailsBySummary("Developer details")?.open).toBe(false);
  });

  it("exposes draft promotion without starting execution", () => {
    const onPromoteDraftToQueued = vi.fn();

    renderPanel({
      canPromoteDraftToQueued: true,
      onPromoteDraftToQueued,
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "draft",
      },
    });

    clickFirstButton("Promote to queued");

    expect(onPromoteDraftToQueued).toHaveBeenCalledTimes(1);
  });

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

  it("shows automatic executor selection without requiring visible Assign", () => {
    renderPanel({
      currentSelection: "executor_visible",
      run: {
        ...runController(),
        executorSelectionMessage:
          "Local executor selected automatically: Local executor visible.",
        readinessMessage: null,
        repoRootDraft: "C:\\repo",
        sandbox: "danger_full_access",
        usesDefaultExecutorOnStart: true,
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "ready",
      },
    });

    expect(document.body.textContent).toContain(
      "Local executor selected automatically: Local executor visible.",
    );
    expect(document.body.textContent).toContain(
      "Ready to run once the operator starts it explicitly.",
    );
    expect(document.body.textContent).toContain("Advanced executor override");

    const assignButton = buttonByText("Assign");

    expect(assignButton).not.toBeUndefined();
    expect(
      assignButton?.closest("details")?.querySelector("summary")?.textContent,
    ).toBe("Advanced executor override");
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
    expect(executionText).toContain(
      "Live events are shown in the selected task Agent activity panel.",
    );
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
});

describe("AgentQueueTaskDetailsPanel expanded detail", () => {
  it("shows expanded header metadata, prompt, and expected plan without starting execution", () => {
    const onGenerate = vi.fn();
    const onStartAssignedTask = vi.fn();
    const selectedTask = {
      ...queueTask(),
      description: "Implementation details",
      executionPlanPreview: planPreview(),
      queueTagId: "implementation",
      queueTagName: "Implementation",
      title: "Expanded queue detail",
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(
        selectedTask.executionPlanPreview,
        onGenerate,
      ),
      run: {
        ...runController(),
        onStartAssignedTask,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Overview");
    expect(document.body.textContent).toContain("Expanded queue detail");
    expect(document.body.textContent).toContain("Implementation");
    expect(document.body.textContent).toContain("Priority P1");
    expect(document.body.textContent).toContain("Executor");
    expect(document.body.textContent).toContain("Submitted metadata");
    expect(document.body.textContent).toContain("Prompt");
    expect(document.body.textContent).toContain("Expected plan of work");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain(
      "Structured metadata only; never appended to the prompt.",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("orders the selected rail as overview, prompt, actions, agent activity, evidence, then developer details", () => {
    renderDetailsPanel();

    const text = document.body.textContent ?? "";
    const overviewIndex = text.indexOf("Overview");
    const promptIndex = text.indexOf("Prompt");
    const actionsIndex = text.indexOf("Actions and settings");
    const activityIndex = text.indexOf("Agent activity");
    const evidenceIndex = text.indexOf("Result / Evidence");
    const developerIndex = text.indexOf("Developer details");

    expect(overviewIndex).toBeGreaterThanOrEqual(0);
    expect(promptIndex).toBeGreaterThan(overviewIndex);
    expect(actionsIndex).toBeGreaterThan(promptIndex);
    expect(activityIndex).toBeGreaterThan(actionsIndex);
    expect(evidenceIndex).toBeGreaterThan(activityIndex);
    expect(developerIndex).toBeGreaterThan(evidenceIndex);
    expect(detailsBySummary("Developer details")?.open).toBe(false);
  });

  it("explains that a new draft prompt item needs a ready state before execution", () => {
    const onStartEdit = vi.fn();
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      executionPlanPreview: null,
      status: "draft" as const,
      title: "Prompt implementation draft",
    };

    renderDetailsPanel({
      editTask: editController({ onStart: onStartEdit }),
      run: {
        ...runController(),
        readinessMessage:
          "Draft tasks can stay in planning without an execution workspace. Set status to queued, ready, or review needed before configuring execution.",
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Promote to queued");
    expect(document.body.textContent).toContain("Draft task.");
    expect(document.body.textContent).toContain("No run evidence attached.");

    clickFirstButton("Edit status");

    expect(onStartEdit).toHaveBeenCalledTimes(1);
  });

  it("does not show a Ready badge when run settings are missing", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: "executor_visible",
      status: "ready" as const,
    };

    renderDetailsPanel({
      run: {
        ...runController(),
        preconditionMessages: ["Set workspace."],
        readinessMessage: null,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    const nextActionText = sectionText("Next action");

    expect(nextActionText).toContain("Set run settings");
    expect(nextActionText).toContain("Set workspace.");
    expect(nextActionText).toContain("Not configured");
    expect(nextActionText).not.toContain("Ready");
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
    const activityText = sectionText("Agent activity");
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

  it("shows stale and no-plan expected plan states", () => {
    const staleTask = {
      ...queueTask(),
      executionPlanPreview: planPreview({ status: "stale" }),
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(staleTask.executionPlanPreview),
      selectedTask: staleTask,
      tasks: [staleTask],
    });

    expect(document.body.textContent).toContain("Plan stale");
    expect(document.body.textContent).toContain("This plan is stale.");

    root?.unmount();
    container?.remove();
    root = null;
    container = null;
    document.body.innerHTML = "";

    const noPlanTask = queueTask();
    renderDetailsPanel({
      executionPlan: executionPlanController(null),
      selectedTask: noPlanTask,
      tasks: [noPlanTask],
    });

    expect(document.body.textContent).toContain("No expected plan has been generated.");
    expect(document.body.textContent).toContain("Generate plan preview");
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

    const decisionText = sectionText("Coordinator decision");

    expect(decisionText).toContain("Coordinator decision");
    expect(decisionText).toContain("Ready for finalization");
    expect(decisionText).toContain("Accept result");
    expect(decisionText).toContain("Request changes");
    expect(decisionText).toContain("Create follow-up");
    expect(decisionText).toContain("More");
    expect(decisionText).toContain("Mark rollback required");
    expect(decisionText).not.toContain("Finalize / Accept item");
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

function renderPanel(
  overrides: Partial<ComponentProps<typeof AgentQueueTaskRunPanel>>,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const queueTags = overrides.queueTags ?? [
    {
      queueTagId: "default",
      queueTagName: "Default",
      coordinatorReviewCount: 0,
      failedValidationCount: 0,
      needsCoordinatorReview: false,
      needsReviewCount: 0,
      pauseReason: null,
      runningCount: 0,
      status: "running" as const,
      taskCount: 1,
      validatingCount: 0,
    },
  ];

  act(() => {
    root?.render(
      <AgentQueueTaskRunPanel
        apiAvailable={true}
        assignmentError={null}
        assignmentMessage={null}
        autorun={autorunController()}
        currentSelection="executor_visible"
        executorSlots={executorSlots()}
        executionPlan={executionPlanController(null)}
        hasExecutorSlots={true}
        inputId="executor-select"
        isAssigning={false}
        isDirty={false}
        latestRun={latestRunController(null)}
        onAssign={vi.fn()}
        onClear={vi.fn()}
        onPromoteDraftToQueued={vi.fn()}
        onOpenAgentExecutorRun={vi.fn()}
        onSelectionChange={vi.fn()}
        canPromoteDraftToQueued={false}
        run={runController()}
        runHistory={runHistoryController([])}
        runner={runnerController()}
        selectedTask={queueTask()}
        workers={[
          {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
            name: "Local executor visible",
            scope: { kind: "all" },
            status: "idle",
            workerId: "executor_visible",
          },
        ]}
        {...overrides}
        queueTags={queueTags}
      />,
    );
  });
}

function renderDetailsPanel({
  autonomous = autonomousController(),
  editTask = editController(),
  executionPlan = executionPlanController(null),
  latestRun = latestRunController(null),
  onShowQueueReportInWorkspaceChat,
  reportActionCard,
  run = runController(),
  runActivity = runActivityController(),
  runEvidence = runEvidenceController(null),
  runHistory = runHistoryController([]),
  selectedTask = queueTask(),
  tasks = [selectedTask],
  workerReport = workerReportController(
    selectedTask.workerExecutionReports?.[
      (selectedTask.workerExecutionReports?.length ?? 0) - 1
    ] ?? null,
  ),
  diffReview,
}: {
  autonomous?: AgentQueueAutonomousController;
  diffReview?: ComponentProps<typeof AgentQueueTaskDetailsPanel>["queue"]["diffReview"];
  editTask?: ReturnType<typeof editController>;
  executionPlan?: AgentQueueExecutionPlanController;
  latestRun?: AgentQueueLatestRunLinkController;
  onShowQueueReportInWorkspaceChat?: ComponentProps<
    typeof AgentQueueTaskDetailsPanel
  >["onShowQueueReportInWorkspaceChat"];
  reportActionCard?: ComponentProps<
    typeof AgentQueueTaskDetailsPanel
  >["queue"]["reportActionCard"];
  run?: AgentQueueRunController;
  runActivity?: AgentQueueRunActivityController;
  runEvidence?: AgentQueueRunEvidenceController;
  runHistory?: AgentQueueRunHistoryController;
  selectedTask?: AgentQueueTask;
  tasks?: AgentQueueTask[];
  workerReport?: AgentQueueWorkerReportController;
} = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const dependencyStates = queueDependencyStatesByTask(tasks);
  const workers = [
    {
      currentItemId: selectedTask.status === "running" ? selectedTask.queueItemId : null,
      displayOrder: 0,
      enabled: true,
      lastReportSummary: null,
      name: "Local executor visible",
      scope: { kind: "all" as const },
      status: selectedTask.status === "running" ? "running" as const : "idle" as const,
      workerId: "executor_visible",
    },
  ];
  const schedulerPlan = buildAgentQueueSchedulerPlan({
    dependencyStates,
    globalExecutionState: "started",
    pausedQueueTagIds: new Set(),
    tasks,
    workers,
  });
  const queueTags = [
    {
      coordinatorReviewCount: 0,
      failedValidationCount: 0,
      needsCoordinatorReview: false,
      needsReviewCount: 0,
      pauseReason: null,
      queueTagId: selectedTask.queueTagId ?? "default",
      queueTagName: selectedTask.queueTagName ?? "Default",
      runningCount: selectedTask.status === "running" ? 1 : 0,
      status: "running" as const,
      taskCount: tasks.length,
      validatingCount: selectedTask.validationStatus === "validating" ? 1 : 0,
    },
  ];
  const queue = {
    agentExecutorSlots: executorSlots(),
    apiAvailable: true,
    assignedWorkerRoutingStates: getAssignedWorkerRoutingStates(tasks, workers, {
      dependencyStates,
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      tasks,
    }),
    assignSelectedTask: vi.fn(),
    assignmentApiAvailable: true,
    assignmentError: null,
    assignmentMessage: null,
    autorun: autorunController(),
    autonomous,
    clearSelectedTaskAssignment: vi.fn(),
    createTask: vi.fn(),
    deleteTask: deleteController(),
    diffReview: diffReview ?? {
      canCreate: false,
      linkedReviewTasks: tasks.filter(
        (task) => task.diffReview?.sourceItemId === selectedTask.queueItemId,
      ),
      message: null,
      onCreate: vi.fn(),
    },
    dependencyStates,
    draft: draftFromTask(selectedTask),
    editTask,
    draftPromotion: {
      canPromote: selectedTask.status === "draft",
      isPromoting: false,
      onPromote: vi.fn(),
    },
    editorError: null,
    executionPlan,
    filteredTasks: tasks,
    coordinatorFinalization: {
      canAct: true,
      message: null,
      onAcceptWithoutCommit: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize: vi.fn(),
      onMarkBlocked: vi.fn(),
      onMarkFailedRejected: vi.fn(),
      onMarkFollowUpRequired: vi.fn(),
      onMarkNeedsChanges: vi.fn(),
      onMarkReadyForFinalization: vi.fn(),
      onMarkRollbackRequired: vi.fn(),
      status: selectedTask.coordinatorStatus ?? "not_reported",
    },
    foundation: {
      embeddedExecutor: buildAgentQueueEmbeddedExecutorSection({
        dependencyStates,
        maxExecutors: 1,
        schedulerPlan,
        tasks,
        workers,
      }),
      globalExecutionState: "started" as const,
      globalMessage: null,
      globalStatus: "started" as const,
      maxExecutorMessage: null,
      onCreateQueueTag: vi.fn(),
      onCreateWorker: vi.fn(),
      onDeleteQueueTag: vi.fn(),
      onDeleteWorker: vi.fn(),
      onMaxExecutorsChange: vi.fn(),
      onPauseQueueTag: vi.fn(),
      onRenameQueueTag: vi.fn(),
      onRenameWorker: vi.fn(),
      onResumeQueueTag: vi.fn(),
      onStartWorkers: vi.fn(),
      onStopAndKillRunning: vi.fn(),
      onStopWorkers: vi.fn(),
      onWorkerEnabledChange: vi.fn(),
      onWorkerScopeChange: vi.fn(),
      pausedQueueTagIds: new Set<string>(),
      queueTags,
      schedulerPlan,
      tagManagementError: null,
      tagManagementMessage: null,
      validationSummary: {
        failed: 0,
        needs_review: 0,
        not_started: 0,
        passed: 0,
        validating: 0,
      },
      workers,
    },
    isAssigning: false,
    isCreating: false,
    isDirty: false,
    isEditing: false,
    isLoading: false,
    isSaving: false,
    isSelecting: false,
    latestRun,
    loadError: null,
    ordering: {
      canMoveDown: false,
      canMoveToBottom: false,
      canMoveToTop: false,
      canMoveUp: false,
      message: null,
      onMoveDown: vi.fn(),
      onMoveToBottom: vi.fn(),
      onMoveToTop: vi.fn(),
      onMoveUp: vi.fn(),
      orderLabel: "1 of 1",
    },
    refreshTasks: vi.fn(),
    reportActionCard: {
      diffReviewReportCard: null,
      latestShownCardId: selectedTask.workspaceChatReportCardId ?? null,
      message: null,
      onShown: vi.fn(),
      workerReportCard: null,
      ...reportActionCard,
    },
    run,
    runActivity,
    runEvidence,
    runHistory,
    runner: runnerController(),
    saveStateText: "Saved",
    saveTask: vi.fn(),
    selectExecutorWidget: vi.fn(),
    selectedExecutorWidgetId: "executor_visible",
    selectedTask,
    selectTask: vi.fn(),
    setStatusFilter: vi.fn(),
    statusFilter: "all" as const,
    tasks,
    updateDraft: vi.fn(),
    updatePriority: vi.fn(),
    validationMessage: null,
    workerReport,
  } as unknown as ComponentProps<typeof AgentQueueTaskDetailsPanel>["queue"];

  act(() => {
    root?.render(
      <AgentQueueTaskDetailsPanel
        agentExecutorSlots={executorSlots()}
        assignmentInputId="assignment"
        descriptionInputId="description"
        executionPolicyInputId="execution-policy"
        priorityInputId="priority"
        promptInputId="prompt"
        queue={queue}
        onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
        selectedTaskHint="Task hint"
        statusInputId="status"
        titleInputId="title"
      />,
    );
  });
}

function draftFromTask(task: AgentQueueTask): TaskDraft {
  return {
    dependsOn: task.dependsOn ?? [],
    approvalPolicy: task.approvalPolicy ?? "",
    codexExecutable: task.codexExecutable ?? "",
    description: task.description,
    executionPolicy: task.executionPolicy ?? "manual",
    executionWorkspace: task.executionWorkspace ?? "",
    itemType: task.itemType ?? "implementation",
    priority: task.priority,
    prompt: task.prompt,
    queueTagName: task.queueTagName ?? "Default",
    sandbox: task.sandbox ?? "",
    status: task.status,
    title: task.title,
    validationStatus: task.validationStatus ?? "not_started",
  };
}

function editController(overrides: Partial<ReturnType<typeof editControllerBase>> = {}) {
  return {
    ...editControllerBase(),
    ...overrides,
  };
}

function editControllerBase() {
  return {
    isEditing: false,
    onCancel: vi.fn(),
    onStart: vi.fn(),
  };
}

function deleteController() {
  return {
    blockedReason: null,
    canRequest: true,
    error: null,
    isConfirming: false,
    isDeleting: false,
    message: null,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onRequest: vi.fn(),
  };
}

function executionPlanController(
  plan: AgentQueueExecutionPlanPreview | null,
  onGenerate = vi.fn(),
): AgentQueueExecutionPlanController {
  return {
    canGenerate: true,
    message: null,
    onGenerate,
    plan,
  };
}

function workerReportController(
  latestReport: AgentQueueWorkerExecutionReport | null,
  onAttachDemoReport = vi.fn(),
): AgentQueueWorkerReportController {
  return {
    canAttach: true,
    latestReport,
    message: latestReport
      ? "Worker report attached as evidence. Awaiting validation/coordinator review; item status was not finalized."
      : null,
    onAttachDemoReport,
  };
}

function runEvidenceController(
  detail: AgentExecutorRunDetail | null,
  overrides: Partial<AgentQueueRunEvidenceController> = {},
): AgentQueueRunEvidenceController {
  return {
    apiAvailable: true,
    detail,
    error: null,
    isLoading: false,
    onRefresh: vi.fn(),
    ...overrides,
  };
}

function runActivityController(
  overrides: Partial<AgentQueueRunActivityController> = {},
): AgentQueueRunActivityController {
  return {
    currentMessage: "Waiting for final response.",
    currentStage: "Preparing",
    eventState: {
      events: [],
      rawEvents: [],
    },
    lastCommand: null,
    lastCommandStatus: null,
    rawEvents: [],
    recentEvents: [],
    statusLine: "Running - waiting for final response.",
    ...overrides,
  };
}

function runDetail(
  overrides: Partial<AgentExecutorRunDetail> = {},
): AgentExecutorRunDetail {
  const summary = {
    commandKind: "codex_direct_work",
    durationMs: 1000,
    finishedAt: "2026-05-22T10:01:00.000Z",
    hasResult: true,
    logCount: 4,
    mode: "Codex Direct Work",
    repoRoot: "C:\\repo",
    resultType: "codex_direct_work",
    runId: "run_done_123456",
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    title: "Codex Direct Work stream completed",
    validationProfile: null,
    validationStatus: null,
  };

  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Final Direct Work response.",
    logs: [],
    resultContent: null,
    resultId: "result-1",
    resultPayload: "{\"status\":\"completed\"}",
    resultStatus: "completed",
    resultSummary: "Codex Direct Work stream completed",
    stderrPreview: null,
    stdoutPreview: "stdout preview",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
    summary: {
      ...summary,
      ...overrides.summary,
    },
  };
}

function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-05-20T10:02:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Raw worker report preview",
    reportId: "report-1",
    reportStatus: "reported",
    summary: "Worker report summary",
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [],
    workerId: "executor_visible",
    ...overrides,
  };
}

function reportActionCard(
  overrides: Partial<AgentQueueReportActionCard> = {},
): AgentQueueReportActionCard {
  return {
    cardId: "queue-report-card-task-1-report-1",
    changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
    createdAt: "2026-05-22T10:02:00.000Z",
    errors: ["One focused test still fails."],
    linkedFollowUpItemIds: [],
    recommendedActions: [
      {
        actionId: "open_source_item",
        description: "Open source item.",
        enabled: true,
        label: "Open source item",
        type: "open_source_item",
      },
    ],
    reportKind: "worker_execution",
    reportStatus: "reported",
    reportSummary: "Worker report summary",
    sourceItemId: "task_1",
    sourceItemPriority: 1,
    sourceItemPrompt: "Prompt",
    sourceItemStatus: "queued",
    sourceItemTitle: "Task",
    sourceItemType: "implementation",
    sourceQueueTag: "Default",
    sourceQueueTagId: "default",
    sourceReportId: "report-1",
    sourceValidationStatus: "not_started",
    warnings: ["Diff review is still required."],
    ...overrides,
  };
}

function planPreview(
  overrides: Partial<AgentQueueExecutionPlanPreview> = {},
): AgentQueueExecutionPlanPreview {
  return {
    complexity: "low",
    estimatedMinutesMax: 12,
    estimatedMinutesMin: 6,
    estimatedTokenMax: 2000,
    estimatedTokenMin: 1000,
    expectedValidationCommands: [
      "npm.cmd run test --prefix apps/desktop/frontend",
    ],
    generatedAt: "2026-05-22T10:00:00.000Z",
    itemId: "task_1",
    likelyFilesOrAreas: ["frontend UI"],
    notes: "Local deterministic estimate only.",
    planId: "plan-1",
    risk: "low",
    source: "heuristic",
    status: "planned",
    steps: ["Inspect the current implementation"],
    workerId: "executor_visible",
    ...overrides,
  };
}

function clickFirstButton(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function detailsBySummary(text: string) {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>("details")).find(
    (details) => details.querySelector("summary")?.textContent === text,
  );
}

function executionSectionText() {
  return sectionText("Queue task execution");
}

function sectionText(label: string) {
  const section = document.querySelector(`[aria-label="${label}"]`);

  if (!section) {
    throw new Error(`Section not found: ${label}`);
  }

  return section.textContent ?? "";
}

function queueTask(): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor_visible",
    createdAt: "2026-05-22T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Prompt",
    queueItemId: "task_1",
    status: "ready",
    title: "Task",
    updatedAt: "2026-05-22T10:00:00.000Z",
    workspaceId: "ws_1",
  };
}

function runLink(
  overrides: Partial<NonNullable<AgentQueueLatestRunLinkController["link"]>> = {},
): NonNullable<AgentQueueLatestRunLinkController["link"]> {
  return {
    completedAt: "2026-05-22T10:01:00.000Z",
    createdAt: "2026-05-22T10:00:00.000Z",
    directWorkRunId: "run_safe_123456",
    executorWidgetId: "executor_visible",
    linkId: "link_1",
    queueTaskId: "task_1",
    reviewStatus: null,
    source: "manual",
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    updatedAt: "2026-05-22T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "ws_1",
    ...overrides,
  };
}

function executorSlots(): AgentExecutorSlot[] {
  return [
    { label: "Local executor visible", widgetInstanceId: "executor_visible" },
  ];
}

function latestRunController(
  link: AgentQueueLatestRunLinkController["link"],
): AgentQueueLatestRunLinkController {
  return {
    apiAvailable: true,
    error: null,
    isLoading: false,
    link,
    onRefresh: vi.fn(),
  };
}

function runHistoryController(
  links: AgentQueueRunHistoryController["links"],
): AgentQueueRunHistoryController {
  return {
    apiAvailable: true,
    error: null,
    isLoading: false,
    links,
    onRefresh: vi.fn(),
    totalCount: links.length,
  };
}

function runController(): AgentQueueRunController {
  return {
    approvalPolicy: "never",
    canStart: false,
    codexExecutableDraft: "codex",
    executorSelectionMessage: null,
    hasUnsavedTaskSettings: false,
    isStarting: false,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onSaveTaskSettings: vi.fn(),
    onStartAssignedTask: vi.fn(),
    preconditionMessages: [],
    readinessMessage: "Ready",
    repoRootDraft: "",
    sandbox: "read_only",
    startError: null,
    startedRunId: null,
    startMessage: null,
    usesDefaultExecutorOnStart: false,
  };
}

function runnerController(): AgentQueueRunnerController {
  return {
    canStart: false,
    error: null,
    message: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    preconditionMessages: [],
    status: "idle",
  };
}

function autorunController(): AgentQueueAutorunController {
  return {
    apiAvailable: true,
    canArm: false,
    error: null,
    isLoading: false,
    isStarting: false,
    isStopping: false,
    message: null,
    onArm: vi.fn(),
    onRefresh: vi.fn(),
    onStop: vi.fn(),
    preconditionMessages: [],
    selectedExecutorLabel: null,
    snapshot: null,
  };
}

function autonomousController(
  overrides: Partial<AgentQueueAutonomousController> = {},
): AgentQueueAutonomousController {
  return {
    activeQueueItemId: null,
    activeTaskTitle: null,
    apiAvailable: true,
    approvalPolicy: "never",
    canStart: true,
    codexExecutableDraft: "codex",
    completedCount: 0,
    currentStage: null,
    currentWorkspaceRoot: null,
    error: null,
    failedCount: 0,
    latestReportState: null,
    message: null,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onStart: vi.fn(),
    onStopAfterCurrent: vi.fn(),
    preconditionMessages: [],
    remainingEligibleCount: 0,
    repoRootDraft: "C:\\repo",
    sandbox: "read_only",
    skippedBlockedCount: 0,
    status: "idle",
    timeline: [],
    ...overrides,
  };
}
