import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask, AgentQueueWorkerExecutionReport } from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { ValidationRunner } from "../../validation";
import { QueueV2Board } from "./QueueV2Board";

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

describe("QueueV2 blocker visibility", () => {
  it("shows Queue disabled directly on blocked cards and details", async () => {
    await render(
      <QueueV2Board
        globalExecutionState="stopped"
        tasks={[
          task({
            queueItemId: "queue-disabled",
            status: "ready",
            title: "Queue disabled task",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("queue-disabled")?.textContent).toContain(
      "Blocked: Queue disabled",
    );

    await openCardDetails("queue-disabled");

    const blockers = sectionByName("QueueV2 task blockers");
    expect(blockers?.textContent).toContain("Blockers");
    expect(blockers?.textContent).toContain("Queue disabled");
    expect(document.body.textContent).toContain("Primary blocker");
    expect(document.body.textContent).toContain("Next available action");
    expect(document.body.textContent).toContain("Enable Queue");
  });

  it("renders Enable Queue as an explicit typed action and calls the Queue control once", async () => {
    const onEnableQueue = vi.fn();
    const onRun = vi.fn();
    const runnableTask = task({
      assignedExecutorWidgetId: "worker",
      assignedWorkerId: "worker",
      queueItemId: "queue-001",
      status: "ready",
      title: "001 Runnable task",
    });
    const dependentTask = task({
      assignedExecutorWidgetId: "worker",
      assignedWorkerId: "worker",
      dependsOn: ["queue-001"],
      queueItemId: "queue-002",
      status: "ready",
      title: "002 Dependent task",
    });

    await render(
      <QueueV2Board
        globalExecutionState="stopped"
        queue={queueController({
          globalExecutionState: "stopped",
          onEnableQueue,
          onRun,
          selectedTask: runnableTask,
          tasks: [runnableTask, dependentTask],
        })}
        tasks={[runnableTask, dependentTask]}
        workers={[worker()]}
      />,
    );

    expect(onEnableQueue).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(card("queue-002")?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    expect(card("queue-002")?.textContent).toContain("Dependency");

    await openCardDetails("queue-001");

    expect(onEnableQueue).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();

    const enableButton = buttonWithText("Enable Queue");
    expect(enableButton).not.toBeNull();
    expect(enableButton?.disabled).toBe(false);

    await click(enableButton);

    expect(onEnableQueue).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
    expect(card("queue-002")?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    expect(card("queue-002")?.textContent).toContain("Dependency");
  });

  it("keeps Enable Queue unavailable with a visible reason when Codex executable is missing", async () => {
    const onEnableQueue = vi.fn();
    const onRun = vi.fn();
    const missingCodexTask = task({
      assignedExecutorWidgetId: "worker",
      assignedWorkerId: "worker",
      codexExecutable: "",
      queueItemId: "missing-codex",
      status: "ready",
      title: "Missing Codex task",
    });

    await render(
      <QueueV2Board
        globalExecutionState="stopped"
        queue={queueController({
          globalExecutionState: "stopped",
          onEnableQueue,
          onRun,
          selectedTask: missingCodexTask,
          tasks: [missingCodexTask],
        })}
        tasks={[missingCodexTask]}
        workers={[worker()]}
      />,
    );

    expect(card("missing-codex")?.textContent).toContain(
      "Blocked: Missing Codex executable",
    );
    expect(onEnableQueue).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();

    await openCardDetails("missing-codex");

    const blockers = sectionByName("QueueV2 task blockers");
    expect(blockers?.textContent).toContain("Missing Codex executable");
    expect(blockers?.textContent).toContain("Queue disabled");
    expect(document.body.textContent).toContain("Set Codex executable");

    const enableButton = buttonWithText("Enable Queue");
    expect(enableButton?.disabled).toBe(true);
    expect(enableButton?.parentElement?.textContent).toContain(
      "Set Codex executable before enabling Queue for this task.",
    );

    expect(onEnableQueue).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("shows missing execution workspace on cards and details with Set workspace available", async () => {
    const onSetWorkspace = vi.fn();
    const missingWorkspaceTask = task({
      executionWorkspace: "",
      queueItemId: "missing-workspace",
      status: "ready",
      title: "Missing workspace task",
    });

    await render(
      <QueueV2Board
        currentWorkspaceRoot="C:/workspace"
        queue={queueController({
          onSetWorkspace,
          selectedTask: missingWorkspaceTask,
          tasks: [missingWorkspaceTask],
        })}
        tasks={[missingWorkspaceTask]}
        workers={[worker()]}
      />,
    );

    expect(card("missing-workspace")?.textContent).toContain(
      "Blocked: Missing execution workspace",
    );
    await openCardDetails("missing-workspace");

    expect(sectionByName("QueueV2 task blockers")?.textContent).toContain(
      "Missing execution workspace",
    );
    const setWorkspaceButton = buttonWithText("Set task workspace");
    expect(setWorkspaceButton).not.toBeNull();
    expect(setWorkspaceButton?.disabled).toBe(false);
    expect(document.body.textContent).toContain("Set task workspace");
    expect(onSetWorkspace).not.toHaveBeenCalled();
  });

  it("shows dependency blocker source tasks on cards and details", async () => {
    const prerequisite = task({
      queueItemId: "001",
      status: "queued",
      title: "001 Workspace setup",
    });
    const dependent = task({
      dependsOn: ["001"],
      queueItemId: "002",
      status: "ready",
      title: "002 Dependent task",
    });

    await render(
      <QueueV2Board tasks={[prerequisite, dependent]} workers={[worker()]} />,
    );

    expect(card("002")?.textContent).toContain("Blocked: Waiting for 001");

    await openCardDetails("002");

    const blockers = sectionByName("QueueV2 task blockers");
    expect(blockers?.textContent).toContain("Waiting for 001");
    expect(blockers?.textContent).toContain("Dependency sources");
    expect(blockers?.textContent).toContain("001: 001 Workspace setup");
  });

  it("shows multiple blockers in details priority order", async () => {
    const prerequisite = task({
      queueItemId: "001",
      status: "queued",
      title: "001 Setup",
    });
    const blockedTask = task({
      dependsOn: ["001"],
      executionWorkspace: "",
      queueItemId: "002",
      status: "ready",
      title: "002 Blocked task",
      validationStatus: "failed",
    });

    await render(
      <QueueV2Board
        globalExecutionState="stopped"
        tasks={[prerequisite, blockedTask]}
        workers={[worker()]}
      />,
    );

    await openCardDetails("002");

    const blockersText = sectionByName("QueueV2 task blockers")?.textContent ?? "";
    expect(blockersText).toContain("Missing execution workspace");
    expect(blockersText).toContain("Queue disabled");
    expect(blockersText).toContain("Waiting for 001");
    expect(blockersText).toContain("Validation failed");
    expect(blockersText.indexOf("Missing execution workspace")).toBeLessThan(
      blockersText.indexOf("Queue disabled"),
    );
    expect(blockersText.indexOf("Queue disabled")).toBeLessThan(
      blockersText.indexOf("Waiting for 001"),
    );
    expect(blockersText.indexOf("Waiting for 001")).toBeLessThan(
      blockersText.indexOf("Validation failed"),
    );
  });

  it("does not call QueueV2 action callbacks while rendering blocked details", async () => {
    const onPromote = vi.fn();
    const onRun = vi.fn();
    const onRequestValidation = vi.fn();
    const onSelectedTaskChange = vi.fn();
    const onSetWorkspace = vi.fn();
    const blockedTask = task({
      executionWorkspace: "",
      queueItemId: "blocked-render",
      status: "ready",
      title: "Blocked render task",
    });

    await render(
      <QueueV2Board
        currentWorkspaceRoot="C:/workspace"
        onRequestValidation={onRequestValidation}
        onSelectedTaskChange={onSelectedTaskChange}
        queue={queueController({
          onPromote,
          onRun,
          onSetWorkspace,
          selectedTask: blockedTask,
          tasks: [blockedTask],
        })}
        tasks={[blockedTask]}
        validationRunner={validationRunner()}
        workers={[worker()]}
      />,
    );

    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(onRequestValidation).not.toHaveBeenCalled();
    expect(onSelectedTaskChange).not.toHaveBeenCalled();
    expect(onSetWorkspace).not.toHaveBeenCalled();

    await openCardDetails("blocked-render");

    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(onRequestValidation).not.toHaveBeenCalled();
    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
    expect(onSetWorkspace).not.toHaveBeenCalled();
  });

  it("continues to render ready, running, and review cards", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "ready-card",
            status: "ready",
            title: "Ready card task",
          }),
          task({
            assignedWorkerId: "worker-running",
            queueItemId: "running-card",
            status: "running",
            title: "Running card task",
          }),
          task({
            queueItemId: "review-card",
            status: "completed",
            title: "Review card task",
            workerExecutionReports: [report()],
          }),
        ]}
        workers={[
          worker(),
          worker({
            currentItemId: "running-card",
            status: "running",
            workerId: "worker-running",
          }),
        ]}
      />,
    );

    expect(card("ready-card")?.textContent).toContain("Run now");
    expect(card("running-card")?.textContent).toContain("Running");
    expect(card("review-card")?.textContent).toContain("Review");
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function click(element: Element | null) {
  if (!element) {
    throw new Error("Expected element to click.");
  }

  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

function card(taskId: string) {
  return document.querySelector<HTMLElement>(
    `[data-queue-item-id='${taskId}']`,
  );
}

function cardActionsButton(taskId: string) {
  return card(taskId)?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  ) ?? null;
}

async function openCardDetails(taskId: string) {
  await click(cardActionsButton(taskId));
  await click(buttonWithText("Open details"));
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function sectionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: "codex",
    context: undefined,
    coordinatorStatus: "not_reported",
    createdAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    description: "Description",
    executionPolicy: "manual",
    executionWorkspace: "C:/work",
    itemType: "implementation",
    orderIndex: 0,
    priority: 1,
    prompt: "Do the work",
    queueItemId: "task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "danger_full_access",
    status: "queued",
    title: "Task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace",
    ...overrides,
  };
}

function worker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker",
    ...overrides,
  };
}

function report(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    errors: [],
    itemId: "task",
    reportId: "report",
    reportStatus: "completed",
    summary: "Finished",
    validationCommandsSuggested: [],
    warnings: [],
    workerId: "worker",
    ...overrides,
  };
}

function validationRunner(): ValidationRunner {
  return {
    available: true,
    run: vi.fn(),
  };
}

function queueController({
  globalExecutionState = "started",
  onEnableQueue = vi.fn(),
  onPromote = vi.fn(),
  onRun = vi.fn(),
  onSetWorkspace = vi.fn(),
  selectedTask,
  tasks,
}: {
  globalExecutionState?: "started" | "stopped" | "stop_kill_requested";
  onEnableQueue?: () => void;
  onPromote?: () => void;
  onRun?: () => void;
  onSetWorkspace?: (workspaceRoot: string) => void;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  return {
    apiAvailable: true,
    draftPromotion: {
      canPromote: selectedTask.status === "draft",
      isPromoting: false,
      onPromote,
    },
    foundation: {
      globalExecutionState,
      onStartWorkers: onEnableQueue,
      pausedQueueTagIds: new Set(),
      workers: [worker()],
    },
    run: {
      canStart: false,
      isStarting: false,
      onRepoRootDraftChange: onSetWorkspace,
      onStartAssignedTask: onRun,
      preconditionMessages: [],
      readinessMessage: null,
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}
