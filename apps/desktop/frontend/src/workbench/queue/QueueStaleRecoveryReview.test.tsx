import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask, QueueStaleRunCandidateSummary } from "../../workspace/types";
import {
  QUEUE_STALE_RECOVERY_ACTOR_ID,
  QUEUE_STALE_RECOVERY_BACKEND_CONFIRMATION_TOKEN,
  QUEUE_STALE_RECOVERY_REASON,
  QueueStaleRecoveryReview,
  queueStaleRecoveryIdentityConfirmation,
} from "./QueueStaleRecoveryReview";

const queueApiMocks = vi.hoisted(() => ({
  listStaleQueueLocalRuns: vi.fn(),
  recoverStaleQueueLocalRunFailed: vi.fn(),
}));

vi.mock("../../workspace/tauriAgentQueueApi", () => queueApiMocks);

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  queueApiMocks.listStaleQueueLocalRuns.mockReset();
  queueApiMocks.recoverStaleQueueLocalRunFailed.mockReset();
  installTauriRuntimeFlag();
});

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
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

describe("QueueStaleRecoveryReview", () => {
  it("renders stale candidates from the backend API result", async () => {
    queueApiMocks.listStaleQueueLocalRuns.mockResolvedValueOnce([candidate()]);

    renderElement(<QueueStaleRecoveryReview workspaceId="workspace-1" />);
    await flushRender();

    expect(recoverySection()?.textContent).toContain("Stale Queue run review");
    expect(document.body.textContent).toContain("Recover stuck task");
    expect(document.body.textContent).toContain("queue_i...2345");
    expect(document.body.textContent).toContain("link_98...3210");
    expect(document.body.textContent).toContain("2026-06-30T10:00:00.000Z / 2h old");
    expect(document.body.textContent).toContain("stale_running_queue_local");
    expect(document.body.textContent).toContain("queue_local:codex");
  });

  it("does not render the stale review surface when the backend list is empty", async () => {
    queueApiMocks.listStaleQueueLocalRuns.mockResolvedValueOnce([]);

    renderElement(<QueueStaleRecoveryReview workspaceId="workspace-1" />);
    await flushRender();

    expect(recoverySection()).toBeNull();
  });

  it("does not call recovery on render", async () => {
    queueApiMocks.listStaleQueueLocalRuns.mockResolvedValueOnce([candidate()]);

    renderElement(<QueueStaleRecoveryReview workspaceId="workspace-1" />);
    await flushRender();

    expect(queueApiMocks.recoverStaleQueueLocalRunFailed).not.toHaveBeenCalled();
  });

  it("does not call recovery when the operator has not typed the confirmation phrase", async () => {
    queueApiMocks.listStaleQueueLocalRuns.mockResolvedValueOnce([candidate()]);

    renderElement(<QueueStaleRecoveryReview workspaceId="workspace-1" />);
    await flushRender();
    clickButton("Review recovery");
    await flushRender();

    const confirmButton = buttonByText("Mark failed");
    expect(confirmButton?.disabled).toBe(true);
    await clickButtonAsync("Mark failed");

    expect(queueApiMocks.recoverStaleQueueLocalRunFailed).not.toHaveBeenCalled();
  });

  it("calls recovery exactly once with exact ids after confirmed operator recovery and refreshes", async () => {
    const staleCandidate = candidate();
    const refreshAfterExternalMutation = vi.fn(async () => undefined);
    const startWorkers = vi.fn();
    const startAssignedTask = vi.fn();
    const retrySame = vi.fn();
    const retryModified = vi.fn();
    queueApiMocks.listStaleQueueLocalRuns
      .mockResolvedValueOnce([staleCandidate])
      .mockResolvedValueOnce([]);
    queueApiMocks.recoverStaleQueueLocalRunFailed.mockResolvedValueOnce({
      evidenceBundleId: "evidence-1",
      queueItemId: staleCandidate.queueItemId,
      reason: QUEUE_STALE_RECOVERY_REASON,
      runId: staleCandidate.runId,
      runLinkId: staleCandidate.runLinkId,
      runLinkStatus: "failed",
      taskStatus: "failed",
      workspaceId: staleCandidate.workspaceId,
    });

    renderElement(
      <QueueStaleRecoveryReview
        queue={{
          foundation: { onStartWorkers: startWorkers },
          refreshAfterExternalMutation,
          run: { onStartAssignedTask: startAssignedTask },
          smartQueueRetry: {
            onRetrySame: retrySame,
            onRetryWithModifiedPrompt: retryModified,
          },
        } as never}
        workspaceId="workspace-1"
      />,
    );
    await flushRender();
    clickButton("Review recovery");
    setInputByLabel(
      "Confirmation",
      queueStaleRecoveryIdentityConfirmation(staleCandidate),
    );
    await clickButtonAsync("Mark failed");
    await flushRender();

    expect(queueApiMocks.recoverStaleQueueLocalRunFailed).toHaveBeenCalledTimes(1);
    expect(queueApiMocks.recoverStaleQueueLocalRunFailed).toHaveBeenCalledWith({
      actorId: QUEUE_STALE_RECOVERY_ACTOR_ID,
      confirmationToken: QUEUE_STALE_RECOVERY_BACKEND_CONFIRMATION_TOKEN,
      queueItemId: staleCandidate.queueItemId,
      reason: QUEUE_STALE_RECOVERY_REASON,
      runId: staleCandidate.runId,
      runLinkId: staleCandidate.runLinkId,
      workspaceId: staleCandidate.workspaceId,
    });
    expect(refreshAfterExternalMutation).toHaveBeenCalledTimes(1);
    expect(refreshAfterExternalMutation).toHaveBeenCalledWith(
      staleCandidate.queueItemId,
    );
    expect(queueApiMocks.listStaleQueueLocalRuns).toHaveBeenCalledTimes(2);
    expect(startWorkers).not.toHaveBeenCalled();
    expect(startAssignedTask).not.toHaveBeenCalled();
    expect(retrySame).not.toHaveBeenCalled();
    expect(retryModified).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Recovered");
    expect(document.body.textContent).not.toContain("widget_runs");
  });

  it("does not infer stale candidates from local Queue task state", async () => {
    queueApiMocks.listStaleQueueLocalRuns.mockResolvedValueOnce([]);

    renderElement(
      <QueueStaleRecoveryReview
        queue={{
          refreshAfterExternalMutation: vi.fn(),
          tasks: [
            queueTask({
              assignedExecutorWidgetId: null,
              queueItemId: "local-running-task",
              status: "running",
              title: "Local running task",
            }),
          ],
        } as never}
        workspaceId="workspace-1"
      />,
    );
    await flushRender();

    expect(recoverySection()).toBeNull();
    expect(queueApiMocks.recoverStaleQueueLocalRunFailed).not.toHaveBeenCalled();
  });
});

function renderElement(element: ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

async function flushRender() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function recoverySection() {
  return Array.from(document.querySelectorAll<HTMLElement>("section")).find(
    (section) =>
      section.getAttribute("aria-label") === "Stale Queue recovery review",
  ) ?? null;
}

function clickButton(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickButtonAsync(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === text,
  );
}

function setInputByLabel(label: string, value: string) {
  const input = inputByLabel(label);

  if (!input) {
    throw new Error(`Input not found: ${label}`);
  }

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function inputByLabel(label: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const labelElement = labels.find((item) => item.textContent === label);
  const inputId = labelElement?.getAttribute("for");

  return inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
}

function installTauriRuntimeFlag() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function candidate(
  overrides: Partial<QueueStaleRunCandidateSummary> = {},
): QueueStaleRunCandidateSummary {
  return {
    ageSeconds: 7200,
    executorWidgetId: "queue_local:codex",
    queueItemId: "queue_item_12345",
    reasonCode: "stale_running_queue_local",
    runId: "run_1234567890",
    runLinkId: "link_9876543210",
    runLinkStatus: "running",
    source: "queue_local",
    startedAt: "2026-06-30T10:00:00.000Z",
    taskStatus: "running",
    taskTitle: "Recover stuck task",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    createdAt: "2026-06-30T09:00:00.000Z",
    description: "Task description",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Prompt",
    queueItemId: "queue-1",
    status: "ready",
    title: "Queue task",
    updatedAt: "2026-06-30T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
