import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { AgentQueueTaskList } from "./AgentQueueTaskList";

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

describe("AgentQueueTaskList Queue + Workers fields", () => {
  it("renders the default queue tag for old task rows", () => {
    renderList([queueTask()]);

    expect(document.body.textContent).toContain("Tag Default");
    expect(document.body.textContent).toContain("Not started");
    expect(document.body.textContent).toContain("Implementation");
  });

  it("renders execution and validation statuses separately", () => {
    renderList([
      queueTask({
        queueItemId: "queue-1",
        status: "running",
        validationStatus: "validating",
      }),
    ]);

    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Validating");
    expect(
      document.querySelector(".agent-queue-validation-animating"),
    ).not.toBeNull();
  });

  it("renders diff review as an independent item type", () => {
    renderList([
      queueTask({
        itemType: "diff_review",
        queueItemId: "queue-1",
        queueTagName: "Review",
        title: "Review diff",
      }),
    ]);

    expect(document.body.textContent).toContain("Review diff");
    expect(document.body.textContent).toContain("Diff review");
    expect(document.body.textContent).toContain("Tag Review");
  });

  it("renders paused tag and assigned worker state on task rows", () => {
    renderList(
      [
        queueTask({
          assignedExecutorWidgetId: "executor_visible",
          assignedWorkerId: "executor_visible",
          queueTagId: "review",
          queueTagName: "Review",
        }),
      ],
      new Set(["review"]),
    );

    expect(document.body.textContent).toContain("Tag paused");
    expect(document.body.textContent).toContain("Worker Agent Executor");
    expect(document.querySelector(".agent-queue-task-row-paused")).not.toBeNull();
  });
});

function renderList(
  tasks: AgentQueueTask[],
  pausedQueueTagIds: ReadonlySet<string> = new Set(),
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueTaskList
        filteredTasks={tasks}
        isLoading={false}
        isSelecting={false}
        loadError={null}
        onSelectTask={vi.fn()}
        onStatusFilterChange={vi.fn()}
        pausedQueueTagIds={pausedQueueTagIds}
        selectedTask={tasks[0] ?? null}
        statusFilter="all"
        tasks={tasks}
      />,
    );
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
