import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type {
  AgentQueueSmartAssistanceRequest,
} from "../../queue/agentQueueSmartAssistanceActions";
import type { ValidationRunner } from "../../validation";

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

export async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

export async function click(element: Element | null) {
  if (!element) {
    throw new Error("Expected element to click.");
  }

  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

export function card(taskId: string) {
  return document.querySelector<HTMLElement>(
    `[data-queue-item-id='${taskId}']`,
  );
}

export function cardActionsButton(taskId: string) {
  return (
    card(taskId)?.querySelector<HTMLButtonElement>(
      ".queue-v2-card-details",
    ) ?? null
  );
}

export async function openCardDetails(taskId: string) {
  await click(cardActionsButton(taskId));
  await click(buttonWithText("Open details"));
}

export function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

export function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (dialog) => dialog.textContent?.includes(name),
    ) ?? null
  );
}

export function menuByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='menu']")).find(
      (menu) => menu.getAttribute("aria-label") === name,
    ) ?? null
  );
}

export function buttonInRegion(
  region: Element | null,
  text: string,
): HTMLButtonElement | null {
  return (
    Array.from(region?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

export function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

export async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

export async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

export function visibleCardOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-order-id]"))
    .map((element) => element.dataset.taskOrderId);
}

export function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

export function laneToggle(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".queue-v2-collapsible-lane-header",
      ),
    ).find((element) =>
      element.getAttribute("aria-label")?.includes(`${label} lane`),
    ) ?? null
  );
}

export function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
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

export function worker(
  overrides: Partial<AgentWorkerSummary> = {},
): AgentWorkerSummary {
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

export function report(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
) {
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

export function validationRawPreview(hugeOutput: string) {
  return [
    "Validation evidence",
    "Run: validation-run-1",
    "Queue item: validated",
    "Suite: queue-validation",
    "Status: passed",
    "Summary: one command passed",
    "",
    "Command: npm.cmd run test -- --run Validation (validation-1)",
    "Status: passed",
    "Exit code: 0",
    "Duration: 42 ms",
    "Cwd: C:/work",
    `Stdout preview:\n${hugeOutput}`,
    "Stderr preview:\nempty",
    "Warnings: stdout was capped before Queue review.",
    "Full log ref: HUGE_LOG_SENTINEL",
  ].join("\n");
}

export function validationRunner(): ValidationRunner {
  return {
    available: true,
    run: vi.fn(),
  };
}

export function queueController({
  onPromote = vi.fn(),
  onAskWorkspaceAgent = vi.fn(),
  onRetrySame = vi.fn(),
  onRetryWithModifiedPrompt = vi.fn(),
  onRun = vi.fn(),
  readinessMessage = null,
  runCanStart = false,
  selectedTask,
  tasks,
}: {
  onPromote?: () => void;
  onAskWorkspaceAgent?: () =>
    | Promise<AgentQueueSmartAssistanceRequest | null>
    | AgentQueueSmartAssistanceRequest
    | null;
  onRetrySame?: () => void;
  onRetryWithModifiedPrompt?: (modifiedPrompt: string) => Promise<boolean> | boolean;
  onRun?: () => void;
  readinessMessage?: string | null;
  runCanStart?: boolean;
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
      canStart: runCanStart,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: [],
      readinessMessage,
    },
    smartQueueRetry: {
      canRetrySame: true,
      canRetryWithModifiedPrompt: true,
      error: null,
      isRetrying: false,
      message: null,
      onRetrySame,
      onRetryWithModifiedPrompt: async (modifiedPrompt: string) =>
        Boolean(await onRetryWithModifiedPrompt(modifiedPrompt)),
    },
    smartQueueAssistance: {
      available: true,
      canAskWorkspaceAgent: true,
      error: null,
      isRequesting: false,
      message: null,
      onAskWorkspaceAgent: async () => onAskWorkspaceAgent(),
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}

export function promptPackPrompt() {
  return [
    "Build prompt body.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Core Pack (core-pack)",
    "Block id: build",
    "Prompt-pack dependencies: setup",
    "Expected commit title: frontend: materialize prompt pack",
    "Validation commands",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
    "Allowed scope",
    "- frontend only",
    "Forbidden scope",
    "- backend storage",
    'Raw prompt-pack JSON was {"items":[{"id":"build"}]} and must not be shown as metadata.',
    "Imported Queue items must not auto-run.",
  ].join("\n");
}
