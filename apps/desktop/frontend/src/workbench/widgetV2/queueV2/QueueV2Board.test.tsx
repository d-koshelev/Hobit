import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
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

describe("QueueV2Board", () => {
  it("renders the required board lanes", async () => {
    await render(
      <QueueV2Board tasks={[task({ queueItemId: "ready", status: "ready" })]} />,
    );

    expect(regionByName("Intake lane")).not.toBeNull();
    expect(regionByName("Ready lane")).not.toBeNull();
    expect(regionByName("Running lane")).not.toBeNull();
    expect(regionByName("Review lane")).not.toBeNull();
    expect(regionByName("Blocked lane")).not.toBeNull();
    expect(regionByName("Closed lane")).not.toBeNull();
  });

  it("shows tag colors as compact group visual identity", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "alpha",
            queueTagId: "alpha",
            queueTagName: "Alpha",
            status: "ready",
            title: "Alpha task",
          }),
          task({
            queueItemId: "beta",
            queueTagId: "beta",
            queueTagName: "Beta",
            status: "ready",
            title: "Beta task",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("alpha")?.dataset.queueV2TagColor).toMatch(/^queue-flow-tag-/);
    expect(card("beta")?.dataset.queueV2TagColor).toMatch(/^queue-flow-tag-/);
    expect(document.body.textContent).toContain("Alpha");
    expect(document.body.textContent).toContain("Beta");
    expect(document.querySelectorAll(".queue-v2-card-tag-dot")).toHaveLength(2);
  });

  it("groups running tasks by worker with online/offline summaries", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            assignedWorkerId: "worker-a",
            queueItemId: "run-a",
            status: "running",
            title: "Running A",
          }),
          task({
            assignedWorkerId: "worker-b",
            queueItemId: "run-b",
            status: "running",
            title: "Running B",
          }),
        ]}
        workers={[
          worker({
            currentItemId: "run-a",
            name: "Worker A",
            status: "running",
            workerId: "worker-a",
          }),
          worker({
            currentItemId: "run-b",
            enabled: false,
            name: "Worker B",
            status: "paused",
            workerId: "worker-b",
          }),
        ]}
      />,
    );

    expect(regionByName("Worker A running group")?.textContent).toContain(
      "Online / 1/1 active",
    );
    expect(regionByName("Worker B running group")?.textContent).toContain(
      "Offline / 0/1 active",
    );
    expect(card("run-a")).not.toBeNull();
    expect(card("run-b")).not.toBeNull();
  });

  it("handles zero running tasks", async () => {
    await render(
      <QueueV2Board tasks={[task({ queueItemId: "ready", status: "ready" })]} />,
    );

    expect(regionByName("Running lane")?.textContent).toContain(
      "No running tasks",
    );
  });

  it("keeps closed collapsed by default and renders closed cards after expansion", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            closureState: "no_change_accepted",
            queueItemId: "closed",
            status: "completed",
            title: "Closed task",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(regionByName("Closed lane")?.textContent).toContain("Closed");
    expect(regionByName("Closed lane")?.textContent).toContain("1");
    expect(card("closed")).toBeNull();

    await click(summaryWithText("Closed"));

    expect(card("closed")).not.toBeNull();
  });

  it("places report-ready tasks in Review and explicit finalized tasks in Closed", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "report",
            status: "completed",
            title: "Report task",
            workerExecutionReports: [report()],
          }),
          task({
            closureState: "no_change_accepted",
            queueItemId: "final",
            status: "completed",
            title: "Final task",
            workerExecutionReports: [report()],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(regionByName("Review lane")?.textContent).toContain("Report task");
    expect(regionByName("Closed lane")?.textContent).toContain("1");
    expect(regionByName("Review lane")?.textContent).not.toContain("Final task");
    expect(card("final")).toBeNull();
  });

  it("selects a clicked task without reordering cards or exposing raw prompt text", async () => {
    const tasks = [
      task({
        queueItemId: "first",
        prompt: "RAW PROMPT SHOULD NOT RENDER",
        status: "ready",
        title: "First task",
      }),
      task({
        queueItemId: "second",
        prompt: "SECOND RAW PROMPT SHOULD NOT RENDER",
        status: "ready",
        title: "Second task",
      }),
    ];
    await render(<QueueV2Board tasks={tasks} workers={[worker()]} />);
    const orderBefore = visibleCardOrder();

    await click(card("second"));

    expect(visibleCardOrder()).toEqual(orderBefore);
    expect(card("second")?.dataset.queueV2Selected).toBe("true");
    expect(document.body.textContent).not.toContain("RAW PROMPT SHOULD NOT RENDER");
    expect(document.body.textContent).not.toContain(
      "SECOND RAW PROMPT SHOULD NOT RENDER",
    );
  });

  it("opens task details from the card Details action and closes with Escape", async () => {
    await render(
      <QueueV2Board
        tasks={[task({ queueItemId: "ready", status: "ready", title: "Ready task" })]}
        workers={[worker()]}
      />,
    );

    await click(cardDetailsButton("ready"));

    expect(dialogByName("Ready task")).not.toBeNull();
    expect(document.querySelector(".queue-v2-task-details-shell")).not.toBeNull();
    expect(document.body.textContent).toContain("Objective");
    expect(document.body.textContent).toContain("Next action");

    await keyDown("Escape");

    expect(dialogByName("Ready task")).toBeNull();
  });

  it("renders details tabs with high-level Agent Log separate from collapsed Developer raw details", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "reported",
            status: "completed",
            title: "Reported task",
            workerExecutionReports: [
              report({
                changedFiles: ["src/queue.ts"],
                rawReportPreview: '{"raw":"developer payload"}',
                summary: "Worker finished the report.",
                validationResult: "passed",
              }),
            ],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    await click(cardDetailsButton("reported"));
    await click(buttonWithText("Prompt"));
    expect(activePanel()?.textContent).toContain("Original prompt summary");
    await click(buttonWithText("Result"));
    expect(activePanel()?.textContent).toContain("Changed files");
    expect(activePanel()?.textContent).toContain("passed");
    await click(buttonWithText("Agent Log"));
    expect(activePanel()?.textContent).toContain("High-level task timeline only");
    expect(activePanel()?.textContent).not.toContain("developer payload");
    await click(buttonWithText("Context"));
    expect(activePanel()?.textContent).toContain("Context status");
    await click(buttonWithText("Files / Validation"));
    expect(activePanel()?.textContent).toContain("src/queue.ts");
    await click(buttonWithText("Developer"));

    const developerDetails = document.querySelector<HTMLDetailsElement>(
      ".queue-v2-task-details-developer",
    );
    expect(developerDetails?.open).toBe(false);
    expect(developerDetails?.textContent).toContain("Raw / developer details");
  });

  it("keeps popup action controls disabled and does not call selection again", async () => {
    const onSelectedTaskChange = vi.fn();

    await render(
      <QueueV2Board
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[task({ queueItemId: "ready", status: "ready", title: "Ready task" })]}
        workers={[worker()]}
      />,
    );

    await click(cardDetailsButton("ready"));
    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);

    const primaryAction = buttonWithText("Run now");
    expect(primaryAction?.disabled).toBe(true);
    await click(primaryAction);

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
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

function cardDetailsButton(taskId: string) {
  return card(taskId)?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  ) ?? null;
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (dialog) => dialog.textContent?.includes(name),
    ) ?? null
  );
}

function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

function visibleCardOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-order-id]"))
    .map((element) => element.dataset.taskOrderId);
}

function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function summaryWithText(text: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("summary")).find((element) =>
      element.textContent?.includes(text),
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

function report(overrides: Partial<AgentQueueWorkerExecutionReport> = {}) {
  return {
    ...baseReport(),
    ...overrides,
  };
}

function baseReport() {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    errors: [],
    itemId: "task",
    reportId: "report",
    reportStatus: "completed" as const,
    summary: "Finished",
    validationCommandsSuggested: [],
    warnings: [],
    workerId: "worker",
  };
}
