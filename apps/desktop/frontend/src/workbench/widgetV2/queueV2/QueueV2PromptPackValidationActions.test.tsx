import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueValidationRunResult } from "../../queue/queueValidationEvidenceService";
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

describe("QueueV2 prompt-pack validation actions", () => {
  it("exposes imported validation only through explicit request click", async () => {
    const onRequestValidation = vi.fn(
      async (
        _task: AgentQueueTask,
        _runner: ValidationRunner,
      ): Promise<QueueValidationRunResult> => ({
        attachment: {
          summary: {
            summary: "Validation passed: imported command completed.",
          },
        } as QueueValidationRunResult["attachment"],
        runnerOutput: {
          summary: { status: "passed" },
          unavailable: false,
        } as QueueValidationRunResult["runnerOutput"],
        started: true,
        startUpdate: null,
        warnings: [],
      }),
    );
    const onPromote = vi.fn();
    const onRun = vi.fn();
    const codexDirectRunFallback = vi.fn();
    const importedTask = task({
      description: [
        "Prompt pack: Core Pack (core-pack)",
        "Prompt item: build",
      ].join("\n"),
      executionWorkspace: "C:/repo",
      prompt: promptPackPrompt(),
      queueItemId: "queue-build",
      status: "draft",
      title: "build: Build task",
    });

    await render(
      <QueueV2Board
        onRequestValidation={onRequestValidation}
        queue={queueController({
          onPromote,
          onRun,
          selectedTask: importedTask,
          tasks: [importedTask],
        })}
        tasks={[importedTask]}
        validationRunner={validationRunner()}
        workers={[worker()]}
      />,
    );

    expect(onRequestValidation).not.toHaveBeenCalled();
    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(codexDirectRunFallback).not.toHaveBeenCalled();

    await openCardDetails("queue-build");

    const requestButton = buttonWithText("Request validation");
    expect(requestButton?.disabled).toBe(false);
    expect(onRequestValidation).not.toHaveBeenCalled();

    await click(buttonWithText("Files / Validation"));
    expect(activePanel()?.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );

    await click(requestButton);
    await flushAsync();

    expect(onRequestValidation).toHaveBeenCalledTimes(1);
    expect(onRequestValidation.mock.calls[0]?.[0].queueItemId).toBe("queue-build");
    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(codexDirectRunFallback).not.toHaveBeenCalled();
    expect(buttonWithText("Finalize / Accept")).toBeNull();
    expect(activePanel()?.textContent).toContain(
      "Validation passed: imported command completed.",
    );
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

async function openCardDetails(taskId: string) {
  await click(
    document.querySelector<HTMLElement>(
      `[data-queue-item-id='${taskId}'] .queue-v2-card-details`,
    ),
  );
  await click(buttonWithText("Open details"));
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
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

function queueController({
  onPromote,
  onRun,
  selectedTask,
  tasks,
}: {
  onPromote: () => void;
  onRun: () => void;
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
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      workers: [worker()],
    },
    run: {
      canStart: false,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: [],
      readinessMessage: "Task is not ready to run.",
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}

function validationRunner(): ValidationRunner {
  return {
    available: true,
    run: vi.fn(),
  };
}

function promptPackPrompt() {
  return [
    "Build prompt body.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Core Pack (core-pack)",
    "Block id: build",
    "Expected commit title: frontend: materialize prompt pack",
    "Validation commands",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
    "Imported Queue items must not auto-run.",
  ].join("\n");
}
