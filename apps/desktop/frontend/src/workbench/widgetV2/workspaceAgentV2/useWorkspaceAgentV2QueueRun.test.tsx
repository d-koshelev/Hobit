import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentContextSnapshot } from "../../agentRuntime";
import type {
  QueueCreateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import { useWorkspaceAgentV2QueueRun } from "./useWorkspaceAgentV2QueueRun";
import type { WorkspaceAgentV2QueueRunControllerResult } from "./workspaceAgentV2QueueRunModel";

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

describe("useWorkspaceAgentV2QueueRun", () => {
  it("starts in idle state and render does not create a Queue task", async () => {
    const createItem = createItemMock();

    await render(<QueueRunHarness queueBridge={queueBridge({ createItem })} />);

    expect(textByTestId("status")).toBe("idle");
    expect(createItem).not.toHaveBeenCalled();
  });

  it("explicit Queue Run creates one Queue task from prompt and visible context", async () => {
    const createItem = createItemMock();

    await render(
      <QueueRunHarness
        contextItems={[
          {
            id: "context-chip-1",
            label: "Visible chip",
            source: "Context strip",
            type: "manual",
          },
        ]}
        prompt="Promote this explicit task."
        queueBridge={queueBridge({ createItem })}
        visibleContextSnapshot={visibleContextSnapshot}
      />,
    );

    await click(buttonWithText("Start queue run"));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "workspace_agent",
        prompt: "Promote this explicit task.",
        status: "draft",
        title: "Promote this explicit task.",
      }),
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "knowledge:knowledge-doc-1",
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "manual:context-chip-1",
    );
    expect(textByTestId("status")).toBe("created");
    expect(textByTestId("result")).toContain("queue-item-1");
    expect(textByTestId("result")).toContain("Promote this explicit task.");
    expect(textByTestId("result")).toContain("2");
  });

  it("empty prompt is rejected before Queue service call", async () => {
    const createItem = createItemMock();

    await render(
      <QueueRunHarness prompt="   " queueBridge={queueBridge({ createItem })} />,
    );
    await click(buttonWithText("Start queue run"));

    expect(createItem).not.toHaveBeenCalled();
    expect(textByTestId("status")).toBe("unsupported");
    expect(textByTestId("error")).toBe(
      "Prompt is required before creating a Queue task.",
    );
  });

  it("failed Queue create maps to failed state", async () => {
    const createItem = createItemMock({
      ok: false,
      error: {
        code: "storage_failed",
        message: "Queue storage failed.",
      },
      item: undefined,
      message: "Queue storage failed.",
    });

    await render(<QueueRunHarness queueBridge={queueBridge({ createItem })} />);
    await click(buttonWithText("Start queue run"));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(textByTestId("status")).toBe("failed");
    expect(textByTestId("error")).toBe("Queue storage failed.");
  });

  it("created result is emitted once for duplicate starts after creation", async () => {
    const createItem = createItemMock();
    const onResult = vi.fn();

    await render(
      <QueueRunHarness
        onResult={onResult}
        queueBridge={queueBridge({ createItem })}
      />,
    );

    await click(buttonWithText("Start queue run"));
    await click(buttonWithText("Start queue run"));

    expect(createItem).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({
      createdTask: {
        id: "queue-item-1",
      },
      status: "created",
    });
  });

  it("ignores duplicate Queue Run starts while creating", async () => {
    const createItem = createPendingItemMock();

    await render(
      <QueueRunHarness queueBridge={queueBridge({ createItem })} />,
    );

    await clickOneTick(buttonWithText("Start queue run"));
    await clickOneTick(buttonWithText("Start queue run"));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(textByTestId("status")).toBe("creating_task");
    expect(textByTestId("warnings")).toContain(
      "Queue Run is already creating a task; duplicate start was ignored.",
    );
  });

  it("Queue Run create path does not call run, start, or autorun actions", async () => {
    const createItem = createItemMock();
    const startAssignedAgentQueueTask = vi.fn();
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();

    await render(
      <QueueRunHarness
        queueBridge={queueBridge({
          createItem,
          runAutonomousQueue,
          stopAutonomousQueueAfterCurrent,
        })}
        startAssignedAgentQueueTask={startAssignedAgentQueueTask}
      />,
    );

    await click(buttonWithText("Start queue run"));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });
});

function QueueRunHarness({
  contextItems,
  onResult,
  prompt = "Create a Queue task only.",
  queueBridge,
  startAssignedAgentQueueTask: _startAssignedAgentQueueTask,
  visibleContextSnapshot,
}: {
  readonly contextItems?: Parameters<
    typeof useWorkspaceAgentV2QueueRun
  >[0]["contextItems"];
  readonly onResult?: (result: WorkspaceAgentV2QueueRunControllerResult) => void;
  readonly prompt?: string;
  readonly queueBridge?: Pick<WorkspaceAgentQueueBridge, "createItem"> | null;
  readonly startAssignedAgentQueueTask?: () => void;
  readonly visibleContextSnapshot?: AgentContextSnapshot;
}) {
  const controller = useWorkspaceAgentV2QueueRun({
    contextItems,
    createdFromRunId: "direct-run-1",
    onResult,
    queueBridge,
    visibleContextSnapshot,
  });

  return (
    <section>
      <button onClick={() => void controller.startQueueRun(prompt)} type="button">
        Start queue run
      </button>
      <output data-testid="status">{controller.status}</output>
      <output data-testid="error">{controller.errorMessage}</output>
      <output data-testid="warnings">{controller.warnings.join("\n")}</output>
      <output data-testid="result">
        {controller.result
          ? [
              controller.result.createdTask?.id,
              controller.result.createdTask?.title,
              controller.result.createdTask?.status,
              controller.result.attachedContextCount,
              controller.result.openTaskAction?.action,
            ]
              .filter((value) => value !== undefined)
              .join("\n")
          : ""}
      </output>
    </section>
  );
}

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickOneTick(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function textByTestId(testId: string) {
  return document.querySelector(`[data-testid='${testId}']`)?.textContent ?? "";
}

function queueBridge({
  createItem,
  runAutonomousQueue,
  stopAutonomousQueueAfterCurrent,
}: {
  readonly createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  readonly runAutonomousQueue?: WorkspaceAgentQueueBridge["runAutonomousQueue"];
  readonly stopAutonomousQueueAfterCurrent?: WorkspaceAgentQueueBridge["stopAutonomousQueueAfterCurrent"];
}): Pick<WorkspaceAgentQueueBridge, "createItem"> &
  Partial<WorkspaceAgentQueueBridge> {
  return {
    createItem,
    runAutonomousQueue,
    stopAutonomousQueueAfterCurrent,
  };
}

function createItemMock(
  overrides: Partial<QueueWidgetActionResult<QueueWidgetItemSnapshot>> = {},
) {
  return vi.fn(
    async (
      request: Omit<QueueCreateItemRequest, "workspaceId">,
    ): Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>> =>
      queueCreateResult({
        item: queueItem({ prompt: request.prompt, title: request.title }),
        ...overrides,
      }),
  );
}

function createPendingItemMock() {
  return vi.fn(
    async (): Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>> =>
      new Promise(() => undefined),
  );
}

function firstCreateRequest(
  createItem: ReturnType<typeof createItemMock>,
): Omit<QueueCreateItemRequest, "workspaceId"> {
  const request = createItem.mock.calls[0]?.[0];
  expect(request).toBeDefined();
  return request as Omit<QueueCreateItemRequest, "workspaceId">;
}

function queueCreateResult(
  overrides: Partial<QueueWidgetActionResult<QueueWidgetItemSnapshot>> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.createItem",
    events: [],
    item: queueItem(),
    message:
      "Queue item created. No task execution, Agent Executor run, Queue Autorun, Terminal command, Git action, validation, or coordinator finalization was started.",
    ok: true,
    safetyClass: "safe_create_update",
    ...overrides,
  };
}

function queueItem(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    approvalPolicy: null,
    blockers: [],
    codexExecutable: null,
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionStatus: "draft",
    executionWorkspace: null,
    id: "queue-item-1",
    priority: 0,
    prompt: "Create a Queue task only.",
    queueId: "workspace:workspace-1:agent-queue",
    queueTag: {
      id: null,
      name: null,
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    sandbox: null,
    status: "draft",
    title: "Create a Queue task only.",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

const visibleContextSnapshot: AgentContextSnapshot = {
  contextRefs: [
    {
      id: "knowledge-doc-1",
      kind: "knowledge",
      label: "Queue Run source",
      scope: "workspace-local",
    },
  ],
  createdAtMs: 1_000,
  id: "snapshot-1",
  summary: "Visible Queue Run context.",
  tokenEstimate: 12,
  visibleTextPreview: "Visible only.",
};
