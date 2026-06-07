import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import { QueueV2Widget } from "./QueueV2Widget";

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

describe("QueueV2Widget scaffold", () => {
  it("renders the current Widget V2 board shell without hidden run actions", async () => {
    await render(<QueueV2Widget />);

    expect(headingWithText("Agent Queue")).not.toBeNull();
    expect(document.body.textContent).toContain("Current");
    expect(document.body.textContent).toContain(
      "Normal Queue actions are wired through the saved Agent Queue widget.",
    );
    expect(regionByRoleAndName("toolbar", "Agent Queue v2 command bar")).not.toBeNull();
    expect(
      regionByRoleAndName("complementary", "Agent Queue v2 left rail")?.textContent,
    ).toContain("No visible workers");
    expect(regionByRoleAndName("region", "Agent Queue v2 board")?.textContent).toContain(
      "Intake",
    );
    expect(
      regionByRoleAndName(
        "region",
        "Agent Queue v2 activity and closed history",
      )?.textContent,
    ).toContain("Recent activity");
    expect(
      Array.from(document.querySelectorAll("details")).every(
        (details) => !details.hasAttribute("open"),
      ),
    ).toBe(true);
    expect(buttonWithText("Run now")).toBeNull();
    expect(buttonWithText("Start")).toBeNull();
  });

  it("renders top bar counts from the QueueV2 view model", async () => {
    await render(
      <QueueV2Widget
        tasks={[
          task({ queueItemId: "ready", status: "ready", title: "Ready task" }),
          task({
            assignedWorkerId: "worker-running",
            queueItemId: "running",
            status: "running",
            title: "Running task",
          }),
          task({
            queueItemId: "review",
            status: "completed",
            title: "Review task",
            workerExecutionReports: [report()],
          }),
          task({
            prompt: "",
            queueItemId: "blocked",
            status: "ready",
            title: "Blocked task",
          }),
        ]}
        workers={[
          worker({ workerId: "worker-ready" }),
          worker({
            currentItemId: "running",
            status: "running",
            workerId: "worker-running",
          }),
        ]}
      />,
    );

    const topBar = regionByRoleAndName("toolbar", "Agent Queue v2 command bar");

    expect(topBar?.textContent).toContain("Queue mode");
    expect(topBar?.textContent).toContain("Ready1");
    expect(topBar?.textContent).toContain("Running1");
    expect(topBar?.textContent).toContain("Review1");
    expect(topBar?.textContent).toContain("Blocked1");
    expect(topBar?.textContent).toContain("1 available / 2 total");
    expect(inputByLabel("Queue v2 search placeholder")?.disabled).toBe(true);
    expect(buttonWithText("Settings")?.disabled).toBe(true);
  });

  it("renders tag legend colors and counts", async () => {
    await render(
      <QueueV2Widget
        tasks={[
          task({
            queueItemId: "alpha-1",
            queueTagId: "alpha",
            queueTagName: "Alpha",
            status: "ready",
          }),
          task({
            queueItemId: "alpha-2",
            queueTagId: "alpha",
            queueTagName: "Alpha",
            status: "queued",
          }),
          task({
            queueItemId: "beta-1",
            queueTagId: "beta",
            queueTagName: "Beta",
            status: "draft",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    const tagLegend = sectionByName("Queue v2 tag legend");
    const tagRows = tagLegend?.querySelectorAll("li") ?? [];

    expect(tagLegend?.textContent).toContain("Alpha");
    expect(tagLegend?.textContent).toContain("Beta");
    expect(tagLegend?.textContent).toContain("2");
    expect(tagLegend?.textContent).toContain("1");
    expect(tagRows[0]?.className).toMatch(/queue-flow-tag-/);
    expect(tagRows[1]?.className).toMatch(/queue-flow-tag-/);
    expect(tagLegend?.querySelectorAll(".queue-v2-tag-swatch")).toHaveLength(2);
  });

  it("renders workers and capacity summary", async () => {
    await render(
      <QueueV2Widget
        tasks={[task({ queueItemId: "ready", status: "ready" })]}
        workers={[
          worker({ name: "Ready worker", workerId: "ready-worker" }),
          worker({
            currentItemId: "running",
            name: "Busy worker",
            status: "running",
            workerId: "busy-worker",
          }),
          worker({
            enabled: false,
            name: "Paused worker",
            status: "paused",
            workerId: "paused-worker",
          }),
        ]}
      />,
    );

    const workersSection = sectionByName("Queue v2 workers capacity");

    expect(workersSection?.textContent).toContain("Available1/3");
    expect(workersSection?.textContent).toContain("Running1");
    expect(workersSection?.textContent).toContain("Paused1");
    expect(workersSection?.textContent).toContain("Ready worker");
    expect(workersSection?.textContent).toContain("Busy worker");
    expect(workersSection?.textContent).toContain("Paused worker");
  });

  it("keeps activity compact and closed history collapsed separately", async () => {
    await render(
      <QueueV2Widget
        tasks={[
          task({
            queueItemId: "running",
            status: "running",
            title: "Running task",
          }),
          task({
            closureState: "no_change_accepted",
            queueItemId: "closed",
            status: "completed",
            title: "Closed task",
          }),
        ]}
        workers={[worker({ currentItemId: "running", status: "running" })]}
      />,
    );

    const stream = regionByRoleAndName(
      "region",
      "Agent Queue v2 activity and closed history",
    );
    const details = Array.from(stream?.querySelectorAll("details") ?? []);

    expect(stream?.textContent).toContain("Recent activity");
    expect(stream?.textContent).toContain("Closed history");
    expect(details).toHaveLength(2);
    expect(details.every((item) => !item.open)).toBe(true);
    expect(stream?.textContent).not.toContain("raw");
    expect(stream?.textContent).not.toContain("stdout");
  });

  it("does not expose scheduler or runtime action controls", async () => {
    await render(
      <QueueV2Widget
        tasks={[task({ queueItemId: "ready", status: "ready" })]}
        workers={[worker()]}
      />,
    );

    expect(buttonWithText("Run now")).toBeNull();
    expect(buttonWithText("Start")).toBeNull();
    expect(buttonWithText("Start task")).toBeNull();
    expect(buttonWithText("Arm")).toBeNull();
    expect(buttonWithText("Finalize")).toBeNull();
    expect(buttonWithText("Filters")?.disabled).toBe(true);
    expect(buttonWithText("Settings")?.disabled).toBe(true);
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

function headingWithText(text: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === text,
    ) ?? null
  );
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function inputByLabel(label: string): HTMLInputElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
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

function report(overrides: Partial<AgentQueueWorkerExecutionReport> = {}) {
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
    ...overrides,
  };
}
