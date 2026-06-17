import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../../../workspace/types";
import {
  createDogfoodLifecycleItem,
  queueDogfoodLifecycleItem,
  startQueueItemRun,
  completeAgentPrompt,
  type SmartQueueDogfoodLifecycleItem,
} from "../smartQueueDogfoodLifecycle";
import {
  createQueueWorkerEvidenceBundle,
} from "../smartQueueWorkerEvidenceBundle";
import {
  selectQueueV2ViewModel,
} from "../queueV2ViewModel";
import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../../agents/adapters/queueAgentCapabilityTypes";
import { AgentQueueTaskReviewEvidenceSection } from "./AgentQueueTaskReviewEvidenceSection";

const NOW = "2026-06-17T10:00:00.000Z";

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

describe("AgentQueueTaskReviewEvidenceSection", () => {
  it("renders bounded awaiting review evidence and unavailable broker state", () => {
    const hiddenTail = "hidden tail should not render";
    const lifecycle = completedLifecycle({
      finalAgentMessage: `${"Visible final message. ".repeat(80)}${hiddenTail}`,
    });
    const output = evidenceOutput(lifecycle);
    const taskViewModel = taskViewModelFor(lifecycle);

    renderSection({ evidenceOutput: output, taskViewModel });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Dogfood review");
    expect(text).toContain("Awaiting review");
    expect(text).toContain("Agent completed");
    expect(text).toContain("Evidence available");
    expect(text).toContain("Validation passed");
    expect(text).toContain("Run run-1");
    expect(text).toContain("Logs: log://run-1");
    expect(text).toContain("Frontend evidence only - not durable");
    expect(text).toContain("src/file-0.ts");
    expect(text).toContain("+ 2 more");
    expect(text).toContain("[Preview capped]");
    expect(text).toContain("Review actions unavailable.");
    expect(text).not.toContain(hiddenTail);
    expect(text).not.toContain("awaiting_review");
    expect(text).not.toContain("frontend_only_not_durable");
  });

  it("emits explicit review actions and validates required text inputs", async () => {
    const lifecycle = completedLifecycle();
    const output = evidenceOutput(lifecycle);
    const taskViewModel = taskViewModelFor(lifecycle);
    const onReviewAction = vi.fn(async () => undefined);

    renderSection({ evidenceOutput: output, onReviewAction, taskViewModel });

    await clickButton("Create review message");
    expect(onReviewAction).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceBundle: output.evidenceBundle,
        taskId: "task-1",
        type: "create_review_message",
      }),
    );

    await clickButton("Mark failed");
    expect(document.body.textContent).toContain("Reason is required.");

    setTextareaValue("Visible failed reason.");
    await clickButton("Mark failed");
    expect(onReviewAction).toHaveBeenCalledWith({
      reason: "Visible failed reason.",
      taskId: "task-1",
      type: "fail",
    });
  });
});

function renderSection({
  evidenceOutput,
  onReviewAction,
  taskViewModel,
}: {
  readonly evidenceOutput: QueueAgentReviewEvidenceBundleOutput;
  readonly onReviewAction?: ComponentProps<
    typeof AgentQueueTaskReviewEvidenceSection
  >["onReviewAction"];
  readonly taskViewModel: ReturnType<typeof taskViewModelFor>;
}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueTaskReviewEvidenceSection
        evidenceOutput={evidenceOutput}
        onReviewAction={onReviewAction}
        taskViewModel={taskViewModel}
      />,
    );
  });
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent === text,
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function setTextareaValue(value: string) {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Textarea not found.");
  }

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function taskViewModelFor(lifecycle: SmartQueueDogfoodLifecycleItem) {
  const task = queueTask({ queueItemId: lifecycle.taskId });
  const board = selectQueueV2ViewModel({
    dogfoodLifecycles: [lifecycle],
    selectedTaskId: lifecycle.taskId,
    tasks: [task],
    workers: [],
  });
  const taskViewModel = board.tasks[0];
  if (!taskViewModel) {
    throw new Error("Task view model missing.");
  }

  return taskViewModel;
}

function completedLifecycle({
  finalAgentMessage = "Implementation completed.",
}: {
  readonly finalAgentMessage?: string;
} = {}): SmartQueueDogfoodLifecycleItem {
  const base = createDogfoodLifecycleItem({
    createdAt: NOW,
    originalPrompt: "Implement task.",
    taskId: "task-1",
    title: "Task 1",
  });
  const queued = queueDogfoodLifecycleItem(base, NOW).item;
  const running = startQueueItemRun(queued, {
    attemptId: "attempt-1",
    runnablePrompt: "Implement task.",
    startedAt: NOW,
    threadId: "thread-1",
  }).item;

  return completeAgentPrompt(running, {
    attemptId: "attempt-1",
    changedFilesSummary: "Changed files: 7",
    completedAt: NOW,
    finalAgentMessage,
    threadId: "thread-1",
    validationSummary: "Validation passed.",
    workerEvidenceBundle: createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: Array.from({ length: 7 }, (_, index) => ({
        path: `src/file-${index.toString()}.ts`,
        status: "modified",
      })),
      finalAgentMessage,
      logReference: "log://run-1",
      outcome: "completed",
      runId: "run-1",
      taskId: "task-1",
      threadId: "thread-1",
      validationStatus: "passed",
      validationSummary: "Validation passed.",
    }),
  }).item;
}

function evidenceOutput(
  lifecycle: SmartQueueDogfoodLifecycleItem,
): QueueAgentReviewEvidenceBundleOutput {
  return {
    changedFilesSummary: lifecycle.changedFilesSummary,
    evidenceBundle: lifecycle.workerEvidenceBundle ?? null,
    evidenceBundlePersistence: "frontend_only_not_durable",
    evidenceSummary: lifecycle.workerEvidenceSummary,
    finalAgentMessage: lifecycle.finalAgentMessage,
    latestReviewMessage:
      lifecycle.reviewMessages[lifecycle.reviewMessages.length - 1] ?? null,
    lifecycle,
    reviewMessages: [...lifecycle.reviewMessages],
    reviewOutcome: lifecycle.reviewOutcome ?? null,
    taskId: lifecycle.taskId,
    validationApprovals: [...lifecycle.validationApprovals],
    validationSummary: lifecycle.validationSummary,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor_visible",
    createdAt: NOW,
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    priority: 1,
    prompt: "Prompt",
    queueItemId: "task-1",
    status: "running",
    title: "Task",
    updatedAt: NOW,
    workspaceId: "ws_1",
    ...overrides,
  };
}
