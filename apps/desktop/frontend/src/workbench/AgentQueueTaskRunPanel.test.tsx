import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunController,
  AgentQueueRunnerController,
} from "./queue/useAgentQueueController";
import type { AgentExecutorSlot } from "./types";
import type { AgentQueueTask } from "../workspace/types";

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
  it("shows a no-run state when the selected task has no run link", () => {
    renderPanel({
      latestRun: latestRunController(null),
    });

    expect(document.body.textContent).toContain("Latest run");
    expect(document.body.textContent).toContain("No runs yet.");
  });

  it("shows latest run status and source without raw output", () => {
    renderPanel({
      latestRun: latestRunController({
        completedAt: "2026-05-22T10:01:00.000Z",
        createdAt: "2026-05-22T10:00:00.000Z",
        directWorkRunId: "run_safe_123456",
        executorWidgetId: "executor_visible",
        linkId: "link_1",
        queueTaskId: "task_1",
        reviewStatus: "review_needed",
        source: "manual",
        startedAt: "2026-05-22T10:00:00.000Z",
        status: "completed",
        updatedAt: "2026-05-22T10:01:00.000Z",
        validationStatus: null,
        workspaceId: "ws_1",
      }),
    });

    expect(document.body.textContent).toContain("completed");
    expect(document.body.textContent).toContain("manual");
    expect(document.body.textContent).not.toContain("stdout");
    expect(document.body.textContent).not.toContain("final response");
    expect(document.body.textContent).not.toContain("diff");
  });

  it("keeps Open Executor as a frontend-only scroll action", () => {
    const target = document.createElement("div");
    target.dataset.widgetInstanceId = "executor_visible";
    document.body.append(target);
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    renderPanel({
      latestRun: latestRunController({
        completedAt: null,
        createdAt: "2026-05-22T10:00:00.000Z",
        directWorkRunId: "run_safe_123456",
        executorWidgetId: "executor_visible",
        linkId: "link_1",
        queueTaskId: "task_1",
        reviewStatus: null,
        source: "autorun",
        startedAt: "2026-05-22T10:00:00.000Z",
        status: "running",
        updatedAt: "2026-05-22T10:00:00.000Z",
        validationStatus: null,
        workspaceId: "ws_1",
      }),
    });

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open Executor",
    );

    act(() => {
      openButtons[openButtons.length - 1]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

function renderPanel(
  overrides: Partial<ComponentProps<typeof AgentQueueTaskRunPanel>>,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueTaskRunPanel
        apiAvailable={true}
        assignmentError={null}
        assignmentMessage={null}
        autorun={autorunController()}
        currentSelection="executor_visible"
        executorSlots={executorSlots()}
        hasExecutorSlots={true}
        inputId="executor-select"
        isAssigning={false}
        isDirty={false}
        latestRun={latestRunController(null)}
        onAssign={vi.fn()}
        onClear={vi.fn()}
        onSelectionChange={vi.fn()}
        run={runController()}
        runner={runnerController()}
        selectedTask={queueTask()}
        {...overrides}
      />,
    );
  });
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

function executorSlots(): AgentExecutorSlot[] {
  return [
    { label: "Agent Executor visible", widgetInstanceId: "executor_visible" },
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

function runController(): AgentQueueRunController {
  return {
    approvalPolicy: "never",
    canStart: false,
    codexExecutableDraft: "codex",
    isStarting: false,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onStartAssignedTask: vi.fn(),
    preconditionMessages: [],
    readinessMessage: "Ready",
    repoRootDraft: "",
    sandbox: "read_only",
    startError: null,
    startedRunId: null,
    startMessage: null,
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
