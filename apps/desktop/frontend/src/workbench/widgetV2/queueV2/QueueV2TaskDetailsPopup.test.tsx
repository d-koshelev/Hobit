import { describe, expect, it, vi } from "vitest";

import { selectQueueV2ViewModel } from "../../queue/queueV2ViewModel";
import { QueueV2TaskDetailsPopup } from "./QueueV2TaskDetailsPopup";
import {
  buttonWithText,
  click,
  queueController,
  render,
  task,
  worker,
} from "./QueueV2Board.testUtils";

describe("QueueV2TaskDetailsPopup", () => {
  it("renders title, status, summary, and product tabs without default debug content", async () => {
    const selectedTask = task({
      queueItemId: "popup-task",
      status: "queued",
      title: "Popup task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(document.body.textContent).toContain("Popup task");
    expect(document.body.textContent).toContain("Ready");
    expect(document.body.textContent).toContain("Stage");
    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Workspace / worker");
    expect(buttonWithText("Overview")).not.toBeNull();
    expect(buttonWithText("Prompt")).not.toBeNull();
    expect(buttonWithText("Context")).not.toBeNull();
    expect(buttonWithText("Result")).not.toBeNull();
    expect(buttonWithText("Activity")).not.toBeNull();
    expect(document.querySelector(".popup-shell-eyebrow")).toBeNull();
    expect(document.body.textContent).not.toContain("Developer");
    expect(document.body.textContent).not.toContain("Raw IDs");
    expect(document.body.textContent).not.toContain("Callback availability");
    expect(document.body.textContent).not.toContain("Queue bridge state");
  });

  it("switches product tabs", async () => {
    const selectedTask = task({
      prompt: "Implement the focused Queue popup redesign.",
      queueItemId: "tabs-task",
      title: "Tabs task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await click(buttonWithText("Prompt"));

    expect(document.querySelector("[role='tabpanel']")?.textContent).toContain(
      "Implement the focused Queue popup redesign.",
    );
  });

  it("keeps action callbacks wired through the primary action", async () => {
    const onRun = vi.fn();
    const selectedTask = task({
      assignedExecutorWidgetId: "executor",
      assignedWorkerId: "worker",
      queueItemId: "run-task",
      status: "ready",
      title: "Runnable task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId);

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          onRun,
          runCanStart: true,
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    await click(buttonWithText("Run task"));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("keeps blocked and missing configuration reasons visible", async () => {
    const selectedTask = task({
      codexExecutable: "",
      queueItemId: "blocked-task",
      status: "queued",
      title: "Blocked task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(document.body.textContent).toContain("Set Codex executable");
    expect(document.body.textContent).toContain("Missing Codex executable");
  });

  it("shows Enable Queue when queue is disabled and the task can use that action", async () => {
    const selectedTask = task({
      queueItemId: "enable-task",
      status: "queued",
      title: "Enable task",
    });
    const popup = popupModel([selectedTask], selectedTask.queueItemId, "stopped");

    await render(
      <QueueV2TaskDetailsPopup
        inspector={popup.inspector}
        isOpen
        onRequestClose={vi.fn()}
        queue={queueController({
          selectedTask,
          tasks: [selectedTask],
        })}
        taskViewModel={popup.taskViewModel}
      />,
    );

    expect(buttonWithText("Enable Queue")).not.toBeNull();
  });
});

function popupModel(
  tasks: ReturnType<typeof task>[],
  selectedTaskId: string,
  globalExecutionState: "started" | "stopped" = "started",
) {
  const viewModel = selectQueueV2ViewModel({
    globalExecutionState,
    selectedTaskId,
    tasks,
    workers: [worker()],
  });

  const taskViewModel =
    viewModel.tasks.find((item) => item.taskId === selectedTaskId) ?? null;

  return {
    inspector: viewModel.inspector,
    taskViewModel,
  };
}
