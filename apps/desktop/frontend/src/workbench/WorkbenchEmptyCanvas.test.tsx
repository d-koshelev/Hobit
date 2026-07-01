import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkbenchEmptyCanvas } from "./WorkbenchEmptyCanvas";
import type { QueueWorkspaceRecoveryProjection } from "../workspace/types";

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
  vi.clearAllMocks();
});

describe("WorkbenchEmptyCanvas Queue recovery projection", () => {
  it("shows the Queue recovery affordance only from backend projection availability", () => {
    renderEmptyCanvas({
      queueRecovery: queueRecoveryProjection({
        queueTaskCount: 2,
        recoveryAvailable: true,
        canRestoreQueueView: true,
      }),
    });

    expect(document.body.textContent).toContain("Agent Queue has saved tasks");
    expect(buttonWithText("Open Agent Queue")).not.toBeNull();
  });

  it("does not infer recovery from task count when the projection says unavailable", () => {
    renderEmptyCanvas({
      queueRecovery: queueRecoveryProjection({
        queueTaskCount: 2,
        recoveryAvailable: false,
      }),
    });

    expect(document.body.textContent).not.toContain(
      "Agent Queue has saved tasks",
    );
    expect(buttonWithText("Open Agent Queue")).toBeNull();
  });

  it("does not show recovery when the projection has no Queue state", () => {
    renderEmptyCanvas({
      queueRecovery: queueRecoveryProjection({
        canRestoreQueueView: false,
        queueTaskCount: 0,
        recoveryAvailable: false,
        recoveryReason: "no_queue_state",
      }),
    });

    expect(document.body.textContent).not.toContain(
      "Agent Queue has saved tasks",
    );
    expect(buttonWithText("Open Agent Queue")).toBeNull();
  });
});

function renderEmptyCanvas({
  queueRecovery,
}: {
  queueRecovery: QueueWorkspaceRecoveryProjection;
}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkbenchEmptyCanvas
        canvasGridStyle={{}}
        canvasLabel="Empty canvas"
        canvasShellClass="canvas-shell"
        onOpenQueueView={vi.fn()}
        onOpenWidgetCatalog={vi.fn()}
        onStartCoordinatorWorkspace={vi.fn()}
        queueRecovery={queueRecovery}
      />,
    );
  });
}

function buttonWithText(text: string) {
  return (
    Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === text,
    ) ?? null
  );
}

function queueRecoveryProjection(
  overrides: Partial<QueueWorkspaceRecoveryProjection> = {},
): QueueWorkspaceRecoveryProjection {
  return {
    canRestoreQueueView: true,
    canonicalQueueWidgetId: null,
    controlState: null,
    hasVisibleQueueView: false,
    queueTaskCount: 1,
    recoveryAvailable: true,
    recoveryReason: "queue_state_without_visible_view",
    runningTaskCount: 0,
    staleRunningCandidateCount: 0,
    workspaceId: "workspace_1",
    ...overrides,
  };
}
