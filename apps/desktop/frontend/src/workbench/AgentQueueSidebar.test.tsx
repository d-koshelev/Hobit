import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueSidebar } from "./AgentQueueSidebar";
import type { AgentQueueFoundationController } from "./queue/useAgentQueueController";

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

    expect(document.body.textContent).toContain("START");
    expect(document.body.textContent).toContain("STOP");
    expect(document.body.textContent).toContain("STOP + KILL RUNNING");
    expect(document.body.textContent).toContain("Default");
    expect(document.body.textContent).toContain("Agent Executor 1");
    expect(document.body.textContent).toContain("Add worker");
    expect(document.body.textContent).toContain("Needs review");
  });

  it("dispatches non-executing local control callbacks", () => {
    const foundation = foundationController();
    renderSidebar(foundation);

    clickButton("START");
    clickButton("STOP");
    clickButton("STOP + KILL RUNNING");
    clickButton("Pause");

    expect(foundation.onStartWorkers).toHaveBeenCalledTimes(1);
    expect(foundation.onStopWorkers).toHaveBeenCalledTimes(1);
    expect(foundation.onStopAndKillRunning).toHaveBeenCalledTimes(1);
    expect(foundation.onPauseQueueTag).toHaveBeenCalledWith("default");
  });

  it("renders paused tags with validation counts and resume action", () => {
    const foundation = foundationController();
    foundation.queueTags = [
      {
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
    expect(document.body.textContent).toContain("1 validating, 2 needs review, 1 failed");
    expect(document.body.textContent).toContain("1 awaiting coordinator review");

    clickButton("Resume tag");

    expect(foundation.onResumeQueueTag).toHaveBeenCalledWith("default");
  });
});

function renderSidebar(
  foundation: AgentQueueFoundationController = foundationController(),
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<AgentQueueSidebar foundation={foundation} />);
  });
}

function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function foundationController(): AgentQueueFoundationController {
  return {
    globalMessage: "Workers are stopped.",
    globalStatus: "stopped",
    onCreateQueueTag: vi.fn(() => true),
    onCreateWorker: vi.fn(),
    onDeleteQueueTag: vi.fn(() => true),
    onDeleteWorker: vi.fn(),
    onPauseQueueTag: vi.fn(),
    onRenameWorker: vi.fn(),
    onRenameQueueTag: vi.fn(async () => true),
    onResumeQueueTag: vi.fn(),
    onStartWorkers: vi.fn(),
    onStopAndKillRunning: vi.fn(),
    onStopWorkers: vi.fn(),
    onWorkerEnabledChange: vi.fn(),
    onWorkerScopeChange: vi.fn(),
    pausedQueueTagIds: new Set(),
    queueTags: [
      {
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
    workers: [
      {
        currentItemId: null,
        displayOrder: 0,
        enabled: true,
        lastReportSummary: null,
        name: "Agent Executor 1",
        scope: { kind: "queue_tag", queueTagId: "default", queueTagName: "Default" },
        status: "idle",
        workerId: "executor-1",
      },
    ],
  };
}
