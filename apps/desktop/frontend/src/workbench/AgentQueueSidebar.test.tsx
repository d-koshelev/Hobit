import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueSidebar } from "./AgentQueueSidebar";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
} from "./queue/agentQueueSchedulerModel";
import type {
  AgentQueueAutonomousController,
  AgentQueueFoundationController,
} from "./queue/useAgentQueueController";

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
});

describe("AgentQueueSidebar", () => {
  it("renders global controls, queue tags, workers, and validation summary", () => {
    renderSidebar();

    expect(document.body.textContent).toContain("Enable");
    expect(document.body.textContent).toContain("Disable");
    expect(document.body.textContent).toContain("STOP + KILL RUNNING");
    expect(document.body.textContent).toContain("Scheduler summary");
    expect(document.body.textContent).toContain("Dry-run only");
    expect(document.body.textContent).toContain("Capacity");
    expect(document.body.textContent).toContain("Max executors");
    expect(document.body.textContent).toContain("Configured");
    expect(document.body.textContent).toContain("Spare");
    expect(document.body.textContent).toContain("Default");
    expect(document.body.textContent).toContain("Agent Executor 1");
    expect(document.body.textContent).toContain("0 schedulable items");
    expect(document.body.textContent).toContain("Dry-run paused");
    expect(document.body.textContent).toContain("Manage tags");
    expect(document.body.textContent).toContain(
      "Tag colors are editable for the current Hobit session",
    );
    expect(document.body.textContent).toContain("Worker controls");
    expect(document.body.textContent).toContain("Add worker");
    expect(document.body.textContent).toContain("Needs review");
  });

  it("dispatches non-executing local control callbacks", () => {
    const foundation = foundationController();
    renderSidebar(foundation);

    clickButton("Enable");
    clickButton("Disable");
    clickButton("STOP + KILL RUNNING");
    clickButton("Pause");

    expect(foundation.onStartWorkers).toHaveBeenCalledTimes(1);
    expect(foundation.onStopWorkers).toHaveBeenCalledTimes(1);
    expect(foundation.onStopAndKillRunning).toHaveBeenCalledTimes(1);
    expect(foundation.onPauseQueueTag).toHaveBeenCalledWith("default");
  });

  it("keeps Run autonomous queue clickable when normal Queue is disabled", () => {
    const autonomous = autonomousController();
    renderSidebar(foundationController({ globalExecutionState: "stopped" }), autonomous);

    const button = buttonByText("Run autonomous queue");

    expect(button?.disabled).toBe(false);
    clickButton("Run autonomous queue");
    expect(autonomous.onStart).toHaveBeenCalledTimes(1);
  });

  it("keeps Run autonomous queue clickable when autonomous setup is missing", () => {
    const autonomous = autonomousController({
      message: "Set execution workspace before autonomous run.",
      repoRootDraft: "",
      status: "needs_setup",
    });
    renderSidebar(foundationController({ globalExecutionState: "stopped" }), autonomous);

    expect(document.body.textContent).toContain("needs setup");
    expect(document.body.textContent).toContain(
      "Set execution workspace before autonomous run.",
    );
    const button = buttonByText("Run autonomous queue");

    expect(button?.disabled).toBe(false);
    clickButton("Run autonomous queue");
    expect(autonomous.onStart).toHaveBeenCalledTimes(1);
  });

  it("does not render queue-level workspace setup for autonomous mode", () => {
    const autonomous = autonomousController({
      currentWorkspaceRoot: "C:\\repo",
      repoRootDraft: "",
      status: "needs_setup",
    });
    renderSidebar(foundationController(), autonomous);

    expect(document.body.textContent).not.toContain("Autonomous setup");
    expect(document.body.textContent).not.toContain("Use current workspace");
  });

  it("disables Run autonomous queue while Autonomous Queue is running", () => {
    renderSidebar(
      foundationController({ globalExecutionState: "stopped" }),
      autonomousController({ canStart: false, status: "running" }),
    );

    expect(buttonByText("Run autonomous queue")?.disabled).toBe(true);
  });

  it("shows whether a worker dry-run next item has a plan", () => {
    const foundation = foundationController({ globalExecutionState: "started" });

    renderSidebar(foundation);

    expect(document.body.textContent).toContain("Next: Queue task");
    expect(document.body.textContent).toContain("Plan needed");
  });

  it("changes max executors and keeps Add worker bounded by max", () => {
    const foundation = foundationController();
    foundation.embeddedExecutor = {
      ...foundation.embeddedExecutor,
      currentConfiguredWorkerCount: 1,
      maxExecutors: 1,
    };
    renderSidebar(foundation);

    const input = document.querySelector<HTMLInputElement>(
      "#agent-queue-max-executors",
    );
    const addWorker = buttonByText("Add worker");

    expect(input?.value).toBe("1");
    expect(addWorker?.disabled).toBe(true);

    expect(foundation.onMaxExecutorsChange).not.toHaveBeenCalled();
  });

  it("renders paused tags with validation counts and resume action", () => {
    const foundation = foundationController();
    foundation.queueTags = [
      {
        colorToken: "queue-flow-tag-1",
        queueTagId: "default",
        queueTagName: "Default",
        coordinatorReviewCount: 1,
        failedValidationCount: 1,
        needsCoordinatorReview: true,
        needsReviewCount: 2,
        pauseReason: "edit_review",
        runningCount: 0,
        status: "paused",
        taskCount: 3,
        validatingCount: 1,
      },
    ];
    renderSidebar(foundation);

    expect(document.body.textContent).toContain("paused");
    expect(document.body.textContent).toContain("Validating1");
    expect(document.body.textContent).toContain("Needs review2");
    expect(document.body.textContent).toContain("Failed validation1");
    expect(document.body.textContent).toContain("Coordinator review1");

    clickButton("Resume tag");

    expect(foundation.onResumeQueueTag).toHaveBeenCalledWith("default");
  });

  it("edits tag color through current-session tag management", () => {
    const foundation = foundationController();
    renderSidebar(foundation);

    const colorSelect = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Color for Default"]',
    );

    expect(colorSelect?.value).toBe("queue-flow-tag-1");
    expect(document.body.textContent).toContain(
      "Color changes update the current session only",
    );

    act(() => {
      if (!colorSelect) {
        throw new Error("Tag color select not found.");
      }

      colorSelect.value = "queue-flow-tag-5";
      colorSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(foundation.onSetQueueTagColor).toHaveBeenCalledWith(
      "default",
      "queue-flow-tag-5",
    );
  });
});

function renderSidebar(
  foundation: AgentQueueFoundationController = foundationController(),
  autonomous: AgentQueueAutonomousController = autonomousController(),
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueSidebar
        autonomous={autonomous}
        foundation={foundation}
      />,
    );
  });
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
    codexExecutableDraft: "codex.cmd",
    completedCount: 0,
    currentWorkspaceRoot: null,
    currentStage: null,
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
    repoRootDraft: "C:\\repo",
    remainingEligibleCount: 0,
    sandbox: "read_only",
    skippedBlockedCount: 0,
    status: "idle",
    timeline: [],
    ...overrides,
  };
}

function clickButton(text: string) {
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
    (candidate) => candidate.textContent === text,
  ) as HTMLButtonElement | undefined;
}

function foundationController(
  overrides: Partial<AgentQueueFoundationController> = {},
): AgentQueueFoundationController {
  const task = {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "auto" as const,
    priority: 0,
    prompt: "Run this",
    queueItemId: "queue-1",
    status: "ready" as const,
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
  };
  const worker = {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Agent Executor 1",
    routingSummary: {
      blockedReasonSummary: null,
      eligibleItemCount: 1,
      nextItem: task,
    },
    scope: { kind: "queue_tag" as const, queueTagId: "default", queueTagName: "Default" },
    status: "idle" as const,
    workerId: "executor-1",
  };

  const globalExecutionState: AgentQueueFoundationController["globalExecutionState"] =
    overrides.globalExecutionState ?? "stopped";
  const schedulerPlan = buildAgentQueueSchedulerPlan({
    globalExecutionState,
    pausedQueueTagIds: new Set(),
    tasks: [task],
    workers: [worker],
  });

  return {
    embeddedExecutor: buildAgentQueueEmbeddedExecutorSection({
      maxExecutors: 3,
      schedulerPlan,
      tasks: [task],
      workers: [worker],
    }),
    globalExecutionState,
    globalMessage: "Workers are stopped.",
    globalStatus: globalExecutionState,
    maxExecutorMessage: null,
    onMaxExecutorsChange: vi.fn(),
    onCreateQueueTag: vi.fn(() => true),
    onCreateWorker: vi.fn(),
    onDeleteQueueTag: vi.fn(() => true),
    onDeleteWorker: vi.fn(),
    onPauseQueueTag: vi.fn(),
    onRenameWorker: vi.fn(),
    onRenameQueueTag: vi.fn(async () => true),
    onResumeQueueTag: vi.fn(),
    onSetQueueTagColor: vi.fn(() => true),
    onStartWorkers: vi.fn(),
    onStopAndKillRunning: vi.fn(),
    onStopWorkers: vi.fn(),
    onWorkerEnabledChange: vi.fn(),
    onWorkerScopeChange: vi.fn(),
    pausedQueueTagIds: new Set(),
    queueTags: [
      {
        colorToken: "queue-flow-tag-1",
        queueTagId: "default",
        queueTagName: "Default",
        coordinatorReviewCount: 0,
        failedValidationCount: 0,
        needsCoordinatorReview: false,
        needsReviewCount: 1,
        pauseReason: null,
        runningCount: 0,
        status: "running",
        taskCount: 1,
        validatingCount: 0,
      },
    ],
    tagManagementError: null,
    tagManagementMessage: null,
    validationSummary: {
      failed: 0,
      needs_review: 1,
      not_started: 0,
      passed: 0,
      validating: 0,
    },
    schedulerPlan,
    workers: [worker],
    ...overrides,
  };
}
