import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunController,
  AgentQueueRunHistoryController,
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
      (button) => button.textContent === "Open Executor",
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
      (button) => button.textContent === "Open Executor",
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

  it("shows a compact disabled reason when the owning Executor is not visible", () => {
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
    });

    expect(document.body.textContent).toContain(
      "Owning Agent Executor is not visible on this Workbench.",
    );
    expect(document.body.textContent).toContain("Executor not visible");
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
        onOpenAgentExecutorRun={vi.fn()}
        onSelectionChange={vi.fn()}
        run={runController()}
        runHistory={runHistoryController([])}
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
